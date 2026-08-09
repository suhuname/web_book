# web_book API 工具契约（§3 工具契约文档化）

> 本文件是前端与后端（`server.py`）之间 API 的**唯一权威契约**。
> 改动任何端点前，**先更新本表，再改代码**。
> 用 `node scripts/contract-check.mjs` 自动校验前后端一致性。

## 端点契约

| 端点 | 方法 | 请求体 | 响应 | 处理函数（server.py） | 前端调用方 |
|------|------|--------|------|----------------------|-----------|
| `/api/novel` | GET | — | `{book, chapters[]}`（从章节文件重建） | [`_load_novel()`](server.py:181) | [`app.js`](js/app.js)（加载/刷新） |
| `/api/novel` | POST | `{book, chapters[]}` 全量 | `{ok:true, message}` | [`_save_novel()`](server.py:259) | [`app.js`](js/app.js)（保存/分享） |
| `/api/chapter` | POST | `{id, title, summary, content}` | `{ok:true, message}` | [`do_POST`](server.py:156) | [`app.js`](js/app.js)（单章即时保存） |
| `/api/info` | GET | — | `{ip, port, reader_url, editor_url}` | [`do_GET`](server.py:118) | [`app.js`](js/app.js)（分享地址） |
| `/read` | GET | — | 302 → `/reader.html` | [`do_GET`](server.py:128) | 短链重定向 |

> 阅读端另直接 fetch 静态文件 `data/chapters/<id>.json` 加载章节正文（[`reader.js`](js/reader.js:236)），非 API 端点，不走契约校验。

## 前端常量来源

前端 API 路径统一从 [`js/config.js`](js/config.js)（`window.APP_CONFIG.API`）读取，不在调用处硬编码。

## 校验方式

```bash
node scripts/contract-check.mjs
```

- (a) `js/config.js` 中每个 API 端点都在 `server.py` 中存在对应路由
- (b) `server.py` 中每个 `do_GET/do_POST` 的 API 路由都在本契约表中有文档行
- 任一不匹配 → 退出码非 0，提示修复
