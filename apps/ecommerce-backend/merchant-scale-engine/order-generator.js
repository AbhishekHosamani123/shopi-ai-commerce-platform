"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderGenerator = exports.OrderGenerator = void 0;
const DB_1 = require("../data/DB");
class OrderGenerator {
    /**
     * Generates a realistic historical order stream spanning 12+ months with strict mathematical consistency.
     */
    generateOrders(merchantId, products, customers, orderCount) {
        return __awaiter(this, void 0, void 0, function* () {
            // Clear existing simulation orders and ledger
            yield DB_1.client.query('DELETE FROM sandbox_sim_orderitems WHERE order_id IN (SELECT order_id FROM sandbox_sim_orders WHERE merchant_id = $1)', [merchantId]);
            yield DB_1.client.query('DELETE FROM sandbox_sim_orders WHERE merchant_id = $1', [merchantId]);
            yield DB_1.client.query('DELETE FROM sandbox_sim_inventory_ledger WHERE merchant_id = $1', [merchantId]);
            yield DB_1.client.query('DELETE FROM sandbox_sim_returns WHERE merchant_id = $1', [merchantId]);
            let totalRevenue = 0;
            let totalUnits = 0;
            let totalReturns = 0;
            const baseDate = new Date();
            baseDate.setDate(baseDate.getDate() - 365); // 365 days ago
            for (let i = 1; i <= orderCount; i++) {
                const orderId = `sim_ord_${merchantId}_${i}`;
                const customer = customers[i % customers.length];
                // Time distribution across 365 days with weekend multiplier
                const dayOffset = Math.floor((i / orderCount) * 365);
                const orderDate = new Date(baseDate.getTime() + (dayOffset * 86400000) + ((i * 37) % 86400000));
                const dayOfWeek = orderDate.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                // Select 1-3 products per order
                const itemCount = 1 + (i % 3);
                let subtotal = 0;
                const items = [];
                for (let j = 0; j < itemCount; j++) {
                    const prod = products[(i + j * 7) % products.length];
                    const quantity = 1 + (j === 0 && isWeekend ? 1 : 0);
                    const unitPrice = prod.price;
                    const discount = prod.behaviorProfile === 'DEAD_STOCK' ? Math.round(unitPrice * 0.15) : 0;
                    const totalPrice = (unitPrice - discount) * quantity;
                    subtotal += totalPrice;
                    totalUnits += quantity;
                    items.push({
                        productId: prod.productId,
                        quantity,
                        unitPrice,
                        discount,
                        totalPrice
                    });
                }
                const totalAmount = subtotal;
                totalRevenue += totalAmount;
                // Insert Order
                yield DB_1.client.query(`
        INSERT INTO sandbox_sim_orders (
          order_id, merchant_id, customer_id, order_date, order_status,
          payment_status, subtotal, discount_total, total_amount, created_at
        ) VALUES ($1, $2, $3, $4, 'COMPLETED', 'PAID', $5, 0, $6, $4)
      `, [
                    orderId,
                    merchantId,
                    customer.customerId,
                    orderDate.toISOString(),
                    subtotal,
                    totalAmount
                ]);
                // Insert Order Items and Update Inventory Ledger
                for (const it of items) {
                    yield DB_1.client.query(`
          INSERT INTO sandbox_sim_orderitems (
            order_id, product_id, quantity, unit_price, discount, total_price
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
                        orderId,
                        it.productId,
                        it.quantity,
                        it.unitPrice,
                        it.discount,
                        it.totalPrice
                    ]);
                    // Inventory ledger deduction
                    yield DB_1.client.query(`
          INSERT INTO sandbox_sim_inventory_ledger (
            merchant_id, product_id, movement_type, quantity, opening_stock, closing_stock, reference_id, timestamp
          ) VALUES ($1, $2, 'SALE', $3, 100, 100 - $3, $4, $5)
        `, [
                        merchantId,
                        it.productId,
                        it.quantity,
                        orderId,
                        orderDate.toISOString()
                    ]);
                    // Return simulation based on product return probability
                    const prod = products.find(p => p.productId === it.productId);
                    if (prod && Math.random() < prod.returnProbability) {
                        totalReturns++;
                        const returnId = `sim_ret_${orderId}_${it.productId}`;
                        yield DB_1.client.query(`
            INSERT INTO sandbox_sim_returns (
              return_id, merchant_id, order_id, product_id, quantity, reason, refund_amount, return_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
                            returnId,
                            merchantId,
                            orderId,
                            it.productId,
                            1,
                            'Size or Fit Mismatch',
                            it.unitPrice,
                            new Date(orderDate.getTime() + 4 * 86400000).toISOString()
                        ]);
                    }
                }
            }
            return {
                orderCount,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalUnits,
                totalReturns
            };
        });
    }
}
exports.OrderGenerator = OrderGenerator;
exports.orderGenerator = new OrderGenerator();
