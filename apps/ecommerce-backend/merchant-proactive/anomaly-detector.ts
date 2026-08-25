import {
  getMonthOverMonthComparison,
  getWeekOverWeekComparison,
  getLowStockProducts,
  getWorstPerformingProducts,
  getReturnAnalytics
} from '../merchant-intelligence';
import { DetectedBusinessEvent } from './proactive-types';

/**
 * Detects sales and order volume anomalies from comparative telemetry.
 */
export async function detectSalesAnomalies(): Promise<DetectedBusinessEvent[]> {
  const events: DetectedBusinessEvent[] = [];
  const [mom, wow] = await Promise.all([
    getMonthOverMonthComparison(),
    getWeekOverWeekComparison()
  ]);

  // 1. Month-over-Month Revenue Anomalies
  if (mom.growth.revenueChangePct >= 20) {
    events.push({
      alertType: 'REVENUE_SPIKE',
      severity: 'OPPORTUNITY',
      title: `Revenue Surge (+${mom.growth.revenueChangePct}% MoM)`,
      summary: `Gross revenue expanded by ${mom.growth.revenueChangePct}% compared to prior month (₹${mom.currentPeriod.revenue.toLocaleString('en-IN')} vs ₹${mom.previousPeriod.revenue.toLocaleString('en-IN')}).`,
      evidence: {
        currentRevenue: mom.currentPeriod.revenue,
        previousRevenue: mom.previousPeriod.revenue,
        growthPct: mom.growth.revenueChangePct,
        period: 'MoM'
      },
      recommendedAction: 'Scale promotional advertising on high-velocity catalog champions.'
    });
  } else if (mom.growth.revenueChangePct <= -20) {
    events.push({
      alertType: 'REVENUE_DROP',
      severity: 'CRITICAL',
      title: `Revenue Contraction (${mom.growth.revenueChangePct}% MoM)`,
      summary: `Gross revenue declined by ${Math.abs(mom.growth.revenueChangePct)}% compared to prior month (₹${mom.currentPeriod.revenue.toLocaleString('en-IN')} vs ₹${mom.previousPeriod.revenue.toLocaleString('en-IN')}).`,
      evidence: {
        currentRevenue: mom.currentPeriod.revenue,
        previousRevenue: mom.previousPeriod.revenue,
        growthPct: mom.growth.revenueChangePct,
        period: 'MoM'
      },
      recommendedAction: 'Analyze lagging product categories and launch retargeting campaign.'
    });
  }

  // 2. Week-over-Week Order Volume Anomalies
  if (wow.growth.ordersChangePct >= 25) {
    events.push({
      alertType: 'ORDER_SPIKE',
      severity: 'OPPORTUNITY',
      title: `Order Volume Spike (+${wow.growth.ordersChangePct}% WoW)`,
      summary: `Weekly order volume surged by ${wow.growth.ordersChangePct}% (${wow.currentPeriod.orders} orders vs ${wow.previousPeriod.orders} prior week).`,
      evidence: {
        currentOrders: wow.currentPeriod.orders,
        previousOrders: wow.previousPeriod.orders,
        growthPct: wow.growth.ordersChangePct,
        period: 'WoW'
      },
      recommendedAction: 'Ensure warehouse fulfillment staffing to prevent dispatch delays.'
    });
  } else if (wow.growth.ordersChangePct <= -25) {
    events.push({
      alertType: 'ORDER_DECLINE',
      severity: 'WARNING',
      title: `Order Volume Dip (${wow.growth.ordersChangePct}% WoW)`,
      summary: `Weekly order volume decreased by ${Math.abs(wow.growth.ordersChangePct)}% (${wow.currentPeriod.orders} orders vs ${wow.previousPeriod.orders} prior week).`,
      evidence: {
        currentOrders: wow.currentPeriod.orders,
        previousOrders: wow.previousPeriod.orders,
        growthPct: wow.growth.ordersChangePct,
        period: 'WoW'
      },
      recommendedAction: 'Review cart abandonment rates and send re-engagement incentives.'
    });
  }

  return events;
}

/**
 * Detects inventory stockout risks and velocity acceleration.
 */
export async function detectInventoryAnomalies(): Promise<DetectedBusinessEvent[]> {
  const events: DetectedBusinessEvent[] = [];
  const lowStock = await getLowStockProducts(500);

  for (const item of lowStock) {
    // Critical: < 7 days remaining
    if (item.estimatedDaysRemaining !== null && item.estimatedDaysRemaining <= 7) {
      events.push({
        alertType: 'STOCKOUT_IMMINENT',
        severity: 'CRITICAL',
        title: `Imminent Stockout Risk: ${item.title}`,
        summary: `"${item.title}" has only ${item.currentStock} units remaining (~${item.estimatedDaysRemaining} days of stock at ${item.dailyVelocity7d} units/day).`,
        evidence: {
          productId: item.productId,
          currentStock: item.currentStock,
          dailyVelocity: item.dailyVelocity7d,
          daysRemaining: item.estimatedDaysRemaining,
          recommendedReorder: item.restockRecommendedUnits || 50
        },
        relatedProductId: item.productId,
        relatedCategory: item.categoryName,
        recommendedAction: `Restock +${item.restockRecommendedUnits || 50} units immediately.`
      });
    } else if (item.estimatedDaysRemaining !== null && item.estimatedDaysRemaining <= 14) {
      events.push({
        alertType: 'LOW_STOCK_WARNING',
        severity: 'WARNING',
        title: `Low Stock Warning: ${item.title}`,
        summary: `"${item.title}" inventory coverage has fallen to ~${item.estimatedDaysRemaining} days (${item.currentStock} units in stock).`,
        evidence: {
          productId: item.productId,
          currentStock: item.currentStock,
          dailyVelocity: item.dailyVelocity7d,
          daysRemaining: item.estimatedDaysRemaining
        },
        relatedProductId: item.productId,
        relatedCategory: item.categoryName,
        recommendedAction: `Prepare purchase order for +${item.restockRecommendedUnits || 50} units.`
      });
    }
  }

  return events;
}

/**
 * Detects dead stock and lagging inventory.
 */
export async function detectDeadStockAnomalies(): Promise<DetectedBusinessEvent[]> {
  const events: DetectedBusinessEvent[] = [];
  const worst = await getWorstPerformingProducts(5, 'last_30_days');

  for (const item of worst) {
    if (item.unitsSold <= 15 && item.currentStock > 100) {
      events.push({
        alertType: 'DEAD_STOCK_ACCUMULATION',
        severity: 'WARNING',
        title: `Dead Stock Alert: ${item.title}`,
        summary: `"${item.title}" sold only ${item.unitsSold} units in 30 days while ${item.currentStock} units remain in storage tying up capital.`,
        evidence: {
          productId: item.productId,
          currentStock: item.currentStock,
          unitsSold30d: item.unitsSold,
          price: item.price
        },
        relatedProductId: item.productId,
        relatedCategory: item.categoryName,
        recommendedAction: 'Apply 10% clearance discount or product bundle.'
      });
    }
  }

  return events;
}

/**
 * Detects return rate spikes and primary defect reasons.
 */
export async function detectReturnAnomalies(): Promise<DetectedBusinessEvent[]> {
  const events: DetectedBusinessEvent[] = [];
  const returnsData = await getReturnAnalytics('last_30_days');

  if (returnsData.overallReturnRatePct >= 8.0) {
    const topReason = returnsData.reasonBreakdown?.[0];
    events.push({
      alertType: 'RETURN_RATE_ELEVATED',
      severity: 'WARNING',
      title: `Elevated Return Rate (${returnsData.overallReturnRatePct}%)`,
      summary: `Overall 30-day store return rate is ${returnsData.overallReturnRatePct}% (₹${(returnsData.totalRefundAmount || 0).toLocaleString('en-IN')} refunded). Top reason: ${topReason?.reason?.replace(/_/g, ' ') || 'sizing'}.`,
      evidence: {
        returnRatePct: returnsData.overallReturnRatePct,
        refundAmount: returnsData.totalRefundAmount,
        topReason: topReason?.reason,
        topReasonShare: topReason?.percentageOfReturns
      },
      recommendedAction: 'Audit size guides and garment fit specifications on top returned SKUs.'
    });
  }

  return events;
}
