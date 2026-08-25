# 🛡️ Phase 15D & 15X: Zero-Leak Credential Vault & Security Architecture

## 1. Cryptographic Credential Vault (AES-256-GCM)

All external merchant platform API tokens, Shopify access tokens, WooCommerce keys, and webhook secrets are encrypted at rest using **AES-256-GCM** authenticated symmetric encryption.

- **Initialization Vector**: Cryptographically random 96-bit IV generated per encryption.
- **Authentication Tag**: 128-bit authentication tag ensuring ciphertext integrity.
- **Master Key**: SHA-256 derived 32-byte key from environment secret.

```
Stored Format: {12-byte IV Hex}:{16-byte AuthTag Hex}:{Ciphertext Hex}
```

---

## 2. Multi-Layer Credential Redaction

Credentials are cryptographically and heuristically scrubbed to prevent leaks across:

1. **LLM Prompts**: `scrubLlmPrompt()` strips tokens matching API key / secret patterns before prompts reach model context.
2. **Error Handlers & Stack Traces**: `sanitizeError()` replaces sensitive tokens with masked strings.
3. **Backend API Responses**: `redactObject()` automatically masks credentials (e.g. `••••••••1234`).
4. **Log Output**: Connection URLs containing database passwords (`postgres://user:••••••••@host:5432`) are sanitized.
5. **Frontend Local Storage**: Secret tokens are never transmitted to browser local storage.

---

## 3. Multi-Tenant Penetration & Isolation Checks

- **Row-Level Tenant Isolation**: All queries on `merchant_connectors`, `merchant_canonical_*`, `merchant_sync_checkpoints`, and `merchant_data_lineage` are filtered by `merchant_id`.
- **Cross-Tenant Query Block**: Verified via automated test that Tenant Beta querying Tenant Alpha records returns 0 results.
- **SQL & Formula Injection Resistance**: Neutralizes CSV formula triggers (`=cmd|'`) and parameterized SQL insertions.
