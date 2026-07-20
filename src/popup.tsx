import { useEffect, useState } from "react"

import FilterConfig from "~components/popup/FilterConfig"
import RecordControl from "~components/popup/RecordControl"
import type { BackgroundEvent, GetStateResponse } from "~lib/messages"
import { SESSIONS_KEY } from "~lib/storage"
import type { FilterConfig as FilterConfigType, RecordingState } from "~lib/types"
import { DEFAULT_FILTER, DEFAULT_RECORDING_STATE } from "~lib/types"

export default function IndexPopup() {
  const [state, setState] = useState<RecordingState>({ ...DEFAULT_RECORDING_STATE })
  const [filter, setFilter] = useState<FilterConfigType>({ ...DEFAULT_FILTER })
  const [sessionCount, setSessionCount] = useState(0)

  useEffect(() => {
    // 获取初始状态
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (res: GetStateResponse) => {
      if (res?.state) setState(res.state)
      if (res?.filter) setFilter(res.filter)
    })

    // 加载会话数量
    chrome.storage.local.get(SESSIONS_KEY, (result) => {
      const sessions = result[SESSIONS_KEY] ?? []
      setSessionCount(sessions.length)
    })

    // 监听 background 广播
    const listener = (message: BackgroundEvent) => {
      if (message.type === "STATE_CHANGED") {
        setState(message.state)
        if (!message.state.isRecording) {
          // 录制停止后刷新会话数量
          chrome.storage.local.get(SESSIONS_KEY, (result) => {
            setSessionCount((result[SESSIONS_KEY] ?? []).length)
          })
        }
      } else if (message.type === "REQUEST_CAPTURED") {
        setState((prev) => ({ ...prev, capturedCount: message.count }))
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const handleStart = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const pageUrl = tabs[0]?.url ?? ""
      chrome.runtime.sendMessage({ type: "START_RECORDING", pageUrl })
    })
  }
  const handleStop = () => chrome.runtime.sendMessage({ type: "STOP_RECORDING" })

  const handleFilterChange = (newFilter: FilterConfigType) => {
    setFilter(newFilter)
    chrome.runtime.sendMessage({ type: "UPDATE_FILTER", filter: newFilter })
  }

  const openHistory = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
  }

  return (
    <div style={{ width: 300, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* 标题栏 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 12px 8px",
          borderBottom: "1px solid #f3f4f6"
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: state.isRecording ? "#dc2626" : "#374151",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
            <div
              style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }}
            />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
            Request Recorder
          </span>
        </div>
      </div>

      {/* 录制控制 */}
      <RecordControl state={state} onStart={handleStart} onStop={handleStop} />

      {/* 分隔线 */}
      <div style={{ height: 1, background: "#f3f4f6", margin: "0 12px" }} />

      {/* 过滤配置 */}
      <FilterConfig filter={filter} onChange={handleFilterChange} />

      {/* 分隔线 */}
      <div style={{ height: 1, background: "#f3f4f6", margin: "0 12px" }} />

      {/* 查看历史 */}
      <div style={{ padding: "10px 12px 14px" }}>
        <button
          onClick={openHistory}
          style={{
            width: "100%",
            padding: "8px 0",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            color: "#374151",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer"
          }}>
          查看历史记录{sessionCount > 0 ? `（${sessionCount} 次会话）` : ""}
        </button>
      </div>
    </div>
  )
}
