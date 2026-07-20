# Agent 规范

Request Recorder — Chrome 扩展，录制浏览器 HTTP 请求并支持 8 种格式导出。基于 Plasmo + React + TypeScript + Tailwind CSS 构建。

## 构建要求

每次代码改动完成后，必须执行一次构建确认无误：

```bash
npm run build
```

构建成功标志：输出 `🟢 DONE` 且无报错。若构建失败，需修复错误后重新构建，直到通过为止。

## 文档导航

> 以下文档在涉及对应领域的开发、评审或排查时先读取。

- `docs/REQUEST_RECORDING_KNOWLEDGE_BASE.md`：录制状态、事件配对、body 捕获、SW 生命周期、过滤机制、会话管理
- `docs/REQUEST_EXPORT_KNOWLEDGE_BASE.md`：导出格式转换、Header 分组过滤、复制偏好、高级复制弹窗

## 领域地图（doc-init）

<!-- 覆盖度复核基线：2026-07-17 · 源码指纹 扫描 67 文件 / TypeScript 35 · JavaScript 2 / 0 子模块 -->

| 领域 | 入口锚点 |
|------|---------|
| 请求录制 | src/background.ts · src/contents/page-patcher.ts · src/contents/injector.ts · src/lib/messages.ts |
| 请求导出 | src/lib/format.ts · src/lib/headerGroups.ts · src/hooks/useCopyPrefs.ts · src/components/history/CopyModal.tsx |
