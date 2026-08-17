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
      className="rr-anim-overlay fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="rr-anim-modal flex max-h-[88vh] w-[min(920px,95vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
        {/* 标题栏 */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          <span className="text-sm font-semibold">复制请求</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* 内容区：左右布局 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧配置区（可滚动） */}
          <div className="w-80 shrink-0 overflow-y-auto border-r border-zinc-100 p-5 dark:border-zinc-800">
            {/* 格式选择 */}
            <Section title="格式">
              <div className="flex flex-wrap gap-1.5">
                {FORMAT_OPTIONS.map(({ key, label }) => {
                  const active = prefs.format === key
                  return (
                    <button
                      key={key}
                      onClick={() => updatePrefs({ format: key })}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                        active
                          ? "border-blue-600 bg-blue-600/10 font-semibold text-blue-700 dark:border-blue-400 dark:bg-blue-400/10 dark:text-blue-300"
                          : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
                      }`}>
                      {label}
                    </button>
                  )
                })}
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
              <label className="mb-2.5 flex cursor-pointer items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={prefs.includeResponse}
                  onChange={(e) => updatePrefs({ includeResponse: e.target.checked })}
                  className="cursor-pointer accent-blue-600"
                />
                {NATIVE_RESPONSE_FORMATS.has(prefs.format) ? "包含响应体" : "包含响应体（以注释形式追加）"}
              </label>

              {prefs.includeResponse && (
                <>
                  <div className="mb-2 pl-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
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

          {/* 右侧预览区（所有请求，可滚动，统一深色代码编辑器风格） */}
          <div className="flex flex-1 flex-col overflow-y-auto bg-zinc-100/60 p-5 dark:bg-zinc-950/60">
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              预览{requests.length > 1 ? `（共 ${requests.length} 条）` : ""}
            </div>
            {previewTexts.length === 0 ? (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">（无请求数据）</span>
            ) : (
              previewTexts.map((text, i) => (
                <div key={i} className={previewTexts.length > 1 ? "mb-3" : ""}>
                  {previewTexts.length > 1 && (
                    <div className="mb-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-500">
                      {requests[i].triggerInfo ? `# ${i + 1}（点击"${requests[i].triggerInfo.description}"）` : `# ${i + 1}`}
                    </div>
                  )}
                  <div className="relative">
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(text)
                        setCopiedIndex(i)
                        setTimeout(() => setCopiedIndex(null), 2000)
                      }}
                      className={`absolute right-2 top-2 z-[1] rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                        copiedIndex === i
                          ? "bg-emerald-500 text-white"
                          : "bg-white/10 text-zinc-400 hover:bg-white/20 hover:text-zinc-200"
                      }`}>
                      {copiedIndex === i ? "已复制" : "复制"}
                    </button>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-zinc-950 p-3 pt-9 font-mono text-[11px] leading-relaxed text-zinc-200 ring-1 ring-white/10">
                      {text}
                    </pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            取消
          </button>
          <button
            onClick={handleCopyAll}
            disabled={requests.length === 0}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
              copied
                ? "bg-emerald-500 hover:bg-emerald-400"
                : "bg-blue-600 hover:bg-blue-500"
            }`}>
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
    <div className="mb-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {title}
      </div>
      {children}
    </div>
  )
}
