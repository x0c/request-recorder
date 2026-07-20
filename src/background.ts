import type { BackgroundEvent, ExtensionMessage, GetStateResponse } from "~lib/messages"
import {
  addSession,
  getFilterConfig,
  getSessions,
  saveFilterConfig,
  saveRequest,
  saveSessions,
  updateSession
} from "~lib/storage"
import type {
  FilterConfig,
  RecordedRequest,
  RecordingState,
  RequestHeader,
  RequestType,
  TriggerInfo
} from "~lib/types"
import { DEFAULT_FILTER, DEFAULT_RECORDING_STATE } from "~lib/types"
import { formatTime, generateId } from "~lib/utils"

// ─── 常量 ────────────────────────────────────────────────────────────────────

/** chrome.storage.session 中保存录制状态的 key，用于 SW 挂起唤醒后恢复录制 */
const STATE_KEY = "rr:state"
/** webRequest 完成后等待 page 侧响应体上报的宽限时间 */
const PAGE_GRACE_MS = 1500
/** 超过该时长仍未完成的 pending entry 由清扫任务强制收尾 */
const ENTRY_TTL_MS = 60_000
/** 单侧 body 持久化最大字符数（配合 page 侧上限做双保险） */
const MAX_BODY_CHARS = 512 * 1024
/** session.requestIds 批量落盘的防抖间隔 */
const SESSION_SYNC_DEBOUNCE_MS = 500
/** 兜底清扫 alarm 名 */
const SWEEP_ALARM = "rr-sweep"

// ─── 运行时状态（内存）────────────────────────────────────────────────────────

let recordingState: RecordingState = { ...DEFAULT_RECORDING_STATE }
let filterConfig: FilterConfig = { ...DEFAULT_FILTER }

// ─── Pending 关联机制 ─────────────────────────────────────────────────────────
//
// webRequest 事件以 details.requestId 为唯一标识；page 侧事件带有 page-patcher
// 自己生成的 requestId。两侧的配对规则：
// - page 响应事件 → 通过 pageRequestId 精确匹配（同一请求的请求/响应事件同 id）
// - page 请求事件 / webRequest 事件 → 按 tabId:url:method 的 FIFO 队列互相认领
// 这样并发同 URL 请求（轮询场景）各自独立成条目，不会再互相覆盖。

interface PendingEntry {
  id: string
  sessionId: string
  timestamp: number
  tabId: number
  url: string
  method: string
  /** 精确类型：webRequest 侧 xmlhttprequest 会先记为 xhr，page 侧 kind 到达后修正为真实值 */
  type: RequestType
  requestHeaders: RequestHeader[]
  requestBody: string | null
  status: number | null
  responseHeaders: RequestHeader[]
  responseBody: string | null
  duration: number | null
  triggerInfo: TriggerInfo | null
  /** onErrorOccurred 的错误信息 */
  error: string | null
  /** webRequest 的 requestId（page 侧先行创建时为 null，webRequest 事件到达后回填） */
  wrRequestId: string | null
  /** page-patcher 的 requestId */
  pageRequestId: string | null
  webRequestDone: boolean
  pageDone: boolean
  /** xhr/fetch 类请求需要等 page 侧响应体；放弃等待时置 false */
  expectPageBody: boolean
  createdAt: number
  graceTimer: ReturnType<typeof setTimeout> | null
}

const allEntries = new Set<PendingEntry>()
const byWrId = new Map<string, PendingEntry>()
const byPageId = new Map<string, PendingEntry>()
/** FIFO 待配对队列：key = `${tabId}:${url}:${method}` */
const matchQueues = new Map<string, PendingEntry[]>()

function queueKey(tabId: number, url: string, method: string): string {
  return `${tabId}:${url}:${method.toUpperCase()}`
}

function enqueue(entry: PendingEntry): void {
  const key = queueKey(entry.tabId, entry.url, entry.method)
  const arr = matchQueues.get(key)
  if (arr) {
    arr.push(entry)
  } else {
    matchQueues.set(key, [entry])
  }
}

function dequeue(entry: PendingEntry): void {
  const key = queueKey(entry.tabId, entry.url, entry.method)
  const arr = matchQueues.get(key)
  if (!arr) return
  const idx = arr.indexOf(entry)
  if (idx !== -1) arr.splice(idx, 1)
  if (arr.length === 0) matchQueues.delete(key)
}

function findInQueue(
  tabId: number,
  url: string,
  method: string,
  pred: (e: PendingEntry) => boolean
): PendingEntry | null {
  const arr = matchQueues.get(queueKey(tabId, url, method))
  if (!arr) return null
  return arr.find(pred) ?? null
}

function createEntry(init: {
  tabId: number
  url: string
  method: string
  type: RequestType
  timestamp: number
  requestHeaders?: RequestHeader[]
}): PendingEntry {
  const entry: PendingEntry = {
    id: generateId(),
    sessionId: recordingState.currentSessionId!,
    timestamp: init.timestamp,
    tabId: init.tabId,
    url: init.url,
    method: init.method.toUpperCase(),
    type: init.type,
    requestHeaders: init.requestHeaders ?? [],
    requestBody: null,
    status: null,
    responseHeaders: [],
    responseBody: null,
    duration: null,
    triggerInfo: null,
    error: null,
    wrRequestId: null,
    pageRequestId: null,
    webRequestDone: false,
    pageDone: false,
    expectPageBody: false,
    createdAt: Date.now(),
    graceTimer: null
  }
  allEntries.add(entry)
  enqueue(entry)
  return entry
}

// ─── 过滤 ────────────────────────────────────────────────────────────────────

function mapResourceType(type: chrome.webRequest.ResourceType): RequestType {
  if (type === "xmlhttprequest") return "xhr"
  if (type === "script") return "script"
  if (type === "stylesheet") return "stylesheet"
  if (type === "image") return "image"
  return "other"
}

/** webRequest 侧准入：xmlhttprequest 无法区分 xhr/fetch，任一勾选即放行，flush 时按 page 侧精确类型再过滤 */
function typeAllowedEarly(type: chrome.webRequest.ResourceType): boolean {
  const mapped = mapResourceType(type)
  if (filterConfig.types.includes(mapped)) return true
  if (mapped === "xhr" && filterConfig.types.includes("fetch")) return true
  return false
}

function urlAllowed(url: string): boolean {
  return !filterConfig.urlKeyword || url.includes(filterConfig.urlKeyword)
}

function shouldRecordEarly(url: string, type: chrome.webRequest.ResourceType): boolean {
  return recordingState.isRecording && typeAllowedEarly(type) && urlAllowed(url)
}

/** flush 时的最终判定：类型已被 page 侧 kind 修正为精确值，按当前过滤器精确过滤 */
function finalAllowed(entry: PendingEntry): boolean {
  return filterConfig.types.includes(entry.type) && urlAllowed(entry.url)
}

// ─── Flush ───────────────────────────────────────────────────────────────────

function truncateBody(body: string | null): string | null {
  if (body == null) return null
  if (body.length <= MAX_BODY_CHARS) return body
  return body.slice(0, MAX_BODY_CHARS) + `\n… [truncated: 原文共 ${body.length} 字符]`
}

function maybeFlush(entry: PendingEntry): void {
  if (!entry.webRequestDone) return
  if (entry.expectPageBody && !entry.pageDone) {
    // 给 page 侧响应体一个短宽限，超时后放弃等待直接落盘
    if (!entry.graceTimer) {
      entry.graceTimer = setTimeout(() => {
        entry.graceTimer = null
        entry.expectPageBody = false
        void flushEntry(entry)
      }, PAGE_GRACE_MS)
    }
    return
  }
  void flushEntry(entry)
}

async function flushEntry(entry: PendingEntry): Promise<void> {
  if (entry.graceTimer) {
    clearTimeout(entry.graceTimer)
    entry.graceTimer = null
  }
  allEntries.delete(entry)
  if (entry.wrRequestId) byWrId.delete(entry.wrRequestId)
  if (entry.pageRequestId) byPageId.delete(entry.pageRequestId)
  dequeue(entry)

  // page 侧修正后的精确类型 / 最终 URL 未通过过滤器：整条丢弃
  if (!finalAllowed(entry)) return

  const req: RecordedRequest = {
    id: entry.id,
    sessionId: entry.sessionId,
    timestamp: entry.timestamp,
    url: entry.url,
    method: entry.method,
    type: entry.type,
    requestHeaders: entry.requestHeaders,
    requestBody: truncateBody(entry.requestBody),
    status: entry.status,
    responseHeaders: entry.responseHeaders,
    responseBody: truncateBody(entry.responseBody),
    duration: entry.duration,
    ...(entry.triggerInfo ? { triggerInfo: entry.triggerInfo } : {}),
    ...(entry.error ? { error: entry.error } : {})
  }

  try {
    await saveRequest(req)
  } catch (e) {
    console.error("[rr] 请求写入 storage 失败，已丢弃该条", e)
    return
  }

  recordSavedId(entry.sessionId, req.id)
  recordingState.capturedCount++
  notifyCaptured(entry.tabId)
}

// ─── session.requestIds 批量同步（防抖）──────────────────────────────────────
//
// 每条请求落盘只写自己的 rr:req:<id>（O(单条)），会话的 requestIds 数组攒批后
// 一次性读写 sessions，避免每条请求都全量读写 sessions 造成的 O(n²) 写入放大。

const sessionIdBuffer = new Map<string, string[]>()
let sessionSyncTimer: ReturnType<typeof setTimeout> | null = null

function recordSavedId(sessionId: string, requestId: string): void {
  const arr = sessionIdBuffer.get(sessionId)
  if (arr) {
    arr.push(requestId)
  } else {
    sessionIdBuffer.set(sessionId, [requestId])
  }
  if (!sessionSyncTimer) {
    sessionSyncTimer = setTimeout(() => {
      sessionSyncTimer = null
      void syncSessionRequestIds()
    }, SESSION_SYNC_DEBOUNCE_MS)
  }
}

async function syncSessionRequestIds(): Promise<void> {
  if (sessionIdBuffer.size === 0) return
  try {
    const sessions = await getSessions()
    let changed = false
    for (const s of sessions) {
      const pending = sessionIdBuffer.get(s.id)
      if (pending && pending.length > 0) {
        s.requestIds = [...s.requestIds, ...pending]
        sessionIdBuffer.delete(s.id)
        changed = true
      }
    }
    // 会话已被删除的残留 id 直接丢弃
    for (const key of [...sessionIdBuffer.keys()]) {
      if (!sessions.some((s) => s.id === key)) sessionIdBuffer.delete(key)
    }
    if (changed) await saveSessions(sessions)
  } catch (e) {
    console.error("[rr] 同步会话请求列表失败，将重试", e)
    // 失败不丢 buffer，等下一批触发时重试
    if (!sessionSyncTimer) {
      sessionSyncTimer = setTimeout(() => {
        sessionSyncTimer = null
        void syncSessionRequestIds()
      }, SESSION_SYNC_DEBOUNCE_MS)
    }
  }
}

// ─── 广播 ────────────────────────────────────────────────────────────────────

function broadcastToAllTabs(event: BackgroundEvent): void {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(tab.id, event).catch(() => {
          // 部分 tab 没有 content script，忽略错误
        })
      }
    }
  })
}

function broadcastToPopup(event: BackgroundEvent): void {
  chrome.runtime.sendMessage(event).catch(() => {
    // popup 未开启时忽略
  })
}

function broadcastStateChanged(): void {
  const event: BackgroundEvent = { type: "STATE_CHANGED", state: { ...recordingState } }
  broadcastToAllTabs(event)
  broadcastToPopup(event)
}

/** 每条请求的计数通知只发给发起请求的 tab（浮动按钮计数）和 popup，不再全量广播 */
function notifyCaptured(tabId: number): void {
  const event: BackgroundEvent = { type: "REQUEST_CAPTURED", count: recordingState.capturedCount }
  if (tabId >= 0) {
    chrome.tabs.sendMessage(tabId, event).catch(() => {})
  }
  broadcastToPopup(event)
}

// ─── 录制状态持久化（SW 挂起恢复）────────────────────────────────────────────

async function persistState(): Promise<void> {
  try {
    await chrome.storage.session.set({ [STATE_KEY]: recordingState })
  } catch (e) {
    console.error("[rr] 持久化录制状态失败", e)
  }
}

// ─── 初始化：SW 启动时恢复配置与录制状态 ─────────────────────────────────────
//
// 用一个可等待的 promise 让 init 可等待，消除"void init() 不阻塞 listener / listener
// 先于 init 完成处理消息"的竞态：listener 等待 readyPromise 完成后再处理录制相关消息。
let readyPromise: Promise<void> | null = null

async function init(): Promise<void> {
  filterConfig = await getFilterConfig()

  let stored: RecordingState | undefined
  try {
    const result = await chrome.storage.session.get(STATE_KEY)
    stored = result[STATE_KEY] as RecordingState | undefined
  } catch {
    stored = undefined
  }

  const sessions = await getSessions()
  let resumed = false

  if (stored?.isRecording && stored.currentSessionId) {
    const session = sessions.find((s) => s.id === stored.currentSessionId)
    if (session && session.endTime == null) {
      // SW 挂起前正在录制：恢复状态，capturedCount 从已落盘的请求数重建
      recordingState = {
        isRecording: true,
        currentSessionId: session.id,
        capturedCount: session.requestIds.length
      }
      resumed = true
      console.info("[rr] SW 重启，恢复录制会话", session.id)
    }
  }

  if (!resumed) {
    recordingState = { ...DEFAULT_RECORDING_STATE }
    // 浏览器整体重启后 storage.session 被清空，遗留的"录制中"会话补写 endTime，
    // 否则历史页会永远显示"录制中"
    const now = Date.now()
    let fixed = false
    for (const s of sessions) {
      if (s.endTime == null) {
        s.endTime = now
        fixed = true
      }
    }
    if (fixed) await saveSessions(sessions)
  }

  await persistState()
}

/** SW 每次被唤醒时都会执行顶层代码，借此恢复录制状态；用 readyPromise 让 listener 可等待 */
function boot(): void {
  if (!readyPromise) {
    readyPromise = init().catch((e) => {
      console.error("[rr] init 失败", e)
    })
  }
}

chrome.runtime.onInstalled.addListener(() => boot())
chrome.runtime.onStartup.addListener(() => boot())
boot()

// SW 即将挂起时尽力把未落盘的 requestIds 同步掉
chrome.runtime.onSuspend.addListener(() => {
  void syncSessionRequestIds()
})

// ─── 兜底清扫：超时未完成的 entry 强制收尾 ───────────────────────────────────
//
// setTimeout 在 SW 挂起后会丢失，chrome.alarms 能唤醒 SW，用它做周期兜底。

chrome.alarms.create(SWEEP_ALARM, { periodInMinutes: 0.5 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SWEEP_ALARM) return
  const now = Date.now()
  for (const entry of [...allEntries]) {
    if (now - entry.createdAt > ENTRY_TTL_MS) {
      entry.expectPageBody = false
      entry.webRequestDone = true
      void flushEntry(entry)
    }
  }
})

// ─── webRequest 监听 ──────────────────────────────────────────────────────────

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.tabId < 0) return

    // 重定向后会对同一 requestId 再次触发：直接更新 headers 与 URL
    const existing = byWrId.get(details.requestId)
    if (existing) {
      existing.requestHeaders = (details.requestHeaders ?? []) as RequestHeader[]
      existing.url = details.url
      return
    }

    if (!shouldRecordEarly(details.url, details.type)) return

    const headers = (details.requestHeaders ?? []) as RequestHeader[]

    // 优先认领 page 侧先行创建的 entry（page 事件通常比 webRequest 早到）
    const pageFirst = findInQueue(
      details.tabId,
      details.url,
      details.method,
      (e) => e.wrRequestId === null
    )
    if (pageFirst) {
      pageFirst.wrRequestId = details.requestId
      pageFirst.requestHeaders = headers
      byWrId.set(details.requestId, pageFirst)
      return
    }

    const entry = createEntry({
      tabId: details.tabId,
      url: details.url,
      method: details.method,
      type: mapResourceType(details.type),
      timestamp: details.timeStamp,
      requestHeaders: headers
    })
    entry.wrRequestId = details.requestId
    entry.expectPageBody = details.type === "xmlhttprequest"
    byWrId.set(details.requestId, entry)
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
)

chrome.webRequest.onCompleted.addListener(
  (details) => {
    let entry = byWrId.get(details.requestId)

    if (!entry) {
      // onSendHeaders 漏掉的极端情况（如 SW 刚好重启丢了索引）：按准入条件补建
      if (details.tabId < 0 || !shouldRecordEarly(details.url, details.type)) return
      entry = createEntry({
        tabId: details.tabId,
        url: details.url,
        method: details.method,
        type: mapResourceType(details.type),
        timestamp: details.timeStamp
      })
      entry.wrRequestId = details.requestId
      entry.expectPageBody = details.type === "xmlhttprequest"
      byWrId.set(details.requestId, entry)
    }

    entry.status = details.statusCode
    entry.responseHeaders = (details.responseHeaders ?? []) as RequestHeader[]
    entry.url = details.url // 重定向链的最终 URL
    entry.webRequestDone = true
    maybeFlush(entry)
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
)

chrome.webRequest.onBeforeRedirect.addListener(
  (details) => {
    const entry = byWrId.get(details.requestId)
    if (!entry) return
    // 3xx 中间跳：保留 entry 继续跟踪最终响应（page 侧只感知最后一次），
    // URL 更新为跳转目标，避免中间态 entry 永久悬挂
    entry.url = details.redirectUrl ?? details.url
    entry.status = details.statusCode
    entry.responseHeaders = (details.responseHeaders ?? []) as RequestHeader[]
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
)

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    const entry = byWrId.get(details.requestId)
    if (!entry) return
    // 带错误标记落盘，保留已捕获的 body，而不是直接丢弃
    entry.error = details.error ?? "unknown error"
    entry.webRequestDone = true
    maybeFlush(entry)
  },
  { urls: ["<all_urls>"] }
)

// ─── 消息处理 ────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  // 消除竞态：SW 刚唤醒时 listener 可能先于 init() 触发，此时 recordingState/filterConfig
  // 尚未恢复。等待 readyPromise 完成后再处理，避免合法请求被"未录制"误判丢弃。
  ;(readyPromise ?? Promise.resolve())
    .then(() => handleMessage(message, sender))
    .then((result) => sendResponse(result ?? { ok: true }))
    .catch((e) => {
      // 任何异常都必须回调 sendResponse，否则调用方永远挂起
      console.error("[rr] 处理消息失败", message?.type, e)
      sendResponse({ ok: false, error: String(e) })
    })
  return true // 保持异步响应通道
})

/** 返回 true 表示该消息已处理（含过滤后忽略的情况） */
async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    case "GET_STATE": {
      const response: GetStateResponse = {
        state: { ...recordingState },
        filter: { ...filterConfig }
      }
      return response
    }

    case "START_RECORDING": {
      // 若上一段录制未正常结束（连点等），先补写 endTime 再开新会话
      if (recordingState.isRecording && recordingState.currentSessionId) {
        await updateSession(recordingState.currentSessionId, { endTime: Date.now() })
      }
      const sessionId = generateId()
      const now = Date.now()
      const pageUrl = message.pageUrl ?? ""
      let sessionName = formatTime(now)
      try {
        if (pageUrl) {
          const hostname = new URL(pageUrl).hostname
          if (hostname) sessionName = hostname
        }
      } catch {
        // URL 解析失败则保留时间作为名称
      }
      recordingState = {
        isRecording: true,
        currentSessionId: sessionId,
        capturedCount: 0
      }
      await addSession({
        id: sessionId,
        name: sessionName,
        pageUrl,
        startTime: now,
        endTime: null,
        requestIds: [],
        filter: { ...filterConfig }
      })
      await persistState()
      broadcastStateChanged()
      return { ok: true }
    }

    case "STOP_RECORDING": {
      if (recordingState.currentSessionId) {
        await updateSession(recordingState.currentSessionId, {
          endTime: Date.now()
        })
      }
      recordingState = { ...DEFAULT_RECORDING_STATE }
      await persistState()
      broadcastStateChanged()
      // 停止时把缓冲区里未同步的 requestIds 落盘
      await syncSessionRequestIds()
      return { ok: true }
    }

    case "OPEN_HISTORY": {
      const historyUrl = chrome.runtime.getURL("tabs/history.html")
      chrome.tabs.create({ url: historyUrl })
      return { ok: true }
    }

    case "UPDATE_FILTER": {
      filterConfig = message.filter
      await saveFilterConfig(filterConfig)
      // 推送给各 tab 的 injector → page-patcher，类型未勾选时 page 侧跳过 body 读取
      broadcastToAllTabs({ type: "FILTER_CHANGED", filter: { ...filterConfig } })
      return { ok: true }
    }

    case "REQUEST_BODY_CAPTURED": {
      const realTabId = sender.tab?.id ?? message.tabId
      const { requestId, url, method, requestBody, triggerInfo, kind } = message
      const pageType: RequestType = kind === "fetch" ? "fetch" : "xhr"

      // 与 webRequest 侧 entry 按 FIFO 配对（webRequest 建 entry 时已通过宽松准入，需复核）
      let entry = findInQueue(realTabId, url, method, (e) => e.pageRequestId === null)
      if (entry) {
        // 已有 webRequest entry：用 page 侧精确类型修正；若当前过滤器不接受该类型，
        // 标记为不再等 page body，flush 时由 finalAllowed 丢弃，避免悬挂
        entry.type = pageType
        if (!filterConfig.types.includes(pageType)) {
          entry.expectPageBody = false
        }
      } else {
        // 没有可配对的 webRequest entry：新建决策点检查录制状态与过滤器
        if (!recordingState.isRecording || !recordingState.currentSessionId) {
          return { ok: false }
        }
        if (!filterConfig.types.includes(pageType) || !urlAllowed(url)) return { ok: true }
        entry = createEntry({
          tabId: realTabId,
          url,
          method,
          type: pageType,
          timestamp: Date.now()
        })
      }
      entry.pageRequestId = requestId
      byPageId.set(requestId, entry)
      // page 侧响应事件（至少含元数据）总会到达，可以放心等待
      entry.expectPageBody = true
      if (requestBody != null) entry.requestBody = requestBody
      if (triggerInfo) entry.triggerInfo = triggerInfo
      return { ok: true }
    }

    case "RESPONSE_BODY_CAPTURED": {
      const realTabId = sender.tab?.id ?? message.tabId
      const { requestId, url, method, status, responseBody, duration, kind } = message

      // 同一请求的 request/response 事件共享 pageRequestId，可精确匹配
      let entry = byPageId.get(requestId)
      if (!entry) {
        // 请求事件丢失（如 SW 重启清了索引）时按 FIFO 兜底配对
        entry = findInQueue(
          realTabId,
          url,
          method,
          (e) => !e.pageDone && e.pageRequestId === null
        )
        if (entry) {
          entry.pageRequestId = requestId
          byPageId.set(requestId, entry)
          entry.type = kind === "fetch" ? "fetch" : "xhr"
          entry.expectPageBody = true
        }
      }
      // 没有对应请求（未录制 / 已 flush / 已被过滤丢弃），直接忽略
      if (!entry) return { ok: true }

      if (responseBody != null) entry.responseBody = responseBody
      entry.status = entry.status ?? status
      entry.duration = duration
      entry.pageDone = true
      maybeFlush(entry)
      return { ok: true }
    }

    default:
      return { ok: false }
  }
}
