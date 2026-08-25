export interface MerchantSystemNotification {
  notificationId: string;
  merchantId: string;
  severity: 'CRITICAL' | 'WARNING' | 'OPPORTUNITY' | 'INFO';
  category: 'INVENTORY' | 'REVENUE' | 'PROFITABILITY' | 'SUPPLIERS' | 'CUSTOMERS' | 'MODELS';
  title: string;
  reason: string;
  evidence: string;
  recommendedAction: string;
  actionId?: string | null;
  status: 'UNREAD' | 'READ' | 'DISMISSED' | 'ACTIONED';
  createdAt: string;
  readAt?: string | null;
  dismissedAt?: string | null;
  actionedAt?: string | null;
}

export interface NotificationFilterOptions {
  status?: 'UNREAD' | 'READ' | 'DISMISSED' | 'ACTIONED' | 'ALL';
  category?: string;
  severity?: string;
  limit?: number;
}
