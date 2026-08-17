import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import AnnotationPanel from "~components/annotate/AnnotationPanel"
import BriefModal from "~components/annotate/BriefModal"
import NotePopup from "~components/annotate/NotePopup"
import { captureContext, requestReactSource } from "~contents/annotateContext"
import {
  annotationPageKey,
  annotationsForPage,
  appendAnnotation,
  loadAnnotations,
  saveAnnotations,
  type AnnotationTag,
  type ElementAnnotation
} from "~lib/annotations"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_end"
}

// ─── 样式（注入 Shadow DOM，与页面样式隔离）─────────────────────────────────

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    /* 悬浮入口按钮 */
    .rr-an-fab {
      position: fixed;
      bottom: 88px;
      right: 24px;
      z-index: 2147483647;
      width: 40px;
      height: 40px;
      border-radius: 9999px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: #374151;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
      outline: none;
    }
    .rr-an-fab:hover { transform: scale(1.08); background: #2563eb; }
    .rr-an-fab.active { background: #2563eb; box-shadow: 0 0 0 4px rgba(37,99,235,0.25); }
    .rr-an-fab-badge {
      position: absolute; top: -4px; right: -4px;
      min-width: 16px; height: 16px; padding: 0 4px;
      border-radius: 9999px; background: #dc2626; color: #fff;
      font-size: 10px; font-weight: 700; line-height: 16px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .rr-an-fab-tip {
      position: absolute; bottom: 46px; right: 0;
      background: #1f2937; color: #fff; font-size: 12px;
      padding: 4px 8px; border-radius: 4px; white-space: nowrap;
      pointer-events: none; opacity: 0; transition: opacity 0.15s;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .rr-an-fab:hover .rr-an-fab-tip { opacity: 1; }

    /* 圈选高亮层 */
    .rr-an-overlay {
      position: fixed;
      z-index: 2147483646;
      pointer-events: none;
      border: 2px solid #2563eb;
      background: rgba(37, 99, 235, 0.08);
      border-radius: 3px;
      display: none;
    }
    .rr-an-overlay-label {
      position: fixed;
      z-index: 2147483646;
      pointer-events: none;
      background: #2563eb;
      color: #fff;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, monospace;
      padding: 2px 6px;
      border-radius: 3px;
      max-width: 420px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: none;
    }

    /* 页面标记徽章 */
    .rr-an-marker {
      position: fixed;
      z-index: 2147483645;
      width: 20px; height: 20px;
      border-radius: 9999px;
      background: #2563eb;
      color: #fff;
      border: 2px solid #fff;
      font-size: 11px; font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35);
      user-select: none;
    }
    .rr-an-marker:hover { background: #1d4ed8; }

    /* 定位闪烁层（命令式创建，走全局兜底样式） */

    /* 通用按钮 */
    .rr-an-btn {
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid transparent;
      font-size: 13px; font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .rr-an-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .rr-an-btn.primary { background: #2563eb; color: #fff; }
    .rr-an-btn.primary:hover:not(:disabled) { background: #1d4ed8; }
    .rr-an-btn.danger { background: #dc2626; color: #fff; }
    .rr-an-btn.danger:hover:not(:disabled) { background: #b91c1c; }
    .rr-an-btn.ghost { background: #fff; color: #374151; border-color: #e5e7eb; }
    .rr-an-btn.ghost:hover:not(:disabled) { background: #f9fafb; }
    .rr-an-btn.active { box-shadow: 0 0 0 3px rgba(220,38,38,0.2); }

    .rr-an-icon-btn {
      border: none; background: transparent; cursor: pointer;
      font-size: 14px; color: #6b7280; padding: 4px 8px; border-radius: 6px;
    }
    .rr-an-icon-btn:hover { background: #f3f4f6; color: #111827; }

    /* 备注弹窗 */
    .rr-an-popup {
      position: fixed;
      z-index: 2147483647;
      width: 300px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.25);
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex; flex-direction: column; gap: 8px;
    }
    .rr-an-popup-title { font-size: 12px; font-weight: 700; color: #6b7280; }
    .rr-an-popup-el {
      font-size: 13px; font-weight: 600; color: #111827;
      background: #f3f4f6; padding: 6px 8px; border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      word-break: break-all;
    }
    .rr-an-popup-src { font-size: 11px; }
    .rr-an-popup-src.pending { color: #92400e; }
    .rr-an-popup-src.ok { color: #047857; }
    .rr-an-popup-note {
      width: 100%; box-sizing: border-box;
      border: 1px solid #e5e7eb; border-radius: 8px;
      padding: 8px; font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      resize: vertical; outline: none;
    }
    .rr-an-popup-note:focus { border-color: #2563eb; }
    .rr-an-popup-tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .rr-an-tag {
      padding: 3px 10px; border-radius: 9999px;
      border: 1px solid #e5e7eb; background: #fff;
      font-size: 12px; cursor: pointer; color: #374151;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .rr-an-tag.active { background: #2563eb; color: #fff; border-color: #2563eb; }
    .rr-an-popup-actions { display: flex; justify-content: flex-end; gap: 8px; }

    /* 侧边面板 */
    .rr-an-panel {
      position: fixed;
      top: 80px; right: 24px; bottom: 24px;
      width: 340px;
      z-index: 2147483647;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.25);
      display: flex; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      overflow: hidden;
    }
    .rr-an-panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 12px 8px;
    }
    .rr-an-panel-title { font-size: 14px; font-weight: 700; color: #111827; }
    .rr-an-panel-toolbar { padding: 0 12px 8px; display: flex; }
    .rr-an-panel-toolbar .rr-an-btn { flex: 1; }
    .rr-an-panel-list {
      flex: 1; overflow-y: auto; padding: 0 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .rr-an-empty {
      color: #9ca3af; font-size: 13px; text-align: center;
      padding: 32px 0; line-height: 1.8;
    }
    .rr-an-item {
      border: 1px solid #e5e7eb; border-radius: 10px;
      padding: 8px 10px; display: flex; flex-direction: column; gap: 6px;
    }
    .rr-an-item-head { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .rr-an-item-index {
      width: 18px; height: 18px; border-radius: 9999px; flex: none;
      background: #2563eb; color: #fff; font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .rr-an-item-tag {
      flex: none; font-size: 10px; font-weight: 700;
      padding: 1px 6px; border-radius: 9999px;
    }
    .rr-an-item-tag.tag-bug { background: #fee2e2; color: #b91c1c; }
    .rr-an-item-tag.tag-suggestion { background: #dcfce7; color: #15803d; }
    .rr-an-item-tag.tag-question { background: #fef3c7; color: #b45309; }
    .rr-an-item-tag.tag-general { background: #e0e7ff; color: #4338ca; }
    .rr-an-item-el {
      font-size: 12px; color: #374151; font-weight: 600;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .rr-an-item-src {
      flex: none; font-size: 10px; color: #047857;
      background: #ecfdf5; padding: 1px 5px; border-radius: 4px;
      max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .rr-an-item-note {
      font-size: 12px; color: #4b5563;
      white-space: pre-wrap; word-break: break-word;
      background: #f9fafb; border-radius: 6px; padding: 6px 8px;
    }
    .rr-an-item-actions { display: flex; gap: 6px; }
    .rr-an-mini {
      border: none; background: #f3f4f6; color: #374151;
      font-size: 11px; padding: 3px 8px; border-radius: 6px; cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .rr-an-mini:hover { background: #e5e7eb; }
    .rr-an-mini.danger:hover { background: #fee2e2; color: #b91c1c; }
    .rr-an-item-edit { display: flex; flex-direction: column; gap: 6px; }
    .rr-an-panel-footer {
      display: flex; gap: 8px; padding: 10px 12px 12px;
    }
    .rr-an-panel-footer .rr-an-btn { flex: 1; }

    /* 任务书弹窗 */
    .rr-an-brief-mask {
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(17, 24, 39, 0.45);
      display: flex; align-items: center; justify-content: center;
    }
    .rr-an-brief {
      width: min(620px, 92vw); max-height: 82vh;
      background: #fff; border-radius: 14px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.35);
      display: flex; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      overflow: hidden;
    }
    .rr-an-brief-opts {
      display: flex; gap: 16px; padding: 0 16px 10px;
      flex-wrap: wrap;
    }
    .rr-an-check {
      display: flex; align-items: center; gap: 5px;
      font-size: 12px; color: #374151; cursor: pointer;
    }
    .rr-an-brief-preview {
      flex: 1; overflow: auto; margin: 0;
      background: #111827; color: #e5e7eb;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px; line-height: 1.7;
      padding: 14px 16px; white-space: pre-wrap; word-break: break-word;
    }
  `
  return style
}

// ─── 主组件 ─────────────────────────────────────────────────────────────────

/** 待确认的标注草稿：线索包已采集，等用户写完备注 */
interface Draft {
  context: ElementAnnotation["context"]
  el: Element
  x: number
  y: number
  sourcePending: boolean
}

let idCounter = 0
function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `an-${Date.now()}-${idCounter++}`
}

export default function AnnotatorRoot() {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [annotations, setAnnotations] = useState<ElementAnnotation[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [briefOpen, setBriefOpen] = useState(false)
  const [, setPosTick] = useState(0)

  /** 全量标注存储（含其他页面），页面标注从中派生 */
  const allRef = useRef<ElementAnnotation[]>([])
  /** 初始加载完成标志，避免空状态覆盖已存标注 */
  const loadedRef = useRef(false)
  /** 标注 id -> 页面内实际元素（新增直接引用，恢复时按选择器解析） */
  const elementMap = useRef<Map<string, Element | null>>(new Map())

  const overlayRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<ShadowRoot | null>(null)

  const pageKey = useMemo(() => annotationPageKey(location.href), [])

  const refreshPageAnnotations = useCallback(() => {
    setAnnotations(annotationsForPage(allRef.current, location.href))
  }, [])

  /** 按选择器解析标注对应的存活元素；缓存失联时重新解析 */
  const resolveElement = useCallback((a: ElementAnnotation): Element | null => {
    const cached = elementMap.current.get(a.id)
    if (cached) {
      if (cached.isConnected) return cached
      elementMap.current.delete(a.id)
    } else if (cached === null) {
      return null
    }
    let el: Element | null = null
    try {
      const candidates = Array.from(document.querySelectorAll(a.context.selector))
      if (candidates.length === 1) {
        el = candidates[0]
      } else if (candidates.length > 1) {
        el = candidates.find((c) => c.tagName.toLowerCase() === a.context.tagName) ?? null
      }
    } catch {
      el = null
    }
    elementMap.current.set(a.id, el)
    return el
  }, [])

  // 初始化：加载标注、恢复元素引用
  useEffect(() => {
    loadAnnotations().then((all) => {
      allRef.current = all
      loadedRef.current = true
      refreshPageAnnotations()
    })
  }, [refreshPageAnnotations])

  // 持久化页面标注变化（初始加载完成前不写，避免空状态覆盖已有数据）
  useEffect(() => {
    if (!loadedRef.current) return
    // 用页面标注替换全量中同页部分
    const others = allRef.current.filter((a) => annotationPageKey(a.pageUrl) !== pageKey)
    allRef.current = [...others, ...annotations]
    saveAnnotations(allRef.current).catch(() => {})
  }, [annotations, pageKey])

  // popup 入口消息
  useEffect(() => {
    const listener = (message: { type?: string }) => {
      if (message?.type === "TOGGLE_ANNOTATE") {
        setOpen((o) => !o)
      }
    }
    try {
      chrome.runtime.onMessage.addListener(listener)
    } catch {
      // 扩展上下文失效，忽略
    }
    return () => {
      try {
        chrome.runtime.onMessage.removeListener(listener)
      } catch {
        // 忽略
      }
    }
  }, [])

  // 键盘：Alt+A 切换面板，Esc 退出圈选/草稿
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const editable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      if (e.altKey && e.code === "KeyA" && !editable) {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (e.key === "Escape") {
        if (draft) {
          setDraft(null)
          setPicking(true)
        } else if (picking) {
          setPicking(false)
        } else if (briefOpen) {
          setBriefOpen(false)
        } else {
          setOpen(false)
        }
      }
    }
    window.addEventListener("keydown", onKeydown, true)
    return () => window.removeEventListener("keydown", onKeydown, true)
  }, [draft, picking, briefOpen])

  // 圈选模式：接管鼠标移动与点击
  useEffect(() => {
    if (!picking || draft) return
    const overlay = overlayRef.current
    const label = labelRef.current
    if (!overlay || !label) return

    const inOurUI = (e: Event): boolean => {
      const path = e.composedPath()
      return hostRef.current ? path.includes(hostRef.current.host as EventTarget) : false
    }

    const onMouseMove = (e: MouseEvent) => {
      if (inOurUI(e)) {
        overlay.style.display = "none"
        label.style.display = "none"
        return
      }
      const el = (e.composedPath()[0] as Element) || e.target
      if (!(el instanceof Element)) return
      const rect = el.getBoundingClientRect()
      overlay.style.display = "block"
      overlay.style.left = `${rect.x}px`
      overlay.style.top = `${rect.y}px`
      overlay.style.width = `${rect.width}px`
      overlay.style.height = `${rect.height}px`
      label.style.display = "block"
      label.textContent = `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} ${Math.round(rect.width)}×${Math.round(rect.height)}`
      const labelY = rect.y > 26 ? rect.y - 22 : rect.y + rect.height + 4
      label.style.left = `${Math.min(rect.x, window.innerWidth - 300)}px`
      label.style.top = `${labelY}px`
    }

    const onClick = (e: MouseEvent) => {
      if (inOurUI(e)) return
      // 圈选模式下点击不落入页面（避免误触发跳转/提交）
      e.preventDefault()
      e.stopPropagation()
      const el = (e.composedPath()[0] as Element) || e.target
      if (!(el instanceof Element) || el === document.documentElement || el === document.body) return
      const rect = el.getBoundingClientRect()
      const context = captureContext(el)
      const x = Math.min(Math.max(rect.x, 8), Math.max(8, window.innerWidth - 320))
      const y = Math.min(Math.max(rect.y, 8), Math.max(8, window.innerHeight - 200))
      setDraft({ context, el, x, y, sourcePending: true })
      // 异步补 React 源码定位（仅开发模式可得）
      requestReactSource(el).then((info) => {
        setDraft((prev) =>
          prev && prev.context === context
            ? { ...prev, sourcePending: false, context: { ...context, reactSource: info } }
            : prev
        )
      })
    }

    document.addEventListener("mousemove", onMouseMove, true)
    document.addEventListener("click", onClick, true)
    const prevCursor = document.documentElement.style.cursor
    document.documentElement.style.cursor = "crosshair"

    return () => {
      document.removeEventListener("mousemove", onMouseMove, true)
      document.removeEventListener("click", onClick, true)
      document.documentElement.style.cursor = prevCursor
      overlay.style.display = "none"
      label.style.display = "none"
    }
  }, [picking, draft])

  // 标记位置随滚动/缩放刷新
  useEffect(() => {
    let raf = 0
    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        setPosTick((t) => t + 1)
      })
    }
    window.addEventListener("scroll", schedule, true)
    window.addEventListener("resize", schedule)
    return () => {
      window.removeEventListener("scroll", schedule, true)
      window.removeEventListener("resize", schedule)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // 记录 shadow host，供圈选时排除自家 UI 的点击
  useEffect(() => {
    hostRef.current = overlayRef.current?.getRootNode() as ShadowRoot | null
  }, [])

  const confirmDraft = (note: string, tag: AnnotationTag) => {
    if (!draft) return
    const annotation: ElementAnnotation = {
      id: uid(),
      note: note.trim(),
      tag,
      createdAt: Date.now(),
      pageUrl: location.href,
      pageTitle: document.title || location.hostname,
      context: draft.context
    }
    setAnnotations((prev) => [...prev, annotation])
    // 保留元素的直接引用，标记徽章不依赖选择器反查
    elementMap.current.set(annotation.id, draft.el)
    setDraft(null)
    setPicking(true) // 继续圈选，支持连续标注
  }

  const deleteAnnotation = (id: string) => {
    elementMap.current.delete(id)
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }

  const updateAnnotation = (id: string, note: string, tag: AnnotationTag) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, note, tag } : a)))
  }

  const clearPage = () => {
    for (const a of annotations) elementMap.current.delete(a.id)
    setAnnotations([])
  }

  const locateAnnotation = (id: string) => {
    const a = annotations.find((x) => x.id === id)
    if (!a) return
    const el = resolveElement(a)
    if (!el) return
    el.scrollIntoView({ block: "center", behavior: "smooth" })
    // 滚动结束后闪烁定位
    setTimeout(() => {
      const rect = el.getBoundingClientRect()
      const flash = document.createElement("div")
      flash.style.cssText = `position:fixed;z-index:2147483647;pointer-events:none;
        left:${rect.x - 4}px;top:${rect.y - 4}px;width:${rect.width + 8}px;height:${rect.height + 8}px;
        border:3px solid #f59e0b;border-radius:6px;background:rgba(245,158,11,0.12);
        transition:opacity 0.4s;`
      document.body.appendChild(flash)
      requestAnimationFrame(() => {
        flash.style.opacity = "0"
      })
      setTimeout(() => flash.remove(), 600)
    }, 350)
  }

  // 打开任务书时退出圈选
  const openBrief = () => {
    setPicking(false)
    setDraft(null)
    setBriefOpen(true)
  }

  const pageAnnotations = annotations

  return (
    <>
      {/* 悬浮入口 */}
      <button
        className={`rr-an-fab${open || picking ? " active" : ""}`}
        title="页面标注（Alt+A）"
        onClick={() => {
          if (!open && pageAnnotations.length === 0) {
            loadAnnotations().then((all) => {
              allRef.current = all
              refreshPageAnnotations()
            })
          }
          setOpen((o) => !o)
        }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        {pageAnnotations.length > 0 && (
          <span className="rr-an-fab-badge">{pageAnnotations.length}</span>
        )}
        <span className="rr-an-fab-tip">页面标注（Alt+A）</span>
      </button>

      {/* 圈选高亮层与标签 */}
      <div ref={overlayRef} className="rr-an-overlay" />
      <div ref={labelRef} className="rr-an-overlay-label" />

      {/* 页面标记徽章 */}
      {pageAnnotations.map((a, i) => {
        const el = resolveElement(a)
        if (!el) return null
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return null
        return (
          <div
            key={a.id}
            className="rr-an-marker"
            style={{ left: rect.x + rect.width - 10, top: rect.y - 10 }}
            title={a.note || a.context.elementName}
            onClick={() => setOpen(true)}>
            {i + 1}
          </div>
        )
      })}

      {/* 备注弹窗 */}
      {draft && (
        <NotePopup
          elementName={draft.context.elementName}
          sourcePending={draft.sourcePending}
          hasSource={!!draft.context.reactSource}
          x={draft.x}
          y={draft.y}
          onConfirm={confirmDraft}
          onCancel={() => {
            setDraft(null)
            setPicking(true)
          }}
        />
      )}

      {/* 侧边面板 */}
      {open && !briefOpen && (
        <AnnotationPanel
          annotations={pageAnnotations}
          picking={picking && !draft}
          onTogglePick={() => {
            setDraft(null)
            setPicking((p) => !p)
          }}
          onDelete={deleteAnnotation}
          onUpdate={updateAnnotation}
          onClear={clearPage}
          onBrief={openBrief}
          onClose={() => {
            setOpen(false)
            setPicking(false)
            setDraft(null)
          }}
          onLocate={locateAnnotation}
        />
      )}

      {/* 任务书弹窗 */}
      {briefOpen && (
        <BriefModal annotations={pageAnnotations} onClose={() => setBriefOpen(false)} />
      )}
    </>
  )
}
