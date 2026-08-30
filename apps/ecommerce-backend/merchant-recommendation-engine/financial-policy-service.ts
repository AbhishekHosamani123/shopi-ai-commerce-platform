import { client } from '../data/DB';

export type FinancialPolicySource = 'MERCHANT_CONFIGURED' | 'SYSTEM_DEFAULT';

export interface MerchantFinancialPolicy {
  merchantId: string;
  minimumContributionAmount: number;
  minimumMarginPercent: number;
  maximumDiscountPercent: number;
  policySource: FinancialPolicySource;
  updatedAt: string;
}

export interface UpdateFinancialPolicyInput {
  minimumContributionAmount?: number;
  minimumMarginPercent?: number;
  maximumDiscountPercent?: number;
}

export const SYSTEM_DEFAULT_FINANCIAL_POLICY: Omit<MerchantFinancialPolicy, 'merchantId'> = {
  minimumContributionAmount: 150.0, // ₹150 minimum rupee contribution
  minimumMarginPercent: 15.0,       // 15% minimum contribution margin
  maximumDiscountPercent: 30.0,     // 30% absolute maximum discount ceiling
  policySource: 'SYSTEM_DEFAULT',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

export class FinancialPolicyService {
  private schemaEnsured = false;

  /**
   * Idempotently ensures financial policy columns exist on merchant_ai_settings.
   */
  async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return;
    try {
      await client.query(`
        ALTER TABLE merchant_ai_settings 
        ADD COLUMN IF NOT EXISTS min_contribution_inr NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS min_margin_pct NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS max_discount_pct NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS financial_policy_source VARCHAR(32) DEFAULT 'SYSTEM_DEFAULT';
      `);
      this.schemaEnsured = true;
    } catch (e: any) {
      console.warn('FinancialPolicyService ensureSchema warning:', e.message);
    }
  }

  /**
   * Retrieves effective financial safety policy for a merchant.
   * If merchant has not configured custom policy, returns SYSTEM_DEFAULT.
   */
  async getEffectivePolicy(merchantId: string = 'default_merchant'): Promise<MerchantFinancialPolicy> {
    await this.ensureSchema();

    try {
      const res = await client.query(
        `SELECT min_contribution_inr, min_margin_pct, max_discount_pct, financial_policy_source, updated_at 
         FROM merchant_ai_settings 
         WHERE merchant_id = $1`,
        [merchantId]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
        const hasCustomConfig =
          row.min_contribution_inr !== null ||
          row.min_margin_pct !== null ||
          row.max_discount_pct !== null;

        if (hasCustomConfig && row.financial_policy_source === 'MERCHANT_CONFIGURED') {
          return {
            merchantId,
            minimumContributionAmount:
              row.min_contribution_inr !== null
                ? parseFloat(row.min_contribution_inr)
                : SYSTEM_DEFAULT_FINANCIAL_POLICY.minimumContributionAmount,
            minimumMarginPercent:
              row.min_margin_pct !== null
                ? parseFloat(row.min_margin_pct)
                : SYSTEM_DEFAULT_FINANCIAL_POLICY.minimumMarginPercent,
            maximumDiscountPercent:
              row.max_discount_pct !== null
                ? parseFloat(row.max_discount_pct)
                : SYSTEM_DEFAULT_FINANCIAL_POLICY.maximumDiscountPercent,
            policySource: 'MERCHANT_CONFIGURED',
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
          };
        }
      }
    } catch (err: any) {
      console.error('Error fetching merchant financial policy:', err.message);
    }

    // Default Fallback
    return {
      merchantId,
      ...SYSTEM_DEFAULT_FINANCIAL_POLICY,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Configures or updates custom financial policy for a merchant.
   */
  async setMerchantPolicy(
    merchantId: string,
    input: UpdateFinancialPolicyInput
  ): Promise<MerchantFinancialPolicy> {
    await this.ensureSchema();

    const minContrib = input.minimumContributionAmount !== undefined
      ? input.minimumContributionAmount
      : SYSTEM_DEFAULT_FINANCIAL_POLICY.minimumContributionAmount;
    const minMargin = input.minimumMarginPercent !== undefined
      ? input.minimumMarginPercent
      : SYSTEM_DEFAULT_FINANCIAL_POLICY.minimumMarginPercent;
    const maxDisc = input.maximumDiscountPercent !== undefined
      ? input.maximumDiscountPercent
      : SYSTEM_DEFAULT_FINANCIAL_POLICY.maximumDiscountPercent;

    const upsertQuery = `
      INSERT INTO merchant_ai_settings (
        merchant_id, min_contribution_inr, min_margin_pct, max_discount_pct, financial_policy_source, updated_at
      ) VALUES ($1, $2, $3, $4, 'MERCHANT_CONFIGURED', CURRENT_TIMESTAMP)
      ON CONFLICT (merchant_id) DO UPDATE SET
        min_contribution_inr = EXCLUDED.min_contribution_inr,
        min_margin_pct = EXCLUDED.min_margin_pct,
        max_discount_pct = EXCLUDED.max_discount_pct,
        financial_policy_source = 'MERCHANT_CONFIGURED',
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const res = await client.query(upsertQuery, [merchantId, minContrib, minMargin, maxDisc]);
    const row = res.rows[0];

    return {
      merchantId,
      minimumContributionAmount: parseFloat(row.min_contribution_inr),
      minimumMarginPercent: parseFloat(row.min_margin_pct),
      maximumDiscountPercent: parseFloat(row.max_discount_pct),
      policySource: 'MERCHANT_CONFIGURED',
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  /**
   * Resets merchant policy back to system default.
   */
  async resetToSystemDefault(merchantId: string): Promise<MerchantFinancialPolicy> {
    await this.ensureSchema();

    await client.query(`
      UPDATE merchant_ai_settings 
      SET min_contribution_inr = NULL,
          min_margin_pct = NULL,
          max_discount_pct = NULL,
          financial_policy_source = 'SYSTEM_DEFAULT',
          updated_at = CURRENT_TIMESTAMP
      WHERE merchant_id = $1;
    `, [merchantId]);

    return {
      merchantId,
      ...SYSTEM_DEFAULT_FINANCIAL_POLICY,
      updatedAt: new Date().toISOString()
    };
  }
}

export const financialPolicyService = new FinancialPolicyService();
