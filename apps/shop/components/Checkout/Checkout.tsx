'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { checkoutProductDataHandler, paymentOnDeliveryHandler, createRazorpayOrderHandler, verifyRazorpayPaymentHandler } from '@/app/api/paymentSystem';
import Loading from '../Loading';
import useAuth from '@/controllers/Authentication';
import userData from '@/controllers/userData';
import { openRazorpayCheckout } from '@/Helpers/razorpay';

interface ProductDetails {
    title: string;
    price: string;
    discount: string;
    sizename: string | null;
    colorname: string | null;
    imglink: string;
    imgalt: string;
    shippingcost: number;
}

const emptyProductDetails: ProductDetails = {
    title: '',
    price: '',
    discount: '',
    sizename: null,
    colorname: null,
    imglink: '',
    imgalt: '',
    shippingcost: 99
};

const Checkout = () => {
    const [paymentCharge, setPaymentCharge] = useState(0);
    const params = useParams<{ productID: string; colorID: string; sizeID: string }>();
    const [loading, setloading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [onlinePayment, setonlinePayment] = useState(true);
    const router = useRouter();

    const [product, setProduct] = useState<ProductDetails>(emptyProductDetails);
    const data = product;

    // Delivery details form state (pre-filled with demo default address, fully editable)
    const [formData, setFormData] = useState({
        fullName: 'Abhishek Hosamani',
        email: 'abhishekhosamani79@gmail.com',
        phone: '8431406956',
        country: 'India',
        city: 'Bengaluru',
        state: 'Karnataka',
        addressLine1: '402 Palm Heights, 100ft Inner Ring Road',
        addressLine2: 'Koramangala 4th Block',
        postalCode: '560034'
    });

    const shipping = data.shippingcost || 99;
    const taxes = (parseFloat(data.price || '0') * (18 / 100));
    const subTotal = parseFloat(data.price || '0');
    const subTotalWithoutTax = (parseFloat(data.price || '0') - (parseFloat(data.price || '0') * 18 / 100));
    const discount = parseFloat(data.price || '0') - parseFloat(data.discount || '0');
    const totalAmount = (subTotal + shipping + paymentCharge) - discount > 0 ? (subTotal + shipping + paymentCharge) - discount : shipping;

    const formattedSubTotal = subTotalWithoutTax.toFixed(2);
    const formattedShipping = shipping.toFixed(2);
    const formattedTaxes = taxes.toFixed(2);
    const formattedDiscount = discount.toFixed(2);
    const formattedTotalAmount = totalAmount.toFixed(2);

    const { checkSession } = useAuth();
    const { grabUserData } = userData();

    async function sync() {
        setloading(true);
        if (params.productID && params.sizeID && params.colorID) {
            try {
                const response = await checkoutProductDataHandler({
                    productID: params.productID,
                    colorID: params.colorID,
                    sizeID: params.sizeID
                });
                if (response.status === 200 && response.data) {
                    setProduct(response.data);
                }
            } catch (err) {
                console.error('Failed to load product data:', err);
            }
        }

        try {
            const sessionCheck = await checkSession();
            if (sessionCheck?.success && sessionCheck?.data?.userID) {
                const userDataCheck = await grabUserData();
                let defaultAddr: any = null;
                if (userDataCheck?.addresses && userDataCheck.addresses.length > 0) {
                    defaultAddr = userDataCheck.addresses.find((a: any) => a.is_default) || userDataCheck.addresses[0];
                }

                setFormData(prev => ({
                    fullName: sessionCheck.data.userName || defaultAddr?.userName || prev.fullName,
                    email: sessionCheck.data.email || prev.email,
                    phone: String(sessionCheck.data.mobile_number || defaultAddr?.contactNumber || prev.phone),
                    country: defaultAddr?.country || prev.country || 'India',
                    city: defaultAddr?.city || prev.city,
                    state: defaultAddr?.state || prev.state,
                    addressLine1: defaultAddr?.addressLine1 || prev.addressLine1,
                    addressLine2: defaultAddr?.addressLine2 || prev.addressLine2,
                    postalCode: defaultAddr?.postalCode || prev.postalCode
                }));
            }
        } catch (e) {
            console.warn('Session check warning:', e);
        }

        setloading(false);
    }

    const validateForm = () => {
        if (!formData.fullName.trim()) {
            setErrorMessage('Please enter your full name');
            return false;
        }
        if (!formData.email.trim() || !/.+@.+\..+/.test(formData.email)) {
            setErrorMessage('Please enter a valid email address for order confirmation');
            return false;
        }
        if (!formData.phone.trim()) {
            setErrorMessage('Please enter your contact phone number');
            return false;
        }
        if (!formData.addressLine1.trim()) {
            setErrorMessage('Please enter your delivery street address');
            return false;
        }
        if (!formData.city.trim()) {
            setErrorMessage('Please enter your city');
            return false;
        }
        if (!formData.postalCode.trim()) {
            setErrorMessage('Please enter your postal/PIN code');
            return false;
        }
        return true;
    };

    const getCustomerPayload = () => ({
        customerInfo: {
            name: formData.fullName.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim()
        },
        addressInfo: {
            fullName: formData.fullName.trim(),
            phone: formData.phone.trim(),
            country: formData.country.trim() || 'India',
            city: formData.city.trim(),
            state: formData.state.trim() || 'Karnataka',
            addressLine1: formData.addressLine1.trim(),
            addressLine2: formData.addressLine2.trim(),
            postalCode: formData.postalCode.trim()
        }
    });

    async function handleRazorpayPayment() {
        if (!validateForm()) return;

        try {
            setPaying(true);
            setErrorMessage(null);

            const payload = getCustomerPayload();

            // 1. Create Razorpay order on server
            const orderRes = await createRazorpayOrderHandler({
                userid: 0,
                productid: params.productID,
                colorid: params.colorID,
                sizeid: params.sizeID,
                customerInfo: payload.customerInfo,
                addressInfo: payload.addressInfo
            });

            if (orderRes.status !== 200 || !orderRes.data?.razorpayOrderId) {
                setErrorMessage(orderRes.data?.error || 'Failed to initiate Razorpay order. Please try again.');
                setPaying(false);
                return;
            }

            const { razorpayOrderId, amount, key, currency } = orderRes.data;

            // 2. Open Razorpay Standard Checkout Modal
            await openRazorpayCheckout({
                key: key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_51MockRazorpayKeyId2026',
                amount: amount,
                currency: currency || 'INR',
                name: 'Shopi',
                description: `Purchase of ${data.title}`,
                order_id: razorpayOrderId,
                image: '/deliveryboxes.png',
                prefill: {
                    name: formData.fullName,
                    email: formData.email,
                    contact: formData.phone
                },
                theme: {
                    color: '#012652'
                },
                handler: async (response) => {
                    setPaying(true);
                    // 3. Verify Razorpay cryptographic signature on backend
                    const verifyRes = await verifyRazorpayPaymentHandler({
                        userid: 0,
                        productid: params.productID,
                        colorid: params.colorID,
                        sizeid: params.sizeID,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        customerInfo: payload.customerInfo,
                        addressInfo: payload.addressInfo
                    });

                    if (verifyRes.status === 200 && verifyRes.data?.orderid) {
                        router.push(`/order-confirmation/${verifyRes.data.orderid}?payment_id=${response.razorpay_payment_id}`);
                    } else {
                        setErrorMessage(verifyRes.data?.error || 'Payment signature verification failed. Please contact support.');
                        setPaying(false);
                    }
                },
                modal: {
                    ondismiss: () => {
                        setPaying(false);
                    }
                }
            });
        } catch (error: any) {
            console.error('Razorpay Checkout error:', error);
            setErrorMessage(error.message || 'Unable to open Razorpay checkout modal.');
            setPaying(false);
        }
    }

    async function createOrder(e: React.FormEvent) {
        e.preventDefault();
        if (onlinePayment) {
            await handleRazorpayPayment();
            return;
        }

        if (!validateForm()) return;

        setloading(true);
        setErrorMessage(null);

        const payload = getCustomerPayload();
        const createOrderRes = await paymentOnDeliveryHandler({
            userid: 0,
            productid: params.productID,
            colorid: params.colorID,
            sizeid: params.sizeID,
            customerInfo: payload.customerInfo,
            addressInfo: payload.addressInfo
        });

        if (createOrderRes.status === 200 && createOrderRes.data?.orderid) {
            setloading(false);
            router.push(`/order-confirmation/${createOrderRes.data.orderid}`);
        } else {
            setErrorMessage(createOrderRes.data?.error || 'Failed to place Cash on Delivery order. Please retry.');
            setloading(false);
        }
    }

    useEffect(() => {
        sync();
    }, [params.productID, params.colorID, params.sizeID]);

    return (
        <section className="bg-white py-8 min-h-screen w-screen overflow-x-hidden antialiased relative dark:bg-gray-900 md:py-6">
            {loading && (
                <div className="w-screen h-screen absolute inset-0 bg-white/70 z-50 flex items-center justify-center">
                    <Loading />
                </div>
            )}

            <div className="mx-auto max-w-screen-xl px-4 2xl:px-0">
                <ol className="items-center flex w-full max-w-2xl text-center text-sm font-medium text-gray-500 dark:text-gray-400 sm:text-base">
                    <li className="after:border-1 flex items-center text-primary-700 after:mx-6 after:hidden after:h-1 after:w-full after:border-b after:border-gray-200 dark:text-primary-500 dark:after:border-gray-700 sm:after:inline-block sm:after:content-[''] md:w-full xl:after:mx-10">
                        <span className="flex items-center after:mx-2 after:text-gray-200 after:content-['/'] dark:after:text-gray-500 sm:after:hidden">
                            <svg className="me-2 h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            Product
                        </span>
                    </li>

                    <li className="after:border-1 flex items-center text-primary-700 after:mx-6 after:hidden after:h-1 after:w-full after:border-b after:border-gray-200 dark:text-primary-500 dark:after:border-gray-700 sm:after:inline-block sm:after:content-[''] md:w-full xl:after:mx-10">
                        <span className="flex items-center after:mx-2 after:text-gray-200 after:content-['/'] dark:after:text-gray-500 sm:after:hidden">
                            <svg className="me-2 h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            Checkout
                        </span>
                    </li>

                    <li className="flex shrink-0 items-center">
                        <svg className="me-2 h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        Order summary
                    </li>
                </ol>

                {errorMessage && (
                    <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex justify-between items-center shadow-sm">
                        <span>{errorMessage}</span>
                        <button type="button" onClick={() => setErrorMessage(null)} className="text-sm font-semibold hover:underline">Dismiss</button>
                    </div>
                )}

                <div className="mt-6 sm:mt-8 lg:flex lg:items-start lg:gap-12 xl:gap-16">
                    <form id="informational-form" onSubmit={createOrder} className="min-w-0 flex-1 space-y-8">
                        <div className="space-y-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-200/80">
                            <div className="flex items-center justify-between border-b pb-3">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delivery Details</h2>
                                <span className="text-xs text-slate-500 font-medium bg-white px-2.5 py-1 rounded-full border border-slate-200">Express Guest Checkout</span>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="your_name" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"> Your Full Name* </label>
                                    <input
                                        value={formData.fullName}
                                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                        type="text"
                                        id="your_name"
                                        className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 shadow-sm"
                                        placeholder="Suresh Kumar"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="your_email" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"> Your Email (For Confirmation)* </label>
                                    <input
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        type="email"
                                        id="your_email"
                                        className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 shadow-sm"
                                        placeholder="suresh@gmail.com"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="phone-input-3" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"> Phone Number* </label>
                                    <div className="flex items-center">
                                        <span className="inline-flex shrink-0 items-center rounded-s-lg border border-gray-300 bg-gray-100 px-3.5 py-2.5 text-center text-sm font-medium text-gray-700">
                                            +91
                                        </span>
                                        <input
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            type="tel"
                                            id="phone-input"
                                            className="block w-full rounded-e-lg border border-s-0 border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 shadow-sm"
                                            placeholder="9876543210"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="pincode" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"> PIN Code* </label>
                                    <input
                                        value={formData.postalCode}
                                        onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                                        type="text"
                                        id="pincode"
                                        className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 shadow-sm"
                                        placeholder="560001"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="select-city-input-3" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"> City* </label>
                                    <input
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        type="text"
                                        placeholder="Bengaluru"
                                        id="select-city-input-3"
                                        className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 shadow-sm"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="select-state" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"> State </label>
                                    <input
                                        value={formData.state}
                                        onChange={e => setFormData({ ...formData, state: e.target.value })}
                                        type="text"
                                        placeholder="Karnataka"
                                        id="select-state"
                                        className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 shadow-sm"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label htmlFor="address1" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Address Line 1*</label>
                                    <input
                                        value={formData.addressLine1}
                                        onChange={e => setFormData({ ...formData, addressLine1: e.target.value })}
                                        type="text"
                                        id="address1"
                                        className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 shadow-sm"
                                        placeholder="Flat / House No., Street, Area"
                                        required
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label htmlFor="address2" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Address Line 2 (Optional)</label>
                                    <input
                                        value={formData.addressLine2}
                                        onChange={e => setFormData({ ...formData, addressLine2: e.target.value })}
                                        type="text"
                                        id="address2"
                                        className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 shadow-sm"
                                        placeholder="Landmark, Apartment Name"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Payment Method</h3>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div
                                    className={`rounded-xl border p-4 cursor-pointer transition-all shadow-sm ${onlinePayment ? 'border-primary-600 bg-primary-50/70 dark:bg-gray-800 ring-2 ring-primary-500' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}
                                    onClick={() => { setonlinePayment(true); setPaymentCharge(0); }}
                                >
                                    <div className="flex items-start">
                                        <div className="flex h-5 items-center">
                                            <input
                                                checked={onlinePayment}
                                                onChange={() => { setonlinePayment(true); setPaymentCharge(0); }}
                                                id="online-payment"
                                                type="radio"
                                                name="payment-method"
                                                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                                            />
                                        </div>
                                        <div className="ms-4 text-sm">
                                            <label htmlFor="online-payment" className="font-bold text-gray-900 dark:text-white cursor-pointer flex items-center gap-2">
                                                <span>Razorpay Standard Checkout</span>
                                                <span className="bg-primary-100 text-primary-800 text-xs px-2 py-0.5 rounded font-medium">Official</span>
                                            </label>
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Cards, UPI (GPay, PhonePe, Paytm), NetBanking & Wallets</p>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className={`rounded-xl border p-4 cursor-pointer transition-all shadow-sm ${!onlinePayment ? 'border-primary-600 bg-primary-50/70 dark:bg-gray-800 ring-2 ring-primary-500' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}
                                    onClick={() => { setonlinePayment(false); setPaymentCharge(15); }}
                                >
                                    <div className="flex items-start">
                                        <div className="flex h-5 items-center">
                                            <input
                                                checked={!onlinePayment}
                                                onChange={() => { setonlinePayment(false); setPaymentCharge(15); }}
                                                id="pay-on-delivery"
                                                type="radio"
                                                name="payment-method"
                                                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                                            />
                                        </div>
                                        <div className="ms-4 text-sm">
                                            <label htmlFor="pay-on-delivery" className="font-bold text-gray-900 dark:text-white cursor-pointer">
                                                Cash on Delivery (COD)
                                            </label>
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Pay cash upon delivery (+₹15 handling fee)</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {data.title && (
                            <div className="p-4 flex flex-col gap-4 border rounded-2xl bg-gray-50/70 dark:bg-gray-800 shadow-sm">
                                <div className="flex min-h-[100px] items-center">
                                    {data.imglink && <img src={data.imglink} alt={data.imgalt || data.title} width={80} height={80} className="mr-6 bg-white rounded-xl object-cover border" />}
                                    <div className="flex flex-col sm:flex-row justify-between w-full items-start sm:items-center">
                                        <div className="flex flex-col gap-1">
                                            <h4 className="font-semibold text-base text-gray-900">{data.title}</h4>
                                            {data.sizename != null && <p className="text-xs text-gray-600">Size: <span className="font-semibold text-gray-900">{data.sizename}</span></p>}
                                            {data.colorname != null && <p className="text-xs text-gray-600">Color: <span className="font-semibold text-gray-900">{data.colorname}</span></p>}
                                            <p className="text-xs text-gray-500">Qty: <span className="text-black font-semibold">1</span></p>
                                        </div>
                                        <div className="mt-2 sm:mt-0 text-right">
                                            <p className="font-bold text-xl text-primary-700">₹{data.discount}</p>
                                            {data.price !== data.discount && (
                                                <p className="font-medium text-xs line-through text-gray-400">₹{data.price}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>

                    <div className="mt-6 w-full space-y-6 sm:mt-8 lg:mt-0 lg:max-w-xs xl:max-w-md">
                        <div className="flow-root bg-gray-50/80 dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Order Summary</h3>

                            <div className="space-y-3 border-b border-gray-200 pb-4 text-sm">
                                <div className="flex justify-between text-gray-600">
                                    <span>Subtotal</span>
                                    <span className="font-medium text-gray-900">₹{formattedSubTotal}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Estimated Tax (18%)</span>
                                    <span className="font-medium text-gray-900">₹{formattedTaxes}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Shipping</span>
                                    <span className="font-medium text-gray-900">₹{formattedShipping}</span>
                                </div>
                                {paymentCharge > 0 && (
                                    <div className="flex justify-between text-gray-600">
                                        <span>COD Handling</span>
                                        <span className="font-medium text-gray-900">₹{paymentCharge.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between text-base font-bold text-gray-900 pt-4">
                                <span>Total</span>
                                <span className="text-2xl text-primary-700">₹{formattedTotalAmount}</span>
                            </div>

                            <button
                                type="button"
                                disabled={paying || loading}
                                onClick={createOrder}
                                className="mt-6 w-full rounded-xl bg-[#012652] hover:bg-[#0D94FB] px-6 py-3.5 text-base font-semibold text-white shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {paying ? (
                                    <span>Processing Payment…</span>
                                ) : (
                                    <span>{onlinePayment ? `Pay ₹${formattedTotalAmount}` : `Place Order (₹${formattedTotalAmount})`}</span>
                                )}
                            </button>

                            <p className="mt-3 text-center text-xs text-gray-500">
                                Safe & Secure Checkout • Instant Email Confirmation
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Checkout;