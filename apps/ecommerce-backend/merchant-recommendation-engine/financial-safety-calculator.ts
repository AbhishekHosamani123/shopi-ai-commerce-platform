import { FinancialSafetyAnalysis, IncentiveOption } from './recommendation-types';
import { FinancialSafetyState } from '../merchant-opportunity-engine/opportunity-types';
import { MerchantFinancialPolicy, SYSTEM_DEFAULT_FINANCIAL_POLICY } from './financial-policy-service';

export class FinancialSafetyCalculator {
  /**
   * Computes comprehensive financial safety analysis and maximum allowable discount
   * combining hard mathematical safety limits with merchant-configurable policies.
   */
  public analyzeProductFinancials(inputs: {
    sellingPrice: number;
    cogs: number | null;
    cogsStatus: FinancialSafetyState;
    shippingCost?: number;
    handlingCost?: number;
    policy?: Partial<MerchantFinancialPolicy>;
    merchantMarginFloorPct?: number; // legacy backwards compatibility
  }): FinancialSafetyAnalysis {
    const price = Math.max(1, inputs.sellingPrice);
    const shipping = inputs.shippingCost ?? 65;
    const handling = inputs.handlingCost ?? 25;
    const paymentGateway = Math.round(price * 0.02 * 100) / 100; // 2.0% gateway cost

    // Resolve Effective Financial Policy (System Default vs Merchant Configured)
    const policy = inputs.policy;
    const minContribAmt = policy?.minimumContributionAmount !== undefined
      ? policy.minimumContributionAmount
      : SYSTEM_DEFAULT_FINANCIAL_POLICY.minimumContributionAmount;
    
    const minMarginPct = policy?.minimumMarginPercent !== undefined
      ? policy.minimumMarginPercent
      : (inputs.merchantMarginFloorPct ?? SYSTEM_DEFAULT_FINANCIAL_POLICY.minimumMarginPercent);

    const maxDiscountPct = policy?.maximumDiscountPercent !== undefined
      ? policy.maximumDiscountPercent
      : SYSTEM_DEFAULT_FINANCIAL_POLICY.maximumDiscountPercent;

    const policySource = policy?.policySource || (inputs.merchantMarginFloorPct !== undefined ? 'MERCHANT_CONFIGURED' : 'SYSTEM_DEFAULT');

    const cogs = inputs.cogs;
    const cogsStatus = inputs.cogsStatus;

    let totalVarCost = shipping + handling + paymentGateway;
    if (cogs !== null) {
      totalVarCost += cogs;
    }

    const currentContribution = cogs !== null ? Math.round((price - totalVarCost) * 100) / 100 : null;
    const currentMarginPct = currentContribution !== null && price > 0
      ? Math.round((currentContribution / price) * 1000) / 10
      : null;

    // Minimum allowed contribution in rupees
    const minContributionByFloor = Math.round(price * (minMarginPct / 100) * 100) / 100;
    const minAllowedContribution = Math.max(minContribAmt, minContributionByFloor);

    // Maximum discount limits
    const merchantMaxDiscount = Math.round(price * (maxDiscountPct / 100) * 100) / 100;
    let financiallySafeDiscount = 0;
    let effectiveMaxDiscount = 0;
    let isDiscountSafe = false;
    let discountBlockReason: string | undefined;

    // Hard Integrity Protections (Cannot be bypassed even by merchant override)
    if (cogsStatus === 'MISSING_COGS' || cogs === null) {
      financiallySafeDiscount = 0;
      effectiveMaxDiscount = 0;
      isDiscountSafe = false;
      discountBlockReason = 'Discount blocked: Product lacks verified COGS ledger record. Net profit cannot be guaranteed.';
    } else if (currentContribution === null || currentContribution <= minAllowedContribution) {
      financiallySafeDiscount = 0;
      effectiveMaxDiscount = 0;
      isDiscountSafe = false;
      discountBlockReason = `Discount blocked: Current contribution (₹${currentContribution || 0}) is at or below the minimum margin floor of ₹${minAllowedContribution}.`;
    } else {
      financiallySafeDiscount = Math.max(0, Math.round((currentContribution - minAllowedContribution) * 100) / 100);
      // Lower of two safety rule (Financial Limit vs Merchant Cap)
      effectiveMaxDiscount = Math.min(financiallySafeDiscount, merchantMaxDiscount);
      isDiscountSafe = effectiveMaxDiscount > 0;
      if (!isDiscountSafe) {
        discountBlockReason = `Discount blocked: Maximum safe discount headroom is ₹0.`;
      }
    }

    const shippingStatus: 'KNOWN_ACTUAL' | 'ESTIMATED' = inputs.shippingCost !== undefined ? 'KNOWN_ACTUAL' : 'ESTIMATED';
    const handlingStatus: 'KNOWN_ACTUAL' | 'ESTIMATED' = inputs.handlingCost !== undefined ? 'KNOWN_ACTUAL' : 'ESTIMATED';
    const marginPolicyStatus = policySource === 'MERCHANT_CONFIGURED' ? 'MERCHANT_CONFIGURED_POLICY' : 'DEFAULT_SAFETY_POLICY';

    return {
      sellingPrice: price,
      cogs,
      cogsStatus,
      unitShipping: shipping,
      shippingStatus,
      unitHandling: handling,
      handlingStatus,
      unitPaymentGatewayCost: paymentGateway,
      variableCostStatus: 'ESTIMATED',
      totalVariableCost: Math.round(totalVarCost * 100) / 100,
      currentContribution,
      currentMarginPct,
      minimumContributionAmount: minContribAmt,
      minimumMarginPercent: minMarginPct,
      maximumDiscountPercent: maxDiscountPct,
      policySource,
      minAllowedContribution,
      minMarginFloorPct: minMarginPct,
      marginPolicyStatus,
      financiallySafeDiscount,
      merchantMaxDiscount,
      maxSafeDiscount: effectiveMaxDiscount,
      isDiscountSafe,
      discountBlockReason
    };
  }

  /**
   * Evaluates a candidate incentive option against the product's financial safety boundaries.
   */
  public evaluateCandidateOption(
    optionId: string,
    name: string,
    incentiveType: 'PERCENTAGE_DISCOUNT' | 'FIXED_AMOUNT_DISCOUNT' | 'COUPON' | 'NO_INCENTIVE',
    discountValue: number,
    financials: FinancialSafetyAnalysis,
    customRationale?: string
  ): IncentiveOption {
    let discountAmount = 0;
    if (incentiveType === 'PERCENTAGE_DISCOUNT') {
      discountAmount = Math.round((financials.sellingPrice * (discountValue / 100)) * 100) / 100;
    } else if (incentiveType === 'FIXED_AMOUNT_DISCOUNT' || incentiveType === 'COUPON') {
      discountAmount = discountValue;
    } else {
      discountAmount = 0;
    }

    const projectedPrice = Math.max(0, financials.sellingPrice - discountAmount);
    let projectedContribution: number | null = null;
    let contributionChange: number | null = null;
    let isPreserved = false;

    if (financials.cogs !== null && financials.currentContribution !== null) {
      // Recalculate gateway cost on discounted price
      const newGatewayCost = Math.round(projectedPrice * 0.02 * 100) / 100;
      const newVarCost = financials.cogs + financials.unitShipping + financials.unitHandling + newGatewayCost;
      projectedContribution = Math.round((projectedPrice - newVarCost) * 100) / 100;
      contributionChange = Math.round((projectedContribution - financials.currentContribution) * 100) / 100;
      
      // Candidate must preserve minimum margin floor, must not exceed maxSafeDiscount, and price must be > 0
      const isPricePositive = projectedPrice > 0 && discountAmount < financials.sellingPrice;
      const isWithinEffectiveCap = discountAmount <= financials.maxSafeDiscount;
      const isAboveFloor = projectedContribution >= financials.minAllowedContribution;

      isPreserved = isPricePositive && isWithinEffectiveCap && isAboveFloor;
    } else {
      isPreserved = incentiveType === 'NO_INCENTIVE';
    }

    let rationale = customRationale || '';
    if (!rationale) {
      if (incentiveType === 'NO_INCENTIVE') {
        rationale = 'Maintain standard full-margin catalog price. Zero discount cost.';
      } else if (isPreserved) {
        rationale = `Financially safe: Projected contribution of ₹${projectedContribution} exceeds minimum floor of ₹${financials.minAllowedContribution} (${financials.policySource}).`;
      } else if (projectedPrice <= 0) {
        rationale = `Blocked: Proposed discount reduces selling price to zero or negative (₹${projectedPrice}).`;
      } else if (discountAmount > financials.maxSafeDiscount) {
        rationale = `Blocked: Proposed discount of ₹${discountAmount} exceeds maximum allowed discount limit of ₹${financials.maxSafeDiscount} (${financials.policySource}).`;
      } else {
        rationale = `Blocked: Projected contribution of ₹${projectedContribution || 0} violates minimum margin floor of ₹${financials.minAllowedContribution}.`;
      }
    }

    return {
      optionId,
      name,
      incentiveType,
      discountValue,
      projectedSellingPrice: projectedPrice,
      projectedContribution,
      contributionChange,
      isMarginFloorPreserved: isPreserved,
      isRecommended: isPreserved && incentiveType !== 'NO_INCENTIVE',
      rationale
    };
  }
}

export const financialSafetyCalculator = new FinancialSafetyCalculator();
