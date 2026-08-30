import { WhatsAppRecipientCheck } from './whatsapp-types';

/**
 * Customer WhatsApp number validation (recipient side only).
 *
 * Structural validation and Indian-number normalization. The Buildathon
 * recipient allowlist decision is owned by whatsAppAllowlistService; this
 * validator answers "is this a well-formed phone number" and normalizes it,
 * so the two checks compose: valid phone + allowlisted number.
 */
export class WhatsAppNumberValidatorService {
  /**
   * Normalizes a customer phone to E.164 digits (no leading '+').
   * Returns null for structurally invalid numbers.
   */
  normalizeCustomerNumber(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const cleaned = String(raw).trim();
    if (!cleaned) return null;
    const digits = cleaned.replace(/\D/g, '');
    if (!digits) return null;

    if (digits.length === 12 && digits.startsWith('91')) return digits;
    if (digits.length === 10) return `91${digits}`;
    if (digits.length >= 11 && digits.length <= 15) return digits;
    return null;
  }

  /** Structural validation independent of Evolution API availability. */
  isValidCustomerNumber(raw: string | null | undefined): boolean {
    return this.normalizeCustomerNumber(raw) !== null;
  }
}

export const whatsAppNumberValidatorService = new WhatsAppNumberValidatorService();
