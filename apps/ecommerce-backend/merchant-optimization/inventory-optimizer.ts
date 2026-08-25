import { forecastProductDemand } from './demand-forecast';
import { InventoryOptimizationPlan, UrgencyLevel } from './optimization-types';

/**
 * Calculates optimal inventory buffers, reorder points (ROP), safety stock, and reorder batch sizes.
 */
export async function optimizeProductInventory(productId: number): Promise<InventoryOptimizationPlan | null> {
  const forecast = await forecastProductDemand(productId);
  if (!forecast) return null;

  const leadTimeDays = 7; // Standard supplier lead time (7 days)
  const d = Math.max(0.5, forecast.forecastDailyDemand);
  const currentStock = forecast.currentStock;

  // Safety Stock = 3 days demand buffer
  const safetyStock = Math.ceil(d * 3);

  // Reorder Point (ROP) = (Lead Time * Daily Demand) + Safety Stock
  const reorderPoint = Math.round(d * leadTimeDays + safetyStock);

  // Recommended Reorder Quantity (Targeting 21 days coverage)
  const recommendedReorderQuantity = Math.max(25, Math.round(d * 21));

  const daysOfCover = d > 0 ? Math.round(currentStock / d) : null;

  let urgency: UrgencyLevel = 'INFO';
  let reason = `Stock coverage is healthy (~${daysOfCover} days of inventory).`;

  if (currentStock <= reorderPoint * 0.6 || (daysOfCover !== null && daysOfCover <= 7)) {
    urgency = 'CRITICAL';
    reason = `Imminent stockout risk: Available stock (${currentStock} units) is below critical threshold (~${daysOfCover} days coverage). Reorder +${recommendedReorderQuantity} units immediately.`;
  } else if (currentStock <= reorderPoint || (daysOfCover !== null && daysOfCover <= 14)) {
    urgency = 'WARNING';
    reason = `Inventory has reached Reorder Point (${currentStock} units vs ROP ${reorderPoint}). Order +${recommendedReorderQuantity} units to avoid stockouts during lead time.`;
  }

  return {
    productId: forecast.productId,
    title: forecast.title,
    currentStock,
    averageDailyDemand: forecast.historicalDailyVelocity30d,
    forecastDailyDemand: forecast.forecastDailyDemand,
    leadTimeDays,
    safetyStock,
    reorderPoint,
    recommendedReorderQuantity,
    daysOfCover,
    urgency,
    reason
  };
}
