import { WhatsAppRecipientCheck, WhatsAppSenderConnectionState, WhatsAppSenderAuthorization } from './whatsapp-types';
import { evolutionApiClient } from './evolution-api-client';

/**
 * WhatsApp security service for the Buildathon demo.
 *
 * Two SEPARATE concepts, never to be confused:
 *
 * 1. SENDER — the single QR-connected WhatsApp account. Its Evolution instance
 *    (WHATSAPP_SENDER_INSTANCE, default "shopi-buildathon-whatsapp") must exist
 *    and be in state 'open' before any message may be dispatched. Whatever
 *    account the merchant scans becomes the sender.
 *
 * 2. RECIPIENTS — the ONLY numbers allowed to receive WhatsApp messages in this
 *    demo (WHATSAPP_ALLOWED_RECIPIENTS, default the two Buildathon test
 *    numbers). No other recipient is ever permitted, regardless of what the
 *    campaign audience contains. The backend refuses with
 *    "Recipient not in Buildathon WhatsApp allowlist."
 */
export class WhatsAppAllowlistService {
  /** Default Buildathon-approved recipient numbers. */
  private static readonly DEFAULT_ALLOWED_RECIPIENTS = '+918431406956,+916366475180';

  /** Neutral Evolution instance name for the QR-connected sender account. */
  getSenderInstanceName(): string {
    const name = (process.env.WHATSAPP_SENDER_INSTANCE || 'shopi-buildathon-whatsapp').trim();
    return name || 'shopi-buildathon-whatsapp';
  }

  /**
   * Normalizes any Indian/international phone representation to a canonical
   * E.164 identity. "+91 8431406956", "918431406956" and "8431406956" all
   * resolve to "+918431406956". Invalid input returns null.
   */
  normalizeNumber(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const cleaned = String(raw).trim();
    if (!cleaned) return null;
    const digits = cleaned.replace(/\D/g, '');
    if (!digits) return null;

    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
    return null;
  }

  private digitsIdentity(canonical: string): string {
    return canonical.replace(/\D/g, '');
  }

  /** Parses WHATSAPP_ALLOWED_RECIPIENTS into canonical approved recipients. */
  getAllowedRecipients(): string[] {
    const raw = process.env.WHATSAPP_ALLOWED_RECIPIENTS || WhatsAppAllowlistService.DEFAULT_ALLOWED_RECIPIENTS;
    const recipients: string[] = [];
    for (const entry of raw.split(',')) {
      const canonical = this.normalizeNumber(entry);
      if (canonical) recipients.push(canonical);
    }
    return recipients;
  }

  /**
   * HARD RECIPIENT ALLOWLIST. The only permitted WhatsApp recipients for this
   * Buildathon. Returns a refusal with a clear reason for any other number.
   */
  checkRecipientAllowed(rawNumber: string | null | undefined): WhatsAppRecipientCheck {
    const canonical = this.normalizeNumber(rawNumber);
    if (!canonical) {
      return {
        allowed: false,
        reason: 'Customer does not have a valid WhatsApp-capable phone number.'
      };
    }
    const digits = this.digitsIdentity(canonical);
    const approved = this.getAllowedRecipients().some(r => this.digitsIdentity(r) === digits);
    if (!approved) {
      return {
        allowed: false,
        canonicalNumber: canonical,
        reason: 'Recipient not in Buildathon WhatsApp allowlist.'
      };
    }
    return { allowed: true, canonicalNumber: canonical };
  }

  /** Convenience boolean form of the recipient check. */
  isRecipientAllowed(rawNumber: string | null | undefined): boolean {
    return this.checkRecipientAllowed(rawNumber).allowed;
  }

  /**
   * Full pre-send authorization of the SENDER (the QR-connected account):
   * 1. The configured Evolution instance must exist.
   * 2. The instance must report a live 'open' connection state.
   * Fails closed with a reason when any step does not pass.
   */
  async authorizeSender(): Promise<WhatsAppSenderAuthorization> {
    const instanceName = this.getSenderInstanceName();
    try {
      const instance = await evolutionApiClient.fetchInstanceByName(instanceName);
      if (!instance) {
        return {
          authorized: false,
          reason: `WhatsApp sender instance "${instanceName}" does not exist in Evolution API. Scan the QR code to connect the sender account.`,
          failureCategory: 'INSTANCE_NOT_FOUND'
        };
      }

      const state = await evolutionApiClient.getConnectionState(instanceName);
      if (state !== 'open') {
        return {
          authorized: false,
          reason: `WhatsApp sender account is not connected (Evolution state: ${state || 'unknown'}). Scan the QR code with the WhatsApp account to use as sender.`,
          failureCategory: 'INSTANCE_DISCONNECTED'
        };
      }

      return { authorized: true };
    } catch (err: any) {
      return {
        authorized: false,
        reason: `Evolution API is unreachable: ${err.message || 'unknown error'}`,
        failureCategory: 'PROVIDER_UNAVAILABLE'
      };
    }
  }

  /**
   * Connection state of the QR-connected sender instance (drives the status
   * panel). Status always comes from Evolution API; never mocked.
   */
  async getSenderConnectionState(): Promise<WhatsAppSenderConnectionState> {
    const instanceName = this.getSenderInstanceName();
    try {
      const instance = await evolutionApiClient.fetchInstanceByName(instanceName);
      if (!instance) {
        return { instanceName, state: 'unknown', isConnected: false, instanceExists: false };
      }
      const state = await evolutionApiClient.getConnectionState(instanceName);
      return {
        instanceName,
        state: state || 'unknown',
        isConnected: state === 'open',
        instanceExists: true
      };
    } catch {
      return { instanceName, state: 'unknown', isConnected: false, instanceExists: false };
    }
  }
}

export const whatsAppAllowlistService = new WhatsAppAllowlistService();
