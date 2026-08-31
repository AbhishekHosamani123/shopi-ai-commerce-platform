'use client';
import { merchantFetch } from '@/components/Merchant/merchantFetch';

import React, { useState, useEffect } from 'react';

interface NotificationCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onActionClick?: (actionId?: string) => void;
}

export const NotificationCenterDrawer: React.FC<NotificationCenterDrawerProps> = ({
  isOpen,
  onClose,
  onActionClick
}) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'ALL' | 'CRITICAL' | 'INVENTORY' | 'PROFITABILITY' | 'MODELS'>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchNotifications = () => {
    merchantFetch('/api/merchant/notifications?limit=40', {
      headers: {
        'x-merchant-role': 'merchant_admin',
        'x-merchant-id': 'default_merchant'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      })
      .catch(err => console.error('Failed to load notifications:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMarkRead = async (id: string) => {
    await merchantFetch(`/api/merchant/notifications/${id}/read`, {
      method: 'POST',
      headers: {
        'x-merchant-role': 'merchant_admin',
        'x-merchant-id': 'default_merchant'
      }
    });
    fetchNotifications();
  };

  const handleDismiss = async (id: string) => {
    await merchantFetch(`/api/merchant/notifications/${id}/dismiss`, {
      method: 'POST',
      headers: {
        'x-merchant-role': 'merchant_admin',
        'x-merchant-id': 'default_merchant'
      }
    });
    fetchNotifications();
  };

  const filteredNotifs = notifications.filter(n => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'CRITICAL') return n.severity === 'CRITICAL';
    return n.category === activeTab;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-base">
                🔔
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Notification Center</h3>
                <p className="text-[11px] text-slate-400">{unreadCount} unread system notifications</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-bold"
            >
              ✕
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto text-xs">
            {(['ALL', 'CRITICAL', 'INVENTORY', 'PROFITABILITY', 'MODELS'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {loading ? (
              <div className="text-center py-12 text-slate-400 text-xs">Loading notifications...</div>
            ) : filteredNotifs.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400 text-xl font-bold">
                  ✓
                </div>
                <p className="text-sm font-bold text-slate-300">All Clear!</p>
                <p className="text-xs text-slate-500">No active alerts in this category.</p>
              </div>
            ) : (
              filteredNotifs.map((n) => (
                <div
                  key={n.notificationId}
                  className={`p-3.5 rounded-xl border transition-all ${
                    n.status === 'UNREAD'
                      ? 'bg-slate-950 border-blue-500/30 shadow-sm'
                      : 'bg-slate-950/40 border-slate-800/80 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        n.severity === 'CRITICAL' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                        n.severity === 'WARNING' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                        'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      }`}>
                        {n.severity}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase">{n.category}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {n.status === 'UNREAD' && (
                        <button
                          onClick={() => handleMarkRead(n.notificationId)}
                          title="Mark as read"
                          className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-blue-400 rounded bg-slate-800/50"
                        >
                          Read
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(n.notificationId)}
                        title="Dismiss notification"
                        className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-rose-400 rounded bg-slate-800/50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-white mt-2">{n.title}</h4>
                  <p className="text-[11px] text-slate-300 mt-1">{n.reason}</p>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{n.recommendedAction}</span>
                    <button
                      onClick={() => onActionClick && onActionClick(n.actionId)}
                      className="text-blue-400 font-bold hover:text-blue-300 flex items-center gap-0.5 shrink-0 ml-2"
                    >
                      Action →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
