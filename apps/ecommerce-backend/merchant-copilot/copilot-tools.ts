import {
  getRevenueSummary,
  getSalesTrend,
  getMonthOverMonthComparison,
  getWeekOverWeekComparison,
  getTopProducts,
  getWorstPerformingProducts,
  getCategoryPerformance,
  getProductDetails,
  getLowStockProducts,
  getInventoryVelocity,
  getCustomerSummary,
  getRepeatCustomers,
  getReturnAnalytics,
  getCancellationAnalytics,
  getBusinessAlerts
} from '../merchant-intelligence';
import { MerchantSupabaseService } from '../data/merchantSupabaseService';
import { ToolDefinition } from '../ai-adapter/GroqAdapter';

/**
 * Controlled Tool Definitions for Groq / Llama-3.3-70B
 */
export const MERCHANT_COPILOT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_sales_overview',
    description: 'Retrieve executive sales and revenue metrics (gross revenue, net revenue, total orders, units sold, AOV, MoM growth) for a specific time period.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: 'Time period: today, last_7_days, last_30_days, last_90_days, this_month, last_month, this_year, last_12_months',
          default: 'last_30_days'
        }
      }
    }
  },
  {
    name: 'get_sales_trends',
    description: 'Retrieve time-series trend data for revenue, orders, and units sold over daily, weekly, or monthly intervals.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: 'Time period: last_7_days, last_30_days, last_90_days, last_12_months',
          default: 'last_30_days'
        },
        interval: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly'],
          description: 'Grouping interval',
          default: 'daily'
        }
      }
    }
  },
  {
    name: 'get_period_comparison',
    description: 'Retrieve Month-over-Month (MoM) or Week-over-Week (WoW) financial comparison showing revenue, order count, unit volume, and AOV percentage changes.',
    parameters: {
      type: 'object',
      properties: {
        comparisonType: {
          type: 'string',
          enum: ['mom', 'wow'],
          description: 'mom for Month-over-Month, wow for Week-over-Week',
          default: 'mom'
        }
      }
    }
  },
  {
    name: 'get_top_products',
    description: 'Retrieve the top-performing products ranked by gross revenue, unit volume, or sales velocity.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of products to return (default: 5, max: 20)',
          default: 5
        },
        period: {
          type: 'string',
          description: 'Time period: last_7_days, last_30_days, last_90_days, last_12_months',
          default: 'last_30_days'
        },
        sortBy: {
          type: 'string',
          enum: ['revenue', 'units', 'velocity'],
          description: 'Sorting criteria',
          default: 'revenue'
        }
      }
    }
  },
  {
    name: 'get_slow_moving_products',
    description: 'Retrieve slowest moving products or potential dead stock with lowest revenue and unit sales.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of products to return (default: 5)',
          default: 5
        },
        period: {
          type: 'string',
          description: 'Time period: last_30_days, last_90_days, last_12_months',
          default: 'last_30_days'
        }
      }
    }
  },
  {
    name: 'get_product_details',
    description: 'Retrieve deep-dive performance metrics for a specific product by name or ID (stock, price, units sold, revenue, return rate, velocity).',
    parameters: {
      type: 'object',
      properties: {
        productNameOrId: {
          type: 'string',
          description: 'Product name (e.g. "Smart Watch", "Winter Jacket") or product ID'
        },
        period: {
          type: 'string',
          description: 'Time period for performance telemetry',
          default: 'last_30_days'
        }
      },
      required: ['productNameOrId']
    }
  },
  {
    name: 'get_inventory_status',
    description: 'Retrieve stock levels, stockout risks, and days of inventory remaining across the catalog.',
    parameters: {
      type: 'object',
      properties: {
        threshold: {
          type: 'number',
          description: 'Stock threshold for low inventory inspection (default: 200 units)',
          default: 200
        }
      }
    }
  },
  {
    name: 'get_inventory_risk',
    description: 'Retrieve products with imminent stockout risk (< 14 days remaining), velocity, and recommended reorder quantities.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          default: 'last_30_days'
        }
      }
    }
  },
  {
    name: 'get_category_performance',
    description: 'Retrieve merchandise category performance, revenue contributions, unit volumes, and market share percentages.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          default: 'last_30_days'
        }
      }
    }
  },
  {
    name: 'get_customer_metrics',
    description: 'Retrieve customer health metrics: total registered users, active buyers, repeat customer rate, and average customer lifetime value (CLV).',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          default: 'last_12_months'
        }
      }
    }
  },
  {
    name: 'get_customer_segments',
    description: 'Retrieve buyer cohort breakdown (VIPs 16+ orders, Frequent 6-15 orders, Repeat 2-5 orders, One-Time 1 order) and revenue contribution per cohort.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          default: 'last_12_months'
        }
      }
    }
  },
  {
    name: 'get_return_metrics',
    description: 'Retrieve return rate, cancellation rate, return reasons breakdown, and products with highest return volume.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          default: 'last_12_months'
        }
      }
    }
  },
  {
    name: 'get_business_alerts',
    description: 'Retrieve active autonomous business alerts categorized into Critical, Warning, Opportunity, and Info with recommended operational actions.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_business_priorities',
    description: 'Retrieve top prioritized operational action items for today based on real inventory risks, sales momentum, and return rate anomalies.',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'investigate_why_sales_changed',
    description: 'Perform a comprehensive multi-dimensional investigation to explain why revenue or order volume shifted between periods.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          default: 'last_30_days'
        }
      }
    }
  }
];

/**
 * Multi-dimensional "Why" Diagnostic Investigator
 */
export async function investigateWhySalesChanged(period: string = 'last_30_days') {
  const [mom, topProds, worstProds, lowStock, alerts, returns] = await Promise.all([
    getMonthOverMonthComparison(),
    getTopProducts(5, period),
    getWorstPerformingProducts(5, period),
    getLowStockProducts(150),
    getBusinessAlerts(),
    getReturnAnalytics(period)
  ]);

  const revDelta = mom.growth.revenueChangePct;
  const ordDelta = mom.growth.ordersChangePct;
  const aovDelta = mom.growth.aovChangePct;
  const unitsDelta = mom.growth.unitsChangePct;

  const criticalStockouts = lowStock.filter(i => i.urgency === 'CRITICAL');
  const drivers: string[] = [];

  if (revDelta > 0) {
    if (ordDelta > 0) drivers.push(`Order volume surged +${ordDelta}% (${mom.currentPeriod.orders} orders vs ${mom.previousPeriod.orders})`);
    if (aovDelta > 0) drivers.push(`Average order value increased +${aovDelta}% to ₹${mom.currentPeriod.averageOrderValue.toLocaleString('en-IN')}`);
    if (topProds.length > 0) drivers.push(`Top product "${topProds[0].title}" generated ₹${topProds[0].revenue.toLocaleString('en-IN')} with ${topProds[0].salesVelocity7d}/day velocity`);
  } else {
    if (ordDelta < 0) drivers.push(`Order volume dropped ${ordDelta}% (${mom.currentPeriod.orders} orders vs ${mom.previousPeriod.orders})`);
    if (aovDelta < 0) drivers.push(`Basket size / AOV declined ${aovDelta}% to ₹${mom.currentPeriod.averageOrderValue.toLocaleString('en-IN')}`);
    if (criticalStockouts.length > 0) {
      drivers.push(`Inventory constraints on ${criticalStockouts.length} products (${criticalStockouts.map(c => c.title).slice(0, 2).join(', ')}) restricted fulfillment`);
    }
  }

  return {
    period: mom.currentPeriod.label,
    comparison: mom,
    revenueChangePct: revDelta,
    ordersChangePct: ordDelta,
    aovChangePct: aovDelta,
    unitsChangePct: unitsDelta,
    isPositiveGrowth: revDelta >= 0,
    primaryDrivers: drivers,
    criticalStockoutProducts: criticalStockouts.map(c => ({ title: c.title, stock: c.currentStock, daysRemaining: c.estimatedDaysRemaining })),
    topPerformers: topProds.slice(0, 3).map(p => ({ title: p.title, revenue: p.revenue, unitsSold: p.unitsSold })),
    underperformers: worstProds.slice(0, 3).map(p => ({ title: p.title, revenue: p.revenue, unitsSold: p.unitsSold })),
    returnRatePct: returns.overallReturnRatePct
  };
}

/**
 * Priority Action Synthesizer
 */
export async function getBusinessPriorities() {
  const [alerts, lowStock, mom, returns] = await Promise.all([
    getBusinessAlerts(),
    getLowStockProducts(150),
    getMonthOverMonthComparison(),
    getReturnAnalytics('last_30_days')
  ]);

  const priorities: Array<{
    rank: number;
    severity: 'CRITICAL' | 'WARNING' | 'OPPORTUNITY' | 'INFO';
    title: string;
    description: string;
    recommendedAction: string;
  }> = [];

  let rank = 1;

  // 1. Critical stockout risks
  const criticalStock = lowStock.filter(i => i.urgency === 'CRITICAL');
  for (const item of criticalStock) {
    priorities.push({
      rank: rank++,
      severity: 'CRITICAL',
      title: `Restock Imminent Out-of-Stock: ${item.title}`,
      description: `Only ${item.currentStock} units left (~${item.estimatedDaysRemaining} days remaining at ${item.dailyVelocity7d}/day velocity).`,
      recommendedAction: `Trigger purchase order for ${item.restockRecommendedUnits} units immediately.`
    });
  }

  // 2. Growth Opportunities
  const oppAlerts = alerts.filter(a => a.severity === 'OPPORTUNITY');
  for (const opp of oppAlerts) {
    priorities.push({
      rank: rank++,
      severity: 'OPPORTUNITY',
      title: opp.title,
      description: opp.description,
      recommendedAction: opp.recommendedAction
    });
  }

  // 3. Return rate review
  if (returns.overallReturnRatePct > 7.0 || returns.highestReturnProducts.length > 0) {
    const topRet = returns.highestReturnProducts[0];
    if (topRet) {
      priorities.push({
        rank: rank++,
        severity: 'WARNING',
        title: `Audit High Return Product: ${topRet.title}`,
        description: `Return rate is elevated at ${topRet.returnRatePct}% with ₹${topRet.refundAmount.toLocaleString('en-IN')} in refunds.`,
        recommendedAction: `Review size descriptions and product quality logs.`
      });
    }
  }

  // 4. Sales momentum overview
  priorities.push({
    rank: rank++,
    severity: mom.growth.revenueChangePct >= 0 ? 'OPPORTUNITY' : 'WARNING',
    title: `Monthly Growth Trajectory (${mom.growth.revenueChangePct >= 0 ? '+' : ''}${mom.growth.revenueChangePct}%)`,
    description: `Current 30-day revenue is ₹${mom.currentPeriod.revenue.toLocaleString('en-IN')} across ${mom.currentPeriod.orders} orders.`,
    recommendedAction: `Monitor category share and weekly order velocity.`
  });

  return {
    prioritiesCount: priorities.length,
    priorities
  };
}

/**
 * Central Tool Execution Router
 */
export async function executeCopilotTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
  const period = args.period || 'last_30_days';

  switch (toolName) {
    case 'get_sales_overview':
      return await getRevenueSummary(period);

    case 'get_sales_trends':
      return await getSalesTrend(period, args.interval || 'daily');

    case 'get_period_comparison':
      return args.comparisonType === 'wow'
        ? await getWeekOverWeekComparison()
        : await getMonthOverMonthComparison();

    case 'get_top_products':
      return await getTopProducts(args.limit || 5, period);

    case 'get_slow_moving_products':
      return await getWorstPerformingProducts(args.limit || 5, period);

    case 'get_product_details':
      return await getProductDetails(args.productNameOrId, period);

    case 'get_inventory_status':
      return await getLowStockProducts(args.threshold || 200);

    case 'get_inventory_risk': {
      const stock = await getLowStockProducts(150);
      return stock.filter(i => i.urgency === 'CRITICAL' || i.urgency === 'WARNING');
    }

    case 'get_category_performance':
      return await getCategoryPerformance(period);

    case 'get_customer_metrics':
      return await getCustomerSummary(period);

    case 'get_customer_segments':
      return await getRepeatCustomers(period);

    case 'get_return_metrics': {
      const [ret, can] = await Promise.all([
        getReturnAnalytics(period),
        getCancellationAnalytics(period)
      ]);
      return { returns: ret, cancellations: can };
    }

    case 'get_cancellation_metrics':
      return await getCancellationAnalytics(period);

    case 'get_business_alerts':
      return await getBusinessAlerts();

    case 'get_business_priorities':
      return await getBusinessPriorities();

    case 'investigate_why_sales_changed':
      return await investigateWhySalesChanged(period);

    case 'get_high_intent_customers':
      return await MerchantSupabaseService.getHighIntentCustomers();

    case 'get_cart_abandoners':
      return await MerchantSupabaseService.getCartAbandoners();

    case 'get_checkout_abandoners':
      return await MerchantSupabaseService.getCheckoutAbandoners();

    case 'get_dormant_customers':
      return await MerchantSupabaseService.getDormantCustomers(args.daysThreshold || 60);

    case 'get_stock_runway':
      return await MerchantSupabaseService.getStockRunway(args.productId || 1);

    default:
      throw new Error(`Unknown copilot tool: ${toolName}`);
  }
}
