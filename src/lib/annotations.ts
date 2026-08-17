// ─── 页面标注域：类型定义与存储 ────────────────────────────────────────────────

/** 标注分类，沿用评审工单的常见分类 */
export type AnnotationTag = "bug" | "suggestion" | "question" | "general"

export const TAG_LABELS: Record<AnnotationTag, string> = {
  bug: "缺陷",
  suggestion: "建议",
  question: "疑问",
  general: "一般"
}

/** 标注时采集的元素线索包：让不熟悉页面源码的 AI 也能定位到元素 */
export interface ElementContext {
  /** 人类可读的元素名，如 "Button '保存'" */
  elementName: string
  tagName: string
  /** 语义路径（从外到内的容器标签），如 ["系统设置", "基础配置"] */
  ancestorLabels: string[]
  /** 唯一性尽量好的 CSS 选择器 */
  selector: string
  /** 完整 DOM 路径 */
  domPath: string
  /** 元素可见文字（截断） */
  text: string | null
  /** 无障碍角色 */
  ariaRole: string | null
  /** aria-label */
  ariaLabel: string | null
  /** class 列表（剔除框架 hash 后、截断） */
  classes: string[]
  /** 有意义的属性子集（aria/data/id/name/type/href 等） */
  attributes: Record<string, string>
  /** 视口内位置与尺寸 */
  position: { x: number; y: number; width: number; height: number }
  /** 关键计算样式（颜色/字体/间距/边框等） */
  computedStyles: Record<string, string>
  /** 前后兄弟元素的文字（上下文线索） */
  siblingText: { prev: string | null; next: string | null }
  /** 截断后的元素 HTML */
  outerHTML: string
  /** 源码定位（仅 React 开发模式可用，生产构建为 null） */
  reactSource: { fileName: string; lineNumber: number; componentName: string | null } | null
}

/** 一条页面标注 */
export interface ElementAnnotation {
  id: string
  /** 用户备注 */
  note: string
  tag: AnnotationTag
  createdAt: number
  pageUrl: string
  pageTitle: string
  context: ElementContext
}

export const ANNOTATIONS_KEY = "rr:annotations"
/** 全局保留上限，超出时按页面键从最旧页面整组清理 */
export const MAX_ANNOTATION_PAGES = 30
/** 单页标注数上限 */
export const MAX_ANNOTATIONS_PER_PAGE = 50

/** 标注按 origin+path 分组存储 */
export function annotationPageKey(url: string): string {
  try {
    const u = new URL(url)
    return u.origin + u.pathname
  } catch {
    return url
  }
}

/** 从扁平数组中取出当前页面的标注 */
export function annotationsForPage(
  all: ElementAnnotation[],
  pageUrl: string
): ElementAnnotation[] {
  const key = annotationPageKey(pageUrl)
  return all.filter((a) => annotationPageKey(a.pageUrl) === key)
}

/** 追加标注（含单页与全局容量清理），返回新的扁平数组 */
export function appendAnnotation(
  all: ElementAnnotation[],
  annotation: ElementAnnotation
): ElementAnnotation[] {
  const key = annotationPageKey(annotation.pageUrl)
  const samePage = all.filter((a) => annotationPageKey(a.pageUrl) === key)
  const others = all.filter((a) => annotationPageKey(a.pageUrl) !== key)
  const updatedPage = [...samePage, annotation]
  if (updatedPage.length > MAX_ANNOTATIONS_PER_PAGE) {
    updatedPage.splice(0, updatedPage.length - MAX_ANNOTATIONS_PER_PAGE)
  }
  let next = [...others, ...updatedPage]
  if (next.length > MAX_ANNOTATION_PAGES * MAX_ANNOTATIONS_PER_PAGE) {
    // 按创建时间从旧到新丢弃
    next = next.sort((a, b) => a.createdAt - b.createdAt).slice(-MAX_ANNOTATION_PAGES * MAX_ANNOTATIONS_PER_PAGE)
  }
  return next
}

// ─── 存储读写 ────────────────────────────────────────────────────────────────

export async function loadAnnotations(): Promise<ElementAnnotation[]> {
  const result = await chrome.storage.local.get(ANNOTATIONS_KEY)
  return (result[ANNOTATIONS_KEY] as ElementAnnotation[]) ?? []
}

export async function saveAnnotations(all: ElementAnnotation[]): Promise<void> {
  await chrome.storage.local.set({ [ANNOTATIONS_KEY]: all })
}
