import { useState } from "react"

import type { RecordedRequest } from "~lib/types"
import { formatDuration } from "~lib/utils"

/** HTTP 方法的彩色徽章配色（浅色底 + 深色文字，深色模式反向） */
const METHOD_STYLES: Record<string, string> = {
  GET: "bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400",
  POST: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400",
  PUT: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400",
  DELETE: "bg-red-500/10 text-red-600 dark:bg-red-400/15 dark:text-red-400",
  PATCH: "bg-violet-500/10 text-violet-600 dark:bg-violet-400/15 dark:text-violet-400"
}

interface Props {
  request: RecordedRequest
  expanded: boolean
  onToggle: () => void
  checked: boolean
  onCheck: (checked: boolean) => void
}

type Tab = "headers" | "body" | "response"

export default function RequestItem({ request, expanded, onToggle, checked, onCheck }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("headers")

  const methodStyle =
    METHOD_STYLES[request.method.toUpperCase()] ??
    "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-400/15 dark:text-zinc-400"
  const statusStyle = request.error
    ? "text-red-600 dark:text-red-400"
    : request.status == null
      ? "text-zinc-400 dark:text-zinc-500"
      : request.status >= 400
        ? "text-red-600 dark:text-red-400"
        : request.status >= 300
          ? "text-amber-600 dark:text-amber-400"
          : "text-emerald-600 dark:text-emerald-400"

  const shortUrl = (() => {
    try {
      const u = new URL(request.url)
      return u.pathname + u.search
    } catch {
      return request.url
    }
  })()

  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800/70">
      {/* 请求行 */}
      <div
        className={`group flex items-center gap-2.5 px-4 transition-colors ${
          expanded
            ? "bg-zinc-50 dark:bg-zinc-900"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
        }`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-pointer accent-blue-600"
        />
        <div
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-2.5 py-2">
          <span
            className={`inline-flex h-5 w-[46px] shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold uppercase tracking-wide ${methodStyle}`}>
            {request.method}
          </span>
          <span
            className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-800 dark:text-zinc-200"
            title={request.url}>
            {shortUrl}
          </span>
          <span
            title={request.error ?? undefined}
            className={`min-w-[30px] shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums ${statusStyle}`}>
            {request.error ? "ERR" : (request.status ?? "-")}
          </span>
          <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
            {formatDuration(request.duration)}
          </span>
          <svg
            viewBox="0 0 16 16"
            className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform dark:text-zinc-500 ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* 触发来源（有数据时在请求行下方展示，不需要展开） */}
      {request.triggerInfo && (
        <div
          className={`flex items-center gap-1.5 px-4 pb-1.5 pl-[72px] text-[11px] transition-colors ${
            expanded ? "bg-zinc-50 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
          }`}>
          <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-600" fill="none">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="8" cy="8" r="1.6" fill="currentColor" />
          </svg>
          <span
            title={`触发方式：${request.triggerInfo.via === "keyboard" ? "键盘" : "点击"}`}
            className="truncate text-zinc-400 dark:text-zinc-500">
            点击"{request.triggerInfo.description}"
          </span>
        </div>
      )}

      {/* 展开面板 */}
      {expanded && (
        <div className="rr-anim-expand border-t border-zinc-100 bg-zinc-50 px-4 pb-3 pt-0 dark:border-zinc-800/70 dark:bg-zinc-900">
          {/* Tab 导航 */}
          <div className="mb-2.5 flex gap-0 border-b border-zinc-200 dark:border-zinc-800">
            {(["headers", "body", "response"] as Tab[]).map((tab) => {
              const labels: Record<Tab, string> = {
                headers: "Headers",
                body: "Request Body",
                response: "Response"
              }
              const active = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`-mb-px border-b-2 px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-blue-600 font-semibold text-blue-600 dark:border-blue-400 dark:text-blue-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                  }`}>
                  {labels[tab]}
                </button>
              )
            })}
          </div>

          {/* Tab 内容 */}
          {activeTab === "headers" && (
            <div>
              {request.requestHeaders.length === 0 && request.responseHeaders.length === 0 ? (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">暂无 Headers 数据</span>
              ) : (
                <>
                  {request.requestHeaders.length > 0 && (
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Request Headers
                      </div>
                      <div className="rounded-md bg-white p-2 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
                        {request.requestHeaders.map((h, i) => (
                          <div key={i} className="mb-px break-all font-mono text-xs leading-relaxed">
                            <span className="text-zinc-500 dark:text-zinc-400">{h.name}: </span>
                            <span className="text-zinc-800 dark:text-zinc-200">{h.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {request.responseHeaders.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Response Headers
                      </div>
                      <div className="rounded-md bg-white p-2 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
                        {request.responseHeaders.map((h, i) => (
                          <div key={i} className="mb-px break-all font-mono text-xs leading-relaxed">
                            <span className="text-zinc-500 dark:text-zinc-400">{h.name}: </span>
                            <span className="text-zinc-800 dark:text-zinc-200">{h.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "body" && (
            <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-white p-2.5 font-mono text-xs leading-relaxed text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-800">
              {request.requestBody ?? <span className="text-zinc-400 dark:text-zinc-500">（无请求体）</span>}
            </pre>
          )}

          {activeTab === "response" && (
            <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-white p-2.5 font-mono text-xs leading-relaxed text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-800">
              {request.responseBody ?? <span className="text-zinc-400 dark:text-zinc-500">（无响应体）</span>}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
