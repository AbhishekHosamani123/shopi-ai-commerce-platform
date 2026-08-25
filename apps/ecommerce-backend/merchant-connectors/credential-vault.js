"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.credentialVault = exports.CredentialVault = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * 🔒 Phase 15D: Secure Credential Vault & Zero-Leak Secret Redaction Utility
 *
 * Implements AES-256-GCM authenticated encryption at rest for external merchant credentials,
 * and deterministic secret masking / scrubbing across logs, error messages, AI prompts, and API payloads.
 */
class CredentialVault {
    constructor() {
        const rawKey = process.env.JWT_ENCRYPTION_KEY || process.env.API_SECRET || 'razorpay_ai_commerce_master_secret_key_2026_32bytes!';
        // Derive a fixed 32-byte key using SHA-256
        this.masterKey = crypto_1.default.createHash('sha256').update(rawKey).digest();
    }
    /**
     * Encrypts plaintext credentials using AES-256-GCM with a random IV and auth tag.
     */
    encryptSecret(plainText) {
        if (!plainText)
            return '';
        const iv = crypto_1.default.randomBytes(12); // 96-bit IV for GCM
        const cipher = crypto_1.default.createCipheriv('aes-256-gcm', this.masterKey, iv);
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        // Format: iv:authTag:encrypted
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    }
    /**
     * Decrypts ciphertext credentials.
     */
    decryptSecret(cipherText) {
        if (!cipherText || !cipherText.includes(':'))
            return '';
        try {
            const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
            if (!ivHex || !authTagHex || !encryptedHex)
                return '';
            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', this.masterKey, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (err) {
            throw new Error(`Failed to decrypt credential: ${err.message}`);
        }
    }
    /**
     * Masks sensitive credentials for safe UI/API display (e.g. "••••••••1234").
     */
    maskSecret(secret) {
        if (!secret || typeof secret !== 'string')
            return '••••••••';
        if (secret.length <= 6)
            return '••••••';
        const last4 = secret.slice(-4);
        return `••••••••${last4}`;
    }
    /**
     * Recursively sanitizes any object or array, masking known secret keys.
     */
    redactObject(data) {
        if (data === null || data === undefined)
            return data;
        if (typeof data === 'string') {
            return this.scrubText(data);
        }
        if (Array.isArray(data)) {
            return data.map(item => this.redactObject(item));
        }
        if (typeof data === 'object') {
            const sensitiveKeys = [
                'apikey', 'api_key', 'apisecret', 'api_secret', 'accesstoken', 'access_token',
                'refreshtoken', 'refresh_token', 'password', 'pass', 'db_pass', 'secret',
                'jwt_secret', 'token', 'webhooksecret', 'webhook_secret', 'authorization',
                'encrypted_credentials', 'credentials'
            ];
            const cleanObj = {};
            for (const [k, v] of Object.entries(data)) {
                const lowerKey = k.toLowerCase().replace(/[-_]/g, '');
                const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk.replace(/[-_]/g, '')));
                if (isSensitive) {
                    if (typeof v === 'string') {
                        cleanObj[k] = this.maskSecret(v);
                    }
                    else if (typeof v === 'object' && v !== null) {
                        cleanObj[k] = this.redactObject(v);
                    }
                    else {
                        cleanObj[k] = '••••••••';
                    }
                }
                else {
                    cleanObj[k] = this.redactObject(v);
                }
            }
            return cleanObj;
        }
        return data;
    }
    /**
     * Scrubs raw string text to redact tokens matching common credential patterns.
     */
    scrubText(text) {
        if (!text || typeof text !== 'string')
            return text;
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
    sanitizeError(error) {
        const cleanMsg = this.scrubText((error === null || error === void 0 ? void 0 : error.message) || 'Unknown error');
        const cleanErr = new Error(cleanMsg);
        if (error === null || error === void 0 ? void 0 : error.stack) {
            cleanErr.stack = this.scrubText(error.stack);
        }
        return cleanErr;
    }
    /**
     * Safe prompt sanitizer ensuring LLM context never receives secrets.
     */
    scrubLlmPrompt(prompt) {
        return this.scrubText(prompt);
    }
}
exports.CredentialVault = CredentialVault;
exports.credentialVault = new CredentialVault();
