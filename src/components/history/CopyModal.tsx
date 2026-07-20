import { useMemo, useState } from "react"
import ReactDOM from "react-dom"

import HeaderGroupSection from "~components/history/HeaderGroupSection"
import { useCopyPrefs } from "~hooks/useCopyPrefs"
import {
  classifyHeaders,
  type HeaderGroupKey
} from "~lib/headerGroups"
import {
  formatRequest,
  formatRequestList,
  resolveIncludedHeaders,
  NATIVE_RESPONSE_FORMATS,
  type FormatType
} from "~lib/format"
import type { RecordedRequest } from "~lib/types"

interface Props {
  requests: RecordedRequest[]
  onClose: () => void
}

const FORMAT_OPTIONS: { key: FormatType; label: string }[] = [
  { key: "curl", label: "cURL" },
  { key: "fetch", label: "Fetch" },
  { key: "axios", label: "Axios" },
  { key: "http-raw", label: "HTTP Raw" },
  { key: "json", label: "JSON" },
  { key: "har", label: "HAR" },
  { key: "postman", label: "Postman" },
  { key: "mitmproxy", label: "mitmproxy" }
]

export default function CopyModal({ requests, onClose }: Props) {
  const [prefs, updatePrefs] = useCopyPrefs()
  const [copied, setCopied] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // 将所有请求的 headers 合并去重，用于分类展示
  const allHeaders = useMemo(
    () =>
      Array.from(
        new Map(
          requests.flatMap((r) => r.requestHeaders).map((h) => [h.name.toLowerCase(), h])
        ).values()
      ),
    [requests]
  )

  // 将所有响应的 headers 合并去重
  const allResponseHeaders = useMemo(
    () =>
      Array.from(
        new Map(
          requests.flatMap((r) => r.responseHeaders).map((h) => [h.name.toLowerCase(), h])
        ).values()
      ),
    [requests]
  )

  const groupedHeaders = useMemo(() => classifyHeaders(allHeaders), [allHeaders])
  const groupedResHeaders = useMemo(() => classifyHeaders(allResponseHeaders), [allResponseHeaders])

  // 实时预览（展示所有请求）
  const previewTexts = useMemo(() => {
    if (requests.length === 0) return []
    const includedHeaderNames = resolveIncludedHeaders(allHeaders, prefs.headerGroups)
    const includedResponseHeaderNames = resolveIncludedHeaders(allResponseHeaders, prefs.responseHeaderGroups)
    return requests.map((req) =>
      formatRequest(req, {
        format: prefs.format,
        includedHeaderNames,
        includeResponse: prefs.includeResponse,
        includedResponseHeaderNames
      })
    )
  }, [requests, allHeaders, allResponseHeaders, prefs])

  const handleCopyAll = async () => {
    const includedHeaderNames = resolveIncludedHeaders(allHeaders, prefs.headerGroups)
    const includedResponseHeaderNames = resolveIncludedHeaders(allResponseHeaders, prefs.responseHeaderGroups)
    const text = formatRequestList(requests, {
      format: prefs.format,
      includedHeaderNames,
      includeResponse: prefs.includeResponse,
      includedResponseHeaderNames
    })
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleGroup = (group: HeaderGroupKey) => {
    updatePrefs({
      headerGroups: { ...prefs.headerGroups, [group]: !prefs.headerGroups[group] }
    })
  }

  const toggleResGroup = (group: HeaderGroupKey) => {
    updatePrefs({
      responseHeaderGroups: { ...prefs.responseHeaderGroups, [group]: !prefs.responseHeaderGroups[group] }
    })
  }

  const selectAllGroups = (checked: boolean) => {
    const groups = { auth: checked, content: checked, cors: checked, custom: checked }
    updatePrefs({ headerGroups: groups })
  }

  const selectAllResGroups = (checked: boolean) => {
    const groups = { auth: checked, content: checked, cors: checked, custom: checked }
    updatePrefs({ responseHeaderGroups: groups })
  }

  return ReactDOM.createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}>
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          width: "min(900px, 95vw)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}>
        {/* 标题栏 */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
            复制请求
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "#9ca3af",
              lineHeight: 1,
              padding: "0 2px"
            }}>
            ×
          </button>
        </div>

        {/* 内容区：左右布局 */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* 左侧配置区（可滚动） */}
          <div style={{ width: 340, flexShrink: 0, overflowY: "auto", padding: "14px 18px", borderRight: "1px solid #e5e7eb" }}>
          {/* 格式选择 */}
          <Section title="格式">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {FORMAT_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => updatePrefs({ format: key })}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: `1px solid ${prefs.format === key ? "#2563eb" : "#d1d5db"}`,
                    background: prefs.format === key ? "#eff6ff" : "#fff",
                    color: prefs.format === key ? "#2563eb" : "#374151",
                    fontSize: 12,
                    fontWeight: prefs.format === key ? 600 : 400,
                    cursor: "pointer"
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </Section>

          {/* 请求头分组 */}
          <Section title="请求头">
            <HeaderGroupSection
              grouped={groupedHeaders}
              checks={prefs.headerGroups}
              onToggle={toggleGroup}
              onSelectAll={selectAllGroups}
              emptyHint="此次录制无此类 Headers"
            />
          </Section>

          {/* 包含响应 */}
          <Section title="响应">
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 12,
                color: "#374151",
                marginBottom: prefs.includeResponse ? 10 : 0
              }}>
              <input
                type="checkbox"
                checked={prefs.includeResponse}
                onChange={(e) => updatePrefs({ includeResponse: e.target.checked })}
                style={{ cursor: "pointer" }}
              />
              {NATIVE_RESPONSE_FORMATS.has(prefs.format) ? "包含响应体" : "包含响应体（以注释形式追加）"}
            </label>

            {prefs.includeResponse && (
              <>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, paddingLeft: 2 }}>
                  响应头
                </div>
                <HeaderGroupSection
                  grouped={groupedResHeaders}
                  checks={prefs.responseHeaderGroups}
                  onToggle={toggleResGroup}
                  onSelectAll={selectAllResGroups}
                  emptyHint="无此类响应 Headers"
                />
              </>
            )}
          </Section>
          </div>

          {/* 右侧预览区（所有请求，可滚动） */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              预览{requests.length > 1 ? `（共 ${requests.length} 条）` : ""}
            </div>
            {previewTexts.length === 0 ? (
              <span style={{ color: "#9ca3af", fontSize: 12 }}>（无请求数据）</span>
            ) : (
              previewTexts.map((text, i) => (
                <div key={i} style={{ marginBottom: previewTexts.length > 1 ? 12 : 0 }}>
                  {previewTexts.length > 1 && (
                    <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4, fontFamily: "monospace" }}>
                      {requests[i].triggerInfo ? `# ${i + 1}（点击"${requests[i].triggerInfo.description}"）` : `# ${i + 1}`}
                    </div>
                  )}
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(text)
                        setCopiedIndex(i)
                        setTimeout(() => setCopiedIndex(null), 2000)
                      }}
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: "1px solid #d1d5db",
                        background: copiedIndex === i ? "#16a34a" : "#fff",
                        color: copiedIndex === i ? "#fff" : "#6b7280",
                        fontSize: 10,
                        cursor: "pointer",
                        zIndex: 1,
                        transition: "background 0.15s"
                      }}>
                      {copiedIndex === i ? "已复制" : "复制"}
                    </button>
                    <pre
                      style={{
                        margin: 0,
                        padding: "10px 12px",
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: "monospace",
                        color: "#1e293b",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        lineHeight: 1.6
                      }}>
                      {text}
                    </pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div
          style={{
            padding: "12px 18px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8
          }}>
          <button
            onClick={onClose}
            style={{
              padding: "7px 16px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#374151",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer"
            }}>
            取消
          </button>
          <button
            onClick={handleCopyAll}
            disabled={requests.length === 0}
            style={{
              padding: "7px 18px",
              borderRadius: 6,
              border: "none",
              background: copied ? "#16a34a" : "#2563eb",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: requests.length === 0 ? "not-allowed" : "pointer",
              transition: "background 0.15s"
            }}>
            {copied
              ? "已复制！"
              : requests.length > 1
                ? `复制全部（${requests.length} 条）`
                : "复制"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 8
        }}>
        {title}
      </div>
      {children}
    </div>
  )
}
