import type { RecordingState } from "~lib/types"

interface Props {
  state: RecordingState
  onStart: () => void
  onStop: () => void
}

export default function RecordControl({ state, onStart, onStop }: Props) {
  const { isRecording, capturedCount } = state

  return (
    <div className="px-3 pb-3 pt-3.5">
      {/* 状态行 */}
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full transition-colors ${
            isRecording
              ? "animate-pulse bg-red-500"
              : "bg-zinc-300 dark:bg-zinc-600"
          }`}
        />
        <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
          {isRecording ? "录制中" : "未录制"}
        </span>
        {isRecording && (
          <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
            已捕获{" "}
            <strong className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {capturedCount}
            </strong>{" "}
            条
          </span>
        )}
      </div>

      {/* 主按钮 */}
      <button
        onClick={isRecording ? onStop : onStart}
        className={`h-9 w-full rounded-lg text-sm font-semibold text-white shadow-sm transition-all
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] dark:focus-visible:ring-offset-zinc-900
          ${
            isRecording
              ? "bg-red-600 hover:bg-red-500 focus-visible:ring-red-500/40 dark:bg-red-600 dark:hover:bg-red-500"
              : "bg-blue-600 hover:bg-blue-500 focus-visible:ring-blue-500/40 dark:bg-blue-600 dark:hover:bg-blue-500"
          }`}>
        {isRecording ? "■ 停止录制" : "● 开始录制"}
      </button>
    </div>
  )
}
