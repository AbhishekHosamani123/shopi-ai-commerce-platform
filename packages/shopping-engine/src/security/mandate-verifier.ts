/**
 * AP2 Mandate Verifier — real JWK-based signature verification.
 *
 * v0.9 shipped `verifyMandateShape()` (structural check only). This module adds
 * the cryptographic half: ES256 (ECDSA P-256 / SHA-256) and EdDSA (Ed25519)
 * verification against a JWK, plus `verifyMandate()` which returns `ok` only when
 * **both** the shape and the signature check pass.
 *
 * Canonicalization (ADR 0010): a mandate is signed over its **canonical JSON** —
 * `canonicalizeMandate()` — which recursively sorts object keys and emits no
 * insignificant whitespace, so signer and verifier always agree on the byte
 * sequence regardless of property insertion order.
 *
 * Keys are resolved by `signed.keyId`. Pass `resolveKey` to wire this directly to
 * `UcpClient.getSigningKey(kid)`:
 *
 *   const res = await verifyMandate(signed, {
 *     resolveKey: (kid) => ucp.getSigningKey(kid),
 *   });
 */

import { createPublicKey, createPrivateKey, sign as nodeSign, verify as nodeVerify } from 'node:crypto';
import type { JsonWebKey } from 'node:crypto';
import { verifyMandateShape, canonicalizeMandate } from '../client/ap2-client.js';

/** A JWK as advertised in a UCP profile (`UcpClient.getSigningKey`) or supplied directly. */
export type MandateJwk = JsonWebKey & { kid?: string; alg?: string; crv?: string };

/** Resolve a verification key by its `kid`. Sync or async. */
export type JwkResolver = (
  kid: string
) => MandateJwk | undefined | Promise<MandateJwk | undefined>;

export interface VerifyMandateOptions {
  /** Explicit JWK to verify against (skips `resolveKey`). */
  jwk?: MandateJwk;
  /** Resolve the JWK from `signed.keyId` — e.g. `(kid) => ucp.getSigningKey(kid)`. */
  resolveKey?: JwkResolver;
  /** Override "now" (ms) for expiry checks — testing. */
  now?: number;
  /**
   * Accept the deterministic mock signer (algorithm `mock-sha256`) without a
   * cryptographic check. Default false — never silently trusts mock signatures.
   */
  allowMock?: boolean;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export type MandateAlgorithm = 'ES256' | 'EdDSA';

/** Map an AP2 algorithm tag to the Node verify parameters. */
const ALGORITHMS: Record<string, { hash: string | null; expectKty: string }> = {
  ES256: { hash: 'sha256', expectKty: 'EC' },
  EdDSA: { hash: null, expectKty: 'OKP' },
};

/**
 * Build a real signer from a private JWK, ready to pass as `Ap2ClientOptions.sign`
 * (with `keyId` + `algorithm`). Produces base64url signatures over the mandate's
 * canonical JSON. ES256 uses the ieee-p1363 (raw r‖s) encoding to match WebAuthn/
 * JWS and {@link verifyMandateSignature}.
 */
export function createJwkSigner(opts: {
  privateJwk: MandateJwk;
  algorithm: MandateAlgorithm;
  keyId: string;
}): { keyId: string; algorithm: MandateAlgorithm; sign: (payload: string) => Promise<string> } {
  const key = createPrivateKey({ key: opts.privateJwk as JsonWebKey, format: 'jwk' });
  const hash = ALGORITHMS[opts.algorithm].hash;
  return {
    keyId: opts.keyId,
    algorithm: opts.algorithm,
    sign: async (payload: string) => {
      const sig = nodeSign(
        hash,
        Buffer.from(payload, 'utf8'),
        { key, ...(opts.algorithm === 'ES256' ? { dsaEncoding: 'ieee-p1363' as const } : {}) }
      );
      return sig.toString('base64url');
    },
  };
}

function base64urlToBuffer(value: string): Buffer {
  // tolerate base64url and standard base64
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

/**
 * Verify the signature of a SignedMandate against a JWK. Does NOT perform the
 * structural / expiry checks — call {@link verifyMandate} for the combined gate.
 */
export async function verifyMandateSignature(
  signed: unknown,
  options: VerifyMandateOptions
): Promise<VerifyResult> {
  if (!signed || typeof signed !== 'object') {
    return { ok: false, reason: 'signed mandate is not an object' };
  }
  const s = signed as Record<string, unknown>;
  const algorithm = String(s.algorithm ?? '');
  const signature = s.signature;
  const keyId = typeof s.keyId === 'string' ? s.keyId : undefined;

  if (typeof signature !== 'string' || signature.length === 0) {
    return { ok: false, reason: 'missing signature' };
  }

  if (algorithm === 'mock-sha256') {
    return options.allowMock
      ? { ok: true }
      : { ok: false, reason: 'mock signature rejected (set allowMock to accept)' };
  }

  const algo = ALGORITHMS[algorithm];
  if (!algo) {
    return { ok: false, reason: `unsupported algorithm: ${algorithm || '(none)'}` };
  }

  // Resolve the verification key.
  let jwk = options.jwk;
  if (!jwk && options.resolveKey) {
    if (!keyId) return { ok: false, reason: 'missing keyId — cannot resolve key' };
    jwk = await options.resolveKey(keyId);
  }
  if (!jwk) {
    return { ok: false, reason: keyId ? `no key found for kid ${keyId}` : 'no verification key provided' };
  }
  if (jwk.kty !== algo.expectKty) {
    return { ok: false, reason: `key type ${jwk.kty} does not match algorithm ${algorithm}` };
  }

  let keyObject;
  try {
    keyObject = createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' });
  } catch (err) {
    return { ok: false, reason: `invalid JWK: ${(err as Error).message}` };
  }

  const data = Buffer.from(canonicalizeMandate(s.mandate), 'utf8');
  const sig = base64urlToBuffer(signature);

  let valid: boolean;
  try {
    // For EdDSA the digest algorithm is null; ECDSA uses sha256. Node accepts the
    // ieee-p1363 (raw r||s) DSA encoding which is what WebAuthn/JWS produce.
    valid = nodeVerify(
      algo.hash,
      data,
      { key: keyObject, ...(algorithm === 'ES256' ? { dsaEncoding: 'ieee-p1363' as const } : {}) },
      sig
    );
  } catch (err) {
    return { ok: false, reason: `verification error: ${(err as Error).message}` };
  }

  return valid ? { ok: true } : { ok: false, reason: 'signature does not verify' };
}

/**
 * Full mandate verification: structural sanity ({@link verifyMandateShape}) AND
 * cryptographic signature. Returns `{ ok: true }` only when both pass.
 */
export async function verifyMandate(
  signed: unknown,
  options: VerifyMandateOptions
): Promise<VerifyResult> {
  const shape = verifyMandateShape(signed, { now: options.now });
  if (!shape.ok) return shape;
  return verifyMandateSignature(signed, options);
}
