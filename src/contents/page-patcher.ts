import type { PlasmoCSConfig } from "plasmo"

// 运行在页面真实 JS 上下文（MAIN world），可访问页面自己的 XHR 和 fetch
// 不能使用任何 chrome.* API，只能通过 window.postMessage 通信
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start",
  world: "MAIN"
}

const SOURCE = "rr-page"

/** 响应体最大读取字符数，超出截断 */
const MAX_RESPONSE_CHARS = 512 * 1024
/** 请求体最大读取字符数，超出截断 */
const MAX_REQUEST_CHARS = 256 * 1024
/** 值得读取全文的文本类 content-type */
const TEXTUAL_CT =
  /json|text\/|xml|javascript|ecmascript|html|x-www-form-urlencoded|csv|graphql|problem\+/i

// ─── 录制配置（由 injector 通过 postMessage 推送，未录制时完全旁路 body 读取）───

let rrConfig = { isRecording: false, recordXhr: false, recordFetch: false }

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.source !== "rr-bg") return
  if (event.data.event === "config") {
    rrConfig = {
      isRecording: !!event.data.isRecording,
      recordXhr: !!event.data.recordXhr,
      recordFetch: !!event.data.recordFetch
    }
  }
})

// 握手：通知 injector 我已就绪，请求推送当前配置
window.postMessage({ source: SOURCE, event: "ready" }, "*")

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // 降级方案
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ─── DOM 触发溯源 ─────────────────────────────────────────────────────────────

interface TriggerSnapshot {
  description: string
  targetLabel: string
  via: "click" | "keyboard"
  timestamp: number
}

/** 最近一次用户交互快照，1000ms 内的请求会关联到它 */
let lastTrigger: TriggerSnapshot | null = null
let triggerTimer: ReturnType<typeof setTimeout> | null = null
const TRIGGER_TTL = 1000

/** 从元素自身提取最有意义的短标签（目标元素用） */
function getTargetLabel(el: Element): string {
  // aria-label 优先
  const ariaLabel = el.getAttribute("aria-label")?.trim()
  if (ariaLabel) return truncate(ariaLabel, 30)

  // title 属性
  const title = el.getAttribute("title")?.trim()
  if (title) return truncate(title, 30)

  // input / textarea 用 placeholder 或 value
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    const ph = (el as HTMLInputElement).placeholder?.trim()
    if (ph) return truncate(ph, 30)
    const val = (el as HTMLInputElement).value?.trim()
    if (val) return truncate(val, 20)
  }

  // 自身直接文字（剔除子元素文字干扰）
  const ownText = getDirectText(el)
  if (ownText) return truncate(ownText, 30)

  // 兜底：全量 textContent
  const full = el.textContent?.trim().replace(/\s+/g, " ") ?? ""
  if (full) return truncate(full, 30)

  // 最终降级：标签名
  return el.tagName.toLowerCase()
}

/** 只取元素自身的直接文本节点，不含子元素文字 */
function getDirectText(el: Element): string {
  let text = ""
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ""
    }
  }
  return text.trim().replace(/\s+/g, " ")
}

/** 从容器元素提取最有意义的标签（用于路径描述） */
function getContainerLabel(el: Element): string | null {
  // aria-label
  const ariaLabel = el.getAttribute("aria-label")?.trim()
  if (ariaLabel) return truncate(ariaLabel, 25)

  // aria-labelledby 指向的元素
  const labelledBy = el.getAttribute("aria-labelledby")?.trim()
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy)
    const text = labelEl?.textContent?.trim().replace(/\s+/g, " ")
    if (text) return truncate(text, 25)
  }

  // 直接子标题元素（h1-h6 或 role=heading），只找第一层
  for (const child of el.children) {
    const tag = child.tagName.toLowerCase()
    const role = child.getAttribute("role")
    if (/^h[1-6]$/.test(tag) || role === "heading") {
      const headingText = child.textContent?.trim().replace(/\s+/g, " ")
      if (headingText) return truncate(headingText, 25)
    }
  }

  // title / data-title
  const title = (el.getAttribute("title") || el.getAttribute("data-title"))?.trim()
  if (title) return truncate(title, 25)

  return null
}

/** 判断元素是否构成语义容器边界 */
function isSemanticContainer(el: Element): boolean {
  const tag = el.tagName.toLowerCase()

  // HTML5 语义标签
  if (["dialog", "section", "article", "aside", "nav", "main", "form", "fieldset"].includes(tag)) {
    return true
  }

  // ARIA role
  const role = el.getAttribute("role")
  if (role && ["dialog", "tabpanel", "region", "main", "navigation", "form", "group", "alertdialog"].includes(role)) {
    return true
  }

  // 常见 UI 框架的容器 class 关键词
  const className = typeof el.className === "string" ? el.className : ""
  if (/modal|panel|drawer|sidebar|card|dialog|popup|overlay|tab-pane|tab-content|collapse|accordion|sheet/i.test(className)) {
    return true
  }

  // 有直接子标题元素，说明是一个有标题的区块
  for (const child of el.children) {
    const childTag = child.tagName.toLowerCase()
    const childRole = child.getAttribute("role")
    if (/^h[1-6]$/.test(childTag) || childRole === "heading") {
      return true
    }
  }

  return false
}

/** 向上遍历 DOM，收集最多 maxDepth 层有意义标签的语义容器 */
function collectAncestorLabels(target: Element, maxDepth = 3): string[] {
  const labels: string[] = []
  let current = target.parentElement

  while (current && current !== document.body && current !== document.documentElement) {
    if (isSemanticContainer(current)) {
      const label = getContainerLabel(current)
      if (label) {
        labels.unshift(label) // 前插保持从外到内的顺序
        if (labels.length >= maxDepth) break
      }
    }
    current = current.parentElement
  }

  return labels
}

/** 组合路径描述，用 " - " 连接各层级 */
function buildDescription(ancestorLabels: string[], targetLabel: string): string {
  return [...ancestorLabels, targetLabel].join(" - ")
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str
}

/** 记录一次用户交互，重置 TTL 定时器 */
function recordTrigger(el: Element, via: "click" | "keyboard"): void {
  if (triggerTimer !== null) clearTimeout(triggerTimer)

  const targetLabel = getTargetLabel(el)
  const ancestorLabels = collectAncestorLabels(el)
  const description = buildDescription(ancestorLabels, targetLabel)

  lastTrigger = { description, targetLabel, via, timestamp: Date.now() }

  triggerTimer = setTimeout(() => {
    lastTrigger = null
    triggerTimer = null
  }, TRIGGER_TTL)
}

// 监听点击（capture 阶段，早于业务代码）
document.addEventListener(
  "click",
  (e) => {
    if (e.target instanceof Element) recordTrigger(e.target, "click")
  },
  true
)

// 监听键盘 Enter / Space 触发（capture 阶段）
document.addEventListener(
  "keydown",
  (e) => {
    if ((e.key === "Enter" || e.key === " ") && document.activeElement instanceof Element) {
      recordTrigger(document.activeElement, "keyboard")
    }
  },
  true
)

// ─── body 读取工具 ─────────────────────────────────────────────────────────────

function truncateBody(text: string, max: number): string {
  return text.length > max
    ? text.slice(0, max) + `\n… [truncated: 原文共 ${text.length} 字符]`
    : text
}

/** 将各种形态的请求体规范为可读的字符串 */
function normalizeRequestBody(body: unknown): string | null {
  if (body == null) return null
  try {
    if (typeof body === "string") return truncateBody(body, MAX_REQUEST_CHARS)
    if (body instanceof URLSearchParams) return truncateBody(body.toString(), MAX_REQUEST_CHARS)
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      return "[form-data: 多部分表单未序列化]"
    }
    if (typeof Blob !== "undefined" && body instanceof Blob) {
      return `[binary: Blob ${body.size} bytes]`
    }
    if (body instanceof ArrayBuffer) return `[binary: ArrayBuffer ${body.byteLength} bytes]`
    if (ArrayBuffer.isView(body)) return `[binary: ${body.constructor.name} ${body.byteLength} bytes]`
    if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) return "[stream]"
    return truncateBody(String(body), MAX_REQUEST_CHARS)
  } catch (_) {
    return null
  }
}

/**
 * 限量读取 fetch 响应体：
 * - SSE / 大文件 / 二进制直接跳过（避免无限挂起或撑爆内存）
 * - 文本类用 reader 限量读取，超过上限即取消
 */
async function readResponseBody(response: Response): Promise<string | null> {
  try {
    const ct = (response.headers.get("content-type") ?? "").toLowerCase()
    // 流式响应永不结束，直接跳过
    if (ct.includes("text/event-stream")) return "[skipped: event-stream 流式响应]"
    const len = Number(response.headers.get("content-length") ?? "")
    if (Number.isFinite(len) && len > MAX_RESPONSE_CHARS) {
      return `[skipped: 响应体 ${len} bytes 超过 ${MAX_RESPONSE_CHARS} 上限]`
    }
    // 明确的二进制类型不读
    if (ct && !TEXTUAL_CT.test(ct)) {
      return `[skipped: 非文本响应 (${ct.split(";")[0]})]`
    }

    const clone = response.clone()
    if (clone.body && typeof clone.body.getReader === "function") {
      const reader = clone.body.getReader()
      const chunks: Uint8Array[] = []
      let received = 0
      let truncated = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.byteLength
          if (received > MAX_RESPONSE_CHARS) {
            truncated = true
            break
          }
        }
      }
      try {
        await reader.cancel()
      } catch (_) {}
      const merged = new Uint8Array(received)
      let offset = 0
      for (const c of chunks) {
        merged.set(c, offset)
        offset += c.byteLength
      }
      let text = new TextDecoder().decode(merged)
      if (truncated) text += `\n… [truncated: 已读取 ${received} bytes 后放弃]`
      return text
    }
    // 无 body stream 的降级路径
    const text = await clone.text()
    return truncateBody(text, MAX_RESPONSE_CHARS)
  } catch (_) {
    return null
  }
}

// ─── Patch XMLHttpRequest ────────────────────────────────────────────────────

const OrigXHR = window.XMLHttpRequest

function PatchedXHR(this: XMLHttpRequest) {
  const xhr = new OrigXHR()
  const requestId = uid()
  let method = "GET"
  let url = ""
  let startTime = 0

  const origOpen = xhr.open.bind(xhr)
  ;(xhr as any).open = function (m: string, u: string) {
    method = m
    // 将相对 URL 转为绝对 URL，与 chrome.webRequest 的 details.url 保持一致
    try {
      url = new URL(u, location.href).href
    } catch (_) {
      url = u
    }
    return origOpen.apply(xhr, arguments as any)
  }

  const origSend = xhr.send.bind(xhr)
  ;(xhr as any).send = function (body: any) {
    startTime = Date.now()
    // 未录制时零开销直通；录制中即使 xhr 未勾选也发请求事件（不含 body），
    // 供 background 按 page 侧精确类型修正后再过滤
    if (rrConfig.isRecording) {
      const requestBody = rrConfig.recordXhr ? normalizeRequestBody(body) : null
      const triggerInfo = lastTrigger ? { ...lastTrigger } : null
      window.postMessage(
        { source: SOURCE, event: "request", requestId, url, method, requestBody, kind: "xhr", triggerInfo },
        "*"
      )
    }
    return origSend.apply(xhr, arguments as any)
  }

  xhr.addEventListener("loadend", () => {
    if (!rrConfig.isRecording) return
    const duration = Date.now() - startTime
    let responseBody: string | null = null
    // 仅当 xhr 勾选时才读响应体；未勾选只发元数据，避免无意义的 responseText 读取
    if (rrConfig.recordXhr) {
      try {
        // 只有文本类 responseType 才能安全读 responseText
        if (xhr.responseType === "" || xhr.responseType === "text" || xhr.responseType === "json") {
          responseBody = truncateBody(xhr.responseText ?? "", MAX_RESPONSE_CHARS)
        } else {
          responseBody = `[skipped: responseType=${xhr.responseType}]`
        }
      } catch (_) {}
    }
    window.postMessage(
      {
        source: SOURCE,
        event: "response",
        requestId,
        url,
        method,
        status: xhr.status,
        responseBody,
        duration,
        kind: "xhr"
      },
      "*"
    )
  })

  return xhr
}

PatchedXHR.prototype = OrigXHR.prototype
// 继承静态常量（UNSENT/OPENED/HEADERS_RECEIVED/LOADING/DONE），否则使用这些常量的库会拿到 undefined
Object.setPrototypeOf(PatchedXHR, OrigXHR)
Object.defineProperty(PatchedXHR, "name", { value: "XMLHttpRequest" })
;(window as any).XMLHttpRequest = PatchedXHR

// ─── Patch fetch ─────────────────────────────────────────────────────────────

const origFetch = window.fetch.bind(window)

/** 读取请求体：优先 init.body，其次 Request 对象的 body（需克隆后异步读取） */
async function readFetchRequestBody(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<string | null> {
  try {
    if (init?.body != null) return normalizeRequestBody(init.body)
    if (typeof Request !== "undefined" && input instanceof Request) {
      const method = (init?.method ?? input.method ?? "GET").toUpperCase()
      if (method === "GET" || method === "HEAD") return null
      const text = await input.clone().text()
      return truncateBody(text, MAX_REQUEST_CHARS)
    }
  } catch (_) {}
  return null
}

async function patchedFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  captureBody: boolean
): Promise<Response> {
  const requestId = uid()
  const startTime = Date.now()
  let url = ""
  let method = "GET"
  let requestBody: string | null = null

  try {
    if (typeof input === "string") {
      url = new URL(input, location.href).href
    } else if (input instanceof Request) {
      url = input.url // Request.url 已是绝对路径
      method = input.method ?? "GET"
    } else {
      url = new URL(String(input), location.href).href
    }
    if (init?.method) method = init.method.toUpperCase()
    if (captureBody) requestBody = await readFetchRequestBody(input, init)
  } catch (_) {}

  window.postMessage(
    {
      source: SOURCE,
      event: "request",
      requestId,
      url,
      method,
      requestBody,
      kind: "fetch",
      triggerInfo: lastTrigger ? { ...lastTrigger } : null
    },
    "*"
  )

  let response: Response
  try {
    response = await origFetch(input, init)
  } catch (err) {
    // 网络层失败（无响应对象），上报 status=0 便于与成功请求配对
    window.postMessage(
      {
        source: SOURCE,
        event: "response",
        requestId,
        url,
        method,
        status: 0,
        responseBody: null,
        duration: Date.now() - startTime,
        kind: "fetch"
      },
      "*"
    )
    throw err
  }

  const duration = Date.now() - startTime
  const status = response.status
  // fetch 未勾选时只上报元数据（status/duration），不读响应体
  const bodyPromise = captureBody ? readResponseBody(response) : Promise.resolve(null)
  bodyPromise
    .then((body) => {
      window.postMessage(
        {
          source: SOURCE,
          event: "response",
          requestId,
          url,
          method,
          status,
          responseBody: body,
          duration,
          kind: "fetch"
        },
        "*"
      )
    })
    .catch(() => {
      window.postMessage(
        {
          source: SOURCE,
          event: "response",
          requestId,
          url,
          method,
          status,
          responseBody: null,
          duration,
          kind: "fetch"
        },
        "*"
      )
    })
  return response
}

;(window as any).fetch = function (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // 未录制时零开销直通，不包装、不克隆、不读 body；
  // fetch 未勾选时仍包装（仅上报元数据供 background 修正类型），但不读 body
  if (!rrConfig.isRecording) {
    return origFetch(input, init)
  }
  return patchedFetch(input, init, rrConfig.recordFetch)
}
