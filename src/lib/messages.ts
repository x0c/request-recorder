import type { FilterConfig, RecordingState, TriggerInfo } from "./types"

// ─── Page Script → Content Script（window.postMessage）──────────────────────

/** page-patcher 上报的请求事件，kind 用于区分真实来源（webRequest 侧无法区分 xhr/fetch） */
export interface PageScriptRequestEvent {
  source: "rr-page"
  event: "request"
  requestId: string
  url: string
  method: string
  requestBody: string | null
  kind: "xhr" | "fetch"
  triggerInfo: TriggerInfo | null
}

export interface PageScriptResponseEvent {
  source: "rr-page"
  event: "response"
  requestId: string
  url: string
  method: string
  status: number
  responseBody: string | null
  duration: number
  kind: "xhr" | "fetch"
}

/** page-patcher 加载完成后的握手事件，injector 收到后推送当前录制配置 */
export interface PageScriptReadyEvent {
  source: "rr-page"
  event: "ready"
}

export type PageScriptEvent =
  | PageScriptRequestEvent
  | PageScriptResponseEvent
  | PageScriptReadyEvent

// ─── Content Script → Page Script（window.postMessage）──────────────────────

/** injector 推送给 page-patcher 的录制配置，未录制时 page 侧不再克隆响应体 */
export interface PageConfigEvent {
  source: "rr-bg"
  event: "config"
  isRecording: boolean
  recordXhr: boolean
  recordFetch: boolean
}

// ─── 标注域：Annotator (isolated) -> page-patcher (MAIN) 源码定位 RPC ─────────

/** 请求定位元素的源码位置，path 为 documentElement 起的 childIndex 链 */
export interface LocateSourceRequest {
  source: "rr-annotate"
  event: "locateSource"
  requestId: string
  path: number[]
}

/** page-patcher 返回的源码定位结果（React dev 模式才有值） */
export interface SourceLocatedEvent {
  source: "rr-page"
  event: "sourceLocated"
  requestId: string
  info: { fileName: string; lineNumber: number; componentName: string | null } | null
}

// ─── Content Script / Popup → Background（chrome.runtime.sendMessage）───────

export type ExtensionMessage =
  | { type: "START_RECORDING"; pageUrl?: string }
  | { type: "STOP_RECORDING" }
  | { type: "GET_STATE" }
  | { type: "OPEN_HISTORY" }
  | { type: "UPDATE_FILTER"; filter: FilterConfig }
  | {
      type: "REQUEST_BODY_CAPTURED"
      tabId: number
      requestId: string
      url: string
      method: string
      requestBody: string | null
      kind: "xhr" | "fetch"
      triggerInfo: TriggerInfo | null
    }
  | {
      type: "RESPONSE_BODY_CAPTURED"
      tabId: number
      requestId: string
      url: string
      method: string
      status: number
      responseBody: string | null
      duration: number
      kind: "xhr" | "fetch"
    }
  | { type: "TOGGLE_ANNOTATE" }

// ─── Background → Popup / Content Script（广播）─────────────────────────────

export type BackgroundEvent =
  | { type: "STATE_CHANGED"; state: RecordingState }
  | { type: "REQUEST_CAPTURED"; count: number }
  | { type: "FILTER_CHANGED"; filter: FilterConfig }

// ─── Background sendMessage 响应体──────────────────────────────────────────

export interface GetStateResponse {
  state: RecordingState
  filter: FilterConfig
}
