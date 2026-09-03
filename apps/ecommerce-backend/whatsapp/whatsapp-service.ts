import { client } from '../data/DB';
import { WhatsAppSendMode } from './whatsapp-types';
import { evolutionApiClient } from './evolution-api-client';
import { whatsAppAllowlistService } from './whatsapp-allowlist-service';
import { whatsAppNumberValidatorService } from './whatsapp-number-validator';
import { whatsAppMessageBuilderService } from './whatsapp-message-builder';

export type WhatsAppDispatchMode = WhatsAppSendMode | 'DRY_RUN' | 'TEST';

export type WhatsAppSendOutcome = {
  success: boolean;
  simulated: boolean;
  status: 'SIMULATED_DELIVERED' | 'DELIVERED' | 'SENT' | 'FAILED' | 'SKIPPED';
  providerMessageId?: string;
  senderInstance?: string;
  error?: string;
  failureCategory?: string;
  /** The exact payload that would be sent (persisted for audit in DRY_RUN). */
  payload: {
    to: string;
    senderInstance: string;
    text: string;
    campaignId: string;
    customerId: number | string;
  };
};

/**
 * WhatsApp delivery orchestration over Evolution API.
 *
 * BUILDATHON ARCHITECTURE (hard constraints):
 *
 *   Connected WhatsApp account (QR-scanned by the merchant)
 *        ↓  Evolution API instance (WHATSAPP_SENDER_INSTANCE)
 *   Shopi WhatsApp Service (this class)
 *        ↓  ONLY approved recipients
 *        ├── +918431406956
 *        └── +916366475180
 *
 * Layered safety model (all fail closed):
 * 1. WHATSAPP_SEND_MODE (default DRY_RUN) gates real sends; LIVE additionally
 *    requires COMMUNICATION_MODE=PRODUCTION.
 * 2. The QR-connected sender instance must exist AND be in state 'open'.
 * 3. Recipient must be structurally valid AND on the Buildathon allowlist —
 *    every other number is refused with "Recipient not in Buildathon WhatsApp
 *    allowlist." regardless of campaign audience.
 * 4. Every dispatch returns a structured outcome for the channel-level audit
 *    trail; a WhatsApp failure never throws into the campaign loop.
 */
export class WhatsAppService {
  /** Current send mode; defaults to LIVE when in PRODUCTION mode. */
  getSendMode(): WhatsAppSendMode {
    const mode = (process.env.WHATSAPP_SEND_MODE || (process.env.COMMUNICATION_MODE === 'PRODUCTION' ? 'LIVE' : 'DRY_RUN')).toUpperCase();
    return mode === 'LIVE' ? 'LIVE' : 'DRY_RUN';
  }

  /**
   * Live send requires the explicit WHATSAPP_SEND_MODE=LIVE or COMMUNICATION_MODE=PRODUCTION.
   */
  private isLiveSendEnabled(): boolean {
    const commMode = (process.env.COMMUNICATION_MODE || 'DRY_RUN').toUpperCase();
    return this.getSendMode() === 'LIVE' || commMode === 'PRODUCTION';
  }

  /** Sanitized runtime description (zero secrets). */
  describeRuntime(): {
    sendMode: WhatsAppSendMode;
    evolutionConfigured: boolean;
    senderInstance: string;
    allowedRecipients: string[];
  } {
    return {
      sendMode: this.getSendMode(),
      evolutionConfigured: evolutionApiClient.isConfigured(),
      senderInstance: whatsAppAllowlistService.getSenderInstanceName(),
      allowedRecipients: whatsAppAllowlistService.getAllowedRecipients()
    };
  }

  /**
   * Ensures the sender instance exists. Does NOT connect it — the QR scan is
   * a manual step performed by the merchant on their WhatsApp phone.
   */
  async ensureSenderInstance(): Promise<{ exists: boolean; created: boolean; instanceName: string; error?: string }> {
    const instanceName = whatsAppAllowlistService.getSenderInstanceName();
    try {
      const existing = await evolutionApiClient.fetchInstanceByName(instanceName);
      if (existing) {
        return { exists: true, created: false, instanceName };
      }
      const created = await evolutionApiClient.createInstance(instanceName);
      if (!created.ok) {
        return { exists: false, created: false, instanceName, error: created.error };
      }
      return { exists: true, created: true, instanceName };
    } catch (err: any) {
      return { exists: false, created: false, instanceName, error: err.message };
    }
  }

  /**
   * Retrieves the current QR code for the sender instance, creating the
   * instance first if needed. The merchant scans this with the WhatsApp
   * account they want to use as the SENDER. The scanned account becomes the
   * sender; it is not related to the recipient allowlist in any way.
   */
  async getSenderQrCode(): Promise<{
    success: boolean;
    instanceName: string;
    state?: string | null;
    qrCodeBase64?: string;
    pairingCode?: string | null;
    waking?: boolean;
    error?: string;
  }> {
    const instanceName = whatsAppAllowlistService.getSenderInstanceName();

    // Cheap gateway probe FIRST: if the Evolution service is still waking up
    // (Render cold start), return immediately instead of running three
    // sequential calls that would each burn the full retry budget (~270s).
    // The route turns this into a 503 'evolution_waking' and the frontend
    // retries every 20s while the backend warm-assist pulls the service up.
    const probe = await evolutionApiClient.fetchInstances();
    if (!probe.ok && probe.waking) {
      return { success: false, instanceName, waking: true, error: probe.error };
    }

    const existing = await evolutionApiClient.fetchInstanceByName(instanceName);
    if (!existing) {
      const created = await evolutionApiClient.createInstance(instanceName);
      if (!created.ok) {
        const waking = (created as any).waking === true;
        return { success: false, instanceName, waking, error: created.error || 'Failed to create Evolution sender instance.' };
      }
    }

    const state = await evolutionApiClient.getConnectionState(instanceName);
    if (state === 'open') {
      return { success: true, instanceName, state, qrCodeBase64: undefined };
    }

    const connectRes = await evolutionApiClient.connectInstance(instanceName);
    if (!connectRes.ok || !connectRes.data) {
      return { success: false, instanceName, error: connectRes.error || 'Failed to retrieve QR code from Evolution API.' };
    }
    const qr = connectRes.data;
    return {
      success: true,
      instanceName,
      state,
      qrCodeBase64: qr.base64 ?? undefined,
      pairingCode: qr.pairingCode ?? null
    };
  }

  /**
   * Disconnects the WhatsApp sender: logs the paired session out via
   * Evolution API so the account is no longer the active sender. The
   * instance remains and needs a fresh QR scan (getSenderQrCode) to
   * reconnect. Fails cleanly when it is not connected.
   */
  async disconnectSender(): Promise<{
    success: boolean;
    instanceName: string;
    state?: string | null;
    error?: string;
  }> {
    const instanceName = whatsAppAllowlistService.getSenderInstanceName();
    const state = await evolutionApiClient.getConnectionState(instanceName);
    if (state !== 'open') {
      return { success: false, instanceName, state, error: 'WhatsApp sender is not connected.' };
    }
    const res = await evolutionApiClient.logoutInstance(instanceName);
    if (!res.ok) {
      return { success: false, instanceName, error: res.error || 'Failed to log out the WhatsApp sender.' };
    }
    const newState = await evolutionApiClient.getConnectionState(instanceName);
    return { success: true, instanceName, state: newState };
  }

  /**
   * Dispatches one WhatsApp message.
   *
   * Order of checks (each fails closed with a structured reason):
   *   1. Recipient phone is structurally valid.
   *   2. Recipient is on the Buildathon allowlist (hard recipient constraint).
   *   3. Sender instance exists and is connected ('open').
   *   4. DRY_RUN stops here with a simulated record; LIVE additionally
   *      requires WHATSAPP_SEND_MODE=LIVE + COMMUNICATION_MODE=PRODUCTION,
   *      then performs the single dispatch through the connected sender.
   */
  async sendMessage(params: {
    campaignId: string;
    customerId: number | string;
    customerName: string;
    customerPhone: string | null;
    text: string;
    /** Public URL of the SAME personalized banner the email embeds (requirement:
     *  WhatsApp must carry the identical promotional image, not a different one). */
    imageUrl?: string;
    mode?: WhatsAppDispatchMode;
  }): Promise<WhatsAppSendOutcome> {
    const mode: WhatsAppDispatchMode = params.mode || this.getSendMode();
    const sendMode: WhatsAppSendMode = mode === 'TEST' ? 'DRY_RUN' : (mode as WhatsAppSendMode);
    const instanceName = whatsAppAllowlistService.getSenderInstanceName();

    const buildPayload = (to: string) => ({
      to,
      senderInstance: instanceName,
      text: params.text,
      campaignId: params.campaignId,
      customerId: params.customerId,
      ...(params.imageUrl ? { image: params.imageUrl } : {})
    });

    // ---- 1. Structural recipient validation ----
    const normalizedCustomer = whatsAppNumberValidatorService.normalizeCustomerNumber(params.customerPhone);
    if (!normalizedCustomer) {
      return {
        success: false,
        simulated: sendMode === 'DRY_RUN',
        status: 'SKIPPED',
        error: 'Customer does not have a valid WhatsApp-capable phone number.',
        failureCategory: 'INVALID_RECIPIENT',
        payload: buildPayload(params.customerPhone || '')
      };
    }

    // ---- 2. Buildathon recipient allowlist (hard constraint) ----
    const recipientCheck = whatsAppAllowlistService.checkRecipientAllowed(params.customerPhone);
    if (!recipientCheck.allowed) {
      return {
        success: false,
        simulated: sendMode === 'DRY_RUN',
        status: 'SKIPPED',
        error: recipientCheck.reason,
        failureCategory: 'RECIPIENT_NOT_ALLOWED',
        payload: buildPayload(recipientCheck.canonicalNumber || normalizedCustomer)
      };
    }

    // ---- 3. Sender authorization (QR-connected instance must be open) ----
    const auth = await whatsAppAllowlistService.authorizeSender();

    const payload = buildPayload(recipientCheck.canonicalNumber!);

    // ---- 4a. DRY_RUN: validate + record simulated delivery, zero sends ----
    if (sendMode === 'DRY_RUN') {
      if (!auth.authorized) {
        return {
          success: false,
          simulated: true,
          status: 'FAILED',
          error: auth.reason || 'WhatsApp sender account is not connected.',
          failureCategory: auth.failureCategory,
          payload
        };
      }
      return {
        success: true,
        simulated: true,
        status: 'SIMULATED_DELIVERED',
        senderInstance: instanceName,
        providerMessageId: `dryrun_wa_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        payload
      };
    }

    // ---- 4b. LIVE: sender must be connected + explicit live configuration ----
    if (!auth.authorized) {
      return {
        success: false,
        simulated: false,
        status: 'FAILED',
        error: auth.reason || 'WhatsApp sender account is not connected.',
        failureCategory: auth.failureCategory,
        payload
      };
    }

    if (!this.isLiveSendEnabled()) {
      return {
        success: false,
        simulated: false,
        status: 'FAILED',
        error: 'Real WhatsApp sending requires WHATSAPP_SEND_MODE=LIVE and COMMUNICATION_MODE=PRODUCTION. Currently blocked (fail-closed).',
        failureCategory: 'PROVIDER_NOT_CONFIGURED',
        payload
      };
    }

    // ---- 5. Real send through the QR-connected sender instance ----
    try {
      // When the campaign generated a personalized promotional banner, the
      // SAME image the email embedded (served from /campaign-banners/) is
      // attached here with the offer text as caption — never a different one.
      const target = recipientCheck.canonicalNumber!.replace('+', '');
      let res = params.imageUrl
        ? await evolutionApiClient.sendImage(instanceName, target, params.imageUrl, params.text)
        : await evolutionApiClient.sendText(instanceName, target, params.text);

      if (!res.ok && params.imageUrl) {
        console.warn(`[WhatsAppService] sendImage failed (${res.error}), falling back to sendText...`);
        res = await evolutionApiClient.sendText(instanceName, target, params.text);
      }

      if (!res.ok) {
        return {
          success: false,
          simulated: false,
          status: 'FAILED',
          error: res.error || 'Evolution API send failed.',
          failureCategory: 'PROVIDER_ERROR',
          payload
        };
      }
      const providerMessageId =
        res.data?.key?.id ||
        res.data?.messageId ||
        `evo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      return {
        success: true,
        simulated: false,
        status: 'SENT',
        providerMessageId,
        senderInstance: instanceName,
        payload
      };
    } catch (err: any) {
      return {
        success: false,
        simulated: false,
        status: 'FAILED',
        error: err.message || 'Unexpected Evolution API error.',
        failureCategory: 'PROVIDER_ERROR',
        payload
      };
    }
  }

  /**
   * Channel-level delivery summary for a campaign from the audit table.
   */
  async getCampaignChannelStats(campaignId: string, merchantId: string): Promise<{
    EMAIL: Record<string, number>;
    WHATSAPP: Record<string, number>;
  }> {
    const res = await client.query(`
      SELECT channel, status, COUNT(*)::int AS count
      FROM merchant_campaign_messages
      WHERE campaign_id = $1 AND merchant_id = $2
      GROUP BY channel, status;
    `, [campaignId, merchantId]);

    const stats: { EMAIL: Record<string, number>; WHATSAPP: Record<string, number> } = {
      EMAIL: {},
      WHATSAPP: {}
    };
    for (const row of res.rows) {
      const channel = row.channel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL';
      stats[channel][row.status] = (stats[channel][row.status] || 0) + row.count;
    }
    return stats;
  }
}

export const whatsAppService = new WhatsAppService();
