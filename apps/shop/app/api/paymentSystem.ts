'use server';

import backendClient from '../../Helpers/backendClient';

export default async function paymentGatewayHandler(productID: string | string[], userID: number) {
  try {
    const response = await backendClient.post(`/api/create/payment/create-payment-intent`, { item: productID, userID });
    return { status: response.status, clientSecret: response.data.clientSecret };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}

export async function checkoutProductDataHandler({ productID, colorID, sizeID }: { productID: string; colorID: string; sizeID: string }) {
  try {
    const response = await backendClient.get(`/api/checkout/product-details/${productID}/${sizeID}/${colorID}`);
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}

export async function orderStatusDataHandler({ orderID }: { orderID: string | string[] }) {
  try {
    const response = await backendClient.get(`/api/orders/status/${orderID}`);
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}

export async function paymentOnDeliveryHandler({
  userid,
  productid,
  colorid,
  sizeid,
  customerInfo,
  addressInfo
}: {
  userid?: number;
  productid: string | string[];
  colorid: string | string[];
  sizeid: string | string[];
  customerInfo?: any;
  addressInfo?: any;
}) {
  try {
    const response = await backendClient.post(`/api/payment-on-delivery/create-order`, {
      userid,
      productid,
      colorid,
      sizeid,
      customerInfo,
      addressInfo
    });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}

export async function cardCheckoutHandler({
  userid,
  productid,
  colorid,
  sizeid,
  paymentid,
  paymentStatus,
  customerInfo,
  addressInfo
}: {
  userid?: number;
  productid: string | string[];
  colorid: string | string[];
  sizeid: string | string[];
  paymentid?: string;
  paymentStatus?: string;
  customerInfo?: any;
  addressInfo?: any;
}) {
  try {
    const response = await backendClient.post(`/api/card/create-order`, {
      userid,
      productid,
      colorid,
      sizeid,
      paymentid,
      paymentStatus,
      customerInfo,
      addressInfo
    });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}

export async function checkoutCartProductDataHandler(userID: number) {
  try {
    const response = await backendClient.get(`/api/checkout-cart/product-details/${userID}`);
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}

export async function cartCardCheckoutHandler(
  payload: number | { userID?: number; paymentid?: string; paymentstatus?: string; customerInfo?: any; addressInfo?: any; items?: any[] },
  paymentidArg?: string,
  paymentstatusArg?: string
) {
  try {
    const body = typeof payload === 'object'
      ? payload
      : { userID: payload, paymentid: paymentidArg, paymentstatus: paymentstatusArg };
    const response = await backendClient.post(`/api/cart-card/create-order`, body);
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}

export async function cartCashCheckoutHandler(
  payload: number | { userID?: number; customerInfo?: any; addressInfo?: any; items?: any[] }
) {
  try {
    const body = typeof payload === 'object' ? payload : { userID: payload };
    const response = await backendClient.post(`/api/cart-payment-on-delivery/create-order`, body);
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}

export async function paymentGatewayCartHandler(userID: number) {
  try {
    const response = await backendClient.post(`/api/create/cart-payment/create-payment-intent`, { userID });
    return { status: response.status, clientSecret: response.data.clientSecret };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}

// =============================================================================
// OFFICIAL RAZORPAY STANDARD CHECKOUT API HANDLERS
// =============================================================================

export async function createRazorpayOrderHandler({
  userid,
  productid,
  colorid,
  sizeid,
  customerInfo,
  addressInfo
}: {
  userid?: number;
  productid: string | string[];
  colorid: string | string[];
  sizeid: string | string[];
  customerInfo?: any;
  addressInfo?: any;
}) {
  try {
    const response = await backendClient.post(`/api/razorpay/create-order`, {
      userid,
      productid,
      colorid,
      sizeid,
      customerInfo,
      addressInfo
    });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}

export async function createRazorpayCartOrderHandler(
  payload: number | { userid?: number; customerInfo?: any; addressInfo?: any; items?: any[] }
) {
  try {
    const body = typeof payload === 'object' ? payload : { userid: payload };
    const response = await backendClient.post(`/api/razorpay/create-cart-order`, body);
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}

export async function verifyRazorpayPaymentHandler({
  userid,
  productid,
  colorid,
  sizeid,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  customerInfo,
  addressInfo
}: {
  userid?: number;
  productid: string | string[];
  colorid: string | string[];
  sizeid: string | string[];
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  customerInfo?: any;
  addressInfo?: any;
}) {
  try {
    const response = await backendClient.post(`/api/razorpay/verify-payment`, {
      userid,
      productid,
      colorid,
      sizeid,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customerInfo,
      addressInfo
    });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}

export async function verifyRazorpayCartPaymentHandler({
  userid,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  customerInfo,
  addressInfo,
  items
}: {
  userid?: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  customerInfo?: any;
  addressInfo?: any;
  items?: any[];
}) {
  try {
    const response = await backendClient.post(`/api/razorpay/verify-cart-payment`, {
      userid,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customerInfo,
      addressInfo,
      items
    });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, data: { error: error.message || 'Internal Server Error' } };
  }
}
