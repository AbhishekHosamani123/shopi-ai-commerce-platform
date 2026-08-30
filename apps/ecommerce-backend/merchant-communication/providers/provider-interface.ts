import {
  OutboundMessagePayload,
  ProviderSendResult,
  MessageExecutionStatus,
  WebhookProcessingResult
} from '../communication-types';

export interface CommunicationProvider {
  readonly name: string;
  readonly channel: 'EMAIL' | 'WHATSAPP' | 'MULTI_CHANNEL';
  readonly isProductionReady: boolean;

  /**
   * Sends an outbound message payload or simulates delivery in dry-run mode.
   */
  send(message: OutboundMessagePayload): Promise<ProviderSendResult>;

  /**
   * Retrieves message delivery status from provider or internal ledger.
   */
  getStatus(providerMessageId: string): Promise<MessageExecutionStatus>;

  /**
   * Validates recipient address or phone format.
   */
  validateRecipient(recipient: string): boolean;

  /**
   * Processes inbound webhook event from external provider.
   */
  handleWebhook(event: any, signature?: string): Promise<WebhookProcessingResult>;
}
