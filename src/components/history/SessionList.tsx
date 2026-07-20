import type { RecordingSession } from "~lib/types"
import { formatTime } from "~lib/utils"

/** 从 pageUrl 提取友好的显示标题：hostname + pathname（去掉末尾斜杠） */
function getSessionTitle(session: RecordingSession): string {
  if (session.pageUrl) {
    try {
      const u = new URL(session.pageUrl)
      const path = u.pathname.replace(/\/$/, "")
      return path ? `${u.hostname}${path}` : u.hostname
    } catch {
      return session.pageUrl
    }
  }
  return session.name
}

interface Props {
  sessions: RecordingSession[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export default function SessionList({
  sessions,
  selectedId,
  onSelect,
  onDelete
}: Props) {
  if (sessions.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "#9ca3af",
          fontSize: 13,
          lineHeight: 1.6
        }}>
        暂无录制历史
        <br />
        点击页面右下角的录制按钮开始
      </div>
    )
  }

  return (
    <div style={{ overflowY: "auto", flex: 1 }}>
      {sessions.map((session) => {
        const isSelected = session.id === selectedId
        return (
          <div
            key={session.id}
            onClick={() => onSelect(session.id)}
            title={session.pageUrl || undefined}
            style={{
              padding: "10px 14px",
              cursor: "pointer",
              background: isSelected ? "#eff6ff" : "#fff",
              borderLeft: isSelected ? "3px solid #2563eb" : "3px solid transparent",
              borderBottom: "1px solid #f3f4f6",
              transition: "background 0.1s"
            }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 4
              }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#111827",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1
                }}>
                {getSessionTitle(session)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(session.id)
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#d1d5db",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: "0 2px",
                  lineHeight: 1,
                  flexShrink: 0
                }}
                title="删除会话">
                ×
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              {session.requestIds.length} 条请求 · {formatTime(session.startTime)}
              {session.endTime == null && (
                <span
                  style={{
                    marginLeft: 6,
                    color: "#dc2626",
                    fontWeight: 600
                  }}>
                  录制中
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
