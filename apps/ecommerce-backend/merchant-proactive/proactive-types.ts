/**
 * ⚡ Merchant AI Proactive Intelligence & Anomaly Detection Types (Phase 3C)
 */

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'OPPORTUNITY' | 'INFO';

export type AlertStatus =
  | 'NEW'
  | 'SEEN'
  | 'ACKNOWLEDGED'
  | 'ACTION_PENDING'
  | 'RESOLVED'
  | 'EXPIRED';

export interface DetectedBusinessEvent {
  alertType: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
  evidence: Record<string, any>;
  relatedProductId?: number | null;
  relatedCategory?: string | null;
  recommendedAction?: string | null;
  actionId?: string | null;
  expiresInHours?: number;
}

export interface MerchantAiAlertRecord {
  alertId: string;
  merchantId: string;
  alertType: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
  evidence: Record<string, any>;
  fingerprint: string;
  relatedProductId?: number | null;
  relatedCategory?: string | null;
  recommendedAction?: string | null;
  actionId?: string | null;
  status: AlertStatus;
  createdAt: string;
  expiresAt?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
}

export interface ProactiveAlertSummary {
  totalAlerts: number;
  criticalCount: number;
  warningCount: number;
  opportunityCount: number;
  infoCount: number;
  newCount: number;
  acknowledgedCount: number;
}

export interface ProactiveScanResult {
  success: boolean;
  scanTimestamp: string;
  detectedEventsCount: number;
  newAlertsCreated: number;
  alertsUpdated: number;
  summary: ProactiveAlertSummary;
  alerts: MerchantAiAlertRecord[];
}
