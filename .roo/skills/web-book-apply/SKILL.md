---
name: web-book-apply
description: 星落之城小说写作与阅读工具（web_book）— Bug 修复、功能添加、代码修改、样式调整、部署运维
modeSlugs:
  - code
  - debug
  - architect
  - ask
---

# web-book-apply 维护技能

## 技能触发条件

### 显式触发

| 触发方式 | 示例 |
|---------|------|
| **显式技能调用** | `/web-book-apply` |

### 隐式触发 — 功能类

| 需求类型 | 触发关键词 |
|---------|-----------|
| **章节管理** | 新增/删除/重命名章节、章节插入重编号、章节排序、导入导出 |
| **编辑器功能** | 写作端优化、Markdown 编辑/预览、保存/导出/刷新、大纲管理 |
| **阅读端功能** | 阅读页渲染、目录导航、上一章/下一章、主题切换、分享短链 |
| **数据/存储** | localStorage、novel.json/章节文件读写、数据迁移、备份恢复 |

### 隐式触发 — 技术类

| 需求类型 | 触发关键词 |
|---------|-----------|
| **服务器/API** | server.py、/api/novel、/api/chapter、/api/info、局域网分享、防火墙 |
| **部署/发布** | Vercel、publish.bat、/read 短链、云端部署、缓存刷新 |
| **工具脚本** | tools/insert-chapter.js、tools/backup-chapter.js |
| **UI/样式** | css/style.css、主题、响应式、移动端适配 |
| **Bug 修复** | 内容丢失、章节显示异常、保存失败、预览与编辑不同步 |

---

## Instructions

### 项目简介

本项目是**小说创作 + 在线阅读一体化工具**，配套都市言情小说《星落之城》连载使用。写作端（`index.html`）+ 阅读端（`reader.html`）+ 本地 Python 服务器局域网分享 + Vercel 云端部署。章节正文**分文件存储**（`data/chapters/ch_*.json`），`data/novel.json` 只存元信息+清单，两者保存时同步更新。

### 项目根目录

```
e:/Project/web_book_new
```

### 各模式记忆分配（Agent Loadout）

本技能在各模式下加载不同层级记忆：

```yaml
code（改代码）:
  - L1: 代码修改相关事实
  - L2: 本项目 .roo/skills/web-book-apply/
  - 代码修改相关 skill（write-book-content 等）
debug（排查）:
  - L1: 排查/环境相关事实
  - L2: 本项目踩坑记录（exp-*.md）
  - 测试/排查相关 skill
architect（设计）:
  - L1 + L3: 全局事实 + 长期画像
  - L2: 本项目全部记忆索引
  - 编排/看板能力
ask（问答）:
  - L1: 全部 memory 事实
  - L3: 全部长期画像
  - 不加载项目级 L2 经验（按需读取）
```

---

## 项目结构

```
web_book_new/
├── server.py                 # 本地服务器：静态 + JSON API + novel.js 自动生成（零依赖，端口 8000）
├── config.py                 # 后端配置：PORT / FIREWALL_RULE_NAME / DATA_FILE
├── publish.bat               # Vercel 一键发布脚本（含版本号 + 契约校验）
├── vercel.json               # Vercel 路由/缓存配置（/read → reader.html）
├── _redirects                # 根路径重定向到阅读页
├── TOOL_CONTRACT.md          # API 契约（前后端唯一权威，contract-check 校验）
├── index.html                # 写作端（编辑器）
├── reader.html               # 阅读端
├── js/
│   ├── config.js             # 前端共享配置（存储 key / API 端点）
│   ├── markdown.js           # 共享 Markdown 渲染器（写作/阅读双端复用）
│   ├── app.js                # 编辑器逻辑：章节管理/保存/导出/刷新
│   └── reader.js             # 阅读器逻辑：主题/章节加载/目录导航
├── css/style.css             # 全局样式（双端）
├── data/
│   ├── novel.json            # 书籍元信息 + 章节清单（保存目标）
│   ├── novel.js              # 数据加载器（server.py 自动生成，勿手改）
│   ├── outline.md            # 小说大纲（人物/剧情规划，可用 Obsidian 编辑）
│   └── chapters/ch_*.json    # 各章节正文（Markdown 内容，格式 {id,title,summary,content}）
├── scripts/
│   ├── contract-check.mjs    # 前后端 API 契约校验
│   └── bump-version.mjs      # 前端静态资源版本号自动更新
├── tools/
│   ├── insert-chapter.js     # 章节插入脚本（自动重编号后续章节 + 更新 outline.md）
│   └── backup-chapter.js     # 章节版本备份脚本（temp/ 目录，上限 100 份）
└── .roo/skills/              # 技能目录
```

---

## API 端点速查（本地服务器）

| 方法 | 路径 | 说明 | 处理函数 |
|------|------|------|---------|
| GET | `/api/novel` | 获取完整小说数据（从章节文件重建） | [`_load_novel()`](server.py:181) |
| POST | `/api/novel` | 全量保存小说数据（写章节文件 + novel.js） | [`_save_novel()`](server.py:259) |
| POST | `/api/chapter` | 保存单个章节到 `data/chapters/<id>.json` | [`do_POST`](server.py:156) |
| GET | `/api/info` | 本机 IP / 端口 / 阅读与编辑地址 | [`do_GET`](server.py:118) |
| GET | `/read` | 302 重定向到 `reader.html` | [`do_GET`](server.py:128) |

> 前端另通过静态文件 `data/chapters/<id>.json` 直接 fetch 章节正文（见 [`_loadChapterContents()`](js/reader.js:230)）。

---

## 记忆管理闭环（对齐 Hermes L0-L3 记忆模型）

### Phase 0: 记忆加载（召回）

每次开始维护任务前：

1. 加载项目记忆索引 `.roo/skills/web-book-apply/memory/INDEX.md`，浏览 L2 项目经验
2. 按任务类型按需读取具体 L2 记忆（`exp-*.md`）：与之前改过的模块相关 → 读取；首次新问题 → 跳过
3. 用 `memory` 工具召回跨项目的 L1 原子事实（工具路径、环境约束、用户偏好）
4. 注入 L3 长期画像（用户沟通风格、稳定偏好）

### 修改驱动流程

**Step 1 — 分析**
- 明确需求范围（功能新增 / Bug 修复 / 重构 / 部署调整）
- 确认受影响的核心模块（服务器层 / 数据层 / 编辑器 / 阅读器 / 样式 / 部署）
- 检查是否有相关记忆可参考

**Step 2 — 方案**
- 制定最小改动方案，优先向后兼容
- **数据层修改须考虑 `novel.json` 与 `chapters/` 的一致性**（二者同步更新，勿只改其一）
- 对 `server.py` 修改须验证 API 与前端调用方契约不变
- `data/novel.js` 是**生成物**，不得手改——改完 `_save_novel()` 后靠重新保存/重启重新生成

**Step 3 — 待办**
- 将改动拆分为可独立验证的步骤，每步完成后立即测试

**Step 4 — 执行**
- 按待办依次执行，每次修改后验证功能完整性

### Phase 4: 记忆记录（沉淀）

修改完成后按**写入决策速查表**分流沉淀，而非一律写进本技能 memory：

| 场景 | 写到哪一层 | 去向 |
|:---|:---|:---|
| 用户偏好/习惯 | L3 长期画像 | `memory` 工具（target: `user`） |
| 环境/工具事实 | L1 原子事实 | `memory` 工具（target: `memory`） |
| 项目 Bug 修复经验 / 踩坑 | L2 项目经验 | `.roo/skills/web-book-apply/memory/` |
| 用户确认流程跑通 | Skill 提炼 | 用户确认后 `skill_manage(action='create')` |
| 知识/研究整理 | Wiki | Obsidian vault |
| 临时任务进度 | **不记** | — |

#### L2 记忆文件模板

```markdown
# exp-{YYYYMMDD}-{NNN}：<一句话标题>

## 标签
`模块` `技术点` `关键词`

## 触发条件
什么情况下需要查这条经验

## 关键信息 / 根因
排查出的根本原因、关键变量语义、易错点

## 改动
- [`文件路径`](相对链接) — 改了什么、为什么

## 验证
跑了什么命令、什么现象算通过

## 关联
- 相关记忆条目编号
- 相关 Skill 名称
```

---

## 常见文件职责速查

| 文件 | 职责 |
|------|------|
| [`server.py`](server.py) | 本地服务器：静态服务 + JSON API（`/api/novel`、`/api/chapter`、`/api/info`、`/read`）+ `novel.js` 自动生成 |
| [`js/app.js`](js/app.js) | 写作端编辑器逻辑：章节管理、保存/导出/刷新、字数统计 |
| [`js/reader.js`](js/reader.js) | 阅读端逻辑：Markdown 渲染、主题切换、分享数据解码、目录导航、章节加载 |
| [`css/style.css`](css/style.css) | 双端全局样式（暗色/绿色/纸纹主题、响应式） |
| [`data/novel.json`](data/novel.json) | 书籍元信息 + 章节清单（保存的目标） |
| [`data/novel.js`](data/novel.js) | 数据加载器（**server.py 生成物，勿手改**） |
| [`data/outline.md`](data/outline.md) | 小说大纲（人物/剧情规划） |
| [`tools/insert-chapter.js`](tools/insert-chapter.js) | 章节插入：任意两章之间插入，自动重编号 + 更新 outline.md |
| [`tools/backup-chapter.js`](tools/backup-chapter.js) | 章节版本备份到 `temp/`，保留上限 100 份 |
| [`publish.bat`](publish.bat) | Vercel 一键发布 |
| [`vercel.json`](vercel.json) | Vercel 路由/缓存配置 |

---

## 常见问题场景 → 排查起点

| 问题场景 | 可能原因 | 排查起点 |
|---------|---------|---------|
| **局域网打不开** | 服务器未启动 / 不在同一 Wi-Fi / 防火墙未放行 8000 | 先 `python server.py` → 防火墙放行 8000 端口 |
| **阅读页内容没更新** | `novel.json` 不是最新 / CDN/浏览器缓存 | 编辑器点「保存」确保最新 → 强刷 Ctrl+F5 |
| **章节显示不对/缺失** | `novel.json` 与 `chapters/` 不一致 / `novel.js` 过期 | [`_load_novel()`](server.py:181) 重建逻辑 → 重新保存/重启 |
| **编辑器保存失败** | 服务器 API 不可用 / localStorage 异常 | [`_save_novel()`](server.py:259) → 前端降级「下载 JSON」分支 |
| **手改章节后不生效** | 未按 `{id,title,summary,content}` 格式 / 未刷新 | `data/chapters/ch_*.json` 格式 → 编辑器「刷新」/重启服务器 |
| **章节插入后编号错乱** | 手动改导致 novel.json 与文件不同步 | 用 [`insert-chapter.js`](tools/insert-chapter.js) 而非手改 |
| **云端/`/read` 短链失效** | vercel.json 路由配置 / 未重新部署 | [`vercel.json`](vercel.json) rewrites → `publish.bat` 重新部署 |
| **手机主题/分享失效** | reader.js 分享解码异常 | [`decodeShareData()`](js/reader.js:134) → hash 数据格式 |

---

## 跨模式工作流

| 场景 | 推荐模式 | 协作方式 |
|------|---------|---------|
| **复杂 Bug 修复** | `debug` → `code` | debug 定位根因 → code 实施修复 |
| **新功能设计** | `architect` → `code` | architect 设计方案和接口 → code 实现 |
| **技术方案评审** | `architect` + `ask` | architect 出方案 → ask 评审 |
| **代码理解** | `ask` → `code` | ask 分析现有代码 → code 修改 |
| **内容创作联动** | `write-book-content` + `code` | 内容技能写正文 → 本技能做应用维护 |

**基本原则：** 复杂修改前先用 `architect` 设计方案；修改后用 `debug` 验证；不确定的技术问题用 `ask` 查询。

---

## 约束

1. **始终从记忆加载开始** — 每次维护先读 INDEX.md，避免重复劳动
2. **修改前充分了解** — 至少阅读要修改的函数完整代码，不可仅凭推测修改
3. **数据一致性第一** — `novel.json` 与 `data/chapters/` 必须同步更新；`data/novel.js` 是生成物，勿手改
4. **保持零依赖/纯静态架构** — 不引入 Python 第三方包、不引入构建工具/前端框架（除非项目明确需要）
5. **向后兼容** — 章节数据格式 `{id,title,summary,content}` 不得破坏性变更
6. **修改后必验证** — 每次修改后手动测试核心流程（编辑保存 → 本地预览 → 可选云端部署）
7. **记录所有修改** — 每次维护后在 `memory/` 中创建记录并更新 INDEX.md
8. **写入即分流** — 沉淀严格按写入决策速查表，临时进度不记
9. **「跑通」由用户判定** — 只有用户明确说「跑通了/记下来/做成 skill」后才提炼新 Skill
