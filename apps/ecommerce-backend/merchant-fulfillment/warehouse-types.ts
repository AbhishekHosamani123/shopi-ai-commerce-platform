/**
 * ⚡ Multi-Warehouse Fulfillment & Geospatial Routing Types (Phase 6)
 */

export type WarehouseStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
export type TransferStatus = 'DRAFT' | 'APPROVAL_REQUIRED' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
export type StockAllocationStrategy = 'KEEP' | 'TRANSFER' | 'RESTOCK' | 'REDUCE' | 'RESERVE';

export interface WarehouseRecord {
  warehouseId: string;
  merchantId: string;
  name: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  capacity: number;
  status: WarehouseStatus;
  shippingZones: string[]; // e.g. ['NORTH', 'NCR', 'DELHI']
  createdAt: string;
}

export interface WarehouseInventoryRecord {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  merchantId: string;
  productId: number;
  productTitle?: string;
  availableQuantity: number;
  reservedQuantity: number;
  reorderPoint: number;
  safetyStock: number;
  updatedAt: string;
}

export interface WarehouseSKUAllocation {
  productId: number;
  productTitle: string;
  warehouseId: string;
  warehouseName: string;
  currentAvailable: number;
  regionalDemandDaily: number;
  daysOfCover: number;
  recommendedStrategy: StockAllocationStrategy;
  recommendedTransferQuantity?: number;
  targetWarehouseId?: string;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface GeospatialRoutingResult {
  bestWarehouseId: string;
  bestWarehouseName: string;
  productId: number;
  requestedQuantity: number;
  canFulfill: boolean;
  availableStock: number;
  estimatedShippingCost: number;
  estimatedTransitDays: number;
  shippingZone: string;
  routingReason: string;
}

export interface InventoryTransferRecord {
  transferId: string;
  merchantId: string;
  sourceWarehouseId: string;
  sourceWarehouseName?: string;
  targetWarehouseId: string;
  targetWarehouseName?: string;
  productId: number;
  productTitle?: string;
  quantity: number;
  status: TransferStatus;
  estimatedShippingCost: number;
  actionId?: string | null;
  reason: string;
  approvedBy?: string | null;
  createdAt: string;
  completedAt?: string | null;
}
