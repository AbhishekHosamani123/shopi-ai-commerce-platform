"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMerchantConnector = void 0;
const axios_1 = __importDefault(require("axios"));
const credential_vault_1 = require("./credential-vault");
const DB_1 = require("../data/DB");
/**
 * 🏛️ Base Merchant Connector with production-grade HTTP client,
 * rate limit handling (429 Retry-After), exponential backoff, jitter, and credential redaction.
 */
class BaseMerchantConnector {
    constructor(config) {
        this.config = config;
        this.httpClient = axios_1.default.create({
            timeout: 15000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Razorpay-Merchant-AI-Connector/1.0'
            }
        });
        // Request interceptor to attach authentication
        this.httpClient.interceptors.request.use((reqConfig) => {
            if (this.config) {
                if (this.config.authType === 'BEARER_TOKEN' && this.config.credentials.accessToken) {
                    reqConfig.headers['Authorization'] = `Bearer ${this.config.credentials.accessToken}`;
                }
                else if (this.config.authType === 'API_KEY_SECRET' && this.config.credentials.apiKey) {
                    reqConfig.headers['X-API-KEY'] = this.config.credentials.apiKey;
                    if (this.config.credentials.apiSecret) {
                        reqConfig.headers['X-API-SECRET'] = this.config.credentials.apiSecret;
                    }
                }
                else if (this.config.authType === 'BASIC_AUTH' && this.config.credentials.username) {
                    const authStr = Buffer.from(`${this.config.credentials.username}:${this.config.credentials.password || ''}`).toString('base64');
                    reqConfig.headers['Authorization'] = `Basic ${authStr}`;
                }
            }
            return reqConfig;
        });
    }
    /**
     * Resilient HTTP Request wrapper with Exponential Backoff, Jitter, and 429 Rate Limiting
     */
    requestWithRetry(requestConfig_1) {
        return __awaiter(this, arguments, void 0, function* (requestConfig, options = {}) {
            var _a, _b, _c, _d, _e, _f, _g;
            const maxRetries = (_a = options.maxRetries) !== null && _a !== void 0 ? _a : 4;
            const initialDelayMs = (_b = options.initialDelayMs) !== null && _b !== void 0 ? _b : 500;
            const maxDelayMs = (_c = options.maxDelayMs) !== null && _c !== void 0 ? _c : 10000;
            const backoffMultiplier = (_d = options.backoffMultiplier) !== null && _d !== void 0 ? _d : 2;
            let attempt = 0;
            let delayMs = initialDelayMs;
            while (attempt <= maxRetries) {
                attempt++;
                try {
                    const response = yield this.httpClient.request(requestConfig);
                    return response;
                }
                catch (err) {
                    const status = (_e = err.response) === null || _e === void 0 ? void 0 : _e.status;
                    const isLastAttempt = attempt > maxRetries;
                    // Fatal non-retryable errors (401 Unauthorized, 403 Forbidden)
                    if (status === 401 || status === 403) {
                        throw new Error(`Authentication Failed (${status}): Invalid or expired connector credentials.`);
                    }
                    // 404 Not Found is non-retryable
                    if (status === 404) {
                        throw credential_vault_1.credentialVault.sanitizeError(err);
                    }
                    // Retryable conditions: 429 (Rate Limit), 408 (Timeout), 500, 502, 503, 504, Network Error
                    const isRetryable = !status || [408, 429, 500, 502, 503, 504].includes(status);
                    if (!isRetryable || isLastAttempt) {
                        throw credential_vault_1.credentialVault.sanitizeError(err);
                    }
                    // Check for Retry-After header
                    let waitTime = delayMs;
                    const retryAfter = (_g = (_f = err.response) === null || _f === void 0 ? void 0 : _f.headers) === null || _g === void 0 ? void 0 : _g['retry-after'];
                    if (retryAfter) {
                        const parsedSeconds = parseInt(retryAfter, 10);
                        if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
                            waitTime = parsedSeconds * 1000;
                        }
                    }
                    else {
                        // Add jitter: ±20%
                        const jitter = 0.8 + Math.random() * 0.4;
                        waitTime = Math.min(delayMs * jitter, maxDelayMs);
                        delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
                    }
                    console.warn(`[Connector ${this.provider}] Attempt ${attempt} failed (${status || err.code}). Retrying in ${Math.round(waitTime)}ms...`);
                    yield new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
            throw new Error(`Exceeded maximum retries (${maxRetries}) for ${requestConfig.url}`);
        });
    }
    /**
     * Connect and save encrypted credentials
     */
    connect(config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.config = config;
            const testResult = yield this.testConnection(config);
            if (!testResult.success) {
                return {
                    success: false,
                    connectorId: config.connectorId || `conn_${Date.now()}`,
                    merchantId: config.merchantId,
                    provider: this.provider,
                    storeIdentifier: config.storeIdentifier,
                    status: 'SYNC_FAILED',
                    message: testResult.message,
                    error: testResult.error
                };
            }
            const connectorId = config.connectorId || `conn_${this.provider.toLowerCase()}_${Date.now()}`;
            const encryptedCredentials = credential_vault_1.credentialVault.encryptSecret(JSON.stringify(config.credentials));
            yield DB_1.client.query(`
      INSERT INTO merchant_connectors (
        connector_id, merchant_id, provider, store_identifier, status, auth_type,
        encrypted_credentials, endpoint_url, updated_at
      ) VALUES ($1, $2, $3, $4, 'CONNECTED', $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (merchant_id, provider) DO UPDATE
      SET store_identifier = EXCLUDED.store_identifier,
          status = 'CONNECTED',
          auth_type = EXCLUDED.auth_type,
          encrypted_credentials = EXCLUDED.encrypted_credentials,
          endpoint_url = EXCLUDED.endpoint_url,
          last_error = NULL,
          updated_at = CURRENT_TIMESTAMP;
    `, [
                connectorId,
                config.merchantId,
                this.provider,
                config.storeIdentifier,
                config.authType,
                encryptedCredentials,
                config.endpointUrl || null
            ]);
            return {
                success: true,
                connectorId,
                merchantId: config.merchantId,
                provider: this.provider,
                storeIdentifier: config.storeIdentifier,
                status: 'CONNECTED',
                message: 'Successfully connected and verified merchant store.',
                connectedAt: new Date().toISOString()
            };
        });
    }
    /**
     * Disconnects connector without deleting historical synced merchant data
     */
    disconnect(merchantId) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield DB_1.client.query(`
      UPDATE merchant_connectors
      SET status = 'DISCONNECTED', updated_at = CURRENT_TIMESTAMP
      WHERE merchant_id = $1 AND provider = $2;
    `, [merchantId, this.provider]);
            return (res.rowCount || 0) > 0;
        });
    }
    /**
     * Retrieves last completed sync receipt
     */
    getLastSync(merchantId) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield DB_1.client.query(`
      SELECT * FROM merchant_sync_state
      WHERE merchant_id = $1 AND connector_type = $2
      ORDER BY last_sync_started_at DESC LIMIT 1;
    `, [merchantId, this.provider]);
            if (res.rows.length === 0)
                return null;
            const row = res.rows[0];
            const ageSeconds = row.last_sync_completed_at
                ? Math.max(0, Math.floor((Date.now() - new Date(row.last_sync_completed_at).getTime()) / 1000))
                : 86400;
            return {
                syncId: row.sync_id,
                merchantId: row.merchant_id,
                provider: this.provider,
                syncType: row.sync_type || 'INCREMENTAL',
                status: row.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
                startedAt: row.last_sync_started_at,
                completedAt: row.last_sync_completed_at,
                durationMs: row.last_sync_completed_at
                    ? new Date(row.last_sync_completed_at).getTime() - new Date(row.last_sync_started_at).getTime()
                    : 0,
                rowsProcessed: row.rows_processed || 0,
                rowsInserted: row.rows_inserted || 0,
                rowsUpdated: row.rows_updated || 0,
                rowsRejected: row.rows_rejected || 0,
                reconciliation: {
                    sourceOrdersCount: row.rows_processed || 0,
                    importedOrdersCount: (row.rows_inserted || 0) + (row.rows_updated || 0),
                    sourceRevenue: 0,
                    importedRevenue: 0,
                    revenueDelta: 0,
                    status: 'RECONCILED'
                },
                freshness: {
                    lastSyncTimestamp: row.last_sync_completed_at || row.last_sync_started_at,
                    dataAgeSeconds: ageSeconds,
                    historicalCoverageDays: 365,
                    healthStatus: ageSeconds < 3600 ? 'HEALTHY' : 'STALE'
                },
                checkpoints: [],
                errors: (row.error_details || []).map((e) => e.error || String(e))
            };
        });
    }
}
exports.BaseMerchantConnector = BaseMerchantConnector;
