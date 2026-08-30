import { client } from '../data/DB';
import { AdSpendSimulationInput, AdSpendSimulationResult } from './ad-types';

export class AdSimulator {
  /**
   * Simulates paid advertising traffic lift, revenue ranges, and stockout probability for a SKU.
   */
  async simulateAdSpend(input: AdSpendSimulationInput): Promise<AdSpendSimulationResult | null> {
    const prodRes = await client.query('SELECT product_id, sku, title, selling_price, stock_quantity as stock FROM shopi_products WHERE product_id = $1', [input.productId]);
    if (prodRes.rows.length === 0) return null;
    const prod = prodRes.rows[0];

    const currentStock = parseInt(prod.stock, 10) || 0;
    const price = parseFloat(prod.selling_price) || 1000;
    const spend = Math.max(1000, input.adSpend);

    // Heuristic CPC ~₹18 - ₹28, conversion ~2.0% - 3.5%
    const estimatedClicks = Math.round(spend / 22);
    const minUnits = Math.max(1, Math.round(estimatedClicks * 0.020));
    const midUnits = Math.max(2, Math.round(estimatedClicks * 0.028));
    const maxUnits = Math.max(3, Math.round(estimatedClicks * 0.038));

    const minRevenue = Math.round(minUnits * price);
    const midRevenue = Math.round(midUnits * price);
    const maxRevenue = Math.round(maxUnits * price);

    const projectedDepletion = currentStock - midUnits;
    const stockoutRiskAfterAdLift = projectedDepletion <= 5 ? 'HIGH' : projectedDepletion <= 15 ? 'MEDIUM' : 'LOW';

    return {
      simulatedLabel: 'SIMULATED / ESTIMATED',
      productId: prod.product_id,
      productTitle: prod.title,
      adSpend: spend,
      channel: input.channel || 'DIRECT_STORE',
      inventoryCoverageDays: Math.round(currentStock / Math.max(0.5, midUnits / 7)),
      projectedDemandRange: {
        minUnits,
        midUnits,
        maxUnits
      },
      projectedRevenueRange: {
        minRevenue,
        midRevenue,
        maxRevenue
      },
      stockoutRiskAfterAdLift,
      confidence: 'MEDIUM',
      assumptions: [
        `Heuristic conversion rate modeled between 2.0% and 3.8% for ${prod.title}.`,
        'CPC benchmark calibrated to Indian DTC commerce standards (~₹22/click).',
        'Assumes static pricing without concurrent flash discounts.'
      ]
    };
  }
}

export const adSimulator = new AdSimulator();
