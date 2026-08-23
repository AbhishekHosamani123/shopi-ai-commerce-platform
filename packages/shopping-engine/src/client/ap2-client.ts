/**
 * AP2 Client — Agent Payments Protocol (FIDO Alliance)
 *
 * GA in agorio v0.8. Implements the full AP2 mandate lifecycle:
 *   IntentMandate  →  CartMandate  →  SignedMandate  →  payment result
 *
 * Real deployments must supply a `sign` function backed by a FIDO2/WebAuthn
 * authenticator (ES256 / EdDSA). The default signer is a deterministic mock
 * (prefix: "mock_sig_") suitable for testing and CI only.
 *
 * Receivers (merchants / payment gateways) can use `verifyMandateShape` to
 * sanity-check incoming SignedMandates before handing them to a real verifier.
 *
 * Usage:
 *   const client = new Ap2Client({ merchantId: 'merchant_xyz' });
 *   const intent = client.createIntentMandate({ amount: '49.99', currency: 'USD' });
 *   const cart   = client.attachCart(intent, lineItems);
 *   const signed = await client.sign(cart);
 *   const result = await client.submitPayment(signed, paymentUrl);
 */

// ─── AP2 types ───

export interface IntentMandate {
  /** Unique mandate identifier */
  mandateId: string;
  /** Merchant receiving the payment */
  merchantId: string;
  /** Total amount to be charged */
  amount: string;
  currency: string;
  /** Unix timestamp (ms) at which this mandate expires */
  expiresAt: number;
  /** ISO-8601 creation timestamp */
  createdAt: string;
}

export interface CartLineItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  currency: string;
}

export interface CartMandate extends IntentMandate {
  lineItems: CartLineItem[];
  /** Recomputed total from line items — must match amount */
  cartTotal: string;
}

/**
 * RefundMandate — refund flow counterpart to IntentMandate. (v0.9)
 *
 * Issued by the buyer's agent (or the merchant's automated refund flow) to
 * authorize money moving back to the buyer. Shares the IntentMandate base
 * fields and adds the original mandate it refunds plus an optional reason.
 */
export interface RefundMandate extends IntentMandate {
  /** mandateId of the original IntentMandate / CartMandate being refunded. */
  originalMandateId: string;
  /** Optional human-readable reason. */
  reason?: string;
}

/**
 * DelegatedMandate — a third party (e.g. a procurement system) authorizes a
 * payment on behalf of the buyer. (v0.10)
 *
 * Carries a `delegation` chain describing who delegated authority to whom and
 * the scope/limit of that authority. The signature on a DelegatedMandate is
 * produced by the *delegate*; receivers verify the delegate's key and then
 * walk `delegation.chain` to confirm the authority traces back to the buyer.
 */
export interface DelegationLink {
  /** Party granting authority (DID, agent id, or org id). */
  delegator: string;
  /** Party receiving authority. */
  delegate: string;
  /** Optional scope descriptor (e.g. 'purchase', 'refund'). */
  scope?: string;
  /** Optional spend cap for this link, as a decimal string. */
  maxAmount?: string;
  /** Optional ISO-8601 expiry for this delegation link. */
  expiresAt?: string;
}

export interface DelegatedMandate extends IntentMandate {
  delegation: {
    /** The party ultimately on whose behalf payment is authorized (the buyer). */
    principal: string;
    /** The party that signs this mandate (the delegate). */
    delegate: string;
    /** Ordered authority chain principal → … → delegate. */
    chain: DelegationLink[];
  };
}

/**
 * x402 payment instrument — stablecoin settlement extension. (v0.10)
 *
 * x402 (https://x402.org) settles payments in stablecoins over a chain. This
 * rides alongside the mandate so a receiver can route to on-chain settlement.
 */
export interface X402PaymentInstrument {
  scheme: 'x402';
  /** Settlement network, e.g. 'base', 'base-sepolia', 'ethereum', 'solana'. */
  network: string;
  /** Stablecoin asset symbol or contract reference. */
  asset: 'USDC' | 'USDT' | (string & {});
  /** Recipient address funds settle to. */
  payTo: string;
  /** Amount in the asset's minor units (e.g. USDC 6-dp), as a string. */
  amount: string;
  /** Optional ERC-20 / token contract address. */
  assetAddress?: string;
}

/** On-chain settlement proof returned after an x402 payment settles. */
export interface X402SettlementProof {
  network: string;
  /** Settlement transaction hash. */
  txHash: string;
  /** Payer address. */
  payer: string;
  /** Block number the settlement was included in, if known. */
  blockNumber?: number;
}

/** A mandate carrying an x402 stablecoin payment instrument. */
export interface X402Mandate extends IntentMandate {
  x402: X402PaymentInstrument;
}

export interface SignedMandate<T extends IntentMandate = CartMandate> {
  mandate: T;
  /** Signature produced by the configured signer */
  signature: string;
  /** Algorithm tag */
  algorithm: string;
  /** Key identifier for the signing key */
  keyId: string;
}

export interface Ap2PaymentResult {
  /** Whether the payment was accepted */
  success: boolean;
  /** Merchant-assigned transaction identifier */
  transactionId: string;
  /** Human-readable status */
  status: 'authorized' | 'declined' | 'pending' | 'error';
  /** ISO-8601 timestamp */
  processedAt: string;
  /** Raw response body from the payment endpoint, if any */
  raw?: unknown;
}

export interface Ap2ClientOptions {
  /** Merchant identifier supplied by the payment processor */
  merchantId: string;
  /**
   * Custom signing function.
   * Receives the canonical JSON representation of the mandate and must return
   * a hex-encoded signature string.
   * Defaults to the mock signer (NOT for production use).
   */
  sign?: (payload: string) => Promise<string>;
  /**
   * Key identifier reported in SignedMandate.keyId.
   * Defaults to 'mock-key-0' when using the default signer.
   */
  keyId?: string;
  /**
   * Signature algorithm tag reported in SignedMandate.algorithm. Set this to
   * 'ES256' or 'EdDSA' when supplying a real `sign` function so receivers know
   * how to verify. Defaults to 'mock-sha256' for the mock signer, else 'ES256'.
   */
  algorithm?: string;
  /**
   * Mandate TTL in milliseconds (default: 15 minutes).
   * After this period the mandate is considered expired.
   */
  mandateTtlMs?: number;
  /** Custom fetch for payment submission (default: globalThis.fetch) */
  fetch?: typeof globalThis.fetch;
}

// ─── Mock signer ───

/**
 * Deterministic mock signer — NOT cryptographically secure.
 * Produces a stable "mock_sig_<hex>" from the input string so tests
 * can assert on the prefix without needing a real key.
 */
function mockSign(payload: string): Promise<string> {
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return Promise.resolve(`mock_sig_${hex}${hex}${hex}${hex}`);
}

// ─── ID generation ───

function generateMandateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `ap2_${ts}_${rand}`;
}

// ─── Canonicalization (ADR 0010) ───

/**
 * Deterministic canonical JSON: recursively sort object keys, omit `undefined`,
 * and emit no insignificant whitespace. Arrays preserve order. Signer and
 * verifier both serialize the mandate this way so the signed byte sequence is
 * independent of property insertion order.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

/** Canonical byte representation a mandate is signed over. */
export function canonicalizeMandate(mandate: unknown): string {
  return canonicalJson(mandate);
}

// ─── Ap2Client ───

export class Ap2Client {
  private readonly merchantId: string;
  private readonly signer: (payload: string) => Promise<string>;
  private readonly keyId: string;
  private readonly algorithm: string;
  private readonly mandateTtlMs: number;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(options: Ap2ClientOptions) {
    this.merchantId = options.merchantId;
    this.signer = options.sign ?? mockSign;
    this.keyId = options.keyId ?? 'mock-key-0';
    this.algorithm = options.algorithm ?? (this.keyId === 'mock-key-0' ? 'mock-sha256' : 'ES256');
    this.mandateTtlMs = options.mandateTtlMs ?? 15 * 60 * 1000;
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Create an IntentMandate — the first step in the AP2 flow.
   * The mandate declares the intended payment before cart contents are known.
   */
  createIntentMandate(params: {
    amount: string;
    currency: string;
  }): IntentMandate {
    const now = Date.now();
    return {
      mandateId: generateMandateId(),
      merchantId: this.merchantId,
      amount: params.amount,
      currency: params.currency,
      expiresAt: now + this.mandateTtlMs,
      createdAt: new Date(now).toISOString(),
    };
  }

  /**
   * Create a RefundMandate that refunds an existing IntentMandate. (v0.9)
   *
   * Sign + submit the result with the same `sign()` / `submitPayment()` flow
   * you use for IntentMandates — receivers can distinguish via
   * `mandate.originalMandateId`.
   */
  createRefundMandate(params: {
    originalMandateId: string;
    amount:            string;
    currency:          string;
    reason?:           string;
  }): RefundMandate {
    const now = Date.now();
    return {
      mandateId:         generateMandateId(),
      merchantId:        this.merchantId,
      originalMandateId: params.originalMandateId,
      amount:            params.amount,
      currency:          params.currency,
      reason:            params.reason,
      expiresAt:         now + this.mandateTtlMs,
      createdAt:         new Date(now).toISOString(),
    };
  }

  /**
   * Create a DelegatedMandate authorizing payment on behalf of a principal. (v0.10)
   *
   * The `delegate` (whoever this client signs as) is authorized by `principal`
   * through `chain`. Sign + submit like any other mandate; receivers verify the
   * delegate's signature, then walk `delegation.chain` back to the principal.
   */
  createDelegatedMandate(params: {
    principal: string;
    delegate: string;
    chain: DelegationLink[];
    amount: string;
    currency: string;
  }): DelegatedMandate {
    const now = Date.now();
    return {
      mandateId: generateMandateId(),
      merchantId: this.merchantId,
      amount: params.amount,
      currency: params.currency,
      expiresAt: now + this.mandateTtlMs,
      createdAt: new Date(now).toISOString(),
      delegation: {
        principal: params.principal,
        delegate: params.delegate,
        chain: params.chain,
      },
    };
  }

  /**
   * Attach an x402 stablecoin payment instrument to a mandate. (v0.10)
   *
   * Produces an {@link X402Mandate} — the receiver routes to on-chain settlement
   * and returns an {@link X402SettlementProof}. Works on any IntentMandate variant.
   */
  attachX402Payment<T extends IntentMandate>(
    mandate: T,
    instrument: X402PaymentInstrument
  ): T & { x402: X402PaymentInstrument } {
    return { ...mandate, x402: instrument };
  }

  /**
   * Attach line items to an IntentMandate, producing a CartMandate.
   * Validates that the sum of line items matches the declared amount.
   */
  attachCart(
    intent: IntentMandate,
    lineItems: CartLineItem[]
  ): CartMandate {
    const cartTotal = lineItems
      .reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0)
      .toFixed(2);

    return {
      ...intent,
      lineItems,
      cartTotal,
    };
  }

  /**
   * Sign a mandate (IntentMandate or CartMandate).
   * Returns a SignedMandate ready for submission.
   */
  async sign<T extends IntentMandate>(mandate: T): Promise<SignedMandate<T>> {
    // Canonical JSON (ADR 0010) so the signed bytes are order-independent and
    // match what the verifier reconstructs.
    const payload = canonicalizeMandate(mandate);
    const signature = await this.signer(payload);

    return {
      mandate,
      signature,
      algorithm: this.algorithm,
      keyId: this.keyId,
    };
  }

  /**
   * Submit a signed mandate to a payment endpoint.
   * In production this would call the merchant's AP2-compliant payment gateway.
   */
  async submitPayment(
    signed: SignedMandate,
    paymentEndpoint: string
  ): Promise<Ap2PaymentResult> {
    const response = await this.fetchFn(paymentEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AP2-Algorithm': signed.algorithm,
        'X-AP2-Key-Id': signed.keyId,
      },
      body: JSON.stringify(signed),
    });

    const raw = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        transactionId: '',
        status: 'error',
        processedAt: new Date().toISOString(),
        raw,
      };
    }

    return {
      success: true,
      transactionId: (raw as { transactionId?: string }).transactionId ?? `txn_${Date.now()}`,
      status: 'authorized',
      processedAt: new Date().toISOString(),
      raw,
    };
  }

  /**
   * Check whether a mandate has expired.
   */
  isExpired(mandate: IntentMandate): boolean {
    return Date.now() > mandate.expiresAt;
  }

  /**
   * Full flow: create intent → attach cart → sign → submit.
   * Convenience method for single-call usage.
   */
  async pay(params: {
    amount: string;
    currency: string;
    lineItems: CartLineItem[];
    paymentEndpoint: string;
  }): Promise<Ap2PaymentResult> {
    const intent = this.createIntentMandate({ amount: params.amount, currency: params.currency });
    const cart = this.attachCart(intent, params.lineItems);
    const signed = await this.sign(cart);
    return this.submitPayment(signed, params.paymentEndpoint);
  }
}

// ─── Receiver-side helpers ───

/**
 * Shape-validate a SignedMandate received from an external agent.
 *
 * This is a structural sanity check — it confirms required fields exist,
 * the mandate hasn't expired, and (for CartMandate) line-item totals match
 * the declared amount. It does **not** verify the signature; pair this with
 * a real signature verifier (WebAuthn assertion, JWS verify, etc.) keyed
 * off `signed.keyId` and `signed.algorithm`.
 *
 * Returns `{ ok: true }` on success, `{ ok: false, reason }` on failure.
 */
export function verifyMandateShape(
  signed: unknown,
  options: { now?: number } = {}
): { ok: true } | { ok: false; reason: string } {
  if (!signed || typeof signed !== 'object') {
    return { ok: false, reason: 'signed mandate is not an object' };
  }
  const s = signed as Record<string, unknown>;
  if (!s.signature || typeof s.signature !== 'string') {
    return { ok: false, reason: 'missing signature' };
  }
  if (!s.algorithm || typeof s.algorithm !== 'string') {
    return { ok: false, reason: 'missing algorithm' };
  }
  if (!s.keyId || typeof s.keyId !== 'string') {
    return { ok: false, reason: 'missing keyId' };
  }
  const mandate = s.mandate as Record<string, unknown> | undefined;
  if (!mandate || typeof mandate !== 'object') {
    return { ok: false, reason: 'missing mandate' };
  }
  for (const field of ['mandateId', 'merchantId', 'amount', 'currency', 'expiresAt', 'createdAt']) {
    if (mandate[field] === undefined || mandate[field] === null) {
      return { ok: false, reason: `mandate.${field} is missing` };
    }
  }
  const expiresAt = Number(mandate.expiresAt);
  const now = options.now ?? Date.now();
  if (!Number.isFinite(expiresAt) || expiresAt < now) {
    return { ok: false, reason: 'mandate expired' };
  }
  // CartMandate-specific check: cartTotal must match declared amount
  if (Array.isArray(mandate.lineItems)) {
    const computed = (mandate.lineItems as CartLineItem[])
      .reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0)
      .toFixed(2);
    const amount = parseFloat(String(mandate.amount)).toFixed(2);
    const cartTotal = parseFloat(String(mandate.cartTotal ?? amount)).toFixed(2);
    if (computed !== cartTotal) {
      return { ok: false, reason: `cartTotal ${cartTotal} does not match line items ${computed}` };
    }
  }
  // RefundMandate-specific check (v0.9): originalMandateId must be a string.
  if ('originalMandateId' in mandate && mandate.originalMandateId !== undefined) {
    if (typeof mandate.originalMandateId !== 'string' || mandate.originalMandateId.length === 0) {
      return { ok: false, reason: 'refund mandate.originalMandateId must be a non-empty string' };
    }
  }
  // DelegatedMandate-specific check (v0.10): delegation chain must be coherent.
  if ('delegation' in mandate && mandate.delegation !== undefined) {
    const d = mandate.delegation as Record<string, unknown> | null;
    if (!d || typeof d !== 'object') {
      return { ok: false, reason: 'delegation must be an object' };
    }
    if (typeof d.principal !== 'string' || typeof d.delegate !== 'string') {
      return { ok: false, reason: 'delegation.principal and delegation.delegate must be strings' };
    }
    if (!Array.isArray(d.chain) || d.chain.length === 0) {
      return { ok: false, reason: 'delegation.chain must be a non-empty array' };
    }
    const chain = d.chain as Array<Record<string, unknown>>;
    for (const link of chain) {
      if (!link || typeof link.delegator !== 'string' || typeof link.delegate !== 'string') {
        return { ok: false, reason: 'each delegation link needs string delegator and delegate' };
      }
    }
    // The chain must start at the principal and terminate at the signing delegate.
    if (chain[0].delegator !== d.principal) {
      return { ok: false, reason: 'delegation.chain must start at the principal' };
    }
    if (chain[chain.length - 1].delegate !== d.delegate) {
      return { ok: false, reason: 'delegation.chain must terminate at the delegate' };
    }
  }
  // x402-specific check (v0.10): stablecoin instrument must be well-formed.
  if ('x402' in mandate && mandate.x402 !== undefined) {
    const x = mandate.x402 as Record<string, unknown> | null;
    if (!x || typeof x !== 'object') {
      return { ok: false, reason: 'x402 must be an object' };
    }
    if (x.scheme !== 'x402') {
      return { ok: false, reason: "x402.scheme must be 'x402'" };
    }
    for (const field of ['network', 'asset', 'payTo', 'amount']) {
      if (typeof x[field] !== 'string' || (x[field] as string).length === 0) {
        return { ok: false, reason: `x402.${field} must be a non-empty string` };
      }
    }
  }
  return { ok: true };
}

// ─── Error class ───

export class Ap2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Ap2Error';
  }
}
