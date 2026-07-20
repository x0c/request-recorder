import { useEffect, useState } from "react"

import RequestList from "~components/history/RequestList"
import SessionList from "~components/history/SessionList"
import { deleteSession, getRequests, getSessions, SESSIONS_KEY } from "~lib/storage"
import type { RecordedRequest, RecordingSession } from "~lib/types"

import "~style.css"

export default function HistoryPage() {
  const [sessions, setSessions] = useState<RecordingSession[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [requests, setRequests] = useState<RecordedRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [reqLoading, setReqLoading] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [])

  // 录制中 sessions 会持续更新：监听 storage 变化实时刷新列表与当前会话的请求
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "local" || !changes[SESSIONS_KEY]) return
      void reloadCurrent()
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  /** 实时刷新：保留当前选中会话，仅同步数据 */
  const reloadCurrent = async () => {
    const list = await getSessions()
    setSessions(list)
    const target = list.find((s) => s.id === selectedId) ?? list[0]
    if (target) {
      setSelectedId(target.id)
      const reqs = await getRequests(target.requestIds)
      setRequests(reqs)
    } else {
      setSelectedId(null)
      setRequests([])
    }
  }

  const loadSessions = async () => {
    setLoading(true)
    const list = await getSessions()
    setSessions(list)
    setLoading(false)
    if (list.length > 0) {
      await selectSession(list[0].id, list)
    }
  }

  const selectSession = async (id: string, list?: RecordingSession[]) => {
    setSelectedId(id)
    setReqLoading(true)
    const sessionList = list ?? sessions
    const session = sessionList.find((s) => s.id === id)
    if (session) {
      const reqs = await getRequests(session.requestIds)
      setRequests(reqs)
    }
    setReqLoading(false)
  }

  const handleDelete = async (id: string) => {
    await deleteSession(id)
    const newSessions = sessions.filter((s) => s.id !== id)
    setSessions(newSessions)
    if (selectedId === id) {
      if (newSessions.length > 0) {
        await selectSession(newSessions[0].id, newSessions)
      } else {
        setSelectedId(null)
        setRequests([])
      }
    }
  }

  const selectedSession = sessions.find((s) => s.id === selectedId)

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        background: "#fff"
      }}>
      {/* 左侧会话列表 */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column"
        }}>
        <div
          style={{
            padding: "14px 14px 10px",
            fontWeight: 700,
            fontSize: 14,
            color: "#111827",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#374151",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
          </div>
          Request Recorder
        </div>
        {loading ? (
          <div style={{ padding: 16, color: "#9ca3af", fontSize: 13 }}>加载中…</div>
        ) : (
          <SessionList
            sessions={sessions}
            selectedId={selectedId}
            onSelect={(id) => selectSession(id)}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* 右侧请求列表 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {reqLoading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9ca3af",
              fontSize: 13
            }}>
            加载中…
          </div>
        ) : selectedSession ? (
          <RequestList session={selectedSession} requests={requests} />
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9ca3af",
              fontSize: 13
            }}>
            请在左侧选择一次录制会话
          </div>
        )}
      </div>
    </div>
  )
}
