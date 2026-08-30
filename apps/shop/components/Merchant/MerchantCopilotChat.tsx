'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ActionPreviewCard, ActionPreviewItem } from './ActionPreviewCard';
import SafeMarkdownRenderer from '../AI/SafeMarkdownRenderer';


export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  period?: string;
  insights?: string[];
  recommendations?: string[];
  actions?: ActionPreviewItem[];
  visualization?: {
    type: 'line' | 'bar' | 'pie' | 'kpi' | 'comparison' | 'table';
    title: string;
    xKey?: string;
    yKey?: string;
    data: any;
  };
  timestamp: string;
}

interface MerchantCopilotChatProps {
  externalPrompt?: string;
  onClearExternalPrompt?: () => void;
  onClose?: () => void;
  isDrawer?: boolean;
}

export const MerchantCopilotChat: React.FC<MerchantCopilotChatProps> = ({
  externalPrompt,
  onClearExternalPrompt,
  onClose,
  isDrawer = false
}) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `👋 **Welcome to Merchant AI Copilot!**\n\nI am your business intelligence & action copilot grounded in your canonical Supabase commerce ledger. Ask me any question about your revenue, repeat buyers, dormant customers, high-intent prospects, stock runway, or margin safety.`,
      intent: 'welcome',
      period: 'Live',
      insights: [
        'Canonical product catalog and live commerce telemetry are reconciled in real-time.',
        'Human-in-the-loop: Every action requires explicit merchant approval before execution.'
      ],
      recommendations: [
        'Try asking: "Prepare a restock for low inventory"',
        'Try asking: "Suggest discounts for dead stock"',
        'Try asking: "What should I focus on today?"'
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    'Prepare restock for low stock',
    'Suggest discounts for dead stock',
    'Show pending actions',
    'How are my sales this month?',
    'What should I focus on today?',
    'Why did sales change?'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle external prompt injection from dashboard cards
  useEffect(() => {
    if (externalPrompt && externalPrompt.trim()) {
      handleSendMessage(externalPrompt.trim());
      if (onClearExternalPrompt) onClearExternalPrompt();
    }
  }, [externalPrompt]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isSubmitting) return;

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsSubmitting(true);

    try {
      // Build conversation history for multi-turn context
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-6)
        .map(m => ({
          role: m.role,
          content: m.content,
          intent: m.intent,
          period: m.period,
          actions: m.actions
        }));

      const res = await fetch('/api/merchant/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history })
      });

      const data = await res.json();

      if (data.success) {
        const aiMsg: ChatMessageItem = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          intent: data.intent,
          period: data.period,
          insights: data.insights,
          recommendations: data.recommendations,
          actions: data.actions,
          visualization: data.visualization,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        const errorMsg: ChatMessageItem = {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${data.error || 'I encountered an issue retrieving business analytics. Please try asking again.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const networkError: ChatMessageItem = {
        id: `ai-net-err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Unable to connect to Merchant AI backend. Please verify your backend server on port 3500.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, networkError]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-msg-reset',
        role: 'assistant',
        content: `👋 **Chat Cleared.** Ask me anything about your business analytics, sales, products, inventory, or customers!`,
        intent: 'welcome',
        period: 'Live',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  /**
   * Helper to render inline visualization cards inside chat messages
   */
  const renderVisualization = (vis: NonNullable<ChatMessageItem['visualization']>) => {
    if (!vis || !vis.data) return null;

    // 1. KPI Grid
    if (vis.type === 'kpi') {
      const d = vis.data;
      return (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <span>📊</span> {vis.title}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-medium text-slate-400 block">Gross Revenue</span>
              <span className="text-xs font-bold text-slate-900">₹{(d.grossRevenue || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-medium text-slate-400 block">Net Revenue</span>
              <span className="text-xs font-bold text-emerald-700">₹{(d.netRevenue || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-medium text-slate-400 block">Total Orders</span>
              <span className="text-xs font-bold text-slate-900">{(d.totalOrders || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-medium text-slate-400 block">Average Order Value</span>
              <span className="text-xs font-bold text-slate-900">₹{(d.aov || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      );
    }

    // 2. Comparison Card
    if (vis.type === 'comparison') {
      const cur = vis.data.currentPeriod;
      const prev = vis.data.previousPeriod;
      const g = vis.data.growth || {};
      if (!cur || !prev) return null;

      return (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5">⚖️ {vis.title}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${g.revenueChangePct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {g.revenueChangePct >= 0 ? `+${g.revenueChangePct}%` : `${g.revenueChangePct}%`}
            </span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
              <span className="text-slate-500 font-medium">Revenue</span>
              <span className="font-bold text-slate-900">₹{(cur.revenue || 0).toLocaleString('en-IN')} <span className="text-slate-400 font-normal">vs ₹{(prev.revenue || 0).toLocaleString('en-IN')}</span></span>
            </div>
            <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
              <span className="text-slate-500 font-medium">Orders</span>
              <span className="font-bold text-slate-900">{cur.orders} <span className="text-slate-400 font-normal">vs {prev.orders}</span></span>
            </div>
            <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
              <span className="text-slate-500 font-medium">AOV</span>
              <span className="font-bold text-slate-900">₹{(cur.averageOrderValue || 0).toLocaleString('en-IN')} <span className="text-slate-400 font-normal">vs ₹{(prev.averageOrderValue || 0).toLocaleString('en-IN')}</span></span>
            </div>
          </div>
        </div>
      );
    }

    // 3. Bar leaderboard / progress visual
    if (vis.type === 'bar' && Array.isArray(vis.data)) {
      const items = vis.data.slice(0, 4);
      const maxVal = Math.max(...items.map((i: any) => i[vis.yKey || 'revenue'] || i.revenue || i.unitsSold || 1), 1);

      return (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <span>📈</span> {vis.title}
          </div>
          <div className="space-y-1.5">
            {items.map((item: any, idx: number) => {
              const val = item[vis.yKey || 'revenue'] || item.revenue || item.unitsSold || 0;
              const pct = Math.min(100, Math.round((val / maxVal) * 100));
              return (
                <div key={idx} className="bg-white p-2 rounded-lg border border-slate-100 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="font-bold text-slate-800 truncate max-w-[70%]">{item[vis.xKey || 'title'] || item.title || item.categoryName}</span>
                    <span className="font-semibold text-emerald-700">{typeof val === 'number' && val > 500 ? `₹${val.toLocaleString('en-IN')}` : `${val} units`}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 4. Pie / Distribution breakdown
    if (vis.type === 'pie' && Array.isArray(vis.data)) {
      const items = vis.data.slice(0, 4);
      return (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <span>🥧</span> {vis.title}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {items.map((item: any, idx: number) => {
              const label = item.categoryName || item.reason?.replace(/_/g, ' ') || 'Item';
              const share = item.revenueSharePct || item.percentageOfReturns || item.percentage || 0;
              return (
                <div key={idx} className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block truncate font-medium">{label}</span>
                  <span className="text-xs font-bold text-slate-900">{share}% share</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 5. Table / Radar Cards
    if (vis.type === 'table' && Array.isArray(vis.data)) {
      const items = vis.data.slice(0, 4);
      return (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <span>🚨</span> {vis.title}
          </div>
          <div className="space-y-1.5">
            {items.map((item: any, idx: number) => (
              <div key={idx} className="bg-white p-2 rounded-lg border border-slate-100 flex items-center justify-between text-[11px]">
                <div className="truncate max-w-[70%]">
                  <span className="font-bold text-slate-900 block truncate">{item.title || item.categoryName}</span>
                  <span className="text-[10px] text-slate-500">
                    {item.currentStock !== undefined ? `${item.currentStock} units (${item.estimatedDaysRemaining ?? '?'}d left)` : item.description?.slice(0, 45) || ''}
                  </span>
                </div>
                {item.urgency && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    item.urgency === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : item.urgency === 'WARNING' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {item.urgency}
                  </span>
                )}
                {item.severity && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    item.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : item.severity === 'WARNING' ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'
                  }`}>
                    {item.severity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`rounded-2xl border border-slate-200/90 bg-white shadow-lg overflow-hidden flex flex-col ${isDrawer ? 'h-full' : 'h-[640px]'}`}>
      {/* Copilot Header */}
      <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm">
            🧠
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Merchant AI Copilot</h3>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 uppercase">
                Action & Approval Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Deterministic reasoning & human-in-the-loop execution</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-all font-medium cursor-pointer"
            title="Clear Conversation"
          >
            <i className="fas fa-rotate-left mr-1 text-[10px]"></i> Reset
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-all cursor-pointer"
              title="Close Copilot"
            >
              <i className="fas fa-xmark text-sm"></i>
            </button>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-full`}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-500 font-medium">
              <span>{msg.role === 'user' ? 'Merchant' : 'Merchant Copilot'}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
              {msg.period && (
                <>
                  <span>•</span>
                  <span className="text-emerald-700 font-bold">{msg.period}</span>
                </>
              )}
            </div>

            <div
              className={`rounded-2xl p-4 max-w-[92%] sm:max-w-[85%] text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-tr-none shadow-sm'
                  : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-none shadow-xs'
              }`}
            >
              {/* Message Content */}
              <div className="font-sans text-xs">
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <SafeMarkdownRenderer content={msg.content} variant="light" />
                )}
              </div>


              {/* Action Preview Cards Stream */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                    ⚡ Action Recommendations Required:
                  </span>
                  {msg.actions.map(action => (
                    <ActionPreviewCard
                      key={action.actionId}
                      action={action}
                      onActionComplete={(actId, status, message) => {
                        console.log(`Action ${actId} updated to ${status}: ${message}`);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Inline Visualizations */}
              {msg.visualization && renderVisualization(msg.visualization)}

              {/* Insights Callout */}
              {msg.insights && msg.insights.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block mb-1">
                    💡 Key Business Insights:
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    {msg.insights.map((ins, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{ins}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations Callout */}
              {msg.recommendations && msg.recommendations.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                    🎯 Recommended Operational Actions:
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    {msg.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-600 font-bold">→</span>
                        <span className="font-medium text-slate-900">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}

        {isSubmitting && (
          <div className="flex items-center gap-2 text-xs text-slate-600 p-3 bg-white border border-slate-200 rounded-xl w-fit shadow-xs animate-pulse">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="font-medium">Analyzing PostgreSQL business telemetry & preparing actions...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 overflow-x-auto flex gap-2 scrollbar-none">
        <span className="text-[11px] text-slate-500 font-bold shrink-0 self-center">Actions:</span>
        {suggestedPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            disabled={isSubmitting}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 hover:text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all font-medium shadow-2xs cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Merchant Copilot (e.g. 'Prepare restock for running shoes')..."
          disabled={isSubmitting}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputValue.trim() || isSubmitting}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
            inputValue.trim() && !isSubmitting
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
          }`}
        >
          <span>Send</span>
          <i className="fas fa-paper-plane text-[10px]"></i>
        </button>
      </div>
    </div>
  );
};
