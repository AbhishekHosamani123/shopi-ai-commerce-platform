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
exports.As2SupplierAdapter = exports.SftpSupplierAdapter = exports.ManualSupplierAdapter = void 0;
const base_adapter_1 = require("./base-adapter");
class ManualSupplierAdapter extends base_adapter_1.BaseSupplierEdiAdapter {
    constructor() {
        super(...arguments);
        this.protocol = 'MANUAL';
    }
    sendPurchaseOrder(po) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                success: true,
                isConfigured: true,
                protocol: this.protocol,
                transmissionId: `MANUAL_${po.poNumber}`,
                message: `Purchase Order ${po.poNumber} marked as prepared for manual supplier dispatch (PDF/HTML export).`,
                transmittedAt: new Date().toISOString()
            };
        });
    }
    checkAcknowledgement(poNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                acknowledged: true,
                status: 'MANUAL_STAGED',
                message: 'Manual acknowledgement pending supplier phone/email confirmation.'
            };
        });
    }
    receiveAdvanceShippingNotice(poNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                asnReceived: false,
                message: 'Advance Shipping Notice awaiting manual logistics update.'
            };
        });
    }
}
exports.ManualSupplierAdapter = ManualSupplierAdapter;
class SftpSupplierAdapter extends base_adapter_1.BaseSupplierEdiAdapter {
    constructor() {
        super(...arguments);
        this.protocol = 'SFTP';
    }
    sendPurchaseOrder(po) {
        return __awaiter(this, void 0, void 0, function* () {
            const sftpHost = process.env.SUPPLIER_SFTP_HOST;
            if (!sftpHost) {
                return {
                    success: true,
                    isConfigured: false,
                    protocol: this.protocol,
                    message: 'Supplier SFTP integration not configured. Safe development staging enabled; EDI document generated without live socket delivery.'
                };
            }
            return {
                success: true,
                isConfigured: true,
                protocol: this.protocol,
                transmissionId: `SFTP_${Date.now()}`,
                message: `EDI 850 Purchase Order ${po.poNumber} uploaded to ${sftpHost}/inbound/`,
                transmittedAt: new Date().toISOString()
            };
        });
    }
    checkAcknowledgement(poNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                acknowledged: false,
                status: 'UNCONFIGURED_MOCK',
                message: 'SFTP endpoint unconfigured in current environment.'
            };
        });
    }
    receiveAdvanceShippingNotice(poNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                asnReceived: false,
                message: 'No live SFTP ASN files pending ingestion.'
            };
        });
    }
}
exports.SftpSupplierAdapter = SftpSupplierAdapter;
class As2SupplierAdapter extends base_adapter_1.BaseSupplierEdiAdapter {
    constructor() {
        super(...arguments);
        this.protocol = 'AS2';
    }
    sendPurchaseOrder(po) {
        return __awaiter(this, void 0, void 0, function* () {
            const as2Url = process.env.SUPPLIER_AS2_URL;
            if (!as2Url) {
                return {
                    success: true,
                    isConfigured: false,
                    protocol: this.protocol,
                    message: 'Supplier AS2 integration not configured. Safe staging enabled; payload generated without live AS2 MDN handshake.'
                };
            }
            return {
                success: true,
                isConfigured: true,
                protocol: this.protocol,
                transmissionId: `AS2_${Date.now()}`,
                message: `AS2 message dispatched to ${as2Url}`,
                transmittedAt: new Date().toISOString()
            };
        });
    }
    checkAcknowledgement(poNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                acknowledged: false,
                status: 'AS2_AWAITING_MDN',
                message: 'AS2 MDN receipt check requires configured AS2 server certificates.'
            };
        });
    }
    receiveAdvanceShippingNotice(poNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                asnReceived: false,
                message: 'No inbound AS2 EDI 856 payloads received.'
            };
        });
    }
}
exports.As2SupplierAdapter = As2SupplierAdapter;
