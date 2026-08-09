/**
 * 阅读页面逻辑
 * 支持：URL 数据解码、章节渲染、目录导航、主题切换、上下章翻页
 */

// ======================== 主题管理 ========================

const { THEME_KEY } = window.APP_CONFIG;

function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'paper';
    applyTheme(saved);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
    });
}

function applyTheme(theme) {
    if (!['dark', 'green', 'paper'].includes(theme)) theme = 'paper';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

// ======================== Markdown 渲染器（共享，见 js/markdown.js） ========================

const MarkdownRenderer = window.MarkdownRenderer;

// ======================== 数据解码 ========================

/**
 * 从 URL hash 中解码分享数据
 * 格式：#d=<base64url编码的JSON>
 */
function decodeShareData() {
    const hash = window.location.hash;
    if (!hash || hash.length < 3) return null;
    const m = hash.match(/#d=([A-Za-z0-9\-_]+)/);
    if (!m) return null;
    try {
        // base64url -> base64
        let b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
        // 补齐 padding
        while (b64.length % 4) b64 += '=';
        // 解码为 UTF-8 字符串
        const binStr = atob(b64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        const jsonStr = new TextDecoder('utf-8').decode(bytes);
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('分享数据解码失败', e);
        return null;
    }
}

// ======================== 阅读应用 ========================

class ReaderApp {
    constructor() {
        this.els = {
            bookTitle: document.getElementById('bookTitle'),
            chapterTitle: document.getElementById('chapterTitle'),
            content: document.getElementById('content'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            tocFab: document.getElementById('tocFab'),
            tocPanel: document.getElementById('tocPanel'),
            tocList: document.getElementById('tocList')
        };
        this.data = null;
        this.currentIndex = 0;
        this._init();
    }

    async _init() {
        try {
            await this._load();
            this._renderToc();
            this._renderChapter();
            this._bindEvents();
        } catch (e) {
            console.error('阅读页数据加载失败', e);
            this.els.chapterTitle.textContent = '数据加载失败';
            this.els.content.innerHTML = '<div class="empty">⚠️ 未找到小说数据<br><small>请通过分享链接访问，或确保 data/novel.js 存在</small></div>';
        }
    }

    async _load() {
        // 优先从 URL hash 读取分享数据
        const shareData = decodeShareData();
        if (shareData && shareData.chapters && shareData.chapters.length > 0) {
            this.data = shareData;
        } else {
            // 等待异步章节加载完成
            // 等待 NOVEL_DATA 就绪（data/novel.js 同步加载后设置 window.__NOVEL_DATA__）
            if (window.__NOVEL_READY__) {
                await window.__NOVEL_READY__;
            }
            if (window.__NOVEL_DATA__ && window.__NOVEL_DATA__.chapters) {
                // 回退到本地数据
                this.data = window.__NOVEL_DATA__;
            } else {
                throw new Error('未找到小说数据');
            }

            // 如果章节缺少 content，从单独的章节文件异步加载
            if (typeof this._loadChapterContents === 'function') {
                await this._loadChapterContents();
            }
        }

        // 解析 URL 中的章节参数
        const params = new URLSearchParams(window.location.search);
        const chId = params.get('ch');
        if (chId) {
            const idx = this.data.chapters.findIndex(c => c.id === chId);
            if (idx >= 0) this.currentIndex = idx;
        }

        const book = this.data.book || {};
        this.els.bookTitle.textContent = book.title ? '《' + book.title + '》' + (book.author ? ' · ' + book.author : '') : '';
        document.title = (book.title || '阅读') + ' - 阅读';
    }

    /**
     * 异步加载章节正文内容
     * 当 data/novel.js 中的 chapters 缺少 content 字段时，
     * 从 data/chapters/ 目录下加载对应的章节 JSON 文件
     */
    async _loadChapterContents() {
        const chapters = this.data.chapters;
        const loadPromises = chapters.map(async (ch) => {
            // 如果已有内容则跳过
            if (ch.content) return;
            try {
                const resp = await fetch('data/chapters/' + ch.id + '.json');
                if (!resp.ok) return;
                const data = await resp.json();
                if (data && data.content) {
                    ch.content = data.content;
                }
            } catch (e) {
                // 静默失败，单个章节加载失败不影响其他章节
                console.warn('章节内容加载失败: ' + ch.id, e);
            }
        });
        await Promise.all(loadPromises);
    }

    _renderChapter() {
        const ch = this.data.chapters[this.currentIndex];
        if (!ch) {
            this.els.chapterTitle.textContent = '章节不存在';
            this.els.content.innerHTML = '<div class="empty">未找到该章节</div>';
            return;
        }
        this.els.chapterTitle.textContent = ch.title;
        this.els.content.innerHTML = MarkdownRenderer.render(ch.content || '', '<div class="empty">✨ 本章节暂无内容</div>');
        document.title = ch.title + ' - ' + ((this.data.book && this.data.book.title) || '阅读');

        // 翻页按钮
        const hasPrev = this.currentIndex > 0;
        const hasNext = this.currentIndex < this.data.chapters.length - 1;
        this._setNavBtn(this.els.prevBtn, hasPrev, this.currentIndex - 1);
        this._setNavBtn(this.els.nextBtn, hasNext, this.currentIndex + 1);

        // 更新目录高亮
        this.els.tocList.querySelectorAll('.toc-item').forEach((el, idx) => {
            el.classList.toggle('active', idx === this.currentIndex);
        });

        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    _setNavBtn(btn, enabled, targetIdx) {
        if (!enabled) {
            btn.classList.add('disabled');
            btn.href = '#';
            return;
        }
        btn.classList.remove('disabled');
        const ch = this.data.chapters[targetIdx];
        btn.href = 'reader.html?ch=' + encodeURIComponent(ch.id);
        btn.onclick = (e) => {
            e.preventDefault();
            this.currentIndex = targetIdx;
            this._renderChapter();
            history.replaceState(null, '', 'reader.html?ch=' + encodeURIComponent(ch.id));
        };
    }

    _renderToc() {
        this.els.tocList.innerHTML = '';
        this.data.chapters.forEach((ch, idx) => {
            const a = document.createElement('a');
            a.className = 'toc-item';
            a.href = '#';
            a.textContent = (idx + 1) + '. ' + ch.title;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                this.currentIndex = idx;
                this._renderChapter();
                history.replaceState(null, '', 'reader.html?ch=' + encodeURIComponent(ch.id));
                this.els.tocPanel.classList.remove('open');
            });
            this.els.tocList.appendChild(a);
        });
    }

    _bindEvents() {
        this.els.tocFab.addEventListener('click', () => {
            this.els.tocPanel.classList.toggle('open');
        });
        // 点击面板外部关闭目录
        document.addEventListener('click', (e) => {
            if (this.els.tocPanel.classList.contains('open')
                && !this.els.tocPanel.contains(e.target)
                && e.target !== this.els.tocFab) {
                this.els.tocPanel.classList.remove('open');
            }
        });
        // 键盘左右翻页
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' && this.currentIndex > 0) {
                this.currentIndex--;
                this._renderChapter();
            }
            if (e.key === 'ArrowRight' && this.currentIndex < this.data.chapters.length - 1) {
                this.currentIndex++;
                this._renderChapter();
            }
        });
    }
}

// ======================== 启动 ========================

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    window.readerApp = new ReaderApp();
});
