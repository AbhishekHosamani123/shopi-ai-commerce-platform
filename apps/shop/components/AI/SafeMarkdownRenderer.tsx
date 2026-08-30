"use client";

import React from 'react';
import Link from 'next/link';

export type MarkdownThemeVariant = 'merchant' | 'light' | 'dark' | 'inherit';

interface SafeMarkdownRendererProps {
  content: string;
  className?: string;
  variant?: MarkdownThemeVariant;
}

/**
 * Sanitizes links to prevent XSS (javascript:, data:, vbscript: protocols).
 */
function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('file:')
  ) {
    return false;
  }
  return true;
}

/**
 * Parses inline markdown (bold, italic, strikethrough, inline code, links) safely into React elements.
 */
export function parseInlineMarkdown(text: string, variant: MarkdownThemeVariant = 'inherit'): React.ReactNode[] {
  if (!text) return [];

  // Theme color maps for inline elements
  const linkColor =
    variant === 'merchant'
      ? 'text-linear-primary hover:text-linear-primary-hover font-medium underline transition-colors'
      : variant === 'light'
      ? 'text-emerald-700 hover:text-emerald-800 font-medium underline transition-colors'
      : variant === 'dark'
      ? 'text-[#0D94FB] hover:text-cyan-300 font-medium underline transition-colors'
      : 'underline font-medium hover:opacity-80 transition-opacity';

  const boldColor =
    variant === 'merchant'
      ? 'font-bold text-ink'
      : variant === 'light'
      ? 'font-bold text-slate-900'
      : variant === 'dark'
      ? 'font-bold text-white'
      : 'font-bold';

  const italicColor =
    variant === 'merchant'
      ? 'italic text-ink-muted'
      : variant === 'light'
      ? 'italic text-slate-700'
      : variant === 'dark'
      ? 'italic text-slate-200'
      : 'italic';

  const inlineCodeStyle =
    variant === 'merchant'
      ? 'font-mono bg-surface-3 border border-hairline px-1.5 py-0.5 rounded text-linear-primary font-semibold text-[11px]'
      : variant === 'light'
      ? 'font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-emerald-800 font-semibold text-[11px]'
      : variant === 'dark'
      ? 'font-mono bg-slate-900/80 border border-slate-700/60 px-1.5 py-0.5 rounded text-cyan-300 text-[11px]'
      : 'font-mono bg-slate-200/60 border border-slate-300 px-1 py-0.5 rounded text-[11px]';

  // Token regex for:
  // 1. Links: [text](url)
  // 2. Bold-Italic: ***text*** or ___text___
  // 3. Bold: **text** or __text__
  // 4. Strikethrough: ~~text~~
  // 5. Inline Code: `code`
  // 6. Italic: *text* or _text_
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*\*([^*]+)\*\*\*|___([^_]+)___|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    // Add preceding plain text
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    const fullMatch = match[0];

    if (match[2] && match[3]) {
      // Link [text](url)
      const linkText = match[2];
      const linkUrl = match[3];

      if (!isSafeUrl(linkUrl)) {
        elements.push(linkText);
      } else {
        const isInternal = linkUrl.startsWith('/') || linkUrl.includes('localhost');
        if (isInternal) {
          elements.push(
            <Link
              key={`link_${keyCounter++}`}
              href={linkUrl}
              className={linkColor}
            >
              {linkText}
            </Link>
          );
        } else {
          elements.push(
            <a
              key={`a_${keyCounter++}`}
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={linkColor}
            >
              {linkText}
            </a>
          );
        }
      }
    } else if (match[4] || match[5]) {
      // Bold + Italic ***text*** or ___text___
      const biText = match[4] || match[5];
      elements.push(
        <strong key={`bi_${keyCounter++}`} className={boldColor}>
          <em className={italicColor}>{biText}</em>
        </strong>
      );
    } else if (match[6] || match[7]) {
      // Bold **text** or __text__
      const boldText = match[6] || match[7];
      elements.push(
        <strong key={`bold_${keyCounter++}`} className={boldColor}>
          {boldText}
        </strong>
      );
    } else if (match[8]) {
      // Strikethrough ~~text~~
      const delText = match[8];
      elements.push(
        <del key={`del_${keyCounter++}`} className="line-through opacity-70">
          {delText}
        </del>
      );
    } else if (match[9]) {
      // Inline Code `code`
      const codeText = match[9];
      elements.push(
        <code key={`code_${keyCounter++}`} className={inlineCodeStyle}>
          {codeText}
        </code>
      );
    } else if (match[10] || match[11]) {
      // Italic *text* or _text_
      const italicText = match[10] || match[11];
      elements.push(
        <em key={`em_${keyCounter++}`} className={italicColor}>
          {italicText}
        </em>
      );
    } else {
      elements.push(fullMatch);
    }

    lastIndex = match.index + fullMatch.length;
  }

  // Add trailing plain text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}

/**
 * Checks if a string line matches a markdown table separator (e.g. |---|:---:|---:|)
 */
function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) return false;
  const parts = trimmed.split('|').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every(p => /^:?-+:?$/.test(p));
}

/**
 * Splits a table row into cell strings.
 */
function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  let row = trimmed;
  if (row.startsWith('|')) row = row.substring(1);
  if (row.endsWith('|')) row = row.substring(0, row.length - 1);
  return row.split('|').map(c => c.trim());
}

/**
 * Parses table column alignments from separator row.
 */
function parseTableAlignments(line: string): ('left' | 'center' | 'right')[] {
  const parts = parseTableRow(line);
  return parts.map(p => {
    const start = p.startsWith(':');
    const end = p.endsWith(':');
    if (start && end) return 'center';
    if (end) return 'right';
    return 'left';
  });
}

/**
 * ⚡ SafeMarkdownRenderer
 * High-performance, robust, and XSS-safe Markdown renderer for AI Copilot responses.
 * Supports headings, bold, italic, strikethrough, lists, tables, inline code, code blocks,
 * blockquotes, horizontal rules, links, and streaming responses safely without dangerouslySetInnerHTML.
 */
export default function SafeMarkdownRenderer({
  content,
  className = '',
  variant = 'inherit'
}: SafeMarkdownRendererProps) {
  if (!content) return null;

  // Unescape double-escaped markdown characters if any
  const cleanContent = content
    .replace(/\\(\*|_|`|\[|\]|\(|\)|#|\+|-)/g, '$1')
    .replace(/\r\n/g, '\n');

  const lines = cleanContent.split('\n');
  const renderedBlocks: React.ReactNode[] = [];
  let blockKey = 0;

  // Style mappings according to theme variant
  const styles = {
    h1:
      variant === 'merchant'
        ? 'text-base font-extrabold text-ink mt-3 mb-1.5'
        : variant === 'light'
        ? 'text-base font-extrabold text-slate-900 mt-3 mb-1.5'
        : variant === 'dark'
        ? 'text-base font-extrabold text-white mt-3 mb-1.5'
        : 'text-base font-bold mt-3 mb-1.5',
    h2:
      variant === 'merchant'
        ? 'text-sm font-bold text-ink mt-2.5 mb-1'
        : variant === 'light'
        ? 'text-sm font-bold text-slate-900 mt-2.5 mb-1'
        : variant === 'dark'
        ? 'text-sm font-bold text-white mt-2.5 mb-1'
        : 'text-sm font-bold mt-2.5 mb-1',
    h3:
      variant === 'merchant'
        ? 'text-xs font-bold text-ink mt-2 mb-1'
        : variant === 'light'
        ? 'text-xs font-bold text-slate-900 mt-2 mb-1'
        : variant === 'dark'
        ? 'text-xs font-bold text-cyan-300 mt-2 mb-1'
        : 'text-xs font-bold mt-2 mb-1',
    h4:
      variant === 'merchant'
        ? 'text-[11px] font-bold text-ink-muted mt-1.5 mb-0.5 uppercase tracking-wide'
        : variant === 'light'
        ? 'text-[11px] font-bold text-slate-700 mt-1.5 mb-0.5 uppercase tracking-wide'
        : variant === 'dark'
        ? 'text-[11px] font-bold text-slate-300 mt-1.5 mb-0.5 uppercase tracking-wide'
        : 'text-[11px] font-bold mt-1.5 mb-0.5 uppercase',
    list:
      variant === 'merchant'
        ? 'my-1.5 pl-5 space-y-1 text-ink-muted'
        : variant === 'light'
        ? 'my-1.5 pl-5 space-y-1 text-slate-700'
        : variant === 'dark'
        ? 'my-1.5 pl-5 space-y-1 text-slate-200'
        : 'my-1.5 pl-5 space-y-1',
    p:
      variant === 'merchant'
        ? 'leading-relaxed mb-1.5 last:mb-0 text-ink-muted'
        : variant === 'light'
        ? 'leading-relaxed mb-1.5 last:mb-0 text-slate-700'
        : variant === 'dark'
        ? 'leading-relaxed mb-1.5 last:mb-0 text-slate-200'
        : 'leading-relaxed mb-1.5 last:mb-0',
    blockquote:
      variant === 'merchant'
        ? 'my-2 pl-3 py-1 border-l-2 border-linear-primary/40 bg-surface-2/60 text-ink-muted italic text-xs rounded-r'
        : variant === 'light'
        ? 'my-2 pl-3 py-1 border-l-2 border-emerald-500 bg-slate-50 text-slate-700 italic text-xs rounded-r'
        : variant === 'dark'
        ? 'my-2 pl-3 py-1 border-l-2 border-cyan-400 bg-slate-800/40 text-slate-300 italic text-xs rounded-r'
        : 'my-2 pl-3 py-1 border-l-2 border-current italic opacity-80',
    codeBlock:
      variant === 'merchant'
        ? 'my-2 p-3 bg-surface-3 border border-hairline rounded-md font-mono text-[11px] text-ink overflow-x-auto leading-normal'
        : variant === 'light'
        ? 'my-2 p-3 bg-slate-900 text-emerald-300 rounded-lg font-mono text-[11px] overflow-x-auto leading-normal shadow-inner'
        : variant === 'dark'
        ? 'my-2 p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-cyan-300 overflow-x-auto leading-normal'
        : 'my-2 p-3 bg-slate-900 text-white rounded font-mono text-[11px] overflow-x-auto',
    tableWrapper:
      variant === 'merchant'
        ? 'my-2.5 overflow-x-auto rounded border border-hairline bg-surface-1'
        : variant === 'light'
        ? 'my-2.5 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs'
        : variant === 'dark'
        ? 'my-2.5 overflow-x-auto rounded-lg border border-slate-700/80 bg-slate-900/60'
        : 'my-2.5 overflow-x-auto rounded border border-slate-200',
    tableTh:
      variant === 'merchant'
        ? 'bg-surface-2 px-3 py-1.5 text-[11px] font-bold text-ink border-b border-hairline'
        : variant === 'light'
        ? 'bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-900 border-b border-slate-200'
        : variant === 'dark'
        ? 'bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white border-b border-slate-700'
        : 'px-3 py-1.5 text-[11px] font-bold border-b',
    tableTd:
      variant === 'merchant'
        ? 'px-3 py-1.5 text-xs text-ink-muted border-b border-hairline last:border-b-0'
        : variant === 'light'
        ? 'px-3 py-1.5 text-xs text-slate-700 border-b border-slate-100 last:border-b-0'
        : variant === 'dark'
        ? 'px-3 py-1.5 text-xs text-slate-200 border-b border-slate-800/80 last:border-b-0'
        : 'px-3 py-1.5 text-xs border-b last:border-b-0',
    hr:
      variant === 'merchant'
        ? 'my-3 border-hairline'
        : variant === 'light'
        ? 'my-3 border-slate-200'
        : variant === 'dark'
        ? 'my-3 border-slate-700'
        : 'my-3 border-current opacity-20'
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Fenced Code Blocks (``` or ~~~)
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const fenceMarker = trimmed.substring(0, 3);
      const language = trimmed.substring(3).trim();
      const codeLines: string[] = [];
      i++;

      while (i < lines.length && !lines[i].trim().startsWith(fenceMarker)) {
        codeLines.push(lines[i]);
        i++;
      }
      // If closing fence was reached, skip it; otherwise streaming allows partial code
      if (i < lines.length && lines[i].trim().startsWith(fenceMarker)) {
        i++;
      }

      renderedBlocks.push(
        <div key={`code_block_${blockKey++}`} className="relative group">
          {language && (
            <div className="absolute right-2 top-1.5 text-[9px] font-mono uppercase tracking-wider text-slate-400 select-none">
              {language}
            </div>
          )}
          <pre className={styles.codeBlock}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 3. Tables (Header row + Separator row + Data rows)
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = parseTableRow(line);
      const alignments = parseTableAlignments(lines[i + 1]);
      i += 2; // Skip header and separator

      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && !isTableSeparator(lines[i])) {
        bodyRows.push(parseTableRow(lines[i]));
        i++;
      }

      renderedBlocks.push(
        <div key={`table_${blockKey++}`} className={styles.tableWrapper}>
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr>
                {headerCells.map((cell, cIdx) => {
                  const align = alignments[cIdx] || 'left';
                  return (
                    <th
                      key={`th_${cIdx}`}
                      style={{ textAlign: align }}
                      className={styles.tableTh}
                    >
                      {parseInlineMarkdown(cell, variant)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rIdx) => (
                <tr key={`tr_${rIdx}`} className="hover:bg-black/5 transition-colors">
                  {row.map((cell, cIdx) => {
                    const align = alignments[cIdx] || 'left';
                    return (
                      <td
                        key={`td_${rIdx}_${cIdx}`}
                        style={{ textAlign: align }}
                        className={styles.tableTd}
                      >
                        {parseInlineMarkdown(cell, variant)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 4. Headers (#, ##, ###, ####, #####, ######)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2];
      const inline = parseInlineMarkdown(title, variant);

      if (level === 1) {
        renderedBlocks.push(
          <h2 key={`h1_${blockKey++}`} className={styles.h1}>
            {inline}
          </h2>
        );
      } else if (level === 2) {
        renderedBlocks.push(
          <h3 key={`h2_${blockKey++}`} className={styles.h2}>
            {inline}
          </h3>
        );
      } else if (level === 3) {
        renderedBlocks.push(
          <h4 key={`h3_${blockKey++}`} className={styles.h3}>
            {inline}
          </h4>
        );
      } else {
        renderedBlocks.push(
          <h5 key={`h4_${blockKey++}`} className={styles.h4}>
            {inline}
          </h5>
        );
      }
      i++;
      continue;
    }

    // 5. Horizontal Rule (---, ***, ___)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      renderedBlocks.push(<hr key={`hr_${blockKey++}`} className={styles.hr} />);
      i++;
      continue;
    }

    // 6. Blockquote (> quote)
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      renderedBlocks.push(
        <blockquote key={`bq_${blockKey++}`} className={styles.blockquote}>
          {quoteLines.map((ql, qIdx) => (
            <p key={`ql_${qIdx}`} className="leading-relaxed">
              {parseInlineMarkdown(ql, variant)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 7. Unordered Lists (- item, * item, + item, • item)
    const ulMatch = line.match(/^(\s*[-*+•])\s+(.+)$/);
    if (ulMatch) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*[-*+•])\s+(.+)$/);
        if (itemMatch) {
          listItems.push(itemMatch[2]);
          i++;
        } else if (lines[i].trim() && lines[i].startsWith('  ') && listItems.length > 0) {
          // Continuation line for previous list item
          listItems[listItems.length - 1] += '\n' + lines[i].trim();
          i++;
        } else {
          break;
        }
      }

      renderedBlocks.push(
        <ul key={`ul_${blockKey++}`} className={`list-disc ${styles.list}`}>
          {listItems.map((item, idx) => (
            <li key={`ul_li_${idx}`} className="leading-relaxed">
              {parseInlineMarkdown(item, variant)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 8. Ordered Lists (1. item, 2. item)
    const olMatch = line.match(/^(\s*\d+[\.)])\s+(.+)$/);
    if (olMatch) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*\d+[\.)])\s+(.+)$/);
        if (itemMatch) {
          listItems.push(itemMatch[2]);
          i++;
        } else if (lines[i].trim() && lines[i].startsWith('  ') && listItems.length > 0) {
          listItems[listItems.length - 1] += '\n' + lines[i].trim();
          i++;
        } else {
          break;
        }
      }

      renderedBlocks.push(
        <ol key={`ol_${blockKey++}`} className={`list-decimal ${styles.list}`}>
          {listItems.map((item, idx) => (
            <li key={`ol_li_${idx}`} className="leading-relaxed">
              {parseInlineMarkdown(item, variant)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 9. Standard Paragraphs
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].match(/^(#{1,6})\s+/) &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('~~~') &&
      !lines[i].match(/^(\s*[-*+•])\s+/) &&
      !lines[i].match(/^(\s*\d+[\.)])\s+/) &&
      !lines[i].startsWith('>') &&
      !/^(\*{3,}|-{3,}|_{3,})$/.test(lines[i].trim()) &&
      !(lines[i].trim().includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      renderedBlocks.push(
        <p key={`p_${blockKey++}`} className={styles.p}>
          {paraLines.map((pLine, pIdx) => (
            <React.Fragment key={`p_frag_${pIdx}`}>
              {pIdx > 0 && <br />}
              {parseInlineMarkdown(pLine, variant)}
            </React.Fragment>
          ))}
        </p>
      );
    }
  }

  return <div className={`safe-markdown-root ${className}`}>{renderedBlocks}</div>;
}
