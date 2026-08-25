"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pilotModeGuard = exports.PilotModeGuard = void 0;
const pilotConfigs = new Map();
class PilotModeGuard {
    /**
     * Initializes or returns Pilot Mode config for a merchant.
     */
    getPilotConfig(merchantId = 'default_pilot_merchant') {
        let cfg = pilotConfigs.get(merchantId);
        if (!cfg) {
            cfg = {
                merchantId,
                isPilotActive: true,
                autonomousMutationsAllowed: false,
                activeIntegrations: ['CSV_INGESTION'],
                dailyAiQueryQuota: 500,
                usedAiQueriesToday: 0,
                estimatedAiCostInr: 0.0
            };
            pilotConfigs.set(merchantId, cfg);
        }
        return cfg;
    }
    /**
     * Verifies if an action is permitted under Pilot Mode rules.
     * Autonomous mutations are strictly blocked. Explicit approval is required.
     */
    canExecuteAction(merchantId, isExplicitlyApproved) {
        const cfg = this.getPilotConfig(merchantId);
        if (!isExplicitlyApproved) {
            return {
                allowed: false,
                reason: 'PILOT MODE SAFETY GUARD: Autonomous mutations are disabled. All inventory, pricing, and campaign changes require explicit merchant approval.'
            };
        }
        return { allowed: true };
    }
    /**
     * Records AI query usage in pilot mode.
     */
    recordAiUsage(merchantId, tokensUsed = 150) {
        const cfg = this.getPilotConfig(merchantId);
        cfg.usedAiQueriesToday++;
        cfg.estimatedAiCostInr += (tokensUsed / 1000) * 0.15; // ₹0.15 per 1k tokens
        return cfg;
    }
}
exports.PilotModeGuard = PilotModeGuard;
exports.pilotModeGuard = new PilotModeGuard();
