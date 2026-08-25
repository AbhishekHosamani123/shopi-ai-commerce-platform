import { PurchaseOrderRecord, SupplierProtocol } from '../supplier-types';

export interface EdiTransmissionResult {
  success: boolean;
  isConfigured: boolean;
  protocol: SupplierProtocol;
  transmissionId?: string;
  message: string;
  transmittedAt?: string;
}

/**
 * Base Abstract Interface for Supplier B2B EDI Adapters
 */
export abstract class BaseSupplierEdiAdapter {
  abstract readonly protocol: SupplierProtocol;

  /**
   * Transmits purchase order to supplier endpoint.
   */
  abstract sendPurchaseOrder(po: PurchaseOrderRecord): Promise<EdiTransmissionResult>;

  /**
   * Checks for supplier 997 / 855 Functional Acknowledgement.
   */
  abstract checkAcknowledgement(poNumber: string): Promise<{
    acknowledged: boolean;
    status: string;
    message: string;
  }>;

  /**
   * Receives Advance Shipping Notice (EDI 856 ASN).
   */
  abstract receiveAdvanceShippingNotice(poNumber: string): Promise<{
    asnReceived: boolean;
    trackingNumber?: string;
    estimatedDelivery?: string;
    message: string;
  }>;
}
