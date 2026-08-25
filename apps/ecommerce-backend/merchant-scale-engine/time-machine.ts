import { client } from '../data/DB';

export interface SimTimeState {
  merchantId: string;
  virtualCurrentDate: string;
  daysAdvancedTotal: number;
}

const simClocks: Map<string, { currentDate: Date; daysAdvanced: number }> = new Map();

export class TimeMachine {
  /**
   * Initializes or gets the virtual clock for a simulated merchant.
   */
  getVirtualClock(merchantId: string = 'sim_merchant_default'): SimTimeState {
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
  async advanceDays(merchantId: string, days: number): Promise<SimTimeState> {
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
  }

  /**
   * Resets the virtual clock to present day.
   */
  resetClock(merchantId: string): void {
    simClocks.delete(merchantId);
  }
}

export const timeMachine = new TimeMachine();
