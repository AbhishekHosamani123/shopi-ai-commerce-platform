import {
  detectSalesAnomalies,
  detectInventoryAnomalies,
  detectDeadStockAnomalies,
  detectReturnAnomalies
} from './anomaly-detector';
import {
  detectGrowthOpportunities,
  detectCategorySurges,
  detectCustomerRetentionMilestones
} from './opportunity-detector';
import {
  createOrUpdateAlert,
  listAlerts,
  getAlertSummary
} from './proactive-alert-service';
import { ProactiveScanResult, DetectedBusinessEvent } from './proactive-types';

export class ProactiveIntelligenceEngine {
  /**
   * Runs an autonomous proactive scan across all business dimensions
   */
  async runProactiveScan(merchantId: string = 'default_merchant'): Promise<ProactiveScanResult> {
    const scanTimestamp = new Date().toISOString();

    // 1. Gather events from all detectors in parallel
    const [
      salesEvents,
      inventoryEvents,
      deadStockEvents,
      returnEvents,
      growthEvents,
      categoryEvents,
      customerEvents
    ] = await Promise.all([
      detectSalesAnomalies(),
      detectInventoryAnomalies(),
      detectDeadStockAnomalies(),
      detectReturnAnomalies(),
      detectGrowthOpportunities(),
      detectCategorySurges(),
      detectCustomerRetentionMilestones()
    ]);

    const allEvents: DetectedBusinessEvent[] = [
      ...salesEvents,
      ...inventoryEvents,
      ...deadStockEvents,
      ...returnEvents,
      ...growthEvents,
      ...categoryEvents,
      ...customerEvents
    ];

    let newAlertsCreated = 0;
    let alertsUpdated = 0;

    // 2. Persist with deduplication & Phase 3B action linking
    for (const event of allEvents) {
      try {
        const result = await createOrUpdateAlert(event, merchantId);
        if (result.isNew) {
          newAlertsCreated++;
        } else {
          alertsUpdated++;
        }
      } catch (err) {
        console.error('Failed to process proactive event:', err);
      }
    }

    // 3. Fetch latest active alerts & summary
    const { alerts, summary } = await listAlerts({ merchantId, limit: 30 });

    return {
      success: true,
      scanTimestamp,
      detectedEventsCount: allEvents.length,
      newAlertsCreated,
      alertsUpdated,
      summary,
      alerts
    };
  }
}
