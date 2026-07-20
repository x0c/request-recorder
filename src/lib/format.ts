import { classifyHeaders, type HeaderGroupKey } from "./headerGroups"
import type { RecordedRequest, RequestHeader } from "./types"

export type FormatType = "curl" | "fetch" | "axios" | "http-raw" | "json" | "har" | "postman" | "mitmproxy"

/** 原生支持请求+响应结构的格式，"包含响应体"文案不需要括号说明 */
export const NATIVE_RESPONSE_FORMATS = new Set<FormatType>(["har", "postman", "mitmproxy", "json"])

export interface FormatOptions {
  format: FormatType
  /** 允许输出的请求 header name（小写） */
  includedHeaderNames: Set<string>
  includeResponse: boolean
  /** 允许输出的响应 header name（小写），仅 includeResponse=true 时生效 */
  includedResponseHeaderNames: Set<string>
}

/** 根据组级勾选状态 + 实际 headers，计算最终允许输出的 header name 集合 */
export function resolveIncludedHeaders(
  headers: RequestHeader[],
  groupChecks: Record<HeaderGroupKey, boolean>
): Set<string> {
  const grouped = classifyHeaders(headers)
  const included = new Set<string>()
  for (const [group, checked] of Object.entries(groupChecks) as [HeaderGroupKey, boolean][]) {
    if (checked) {
      for (const h of grouped[group]) {
        included.add(h.name.toLowerCase())
      }
    }
  }
  return included
}

function filterHeaders(
  headers: RequestHeader[],
  includedHeaderNames: Set<string>
): RequestHeader[] {
  return headers.filter((h) => includedHeaderNames.has(h.name.toLowerCase()))
}

// ─── curl ────────────────────────────────────────────────────────────────────

function toCurlFormat(req: RecordedRequest, opts: FormatOptions): string {
  const filtered = filterHeaders(req.requestHeaders, opts.includedHeaderNames)
  const parts: string[] = [`curl -X ${req.method}`]

  for (const h of filtered) {
    const val = (h.value ?? "").replace(/'/g, "'\\''")
    parts.push(`  -H '${h.name}: ${val}'`)
  }

  if (req.requestBody) {
    const body = req.requestBody.replace(/'/g, "'\\''")
    parts.push(`  -d '${body}'`)
  }

  parts.push(`  '${req.url}'`)

  let result = parts.join(" \\\n")

  if (opts.includeResponse && req.responseBody != null) {
    const status = req.status ?? "?"
    const resHeaders = filterHeaders(req.responseHeaders, opts.includedResponseHeaderNames)
    const resHeaderLines = resHeaders.map((h) => `# ${h.name}: ${h.value ?? ""}`).join("\n")
    const bodyLines = req.responseBody
      .split("\n")
      .map((l) => `# ${l}`)
      .join("\n")
    result += `\n# Response (${status}):`
    if (resHeaderLines) result += `\n${resHeaderLines}`
    result += `\n#\n${bodyLines}`
  }

  return result
}

// ─── fetch ───────────────────────────────────────────────────────────────────

function toFetchFormat(req: RecordedRequest, opts: FormatOptions): string {
  const filtered = filterHeaders(req.requestHeaders, opts.includedHeaderNames)

  const headersObj =
    filtered.length > 0
      ? "{\n" +
        filtered
          .map((h) => `    "${h.name}": ${JSON.stringify(h.value ?? "")}`)
          .join(",\n") +
        "\n  }"
      : "{}"

  const hasBody = !!req.requestBody && req.method !== "GET" && req.method !== "HEAD"
  const bodyLine = hasBody ? `,\n  body: ${JSON.stringify(req.requestBody)}` : ""

  let result =
    `await fetch(${JSON.stringify(req.url)}, {\n` +
    `  method: "${req.method}",\n` +
    `  headers: ${headersObj}` +
    bodyLine +
    `\n})`

  if (opts.includeResponse && req.responseBody != null) {
    const status = req.status ?? "?"
    const resHeaders = filterHeaders(req.responseHeaders, opts.includedResponseHeaderNames)
    const resHeaderStr =
      resHeaders.length > 0
        ? "\n" + resHeaders.map((h) => `   ${h.name}: ${h.value ?? ""}`).join("\n")
        : ""
    result += `\n/* Response (${status}):${resHeaderStr}\n\n${req.responseBody}\n*/`
  }

  return result
}

// ─── axios ───────────────────────────────────────────────────────────────────

function toAxiosFormat(req: RecordedRequest, opts: FormatOptions): string {
  const filtered = filterHeaders(req.requestHeaders, opts.includedHeaderNames)

  const headersObj =
    filtered.length > 0
      ? "{\n" +
        filtered
          .map((h) => `    "${h.name}": ${JSON.stringify(h.value ?? "")}`)
          .join(",\n") +
        "\n  }"
      : "{}"

  const hasBody = !!req.requestBody && req.method !== "GET" && req.method !== "HEAD"

  const lines: string[] = [
    `await axios.request({`,
    `  method: "${req.method.toLowerCase()}",`,
    `  url: ${JSON.stringify(req.url)},`,
    `  headers: ${headersObj}`
  ]

  if (hasBody) {
    lines.push(`  data: ${JSON.stringify(req.requestBody)}`)
  }

  lines.push(`})`)

  let result = lines.join("\n")

  if (opts.includeResponse && req.responseBody != null) {
    const status = req.status ?? "?"
    result += `\n/* Response (${status}):\n${req.responseBody}\n*/`
  }

  return result
}

// ─── HTTP Raw ────────────────────────────────────────────────────────────────

function toHttpRawFormat(req: RecordedRequest, opts: FormatOptions): string {
  const filtered = filterHeaders(req.requestHeaders, opts.includedHeaderNames)

  let url: URL
  try {
    url = new URL(req.url)
  } catch {
    url = { pathname: req.url, search: "", host: "" } as URL
  }

  const path = url.pathname + url.search || "/"
  const host = url.host

  const headerLines = filtered
    .map((h) => `${h.name}: ${h.value ?? ""}`)
    .join("\n")

  const hostLine = host ? `Host: ${host}\n` : ""

  let result =
    `${req.method} ${path} HTTP/1.1\n` +
    hostLine +
    (headerLines ? headerLines + "\n" : "") +
    "\n" +
    (req.requestBody ?? "")

  if (opts.includeResponse && req.responseBody != null) {
    const status = req.status ?? "?"
    result += `\n\n--- Response (${status}) ---\n${req.responseBody}`
  }

  return result.trimEnd()
}

// ─── JSON ────────────────────────────────────────────────────────────────────

function toJsonFormat(req: RecordedRequest, opts: FormatOptions): string {
  const filtered = filterHeaders(req.requestHeaders, opts.includedHeaderNames)

  const obj: Record<string, unknown> = {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(filtered.map((h) => [h.name, h.value ?? ""])),
    body: req.requestBody ?? null
  }

  if (opts.includeResponse) {
    const filteredResHeaders = filterHeaders(req.responseHeaders, opts.includedResponseHeaderNames)
    obj.response = {
      status: req.status ?? null,
      headers: Object.fromEntries(
        filteredResHeaders.map((h) => [h.name, h.value ?? ""])
      ),
      body: req.responseBody ?? null
    }
  }

  return JSON.stringify(obj, null, 2)
}

// ─── HAR ─────────────────────────────────────────────────────────────────────

function toHarFormat(req: RecordedRequest, opts: FormatOptions): string {
  const filteredReqHeaders = filterHeaders(req.requestHeaders, opts.includedHeaderNames)

  let parsedUrl: URL
  try {
    parsedUrl = new URL(req.url)
  } catch {
    parsedUrl = { href: req.url, hostname: "", port: "", pathname: req.url, search: "" } as URL
  }

  const queryString: { name: string; value: string }[] = []
  parsedUrl.searchParams.forEach((value, name) => {
    queryString.push({ name, value })
  })

  const harReq: Record<string, unknown> = {
    method: req.method,
    url: req.url,
    httpVersion: "HTTP/1.1",
    cookies: [],
    headers: filteredReqHeaders.map((h) => ({ name: h.name, value: h.value ?? "" })),
    queryString,
    headersSize: -1,
    bodySize: req.requestBody ? new TextEncoder().encode(req.requestBody).length : 0
  }

  if (req.requestBody) {
    const contentTypeHeader = req.requestHeaders.find(
      (h) => h.name.toLowerCase() === "content-type"
    )
    harReq.postData = {
      mimeType: contentTypeHeader?.value ?? "application/octet-stream",
      text: req.requestBody
    }
  }

  const filteredResHeaders = opts.includeResponse
    ? filterHeaders(req.responseHeaders, opts.includedResponseHeaderNames)
    : []

  const harRes: Record<string, unknown> = {
    status: req.status ?? 0,
    statusText: "",
    httpVersion: "HTTP/1.1",
    cookies: [],
    headers: filteredResHeaders.map((h) => ({ name: h.name, value: h.value ?? "" })),
    content: {
      size: req.responseBody ? new TextEncoder().encode(req.responseBody).length : 0,
      mimeType: (() => {
        const ct = req.responseHeaders.find((h) => h.name.toLowerCase() === "content-type")
        return ct?.value ?? "application/octet-stream"
      })(),
      ...(opts.includeResponse && req.responseBody != null ? { text: req.responseBody } : {})
    },
    redirectURL: "",
    headersSize: -1,
    bodySize: req.responseBody ? new TextEncoder().encode(req.responseBody).length : -1
  }

  const entry: Record<string, unknown> = {
    startedDateTime: new Date(req.timestamp).toISOString(),
    time: req.duration ?? -1,
    request: harReq,
    response: harRes,
    cache: {},
    timings: { send: -1, wait: req.duration ?? -1, receive: -1 }
  }

  const har = {
    log: {
      version: "1.2",
      creator: { name: "Request Recorder", version: "1.0" },
      entries: [entry]
    }
  }

  return JSON.stringify(har, null, 2)
}

// ─── Postman Collection v2.1 ──────────────────────────────────────────────────

function toPostmanFormat(req: RecordedRequest, opts: FormatOptions): string {
  const filteredReqHeaders = filterHeaders(req.requestHeaders, opts.includedHeaderNames)

  let parsedUrl: URL
  try {
    parsedUrl = new URL(req.url)
  } catch {
    parsedUrl = { href: req.url, hostname: "", port: "", pathname: req.url, search: "", protocol: "" } as URL
  }

  const urlObj: Record<string, unknown> = {
    raw: req.url,
    protocol: parsedUrl.protocol.replace(":", ""),
    host: parsedUrl.hostname.split("."),
    path: parsedUrl.pathname.split("/").filter(Boolean)
  }
  if (parsedUrl.port) urlObj.port = parsedUrl.port
  const queryParams: { key: string; value: string }[] = []
  parsedUrl.searchParams.forEach((value, key) => {
    queryParams.push({ key, value })
  })
  if (queryParams.length > 0) urlObj.query = queryParams

  const postmanReq: Record<string, unknown> = {
    method: req.method,
    header: filteredReqHeaders.map((h) => ({ key: h.name, value: h.value ?? "" })),
    url: urlObj
  }

  if (req.requestBody) {
    const contentTypeHeader = req.requestHeaders.find(
      (h) => h.name.toLowerCase() === "content-type"
    )
    const mimeType = contentTypeHeader?.value ?? ""
    if (mimeType.includes("application/x-www-form-urlencoded")) {
      postmanReq.body = { mode: "urlencoded", urlencoded: req.requestBody }
    } else if (mimeType.includes("multipart/form-data")) {
      postmanReq.body = { mode: "formdata", formdata: [] }
    } else {
      postmanReq.body = { mode: "raw", raw: req.requestBody }
    }
  }

  const item: Record<string, unknown> = {
    name: req.url,
    request: postmanReq
  }

  if (opts.includeResponse && req.responseBody != null) {
    const filteredResHeaders = filterHeaders(req.responseHeaders, opts.includedResponseHeaderNames)
    item.response = [
      {
        name: "Recorded Response",
        originalRequest: postmanReq,
        status: req.status ?? 0,
        code: req.status ?? 0,
        _postman_previewlanguage: "json",
        header: filteredResHeaders.map((h) => ({ key: h.name, value: h.value ?? "" })),
        cookie: [],
        body: req.responseBody
      }
    ]
  }

  const collection = {
    info: {
      name: "Recorded Requests",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: [item]
  }

  return JSON.stringify(collection, null, 2)
}

// ─── mitmproxy flow ───────────────────────────────────────────────────────────

function toMitmproxyFormat(req: RecordedRequest, opts: FormatOptions): string {
  const filteredReqHeaders = filterHeaders(req.requestHeaders, opts.includedHeaderNames)

  let parsedUrl: URL
  try {
    parsedUrl = new URL(req.url)
  } catch {
    parsedUrl = { protocol: "https:", hostname: "", port: "", pathname: req.url, search: "" } as URL
  }

  const scheme = parsedUrl.protocol.replace(":", "")
  const host = parsedUrl.hostname
  const port = parsedUrl.port || (scheme === "https" ? "443" : "80")
  const path = parsedUrl.pathname + parsedUrl.search || "/"

  const reqHeaderLines = filteredReqHeaders
    .map((h) => `        - - ${h.name}\n          - ${JSON.stringify(h.value ?? "")}`)
    .join("\n")

  let result =
    `- request:\n` +
    `    http_version: HTTP/1.1\n` +
    `    method: ${req.method}\n` +
    `    scheme: ${scheme}\n` +
    `    host: ${host}\n` +
    `    port: ${port}\n` +
    `    path: ${path}\n` +
    `    headers:\n` +
    (reqHeaderLines || `        []`) +
    `\n    content: ${req.requestBody ? JSON.stringify(req.requestBody) : "null"}\n`

  if (opts.includeResponse) {
    const filteredResHeaders = filterHeaders(req.responseHeaders, opts.includedResponseHeaderNames)
    const resHeaderLines = filteredResHeaders
      .map((h) => `        - - ${h.name}\n          - ${JSON.stringify(h.value ?? "")}`)
      .join("\n")

    result +=
      `  response:\n` +
      `    http_version: HTTP/1.1\n` +
      `    status_code: ${req.status ?? 0}\n` +
      `    reason: ""\n` +
      `    headers:\n` +
      (resHeaderLines || `        []`) +
      `\n    content: ${req.responseBody != null ? JSON.stringify(req.responseBody) : "null"}\n`
  }

  return result.trimEnd()
}

// ─── 公共入口 ─────────────────────────────────────────────────────────────────

/** 单条请求 → 字符串 */
export function formatRequest(req: RecordedRequest, opts: FormatOptions): string {
  switch (opts.format) {
    case "curl":
      return toCurlFormat(req, opts)
    case "fetch":
      return toFetchFormat(req, opts)
    case "axios":
      return toAxiosFormat(req, opts)
    case "http-raw":
      return toHttpRawFormat(req, opts)
    case "json":
      return toJsonFormat(req, opts)
    case "har":
      return toHarFormat(req, opts)
    case "postman":
      return toPostmanFormat(req, opts)
    case "mitmproxy":
      return toMitmproxyFormat(req, opts)
  }
}

/** 生成请求的标题行，优先使用触发来源描述，无则降级为纯序号 */
function requestTitle(req: RecordedRequest, index: number): string {
  const desc = req.triggerInfo?.description
  return desc ? `# ${index + 1}（点击"${desc}"）` : `# ${index + 1}`
}

/** 多条请求 → 字符串（多条时在各条前加标题分隔） */
export function formatRequestList(
  reqs: RecordedRequest[],
  opts: FormatOptions
): string {
  if (reqs.length === 1) return formatRequest(reqs[0], opts)
  return reqs
    .map((r, i) => `${requestTitle(r, i)}\n${formatRequest(r, opts)}`)
    .join("\n\n")
}
