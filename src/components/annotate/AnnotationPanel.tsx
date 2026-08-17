import { useEffect, useRef, useState } from "react"

import { TAG_LABELS, type AnnotationTag, type ElementAnnotation } from "~lib/annotations"

// ─── 标注面板：当前页标注列表 + 模式开关 + 任务书入口 ──────────────────────────

export interface AnnotationPanelProps {
  annotations: ElementAnnotation[]
  picking: boolean
  onTogglePick: () => void
  onDelete: (id: string) => void
  onUpdate: (id: string, note: string, tag: AnnotationTag) => void
  onClear: () => void
  onBrief: () => void
  onClose: () => void
  onLocate: (id: string) => void
}

const TAGS: AnnotationTag[] = ["bug", "suggestion", "question", "general"]

export default function AnnotationPanel({
  annotations,
  picking,
  onTogglePick,
  onDelete,
  onUpdate,
  onClear,
  onBrief,
  onClose,
  onLocate
}: AnnotationPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState("")
  const [editTag, setEditTag] = useState<AnnotationTag>("bug")
  const listRef = useRef<HTMLDivElement>(null)

  // 新增标注后滚到底部
  useEffect(() => {
    if (listRef.current && editingId === null) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [annotations.length])

  const startEdit = (a: ElementAnnotation) => {
    setEditingId(a.id)
    setEditNote(a.note)
    setEditTag(a.tag)
  }

  return (
    <div className="rr-an-panel">
      <div className="rr-an-panel-header">
        <span className="rr-an-panel-title">
          页面标注{annotations.length > 0 ? `（${annotations.length}）` : ""}
        </span>
        <button className="rr-an-icon-btn" title="关闭" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="rr-an-panel-toolbar">
        <button
          className={`rr-an-btn ${picking ? "danger active" : "primary"}`}
          onClick={onTogglePick}>
          {picking ? "退出圈选（Esc）" : "⊕ 圈选元素"}
        </button>
      </div>

      <div className="rr-an-panel-list" ref={listRef}>
        {annotations.length === 0 && (
          <div className="rr-an-empty">
            还没有标注。
            <br />
            点击「圈选元素」后在页面上
            <br />
            点选要反馈的元素并写备注。
          </div>
        )}
        {annotations.map((a, i) => {
          const isEditing = editingId === a.id
          return (
            <div key={a.id} className={`rr-an-item tag-${a.tag}`}>
              <div className="rr-an-item-head">
                <span className="rr-an-item-index">{i + 1}</span>
                <span className={`rr-an-item-tag tag-${a.tag}`}>{TAG_LABELS[a.tag]}</span>
                <span className="rr-an-item-el" title={a.context.elementName}>
                  {a.context.elementName}
                </span>
                {a.context.reactSource && (
                  <span className="rr-an-item-src" title={`${a.context.reactSource.fileName}:${a.context.reactSource.lineNumber}`}>
                    📍{a.context.reactSource.fileName.split("/").pop()}
                  </span>
                )}
              </div>
              {isEditing ? (
                <div className="rr-an-item-edit">
                  <textarea
                    className="rr-an-popup-note"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                  <div className="rr-an-popup-tags">
                    {TAGS.map((t) => (
                      <button
                        key={t}
                        className={`rr-an-tag${editTag === t ? " active" : ""}`}
                        onClick={() => setEditTag(t)}>
                        {TAG_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  <div className="rr-an-popup-actions">
                    <button className="rr-an-btn ghost" onClick={() => setEditingId(null)}>
                      取消
                    </button>
                    <button
                      className="rr-an-btn primary"
                      onClick={() => {
                        onUpdate(a.id, editNote, editTag)
                        setEditingId(null)
                      }}>
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {a.note && <div className="rr-an-item-note">{a.note}</div>}
                  <div className="rr-an-item-actions">
                    <button className="rr-an-mini" title="在页面上定位该元素" onClick={() => onLocate(a.id)}>
                      定位
                    </button>
                    <button className="rr-an-mini" onClick={() => startEdit(a)}>
                      编辑
                    </button>
                    <button className="rr-an-mini danger" onClick={() => onDelete(a.id)}>
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="rr-an-panel-footer">
        <button
          className="rr-an-btn ghost"
          disabled={annotations.length === 0}
          onClick={onClear}>
          清空本页
        </button>
        <button
          className="rr-an-btn primary"
          disabled={annotations.length === 0}
          onClick={onBrief}>
          生成任务书
        </button>
      </div>
    </div>
  )
}
