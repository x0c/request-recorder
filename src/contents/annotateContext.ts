import type { ElementContext } from "~lib/annotations"

// ─── 标注域：元素线索包采集（运行在 isolated world，与 page-patcher 共享 DOM 但不共享 JS）──
// 元素标签/语义路径的提取思路与 page-patcher 的触发溯源一致，两处各自实现（page-patcher 是
// MAIN world 入口，直接 import 会连带执行 fetch/XHR 补丁，故此处独立实现精简版）。

const MAX_OUTER_HTML = 1500
const MAX_TEXT = 120

/** 只取元素自身的直接文本节点，不含子元素文字 */
function getDirectText(el: Element): string {
  let text = ""
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ""
    }
  }
  return text.trim().replace(/\s+/g, " ")
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str
}

/** 人类可读元素名：标签 + 最有意义的短标签 */
export function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const role = el.getAttribute("role")
  let label = el.getAttribute("aria-label")?.trim() ?? ""
  if (!label) label = el.getAttribute("title")?.trim() ?? ""
  if (!label && (tag === "input" || tag === "textarea")) {
    label =
      (el as HTMLInputElement).placeholder?.trim() ||
      (el as HTMLInputElement).value?.trim() ||
      ""
  }
  if (!label) label = getDirectText(el)
  if (!label) label = el.textContent?.trim().replace(/\s+/g, " ") ?? ""
  const tagWithRole = role ? `${tag}[${role}]` : tag
  return label ? `${tagWithRole} '${truncate(label, 40)}'` : tagWithRole
}

/** 判断元素是否构成语义容器边界（与录制域触发溯源同一套口径） */
function isSemanticContainer(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  if (["dialog", "section", "article", "aside", "nav", "main", "form", "fieldset"].includes(tag)) {
    return true
  }
  const role = el.getAttribute("role")
  if (role && ["dialog", "tabpanel", "region", "main", "navigation", "form", "group", "alertdialog"].includes(role)) {
    return true
  }
  const className = typeof el.className === "string" ? el.className : ""
  if (/modal|panel|drawer|sidebar|card|dialog|popup|overlay|tab-pane|tab-content|collapse|accordion|sheet/i.test(className)) {
    return true
  }
  for (const child of el.children) {
    const childTag = child.tagName.toLowerCase()
    if (/^h[1-6]$/.test(childTag) || child.getAttribute("role") === "heading") return true
  }
  return false
}

function getContainerLabel(el: Element): string | null {
  const ariaLabel = el.getAttribute("aria-label")?.trim()
  if (ariaLabel) return truncate(ariaLabel, 25)
  const labelledBy = el.getAttribute("aria-labelledby")?.trim()
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy)
    const text = labelEl?.textContent?.trim().replace(/\s+/g, " ")
    if (text) return truncate(text, 25)
  }
  for (const child of el.children) {
    const tag = child.tagName.toLowerCase()
    if (/^h[1-6]$/.test(tag) || child.getAttribute("role") === "heading") {
      const headingText = child.textContent?.trim().replace(/\s+/g, " ")
      if (headingText) return truncate(headingText, 25)
    }
  }
  const title = (el.getAttribute("title") || el.getAttribute("data-title"))?.trim()
  if (title) return truncate(title, 25)
  return null
}

/** 向上收集语义容器标签（从外到内） */
export function collectAncestorLabels(el: Element, maxDepth = 3): string[] {
  const labels: string[] = []
  let current = el.parentElement
  while (current && current !== document.body && current !== document.documentElement) {
    if (isSemanticContainer(current)) {
      const label = getContainerLabel(current)
      if (label) {
        labels.unshift(label)
        if (labels.length >= maxDepth) break
      }
    }
    current = current.parentElement
  }
  return labels
}

/** 生成唯一性尽量好的 CSS 选择器 */
export function buildSelector(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el
  while (current && current !== document.documentElement && parts.length < 6) {
    let part = current.tagName.toLowerCase()
    const id = current.id
    if (id) {
      // id 含特殊字符时用属性选择器保底
      part += /^[A-Za-z][\w-]*$/.test(id) ? `#${id}` : `[id="${cssEscape(id)}"]`
      parts.unshift(part)
      break
    }
    const parent: Element | null = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === current!.tagName)
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(current) + 1})`
      }
    }
    parts.unshift(part)
    current = parent
  }
  return parts.join(" > ")
}

function cssEscape(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/** DOM 完整路径（childIndex 链） */
export function buildDomPath(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el
  while (current && current !== document.documentElement) {
    const parent: Element | null = current.parentElement
    if (parent) {
      parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${Array.from(parent.children).indexOf(current) + 1})`)
    } else {
      parts.unshift(current.tagName.toLowerCase())
    }
    current = parent
  }
  return "html > " + parts.join(" > ")
}

/** 从 documentElement 起的 childIndex 链（跨 world 定位元素用） */
export function childIndexPath(el: Element): number[] {
  const path: number[] = []
  let current: Element | null = el
  while (current && current !== document.documentElement) {
    const parent: Element | null = current.parentElement
    if (!parent) break
    path.unshift(Array.from(parent.children).indexOf(current))
    current = parent
  }
  return path
}

/** 剔除 CSS-in-JS / CSS Modules 的 hash 类名，保留有语义的 */
function meaningfulClasses(el: Element): string[] {
  const className = typeof el.className === "string" ? el.className : ""
  return className
    .split(/\s+/)
    .filter(Boolean)
    .filter(
      (c) =>
        !/^(css|sc|jsx|chakra|emotion)-/i.test(c) && // styled-components / emotion 前缀
        !c.includes("__") && // CSS Modules：styles_button__2Xt9
        !/^[0-9a-f]{6,}$/i.test(c) && // 纯 hash
        !/^_.+[_-]\w+$/i.test(c) && // Vue scoped / css-modules 变体
        c.length <= 40
    )
    .slice(0, 8)
}

/** 有意义的属性子集 */
function usefulAttributes(el: Element): Record<string, string> {
  const wanted = ["id", "name", "type", "href", "placeholder", "data-testid", "data-test", "data-id", "role", "aria-label", "title", "alt", "for", "action"]
  const attrs: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) {
    if (wanted.includes(attr.name.toLowerCase()) && attr.value) {
      attrs[attr.name] = truncate(attr.value, 80)
    }
  }
  return attrs
}

/** 关键计算样式子集（颜色/字体/间距/边框） */
function keyStyles(el: Element): Record<string, string> {
  const cs = window.getComputedStyle(el)
  const props = [
    "color", "background-color", "font-size", "font-weight", "line-height",
    "padding", "margin", "border", "border-radius", "display", "flex-direction",
    "gap", "width", "height", "overflow", "text-overflow", "white-space", "opacity"
  ]
  const out: Record<string, string> = {}
  for (const p of props) {
    const v = cs.getPropertyValue(p)
    if (v && v !== "none" && !(p === "opacity" && v === "1")) out[p] = truncate(v, 60)
  }
  return out
}

/** 同步采集元素线索包（React 源码定位是异步 RPC，由调用方补填） */
export function captureContext(el: Element): ElementContext {
  const rect = el.getBoundingClientRect()
  const prev = el.previousElementSibling?.textContent?.trim().replace(/\s+/g, " ")
  const next = el.nextElementSibling?.textContent?.trim().replace(/\s+/g, " ")
  let outerHTML = ""
  try {
    outerHTML = el.outerHTML
  } catch {
    outerHTML = ""
  }
  return {
    elementName: describeElement(el),
    tagName: el.tagName.toLowerCase(),
    ancestorLabels: collectAncestorLabels(el),
    selector: buildSelector(el),
    domPath: buildDomPath(el),
    text: el.textContent ? truncate(el.textContent.trim().replace(/\s+/g, " "), MAX_TEXT) || null : null,
    ariaRole: el.getAttribute("role"),
    ariaLabel: el.getAttribute("aria-label"),
    classes: meaningfulClasses(el),
    attributes: usefulAttributes(el),
    position: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
    computedStyles: keyStyles(el),
    siblingText: {
      prev: prev ? truncate(prev, 60) : null,
      next: next ? truncate(next, 60) : null
    },
    outerHTML: truncate(outerHTML, MAX_OUTER_HTML),
    reactSource: null
  }
}

// ─── 源码定位 RPC（page-patcher 在 MAIN world 代读 React fiber）───────────────

const pendingSource = new Map<string, (info: ElementContext["reactSource"]) => void>()

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.source !== "rr-page") return
  if (event.data.event !== "sourceLocated") return
  const { requestId, info } = event.data
  const resolve = pendingSource.get(requestId)
  if (resolve) {
    pendingSource.delete(requestId)
    resolve(info ?? null)
  }
})

/** 请求元素的 React 源码定位，2s 超时返回 null（生产构建/非 React 页面） */
export function requestReactSource(el: Element): Promise<ElementContext["reactSource"]> {
  return new Promise((resolve) => {
    let settled = false
    const done = (info: ElementContext["reactSource"]) => {
      if (settled) return
      settled = true
      resolve(info)
    }
    const requestId = `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    pendingSource.set(requestId, done)
    setTimeout(() => {
      if (pendingSource.delete(requestId)) done(null)
    }, 2000)
    window.postMessage(
      { source: "rr-annotate", event: "locateSource", requestId, path: childIndexPath(el) },
      "*"
    )
  })
}
