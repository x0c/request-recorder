import type { RecordingState } from "~lib/types"

interface Props {
  state: RecordingState
  onStart: () => void
  onStop: () => void
}

export default function RecordControl({ state, onStart, onStop }: Props) {
  const { isRecording, capturedCount } = state

  return (
    <div style={{ padding: "16px 12px 12px" }}>
      {/* 状态行 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 10
        }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isRecording ? "#dc2626" : "#9ca3af",
            animation: isRecording ? "pulse 1.8s ease-in-out infinite" : "none"
          }}
        />
        <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
          {isRecording ? "录制中" : "未录制"}
        </span>
        {isRecording && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 12,
              color: "#6b7280"
            }}>
            已捕获{" "}
            <strong style={{ color: "#111827" }}>{capturedCount}</strong> 条
          </span>
        )}
      </div>

      {/* 主按钮 */}
      <button
        onClick={isRecording ? onStop : onStart}
        style={{
          width: "100%",
          padding: "9px 0",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          color: "#fff",
          background: isRecording ? "#dc2626" : "#2563eb",
          transition: "background 0.15s"
        }}>
        {isRecording ? "■ 停止录制" : "● 开始录制"}
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
