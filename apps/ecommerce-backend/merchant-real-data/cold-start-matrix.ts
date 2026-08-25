export interface DataDepthCapability {
  daysOfHistory: number;
  basicSalesTelemetry: 'AVAILABLE' | 'UNAVAILABLE';
  inventoryAlerts: 'AVAILABLE' | 'LOW_CONFIDENCE' | 'UNAVAILABLE';
  demandForecast7d: 'AVAILABLE' | 'LOW_CONFIDENCE' | 'UNAVAILABLE';
  demandForecast30d: 'AVAILABLE' | 'LOW_CONFIDENCE' | 'UNAVAILABLE';
  seasonalityDetection: 'AVAILABLE' | 'LOW_CONFIDENCE' | 'UNAVAILABLE';
  customerLifetimeValue: 'AVAILABLE' | 'LOW_CONFIDENCE' | 'UNAVAILABLE';
  closedLoopLearning: 'AVAILABLE' | 'COLD_START_BASELINE';
  uiNotice: string;
}

export class ColdStartMatrix {
  /**
   * Returns trustworthy AI capabilities based on merchant's historical data depth.
   */
  getCapabilitiesByHistoryDays(days: number): DataDepthCapability {
    if (days < 7) {
      return {
        daysOfHistory: days,
        basicSalesTelemetry: 'AVAILABLE',
        inventoryAlerts: 'LOW_CONFIDENCE',
        demandForecast7d: 'LOW_CONFIDENCE',
        demandForecast30d: 'UNAVAILABLE',
        seasonalityDetection: 'UNAVAILABLE',
        customerLifetimeValue: 'UNAVAILABLE',
        closedLoopLearning: 'COLD_START_BASELINE',
        uiNotice: 'Early Onboarding: Only basic sales telemetry available. Forecasting requires at least 14 days of orders.'
      };
    } else if (days < 30) {
      return {
        daysOfHistory: days,
        basicSalesTelemetry: 'AVAILABLE',
        inventoryAlerts: 'AVAILABLE',
        demandForecast7d: 'AVAILABLE',
        demandForecast30d: 'LOW_CONFIDENCE',
        seasonalityDetection: 'LOW_CONFIDENCE',
        customerLifetimeValue: 'LOW_CONFIDENCE',
        closedLoopLearning: 'COLD_START_BASELINE',
        uiNotice: 'Short-term forecast active (7-day horizon). Seasonality and CLV require 90+ days of data.'
      };
    } else if (days < 90) {
      return {
        daysOfHistory: days,
        basicSalesTelemetry: 'AVAILABLE',
        inventoryAlerts: 'AVAILABLE',
        demandForecast7d: 'AVAILABLE',
        demandForecast30d: 'AVAILABLE',
        seasonalityDetection: 'LOW_CONFIDENCE',
        customerLifetimeValue: 'AVAILABLE',
        closedLoopLearning: 'COLD_START_BASELINE',
        uiNotice: '30-day forecasting and customer cohort intelligence active.'
      };
    } else {
      return {
        daysOfHistory: days,
        basicSalesTelemetry: 'AVAILABLE',
        inventoryAlerts: 'AVAILABLE',
        demandForecast7d: 'AVAILABLE',
        demandForecast30d: 'AVAILABLE',
        seasonalityDetection: 'AVAILABLE',
        customerLifetimeValue: 'AVAILABLE',
        closedLoopLearning: 'AVAILABLE',
        uiNotice: 'Full enterprise intelligence unlocked: seasonal trends, long-term forecasts, and merchant-specific learning active.'
      };
    }
  }
}

export const coldStartMatrix = new ColdStartMatrix();
