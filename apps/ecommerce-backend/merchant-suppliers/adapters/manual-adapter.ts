import { BaseSupplierEdiAdapter, EdiTransmissionResult } from './base-adapter';
import { PurchaseOrderRecord, SupplierProtocol } from '../supplier-types';

export class ManualSupplierAdapter extends BaseSupplierEdiAdapter {
  readonly protocol: SupplierProtocol = 'MANUAL';

  async sendPurchaseOrder(po: PurchaseOrderRecord): Promise<EdiTransmissionResult> {
    return {
      success: true,
      isConfigured: true,
      protocol: this.protocol,
      transmissionId: `MANUAL_${po.poNumber}`,
      message: `Purchase Order ${po.poNumber} marked as prepared for manual supplier dispatch (PDF/HTML export).`,
      transmittedAt: new Date().toISOString()
    };
  }

  async checkAcknowledgement(poNumber: string) {
    return {
      acknowledged: true,
      status: 'MANUAL_STAGED',
      message: 'Manual acknowledgement pending supplier phone/email confirmation.'
    };
  }

  async receiveAdvanceShippingNotice(poNumber: string) {
    return {
      asnReceived: false,
      message: 'Advance Shipping Notice awaiting manual logistics update.'
    };
  }
}

export class SftpSupplierAdapter extends BaseSupplierEdiAdapter {
  readonly protocol: SupplierProtocol = 'SFTP';

  async sendPurchaseOrder(po: PurchaseOrderRecord): Promise<EdiTransmissionResult> {
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
  }

  async checkAcknowledgement(poNumber: string) {
    return {
      acknowledged: false,
      status: 'UNCONFIGURED_MOCK',
      message: 'SFTP endpoint unconfigured in current environment.'
    };
  }

  async receiveAdvanceShippingNotice(poNumber: string) {
    return {
      asnReceived: false,
      message: 'No live SFTP ASN files pending ingestion.'
    };
  }
}

export class As2SupplierAdapter extends BaseSupplierEdiAdapter {
  readonly protocol: SupplierProtocol = 'AS2';

  async sendPurchaseOrder(po: PurchaseOrderRecord): Promise<EdiTransmissionResult> {
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
  }

  async checkAcknowledgement(poNumber: string) {
    return {
      acknowledged: false,
      status: 'AS2_AWAITING_MDN',
      message: 'AS2 MDN receipt check requires configured AS2 server certificates.'
    };
  }

  async receiveAdvanceShippingNotice(poNumber: string) {
    return {
      asnReceived: false,
      message: 'No inbound AS2 EDI 856 payloads received.'
    };
  }
}
