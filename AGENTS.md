# Agent 规范

Request Recorder — Chrome 扩展，录制浏览器 HTTP 请求并支持 8 种格式导出。基于 Plasmo + React + TypeScript + Tailwind CSS 构建。

## 构建要求

每次代码改动完成后，必须执行一次构建确认无误：

```bash
npm run build
```

构建成功标志：输出 `🟢 DONE` 且无报错。若构建失败，需修复错误后重新构建，直到通过为止。

## UI 样式约定

- 弹窗与历史页样式统一走 Tailwind class（`src/style.css` 为共享入口，popup/history 均已引入）；**新增界面必须同时写浅色与 `dark:` 深色两套**（`darkMode: "media"` 跟随系统）。
- 页面内悬浮按钮（录制按钮）注入 Shadow DOM，用自包含 CSS，不依赖 Tailwind，深浅色下均需可读。

## 文档导航

- `~/.config/agentsync/docs/CHROME_EXTENSION_DEVELOPMENT_KNOWLEDGE_BASE.md`：Chrome 扩展本地开发 / 热更新 / MV3 / 自动化测试 / 商店审核前**必读**。不读会用脚本或调试协议碰日常 Chrome 配置。
- `docs/REQUEST_RECORDING_KNOWLEDGE_BASE.md`：改、评审或排查录制状态、事件配对、body 捕获、SW 生命周期、过滤或会话管理前**必读**。
- `docs/REQUEST_EXPORT_KNOWLEDGE_BASE.md`：改导出格式、Header 分组过滤、复制偏好或高级复制弹窗前**必读**。
- 页面标注已迁到 EditHere Chrome 扩展（`/Users/geraltgraham/Codes/EditHere/chrome/`）。本仓只做请求录制与导出。
- `docs/OPENDESIGN_RESEARCH.md`：规划新手引导、导出预设、会话标记等体验优化前先读；含已验证可借鉴模式。

## 领域地图（doc-init）

<!-- 覆盖度复核基线：2026-07-17 · 源码指纹 扫描 67 文件 / TypeScript 35 · JavaScript 2 / 0 子模块 -->

| 领域 | 入口锚点 |
|------|---------|
| 请求录制 | src/background.ts · src/contents/page-patcher.ts · src/contents/injector.ts · src/lib/messages.ts |
| 请求导出 | src/lib/format.ts · src/lib/headerGroups.ts · src/hooks/useCopyPrefs.ts · src/components/history/CopyModal.tsx |
