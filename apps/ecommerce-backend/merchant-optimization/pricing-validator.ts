export interface PricingValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validates price adjustments against safe financial boundaries.
 */
export function validatePriceAdjustment(
  currentPrice: number,
  newPrice: number
): PricingValidationResult {
  if (newPrice <= 0) {
    return { isValid: false, reason: 'Price must be greater than zero.' };
  }

  if (newPrice < 100) {
    return { isValid: false, reason: 'Price cannot be set below minimum store threshold of ₹100.' };
  }

  const changePct = ((newPrice - currentPrice) / currentPrice) * 100;

  // Max 25% price hike in a single step
  if (changePct > 25) {
    return {
      isValid: false,
      reason: `Price increase of +${changePct.toFixed(1)}% exceeds maximum single adjustment guardrail of +25%.`
    };
  }

  // Max 30% price drop in a single step
  if (changePct < -30) {
    return {
      isValid: false,
      reason: `Price reduction of ${changePct.toFixed(1)}% exceeds maximum markdown guardrail of -30%.`
    };
  }

  return { isValid: true };
}
