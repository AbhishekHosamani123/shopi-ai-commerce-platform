/**
 * ⚡ Merchant Intelligence Analytical Services
 * 
 * Reusable, strictly read-only analytics functions querying PostgreSQL.
 * Securely isolated from customer-side Shopi AI and public shopping routes.
 */

export {
  getRevenueSummary,
  getSalesTrend,
  getMonthOverMonthComparison,
  getWeekOverWeekComparison
} from './revenue-analytics';

export {
  getTopProducts,
  getWorstPerformingProducts,
  getCategoryPerformance,
  getProductDetails
} from './product-analytics';

export {
  getLowStockProducts,
  getInventoryVelocity
} from './inventory-analytics';

export {
  getCustomerSummary,
  getRepeatCustomers
} from './customer-analytics';

export {
  getReturnAnalytics,
  getCancellationAnalytics
} from './return-analytics';

export {
  getBusinessAlerts,
  BusinessAlert
} from './alerts-engine';


