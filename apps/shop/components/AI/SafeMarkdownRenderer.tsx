"use client";

import React from 'react';
import Link from 'next/link';

interface SafeMarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Parses inline markdown formatted text (bold, italic, code, links) into React elements safely.
 * Does NOT use dangerouslySetInnerHTML.
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Token regex for:
  // 1. Links: [text](url)
  // 2. Bold: **text** or __text__
  // 3. Italic: *text* or _text_
  // 4. Inline Code: `code`
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;

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
      const isInternal = linkUrl.startsWith('/') || linkUrl.includes('localhost');
      
      if (isInternal) {
        elements.push(
          <Link
            key={`inline_link_${keyCounter++}`}
            href={linkUrl}
            className="text-[#0D94FB] font-medium underline hover:text-cyan-300 transition-colors"
          >
            {linkText}
          </Link>
        );
      } else {
        elements.push(
          <a
            key={`inline_a_${keyCounter++}`}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0D94FB] font-medium underline hover:text-cyan-300 transition-colors"
          >
            {linkText}
          </a>
        );
      }
    } else if (match[4] || match[5]) {
      // Bold **text** or __text__
      const boldText = match[4] || match[5];
      elements.push(
        <strong key={`inline_bold_${keyCounter++}`} className="font-bold text-white">
          {boldText}
        </strong>
      );
    } else if (match[6]) {
      // Inline Code `code`
      const codeText = match[6];
      elements.push(
        <code
          key={`inline_code_${keyCounter++}`}
          className="font-mono bg-slate-900/80 border border-slate-700/60 px-1.5 py-0.5 rounded text-cyan-300 text-[11px]"
        >
          {codeText}
        </code>
      );
    } else if (match[7] || match[8]) {
      // Italic *text* or _text_
      const italicText = match[7] || match[8];
      elements.push(
        <em key={`inline_em_${keyCounter++}`} className="italic text-slate-200">
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
 * ⚡ SafeMarkdownRenderer
 * Safely parses and renders Markdown headers, bullet lists, numbered lists,
 * bold, italic, code, and links without dangerouslySetInnerHTML.
 */
export default function SafeMarkdownRenderer({ content, className = '' }: SafeMarkdownRendererProps) {
  if (!content) return null;

  // Unescape double-escaped markdown characters if any
  const cleanContent = content
    .replace(/\\(\*|_|`|\[|\]|\(|\)|#|\+|-)/g, '$1')
    .replace(/\r\n/g, '\n');

  const lines = cleanContent.split('\n');
  const renderedBlocks: React.ReactNode[] = [];

  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let blockKey = 0;

  const flushList = () => {
    if (!currentList) return;

    if (currentList.type === 'ul') {
      renderedBlocks.push(
        <ul key={`block_ul_${blockKey++}`} className="my-1.5 pl-5 list-disc space-y-1 text-slate-200">
          {currentList.items.map((item, idx) => (
            <li key={`ul_item_${idx}`} className="leading-relaxed">
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
    } else if (currentList.type === 'ol') {
      renderedBlocks.push(
        <ol key={`block_ol_${blockKey++}`} className="my-1.5 pl-5 list-decimal space-y-1 text-slate-200">
          {currentList.items.map((item, idx) => (
            <li key={`ol_item_${idx}`} className="leading-relaxed">
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
    }

    currentList = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Unordered List item (- item, * item, • item)
    const ulMatch = line.match(/^(\s*[-*•])\s+(.+)$/);
    if (ulMatch) {
      if (currentList && currentList.type !== 'ul') {
        flushList();
      }
      if (!currentList) {
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[2]);
      continue;
    }

    // Ordered List item (1. item, 2. item)
    const olMatch = line.match(/^(\s*\d+\.)\s+(.+)$/);
    if (olMatch) {
      if (currentList && currentList.type !== 'ol') {
        flushList();
      }
      if (!currentList) {
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[2]);
      continue;
    }

    // If regular line, flush any active list first
    flushList();

    // Headers (###, ##, #)
    if (line.startsWith('### ')) {
      renderedBlocks.push(
        <h4 key={`block_h4_${blockKey++}`} className="text-xs font-bold text-cyan-300 mt-2 mb-1">
          {parseInlineMarkdown(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith('## ')) {
      renderedBlocks.push(
        <h3 key={`block_h3_${blockKey++}`} className="text-sm font-bold text-white mt-2.5 mb-1">
          {parseInlineMarkdown(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith('# ')) {
      renderedBlocks.push(
        <h2 key={`block_h2_${blockKey++}`} className="text-base font-extrabold text-white mt-3 mb-1.5">
          {parseInlineMarkdown(line.slice(2))}
        </h2>
      );
    } else {
      // Standard Paragraph line
      renderedBlocks.push(
        <p key={`block_p_${blockKey++}`} className="leading-relaxed mb-1.5 last:mb-0">
          {parseInlineMarkdown(line)}
        </p>
      );
    }
  }

  flushList();

  return <div className={`safe-markdown-container ${className}`}>{renderedBlocks}</div>;
}
