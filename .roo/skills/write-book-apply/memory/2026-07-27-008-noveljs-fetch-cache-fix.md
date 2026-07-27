# 初始加载优先使用 /api/novel 接口读取最新数据

## 日期

2026-07-27

## 修改摘要

修复页面首次打开时显示陈旧数据（来自缓存或 `data/novel.js` 内嵌 manifest）的问题。

**问题根因：** 初始加载 `_loadNovelData()` 使用 `data/novel.js` 中 `__NOVEL_READY__` 的逐章 fetch 机制，而「🔄 刷新」按钮 `_refreshFromJson()` 使用 `fetch('/api/novel', {cache:'no-store'})` 从 server.py 的 `_load_novel()` 读取磁盘数据。两者走不同路径，且 `__NOVEL_READY__` 的数据映射优先使用 manifest 而非 JSON 文件内容。

## 涉及文件

| 文件 | 行 | 修改内容 |
|------|----|---------|
| [`js/app.js`](js/app.js:405) | 405-450 | `_loadNovelData()` 改为优先调用 `fetch('/api/novel', {cache:'no-store'})`，API 不可用时降级到 `__NOVEL_READY__` / `__NOVEL_DATA__` |
| [`server.py`](server.py:306) | 306-310 | `_save_novel()` 生成 fetch 代码时添加 `?_t='+Date.now()` 缓存破坏参数，数据映射改为 `d.xxx \|\| m.xxx` 优先读取 JSON 文件字段 |
| [`data/novel.js`](data/novel.js:13) | 13-17 | 同步应用 fetch 缓存破坏 + 数据源优先级修复（作为降级方案生效） |

## 关键决策

- 初始加载与刷新按钮使用相同 API 路径，行为一致
- `data/novel.js` 的 `__NOVEL_READY__` 保留为降级方案，用于无后端场景（如直接打开 `index.html`）
- 降级方案中同样修复了数据源优先级问题

## 注意事项

- 只有通过 `server.py` 运行时 `/api/novel` 才可用
- 直接双击打开 `index.html`（file:// 协议）时会自动降级到 `data/novel.js` 的 `__NOVEL_READY__` 机制
