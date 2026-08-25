export type RealImportFileType =
  | 'PRODUCTS'
  | 'CUSTOMERS'
  | 'ORDERS'
  | 'ORDER_ITEMS'
  | 'INVENTORY'
  | 'RETURNS'
  | 'PAYMENTS'
  | 'PRICE_HISTORY';

export interface ColumnMappingDefinition {
  externalField: string;
  canonicalField: string;
  dataType: 'STRING' | 'NUMBER' | 'DATE' | 'CURRENCY';
  isRequired: boolean;
  transformationNotes?: string;
}

export interface ImportPreviewSummary {
  importId: string;
  merchantId: string;
  fileType: RealImportFileType;
  filename: string;
  totalRowsDetected: number;
  validRowsCount: number;
  invalidRowsCount: number;
  duplicateRowsCount: number;
  validityPercentage: number;
  dateRange?: { minDate: string; maxDate: string };
  revenueRange?: { minAmount: number; maxAmount: number; totalGrossRevenue: number };
  detectedColumns: string[];
  mappedColumns: Record<string, string>;
  validationErrors: Array<{ rowNumber: number; field: string; error: string; rawValue?: any }>;
  previewRows: Array<Record<string, any>>;
  canCommit: boolean;
}

export interface ImportCommitReceipt {
  importId: string;
  merchantId: string;
  fileType: RealImportFileType;
  filename: string;
  rowsProcessed: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsRejected: number;
  sourceRevenue: number;
  importedRevenue: number;
  reconciliationStatus: 'RECONCILED' | 'RECONCILIATION_FAILED' | 'NOT_APPLICABLE';
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  committedAt: string;
}

export interface IncrementalSyncReceipt {
  syncId: string;
  merchantId: string;
  connectorType: string;
  rowsProcessed: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsRejected: number;
  status: 'COMPLETED' | 'FAILED';
  lastSyncCompletedAt: string;
}

export interface PilotModeConfig {
  merchantId: string;
  isPilotActive: boolean;
  autonomousMutationsAllowed: false; // Always false in pilot mode
  activeIntegrations: string[];
  dailyAiQueryQuota: number;
  usedAiQueriesToday: number;
  estimatedAiCostInr: number;
}
