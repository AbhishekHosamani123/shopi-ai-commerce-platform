import crypto from 'crypto';

/**
 * 🔒 Phase 15D: Secure Credential Vault & Zero-Leak Secret Redaction Utility
 *
 * Implements AES-256-GCM authenticated encryption at rest for external merchant credentials,
 * and deterministic secret masking / scrubbing across logs, error messages, AI prompts, and API payloads.
 */
export class CredentialVault {
  private masterKey: Buffer;

  constructor() {
    const rawKey = process.env.JWT_ENCRYPTION_KEY || process.env.API_SECRET || 'razorpay_ai_commerce_master_secret_key_2026_32bytes!';
    // Derive a fixed 32-byte key using SHA-256
    this.masterKey = crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext credentials using AES-256-GCM with a random IV and auth tag.
   */
  encryptSecret(plainText: string): string {
    if (!plainText) return '';
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts ciphertext credentials.
   */
  decryptSecret(cipherText: string): string {
    if (!cipherText || !cipherText.includes(':')) return '';
    try {
      const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
      if (!ivHex || !authTagHex || !encryptedHex) return '';

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err: any) {
      throw new Error(`Failed to decrypt credential: ${err.message}`);
    }
  }

  /**
   * Masks sensitive credentials for safe UI/API display (e.g. "••••••••1234").
   */
  maskSecret(secret?: string): string {
    if (!secret || typeof secret !== 'string') return '••••••••';
    if (secret.length <= 6) return '••••••';
    const last4 = secret.slice(-4);
    return `••••••••${last4}`;
  }

  /**
   * Recursively sanitizes any object or array, masking known secret keys.
   */
  redactObject<T = any>(data: T): T {
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
      return this.scrubText(data) as any;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactObject(item)) as any;
    }

    if (typeof data === 'object') {
      const sensitiveKeys = [
        'apikey', 'api_key', 'apisecret', 'api_secret', 'accesstoken', 'access_token',
        'refreshtoken', 'refresh_token', 'password', 'pass', 'db_pass', 'secret',
        'jwt_secret', 'token', 'webhooksecret', 'webhook_secret', 'authorization',
        'encrypted_credentials', 'credentials'
      ];

      const cleanObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(data as Record<string, any>)) {
        const lowerKey = k.toLowerCase().replace(/[-_]/g, '');
        const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk.replace(/[-_]/g, '')));

        if (isSensitive) {
          if (typeof v === 'string') {
            cleanObj[k] = this.maskSecret(v);
          } else if (typeof v === 'object' && v !== null) {
            cleanObj[k] = this.redactObject(v);
          } else {
            cleanObj[k] = '••••••••';
          }
        } else {
          cleanObj[k] = this.redactObject(v);
        }
      }
      return cleanObj as any;
    }

    return data;
  }

  /**
   * Scrubs raw string text to redact tokens matching common credential patterns.
   */
  scrubText(text: string): string {
    if (!text || typeof text !== 'string') return text;

    // Redact Bearer tokens
    let scrubbed = text.replace(/Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, 'Bearer ••••••••');
    // Redact Basic auth
    scrubbed = scrubbed.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic ••••••••');
    // Redact generic API keys: shpat_..., rzp_test_..., sk_test_..., etc.
    scrubbed = scrubbed.replace(/(shpat|shpca|rzp_test|rzp_live|sk_test|sk_live|gsk)_[A-Za-z0-9_]{6,}/gi, '$1_••••••••REDACTED');
    // Redact password in connection strings
    scrubbed = scrubbed.replace(/(postgres|mysql|redis):\/\/[^:]+:([^@]+)@/gi, '$1://user:••••••••@');
    return scrubbed;
  }

  /**
   * Sanitizes an Error object so its stack trace and message never expose credentials.
   */
  sanitizeError(error: any): Error {
    const cleanMsg = this.scrubText(error?.message || 'Unknown error');
    const cleanErr = new Error(cleanMsg);
    if (error?.stack) {
      cleanErr.stack = this.scrubText(error.stack);
    }
    return cleanErr;
  }

  /**
   * Safe prompt sanitizer ensuring LLM context never receives secrets.
   */
  scrubLlmPrompt(prompt: string): string {
    return this.scrubText(prompt);
  }
}

export const credentialVault = new CredentialVault();
