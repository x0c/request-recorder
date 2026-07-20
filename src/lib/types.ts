export type RequestType =
  | "xhr"
  | "fetch"
  | "script"
  | "stylesheet"
  | "image"
  | "other"

export interface RequestHeader {
  name: string
  value: string | undefined
}

export interface FilterConfig {
  types: RequestType[]
  urlKeyword: string
}

export const DEFAULT_FILTER: FilterConfig = {
  types: ["xhr", "fetch"],
  urlKeyword: ""
}

export interface TriggerInfo {
  /** 自然语言描述，如"层级体系设置下的层级设置中的升级开关" */
  description: string
  /** 点击元素自身的标签文字 */
  targetLabel: string
  /** 触发方式 */
  via: "click" | "keyboard"
  /** 点击时间戳 */
  timestamp: number
}

export interface RecordedRequest {
  id: string
  sessionId: string
  timestamp: number
  url: string
  method: string
  type: RequestType
  requestHeaders: RequestHeader[]
  requestBody: string | null
  status: number | null
  responseHeaders: RequestHeader[]
  responseBody: string | null
  duration: number | null
  /** 触发该请求的 DOM 元素溯源信息（用户主动交互触发时存在） */
  triggerInfo?: TriggerInfo
  /** 请求失败时的错误信息（如 net::ERR_ABORTED），成功请求无此字段 */
  error?: string
}

export interface RecordingSession {
  id: string
  name: string
  pageUrl?: string
  startTime: number
  endTime: number | null
  requestIds: string[]
  filter: FilterConfig
}

export interface RecordingState {
  isRecording: boolean
  currentSessionId: string | null
  capturedCount: number
}

export const DEFAULT_RECORDING_STATE: RecordingState = {
  isRecording: false,
  currentSessionId: null,
  capturedCount: 0
}
