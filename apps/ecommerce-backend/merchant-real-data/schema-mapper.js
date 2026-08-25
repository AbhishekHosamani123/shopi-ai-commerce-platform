"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemaMapper = exports.SchemaMapper = void 0;
class SchemaMapper {
    /**
     * Sanitizes raw cell strings against CSV formula injection and dangerous characters.
     */
    sanitizeString(val) {
        if (val === null || val === undefined)
            return '';
        let str = String(val).trim();
        // Neutralize spreadsheet formula execution risks (=, +, -, @, cmd)
        if (/^[=+\-@\t\r]/.test(str)) {
            str = `'${str}`;
        }
        // Remove control characters
        return str.replace(/[\x00-\x1F\x7F]/g, '');
    }
    /**
     * Parses and normalizes currency / numeric values.
     */
    parseNumber(val) {
        if (typeof val === 'number')
            return isNaN(val) ? 0 : val;
        if (!val)
            return 0;
        const cleaned = String(val).replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : Math.round(num * 100) / 100;
    }
    /**
     * Parses and normalizes ISO date strings.
     */
    parseDate(val) {
        if (!val)
            return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    /**
     * Auto-detects canonical mapping for an external header set.
     */
    autoDetectMapping(headers, fileType) {
        const mapping = {};
        const lower = headers.map(h => h.toLowerCase().trim().replace(/['"_\s-]/g, ''));
        headers.forEach((h, idx) => {
            const clean = lower[idx];
            if (fileType === 'PRODUCTS') {
                if (clean.includes('sku') || clean.includes('productid') || clean.includes('itemid') || clean.includes('code'))
                    mapping[h] = 'external_product_id';
                else if (clean.includes('name') || clean.includes('title') || clean.includes('product'))
                    mapping[h] = 'title';
                else if (clean.includes('cat') || clean.includes('dept'))
                    mapping[h] = 'category';
                else if (clean.includes('price') || clean.includes('mrp') || clean.includes('retail'))
                    mapping[h] = 'price';
                else if (clean.includes('cost') || clean.includes('cogs'))
                    mapping[h] = 'cost';
                else if (clean.includes('stock') || clean.includes('qty') || clean.includes('inventory'))
                    mapping[h] = 'stock';
            }
            else if (fileType === 'CUSTOMERS') {
                if (clean.includes('cust') || clean.includes('userid') || clean.includes('clientid'))
                    mapping[h] = 'external_customer_id';
                else if (clean.includes('name'))
                    mapping[h] = 'name';
                else if (clean.includes('email') || clean.includes('mail'))
                    mapping[h] = 'email';
            }
            else if (fileType === 'ORDERS') {
                if (clean.includes('orderid') || clean.includes('orderno') || clean.includes('ordernumber') || clean.includes('invoice'))
                    mapping[h] = 'external_order_id';
                else if (clean.includes('cust') || clean.includes('email') || clean.includes('buyer'))
                    mapping[h] = 'external_customer_id';
                else if (clean.includes('date') || clean.includes('time') || clean.includes('created'))
                    mapping[h] = 'order_date';
                else if (clean.includes('total') || clean.includes('amount') || clean.includes('gross') || clean.includes('revenue'))
                    mapping[h] = 'total_amount';
                else if (clean.includes('discount'))
                    mapping[h] = 'discount_total';
            }
            else if (fileType === 'ORDER_ITEMS') {
                if (clean.includes('orderid') || clean.includes('orderno'))
                    mapping[h] = 'external_order_id';
                else if (clean.includes('sku') || clean.includes('productid') || clean.includes('itemcode'))
                    mapping[h] = 'external_product_id';
                else if (clean.includes('qty') || clean.includes('quantity') || clean.includes('units'))
                    mapping[h] = 'quantity';
                else if (clean.includes('price') || clean.includes('rate') || clean.includes('unitprice'))
                    mapping[h] = 'unit_price';
                else if (clean.includes('total') || clean.includes('lineamount'))
                    mapping[h] = 'total_price';
            }
        });
        return mapping;
    }
}
exports.SchemaMapper = SchemaMapper;
exports.schemaMapper = new SchemaMapper();
