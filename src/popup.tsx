import { useEffect, useState } from "react"

import FilterConfig from "~components/popup/FilterConfig"
import RecordControl from "~components/popup/RecordControl"
import type { BackgroundEvent, GetStateResponse } from "~lib/messages"
import { SESSIONS_KEY } from "~lib/storage"
import type { FilterConfig as FilterConfigType, RecordingState } from "~lib/types"
import { DEFAULT_FILTER, DEFAULT_RECORDING_STATE } from "~lib/types"

import "~style.css"

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

  // 在当前页唤出/收起标注面板
  const toggleAnnotate = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id != null) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_ANNOTATE" }, () => {
          void chrome.runtime.lastError // 页面无接收方时静默忽略
        })
      }
    })
    window.close()
  }

  return (
    <div className="w-80 bg-white font-sans text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full shadow-sm transition-colors ${
              state.isRecording ? "bg-red-600" : "bg-zinc-700 dark:bg-zinc-600"
            }`}>
            <span className="h-[7px] w-[7px] rounded-full bg-white" />
          </span>
          <span className="text-sm font-bold tracking-tight">Request Recorder</span>
        </div>
        {state.isRecording && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            REC
          </span>
        )}
      </div>

      {/* 录制控制 */}
      <RecordControl state={state} onStart={handleStart} onStop={handleStop} />

      {/* 分隔线 */}
      <div className="mx-3 h-px bg-zinc-100 dark:bg-zinc-800" />

      {/* 过滤配置 */}
      <FilterConfig filter={filter} onChange={handleFilterChange} />

      {/* 分隔线 */}
      <div className="mx-3 h-px bg-zinc-100 dark:bg-zinc-800" />

      {/* 查看历史 + 页面标注 */}
      <div className="flex gap-2 px-3 pb-3.5 pt-3">
        <button
          onClick={openHistory}
          className="h-9 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 text-[13px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800">
          历史记录{sessionCount > 0 ? `（${sessionCount}）` : ""}
        </button>
        <button
          onClick={toggleAnnotate}
          className="h-9 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 text-[13px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800">
          ✎ 页面标注
        </button>
      </div>
    </div>
  )
}
