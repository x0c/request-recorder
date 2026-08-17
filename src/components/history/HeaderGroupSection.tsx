import { useState } from "react"

import {
  HEADER_GROUP_LABELS,
  type HeaderGroupKey
} from "~lib/headerGroups"
import type { RequestHeader } from "~lib/types"

const GROUP_ORDER: HeaderGroupKey[] = ["content", "auth", "cors", "custom"]

interface Props {
  /** classifyHeaders 分组后的结果 */
  grouped: Record<HeaderGroupKey, RequestHeader[]>
  /** 各分组的勾选状态 */
  checks: Record<HeaderGroupKey, boolean>
  onToggle: (group: HeaderGroupKey) => void
  onSelectAll: (checked: boolean) => void
  /** 分组内无 header 时的提示文案 */
  emptyHint: string
}

/** 请求头/响应头的分组勾选区块（CopyModal 中两处复用） */
export default function HeaderGroupSection({
  grouped,
  checks,
  onToggle,
  onSelectAll,
  emptyHint
}: Props) {
  const [expandedGroups, setExpandedGroups] = useState<
    Record<HeaderGroupKey, boolean>
  >({ auth: false, content: false, cors: false, custom: false })

  const allChecked = GROUP_ORDER.every((g) => checks[g])
  const noneChecked = GROUP_ORDER.every((g) => !checks[g])

  return (
    <div>
      {/* 全选/全不选 */}
      <div className="mb-2.5 flex gap-1.5">
        <SmallBtn active={allChecked} onClick={() => onSelectAll(true)}>
          全选
        </SmallBtn>
        <SmallBtn active={noneChecked} onClick={() => onSelectAll(false)}>
          全不选
        </SmallBtn>
      </div>

      {GROUP_ORDER.map((group) => {
        const headers = grouped[group]
        const isExpanded = expandedGroups[group]
        const checked = checks[group]

        return (
          <div
            key={group}
            className="mb-1.5 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div
              className={`flex items-center gap-2 px-2.5 py-1.5 transition-colors ${
                checked ? "bg-zinc-50 dark:bg-zinc-800/50" : "bg-transparent"
              }`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(group)}
                className="cursor-pointer accent-blue-600"
              />
              <span className="flex-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {HEADER_GROUP_LABELS[group]}
                {headers.length > 0 && (
                  <span className="font-normal text-zinc-400 dark:text-zinc-500">
                    {" "}({headers.map((h) => h.name).slice(0, 3).join(", ")}
                    {headers.length > 3 ? " …" : ""})
                  </span>
                )}
                {headers.length === 0 && (
                  <span className="font-normal text-zinc-300 dark:text-zinc-600">
                    {" "}({emptyHint})
                  </span>
                )}
              </span>
              {headers.length > 0 && (
                <button
                  onClick={() =>
                    setExpandedGroups((prev) => ({
                      ...prev,
                      [group]: !prev[group]
                    }))
                  }
                  className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300">
                  {isExpanded ? "收起" : "展开"}
                  <svg
                    viewBox="0 0 16 16"
                    className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none">
                    <path
                      d="M4 6l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>

            {isExpanded && headers.length > 0 && (
              <div className="border-t border-zinc-200 bg-zinc-50 px-2.5 pb-2 pt-1.5 pl-[30px] dark:border-zinc-800 dark:bg-zinc-800/30">
                {headers.map((h, i) => (
                  <div
                    key={i}
                    className="mt-0.5 break-all font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    {h.name}
                    {h.value && (
                      <span className="text-zinc-400 dark:text-zinc-500">
                        : {h.value.length > 60 ? h.value.slice(0, 60) + "…" : h.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SmallBtn({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
        active
          ? "border-blue-600 bg-blue-600/10 font-semibold text-blue-700 dark:border-blue-400 dark:bg-blue-400/10 dark:text-blue-300"
          : "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
      }`}>
      {children}
    </button>
  )
}
