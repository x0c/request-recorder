import type { RequestHeader } from "./types"

export type HeaderGroupKey = "auth" | "content" | "cors" | "custom"

export const HEADER_GROUP_LABELS: Record<HeaderGroupKey, string> = {
  auth: "认证类",
  content: "内容类",
  cors: "跨域类",
  custom: "自定义类"
}

/** 认证类默认不勾选，防止意外泄漏 Cookie / Token */
export const HEADER_GROUP_DEFAULTS: Record<HeaderGroupKey, boolean> = {
  auth: false,
  content: true,
  cors: true,
  custom: true
}

const AUTH_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-auth-token",
  "x-api-key",
  "x-access-token",
  "x-csrf-token",
  "proxy-authorization"
])

const CONTENT_HEADERS = new Set([
  "content-type",
  "content-length",
  "content-encoding",
  "content-language",
  "content-disposition",
  "accept",
  "accept-encoding",
  "accept-language",
  "accept-charset",
  "transfer-encoding"
])

const CORS_HEADERS = new Set([
  "origin",
  "referer",
  "x-requested-with",
  "access-control-request-method",
  "access-control-request-headers"
])

function classify(name: string): HeaderGroupKey {
  const lower = name.toLowerCase()
  if (AUTH_HEADERS.has(lower)) return "auth"
  if (CONTENT_HEADERS.has(lower)) return "content"
  if (CORS_HEADERS.has(lower)) return "cors"
  return "custom"
}

/** 将实际 header 列表按组分类 */
export function classifyHeaders(
  headers: RequestHeader[]
): Record<HeaderGroupKey, RequestHeader[]> {
  const result: Record<HeaderGroupKey, RequestHeader[]> = {
    auth: [],
    content: [],
    cors: [],
    custom: []
  }
  for (const h of headers) {
    result[classify(h.name)].push(h)
  }
  return result
}
