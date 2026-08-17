import { useEffect, useMemo, useState } from "react"

import { getWorkspaceForHost, setWorkspaceForHost, type ElementAnnotation } from "~lib/annotations"
import { getRequests, getSessions } from "~lib/storage"
import { buildBrief, DEFAULT_BRIEF_OPTIONS, type BriefOptions } from "~lib/brief"
import type { RecordedRequest } from "~lib/types"

// ─── 任务书弹窗：选项 -> 预览 Markdown -> 复制/下载 ────────────────────────────

export interface BriefModalProps {
  annotations: ElementAnnotation[]
  onClose: () => void
}

/** 拉取最近一次录制会话的请求作为相关请求匹配池 */
async function loadRequestPool(): Promise<RecordedRequest[]> {
  try {
    const sessions = await getSessions()
    const latest = sessions[0]
    if (!latest || latest.requestIds.length === 0) return []
    const ids = latest.requestIds.slice(-300)
    const reqs = await getRequests(ids)
    return reqs.sort((a, b) => b.timestamp - a.timestamp)
  } catch {
    return []
  }
}

export default function BriefModal({ annotations, onClose }: BriefModalProps) {
  const [opts, setOpts] = useState<BriefOptions>(DEFAULT_BRIEF_OPTIONS)
  const [pool, setPool] = useState<RecordedRequest[] | null>(null)
  const [copied, setCopied] = useState(false)
  const [workspace, setWorkspace] = useState("")

  useEffect(() => {
    loadRequestPool().then(setPool)
    getWorkspaceForHost(location.host).then(setWorkspace)
  }, [])

  // 目录填入即按站点保存，下次同站点自动带出
  const handleWorkspaceChange = (v: string) => {
    setWorkspace(v)
    setWorkspaceForHost(location.host, v).catch(() => {})
  }

  const brief = useMemo(() => {
    if (pool === null) return ""
    return buildBrief(annotations, { ...opts, relatedRequests: pool, workspacePath: workspace.trim() || undefined })
  }, [annotations, opts, pool, workspace])

  const filename = useMemo(() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    return `fix-task-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.md`
  }, [])

  const handleCopy = async () => {
    if (!brief) return
    let ok = false
    try {
      await navigator.clipboard.writeText(brief)
      ok = true
    } catch {
      // 剪贴板 API 不可用时退回 execCommand
      try {
        const ta = document.createElement("textarea")
        ta.value = brief
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand("copy")
        ta.remove()
      } catch {
        ok = false
      }
    }
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    if (!brief) return
    const blob = new Blob([brief], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const setOpt = (key: keyof BriefOptions) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setOpts((prev) => ({ ...prev, [key]: e.target.checked }))
  }

  return (
    <div className="rr-an-brief-mask" onClick={onClose}>
      <div className="rr-an-brief" onClick={(e) => e.stopPropagation()}>
        <div className="rr-an-panel-header">
          <span className="rr-an-panel-title">AI 修复任务书</span>
          <button className="rr-an-icon-btn" title="关闭" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="rr-an-brief-opts">
          <label className="rr-an-check">
            <input type="checkbox" checked={opts.includeHTML} onChange={setOpt("includeHTML")} />
            元素 HTML
          </label>
          <label className="rr-an-check">
            <input type="checkbox" checked={opts.includeStyles} onChange={setOpt("includeStyles")} />
            关键样式
          </label>
          <label className="rr-an-check">
            <input
              type="checkbox"
              checked={opts.includeRequests}
              onChange={setOpt("includeRequests")}
              disabled={pool !== null && pool.length === 0}
              title={pool !== null && pool.length === 0 ? "最近一次录制会话没有请求记录" : undefined}
            />
            相关请求{pool !== null && pool.length > 0 ? `（最近会话 ${pool.length} 条）` : ""}
          </label>
        </div>

        <div className="rr-an-brief-workspace">
          <label className="rr-an-ws-label">本地代码目录</label>
          <input
            className="rr-an-ws-input"
            value={workspace}
            onChange={(e) => handleWorkspaceChange(e.target.value)}
            placeholder="如 ~/Codes/my-app（按站点记忆，写进任务书供 agent 定位仓库）"
            spellCheck={false}
          />
        </div>

        <pre className="rr-an-brief-preview">
          {pool === null ? "正在加载相关请求…" : brief}
        </pre>

        <div className="rr-an-panel-footer">
          <button className="rr-an-btn ghost" onClick={handleDownload} disabled={!brief}>
            下载 .md
          </button>
          <button className="rr-an-btn primary" onClick={handleCopy} disabled={!brief}>
            {copied ? "已复制 ✓" : "复制任务书"}
          </button>
        </div>
      </div>
    </div>
  )
}
