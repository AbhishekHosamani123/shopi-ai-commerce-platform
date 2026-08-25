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
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectorRegistry = exports.ConnectorRegistry = void 0;
const local_test_connector_1 = require("./local-test-connector");
const shopify_connector_1 = require("./shopify-connector");
const woocommerce_connector_1 = require("./woocommerce-connector");
const razorpay_connector_1 = require("./razorpay-connector");
const credential_vault_1 = require("./credential-vault");
const DB_1 = require("../data/DB");
/**
 * 🏭 Merchant Connector Factory & Registry
 */
class ConnectorRegistry {
    constructor() {
        this.activeConnectors = new Map();
    }
    /**
     * Instantiates a connector for the given provider
     */
    createConnector(config) {
        switch (config.provider) {
            case 'LOCAL_CONNECTOR_TEST':
                return new local_test_connector_1.LocalTestConnector(config);
            case 'SHOPIFY':
                return new shopify_connector_1.ShopifyConnector(config);
            case 'WOOCOMMERCE':
                return new woocommerce_connector_1.WooCommerceConnector(config);
            case 'RAZORPAY_DIRECT':
                return new razorpay_connector_1.RazorpayPaymentsConnector(config);
            default:
                return new local_test_connector_1.LocalTestConnector(config);
        }
    }
    /**
     * Retrieves or creates a connector from memory map
     */
    getOrCreateConnector(config) {
        const key = `${config.merchantId}:${config.provider}`;
        if (this.activeConnectors.has(key)) {
            return this.activeConnectors.get(key);
        }
        const connector = this.createConnector(config);
        this.activeConnectors.set(key, connector);
        return connector;
    }
    /**
     * Retrieves or loads an active connector for a merchant from DB
     */
    getConnectorForMerchant(merchantId, provider) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = `${merchantId}:${provider || 'PRIMARY'}`;
            if (this.activeConnectors.has(key)) {
                return this.activeConnectors.get(key);
            }
            const query = provider
                ? `SELECT * FROM merchant_connectors WHERE merchant_id = $1 AND provider = $2 LIMIT 1`
                : `SELECT * FROM merchant_connectors WHERE merchant_id = $1 AND status = 'CONNECTED' ORDER BY updated_at DESC LIMIT 1`;
            const params = provider ? [merchantId, provider] : [merchantId];
            const res = yield DB_1.client.query(query, params);
            if (res.rows.length === 0)
                return null;
            const row = res.rows[0];
            let credentials = {};
            try {
                credentials = JSON.parse(credential_vault_1.credentialVault.decryptSecret(row.encrypted_credentials));
            }
            catch (_a) {
                credentials = {};
            }
            const config = {
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
        });
    }
    /**
     * Clears cached connector instance (e.g. on disconnect or credential change)
     */
    evict(merchantId, provider) {
        if (provider) {
            this.activeConnectors.delete(`${merchantId}:${provider}`);
        }
        else {
            for (const k of Array.from(this.activeConnectors.keys())) {
                if (k.startsWith(`${merchantId}:`)) {
                    this.activeConnectors.delete(k);
                }
            }
        }
    }
}
exports.ConnectorRegistry = ConnectorRegistry;
exports.connectorRegistry = new ConnectorRegistry();
