import { client } from '../data/DB';

export type CustomerCohortType =
  | 'ONE_TIME'
  | 'REPEAT'
  | 'VIP'
  | 'PRICE_SENSITIVE'
  | 'HIGH_AOV'
  | 'LOW_AOV'
  | 'HIGH_RETURN'
  | 'LOYAL'
  | 'CHURNING';

export interface SimCustomer {
  customerId: string;
  merchantId: string;
  name: string;
  cohortType: CustomerCohortType;
  firstOrderDate: string;
  totalSpend: number;
  orderCount: number;
  isChurned: boolean;
}

const COHORTS: CustomerCohortType[] = [
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

export class CustomerGenerator {
  /**
   * Generates a cohort of simulated customer accounts.
   */
  async generateCustomers(merchantId: string, count: number): Promise<SimCustomer[]> {
    const customers: SimCustomer[] = [];

    // Clear existing simulation customers for tenant
    await client.query('DELETE FROM sandbox_sim_customers WHERE merchant_id = $1', [merchantId]);

    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 365); // 12 months ago

    for (let i = 1; i <= count; i++) {
      const customerId = `sim_cust_${merchantId}_${i}`;
      const cohort = COHORTS[i % COHORTS.length];
      const name = `Customer ${cohort} #${i}`;
      
      const firstDate = new Date(baseDate.getTime() + (i * 3600 * 1000 * 20) % (300 * 86400000));
      const isChurned = cohort === 'CHURNING';

      const res = await client.query(`
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
  }
}

export const customerGenerator = new CustomerGenerator();
