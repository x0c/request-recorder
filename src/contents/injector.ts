import type { PlasmoCSConfig } from "plasmo"

import type {
  BackgroundEvent,
  GetStateResponse,
  PageConfigEvent
} from "~lib/messages"

// 运行在 isolated world，职责：
// 1. 将 page-patcher 的 postMessage 转发给 background（chrome.runtime.sendMessage 在此上下文可用）
// 2. 将录制配置（是否录制中、xhr/fetch 是否勾选）推送给 page-patcher，
//    使其在未录制时完全跳过响应体克隆，避免无意义的内存拷贝
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

// ─── page → background ───────────────────────────────────────────────────────

function safeSendMessage(message: object) {
  // 扩展被重载或禁用时，chrome.runtime.id 会变为 undefined，此时发消息会抛出 "Extension context invalidated"
  if (!chrome.runtime?.id) return
  try {
    chrome.runtime.sendMessage(message)
  } catch (e: unknown) {
    // 忽略扩展上下文已失效的错误（竞态情况下 id 存在但上下文已失效）
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes("Extension context invalidated")) {
      throw e
    }
  }
}

window.addEventListener("message", (event) => {
  if (
    event.source !== window ||
    !event.data ||
    event.data.source !== "rr-page"
  )
    return

  const data = event.data

  if (data.event === "request") {
    safeSendMessage({
      type: "REQUEST_BODY_CAPTURED",
      tabId: -1,
      requestId: data.requestId,
      url: data.url,
      method: data.method,
      requestBody: data.requestBody ?? null,
      kind: data.kind ?? "xhr",
      triggerInfo: data.triggerInfo ?? null
    })
  } else if (data.event === "response") {
    safeSendMessage({
      type: "RESPONSE_BODY_CAPTURED",
      tabId: -1,
      requestId: data.requestId,
      url: data.url,
      method: data.method,
      status: data.status,
      responseBody: data.responseBody ?? null,
      duration: data.duration,
      kind: data.kind ?? "xhr"
    })
  } else if (data.event === "ready") {
    // page-patcher 加载完成，推送当前配置
    refreshConfig()
  }
})

// ─── background → page：录制配置推送 ─────────────────────────────────────────

let lastConfig: PageConfigEvent = {
  source: "rr-bg",
  event: "config",
  isRecording: false,
  recordXhr: false,
  recordFetch: false
}

function pushConfig(): void {
  window.postMessage({ ...lastConfig }, "*")
}

/** 从 background 拉取最新状态与过滤器，推导 page 侧所需的最小配置 */
function refreshConfig(): void {
  if (!chrome.runtime?.id) return
  try {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (res: GetStateResponse) => {
      if (chrome.runtime.lastError || !res?.state || !res?.filter) return
      lastConfig = {
        source: "rr-bg",
        event: "config",
        isRecording: res.state.isRecording,
        recordXhr: res.filter.types.includes("xhr"),
        recordFetch: res.filter.types.includes("fetch")
      }
      pushConfig()
    })
  } catch {
    // 扩展上下文已失效，忽略
  }
}

// 监听 background 广播的录制状态 / 过滤器变更，实时同步给 page-patcher
try {
  chrome.runtime.onMessage.addListener((message: BackgroundEvent) => {
    if (message.type === "STATE_CHANGED") {
      lastConfig = { ...lastConfig, isRecording: message.state.isRecording }
      pushConfig()
    } else if (message.type === "FILTER_CHANGED") {
      lastConfig = {
        ...lastConfig,
        recordXhr: message.filter.types.includes("xhr"),
        recordFetch: message.filter.types.includes("fetch")
      }
      pushConfig()
    }
  })
} catch {
  // 扩展上下文已失效，忽略
}

// content script 加载时主动同步一次（覆盖 page-patcher 先于 ready 消息发出请求的场景）
refreshConfig()
