import { useState } from "react"

import type { RecordedRequest } from "~lib/types"
import { formatDuration } from "~lib/utils"

const METHOD_COLORS: Record<string, string> = {
  GET: "#2563eb",
  POST: "#16a34a",
  PUT: "#d97706",
  DELETE: "#dc2626",
  PATCH: "#7c3aed"
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

  const methodColor = METHOD_COLORS[request.method.toUpperCase()] ?? "#6b7280"
  const statusColor = request.error
    ? "#dc2626"
    : request.status == null
      ? "#6b7280"
      : request.status >= 400
        ? "#dc2626"
        : request.status >= 300
          ? "#d97706"
          : "#16a34a"

  const shortUrl = (() => {
    try {
      const u = new URL(request.url)
      return u.pathname + u.search
    } catch {
      return request.url
    }
  })()

  return (
    <div
      style={{
        borderBottom: "1px solid #f3f4f6",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif"
      }}>
      {/* 请求行 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          background: expanded ? "#f9fafb" : "#fff",
          userSelect: "none"
        }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "pointer", flexShrink: 0 }}
        />
        <div
          onClick={onToggle}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: 1,
            minWidth: 0,
            cursor: "pointer"
          }}>
        <span
          style={{
            minWidth: 46,
            fontSize: 11,
            fontWeight: 700,
            color: methodColor,
            fontFamily: "monospace"
          }}>
          {request.method}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 12,
            color: "#111827",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "monospace"
          }}
          title={request.url}>
          {shortUrl}
        </span>
        <span
          title={request.error ?? undefined}
          style={{ fontSize: 11, fontWeight: 600, color: statusColor, minWidth: 28 }}>
          {request.error ? "ERR" : (request.status ?? "-")}
        </span>
        <span style={{ fontSize: 11, color: "#9ca3af", minWidth: 40, textAlign: "right" }}>
          {formatDuration(request.duration)}
        </span>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {/* 触发来源（有数据时在请求行下方展示，不需要展开） */}
      {request.triggerInfo && (
        <div
          style={{
            padding: "3px 16px 5px 72px",
            fontSize: 11,
            color: "#6b7280",
            background: expanded ? "#f9fafb" : "#fff",
            display: "flex",
            alignItems: "center",
            gap: 4
          }}>
          <span style={{ color: "#d1d5db" }}>⊙</span>
          <span
            title={`触发方式：${request.triggerInfo.via === "keyboard" ? "键盘" : "点击"}`}
            style={{ color: "#9ca3af" }}>
            点击"{request.triggerInfo.description}"
          </span>
        </div>
      )}

      {/* 展开面板 */}
      {expanded && (
        <div style={{ background: "#f9fafb", padding: "0 16px 12px" }}>
          {/* Tab 导航 */}
          <div style={{ display: "flex", gap: 0, marginBottom: 10, borderBottom: "1px solid #e5e7eb" }}>
            {(["headers", "body", "response"] as Tab[]).map((tab) => {
              const labels: Record<Tab, string> = {
                headers: "Headers",
                body: "Request Body",
                response: "Response"
              }
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: activeTab === tab ? 600 : 400,
                    color: activeTab === tab ? "#2563eb" : "#6b7280",
                    background: "none",
                    border: "none",
                    borderBottom: activeTab === tab ? "2px solid #2563eb" : "2px solid transparent",
                    cursor: "pointer",
                    marginBottom: -1
                  }}>
                  {labels[tab]}
                </button>
              )
            })}
          </div>

          {/* Tab 内容 */}
          {activeTab === "headers" && (
            <div>
              {request.requestHeaders.length === 0 && request.responseHeaders.length === 0 ? (
                <span style={{ fontSize: 12, color: "#9ca3af" }}>暂无 Headers 数据</span>
              ) : (
                <>
                  {request.requestHeaders.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>
                        REQUEST HEADERS
                      </div>
                      {request.requestHeaders.map((h, i) => (
                        <div key={i} style={{ fontSize: 12, fontFamily: "monospace", marginBottom: 2 }}>
                          <span style={{ color: "#6b7280" }}>{h.name}: </span>
                          <span style={{ color: "#111827" }}>{h.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {request.responseHeaders.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>
                        RESPONSE HEADERS
                      </div>
                      {request.responseHeaders.map((h, i) => (
                        <div key={i} style={{ fontSize: 12, fontFamily: "monospace", marginBottom: 2 }}>
                          <span style={{ color: "#6b7280" }}>{h.name}: </span>
                          <span style={{ color: "#111827" }}>{h.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "body" && (
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                fontFamily: "monospace",
                color: "#111827",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: 200,
                overflowY: "auto"
              }}>
              {request.requestBody ?? <span style={{ color: "#9ca3af" }}>（无请求体）</span>}
            </pre>
          )}

          {activeTab === "response" && (
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                fontFamily: "monospace",
                color: "#111827",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: 200,
                overflowY: "auto"
              }}>
              {request.responseBody ?? <span style={{ color: "#9ca3af" }}>（无响应体）</span>}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
