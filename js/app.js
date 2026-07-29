/**
 * 写书工具 - 小说编辑应用
 * 支持章节管理、Markdown 编辑与预览、自动保存等
 */

// ======================== 数据层 ========================

const STORAGE_KEY = 'write_book_data';
const THEME_KEY = 'write_book_theme';

const DEFAULT_DATA = {
    chapters: [],
    activeChapterId: null
};

class Storage {
    static load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                // 数据完整性校验
                if (data && Array.isArray(data.chapters) && data.chapters.length > 0) {
                    return data;
                }
            }
        } catch (e) {
            console.warn('数据加载失败，使用默认数据', e);
        }
        return null;
    }

    static save(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('数据保存失败', e);
            return false;
        }
    }

    static export(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `小说备份_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// ======================== 主题管理器 ========================

class ThemeManager {
    static themes = ['green', 'dark', 'paper'];
    static themeNames = {
        green: '护眼绿',
        dark: '暗夜',
        paper: '纸墨'
    };

    static init() {
        const saved = localStorage.getItem(THEME_KEY) || 'green';
        this.apply(saved);
        this._bindEvents();
    }

    static apply(theme) {
        if (!this.themes.includes(theme)) theme = 'green';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    static _bindEvents() {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.apply(btn.dataset.theme);
            });
        });
    }
}

// ======================== Markdown 渲染器 ========================

class MarkdownRenderer {
    /**
     * 将 Markdown 文本渲染为 HTML
     * 支持：标题、粗体、斜体、引用、列表、代码、链接、图片、表格、分隔线
     */
    static render(text) {
        if (!text || !text.trim()) {
            return '<div class="preview-placeholder">✨ 内容为空，开始写作吧</div>';
        }

        // 第一步：提取并保护代码块
        const codeBlocks = [];
        let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
            const index = codeBlocks.length;
            const escaped = code
                .replace(/&/g, '&')
                .replace(/</g, '<')
                .replace(/>/g, '>');
            codeBlocks.push(`<pre><code>${escaped}</code></pre>`);
            return `\x00CODEBLOCK_${index}\x00`;
        });

        // 转义 HTML
        processed = processed
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>');

        // 行内标记处理（在每行中处理）
        const lines = processed.split('\n');
        const blocks = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();

            // 空行
            if (!trimmed) {
                blocks.push({ type: 'blank' });
                i++;
                continue;
            }

            // 恢复代码块标记
            const codeBlockMatch = trimmed.match(/^\x00CODEBLOCK_(\d+)\x00$/);
            if (codeBlockMatch) {
                blocks.push({ type: 'code', content: codeBlocks[parseInt(codeBlockMatch[1])] });
                i++;
                continue;
            }

            // 标题
            const hMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
            if (hMatch) {
                const level = hMatch[1].length;
                const title = this._inlineMarkdown(hMatch[2]);
                blocks.push({ type: `h${level}`, content: `<h${level}>${title}</h${level}>` });
                i++;
                continue;
            }

            // 分隔线
            if (/^---+\s*$/.test(trimmed) || /^\*\*\*+\s*$/.test(trimmed)) {
                blocks.push({ type: 'hr', content: '<hr>' });
                i++;
                continue;
            }

            // 引用块（收集多行）
            if (trimmed.startsWith('>')) {
                const quoteLines = [];
                while (i < lines.length && lines[i].trim().startsWith('>')) {
                    quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
                    i++;
                }
                const quoteContent = quoteLines
                    .map(l => `<p>${this._inlineMarkdown(l)}</p>`)
                    .join('');
                blocks.push({ type: 'blockquote', content: `<blockquote>${quoteContent}</blockquote>` });
                continue;
            }

            // 无序列表（收集连续项）
            if (/^[\*\-]\s/.test(trimmed)) {
                const items = [];
                while (i < lines.length) {
                    const t = lines[i].trim();
                    if (/^[\*\-]\s/.test(t)) {
                        items.push(this._inlineMarkdown(t.replace(/^[\*\-]\s+/, '')));
                        i++;
                    } else if (t === '') {
                        i++; // 跳过空行
                        // 如果下一行还是列表项，继续收集
                        if (i < lines.length && /^[\*\-]\s/.test(lines[i].trim())) {
                            continue;
                        }
                        break;
                    } else {
                        break;
                    }
                }
                const lis = items.map(item => `<li>${item}</li>`).join('');
                blocks.push({ type: 'ul', content: `<ul>${lis}</ul>` });
                continue;
            }

            // 有序列表（收集连续项）
            if (/^\d+\.\s/.test(trimmed)) {
                const items = [];
                while (i < lines.length) {
                    const t = lines[i].trim();
                    const olMatch = t.match(/^\d+\.\s+(.+)$/);
                    if (olMatch) {
                        items.push(this._inlineMarkdown(olMatch[1]));
                        i++;
                    } else if (t === '') {
                        i++;
                        if (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
                            continue;
                        }
                        break;
                    } else {
                        break;
                    }
                }
                const lis = items.map(item => `<li>${item}</li>`).join('');
                blocks.push({ type: 'ol', content: `<ol>${lis}</ol>` });
                continue;
            }

            // 表格行
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                const rows = [];
                let isHeader = true;
                while (i < lines.length) {
                    const t = lines[i].trim();
                    if (!t.startsWith('|') || !t.endsWith('|')) break;
                    
                    const cells = t.split('|').filter(c => c.trim());
                    
                    // 检测分隔行
                    if (cells.every(c => /^[\s\-:]+$/.test(c.trim()))) {
                        isHeader = false;
                        i++;
                        continue;
                    }
                    
                    const tag = isHeader ? 'th' : 'td';
                    const rowCells = cells.map(c => `<${tag}>${this._inlineMarkdown(c.trim())}</${tag}>`).join('');
                    rows.push(`<tr>${rowCells}</tr>`);
                    if (isHeader) isHeader = false;
                    i++;
                }
                if (rows.length > 0) {
                    blocks.push({ type: 'table', content: `<table>${rows.join('')}</table>` });
                }
                continue;
            }

            // 普通段落（收集多行直到空行）
            const paraLines = [trimmed];
            i++;
            while (i < lines.length) {
                const nextTrimmed = lines[i].trim();
                if (!nextTrimmed || /^(#|>|\d+\.\s|[\*\-]\s|\||---)/.test(nextTrimmed)) break;
                if (/^\x00CODEBLOCK_/.test(nextTrimmed)) break;
                paraLines.push(nextTrimmed);
                i++;
            }
            const paraContent = paraLines
                .map(l => this._inlineMarkdown(l))
                .join('<br>');
            blocks.push({ type: 'p', content: `<p>${paraContent}</p>` });
        }

        // 组装最终 HTML
        const html = blocks
            .filter(b => b.type !== 'blank')
            .map(b => b.content)
            .join('\n');

        return html;
    }

    /**
     * 处理行内 Markdown 标记：粗体、斜体、代码、链接、图片
     */
    static _inlineMarkdown(text) {
        if (!text) return '';

        let result = text;

        // 行内代码（先处理，避免干扰其他标记）
        result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 图片
        result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');

        // 链接
        result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // 粗体+斜体 *** ***
        result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        result = result.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

        // 粗体 ** **
        result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');

        // 斜体 * *
        result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
        result = result.replace(/_(.+?)_/g, '<em>$1</em>');

        // 删除线
        result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');

        return result;
    }
}

// ======================== 应用主逻辑 ========================

class App {
    constructor() {
        // 初始化主题
        ThemeManager.init();
        // DOM 引用
        this.els = {
            chapterList: document.getElementById('chapterList'),
            chapterTitleInput: document.getElementById('chapterTitleInput'),
            chapterCount: document.getElementById('chapterCount'),
            editor: document.getElementById('editor'),
            editorPanel: document.getElementById('editorPanel'),
            previewPanel: document.getElementById('previewPanel'),
            previewContent: document.getElementById('previewContent'),
            modeEdit: document.getElementById('modeEdit'),
            modePreview: document.getElementById('modePreview'),
            btnAddChapter: document.getElementById('btnAddChapter'),
            btnSaveToFile: document.getElementById('btnSaveToFile'),
            btnExport: document.getElementById('btnExport'),
            btnRefresh: document.getElementById('btnRefresh'),
            btnShare: document.getElementById('btnShare'),
            btnInsertImage: document.getElementById('btnInsertImage'),
            wordCount: document.getElementById('wordCount'),
            charCount: document.getElementById('charCount'),
            lineCount: document.getElementById('lineCount'),
            bookTitle: document.getElementById('bookTitleDisplay'),
            // 图片插入
            imageFileInput: document.getElementById('imageFileInput'),
            imageModal: document.getElementById('imageModal'),
            imageModalClose: document.getElementById('imageModalClose'),
            imageCancel: document.getElementById('imageCancel'),
            imageConfirm: document.getElementById('imageConfirm'),
            imageUrlInput: document.getElementById('imageUrlInput'),
            btnSelectImage: document.getElementById('btnSelectImage'),
            btnRemoveImage: document.getElementById('btnRemoveImage'),
            imagePreview: document.getElementById('imagePreview'),
            imagePreviewBox: document.getElementById('imagePreviewBox'),
            imageFileInfo: document.getElementById('imageFileInfo'),
            imageUrlPreview: document.getElementById('imageUrlPreview'),
            imageUrlPreviewBox: document.getElementById('imageUrlPreviewBox'),
            imageTabUpload: document.getElementById('imageTabUpload'),
            imageTabUrl: document.getElementById('imageTabUrl'),
            // 重命名弹窗
            renameModal: document.getElementById('renameModal'),
            renameInput: document.getElementById('renameInput'),
            renameConfirm: document.getElementById('renameConfirm'),
            renameCancel: document.getElementById('renameCancel'),
            renameModalClose: document.getElementById('renameModalClose'),
            // 删除弹窗
            deleteModal: document.getElementById('deleteModal'),
            deleteConfirmText: document.getElementById('deleteConfirmText'),
            deleteConfirm: document.getElementById('deleteConfirm'),
            deleteCancel: document.getElementById('deleteCancel'),
            deleteModalClose: document.getElementById('deleteModalClose'),
        };

        // 状态
        this.data = null;
        this.bookMeta = null;
        this.currentMode = 'edit'; // 'edit' | 'preview'
        this.pendingRenameId = null;
        this.pendingDeleteId = null;
        this.pendingImageData = null; // base64 图片数据
        this.pendingImageName = '';   // 图片文件名
        this.imageInsertMode = 'upload'; // 'upload' | 'url'
        this.saveTimer = null;
        this.initialized = false;

        // 启动加载流程
        this._start();
    }

    /**
     * 启动应用：先绑定基本事件，然后加载小说数据
     */
    _start() {
        // 先绑定导出等不依赖数据的事件
        this._bindCoreEvents();

        // 显示加载状态
        this.els.editor.placeholder = '正在加载小说数据...';
        this.els.chapterList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⏳</div>
                <div class="empty-state-text">加载中...</div>
            </div>
        `;

        // 延迟一帧执行，让 UI 先更新
        setTimeout(async () => {
            try {
                await this._loadNovelData();
                this._init();
            } catch (err) {
                console.error('小说数据加载失败', err);
                this.els.editor.placeholder = '⚠️ 数据加载失败，请检查 data/novel.js 是否存在';
                this.els.chapterList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <div class="empty-state-text">数据加载失败，请刷新重试</div>
                    </div>
                `;
            }
        }, 0);
    }

    // ===================== 数据管理 =====================

    /**
     * 加载小说数据
     * 优先通过 /api/novel 接口从磁盘读取最新数据（与「刷新」按钮逻辑一致）
     * 接口不可用时降级到 window.__NOVEL_DATA__（用于无后端场景）
     */
    async _loadNovelData() {
        // 优先尝试通过服务器 API 获取最新数据
        let novelData = null;
        try {
            const resp = await fetch('/api/novel', { cache: 'no-store' });
            if (resp.ok) {
                novelData = await resp.json();
            }
        } catch (e) {
            console.warn('[加载] API 方式失败，降级到 novel.js 数据:', e);
        }

        // 降级：使用 data/novel.js 注入的数据
        if (!novelData || !novelData.chapters || novelData.chapters.length === 0) {
            if (window.__NOVEL_READY__) {
                await window.__NOVEL_READY__;
            }
            novelData = window.__NOVEL_DATA__;
        }

        if (!novelData || !novelData.chapters || novelData.chapters.length === 0) {
            throw new Error('小说数据为空，请检查 data/novel.js 文件');
        }

        // 保存书籍元信息
        this.bookMeta = novelData.book || {};

        // 显示书名
        if (this.els.bookTitle && this.bookMeta.title) {
            this.els.bookTitle.textContent = `《${this.bookMeta.title}》`;
            document.title = `${this.bookMeta.title} - 写书工具`;
        }

        // 从 JSON 文件直接构建数据（始终以文件内容为准）
        this.data = {
            chapters: novelData.chapters.map(ch => ({
                id: ch.id,
                title: ch.title,
                content: ch.content || ''
            })),
            activeChapterId: novelData.chapters.length > 0 ? novelData.chapters[0].id : null
        };

        // 写入 localStorage 作为编辑会话的缓存
        Storage.save(this.data);
    }

    _saveData() {
        if (this.data) {
            Storage.save(this.data);
        }
    }

    _getActiveChapter() {
        if (!this.data) return null;
        return this.data.chapters.find(ch => ch.id === this.data.activeChapterId);
    }

    // ===================== 初始化 =====================

    _init() {
        if (!this.data || this.data.chapters.length === 0) {
            // 没有数据时显示空状态
            this.els.chapterList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📄</div>
                    <div class="empty-state-text">暂无章节，请检查 data/novel.json 文件</div>
                </div>
            `;
            return;
        }

        this._renderChapterList();
        this._loadActiveChapter();
        this._updateChapterCount();
        this._bindEvents();
        this.initialized = true;
    }

    // ===================== 事件绑定 =====================

    /**
     * 绑定不依赖数据加载的核心事件（在 _start 中尽早绑定）
     */
    _bindCoreEvents() {
        // 导出按钮（提前绑定，但需要数据就绪）
        this.els.btnExport.addEventListener('click', () => {
            if (this.data) {
                Storage.export(this.data);
            }
        });

        // 保存到文件按钮
        this.els.btnSaveToFile.addEventListener('click', () => {
            if (this.data) {
                this._saveToJsonFile();
            }
        });

        // 刷新按钮 — 从 JSON 文件重新拉取最新内容
        this.els.btnRefresh.addEventListener('click', () => {
            if (this.data) {
                this._refreshFromJson().catch(err => {
                    console.error('[刷新] 发生错误:', err);
                });
            }
        });

        // 分享按钮
        if (this.els.btnShare) {
            this.els.btnShare.addEventListener('click', () => {
                if (this.data) {
                    this._shareBook();
                }
            });
        }
    }

    /**
     * 绑定所有需要数据就绪的事件（在 _init 中绑定）
     */
    _bindEvents() {
        // 模式切换
        this.els.modeEdit.addEventListener('click', () => this._switchMode('edit'));
        this.els.modePreview.addEventListener('click', () => this._switchMode('preview'));

        // 新增章节
        this.els.btnAddChapter.addEventListener('click', () => this._addChapter());

        // 图片插入按钮
        if (this.els.btnInsertImage) {
            this.els.btnInsertImage.addEventListener('click', () => this._openImageModal());
        }

        // 图片弹窗关闭
        if (this.els.imageModalClose) {
            this.els.imageModalClose.addEventListener('click', () => this._closeImageModal());
        }
        if (this.els.imageCancel) {
            this.els.imageCancel.addEventListener('click', () => this._closeImageModal());
        }
        if (this.els.imageModal) {
            this.els.imageModal.addEventListener('click', (e) => {
                if (e.target === this.els.imageModal) this._closeImageModal();
            });
        }

        // 图片确认插入
        if (this.els.imageConfirm) {
            this.els.imageConfirm.addEventListener('click', () => this._confirmInsertImage());
        }

        // 图片 URL 输入实时预览
        if (this.els.imageUrlInput) {
            this.els.imageUrlInput.addEventListener('input', () => this._previewImageUrl());
            this.els.imageUrlInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this._confirmInsertImage();
                if (e.key === 'Escape') this._closeImageModal();
            });
        }

        // 图片文件选择
        if (this.els.btnSelectImage) {
            this.els.btnSelectImage.addEventListener('click', () => {
                if (this.els.imageFileInput) this.els.imageFileInput.click();
            });
        }
        if (this.els.imageFileInput) {
            this.els.imageFileInput.addEventListener('change', (e) => this._handleFileSelect(e));
        }

        // 移除已选图片
        if (this.els.btnRemoveImage) {
            this.els.btnRemoveImage.addEventListener('click', () => this._clearImageFile());
        }

        // 图片弹窗标签切换
        document.querySelectorAll('.image-tab').forEach(tab => {
            tab.addEventListener('click', () => this._switchImageTab(tab.dataset.tab));
        });

        // 编辑器粘贴（支持粘贴图片）
        this.els.editor.addEventListener('paste', (e) => this._handleImagePaste(e));

        // 编辑器拖拽上传
        this.els.editor.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.els.editor.style.outline = '2px dashed var(--accent)';
        });
        this.els.editor.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.els.editor.style.outline = 'none';
        });
        this.els.editor.addEventListener('drop', (e) => this._handleImageDrop(e));

        // 编辑器输入（自动保存 + 统计）
        this.els.editor.addEventListener('input', () => {
            this._scheduleSave();
            this._updateStats();
        });

        // 章节标题修改
        this.els.chapterTitleInput.addEventListener('change', () => {
            const ch = this._getActiveChapter();
            if (ch) {
                ch.title = this.els.chapterTitleInput.value.trim() || ch.title;
                this.els.chapterTitleInput.value = ch.title;
                this._saveData();
                this._renderChapterList();
            }
        });

        // 重命名弹窗
        this.els.renameConfirm.addEventListener('click', () => this._confirmRename());
        this.els.renameCancel.addEventListener('click', () => this._closeRenameModal());
        this.els.renameModalClose.addEventListener('click', () => this._closeRenameModal());
        this.els.renameModal.addEventListener('click', (e) => {
            if (e.target === this.els.renameModal) this._closeRenameModal();
        });
        this.els.renameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._confirmRename();
            if (e.key === 'Escape') this._closeRenameModal();
        });

        // 删除弹窗
        this.els.deleteConfirm.addEventListener('click', () => this._confirmDelete());
        this.els.deleteCancel.addEventListener('click', () => this._closeDeleteModal());
        this.els.deleteModalClose.addEventListener('click', () => this._closeDeleteModal());
        this.els.deleteModal.addEventListener('click', (e) => {
            if (e.target === this.els.deleteModal) this._closeDeleteModal();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            // Ctrl+S 保存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this._saveNow();
            }
            // Ctrl+Shift+P 切换预览
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                this._switchMode(this.currentMode === 'edit' ? 'preview' : 'edit');
            }
            // Ctrl+N 新增章节
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this._addChapter();
            }
            // Escape 关闭弹窗
            if (e.key === 'Escape') {
                this._closeRenameModal();
                this._closeDeleteModal();
            }
        });
    }

    // ===================== 模式切换 =====================

    _switchMode(mode) {
        if (mode === this.currentMode) return;

        // 保存当前模式的滚动位置（按百分比）
        const scrollPercent = this._getScrollPercent();

        this.currentMode = mode;

        // 更新按钮状态
        this.els.modeEdit.classList.toggle('active', mode === 'edit');
        this.els.modePreview.classList.toggle('active', mode === 'preview');

        // 切换面板
        if (mode === 'edit') {
            this.els.editorPanel.style.display = 'flex';
            this.els.previewPanel.style.display = 'none';
        } else {
            this.els.editorPanel.style.display = 'none';
            this.els.previewPanel.style.display = 'block';
            this._renderPreview();
        }

        // 在下一帧恢复滚动位置，确保 DOM 已完成渲染
        requestAnimationFrame(() => {
            this._restoreScrollPercent(scrollPercent);
        });
    }

    /**
     * 获取当前可见面板的滚动百分比 (0~1)
     */
    _getScrollPercent() {
        if (this.currentMode === 'edit') {
            const el = this.els.editor;
            if (el && el.scrollHeight > el.clientHeight) {
                return el.scrollTop / (el.scrollHeight - el.clientHeight);
            }
        } else {
            const el = this.els.previewPanel;
            if (el && el.scrollHeight > el.clientHeight) {
                return el.scrollTop / (el.scrollHeight - el.clientHeight);
            }
        }
        return 0;
    }

    /**
     * 按百分比恢复滚动位置
     */
    _restoreScrollPercent(percent) {
        if (this.currentMode === 'edit') {
            const el = this.els.editor;
            if (el) {
                el.scrollTop = percent * (el.scrollHeight - el.clientHeight);
            }
        } else {
            const el = this.els.previewPanel;
            if (el) {
                el.scrollTop = percent * (el.scrollHeight - el.clientHeight);
            }
        }
    }

    // ===================== 章节渲染 =====================

    _renderChapterList() {
        const list = this.els.chapterList;
        list.innerHTML = '';

        if (this.data.chapters.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📄</div>
                    <div class="empty-state-text">还没有章节，点击上方按钮新增</div>
                </div>
            `;
            return;
        }

        this.data.chapters.forEach((ch, index) => {
            const item = document.createElement('div');
            item.className = `chapter-item${ch.id === this.data.activeChapterId ? ' active' : ''}`;
            item.dataset.id = ch.id;

            // 获取预览文本（用于显示摘要）
            const previewText = ch.content
                .replace(/[#*`>\[\]()_\-]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 30);

            item.innerHTML = `
                <span class="chapter-number">${index + 1}</span>
                <span class="chapter-name" title="${this._escapeHtml(ch.title)}${previewText ? ' — ' + this._escapeHtml(previewText) + '...' : ''}">${this._escapeHtml(ch.title)}</span>
                <div class="chapter-item-actions">
                    <button class="btn-icon rename-btn" title="重命名">✏️</button>
                    <button class="btn-icon danger delete-btn" title="删除">🗑️</button>
                </div>
            `;

            // 点击切换章节
            item.addEventListener('click', (e) => {
                // 如果点击的是按钮，不切换
                if (e.target.closest('.btn-icon')) return;
                this._switchChapter(ch.id);
            });

            // 重命名按钮
            item.querySelector('.rename-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this._openRenameModal(ch.id);
            });

            // 删除按钮
            item.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this._openDeleteModal(ch.id);
            });

            list.appendChild(item);
        });
    }

    _loadActiveChapter() {
        const ch = this._getActiveChapter();
        if (ch) {
            this.els.chapterTitleInput.value = ch.title;
            this.els.editor.value = ch.content;
            this._updateStats();
        }
    }

    _updateChapterCount() {
        const count = this.data.chapters.length;
        this.els.chapterCount.textContent = `${count} 章`;
    }

    // ===================== 章节操作 =====================

    _switchChapter(chapterId) {
        // 保存当前章节内容
        this._saveCurrentChapter();

        this.data.activeChapterId = chapterId;
        this._saveData();

        this._renderChapterList();
        this._loadActiveChapter();

        // 如果在预览模式，刷新预览
        if (this.currentMode === 'preview') {
            this._renderPreview();
        }
    }

    _addChapter() {
        const count = this.data.chapters.length;
        const id = `ch_${Date.now()}`;
        const title = `第${count + 1}章`;

        this.data.chapters.push({ id, title, content: '' });
        this.data.activeChapterId = id;
        this._saveData();

        this._renderChapterList();
        this._loadActiveChapter();
        this._updateChapterCount();

        // 聚焦编辑器
        this.els.editor.focus();

        // 如果在预览模式，切换回编辑模式
        if (this.currentMode === 'preview') {
            this._switchMode('edit');
        }
    }

    _openRenameModal(chapterId) {
        const ch = this.data.chapters.find(c => c.id === chapterId);
        if (!ch) return;

        this.pendingRenameId = chapterId;
        this.els.renameInput.value = ch.title;
        this.els.renameModal.style.display = 'flex';
        setTimeout(() => this.els.renameInput.focus(), 100);
        this.els.renameInput.select();
    }

    _confirmRename() {
        const newName = this.els.renameInput.value.trim();
        if (!newName) return;

        const ch = this.data.chapters.find(c => c.id === this.pendingRenameId);
        if (ch) {
            ch.title = newName;
            this._saveData();
            this._renderChapterList();

            // 如果重命名的是当前章节，更新标题输入框
            if (this.data.activeChapterId === this.pendingRenameId) {
                this.els.chapterTitleInput.value = newName;
            }
        }

        this._closeRenameModal();
    }

    _closeRenameModal() {
        this.els.renameModal.style.display = 'none';
        this.pendingRenameId = null;
    }

    _openDeleteModal(chapterId) {
        if (this.data.chapters.length <= 1) {
            alert('至少保留一个章节');
            return;
        }

        const ch = this.data.chapters.find(c => c.id === chapterId);
        if (!ch) return;

        this.pendingDeleteId = chapterId;
        this.els.deleteConfirmText.textContent = `确定要删除「${ch.title}」吗？此操作不可撤销。`;
        this.els.deleteModal.style.display = 'flex';
    }

    _confirmDelete() {
        const index = this.data.chapters.findIndex(c => c.id === this.pendingDeleteId);
        if (index === -1) return;

        this.data.chapters.splice(index, 1);

        // 如果删除的是当前章节，切换到最后一个
        if (this.data.activeChapterId === this.pendingDeleteId) {
            const lastIndex = Math.min(index, this.data.chapters.length - 1);
            this.data.activeChapterId = this.data.chapters[lastIndex].id;
        }

        this._saveData();
        this._renderChapterList();
        this._loadActiveChapter();
        this._updateChapterCount();

        if (this.currentMode === 'preview') {
            this._renderPreview();
        }

        this._closeDeleteModal();
    }

    _closeDeleteModal() {
        this.els.deleteModal.style.display = 'none';
        this.pendingDeleteId = null;
    }

    // ===================== 编辑与保存 =====================

    _saveCurrentChapter() {
        const ch = this._getActiveChapter();
        if (ch) {
            ch.content = this.els.editor.value;
            ch.title = this.els.chapterTitleInput.value.trim() || ch.title;
            this.els.chapterTitleInput.value = ch.title;
        }
    }

    _saveNow() {
        this._saveCurrentChapter();
        this._saveData();
        // 显示保存成功提示
        this._showSaveIndicator();
    }

    _scheduleSave() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => {
            this._saveCurrentChapter();
            this._saveData();
        }, 500);
    }

    _showSaveIndicator(btn) {
        if (!btn) btn = this.els.btnExport;
        const originalText = btn.textContent;
        const originalColor = btn.style.color;
        btn.textContent = '✅ 已保存';
        btn.style.color = '#2ecc71';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.color = originalColor;
        }, 1500);
    }

    /**
     * 将编辑后的内容保存到对应的章节 JSON 文件
     * 通过本地服务器 API 写入 data/chapters/<id>.json
     * 服务器不可用时降级为下载
     */
    async _saveToJsonFile() {
        // 先保存当前正在编辑的章节
        this._saveCurrentChapter();
        this._saveData();

        // 当前章节
        const ch = this._getActiveChapter();
        if (!ch) {
            alert('没有可保存的章节');
            return;
        }

        // 查找原始章节保留 summary
        const original = window.__NOVEL_DATA__?.chapters?.find(oc => oc.id === ch.id);

        // 构建当前章节数据
        const chapterData = {
            id: ch.id,
            title: ch.title,
            summary: original?.summary || '',
            content: ch.content
        };

        // 构建完整数据（供后端写入 novel.json + 重新生成 novel.js）
        const fullData = {
            book: this.bookMeta || {
                title: '星落之城',
                author: '未命名',
                genre: '都市言情',
                description: '',
                createdAt: new Date().toISOString().split('T')[0]
            },
            chapters: this.data.chapters.map(c => {
                const orig = window.__NOVEL_DATA__?.chapters?.find(oc => oc.id === c.id);
                return {
                    id: c.id,
                    title: c.title,
                    summary: orig?.summary || '',
                    content: c.content
                };
            })
        };

        // 同步更新内存
        window.__NOVEL_DATA__ = fullData;

        // 通过服务器 API 保存（写入 data/chapters/<id>.json + 更新 novel.js）
        try {
            const resp = await fetch('/api/novel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fullData)
            });

            if (resp.ok) {
                // 额外单独保存当前章节文件（确保即时性）
                await fetch('/api/chapter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(chapterData)
                });
                this._showSaveIndicator(this.els.btnSaveToFile);
                return;
            }
        } catch (e) {
            console.warn('服务器 API 保存失败，降级到下载', e);
        }

        // 降级方案：下载当前章节的 JSON 文件
        const jsonStr = JSON.stringify(chapterData, null, 4);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ch.id + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this._showSaveIndicator(this.els.btnSaveToFile);
    }

    // ===================== 统计信息 =====================

    _updateStats() {
        const text = this.els.editor.value;
        const wordCount = this._countWords(text);
        const charCount = text.length;
        const lineCount = text ? text.split('\n').length : 0;

        this.els.wordCount.textContent = `字数: ${wordCount}`;
        this.els.charCount.textContent = `字符: ${charCount}`;
        this.els.lineCount.textContent = `行数: ${lineCount}`;
    }

    _countWords(text) {
        // 中文按字计数，英文按单词计数
        const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
        const englishWords = text
            .replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ')
            .split(/[\s,;.!?，。；！？、\n]+/)
            .filter(w => w.length > 0).length;
        return chineseChars + englishWords;
    }

    // ===================== 预览渲染 =====================

    _renderPreview() {
        const ch = this._getActiveChapter();
        if (!ch) {
            this.els.previewContent.innerHTML = '<div class="preview-placeholder">请选择一个章节</div>';
            return;
        }

        const html = MarkdownRenderer.render(ch.content);
        this.els.previewContent.innerHTML = html;
    }

    // ===================== 分享 =====================

    /**
     * 分享流程（本地后端版）：
     * 1. 保存当前编辑内容到 localStorage
     * 2. 调用本地服务器 API 保存到 novel.json
     * 3. 获取服务器返回的局域网 IP，复制阅读页链接
     * 4. 如果服务器未运行，引导用户启动 server.py
     */
    async _shareBook() {
        // 先保存当前编辑内容
        this._saveCurrentChapter();
        this._saveData();

        const btn = this.els.btnShare;
        const origText = btn.textContent;

        // 尝试连接本地服务器
        let serverInfo = null;
        try {
            const resp = await fetch('/api/info', { method: 'GET', timeout: 3000 });
            if (resp.ok) {
                serverInfo = await resp.json();
            }
        } catch (e) {
            // 服务器未运行或不是通过服务器访问
            console.log('未检测到本地服务器', e);
        }

        if (serverInfo) {
            // 服务器已运行：保存数据到服务器，然后复制链接
            try {
                const saveResp = await fetch('/api/novel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        book: this.bookMeta || { title: '未命名', author: '' },
                        chapters: this.data.chapters.map(ch => ({
                            id: ch.id,
                            title: ch.title,
                            content: ch.content || ''
                        }))
                    })
                });
                if (saveResp.ok) {
                    const url = serverInfo.reader_url;
                    this._copyToClipboard(url, btn, origText);
                    // 显示局域网提示
                    setTimeout(() => {
                        btn.textContent = '📡 局域网链接已复制';
                        setTimeout(() => { btn.textContent = origText; }, 3000);
                    }, 2000);
                    return;
                }
            } catch (e) {
                console.warn('保存到服务器失败', e);
            }
        }

        // 服务器未运行：引导用户启动
        const guide = [
            '📢 分享需要先启动本地服务器',
            '',
            '步骤：',
            '1. 双击运行项目根目录下的 server.py',
            '2. 服务器启动后会显示局域网地址（如 http://192.168.x.x:8000）',
            '3. 保持 server.py 运行，同一 WiFi 下的设备即可访问',
            '4. 再次点击「🔗 分享」按钮，自动复制阅读页链接',
            '',
            '提示：服务器运行期间，你的电脑需保持开机且连接同一 WiFi。',
            '',
            '是否现在尝试启动 server.py？（需要 Python 环境）'
        ].join('\n');

        if (confirm(guide)) {
            // 尝试用默认程序打开 server.py（Windows 会调用 Python）
            window.open('server.py', '_blank');
            alert('如果浏览器下载了 server.py，请手动双击运行它。\n运行成功后，再次点击分享按钮即可。');
        }
    }

    _copyToClipboard(text, btn, origText) {
        const done = () => {
            btn.textContent = '✅ 链接已复制';
            setTimeout(() => { btn.textContent = origText; }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => {
                this._fallbackCopy(text);
                done();
            });
        } else {
            this._fallbackCopy(text);
            done();
        }
    }

    _fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { console.warn('复制失败', e); }
        document.body.removeChild(ta);
    }

    // ===================== 从 JSON 文件刷新 =====================

    /**
     * 通过服务器 API 从 data/chapters/*.json 重新拉取所有章节的最新内容
     * 先保存当前编辑内容，再通过 /api/novel 获取磁盘上的最新数据
     */
    async _refreshFromJson() {
        const btn = this.els.btnRefresh;
        if (!btn) return;

        const origText = btn.textContent;
        btn.textContent = '⏳ 刷新中...';
        btn.disabled = true;

        try {
            // 先保存当前正在编辑的内容
            this._saveCurrentChapter();

            // 尝试通过服务器 API 获取最新数据（优先）
            let freshChapters = null;
            try {
                const resp = await fetch('/api/novel', { cache: 'no-store' });
                if (resp.ok) {
                    const serverData = await resp.json();
                    if (serverData && serverData.chapters && serverData.chapters.length > 0) {
                        freshChapters = serverData.chapters.map(sv => ({
                            id: sv.id,
                            title: sv.title || '',
                            content: sv.content || ''
                        }));
                    }
                }
            } catch (apiErr) {
                console.warn('[刷新] API 方式失败，降级到直接 fetch 章节文件:', apiErr);
            }

            // 降级方案：直接 fetch 每个章节的 JSON 文件
            if (!freshChapters) {
                const base = 'data/chapters/';
                const results = await Promise.all(this.data.chapters.map(async (ch) => {
                    try {
                        const resp = await fetch(base + ch.id + '.json', { cache: 'no-store' });
                        if (resp.ok) {
                            const data = await resp.json();
                            return { id: ch.id, title: data.title || ch.title, content: data.content || '' };
                        }
                    } catch (e) {
                        console.warn('[刷新] 拉取 ' + ch.id + ' 失败:', e);
                    }
                    return null;
                }));
                freshChapters = results.filter(Boolean);
            }

            if (!freshChapters || freshChapters.length === 0) {
                throw new Error('无法获取章节数据');
            }

            // 对比新旧数据，统计变化
            let changedCount = 0;
            freshChapters.forEach((fresh) => {
                const old = this.data.chapters.find(c => c.id === fresh.id);
                if (old) {
                    if (old.content !== fresh.content || old.title !== fresh.title) {
                        changedCount++;
                    }
                    Object.assign(old, fresh);
                }
            });

            // 如果有变化则更新 UI
            if (changedCount > 0) {
                this._saveData();
                this._renderChapterList();
                this._loadActiveChapter();
                if (this.currentMode === 'preview') {
                    this._renderPreview();
                }
                btn.textContent = '✅ 已刷新 ' + changedCount + ' 章';
            } else {
                btn.textContent = '✅ 已是最新';
            }
        } catch (e) {
            console.error('[刷新] 刷新失败:', e);
            btn.textContent = '❌ 刷新失败';
        }

        // 恢复按钮状态
        setTimeout(() => {
            btn.textContent = origText;
            btn.disabled = false;
        }, 2500);
    }

    // ===================== 工具方法 =====================

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===================== 图片插入 =====================

    /**
     * 打开图片插入弹窗
     */
    _openImageModal() {
        this.pendingImageData = null;
        this.pendingImageName = '';
        this.imageInsertMode = 'upload';

        // 重置状态
        if (this.els.imageUrlInput) this.els.imageUrlInput.value = '';
        if (this.els.imageFileInput) this.els.imageFileInput.value = '';
        this._clearImageFile();
        this._hideUrlPreview();

        // 重置到上传标签
        this._switchImageTab('upload');

        if (this.els.imageModal) {
            this.els.imageModal.style.display = 'flex';
        }
    }

    /**
     * 关闭图片插入弹窗
     */
    _closeImageModal() {
        if (this.els.imageModal) {
            this.els.imageModal.style.display = 'none';
        }
        this.pendingImageData = null;
        this.pendingImageName = '';
        if (this.els.editor) this.els.editor.focus();
    }

    /**
     * 切换图片插入模式标签
     * @param {string} mode - 'upload' | 'url'
     */
    _switchImageTab(mode) {
        this.imageInsertMode = mode;

        // 切换标签按钮状态
        document.querySelectorAll('.image-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === mode);
        });

        // 切换内容面板
        if (this.els.imageTabUpload) {
            this.els.imageTabUpload.style.display = mode === 'upload' ? 'block' : 'none';
        }
        if (this.els.imageTabUrl) {
            this.els.imageTabUrl.style.display = mode === 'url' ? 'block' : 'none';
        }

        // 聚焦到对应输入
        if (mode === 'url' && this.els.imageUrlInput) {
            setTimeout(() => this.els.imageUrlInput.focus(), 100);
        }
    }

    /**
     * 处理选择的图片文件
     */
    _handleFileSelect(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件（PNG、JPG、GIF、WebP）');
            return;
        }

        // 验证文件大小（限制 10MB）
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            alert(`图片文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请选择小于 10MB 的图片`);
            return;
        }

        this.pendingImageName = file.name;

        // 读取文件为 base64
        const reader = new FileReader();
        reader.onload = (ev) => {
            this.pendingImageData = ev.target.result;

            // 显示预览
            if (this.els.imagePreview) {
                this.els.imagePreview.src = this.pendingImageData;
            }
            if (this.els.imagePreviewBox) {
                this.els.imagePreviewBox.style.display = 'block';
            }
            if (this.els.imageFileInfo) {
                const sizeStr = file.size > 1024 * 1024
                    ? (file.size / 1024 / 1024).toFixed(1) + ' MB'
                    : (file.size / 1024).toFixed(0) + ' KB';
                this.els.imageFileInfo.textContent = `${file.name}（${sizeStr}）`;
            }

            // 自动切换到上传标签
            if (this.imageInsertMode !== 'upload') {
                this._switchImageTab('upload');
            }
        };
        reader.onerror = () => {
            alert('图片读取失败，请重试');
        };
        reader.readAsDataURL(file);
    }

    /**
     * 清除已选择的图片文件
     */
    _clearImageFile() {
        this.pendingImageData = null;
        this.pendingImageName = '';
        if (this.els.imagePreview) this.els.imagePreview.src = '';
        if (this.els.imagePreviewBox) this.els.imagePreviewBox.style.display = 'none';
        if (this.els.imageFileInput) this.els.imageFileInput.value = '';
    }

    /**
     * 预览 URL 图片
     */
    _previewImageUrl() {
        const url = this.els.imageUrlInput.value.trim();
        if (!url) {
            this._hideUrlPreview();
            return;
        }

        // 简单 URL 格式校验
        if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)(\?.*)?$/i.test(url) && !/^https?:\/\/.+/.test(url)) {
            this._hideUrlPreview();
            return;
        }

        if (this.els.imageUrlPreviewBox) {
            this.els.imageUrlPreviewBox.style.display = 'block';
            this.els.imageUrlPreviewBox.innerHTML = '<img src="' + this._escapeHtml(url) + '" alt="URL 预览" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=\\\\\'url-preview-error\\\\\'>\\u26a0\\ufe0f \\u65e0\\u6cd5\\u52a0\\u8f7d\\u6b64\\u56fe\\u7247\\uff0c\\u8bf7\\u68c0\\u67e5\\u94fe\\u63a5\\u662f\\u5426\\u6b63\\u786e</div>\'">';
        }
    }

    /**
     * 隐藏 URL 预览
     */
    _hideUrlPreview() {
        if (this.els.imageUrlPreviewBox) {
            this.els.imageUrlPreviewBox.style.display = 'none';
            this.els.imageUrlPreviewBox.innerHTML = '';
        }
    }

    /**
     * 确认插入图片
     */
    _confirmInsertImage() {
        if (this.imageInsertMode === 'upload') {
            // 上传模式：使用已读取的 base64 数据
            if (!this.pendingImageData) {
                alert('请先选择一张图片');
                return;
            }
            this._insertImageToEditor(this.pendingImageData, this.pendingImageName);
            this._closeImageModal();
        } else {
            // URL 模式
            const url = this.els.imageUrlInput.value.trim();
            if (!url) {
                alert('请输入图片 URL');
                return;
            }
            // 简单 URL 格式校验
            if (!/^https?:\/\//i.test(url)) {
                alert('请输入有效的图片 URL（以 http:// 或 https:// 开头）');
                return;
            }
            this._insertImageToEditor(url, '');
            this._closeImageModal();
        }
    }

    /**
     * 在编辑器光标位置插入图片 Markdown
     * @param {string} src - 图片地址（URL 或 base64）
     * @param {string} fileName - 文件名（用于描述）
     */
    _insertImageToEditor(src, fileName) {
        const editor = this.els.editor;
        if (!editor) return;

        // 生成图片描述
        const desc = fileName
            ? fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
            : '插图';

        // 构造 Markdown 图片语法
        const imageMarkdown = '\n![' + desc + '](' + src + ')\n';

        // 在光标位置插入
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const text = editor.value;
        const before = text.substring(0, start);
        const after = text.substring(end);

        editor.value = before + imageMarkdown + after;

        // 移动光标到插入内容之后
        const newPos = start + imageMarkdown.length;
        editor.selectionStart = newPos;
        editor.selectionEnd = newPos;
        editor.focus();

        // 触发 input 事件以保存和统计
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * 处理剪贴板粘贴事件（支持粘贴图片）
     */
    _handleImagePaste(e) {
        const items = e.clipboardData && e.clipboardData.items;
        if (!items) return;

        let imageFile = null;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                imageFile = item.getAsFile();
                break;
            }
        }

        if (!imageFile) return;

        // 阻止默认粘贴行为（防止粘贴图片的二进制内容）
        e.preventDefault();

        // 验证文件大小
        const maxSize = 10 * 1024 * 1024;
        if (imageFile.size > maxSize) {
            alert(`图片过大（${(imageFile.size / 1024 / 1024).toFixed(1)}MB），请使用小于 10MB 的图片`);
            return;
        }

        // 读取并插入
        const reader = new FileReader();
        reader.onload = (ev) => {
            this._insertImageToEditor(ev.target.result, '粘贴的图片');
        };
        reader.readAsDataURL(imageFile);
    }

    /**
     * 处理拖拽放置事件（支持拖拽图片）
     */
    _handleImageDrop(e) {
        e.preventDefault();
        e.stopPropagation();

        // 移除拖拽高亮
        this.els.editor.style.outline = 'none';

        const files = e.dataTransfer && e.dataTransfer.files;
        if (!files || files.length === 0) {
            return;
        }

        let imageFile = null;
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                imageFile = file;
                break;
            }
        }

        if (!imageFile) {
            return;
        }

        // 验证文件大小
        const maxSize = 10 * 1024 * 1024;
        if (imageFile.size > maxSize) {
            alert(`图片过大（${(imageFile.size / 1024 / 1024).toFixed(1)}MB），请使用小于 10MB 的图片`);
            return;
        }

        // 读取并插入
        const reader = new FileReader();
        reader.onload = (ev) => {
            this._insertImageToEditor(ev.target.result, imageFile.name);
        };
        reader.readAsDataURL(imageFile);
    }
}

// ======================== 启动应用 ========================

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
