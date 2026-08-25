"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CSV_MAPPING = void 0;
exports.DEFAULT_CSV_MAPPING = {
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
