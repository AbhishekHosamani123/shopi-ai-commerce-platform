import { CommunicationProvider } from './provider-interface';
import {
  OutboundMessagePayload,
  ProviderSendResult,
  MessageExecutionStatus,
  WebhookProcessingResult
} from '../communication-types';

export class DryRunCommunicationProvider implements CommunicationProvider {
  readonly name = 'DRY_RUN';
  readonly channel = 'MULTI_CHANNEL';
  readonly isProductionReady = false;

  async send(message: OutboundMessagePayload): Promise<ProviderSendResult> {
    const timestamp = new Date().toISOString();

    // 1. Validate recipient presence and basic structure
    if (!message.recipient || message.recipient.trim().length === 0) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: 'Recipient address or phone number is missing',
        failureCategory: 'INVALID_RECIPIENT',
        isSimulated: true
      };
    }

    if (!this.validateRecipient(message.recipient)) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: `Invalid recipient format: "${message.recipient}"`,
        failureCategory: 'INVALID_RECIPIENT',
        isSimulated: true
      };
    }

    // 2. Validate message content presence
    if (message.channel === 'EMAIL' && (!message.subject || !message.textBody)) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: 'Email subject and body are required',
        failureCategory: 'VALIDATION_ERROR',
        isSimulated: true
      };
    }

    if (message.channel === 'WHATSAPP' && !message.whatsAppMessage) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: 'WhatsApp message text is required',
        failureCategory: 'VALIDATION_ERROR',
        isSimulated: true
      };
    }

    // 3. Return deterministic simulated success record (Zero external traffic)
    const simulatedProviderMessageId = `dryrun_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      success: true,
      provider: this.name,
      providerMessageId: simulatedProviderMessageId,
      status: 'SIMULATED',
      timestamp,
      isSimulated: true
    };
  }

  async getStatus(providerMessageId: string): Promise<MessageExecutionStatus> {
    return 'SIMULATED';
  }

  validateRecipient(recipient: string): boolean {
    if (!recipient) return false;
    const clean = recipient.trim();
    // Email regex check
    if (clean.includes('@')) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
    }
    // Phone regex check (E.164 or digits)
    const digitsOnly = clean.replace(/\D/g, '');
    return digitsOnly.length >= 10 && digitsOnly.length <= 15;
  }

  async handleWebhook(event: any): Promise<WebhookProcessingResult> {
    return {
      success: true,
      eventType: 'SIMULATED_WEBHOOK',
      timestamp: new Date().toISOString()
    };
  }
}
