/**
 * ⚡ Merchant AI Supplier & Procurement Intelligence Types (Phase 5)
 */

export type SupplierProtocol = 'SUPPLIER_API' | 'SFTP' | 'AS2' | 'EMAIL' | 'MANUAL';

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export type SupplierReliabilityScore = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SupplierRecord {
  supplierId: string;
  merchantId: string;
  name: string;
  leadTimeDays: number;
  minimumOrderQuantity: number;
  unitCost?: number | null;
  reliabilityScore: SupplierReliabilityScore;
  contact: {
    email?: string;
    phone?: string;
    address?: string;
    ediEndpoint?: string;
  };
  supportedProducts: number[]; // array of productids
  status: 'ACTIVE' | 'INACTIVE';
  isSynthetic: boolean;
  createdAt: string;
}

export interface SupplierPerformanceMetrics {
  supplierId: string;
  supplierName: string;
  onTimeDeliveryPct: number;
  avgLeadTimeDays: number;
  fillRatePct: number;
  totalOrdersCount: number;
  reliabilityScore: SupplierReliabilityScore;
  stockoutCorrelationPct: number;
  reliabilityExplanation: string;
}

export interface PurchaseOrderItem {
  productId: number;
  productTitle: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface PurchaseOrderRecord {
  poId: string;
  merchantId: string;
  poNumber: string;
  supplierId: string | null;
  supplierName?: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  approvedBy?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  htmlContent?: string;
}

export interface PurchaseOrderAuditEvent {
  eventId: string;
  poId: string;
  merchantId: string;
  fromStatus: PurchaseOrderStatus | null;
  toStatus: PurchaseOrderStatus;
  triggeredBy: string;
  notes?: string | null;
  createdAt: string;
}

export interface CreatePurchaseOrderInput {
  merchantId?: string;
  supplierId?: string;
  items: {
    productId: number;
    quantity: number;
    unitCost?: number;
  }[];
  notes?: string;
}
