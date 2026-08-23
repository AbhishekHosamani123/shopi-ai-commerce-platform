/**
 * @storefront/shopping-engine
 *
 * Razorpay AI Commerce Autonomous Shopping Engine & Agent Framework
 *
 * @example
 * ```typescript
 * import { ShoppingAgent } from '@storefront/shopping-engine';
 * ```
 */

// Core clients
export { UcpClient, UcpDiscoveryError, UcpApiError } from './client/ucp-client.js';
export { AcpClient, AcpApiError } from './client/acp-client.js';
export {
  AcpSignatureError,
  verifyMerchantSignature,
  signOrderEventPayload,
  buildMerchantSignatureHeader,
  parseOrderEvent,
  receiveOrderEvent,
  getRefundStatus,
  getFulfillmentStatus,
  summarizeOrder,
} from './client/acp-order-events.js';
export { McpClient, McpError, MCP_PROTOCOL_VERSION } from './client/mcp-client.js';
export type {
  McpClientInfo,
  McpServerInfo,
  McpServerCapabilities,
  McpInitializeResult,
  McpToolDescriptor,
  McpToolListResult,
  McpContentBlock,
  McpToolCallResult,
  McpResource,
  McpResourceListResult,
  McpResourceReadResult,
  McpPrompt,
  McpPromptArgument,
  McpPromptListResult,
  McpPromptMessage,
  McpPromptGetResult,
} from './client/mcp-client.js';
export {
  Ap2Client,
  Ap2Error,
  verifyMandateShape,
  canonicalJson,
  canonicalizeMandate,
} from './client/ap2-client.js';
export type {
  Ap2ClientOptions,
  IntentMandate,
  CartMandate,
  CartLineItem,
  RefundMandate,
  SignedMandate,
  Ap2PaymentResult,
  DelegatedMandate,
  DelegationLink,
  X402PaymentInstrument,
  X402SettlementProof,
  X402Mandate,
} from './client/ap2-client.js';
// AP2 mandate verifier (v0.10) — real ES256/EdDSA verification + JWK signer
export {
  verifyMandate,
  verifyMandateSignature,
  createJwkSigner,
} from './security/mandate-verifier.js';
export type {
  VerifyMandateOptions,
  VerifyResult as MandateVerifyResult,
  MandateJwk,
  MandateAlgorithm,
  JwkResolver,
} from './security/mandate-verifier.js';

// Agent
export { ShoppingAgent } from './agent/shopping-agent.js';
export { runSubAgent, DEFAULT_SUB_AGENT_MAX_DEPTH } from './agent/sub-agent.js';
export type { RunSubAgentOptions } from './agent/sub-agent.js';
export { AgentChain } from './agent/agent-chain.js';
export type { AgentChainRunOptions } from './agent/agent-chain.js';

// Merchant adapters
export { ShopifyAdapter, ShopifyAdapterError } from './adapters/shopify.js';
export type { ShopifyAdapterOptions } from './adapters/shopify.js';

export { WooCommerceAdapter, WooCommerceAdapterError, isWooCommerceStore } from './adapters/woocommerce.js';
export type { WooCommerceAdapterOptions } from './adapters/woocommerce.js';

export { BigCommerceAdapter, BigCommerceAdapterError, isBigCommerceStore } from './adapters/bigcommerce.js';
export type { BigCommerceAdapterOptions } from './adapters/bigcommerce.js';

// Webhook
export { WebhookServer } from './webhook/webhook-server.js';

// Agent identity attestation (v0.8)
export {
  AgentAttestation,
  parseAttestation,
  verifyAttestation,
} from './security/agent-attestation.js';
export type {
  AttestationOptions,
  SignRequestInput,
  ParsedAttestation,
  VerifyOptions,
  VerifyResult,
} from './security/agent-attestation.js';

// Persistent sessions
export { MemorySessionStorage } from './session/memory-storage.js';
export { FileSessionStorage } from './session/file-storage.js';
export type { FileSessionStorageOptions } from './session/file-storage.js';

// HTTP primitives (retry + rate-limit) — compose into adapter `fetch:` options
export { createHttpClient, withRetry, withRateLimit, TokenBucket } from './http/index.js';
export type {
  HttpClientOptions,
  RetryOptions,
  TokenBucketOptions,
  BucketFactory,
  RateLimitBucketContext,
} from './http/index.js';

// Agorio Cloud client helper
export { agorioCloud } from './cloud/index.js';
export type {
  AgorioCloudOptions,
  AgorioCloudHandle,
} from './cloud/index.js';
export type {
  SpanRecord,
  LogRecord,
  IngestBatch,
  IngestBatchType,
  RunStartPayload,
  RunEndPayload,
} from './cloud/types.js';

// Enterprise plugin utilities
export { isEnterprisePlugin } from './types/index.js';

// Tools
export { SHOPPING_AGENT_TOOLS } from './llm/tools.js';

// Mock servers
export { MockMerchant } from './mock/mock-merchant.js';
export { MockAcpMerchant } from './mock/mock-acp-merchant.js';
export { MockMcpMerchant } from './mock/mock-mcp-merchant.js';
export { DEFAULT_PRODUCTS, buildMockProfile } from './mock/fixtures.js';

// Types
export type {
  // UCP types
  UcpProfile,
  UcpService,
  UcpCapability,
  RestTransport,
  McpTransport,
  A2aTransport,
  PaymentHandler,
  JwkKey,

  // MCP types
  McpClientOptions,
  MockMcpMerchantOptions,
  TransportPreference,

  // ACP types
  AcpClientOptions,
  AcpCheckoutSession,
  AcpCheckoutStatus,
  AcpLineItem,
  AcpMoney,
  AcpShippingAddress,
  MockAcpMerchantOptions,
  // ACP order model (2026-04-17 — orders/refunds/fulfillment via webhook, ADR 0009)
  AcpAddress,
  AcpOrder,
  AcpOrderStatus,
  AcpOrderLineItem,
  AcpOrderLineItemQuantity,
  AcpLineItemReference,
  AcpTotal,
  AcpFulfillment,
  AcpFulfillmentEvent,
  AcpEstimatedDelivery,
  AcpAdjustment,
  AcpOrderConfirmation,
  AcpSupportInfo,
  AcpOrderEvent,
  AcpErrorBody,

  // Client types
  UcpClientOptions,
  DiscoveryResult,
  NormalizedService,

  // LLM types
  LlmAdapter,
  ChatMessage,
  ToolDefinition,
  ToolCall,
  LlmResponse,
  LlmStreamChunk,

  // Agent types
  AgentOptions,
  AgentPlugin,
  SubAgent,
  SubAgentBuildContext,
  AgentChainStep,
  ChainContext,
  ChainResultEntry,
  SessionState,
  SessionStorage,
  EnterprisePlugin,
  PluginManifest,
  PluginContext,
  PluginToolDecision,
  AgentStep,
  AgentStreamEvent,
  AgentResult,
  CheckoutResult,
  AgentToolName,

  // Adapter types
  MerchantAdapter,
  MerchantAdapterDiscovery,
  MerchantContext,

  // Review types
  ProductReview,
  ProductReviewResult,

  // Webhook types
  WebhookServerOptions,
  WebhookEvent,
  OrderUpdateEvent,

  // Observability types
  AgentLogEvent,
  AgentSpan,
  AgentTracer,
  AgentUsageSummary,

  // Shopping types
  CartItem,
  CartState,
  MoneyAmount,
  MockProduct,
  MockOrder,
  ShippingAddress,

  // Mock types
  MockMerchantOptions,
} from './types/index.js';
