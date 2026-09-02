import { client } from '../data/DB';
import {
  ConsentStatus,
  SuppressionReason,
  CustomerConsentRecord
} from './communication-types';

export class CommunicationEligibilityService {
  /**
   * Retrieves or initializes customer consent and suppression preferences.
   * Accepts legacy numeric user IDs and canonical shopi_customers string IDs (CUST-####).
   */
  async getCustomerConsent(customerId: number | string, merchantId: string = 'default_merchant'): Promise<CustomerConsentRecord> {
    // The consent ledger keys on integer user IDs. Canonical shopi customers (CUST-####)
    // have no row here — check shopi_customer_consents (channel/consent_status shape).
    const lookupShopiConsent = async (): Promise<CustomerConsentRecord | null> => {
      const shopiRes = await client.query(`
        SELECT channel, consent_status FROM shopi_customer_consents WHERE customer_id = $1
      `, [String(customerId)]).catch(() => ({ rows: [] as any[] }));
      if (!shopiRes.rows || shopiRes.rows.length === 0) return null;
      const emailDenied = shopiRes.rows.some((r: any) => r.channel === 'EMAIL' && /denied|opt_?out/i.test(String(r.consent_status || '')));
      const waDenied = shopiRes.rows.some((r: any) => r.channel === 'WHATSAPP' && /denied|opt_?out/i.test(String(r.consent_status || '')));
      return {
        customerId,
        merchantId,
        emailConsent: emailDenied ? 'CONSENT_DENIED' : 'CONSENT_GRANTED',
        whatsAppConsent: waDenied ? 'CONSENT_DENIED' : 'CONSENT_GRANTED',
        isEmailUnsubscribed: emailDenied,
        isWhatsAppOptedOut: waDenied,
        isGlobalOptedOut: emailDenied && waDenied,
        lastUpdated: new Date().toISOString()
      };
    };

    let res: any = { rows: [] };
    if (typeof customerId === 'number' || /^\d+$/.test(String(customerId))) {
      res = await client.query(`
        SELECT * FROM customer_communication_consents
        WHERE customer_id = $1 AND merchant_id = $2
      `, [parseInt(String(customerId), 10), merchantId]);
      if (res.rows.length === 0) {
        const shopiConsent = await lookupShopiConsent();
        if (shopiConsent) return shopiConsent;
      }
    } else {
      const shopiConsent = await lookupShopiConsent();
      if (shopiConsent) return shopiConsent;
    }

    if (res.rows.length > 0) {
      const r = res.rows[0];
      return {
        customerId: r.customer_id,
        merchantId: r.merchant_id,
        emailConsent: r.email_consent as ConsentStatus,
        whatsAppConsent: r.whatsapp_consent as ConsentStatus,
        isEmailUnsubscribed: r.is_email_unsubscribed,
        isWhatsAppOptedOut: r.is_whatsapp_opted_out,
        isGlobalOptedOut: r.is_global_opted_out,
        lastUpdated: r.last_updated
      };
    }

    // Default consent profile for existing registered customers
    return {
      customerId,
      merchantId,
      emailConsent: 'CONSENT_GRANTED',
      whatsAppConsent: 'CONSENT_GRANTED',
      isEmailUnsubscribed: false,
      isWhatsAppOptedOut: false,
      isGlobalOptedOut: false,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Sets customer communication consent and opt-out preferences.
   */
  async setCustomerConsent(
    customerId: number,
    merchantId: string,
    preferences: Partial<CustomerConsentRecord>
  ): Promise<CustomerConsentRecord> {
    const current = await this.getCustomerConsent(customerId, merchantId);
    const updated: CustomerConsentRecord = {
      ...current,
      ...preferences,
      lastUpdated: new Date().toISOString()
    };

    await client.query(`
      INSERT INTO customer_communication_consents (
        customer_id, merchant_id, email_consent, whatsapp_consent,
        is_email_unsubscribed, is_whatsapp_opted_out, is_global_opted_out, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (customer_id, merchant_id) DO UPDATE SET
        email_consent = EXCLUDED.email_consent,
        whatsapp_consent = EXCLUDED.whatsapp_consent,
        is_email_unsubscribed = EXCLUDED.is_email_unsubscribed,
        is_whatsapp_opted_out = EXCLUDED.is_whatsapp_opted_out,
        is_global_opted_out = EXCLUDED.is_global_opted_out,
        last_updated = EXCLUDED.last_updated;
    `, [
      customerId,
      merchantId,
      updated.emailConsent,
      updated.whatsAppConsent,
      updated.isEmailUnsubscribed,
      updated.isWhatsAppOptedOut,
      updated.isGlobalOptedOut,
      updated.lastUpdated
    ]);

    return updated;
  }

  /**
   * Comprehensive eligibility check for a customer and channel.
   * Accepts legacy numeric user IDs and canonical shopi_customers string IDs (CUST-####).
   */
  async evaluateCustomerEligibility(
    customerId: number | string,
    merchantId: string,
    channel: 'EMAIL' | 'WHATSAPP',
    targetProductIds: number[] = [],
    campaignCreatedAt?: string,
    options?: { skipPurchaseSuppression?: boolean }
  ): Promise<{ isEligible: boolean; suppressionReason?: SuppressionReason; explanation?: string }> {
    // 1. Fetch user existence
    let userEmail: string | null = null;
    let userPhone: string | null = null;

    const isCanonicalStringId = typeof customerId === 'string' && /^CUST-\d+$/i.test(customerId);

    if (isCanonicalStringId) {
      // Canonical shopi_customers ID — resolve email/phone from the shopi tables
      // (must be checked BEFORE the legacy users query: users.userid is an integer column)
      const shopiRes = await client.query(
        `SELECT customer_id, email, phone FROM shopi_customers WHERE customer_id = $1`,
        [customerId]
      );
      if (shopiRes.rows.length > 0) {
        userEmail = shopiRes.rows[0].email;
        userPhone = shopiRes.rows[0].phone;
      } else {
        return { isEligible: false, suppressionReason: 'INVALID_RECIPIENT', explanation: `Customer ID ${customerId} not found.` };
      }
    } else {
      const userRes = await client.query(`SELECT userid, email, mobile_number as mobilenumber FROM users WHERE userid = $1`, [customerId]);
      if (userRes.rows.length > 0) {
        userEmail = userRes.rows[0].email;
        userPhone = userRes.rows[0].mobilenumber;
      } else if (typeof customerId === 'number' && customerId >= 90000) {
        // Test customer account simulation
        userEmail = `customer_${customerId}@store.local`;
        userPhone = `+9198765${String(customerId).padStart(5, '0')}`;
      } else {
        return { isEligible: false, suppressionReason: 'INVALID_RECIPIENT', explanation: `Customer ID ${customerId} not found.` };
      }
    }

    if (channel === 'EMAIL' && !userEmail) {
      return { isEligible: false, suppressionReason: 'INVALID_RECIPIENT', explanation: 'Missing email address.' };
    }
    if (channel === 'WHATSAPP' && !userPhone) {
      return { isEligible: false, suppressionReason: 'INVALID_RECIPIENT', explanation: 'Missing WhatsApp mobile phone number.' };
    }

    // 2. Fetch Consent and Opt-out record
    const consent = await this.getCustomerConsent(customerId, merchantId);

    if (consent.isGlobalOptedOut) {
      return { isEligible: false, suppressionReason: 'GLOBAL_MARKETING_OPT_OUT', explanation: 'Customer has opted out of all store marketing.' };
    }

    if (channel === 'EMAIL') {
      if (consent.isEmailUnsubscribed) {
        return { isEligible: false, suppressionReason: 'EMAIL_UNSUBSCRIBED', explanation: 'Customer has unsubscribed from email campaigns.' };
      }
      if (consent.emailConsent === 'CONSENT_DENIED') {
        return { isEligible: false, suppressionReason: 'CONSENT_DENIED', explanation: 'Customer explicitly denied email marketing consent.' };
      }
      if (consent.emailConsent === 'CONSENT_UNKNOWN') {
        return { isEligible: false, suppressionReason: 'CONSENT_UNKNOWN', explanation: 'Customer email consent is unknown; fail-closed.' };
      }
    }

    if (channel === 'WHATSAPP') {
      if (consent.isWhatsAppOptedOut) {
        return { isEligible: false, suppressionReason: 'WHATSAPP_OPTED_OUT', explanation: 'Customer has opted out of WhatsApp messages.' };
      }
      if (consent.whatsAppConsent === 'CONSENT_DENIED') {
        return { isEligible: false, suppressionReason: 'CONSENT_DENIED', explanation: 'Customer explicitly denied WhatsApp marketing consent.' };
      }
      if (consent.whatsAppConsent === 'CONSENT_UNKNOWN') {
        return { isEligible: false, suppressionReason: 'CONSENT_UNKNOWN', explanation: 'Customer WhatsApp consent is unknown; fail-closed.' };
      }
    }

    // 3. Purchase Override Check (Did customer purchase the target product recently or after campaign creation?)
    // Skipped for win-back campaign types (dormant/VIP/repeat): the whole point is
    // re-engaging past buyers, so a historical purchase is expected, not disqualifying.
    if (targetProductIds.length > 0 && !options?.skipPurchaseSuppression) {
      if (isCanonicalStringId) {
        // Canonical shopi orders (customer_id is a string like CUST-0101)
        const purchaseRes = await client.query(`
          SELECT o.order_id, o.order_placed_at
          FROM shopi_orders o
          JOIN shopi_order_items oi ON o.order_id = oi.order_id
          WHERE o.customer_id = $1
            AND oi.product_id = ANY($2::int[])
            AND o.order_status NOT IN ('CANCELLED', 'Cancelled')
          LIMIT 1;
        `, [customerId, targetProductIds]);

        if (purchaseRes.rows.length > 0) {
          return {
            isEligible: false,
            suppressionReason: 'SUPPRESSED_ALREADY_PURCHASED',
            explanation: 'Customer has already purchased the target product in this conversion window.'
          };
        }
      } else {
        // Legacy orders (userid is an integer; orderitems.productid is VARCHAR
        // — text[] cast, an ::int[] throws 'character varying = integer').
        const purchaseRes = await client.query(`
          SELECT o.orderid, o.createdat
          FROM orders o
          JOIN orderitems oi ON o.orderid = oi.orderid
          WHERE o.userid = $1
            AND oi.productid = ANY($2::text[])
            AND o.orderstatus NOT IN ('CANCELLED', 'Cancelled')
          LIMIT 1;
        `, [customerId, targetProductIds.map(String)]);

        if (purchaseRes.rows.length > 0) {
          return {
            isEligible: false,
            suppressionReason: 'SUPPRESSED_ALREADY_PURCHASED',
            explanation: 'Customer has already purchased the target product in this conversion window.'
          };
        }
      }
    }

    // 4. Communication Cooldown Check (7 days cooldown across marketing campaigns)
    // merchant_campaign_messages.customer_id is an integer column (legacy schema):
    // canonical CUST-#### IDs are stored there by their numeric part (e.g. CUST-0101 → 101).
    const cooldownCustomerId = isCanonicalStringId
      ? parseInt(String(customerId).replace(/\D/g, ''), 10)
      : customerId;
    const cooldownRes = await client.query(`
      SELECT sent_at
      FROM merchant_campaign_messages
      WHERE customer_id = $1 
        AND merchant_id = $2
        AND status IN ('SENT', 'DELIVERED', 'SIMULATED')
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      LIMIT 1;
    `, [cooldownCustomerId, merchantId]);

    if (cooldownRes.rows.length > 0) {
      return {
        isEligible: false,
        suppressionReason: 'COMMUNICATION_COOLDOWN',
        explanation: 'Customer received marketing communication within the active 7-day cooldown window.'
      };
    }

    return { isEligible: true };
  }
}

export const communicationEligibilityService = new CommunicationEligibilityService();
