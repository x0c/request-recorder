import { useEffect, useRef, useState } from "react"

import CopyModal from "~components/history/CopyModal"
import RequestItem from "~components/history/RequestItem"
import { useCopyPrefs } from "~hooks/useCopyPrefs"
import { formatRequestList, resolveIncludedHeaders } from "~lib/format"
import type { RecordedRequest, RecordingSession } from "~lib/types"
import { formatTime } from "~lib/utils"

interface Props {
  session: RecordingSession
  requests: RecordedRequest[]
}

export default function RequestList({ session, requests }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [quickCopied, setQuickCopied] = useState(false)
  const [prefs] = useCopyPrefs()
  const prevSessionRef = useRef<string | null>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())

  // 切换 session 时重置为全选；录制中实时刷新时保留已有勾选、仅自动选中新出现的请求
  useEffect(() => {
    const currentIds = requests.map((r) => r.id)
    if (prevSessionRef.current !== session.id) {
      prevSessionRef.current = session.id
      seenIdsRef.current = new Set(currentIds)
      setCheckedIds(new Set(currentIds))
      return
    }
    const fresh = currentIds.filter((id) => !seenIdsRef.current.has(id))
    if (fresh.length > 0) {
      for (const id of currentIds) seenIdsRef.current.add(id)
      setCheckedIds((prev) => new Set([...prev, ...fresh]))
    }
  }, [session.id, requests])

  const allChecked = requests.length > 0 && requests.every((r) => checkedIds.has(r.id))
  const someChecked = requests.some((r) => checkedIds.has(r.id))

  const toggleAll = () => {
    if (allChecked) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(requests.map((r) => r.id)))
    }
  }

  const toggleOne = (id: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const checkedRequests = requests.filter((r) => checkedIds.has(r.id))

  const handleQuickCopy = async () => {
    if (checkedRequests.length === 0) return
    const allHeaders = Array.from(
      new Map(
        checkedRequests.flatMap((r) => r.requestHeaders).map((h) => [h.name.toLowerCase(), h])
      ).values()
    )
    const allResponseHeaders = Array.from(
      new Map(
        checkedRequests.flatMap((r) => r.responseHeaders).map((h) => [h.name.toLowerCase(), h])
      ).values()
    )
    const includedHeaderNames = resolveIncludedHeaders(allHeaders, prefs.headerGroups)
    const includedResponseHeaderNames = resolveIncludedHeaders(allResponseHeaders, prefs.responseHeaderGroups)
    const text = formatRequestList(checkedRequests, {
      format: prefs.format,
      includedHeaderNames,
      includeResponse: prefs.includeResponse,
      includedResponseHeaderNames
    })
    await navigator.clipboard.writeText(text)
    setQuickCopied(true)
    setTimeout(() => setQuickCopied(false), 2000)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* 会话信息栏 */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0
        }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
            {session.name}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            {formatTime(session.startTime)}
            {session.endTime && ` — ${formatTime(session.endTime)}`}
            {" · "}
            {requests.length} 条请求
          </div>
        </div>
        <button
          onClick={handleQuickCopy}
          disabled={checkedRequests.length === 0}
          title={`按当前配置（${prefs.format}）直接复制，无需打开弹窗`}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: `1px solid ${quickCopied ? "#16a34a" : "#d1d5db"}`,
            background: quickCopied ? "#f0fdf4" : "#fff",
            color: quickCopied ? "#16a34a" : "#374151",
            fontSize: 12,
            fontWeight: 500,
            cursor: checkedRequests.length === 0 ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.15s"
          }}>
          {quickCopied ? "已复制" : `⚡ 复制 ${prefs.format}`}
        </button>
        <button
          onClick={() => setShowModal(true)}
          disabled={checkedRequests.length === 0}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#374151",
            fontSize: 12,
            fontWeight: 500,
            cursor: checkedRequests.length === 0 ? "not-allowed" : "pointer",
            whiteSpace: "nowrap"
          }}>
          高级复制{checkedRequests.length > 0 && checkedRequests.length < requests.length
            ? `（${checkedRequests.length} 条）`
            : ""}
        </button>
      </div>

      {/* 全选工具栏 */}
      {requests.length > 0 && (
        <div
          style={{
            padding: "6px 16px",
            borderBottom: "1px solid #f3f4f6",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fafafa",
            flexShrink: 0
          }}>
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = !allChecked && someChecked
            }}
            onChange={toggleAll}
            style={{ cursor: "pointer" }}
          />
          <span style={{ fontSize: 12, color: "#6b7280", cursor: "pointer" }} onClick={toggleAll}>
            {allChecked ? "取消全选" : "全选"}
          </span>
          <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 4 }}>
            已选 {checkedIds.size} / {requests.length}
          </span>
        </div>
      )}

      {/* 请求列表 */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {requests.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 13
            }}>
            本次录制未捕获任何请求
          </div>
        ) : (
          requests.map((req) => (
            <RequestItem
              key={req.id}
              request={req}
              expanded={expandedId === req.id}
              onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
              checked={checkedIds.has(req.id)}
              onCheck={(checked) => toggleOne(req.id, checked)}
            />
          ))
        )}
      </div>
      {showModal && (
        <CopyModal requests={checkedRequests} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
