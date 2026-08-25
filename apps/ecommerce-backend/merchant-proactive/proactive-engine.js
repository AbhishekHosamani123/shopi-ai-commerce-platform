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
exports.ProactiveIntelligenceEngine = void 0;
const anomaly_detector_1 = require("./anomaly-detector");
const opportunity_detector_1 = require("./opportunity-detector");
const proactive_alert_service_1 = require("./proactive-alert-service");
class ProactiveIntelligenceEngine {
    /**
     * Runs an autonomous proactive scan across all business dimensions
     */
    runProactiveScan() {
        return __awaiter(this, arguments, void 0, function* (merchantId = 'default_merchant') {
            const scanTimestamp = new Date().toISOString();
            // 1. Gather events from all detectors in parallel
            const [salesEvents, inventoryEvents, deadStockEvents, returnEvents, growthEvents, categoryEvents, customerEvents] = yield Promise.all([
                (0, anomaly_detector_1.detectSalesAnomalies)(),
                (0, anomaly_detector_1.detectInventoryAnomalies)(),
                (0, anomaly_detector_1.detectDeadStockAnomalies)(),
                (0, anomaly_detector_1.detectReturnAnomalies)(),
                (0, opportunity_detector_1.detectGrowthOpportunities)(),
                (0, opportunity_detector_1.detectCategorySurges)(),
                (0, opportunity_detector_1.detectCustomerRetentionMilestones)()
            ]);
            const allEvents = [
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
                    const result = yield (0, proactive_alert_service_1.createOrUpdateAlert)(event, merchantId);
                    if (result.isNew) {
                        newAlertsCreated++;
                    }
                    else {
                        alertsUpdated++;
                    }
                }
                catch (err) {
                    console.error('Failed to process proactive event:', err);
                }
            }
            // 3. Fetch latest active alerts & summary
            const { alerts, summary } = yield (0, proactive_alert_service_1.listAlerts)({ merchantId, limit: 30 });
            return {
                success: true,
                scanTimestamp,
                detectedEventsCount: allEvents.length,
                newAlertsCreated,
                alertsUpdated,
                summary,
                alerts
            };
        });
    }
}
exports.ProactiveIntelligenceEngine = ProactiveIntelligenceEngine;
