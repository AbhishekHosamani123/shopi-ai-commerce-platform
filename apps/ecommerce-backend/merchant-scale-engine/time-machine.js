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
exports.timeMachine = exports.TimeMachine = void 0;
const simClocks = new Map();
class TimeMachine {
    /**
     * Initializes or gets the virtual clock for a simulated merchant.
     */
    getVirtualClock(merchantId = 'sim_merchant_default') {
        let clock = simClocks.get(merchantId);
        if (!clock) {
            clock = { currentDate: new Date(), daysAdvanced: 0 };
            simClocks.set(merchantId, clock);
        }
        return {
            merchantId,
            virtualCurrentDate: clock.currentDate.toISOString(),
            daysAdvancedTotal: clock.daysAdvanced
        };
    }
    /**
     * Advances the simulation clock forward by a specified number of days (1, 7, 30, 90).
     */
    advanceDays(merchantId, days) {
        return __awaiter(this, void 0, void 0, function* () {
            let clock = simClocks.get(merchantId);
            if (!clock) {
                clock = { currentDate: new Date(), daysAdvanced: 0 };
                simClocks.set(merchantId, clock);
            }
            clock.currentDate = new Date(clock.currentDate.getTime() + days * 86400000);
            clock.daysAdvanced += days;
            return {
                merchantId,
                virtualCurrentDate: clock.currentDate.toISOString(),
                daysAdvancedTotal: clock.daysAdvanced
            };
        });
    }
    /**
     * Resets the virtual clock to present day.
     */
    resetClock(merchantId) {
        simClocks.delete(merchantId);
    }
}
exports.TimeMachine = TimeMachine;
exports.timeMachine = new TimeMachine();
