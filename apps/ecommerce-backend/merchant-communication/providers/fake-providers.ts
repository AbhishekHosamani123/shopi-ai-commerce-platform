import { CommunicationProvider } from './provider-interface';
import {
  OutboundMessagePayload,
  ProviderSendResult,
  MessageExecutionStatus,
  WebhookProcessingResult,
  FailureCategory
} from '../communication-types';

export interface FakeProviderOptions {
  behavior?: 'SUCCESS' | 'FAILURE' | 'RATE_LIMIT' | 'INVALID_RECIPIENT' | 'TIMEOUT';
  customErrorMessage?: string;
  delayMs?: number;
}

export class FakeEmailProvider implements CommunicationProvider {
  readonly name = 'FAKE_EMAIL_TEST';
  readonly channel = 'EMAIL';
  readonly isProductionReady = false;
  private options: FakeProviderOptions;
  public sentMessages: OutboundMessagePayload[] = [];

  constructor(options: FakeProviderOptions = { behavior: 'SUCCESS' }) {
    this.options = options;
  }

  setBehavior(behavior: FakeProviderOptions['behavior'], customErrorMessage?: string) {
    this.options.behavior = behavior;
    if (customErrorMessage) this.options.customErrorMessage = customErrorMessage;
  }

  async send(message: OutboundMessagePayload): Promise<ProviderSendResult> {
    const timestamp = new Date().toISOString();
    this.sentMessages.push(message);

    if (!this.validateRecipient(message.recipient)) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: `Invalid email address syntax: "${message.recipient}"`,
        failureCategory: 'INVALID_RECIPIENT'
      };
    }

    if (this.options.behavior === 'RATE_LIMIT') {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: this.options.customErrorMessage || 'Rate limit exceeded: 429 Too Many Requests',
        failureCategory: 'RATE_LIMITED'
      };
    }

    if (this.options.behavior === 'INVALID_RECIPIENT') {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: this.options.customErrorMessage || 'Invalid email address syntax',
        failureCategory: 'INVALID_RECIPIENT'
      };
    }

    if (this.options.behavior === 'TIMEOUT') {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: this.options.customErrorMessage || 'Connection timeout to SMTP gateway',
        failureCategory: 'PROVIDER_ERROR'
      };
    }

    if (this.options.behavior === 'FAILURE') {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: this.options.customErrorMessage || 'Simulated fatal provider failure',
        failureCategory: 'PROVIDER_ERROR'
      };
    }

    // Default SUCCESS
    return {
      success: true,
      provider: this.name,
      providerMessageId: `fake_email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'SENT',
      timestamp
    };
  }

  async getStatus(providerMessageId: string): Promise<MessageExecutionStatus> {
    return 'DELIVERED';
  }

  validateRecipient(recipient: string): boolean {
    if (!recipient) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim());
  }

  async handleWebhook(event: any): Promise<WebhookProcessingResult> {
    return {
      success: true,
      messageId: event?.messageId,
      newStatus: event?.status || 'DELIVERED',
      eventType: event?.type || 'EMAIL_DELIVERED',
      timestamp: new Date().toISOString()
    };
  }
}

export class FakeWhatsAppProvider implements CommunicationProvider {
  readonly name = 'FAKE_WHATSAPP_TEST';
  readonly channel = 'WHATSAPP';
  readonly isProductionReady = false;
  private options: FakeProviderOptions;
  public sentMessages: OutboundMessagePayload[] = [];

  constructor(options: FakeProviderOptions = { behavior: 'SUCCESS' }) {
    this.options = options;
  }

  setBehavior(behavior: FakeProviderOptions['behavior'], customErrorMessage?: string) {
    this.options.behavior = behavior;
    if (customErrorMessage) this.options.customErrorMessage = customErrorMessage;
  }

  async send(message: OutboundMessagePayload): Promise<ProviderSendResult> {
    const timestamp = new Date().toISOString();
    this.sentMessages.push(message);

    if (this.options.behavior === 'RATE_LIMIT') {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: 'WhatsApp Business API throughput limit reached',
        failureCategory: 'RATE_LIMITED'
      };
    }

    if (this.options.behavior === 'INVALID_RECIPIENT') {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: 'Invalid phone number format for WhatsApp destination',
        failureCategory: 'INVALID_RECIPIENT'
      };
    }

    if (this.options.behavior === 'FAILURE') {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        timestamp,
        error: this.options.customErrorMessage || 'Template submission rejected by WhatsApp server',
        failureCategory: 'PROVIDER_ERROR'
      };
    }

    return {
      success: true,
      provider: this.name,
      providerMessageId: `fake_wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'SENT',
      timestamp
    };
  }

  async getStatus(providerMessageId: string): Promise<MessageExecutionStatus> {
    return 'DELIVERED';
  }

  validateRecipient(recipient: string): boolean {
    if (!recipient) return false;
    const digits = recipient.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }

  async handleWebhook(event: any): Promise<WebhookProcessingResult> {
    return {
      success: true,
      messageId: event?.messageId,
      newStatus: 'DELIVERED',
      eventType: 'WHATSAPP_DELIVERED',
      timestamp: new Date().toISOString()
    };
  }
}
