import {
  MerchantConnector,
  ConnectorProviderType,
  ConnectorConfig
} from './connector-types';
import { LocalTestConnector } from './local-test-connector';
import { ShopifyConnector } from './shopify-connector';
import { WooCommerceConnector } from './woocommerce-connector';
import { RazorpayPaymentsConnector } from './razorpay-connector';
import { credentialVault } from './credential-vault';
import { client } from '../data/DB';

/**
 * 🏭 Merchant Connector Factory & Registry
 */
export class ConnectorRegistry {
  private activeConnectors: Map<string, MerchantConnector> = new Map();

  /**
   * Instantiates a connector for the given provider
   */
  createConnector(config: ConnectorConfig): MerchantConnector {
    switch (config.provider) {
      case 'LOCAL_CONNECTOR_TEST':
        return new LocalTestConnector(config);
      case 'SHOPIFY':
        return new ShopifyConnector(config);
      case 'WOOCOMMERCE':
        return new WooCommerceConnector(config);
      case 'RAZORPAY_DIRECT':
        return new RazorpayPaymentsConnector(config);
      default:
        return new LocalTestConnector(config);
    }
  }

  /**
   * Retrieves or creates a connector from memory map
   */
  getOrCreateConnector(config: ConnectorConfig): MerchantConnector {
    const key = `${config.merchantId}:${config.provider}`;
    if (this.activeConnectors.has(key)) {
      return this.activeConnectors.get(key)!;
    }
    const connector = this.createConnector(config);
    this.activeConnectors.set(key, connector);
    return connector;
  }

  /**
   * Retrieves or loads an active connector for a merchant from DB
   */
  async getConnectorForMerchant(merchantId: string, provider?: ConnectorProviderType): Promise<MerchantConnector | null> {
    const key = `${merchantId}:${provider || 'PRIMARY'}`;
    if (this.activeConnectors.has(key)) {
      return this.activeConnectors.get(key)!;
    }

    const query = provider
      ? `SELECT * FROM merchant_connectors WHERE merchant_id = $1 AND provider = $2 LIMIT 1`
      : `SELECT * FROM merchant_connectors WHERE merchant_id = $1 AND status = 'CONNECTED' ORDER BY updated_at DESC LIMIT 1`;
    const params = provider ? [merchantId, provider] : [merchantId];

    const res = await client.query(query, params);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    let credentials: any = {};
    try {
      credentials = JSON.parse(credentialVault.decryptSecret(row.encrypted_credentials));
    } catch {
      credentials = {};
    }

    const config: ConnectorConfig = {
      connectorId: row.connector_id,
      merchantId: row.merchant_id,
      provider: row.provider,
      storeIdentifier: row.store_identifier,
      authType: row.auth_type,
      endpointUrl: row.endpoint_url,
      credentials,
      autoSyncEnabled: row.auto_sync_enabled,
      syncFrequencyMinutes: row.sync_frequency_minutes
    };

    const connector = this.createConnector(config);
    this.activeConnectors.set(key, connector);
    return connector;
  }

  /**
   * Clears cached connector instance (e.g. on disconnect or credential change)
   */
  evict(merchantId: string, provider?: ConnectorProviderType) {
    if (provider) {
      this.activeConnectors.delete(`${merchantId}:${provider}`);
    } else {
      for (const k of Array.from(this.activeConnectors.keys())) {
        if (k.startsWith(`${merchantId}:`)) {
          this.activeConnectors.delete(k);
        }
      }
    }
  }
}

export const connectorRegistry = new ConnectorRegistry();
