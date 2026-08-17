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
    <div className="flex h-full flex-col">
      {/* 会话信息栏 */}
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{session.name}</div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {formatTime(session.startTime)}
            {session.endTime && ` - ${formatTime(session.endTime)}`}
            {" · "}
            {requests.length} 条请求
          </div>
        </div>
        <button
          onClick={handleQuickCopy}
          disabled={checkedRequests.length === 0}
          title={`按当前配置（${prefs.format}）直接复制，无需打开弹窗`}
          className={`h-8 shrink-0 whitespace-nowrap rounded-lg border px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-40 ${
            quickCopied
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-zinc-300 bg-white text-zinc-700 hover:border-blue-500/60 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-blue-400/60 dark:hover:text-blue-400"
          }`}>
          {quickCopied ? "已复制" : `⚡ 复制 ${prefs.format}`}
        </button>
        <button
          onClick={() => setShowModal(true)}
          disabled={checkedRequests.length === 0}
          className="h-8 shrink-0 whitespace-nowrap rounded-lg border border-zinc-300 bg-white px-3.5 text-xs font-medium text-zinc-700 transition-colors hover:border-blue-500/60 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-300 disabled:hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-blue-400/60 dark:hover:text-blue-400 dark:disabled:hover:border-zinc-700 dark:disabled:hover:text-zinc-300">
          高级复制{checkedRequests.length > 0 && checkedRequests.length < requests.length
            ? `（${checkedRequests.length} 条）`
            : ""}
        </button>
      </div>

      {/* 全选工具栏 */}
      {requests.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-1.5 dark:border-zinc-800/70 dark:bg-zinc-900/60">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = !allChecked && someChecked
            }}
            onChange={toggleAll}
            className="cursor-pointer accent-blue-600"
          />
          <span
            className="cursor-pointer select-none text-xs text-zinc-500 dark:text-zinc-400"
            onClick={toggleAll}>
            {allChecked ? "取消全选" : "全选"}
          </span>
          <span className="ml-1 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
            已选 {checkedIds.size} / {requests.length}
          </span>
        </div>
      )}

      {/* 请求列表 */}
      <div className="flex-1 overflow-y-auto">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center px-8 py-16 text-center">
            <svg
              viewBox="0 0 48 48"
              className="mb-3 h-12 w-12 text-zinc-200 dark:text-zinc-800"
              fill="none">
              <circle cx="24" cy="24" r="19" stroke="currentColor" strokeWidth="2.5" />
              <path
                d="M15 24l6 6 12-12"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-[13px] text-zinc-400 dark:text-zinc-500">
              本次录制未捕获任何请求
            </p>
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
