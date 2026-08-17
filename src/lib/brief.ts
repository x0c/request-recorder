import { TAG_LABELS, type ElementAnnotation } from "./annotations"
import type { RecordedRequest } from "./types"

// ─── 标注域：AI 修复任务书生成 ────────────────────────────────────────────────

export interface BriefOptions {
  /** 包含元素 HTML 片段 */
  includeHTML: boolean
  /** 包含关键计算样式 */
  includeStyles: boolean
  /** 附带按触发来源匹配的相关请求记录 */
  includeRequests: boolean
  /** 相关请求从最近一次录制会话中取 */
  relatedRequests: RecordedRequest[]
  /** 页面对应的本地代码目录（可选，agent 从这里进入改代码） */
  workspacePath?: string
}

export const DEFAULT_BRIEF_OPTIONS: BriefOptions = {
  includeHTML: true,
  includeStyles: true,
  includeRequests: true,
  relatedRequests: []
}

/** 单条相关请求的简要描述 */
function requestLine(req: RecordedRequest): string {
  let shortUrl = req.url
  try {
    const u = new URL(req.url)
    shortUrl = u.pathname + u.search
  } catch {}
  const status = req.error ?? (req.status ?? "?")
  const duration = req.duration != null ? `${(req.duration / 1000).toFixed(2)}s` : "?"
  const trigger = req.triggerInfo ? `，触发来源：${req.triggerInfo.description}` : ""
  const lines = [`- \`${req.method} ${shortUrl}\` -> ${status}（${duration}）${trigger}`]
  if (req.responseBody) {
    const body = req.responseBody.length > 300 ? req.responseBody.slice(0, 300) + "…" : req.responseBody
    lines.push(`  - 响应体：\`${body.replace(/\n/g, " ")}\``)
  }
  return lines.join("\n")
}

/** 生成整页修复任务书（Markdown） */
export function buildBrief(
  annotations: ElementAnnotation[],
  opts: BriefOptions
): string {
  const first = annotations[0]
  const lines: string[] = []
  lines.push(`# 页面修复任务：${first?.pageTitle || "未命名页面"}`)
  lines.push("")
  lines.push(`- 页面地址：${first?.pageUrl ?? ""}`)
  if (opts.workspacePath) {
    lines.push(`- 本地代码目录：\`${opts.workspacePath}\``)
  }
  lines.push(`- 标注数量：${annotations.length} 处`)
  lines.push(`- 生成时间：${new Date().toLocaleString("zh-CN")}`)
  lines.push("")
  lines.push(
    "> 以下标注来自浏览器页面上的圈选。浏览器中的 DOM 经 SSR/编译后可能与源码不同，" +
      "请综合语义路径、可见文字、CSS 选择器等线索在源码中定位对应组件；" +
      "「源码定位」仅在 React 开发模式下可得，为空时请以线索反查。" +
      (opts.workspacePath ? "请在上述本地代码目录内检索与修改，不要改动目录外文件。" : "")
  )
  lines.push("")

  annotations.forEach((a, i) => {
    const c = a.context
    lines.push(`## 标注 ${i + 1}【${TAG_LABELS[a.tag]}】${c.elementName}`)
    lines.push("")
    lines.push(`**备注**：${a.note || "（无）"}`)
    lines.push("")
    lines.push("### 元素定位线索")
    lines.push(`- 元素名：\`${c.elementName}\``)
    if (c.ancestorLabels.length > 0) {
      lines.push(`- 语义路径：${c.ancestorLabels.join(" - ")}`)
    }
    lines.push(`- CSS 选择器：\`${c.selector}\``)
    lines.push(`- DOM 路径：\`${c.domPath}\``)
    if (c.text) lines.push(`- 可见文字：\`${c.text}\``)
    const aria = [c.ariaRole ? `role=${c.ariaRole}` : null, c.ariaLabel ? `label="${c.ariaLabel}"` : null].filter(Boolean)
    if (aria.length > 0) lines.push(`- 无障碍：${aria.join(", ")}`)
    lines.push(`- 视口位置：(${c.position.x}, ${c.position.y})，尺寸 ${c.position.width}×${c.position.height}`)
    if (c.classes.length > 0) lines.push(`- class：${c.classes.map((cl) => `\`${cl}\``).join(" ")}`)
    const attrKeys = Object.keys(c.attributes)
    if (attrKeys.length > 0) {
      lines.push(`- 属性：${attrKeys.map((k) => `${k}="${c.attributes[k]}"`).join(" ")}`)
    }
    if (c.siblingText.prev || c.siblingText.next) {
      const sib = [
        c.siblingText.prev ? `前：\`${c.siblingText.prev}\`` : null,
        c.siblingText.next ? `后：\`${c.siblingText.next}\`` : null
      ].filter(Boolean)
      lines.push(`- 相邻内容：${sib.join("，")}`)
    }
    if (c.reactSource) {
      const comp = c.reactSource.componentName ? `（组件 <${c.reactSource.componentName}>）` : ""
      lines.push(`- 源码定位：\`${c.reactSource.fileName}:${c.reactSource.lineNumber}\` ${comp}`)
    }
    if (opts.includeStyles && Object.keys(c.computedStyles).length > 0) {
      lines.push("- 关键样式：" + Object.entries(c.computedStyles).map(([k, v]) => `${k}: ${v}`).join("; "))
    }
    if (opts.includeHTML) {
      lines.push("")
      lines.push("元素 HTML（截断）：")
      lines.push("```html")
      lines.push(c.outerHTML)
      lines.push("```")
    }
    if (opts.includeRequests) {
      const related = opts.relatedRequests.filter((r) => r.triggerInfo != null && matchesAnnotation(a, r))
      if (related.length > 0) {
        lines.push("")
        lines.push("### 相关请求（按触发来源匹配）")
        for (const req of related) lines.push(requestLine(req))
      }
    }
    lines.push("")
  })

  lines.push("---")
  lines.push("")
  lines.push("请逐处确认并修复；如某处无法在源码中定位，请在结果中说明你尝试过的定位方式。")
  return lines.join("\n")
}

/** 标注与请求的匹配：元素名/语义路径/文字与请求的触发描述互相包含 */
export function matchesAnnotation(a: ElementAnnotation, req: RecordedRequest): boolean {
  const desc = req.triggerInfo?.description ?? ""
  const label = req.triggerInfo?.targetLabel ?? ""
  const parts = [a.context.elementName, ...a.context.ancestorLabels, a.context.text ?? ""]
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  return parts.some((p) => desc.includes(p) || (label.length >= 2 && label.includes(p)))
}
