/**
 * 共享 Markdown 渲染器（web_book 双端复用）
 * - 写作端（index.html + js/app.js）与阅读端（reader.html + js/reader.js）共用
 * - 支持：标题、粗体、斜体、引用、列表、代码、链接、图片、表格、分隔线、删除线
 * - 挂在 window.MarkdownRenderer，零依赖、纯静态（符合项目约束）
 *
 * 原实现散落在 js/app.js（MarkdownRenderer）与 js/reader.js（MarkdownRenderer 简化版），
 * 二者逻辑等价、仅占位符/块组装风格不同。本模块收敛为唯一实现（§5 传输层无关控制器 / §6 分层）。
 */
(function (global) {
    'use strict';

    const EMPTY_DEFAULT = '<div class="empty">✨ 暂无内容</div>';

    class MarkdownRenderer {
        /**
         * 将 Markdown 文本渲染为 HTML
         * @param {string} text  Markdown 源文本
         * @param {string} [emptyHtml] 空内容占位符 HTML（缺省用 .empty）
         */
        static render(text, emptyHtml) {
            if (!text || !text.trim()) {
                return emptyHtml || EMPTY_DEFAULT;
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
                    blocks.push({ type: `h${level}`, content: `<h${level}>${this._inlineMarkdown(hMatch[2])}</h${level}>` });
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
                            i++;
                            if (i < lines.length && /^[\*\-]\s/.test(lines[i].trim())) {
                                continue;
                            }
                            break;
                        } else {
                            break;
                        }
                    }
                    blocks.push({ type: 'ul', content: `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>` });
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
                    blocks.push({ type: 'ol', content: `<ol>${items.map(item => `<li>${item}</li>`).join('')}</ol>` });
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
                        if (cells.every(c => /^[\s\-:]+$/.test(c.trim()))) {
                            isHeader = false;
                            i++;
                            continue;
                        }
                        const tag = isHeader ? 'th' : 'td';
                        rows.push(`<tr>${cells.map(c => `<${tag}>${this._inlineMarkdown(c.trim())}</${tag}>`).join('')}</tr>`);
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
                blocks.push({ type: 'p', content: `<p>${paraLines.map(l => this._inlineMarkdown(l)).join('<br>')}</p>` });
            }

            // 组装最终 HTML（丢弃 blank 块）
            return blocks
                .filter(b => b.type !== 'blank')
                .map(b => b.content)
                .join('\n');
        }

        /**
         * 处理行内 Markdown 标记：代码、图片、链接、粗体、斜体、删除线
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

    global.MarkdownRenderer = MarkdownRenderer;
})(window);
