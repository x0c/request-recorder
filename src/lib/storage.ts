import type { FilterConfig, RecordedRequest, RecordingSession } from "./types"
import { DEFAULT_FILTER } from "./types"

// ─── Storage Key 常量 ────────────────────────────────────────────────────────

export const SESSIONS_KEY = "rr:sessions"
export const FILTER_CONFIG_KEY = "rr:filter"
export const MAX_SESSIONS = 50

export const requestKey = (id: string) => `rr:req:${id}`

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function getSessions(): Promise<RecordingSession[]> {
  const result = await chrome.storage.local.get(SESSIONS_KEY)
  return (result[SESSIONS_KEY] as RecordingSession[]) ?? []
}

export async function saveSessions(sessions: RecordingSession[]): Promise<void> {
  await chrome.storage.local.set({ [SESSIONS_KEY]: sessions })
}

export async function addSession(session: RecordingSession): Promise<void> {
  const sessions = await getSessions()
  sessions.unshift(session)
  // 超出上限时删除最旧的会话及其请求数据
  if (sessions.length > MAX_SESSIONS) {
    const removed = sessions.splice(MAX_SESSIONS)
    const keysToDelete: string[] = []
    for (const s of removed) {
      for (const id of s.requestIds) {
        keysToDelete.push(requestKey(id))
      }
    }
    if (keysToDelete.length > 0) {
      await chrome.storage.local.remove(keysToDelete)
    }
  }
  await saveSessions(sessions)
}

export async function updateSession(
  sessionId: string,
  patch: Partial<RecordingSession>
): Promise<void> {
  const sessions = await getSessions()
  const idx = sessions.findIndex((s) => s.id === sessionId)
  if (idx !== -1) {
    sessions[idx] = { ...sessions[idx], ...patch }
    await saveSessions(sessions)
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await getSessions()
  const session = sessions.find((s) => s.id === sessionId)
  if (!session) return

  // 删除请求详情
  const keysToDelete = session.requestIds.map(requestKey)
  if (keysToDelete.length > 0) {
    await chrome.storage.local.remove(keysToDelete)
  }

  await saveSessions(sessions.filter((s) => s.id !== sessionId))
}

// ─── Requests ────────────────────────────────────────────────────────────────

export async function saveRequest(request: RecordedRequest): Promise<void> {
  await chrome.storage.local.set({ [requestKey(request.id)]: request })
}

export async function getRequests(
  requestIds: string[]
): Promise<RecordedRequest[]> {
  if (requestIds.length === 0) return []
  const keys = requestIds.map(requestKey)
  const result = await chrome.storage.local.get(keys)
  return requestIds
    .map((id) => result[requestKey(id)] as RecordedRequest | undefined)
    .filter((r): r is RecordedRequest => r !== undefined)
}

// ─── Filter Config ────────────────────────────────────────────────────────────

export async function getFilterConfig(): Promise<FilterConfig> {
  const result = await chrome.storage.local.get(FILTER_CONFIG_KEY)
  return (result[FILTER_CONFIG_KEY] as FilterConfig) ?? DEFAULT_FILTER
}

export async function saveFilterConfig(filter: FilterConfig): Promise<void> {
  await chrome.storage.local.set({ [FILTER_CONFIG_KEY]: filter })
}
