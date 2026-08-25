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
exports.customerGenerator = exports.CustomerGenerator = void 0;
const DB_1 = require("../data/DB");
const COHORTS = [
    'ONE_TIME',
    'REPEAT',
    'VIP',
    'PRICE_SENSITIVE',
    'HIGH_AOV',
    'LOW_AOV',
    'HIGH_RETURN',
    'LOYAL',
    'CHURNING'
];
class CustomerGenerator {
    /**
     * Generates a cohort of simulated customer accounts.
     */
    generateCustomers(merchantId, count) {
        return __awaiter(this, void 0, void 0, function* () {
            const customers = [];
            // Clear existing simulation customers for tenant
            yield DB_1.client.query('DELETE FROM sandbox_sim_customers WHERE merchant_id = $1', [merchantId]);
            const baseDate = new Date();
            baseDate.setDate(baseDate.getDate() - 365); // 12 months ago
            for (let i = 1; i <= count; i++) {
                const customerId = `sim_cust_${merchantId}_${i}`;
                const cohort = COHORTS[i % COHORTS.length];
                const name = `Customer ${cohort} #${i}`;
                const firstDate = new Date(baseDate.getTime() + (i * 3600 * 1000 * 20) % (300 * 86400000));
                const isChurned = cohort === 'CHURNING';
                const res = yield DB_1.client.query(`
        INSERT INTO sandbox_sim_customers (
          customer_id, merchant_id, name, cohort_type, first_order_date, is_churned
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `, [
                    customerId,
                    merchantId,
                    name,
                    cohort,
                    firstDate.toISOString(),
                    isChurned
                ]);
                const r = res.rows[0];
                customers.push({
                    customerId: r.customer_id,
                    merchantId: r.merchant_id,
                    name: r.name,
                    cohortType: r.cohort_type,
                    firstOrderDate: r.first_order_date,
                    totalSpend: parseFloat(r.total_spend || '0'),
                    orderCount: r.order_count || 0,
                    isChurned: r.is_churned
                });
            }
            return customers;
        });
    }
}
exports.CustomerGenerator = CustomerGenerator;
exports.customerGenerator = new CustomerGenerator();
