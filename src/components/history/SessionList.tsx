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
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <svg
          viewBox="0 0 48 48"
          className="mb-3 h-12 w-12 text-zinc-300 dark:text-zinc-700"
          fill="none">
          <circle cx="24" cy="24" r="19" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="24" cy="24" r="7" fill="currentColor" />
        </svg>
        <p className="text-[13px] leading-relaxed text-zinc-400 dark:text-zinc-500">
          暂无录制历史
          <br />
          点击页面右下角的录制按钮开始
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {sessions.map((session) => {
        const isSelected = session.id === selectedId
        return (
          <div
            key={session.id}
            onClick={() => onSelect(session.id)}
            title={session.pageUrl || undefined}
            className={`group mb-1 cursor-pointer rounded-lg border px-3 py-2 transition-colors ${
              isSelected
                ? "border-blue-600/20 bg-blue-600/10 dark:border-blue-400/20 dark:bg-blue-400/10"
                : "border-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-800/70"
            }`}>
            <div className="flex items-center gap-1">
              <div
                className={`flex-1 truncate text-[13px] font-medium ${
                  isSelected
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-zinc-800 dark:text-zinc-200"
                }`}>
                {getSessionTitle(session)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(session.id)
                }}
                title="删除会话"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 opacity-0 transition-all hover:bg-zinc-300/60 hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-700">
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {session.requestIds.length} 条请求 · {formatTime(session.startTime)}
              {session.endTime == null && (
                <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-px font-semibold text-red-600 dark:text-red-400">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-red-500" />
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
