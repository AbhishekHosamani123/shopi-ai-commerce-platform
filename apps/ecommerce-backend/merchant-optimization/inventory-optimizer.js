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
exports.optimizeProductInventory = optimizeProductInventory;
const demand_forecast_1 = require("./demand-forecast");
/**
 * Calculates optimal inventory buffers, reorder points (ROP), safety stock, and reorder batch sizes.
 */
function optimizeProductInventory(productId) {
    return __awaiter(this, void 0, void 0, function* () {
        const forecast = yield (0, demand_forecast_1.forecastProductDemand)(productId);
        if (!forecast)
            return null;
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
        let urgency = 'INFO';
        let reason = `Stock coverage is healthy (~${daysOfCover} days of inventory).`;
        if (currentStock <= reorderPoint * 0.6 || (daysOfCover !== null && daysOfCover <= 7)) {
            urgency = 'CRITICAL';
            reason = `Imminent stockout risk: Available stock (${currentStock} units) is below critical threshold (~${daysOfCover} days coverage). Reorder +${recommendedReorderQuantity} units immediately.`;
        }
        else if (currentStock <= reorderPoint || (daysOfCover !== null && daysOfCover <= 14)) {
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
    });
}
