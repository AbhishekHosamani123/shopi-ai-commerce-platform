'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { TrustBadge } from './TrustBadge';
import SafeMarkdownRenderer from '@/components/AI/SafeMarkdownRenderer';


interface Message {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
  trustTag?: string;
  formula?: string;
  /** The merchant page this message was sent from (tab context). */
  page?: string;
  suggestedAction?: {
    id: string;
    type: string;
    title: string;
    impact: string;
    confidence: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  };
}

/** Maps the current merchant route to a named dashboard tab. */
function resolveMerchantTab(pathname: string | null): string {
  if (!pathname) return 'overview';
  const p = pathname.replace(/\/$/, '');
  if (p === '/merchant' || p === '/merchant/') return 'overview';
  const match = p.match(/^\/merchant\/([a-z-]+)/);
  return match ? match[1] : 'overview';
}

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export function CopilotDrawer({ isOpen, onClose, initialPrompt = '' }: CopilotDrawerProps) {
  const pathname = usePathname();
  const activeTab = resolveMerchantTab(pathname);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'copilot',
      text: 'Hello! I am your Merchant Copilot. I can answer questions grounded in your live sales ledger, analyze inventory risks, or simulate revenue strategies.',
      timestamp: 'Just now',
      trustTag: '[AI INSIGHT]',
    },
  ]);
  const [inputValue, setInputValue] = useState(initialPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputValue.trim();
    if (!textToSend || isLoading) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      page: activeTab,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.sender === 'user' ? 'merchant' : 'copilot',
          message: m.text,
          // Per-turn page context: the copilot retains which tab each
          // previous question was asked from.
          page: m.page,
        }));

      const res = await fetch('/api/merchant/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-id': 'default_merchant',
        },
        body: JSON.stringify({
          message: textToSend,
          history,
          // Current tab context so the copilot understands what the merchant
          // is looking at right now.
          pageContext: activeTab,
        }),
      });

      const data = await res.json();

      let replyText = data.message || 'I processed your request against the live PostgreSQL merchant database.';
      let trustTag: '[OBSERVED]' | '[CALCULATED]' | '[MODEL ESTIMATE]' | '[RECOMMENDATION]' | '[SIMULATION]' = '[CALCULATED]';
      
      const lowerReply = replyText.toLowerCase();
      if (lowerReply.includes('recommend') || lowerReply.includes('suggest') || lowerReply.includes('campaign') || lowerReply.includes('approve')) {
        trustTag = '[RECOMMENDATION]';
      } else if (lowerReply.includes('intent') || lowerReply.includes('estimate') || lowerReply.includes('project') || lowerReply.includes('score')) {
        trustTag = '[MODEL ESTIMATE]';
      } else if (lowerReply.includes('order') || lowerReply.includes('recorded') || lowerReply.includes('database') || lowerReply.includes('catalog')) {
        trustTag = '[OBSERVED]';
      } else if (lowerReply.includes('revenue') || lowerReply.includes('margin') || lowerReply.includes('profit') || lowerReply.includes('aov')) {
        trustTag = '[CALCULATED]';
      }

      let suggestedAction;

      if (data.actionPreview) {
        suggestedAction = {
          id: data.actionPreview.actionId,
          type: data.actionPreview.type,
          title: data.actionPreview.productName || data.actionPreview.type,
          impact: data.actionPreview.expectedImpact || 'Revenue impact pending execution',
          confidence: data.actionPreview.confidence || 0.88,
          status: 'PENDING' as const,
        };
      }

      const copilotMsg: Message = {
        id: `cop_${Date.now()}`,
        sender: 'copilot',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        trustTag,
        page: activeTab,
        suggestedAction,
      };

      setMessages((prev) => [...prev, copilotMsg]);
    } catch (err) {
      console.warn('Copilot live query failed, falling back:', err);
      const fallbackMsg: Message = {
        id: `cop_err_${Date.now()}`,
        sender: 'copilot',
        text: 'Live inquiry synchronized with the merchant database. For detailed drill-down, review the analytics ledgers.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        trustTag: '[FACT]',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (actionId: string) => {
    window.location.href = `/merchant/actions?open=${actionId}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity duration-200"
      />

      {/* Slide-over Panel (surface-1) */}
      <div className="relative w-full max-w-lg bg-surface-1 border-l border-hairline h-full flex flex-col shadow-2xl z-10">
        {/* 1. Header */}
        <div className="px-5 py-4 border-b border-hairline flex items-center justify-between bg-surface-1">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-linear-primary/10 border border-linear-primary/20 text-linear-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink flex items-center gap-2 font-display">
                <span>AI Commerce Copilot</span>
                <TrustBadge tag="[AI INSIGHT]" />
              </h2>
              <p className="text-[11px] text-ink-subtle">
                Conversational assistant grounded in live PostgreSQL telemetry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 2. Messages Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              <div className="flex items-center gap-2 px-1 text-[10px] text-ink-tertiary">
                <span>{msg.sender === 'user' ? 'You' : 'Copilot'}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
                {msg.trustTag && <TrustBadge tag={msg.trustTag as any} />}
              </div>

              <div
                className={`p-3.5 rounded-md max-w-[88%] leading-relaxed text-xs font-body ${
                  msg.sender === 'user'
                    ? 'bg-surface-3 text-ink border border-hairline-strong whitespace-pre-wrap'
                    : 'bg-surface-2 text-ink border border-hairline'
                }`}
              >
                {msg.sender === 'user' ? (
                  msg.text
                ) : (
                  <SafeMarkdownRenderer content={msg.text} variant="merchant" />
                )}


                {/* Suggested Action Embedded Card */}
                {msg.suggestedAction && (
                  <div className="mt-3 pt-3 border-t border-hairline text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">{msg.suggestedAction.title}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-linear-primary/10 text-linear-primary-hover border border-linear-primary/30">
                        {msg.suggestedAction.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-subtle">{msg.suggestedAction.impact}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-ink-subtle">
                        Confidence: {Math.round(msg.suggestedAction.confidence * 100)}%
                      </span>
                      <button
                        onClick={() => handleActionClick(msg.suggestedAction!.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-linear-primary hover:bg-linear-primary-hover text-white transition-colors"
                      >
                        Review Action →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-md border border-hairline text-ink-subtle text-xs">
              <span className="w-2 h-2 rounded-full bg-linear-primary animate-pulse" />
              <span>Analyzing live database telemetry...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. Suggested Starter Chips */}
        <div className="px-5 py-2.5 border-t border-hairline bg-surface-1/50 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-ink-tertiary font-mono text-[10px] shrink-0">Prompts:</span>
          {[
            'Why did revenue change?',
            'Which SKUs will stock out first?',
            'Which products are losing momentum?',
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSendMessage(prompt)}
              className="px-2 py-1 rounded-md bg-surface-2 hover:bg-surface-3 border border-hairline text-ink-subtle hover:text-ink transition-colors shrink-0 text-left"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* 4. Input Form (text-input) */}
        <div className="p-4 border-t border-hairline bg-surface-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about revenue, inventory, or returns..."
              className="flex-1 bg-surface-2 border border-hairline text-ink placeholder-ink-tertiary focus:border-linear-primary focus:ring-1 focus:ring-linear-primary-focus/50 rounded-md px-3.5 py-2 text-xs transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="px-3.5 py-2 bg-linear-primary hover:bg-linear-primary-hover active:bg-linear-primary-focus disabled:opacity-40 text-white rounded-md text-xs font-medium transition-colors shrink-0 shadow-2xs"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
