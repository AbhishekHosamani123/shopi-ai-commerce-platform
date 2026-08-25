export interface CanonicalProductMapping {
  externalSkuField: string;
  externalTitleField: string;
  externalCategoryField: string;
  externalPriceField: string;
  externalCostField?: string;
  externalStockField?: string;
}

export interface CanonicalOrderMapping {
  externalOrderIdField: string;
  externalCustomerIdField: string;
  externalDateField: string;
  externalTotalAmountField: string;
  externalItemSkuField: string;
  externalItemQuantityField: string;
  externalItemUnitPriceField: string;
}

export interface IngestionConnectorConfig {
  sourceType: 'CSV' | 'EXCEL' | 'REST_API' | 'POSTGRES_CONNECTOR' | 'SHOPIFY_WEBHOOK';
  mapping: {
    productMapping: CanonicalProductMapping;
    orderMapping: CanonicalOrderMapping;
  };
  validationRules: {
    strictReconciliation: boolean;
    rejectNegativePrices: boolean;
    requireValidDates: boolean;
  };
}

export const DEFAULT_CSV_MAPPING: IngestionConnectorConfig = {
  sourceType: 'CSV',
  mapping: {
    productMapping: {
      externalSkuField: 'sku',
      externalTitleField: 'product_name',
      externalCategoryField: 'category',
      externalPriceField: 'retail_price',
      externalCostField: 'cogs',
      externalStockField: 'inventory_count'
    },
    orderMapping: {
      externalOrderIdField: 'order_number',
      externalCustomerIdField: 'customer_email',
      externalDateField: 'created_at',
      externalTotalAmountField: 'order_total',
      externalItemSkuField: 'line_item_sku',
      externalItemQuantityField: 'line_item_quantity',
      externalItemUnitPriceField: 'line_item_price'
    }
  },
  validationRules: {
    strictReconciliation: true,
    rejectNegativePrices: true,
    requireValidDates: true
  }
};
