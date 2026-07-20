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
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
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
            style={{
              marginBottom: 4,
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              overflow: "hidden"
            }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "7px 10px",
                background: checked ? "#f9fafb" : "#fff",
                gap: 8
              }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(group)}
                style={{ cursor: "pointer" }}
              />
              <span style={{ flex: 1, fontSize: 12, color: "#374151", fontWeight: 500 }}>
                {HEADER_GROUP_LABELS[group]}
                {headers.length > 0 && (
                  <span style={{ color: "#9ca3af", fontWeight: 400 }}>
                    {" "}({headers.map((h) => h.name).slice(0, 3).join(", ")}
                    {headers.length > 3 ? " …" : ""})
                  </span>
                )}
                {headers.length === 0 && (
                  <span style={{ color: "#d1d5db", fontWeight: 400 }}>
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
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    color: "#6b7280",
                    padding: 0
                  }}>
                  {isExpanded ? "收起 ▲" : "展开 ▾"}
                </button>
              )}
            </div>

            {isExpanded && headers.length > 0 && (
              <div
                style={{
                  padding: "4px 10px 8px 32px",
                  background: "#f9fafb",
                  borderTop: "1px solid #e5e7eb"
                }}>
                {headers.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "#6b7280",
                      marginTop: 2
                    }}>
                    {h.name}
                    {h.value && (
                      <span style={{ color: "#9ca3af" }}>
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
      style={{
        padding: "3px 10px",
        borderRadius: 4,
        border: `1px solid ${active ? "#2563eb" : "#d1d5db"}`,
        background: active ? "#eff6ff" : "#fff",
        color: active ? "#2563eb" : "#6b7280",
        fontSize: 11,
        cursor: "pointer"
      }}>
      {children}
    </button>
  )
}
