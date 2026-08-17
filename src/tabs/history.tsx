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
    <div className="flex h-screen bg-white font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* 左侧会话列表 */}
      <div className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3.5 dark:border-zinc-800">
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-zinc-700 shadow-sm dark:bg-zinc-600">
            <span className="h-[6px] w-[6px] rounded-full bg-white" />
          </span>
          <span className="text-sm font-bold tracking-tight">Request Recorder</span>
        </div>
        {loading ? (
          <div className="p-4 text-[13px] text-zinc-400 dark:text-zinc-500">加载中…</div>
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
      <div className="flex min-w-0 flex-1 flex-col">
        {reqLoading ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-zinc-400 dark:text-zinc-500">
            加载中…
          </div>
        ) : selectedSession ? (
          <RequestList session={selectedSession} requests={requests} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <svg
              viewBox="0 0 48 48"
              className="h-14 w-14 text-zinc-200 dark:text-zinc-800"
              fill="none">
              <circle cx="24" cy="24" r="19" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="24" cy="24" r="7" fill="currentColor" />
            </svg>
            <p className="text-[13px] text-zinc-400 dark:text-zinc-500">
              请在左侧选择一次录制会话
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
