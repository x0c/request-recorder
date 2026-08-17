import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useRef, useState } from "react"

import type { BackgroundEvent } from "~lib/messages"
import type { RecordingState } from "~lib/types"
import { DEFAULT_RECORDING_STATE } from "~lib/types"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_end"
}

// 注入 Tailwind 样式到 Shadow DOM
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    .rr-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      width: 52px;
      height: 52px;
      border-radius: 9999px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.14);
      transition: transform 0.15s, box-shadow 0.15s;
      outline: none;
      flex-direction: column;
      gap: 1px;
      color: #fff;
    }
    .rr-btn:hover {
      transform: translateY(-1px) scale(1.06);
      box-shadow: 0 8px 20px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.18);
    }
    .rr-btn:active {
      transform: scale(0.96);
    }
    .rr-btn.idle {
      background: #27272a;
    }
    .rr-btn.recording {
      background: #dc2626;
      animation: rr-pulse 1.8s ease-in-out infinite;
    }
    @keyframes rr-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.5); }
      50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); }
    }
    .rr-dot {
      width: 10px;
      height: 10px;
      border-radius: 9999px;
      background: currentColor;
    }
    .rr-tooltip {
      position: absolute;
      bottom: 58px;
      right: 0;
      background: rgba(24,24,27,0.92);
      color: #fff;
      font-size: 12px;
      padding: 5px 10px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .rr-wrap:hover .rr-tooltip {
      opacity: 1;
    }
    .rr-wrap {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
    }
    .rr-view-btn {
      position: fixed;
      bottom: 24px;
      right: 84px;
      z-index: 2147483647;
      height: 52px;
      padding: 0 18px;
      border-radius: 9999px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      color: #fff;
      background: rgba(24,24,27,0.9);
      box-shadow: 0 4px 14px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.12);
      -webkit-backdrop-filter: blur(6px);
      backdrop-filter: blur(6px);
      transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
      outline: none;
      white-space: nowrap;
    }
    .rr-view-btn:hover {
      transform: translateY(-1px) scale(1.05);
      box-shadow: 0 8px 20px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.16);
    }
    .rr-view-btn:active {
      transform: scale(0.97);
    }
    .rr-view-btn.fade-out {
      opacity: 0;
      pointer-events: none;
    }
  `
  return style
}

export default function FloatingRecordButton() {
  const [state, setState] = useState<RecordingState>({ ...DEFAULT_RECORDING_STATE })
  const [visible, setVisible] = useState(false)
  const [showView, setShowView] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const prevRecording = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // 获取初始状态
    try {
      chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
        if (chrome.runtime.lastError) {
          // 扩展上下文已失效，忽略错误
          setVisible(true)
          return
        }
        if (res?.state) {
          setState(res.state)
          prevRecording.current = res.state.isRecording
        }
        setVisible(true)
      })
    } catch {
      // 扩展上下文已失效，不显示按钮
      return
    }

    // 监听 background 广播
    const listener = (message: BackgroundEvent) => {
      if (message.type === "STATE_CHANGED") {
        const wasRecording = prevRecording.current
        const isNowRecording = message.state.isRecording
        // 录制刚结束，显示"查看"按钮 3 秒
        if (wasRecording && !isNowRecording) {
          if (timerRef.current) clearTimeout(timerRef.current)
          if (fadeRef.current) clearTimeout(fadeRef.current)
          setFadeOut(false)
          setShowView(true)
          // 2.7s 后开始淡出
          fadeRef.current = setTimeout(() => setFadeOut(true), 2700)
          // 3s 后隐藏
          timerRef.current = setTimeout(() => {
            setShowView(false)
            setFadeOut(false)
          }, 3000)
        }
        prevRecording.current = isNowRecording
        setState(message.state)
      } else if (message.type === "REQUEST_CAPTURED") {
        setState((prev) => ({ ...prev, capturedCount: message.count }))
      }
    }

    try {
      chrome.runtime.onMessage.addListener(listener)
    } catch {
      // 扩展上下文已失效，忽略
    }
    return () => {
      try {
        chrome.runtime.onMessage.removeListener(listener)
      } catch {
        // 扩展上下文已失效，忽略
      }
      if (timerRef.current) clearTimeout(timerRef.current)
      if (fadeRef.current) clearTimeout(fadeRef.current)
    }
  }, [])

  if (!visible) return null

  const handleClick = () => {
    try {
      if (state.isRecording) {
        chrome.runtime.sendMessage({ type: "STOP_RECORDING" })
      } else {
        chrome.runtime.sendMessage({ type: "START_RECORDING", pageUrl: window.location.href })
      }
    } catch {
      // 扩展上下文已失效，忽略
    }
  }

  const handleViewClick = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (fadeRef.current) clearTimeout(fadeRef.current)
    setShowView(false)
    try {
      chrome.runtime.sendMessage({ type: "OPEN_HISTORY" })
    } catch {
      // 扩展上下文已失效，忽略
    }
  }

  return (
    <div className="rr-wrap">
      {showView && (
        <button
          className={`rr-view-btn${fadeOut ? " fade-out" : ""}`}
          onClick={handleViewClick}>
          查看
        </button>
      )}
      <span className="rr-tooltip">
        {state.isRecording ? "停止录制" : "开始录制"}
      </span>
      <button
        className={`rr-btn ${state.isRecording ? "recording" : "idle"}`}
        onClick={handleClick}
        title={state.isRecording ? "停止录制" : "开始录制"}>
        <div className="rr-dot" />
        {state.isRecording && state.capturedCount > 0 && (
          <span>{state.capturedCount}</span>
        )}
      </button>
    </div>
  )
}
