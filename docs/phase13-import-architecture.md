# 🔌 Phase 13: Real Merchant Data Import & Mapping Architecture

## 1. Canonical Schema Mappings

To support future real-world merchant data imports (CSV, Excel, REST API, Shopify Webhooks), the engine provides canonical field mapping definitions:

```typescript
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
```
