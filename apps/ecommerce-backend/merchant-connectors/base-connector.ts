import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  MerchantConnector,
  ConnectorProviderType,
  ConnectorConfig,
  ConnectionResult,
  TestConnectionResult,
  PaginationParams,
  PaginatedResult,
  ExternalProduct,
  ExternalCustomer,
  ExternalOrder,
  ExternalOrderItem,
  ExternalInventory,
  ExternalReturn,
  ExternalPayment,
  SyncReceipt
} from './connector-types';
import { credentialVault } from './credential-vault';
import { client } from '../data/DB';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

/**
 * 🏛️ Base Merchant Connector with production-grade HTTP client,
 * rate limit handling (429 Retry-After), exponential backoff, jitter, and credential redaction.
 */
export abstract class BaseMerchantConnector implements MerchantConnector {
  abstract readonly provider: ConnectorProviderType;
  protected httpClient: AxiosInstance;
  protected config?: ConnectorConfig;

  constructor(config?: ConnectorConfig) {
    this.config = config;
    this.httpClient = axios.create({
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
        } else if (this.config.authType === 'API_KEY_SECRET' && this.config.credentials.apiKey) {
          reqConfig.headers['X-API-KEY'] = this.config.credentials.apiKey;
          if (this.config.credentials.apiSecret) {
            reqConfig.headers['X-API-SECRET'] = this.config.credentials.apiSecret;
          }
        } else if (this.config.authType === 'BASIC_AUTH' && this.config.credentials.username) {
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
  protected async requestWithRetry<T = any>(
    requestConfig: AxiosRequestConfig,
    options: RetryOptions = {}
  ): Promise<AxiosResponse<T>> {
    const maxRetries = options.maxRetries ?? 4;
    const initialDelayMs = options.initialDelayMs ?? 500;
    const maxDelayMs = options.maxDelayMs ?? 10000;
    const backoffMultiplier = options.backoffMultiplier ?? 2;

    let attempt = 0;
    let delayMs = initialDelayMs;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const response = await this.httpClient.request<T>(requestConfig);
        return response;
      } catch (err: any) {
        const status = err.response?.status;
        const isLastAttempt = attempt > maxRetries;

        // Fatal non-retryable errors (401 Unauthorized, 403 Forbidden)
        if (status === 401 || status === 403) {
          throw new Error(`Authentication Failed (${status}): Invalid or expired connector credentials.`);
        }

        // 404 Not Found is non-retryable
        if (status === 404) {
          throw credentialVault.sanitizeError(err);
        }

        // Retryable conditions: 429 (Rate Limit), 408 (Timeout), 500, 502, 503, 504, Network Error
        const isRetryable = !status || [408, 429, 500, 502, 503, 504].includes(status);

        if (!isRetryable || isLastAttempt) {
          throw credentialVault.sanitizeError(err);
        }

        // Check for Retry-After header
        let waitTime = delayMs;
        const retryAfter = err.response?.headers?.['retry-after'];
        if (retryAfter) {
          const parsedSeconds = parseInt(retryAfter, 10);
          if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
            waitTime = parsedSeconds * 1000;
          }
        } else {
          // Add jitter: ±20%
          const jitter = 0.8 + Math.random() * 0.4;
          waitTime = Math.min(delayMs * jitter, maxDelayMs);
          delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
        }

        console.warn(`[Connector ${this.provider}] Attempt ${attempt} failed (${status || err.code}). Retrying in ${Math.round(waitTime)}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw new Error(`Exceeded maximum retries (${maxRetries}) for ${requestConfig.url}`);
  }

  /**
   * Connect and save encrypted credentials
   */
  async connect(config: ConnectorConfig): Promise<ConnectionResult> {
    this.config = config;
    const testResult = await this.testConnection(config);
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
    const encryptedCredentials = credentialVault.encryptSecret(JSON.stringify(config.credentials));

    await client.query(`
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
  }

  /**
   * Disconnects connector without deleting historical synced merchant data
   */
  async disconnect(merchantId: string): Promise<boolean> {
    const res = await client.query(`
      UPDATE merchant_connectors
      SET status = 'DISCONNECTED', updated_at = CURRENT_TIMESTAMP
      WHERE merchant_id = $1 AND provider = $2;
    `, [merchantId, this.provider]);

    return (res.rowCount || 0) > 0;
  }

  /**
   * Retrieves last completed sync receipt
   */
  async getLastSync(merchantId: string): Promise<SyncReceipt | null> {
    const res = await client.query(`
      SELECT * FROM merchant_sync_state
      WHERE merchant_id = $1 AND connector_type = $2
      ORDER BY last_sync_started_at DESC LIMIT 1;
    `, [merchantId, this.provider]);

    if (res.rows.length === 0) return null;
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
      errors: (row.error_details || []).map((e: any) => e.error || String(e))
    };
  }

  // Abstract methods required by MerchantConnector
  abstract testConnection(config?: ConnectorConfig): Promise<TestConnectionResult>;
  abstract getProducts(params: PaginationParams): Promise<PaginatedResult<ExternalProduct>>;
  abstract getCustomers(params: PaginationParams): Promise<PaginatedResult<ExternalCustomer>>;
  abstract getOrders(params: PaginationParams): Promise<PaginatedResult<ExternalOrder>>;
  abstract getOrderItems(orderId: string): Promise<ExternalOrderItem[]>;
  abstract getInventory(params: PaginationParams): Promise<PaginatedResult<ExternalInventory>>;
  abstract getReturns(params: PaginationParams): Promise<PaginatedResult<ExternalReturn>>;
  abstract getPayments(params: PaginationParams): Promise<PaginatedResult<ExternalPayment>>;
  abstract syncIncremental(merchantId: string, since: Date): Promise<SyncReceipt>;
}
