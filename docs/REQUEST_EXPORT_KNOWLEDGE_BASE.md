# 请求导出 领域知识库

## §0 目录索引

| § | 标题 | 定位 |
|---|------|------|
| §1 | 业务背景与核心概念 | 首次接触该域时读 |
| §2 | 核心业务流程 | 理解导出转换流水线 |
| §2.5 | 物理路径速查 | 直接定位代码目录 |
| §3 | 代码入口索引 | 按任务场景找入口 |
| §4 | 存储与字段入口索引 | 改存储 key/数据结构时 |
| §5 | 组件入口索引 | 改导出组件/格式时 |
| §6 | 核心业务规则与隐性约束 | 改代码前必扫的 AI 易错点 |
| §7 | 验证路径 | 改完后如何验证正确性 |
| §8 | 关联文档 | 跨域联读指引 |
| §9 | 覆盖度与待补充项 | 了解文档置信度和缺口 |

## §1 业务背景与核心概念

请求导出是 Request Recorder 的输出层，将录制的 HTTP 请求转换为标准格式供开发者使用。支持 8 种导出格式，提供 Header 分组过滤机制防止敏感信息泄漏，支持响应体包含策略，并通过持久化偏好设置提升复用体验。

核心概念：
- **导出格式**（FormatType）：8 种输出格式——curl、fetch、axios、HTTP Raw、JSON、HAR、Postman Collection v2.1、mitmproxy flow
- **Header 分组**（HeaderGroupKey）：将请求/响应头分为 4 组——认证类（auth）、内容类（content）、跨域类（cors）、自定义类（custom），支持组级勾选控制导出范围
- **复制偏好**（CopyPrefs）：用户的导出配置快照——格式选择、Header 分组勾选、是否包含响应体、响应 Header 分组勾选，持久化到 chrome.storage.local
- **原生响应格式**（NATIVE_RESPONSE_FORMATS）：HAR/Postman/mitmproxy/JSON 这 4 种格式原生支持响应体结构，其余格式以注释形式追加

## §2 核心业务流程

### 导出转换流水线

1. **用户选择请求**：在历史页勾选要导出的请求（默认全选）
2. **确定 Header 过滤范围**：收集所有选中请求的 headers，按组分类（`classifyHeaders`），根据用户勾选的组计算 `includedHeaderNames: Set<string>`
3. **格式转换**：对每条请求调用 `formatRequest(req, opts)`，按 opts.format 路由到对应格式转换器
4. **输出**：单条直接输出；多条在各条前加标题分隔（`# N（点击"触发描述"）`），两条间用双换行分隔

### Header 分组过滤

```
请求头原始列表 → classifyHeaders() 分 4 组
  → 用户勾选/取消组 → resolveIncludedHeaders() 计算允许的 header name 集合
  → filterHeaders() 在格式转换前过滤
```

认证类 Header（Authorization、Cookie、Set-Cookie、X-Auth-Token 等）默认不勾选，防止意外泄漏。

### 复制偏好持久化

`useCopyPrefs` hook 在组件挂载时从 `chrome.storage.local` 读取偏好（key=`rr:copy-prefs`），更新时先 setState 再异步持久化。合并 headerGroups 时用默认值兜底，防止新增分组键丢失。

## §2.5 物理路径速查

| 目录（相对项目根） | 内容 | 关键类/文件 |
|------|------|--------|
| src/lib/format.ts | 8 种格式转换器 + 公共入口 | formatRequest, formatRequestList |
| src/lib/headerGroups.ts | Header 分组定义和分类 | classifyHeaders, HEADER_GROUP_DEFAULTS |
| src/lib/curl.ts | 简易 curl 生成（无过滤） | toCurl, toCurlList |
| src/hooks/useCopyPrefs.ts | 复制偏好 hook | useCopyPrefs |
| src/components/history/CopyModal.tsx | 高级复制弹窗 | CopyModal |

## §3 代码入口索引

| 场景 | 入口 | 类/方法/配置 | 说明 |
|---|---|---|---|
| 快速复制 | 历史页工具栏"⚡ 复制"按钮 | `RequestList.handleQuickCopy()` | 按当前偏好直接复制，不打开弹窗 |
| 高级复制 | 历史页"高级复制"按钮 | `CopyModal` | 选择格式、Header 分组、响应体等 |
| 单条复制 | 预览区每条右侧"复制"按钮 | `CopyModal` 内 | 预览区单条复制 |
| 格式转换 | 公共入口 | `formatRequest(req, opts)` | 单条请求转指定格式 |
| 批量格式转换 | 公共入口 | `formatRequestList(reqs, opts)` | 多条请求，加标题分隔 |
| Header 分类 | 分组入口 | `classifyHeaders(headers)` | 将 headers 分为 auth/content/cors/custom |
| 计算 Header 白名单 | 过滤入口 | `resolveIncludedHeaders(headers, groupChecks)` | 根据组级勾选计算允许输出的 header name 集合 |

## §4 存储与字段入口索引

| Storage Key | 数据类型 | 业务语义 | 改动注意 |
|---|---|---|---|
| `rr:copy-prefs` | `CopyPrefs` | 复制偏好设置 | 合并 headerGroups 时需用 `DEFAULT_PREFS.headerGroups` 兜底，防新增分组键丢失 |

### CopyPrefs 关键字段

| 字段 | 类型 | 业务语义 | 注意事项 |
|------|------|---------|---------|
| format | FormatType | 当前选择的导出格式 | 默认 `"curl"` |
| headerGroups | Record\<HeaderGroupKey, boolean\> | 请求 Header 各组勾选状态 | auth 默认 false，其余默认 true |
| includeResponse | boolean | 是否包含响应体 | 默认 false |
| responseHeaderGroups | Record\<HeaderGroupKey, boolean\> | 响应 Header 各组勾选状态 | 仅 includeResponse=true 时生效 |

### FormatType 枚举

| 值 | 输出格式 | 原生响应体 |
|----|---------|-----------|
| `"curl"` | cURL 命令 | 否（注释追加） |
| `"fetch"` | JavaScript fetch | 否（注释追加） |
| `"axios"` | axios.request | 否（注释追加） |
| `"http-raw"` | HTTP/1.1 原始报文 | 否（分隔线追加） |
| `"json"` | JSON 对象 | 是 |
| `"har"` | HAR 1.2 | 是 |
| `"postman"` | Postman Collection v2.1 | 是 |
| `"mitmproxy"` | mitmproxy flow | 是 |

## §5 组件入口索引

| 类型 | 标识 | 代码入口 | 适用场景 |
|------|------|---------|---------|
| React Hook | useCopyPrefs | src/hooks/useCopyPrefs.ts | 需要读取/修改复制偏好的组件 |
| UI 组件 | CopyModal | src/components/history/CopyModal.tsx | 高级复制交互 |
| UI 组件 | RequestList | src/components/history/RequestList.tsx | 请求列表+快速复制+高级复制入口 |

## §6 核心业务规则与隐性约束

- **【禁止】将认证类 Header 的默认勾选改为 true** → 必须 保持 `HEADER_GROUP_DEFAULTS.auth = false`（原因：默认导出 Cookie/Authorization/Token 会导致敏感信息泄漏）

- **【AI 易错点】【消歧】响应体包含策略分两种**：NATIVE_RESPONSE_FORMATS（har/postman/mitmproxy/json）原生支持响应结构，UI 文案为"包含响应体"；其他格式以注释形式追加，UI 文案为"包含响应体（以注释形式追加）"。**添加新格式时必须决定属于哪种策略并在 `NATIVE_RESPONSE_FORMATS` 中注册**

- **【AI 易错点】【隐式语义】`resolveIncludedHeaders` 是组级操作而非逐条操作** → 传入的 `headers` 是所有选中请求的 headers 合并去重后的集合，`groupChecks` 是组级勾选状态。计算结果是"允许输出的 header name 集合"，再由 `filterHeaders()` 在每条请求上过滤。**禁止跳过组级过滤直接操作单条请求的 headers**

- **【隐性依赖】添加新 Header 分组时**，必须同时更新：① `HeaderGroupKey` 类型 ② `HEADER_GROUP_LABELS` ③ `HEADER_GROUP_DEFAULTS` ④ `classify()` 函数的匹配规则 ⑤ `CopyPrefs` 的 `DEFAULT_PREFS.headerGroups` 合并逻辑（`useCopyPrefs` 中的兜底合并）。遗漏任何一处会导致新分组不可用或偏好丢失

- **【隐性依赖】`src/lib/curl.ts` 中的 `toCurl()` 不走 Header 分组过滤** → 它是简易版本，直接输出全部 headers。需要过滤的 curl 输出必须使用 `format.ts` 中的 `toCurlFormat()`，通过 `formatRequest()` 调用

- **【AI 易错点】【已确认缺陷】curl 格式 URL 未做单引号转义** → `toCurlFormat()` 中 `parts.push(\`  '${req.url}'\`)` 直接将 URL 拼入单引号字符串。若 URL 含单引号（如 `https://example.com/path?name=O'Brien`），生成的 shell 命令会语法错误或注入风险。**修复方向：对 req.url 做 `.replace(/'/g, "'\\''")` 转义**（与 header value/body 已有的转义逻辑一致）

- **【AI 易错点】【已确认缺陷】HAR 和 Postman 格式 URL 解析失败时崩溃** → `toHarFormat()` 和 `toPostmanFormat()` 在 URL 解析失败时构造降级对象 `{ href, hostname, pathname, search } as URL`，但缺少 `searchParams` 属性。后续代码访问 `parsedUrl.searchParams.forEach()` 会抛 TypeError。**修复方向：降级对象补全 `searchParams: new URLSearchParams()`**（mitmproxy 格式已正确处理此边界）

- **【低置信度】Header 分组分类对响应 CORS 头不覆盖** → `access-control-allow-origin/methods/headers/credentials/expose-headers/max-age` 归入 custom 组而非 cors 组。响应侧的 CORS 头与请求侧的 CORS 头语义不同，当前分类可能导致用户意外导出响应 CORS 头

## §7 常见易忽略条件与验证路径

- 添加新导出格式后：`npm run build` + `npm run typecheck` 确认编译通过，在历史页打开高级复制弹窗，选择新格式，确认预览区输出正确

- 改 Header 分组逻辑后：在高级复制弹窗中勾选/取消各分组，确认预览区只输出被勾选组的 headers；确认认证类 Header 默认不勾选

- 改复制偏好持久化后：修改格式和分组 → 关闭弹窗 → 重新打开弹窗，确认偏好已恢复

- 编译验证：`npm run build` — 输出 `🟢 DONE` 且无报错

- 类型检查：`npm run typecheck` — 确认无类型错误

## §8 关联文档

- `docs/REQUEST_RECORDING_KNOWLEDGE_BASE.md`：请求录制域，涉及录制状态机、事件配对、body 捕获。录制数据结构变更时联读

## §9 覆盖度与待补充项

- 代码推断覆盖：已覆盖全部导出相关代码入口（format.ts 8 种格式、headerGroups.ts 分组逻辑、useCopyPrefs.ts 偏好持久化、CopyModal.tsx 交互）
- 领域语言统一：主称谓已确认（导出格式/Header 分组/复制偏好）
- 用户/资料补充：无额外补充
- Q&A 补充：无（本域无代码看不到的隐性知识缺口）
- 待补充：Postman Collection 导入实际兼容性验证；各格式转换器边界 case 单元测试（URL 含单引号、非标准 URL、Header value 为 undefined 等）；响应 CORS 头的分组归属是否需调整

<!-- 该文档由 doc-init 生成于 2026-07-17；定位：AI 修改请求导出逻辑前的快速参考文档 -->
