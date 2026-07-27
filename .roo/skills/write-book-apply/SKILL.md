---
name: write-book-apply
description: 写书工具（小说编辑应用）— Bug 修复、功能添加、代码修改、样式调整、性能优化
modeSlugs:
  - code
  - debug
  - architect
  - ask
---

# write-book-apply 维护技能

## 技能触发条件

<!-- 当用户提出以下任一需求时，自动触发本技能 -->

### 显式触发

| 触发方式 | 示例 |
|---------|------|
| **显式技能调用** | `/write-book-apply` |

### 隐式触发 — 功能类

| 需求类型 | 触发关键词 |
|---------|-----------|
| **章节管理** | 新增章节、删除章节、重命名章节、切换章节、章节排序、章节导入/导出 |
| **编辑器功能** | 编辑区优化、代码高亮、自动补全、快捷键、拼写检查、字数统计增强 |
| **Markdown 渲染** | 渲染 Bug、新增语法支持（任务列表、脚注、数学公式、绘图）、预览样式 |
| **数据/存储** | localStorage 问题、数据同步、数据迁移、数据备份恢复、File System Access API |
| **导出功能** | 导出格式（TXT/EPUB/PDF/HTML）、批量导出、导出样式定制 |

### 隐式触发 — 技术类

| 需求类型 | 触发关键词 |
|---------|-----------|
| **UI/样式** | 主题切换、布局调整、响应式适配、CSS 样式修改、动画效果、暗色模式完善 |
| **性能优化** | 大文档渲染优化、懒加载、防抖节流、内存泄漏 |
| **Bug 修复** | 编辑器内容丢失、章节切换异常、保存失败、预览与编辑不同步、弹窗问题 |
| **键盘快捷键** | 新增快捷键、快捷键冲突、快捷键自定义 |

---

## Instructions

### 项目简介

本项目是一个**基于浏览器的中文小说编辑工具**，用于创作《星落之城》（都市言情小说）。支持 Markdown 编辑与实时预览、章节树管理、自动保存到 localStorage、数据导出备份。纯前端架构，无后端依赖。

### 项目根目录

```
e:/Project/write_book
```

---

## 项目结构

```
write_book/
├── index.html              # 主入口页面 — 工具栏、章节列表、编辑/预览面板、弹窗
├── css/
│   └── style.css           # 全局样式 — 暗色主题、响应式布局、Markdown 预览样式
├── js/
│   └── app.js              # 核心应用逻辑（~970行）
│                           #   ├── Storage       — localStorage 读写
│                           #   ├── MarkdownRenderer — Markdown→HTML 渲染器
│                           #   └── App           — 主控制器（章节管理/编辑/预览/快捷键）
├── data/
│   ├── novel.json          # 小说数据（JSON 格式，含 book 元信息和 chapters）
│   └── novel.js            # 小说数据（通过 <script> 加载，注入 window.__NOVEL_DATA__）
```

---

## 关键类与模块速查

| 类/模块 | 文件 | 行号 | 职责 |
|---------|------|------|------|
| `Storage` | [`js/app.js`](js/app.js:15) | 15–51 | localStorage 数据持久化：load / save / export |
| `MarkdownRenderer.render()` | [`js/app.js`](js/app.js:60) | 60–238 | Markdown → HTML 块级渲染（标题/引用/列表/表格/代码/段落） |
| `MarkdownRenderer._inlineMarkdown()` | [`js/app.js`](js/app.js:243) | 243–273 | 行内标记渲染（粗体/斜体/代码/链接/图片/删除线） |
| `App` | [`js/app.js`](js/app.js:278) | 278–964 | 应用主控制器，管理所有 UI 交互和数据流 |
| `App._start()` | [`js/app.js`](js/app.js:328) | 328–357 | 启动流程：绑定事件 → 加载数据 → 初始化 |
| `App._loadNovelData()` | [`js/app.js`](js/app.js:366) | 366–400 | 从 `window.__NOVEL_DATA__` 加载小说数据，合并 localStorage |
| `App._mergeSavedWithJson()` | [`js/app.js`](js/app.js:407) | 407–460 | 合并 localStorage 编辑内容与 JSON 原始数据 |
| `App._renderChapterList()` | [`js/app.js`](js/app.js:612) | 612–668 | 渲染左侧章节列表 |
| `App._addChapter()` | [`js/app.js`](js/app.js:702) | 702–722 | 新增章节 |
| `App._switchChapter()` | [`js/app.js`](js/app.js:686) | 686–700 | 切换当前章节 |
| `App._saveToJsonFile()` | [`js/app.js`](js/app.js:847) | 847–919 | 保存到 novel.json（File System Access API / 降级下载） |
| `App._countWords()` | [`js/app.js`](js/app.js:934) | 934–941 | 中英文混合字数统计 |
| 数据文件 | [`data/novel.json`](data/novel.json) | — | 小说元信息 + 章节数据 |
| 数据注入 | [`data/novel.js`](data/novel.js) | — | `window.__NOVEL_DATA__` 赋值 |

---

## 记忆管理闭环

### Phase 0: 记忆加载

每次开始维护任务前，先加载相关记忆：

1. 检查 `.roo/skills/write-book-apply/memory/INDEX.md`，浏览记忆索引
2. 根据当前任务类型，按需读取具体记忆文件：
   - 与之前修改过的模块相关 → 读取对应记忆
   - 首次遇到的新问题 → 跳过此步
3. 如果记忆中有相关决策记录或 Bug 修复记录，仔细阅读以避免重复踩坑

### 修改驱动流程

**Step 1 — 分析**
- 明确需求范围（功能新增 / Bug 修复 / 重构 / 样式调整）
- 确认受影响的核心模块（数据层 / 渲染层 / 应用层 / 样式层）
- 检查是否有相关记忆可参考

**Step 2 — 方案**
- 制定最小改动方案，优先考虑向后兼容
- 对数据层修改须考虑 localStorage 数据结构兼容性
- 对 Markdown 渲染修改须测试边界情况（空内容、特殊字符、嵌套语法）

**Step 3 — 待办**
- 将改动拆分为可独立验证的步骤
- 每个步骤完成后立即测试

**Step 4 — 执行**
- 按待办列表依次执行修改
- 每次修改后验证功能完整性

### Phase 4: 记忆记录

修改完成后，必须记录本次维护操作：

1. 在 `.roo/skills/write-book-apply/memory/` 下创建新的记忆文件，命名格式：`YYYY-MM-DD-序号-简短描述.md`
2. 记忆文件包含：
   - **标题**: 本次维护的简短标题
   - **日期**: 修改完成日期
   - **修改摘要**: 改了什么、为什么改
   - **涉及文件**: 所有修改过的文件列表
   - **关键决策**: 重要的技术决策及其理由
   - **注意事项**: 后续维护需要注意的事项
3. 更新 `.roo/skills/write-book-apply/memory/INDEX.md`，在索引表中追加新条目

---

## 常见问题场景 → 排查起点

| 问题场景 | 可能原因 | 排查起点 |
|---------|---------|---------|
| **编辑内容丢失** | localStorage 被清空 / 数据合并逻辑异常 / storage 容量超限 | [`Storage.load()`](js/app.js:16) → [`_mergeSavedWithJson()`](js/app.js:407) |
| **章节切换后内容不对** | activeChapterId 未正确更新 / 渲染缓存问题 | [`_switchChapter()`](js/app.js:686) → [`_loadActiveChapter()`](js/app.js:670) |
| **保存到文件失败** | File System Access API 权限问题 / 浏览器兼容性 | [`_saveToJsonFile()`](js/app.js:847) → 降级下载分支 |
| **Markdown 预览异常** | 正则匹配错误 / 嵌套语法处理缺陷 / 特殊字符转义 | [`MarkdownRenderer.render()`](js/app.js:60) → [`_inlineMarkdown()`](js/app.js:243) |
| **字数统计不准确** | 中英文混排计数逻辑缺陷 / 标点符号处理 | [`_countWords()`](js/app.js:934) |
| **新增章节后 UI 未刷新** | DOM 更新遗漏 / 计数器未同步 | [`_addChapter()`](js/app.js:702) → [`_renderChapterList()`](js/app.js:612) |
| **弹窗无法关闭** | 事件绑定遗漏 / z-index 层级问题 / 多个弹窗叠加 | 弹窗事件绑定 (`_bindEvents` 行 543–561) → CSS `.modal-overlay` 样式 |
| **键盘快捷键不生效** | 事件冒泡阻止 / 快捷键冲突 / 焦点在输入框内 | [`_bindEvents()`](js/app.js:564) → keydown 监听 |
| **页面加载后卡在「加载中」** | novel.js 未正确加载 / `window.__NOVEL_DATA__` 为空 | [`_loadNovelData()`](js/app.js:366) → 检查 `data/novel.js` |
| **响应式布局错乱** | 媒体查询边界值问题 / 窄屏下元素溢出 | CSS 媒体查询 (`style.css:635–712`) |

---

## 跨模式工作流

本技能可与以下模式协作完成复杂任务：

| 场景 | 推荐模式 | 协作方式 |
|------|---------|---------|
| **复杂 Bug 修复** | `debug` → `code` | debug 模式定位根因 → code 模式实施修复 |
| **新功能设计** | `architect` → `code` | architect 模式设计方案和接口 → code 模式实现 |
| **技术方案评审** | `architect` + `ask` | architect 出方案 → ask 模式评审可行性 |
| **代码理解** | `ask` → `code` | ask 模式分析现有代码 → code 模式修改 |
| **全流程** | `architect` → `code` → `debug` | 设计方案 → 实现 → 测试验证 |

**基本原则：**
- 复杂修改前先用 `architect` 模式设计方案
- 修改后用 `debug` 模式验证
- 不确定的技术问题用 `ask` 模式查询

---

## 约束

1. **始终从记忆加载开始** — 每次维护先读 INDEX.md，避免重复劳动
2. **修改前充分了解** — 至少阅读要修改的类/函数完整代码，不可仅凭推测修改
3. **数据兼容性第一** — 对 localStorage 数据结构的修改必须提供迁移方案
4. **保持纯前端架构** — 不引入后端依赖、不引入构建工具（除非项目明确需要）
5. **向后兼容** — 已有章节数据的格式不得破坏性变更
6. **修改后必验证** — 每次修改后手动测试核心编辑流程
7. **记录所有修改** — 每次维护后在 memory/ 中创建记录并更新 INDEX.md
