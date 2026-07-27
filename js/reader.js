/**
 * 阅读页面逻辑
 * 支持：URL 数据解码、章节渲染、目录导航、主题切换、上下章翻页
 */

// ======================== 主题管理 ========================

const THEME_KEY = 'write_book_theme';

function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'green';
    applyTheme(saved);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
    });
}

function applyTheme(theme) {
    if (!['dark', 'green', 'paper'].includes(theme)) theme = 'green';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

// ======================== Markdown 渲染器（简化版） ========================

class MarkdownRenderer {
    static render(text) {
        if (!text || !text.trim()) {
            return '<div class="empty">✨ 本章节暂无内容</div>';
        }
        const codeBlocks = [];
        let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
            const i = codeBlocks.length;
            const esc = code.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
            codeBlocks.push('<pre><code>' + esc + '</code></pre>');
            return '\x00CB' + i + '\x00';
        });
        processed = processed.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
        const lines = processed.split('\n');
        const blocks = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            const t = line.trim();
            if (!t) { i++; continue; }
            const cbm = t.match(/^\x00CB(\d+)\x00$/);
            if (cbm) { blocks.push(codeBlocks[parseInt(cbm[1])]); i++; continue; }
            const hm = t.match(/^(#{1,6})\s+(.+)$/);
            if (hm) {
                const lv = hm[1].length;
                blocks.push('<h' + lv + '>' + this._inline(hm[2]) + '</h' + lv + '>');
                i++; continue;
            }
            if (/^---+\s*$/.test(t) || /^\*\*\*+\s*$/.test(t)) { blocks.push('<hr>'); i++; continue; }
            if (t.startsWith('>')) {
                const ql = [];
                while (i < lines.length && lines[i].trim().startsWith('>')) {
                    ql.push(lines[i].trim().replace(/^>\s?/, '')); i++;
                }
                const qc = ql.map(l => '<p>' + this._inline(l) + '</p>').join('');
                blocks.push('<blockquote>' + qc + '</blockquote>'); continue;
            }
            if (/^[\*\-]\s/.test(t)) {
                const items = [];
                while (i < lines.length) {
                    const tt = lines[i].trim();
                    if (/^[\*\-]\s/.test(tt)) { items.push(this._inline(tt.replace(/^[\*\-]\s+/, ''))); i++; }
                    else if (tt === '') { i++; if (i < lines.length && /^[\*\-]\s/.test(lines[i].trim())) continue; break; }
                    else break;
                }
                blocks.push('<ul>' + items.map(x => '<li>' + x + '</li>').join('') + '</ul>'); continue;
            }
            if (/^\d+\.\s/.test(t)) {
                const items = [];
                while (i < lines.length) {
                    const tt = lines[i].trim();
                    const om = tt.match(/^\d+\.\s+(.+)$/);
                    if (om) { items.push(this._inline(om[1])); i++; }
                    else if (tt === '') { i++; if (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) continue; break; }
                    else break;
                }
                blocks.push('<ol>' + items.map(x => '<li>' + x + '</li>').join('') + '</ol>'); continue;
            }
            if (t.startsWith('|') && t.endsWith('|')) {
                const rows = []; let isH = true;
                while (i < lines.length) {
                    const tt = lines[i].trim();
                    if (!tt.startsWith('|') || !tt.endsWith('|')) break;
                    const cells = tt.split('|').filter(c => c.trim());
                    if (cells.every(c => /^[\s\-:]+$/.test(c.trim()))) { isH = false; i++; continue; }
                    const tag = isH ? 'th' : 'td';
                    rows.push('<tr>' + cells.map(c => '<' + tag + '>' + this._inline(c.trim()) + '</' + tag + '>').join('') + '</tr>');
                    if (isH) isH = false; i++;
                }
                if (rows.length) blocks.push('<table>' + rows.join('') + '</table>'); continue;
            }
            const pl = [t]; i++;
            while (i < lines.length) {
                const nt = lines[i].trim();
                if (!nt || /^(#|>|\d+\.\s|[\*\-]\s|\||---)/.test(nt) || /^\x00CB/.test(nt)) break;
                pl.push(nt); i++;
            }
            blocks.push('<p>' + pl.map(l => this._inline(l)).join('<br>') + '</p>');
        }
        return blocks.join('\n');
    }

    static _inline(text) {
        if (!text) return '';
        let r = text;
        r = r.replace(/`([^`]+)`/g, '<code>$1</code>');
        r = r.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
        r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        r = r.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        r = r.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
        r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        r = r.replace(/__(.+?)__/g, '<strong>$1</strong>');
        r = r.replace(/\*(.+?)\*/g, '<em>$1</em>');
        r = r.replace(/_(.+?)_/g, '<em>$1</em>');
        r = r.replace(/~~(.+?)~~/g, '<del>$1</del>');
        return r;
    }
}

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
            if (window.__NOVEL_READY__) {
                await window.__NOVEL_READY__;
            }
            if (window.__NOVEL_DATA__ && window.__NOVEL_DATA__.chapters) {
                // 回退到本地数据
                this.data = window.__NOVEL_DATA__;
            } else {
                throw new Error('未找到小说数据');
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

    _renderChapter() {
        const ch = this.data.chapters[this.currentIndex];
        if (!ch) {
            this.els.chapterTitle.textContent = '章节不存在';
            this.els.content.innerHTML = '<div class="empty">未找到该章节</div>';
            return;
        }
        this.els.chapterTitle.textContent = ch.title;
        this.els.content.innerHTML = MarkdownRenderer.render(ch.content || '');
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
