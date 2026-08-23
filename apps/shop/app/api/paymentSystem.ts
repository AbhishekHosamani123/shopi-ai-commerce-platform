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
    return { status: 500, error: 'Internal Server Error' };
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
    return { status: 500, error: 'Internal Server Error' };
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
    return { status: 500, error: 'Internal Server Error' };
  }
}

export async function paymentOnDeliveryHandler({
  userid,
  productid,
  colorid,
  sizeid
}: {
  userid: number;
  productid: string | string[];
  colorid: string | string[];
  sizeid: string | string[];
}) {
  try {
    const response = await backendClient.post(`/api/payment-on-delivery/create-order`, { userid, productid, colorid, sizeid });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
}

export async function cardCheckoutHandler({
  userid,
  productid,
  colorid,
  sizeid,
  paymentid,
  paymentStatus
}: {
  userid: number;
  productid: string | string[];
  colorid: string | string[];
  sizeid: string | string[];
  paymentid: string;
  paymentStatus: string;
}) {
  try {
    const response = await backendClient.post(`/api/card/create-order`, { userid, productid, colorid, sizeid, paymentid, paymentStatus });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
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
    return { status: 500, error: 'Internal Server Error' };
  }
}

export async function cartCardCheckoutHandler(userID: number, paymentid: string, paymentstatus: string) {
  try {
    const response = await backendClient.post(`/api/cart-card/create-order`, { userID, paymentid, paymentstatus });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
}

export async function cartCashCheckoutHandler(userID: number) {
  try {
    const response = await backendClient.post(`/api/cart-payment-on-delivery/create-order`, { userID });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
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
    return { status: 500, error: 'Internal Server Error' };
  }
}

// =============================================================================
// OFFICIAL RAZORPAY STANDARD CHECKOUT API HANDLERS
// =============================================================================

export async function createRazorpayOrderHandler({
  userid,
  productid,
  colorid,
  sizeid
}: {
  userid: number;
  productid: string | string[];
  colorid: string | string[];
  sizeid: string | string[];
}) {
  try {
    const response = await backendClient.post(`/api/razorpay/create-order`, {
      userid,
      productid,
      colorid,
      sizeid
    });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
}

export async function createRazorpayCartOrderHandler(userid: number) {
  try {
    const response = await backendClient.post(`/api/razorpay/create-cart-order`, { userid });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
}

export async function verifyRazorpayPaymentHandler({
  userid,
  productid,
  colorid,
  sizeid,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
}: {
  userid: number;
  productid: string | string[];
  colorid: string | string[];
  sizeid: string | string[];
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  try {
    const response = await backendClient.post(`/api/razorpay/verify-payment`, {
      userid,
      productid,
      colorid,
      sizeid,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
}

export async function verifyRazorpayCartPaymentHandler({
  userid,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature
}: {
  userid: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  try {
    const response = await backendClient.post(`/api/razorpay/verify-cart-payment`, {
      userid,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });
    return { status: response.status, data: response.data };
  } catch (error: any) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data };
    }
    return { status: 500, error: 'Internal Server Error' };
  }
}
