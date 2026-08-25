export type ImportFileType = 
  | 'PRODUCTS' 
  | 'ORDERS' 
  | 'ORDER_ITEMS' 
  | 'CUSTOMERS' 
  | 'INVENTORY' 
  | 'COGS' 
  | 'SUPPLIERS';

export interface CsvRowError {
  rowNumber: number;
  field: string;
  message: string;
  rawValue?: any;
}

export interface CsvValidationResult {
  fileType: ImportFileType;
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  canCommit: boolean;
  errors: CsvRowError[];
  previewRows: Array<Record<string, any>>;
  detectedColumns: string[];
}

export interface CsvCommitResult {
  importId: string;
  merchantId: string;
  fileType: ImportFileType;
  filename: string;
  totalRows: number;
  validRowsCommitted: number;
  duplicateRowsSkipped: number;
  invalidRowsRejected: number;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  committedAt: string;
}

export interface ImportHistoryRecord {
  importId: string;
  merchantId: string;
  fileType: ImportFileType;
  filename: string;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  status: string;
  isDryRun: boolean;
  createdAt: string;
}
