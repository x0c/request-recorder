import { useEffect, useRef, useState } from "react"

import { TAG_LABELS, type AnnotationTag } from "~lib/annotations"

// ─── 标注备注弹窗：选中元素后就近弹出，填写备注与分类 ──────────────────────────

export interface NotePopupProps {
  elementName: string
  /** 源码定位是否仍在读取中 */
  sourcePending: boolean
  hasSource: boolean
  x: number
  y: number
  onConfirm: (note: string, tag: AnnotationTag) => void
  onCancel: () => void
}

const TAGS: AnnotationTag[] = ["bug", "suggestion", "question", "general"]

export default function NotePopup({
  elementName,
  sourcePending,
  hasSource,
  x,
  y,
  onConfirm,
  onCancel
}: NotePopupProps) {
  const [note, setNote] = useState("")
  const [tag, setTag] = useState<AnnotationTag>("bug")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const left = Math.min(Math.max(8, x), window.innerWidth - 320)
  const top = Math.min(Math.max(8, y), window.innerHeight - 190)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape 在根层统一处理取消，这里阻止冒泡避免误关面板
    if (e.key === "Escape") {
      e.stopPropagation()
      onCancel()
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onConfirm(note, tag)
    }
  }

  return (
    <div className="rr-an-popup" style={{ left, top }} onKeyDown={handleKeyDown}>
      <div className="rr-an-popup-title">标注元素</div>
      <div className="rr-an-popup-el">{elementName}</div>
      {sourcePending && <div className="rr-an-popup-src pending">正在读取源码定位…</div>}
      {!sourcePending && hasSource && <div className="rr-an-popup-src ok">✓ 已捕获源码定位</div>}
      <textarea
        ref={textareaRef}
        className="rr-an-popup-note"
        placeholder="这里有什么问题？想怎么改？（⌘+Enter 保存）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
      />
      <div className="rr-an-popup-tags">
        {TAGS.map((t) => (
          <button
            key={t}
            className={`rr-an-tag${tag === t ? " active" : ""}`}
            onClick={() => setTag(t)}>
            {TAG_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="rr-an-popup-actions">
        <button className="rr-an-btn ghost" onClick={onCancel}>
          取消
        </button>
        <button className="rr-an-btn primary" onClick={() => onConfirm(note, tag)}>
          保存标注
        </button>
      </div>
    </div>
  )
}
