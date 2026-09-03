'use client';

import React, { useEffect, useState, useRef } from 'react';
import userData from '@/controllers/userData';
import useAuth from '@/controllers/Authentication';
import { useApp } from '@/Helpers/AccountDialog';
import { useAppSelector } from '@/app/hooks';
import Loading from '../Loading';
import { useRouter } from 'next/navigation';
import { checkoutCartProductDataHandler, cartCashCheckoutHandler, createRazorpayCartOrderHandler, verifyRazorpayCartPaymentHandler } from '@/app/api/paymentSystem';
import { openRazorpayCheckout } from '@/Helpers/razorpay';

interface ProductDetails {
    productid?: number | string;
    productID?: number | string;
    title: string;
    price: string | number;
    discount: string | number;
    sizename?: string;
    colorname?: string;
    imglink: string;
    imgalt?: string;
    shippingcost?: number;
    quantity: number;
}

const CartCheckout = () => {
    const { appState } = useApp();
    const loggedIn = appState.loggedIn;
    const cartlist = useAppSelector((state) => state.cartWishlist.cart);
    const [paymentCharge, setPaymentCharge] = useState(0);
    const [loading, setloading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [onlinePayment, setonlinePayment] = useState(true);
    const router = useRouter();

    const [products, setProducts] = useState<ProductDetails[]>([]);
    const data = products;

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

    const shipping = 99; // Standard flat shipping charge for cart
    const taxes = data.reduce((sum, item) => sum + (parseFloat(String(item.price || 0)) * (18 / 100)) * (item.quantity || 1), 0);
    const subTotal = data.reduce((sum, item) => sum + parseFloat(String(item.price || 0)) * (item.quantity || 1), 0);
    const subTotalWithoutTax = data.reduce((sum, item) => sum + (parseFloat(String(item.price || 0)) - (parseFloat(String(item.price || 0)) * 18 / 100)) * (item.quantity || 1), 0);
    const discount = data.reduce((sum, item) => sum + (parseFloat(String(item.price || 0)) - parseFloat(String(item.discount || item.price || 0))) * (item.quantity || 1), 0);
    const totalAmount = (subTotal + paymentCharge - discount + shipping) > 0 ? (subTotal + paymentCharge - discount + shipping) : shipping;

    const formattedSubTotal = subTotalWithoutTax.toFixed(2);
    const formattedShipping = shipping.toFixed(2);
    const formattedTaxes = taxes.toFixed(2);
    const formattedDiscount = discount.toFixed(2);
    const formattedTotalAmount = totalAmount.toFixed(2);

    const { checkSession } = useAuth();
    const { grabUserData } = userData();

    async function sync() {
        setloading(true);
        let currentUserId = 0;

        try {
            const sessionCheck = await checkSession();
            if (sessionCheck?.success && sessionCheck?.data?.userID) {
                currentUserId = sessionCheck.data.userID;
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

                const response = await checkoutCartProductDataHandler(currentUserId);
                if (response.status === 200 && response.data?.products?.length > 0) {
                    setProducts(response.data.products);
                    setloading(false);
                    return;
                }
            }
        } catch (e) {
            console.warn('Session check fallback:', e);
        }

        // Fallback: Populate cart products directly from client-side Redux cart
        if (cartlist && cartlist.length > 0) {
            const converted: ProductDetails[] = cartlist.map(item => ({
                productid: item.productID,
                productID: item.productID,
                title: item.productName,
                price: item.productPrice,
                discount: item.productPrice,
                sizename: item.productSize,
                colorname: item.productColor,
                imglink: item.productImg,
                imgalt: item.productAlt,
                quantity: item.quantity
            }));
            setProducts(converted);
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
        },
        items: data.map(item => ({
            productid: item.productid || item.productID,
            productID: item.productid || item.productID,
            quantity: item.quantity || 1,
            sizeid: 0,
            colorid: 0
        }))
    });

    async function handleRazorpayCartPayment() {
        if (!validateForm()) return;
        if (data.length === 0) {
            setErrorMessage('Your cart is empty. Please add items to proceed.');
            return;
        }

        try {
            setPaying(true);
            setErrorMessage(null);

            const payload = getCustomerPayload();

            // 1. Create Razorpay order on server with guest customer data
            const orderRes = await createRazorpayCartOrderHandler({
                userid: 0,
                customerInfo: payload.customerInfo,
                addressInfo: payload.addressInfo,
                items: payload.items
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
                description: `Cart Checkout (${data.length} items)`,
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
                    let verifyRes: any;
                    for (let attempt = 0; attempt < 3; attempt++) {
                        verifyRes = await verifyRazorpayCartPaymentHandler({
                            userid: 0,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            customerInfo: payload.customerInfo,
                            addressInfo: payload.addressInfo,
                            items: payload.items
                        });
                        if (verifyRes.status !== 503 || !verifyRes.data?.recovering) break;
                        setErrorMessage('Finalizing your order, one moment…');
                        await new Promise(r => setTimeout(r, 4000));
                    }

                    if (verifyRes.status === 200 && (verifyRes.data?.orderid || verifyRes.data?.orderIds?.[0])) {
                        const oid = verifyRes.data.orderid || verifyRes.data.orderIds[0];
                        router.push(`/order-confirmation/${oid}?payment_id=${response.razorpay_payment_id}&cart=true`);
                    } else {
                        setErrorMessage(verifyRes.data?.error || 'Payment verification failed. Please check your confirmation email.');
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
            console.error('Razorpay Cart Checkout error:', error);
            setErrorMessage(error.message || 'Unable to open Razorpay checkout modal.');
            setPaying(false);
        }
    }

    async function createOrder(e: React.FormEvent) {
        e.preventDefault();
        if (onlinePayment) {
            await handleRazorpayCartPayment();
            return;
        }

        if (!validateForm()) return;
        if (data.length === 0) {
            setErrorMessage('Your cart is empty. Please add items to proceed.');
            return;
        }

        setloading(true);
        setErrorMessage(null);

        const payload = getCustomerPayload();
        const createOrderRes = await cartCashCheckoutHandler({
            userID: 0,
            customerInfo: payload.customerInfo,
            addressInfo: payload.addressInfo,
            items: payload.items
        });

        if (createOrderRes.status === 200) {
            setloading(false);
            const oid = createOrderRes.data?.orderid || createOrderRes.data?.orderIds?.[0] || 'confirmed';
            router.push(`/order-confirmation/${oid}?cart=true`);
        } else {
            setErrorMessage(createOrderRes.data?.error || 'Failed to place Cash on Delivery order. Please retry.');
            setloading(false);
        }
    }

    useEffect(() => {
        sync();
    }, [cartlist]);

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
                            Cart
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
                                        className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm"
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
                                        className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm"
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

                        {data.length > 0 ? (
                            <div className="p-4 flex flex-col gap-3 border rounded-2xl bg-gray-50/70 dark:bg-gray-800">
                                <h4 className="font-semibold text-gray-900 text-sm">Items in Cart ({data.length})</h4>
                                <div className="divide-y divide-gray-200 max-h-60 overflow-y-auto pr-1">
                                    {data.map((item, idx) => (
                                        <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-3">
                                                {item.imglink && <img src={item.imglink} alt={item.title} className="w-12 h-12 rounded-lg object-cover bg-white border" />}
                                                <div>
                                                    <p className="font-medium text-gray-900">{item.title}</p>
                                                    <p className="text-xs text-gray-500">Qty: {item.quantity || 1} {item.sizename ? `• ${item.sizename}` : ''}</p>
                                                </div>
                                            </div>
                                            <div className="font-bold text-gray-900">
                                                ₹{(parseFloat(String(item.discount || item.price || 0)) * (item.quantity || 1)).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                                <p className="text-gray-500 mb-3">Your cart is empty.</p>
                                <button type="button" onClick={() => router.push('/')} className="text-sm font-semibold text-primary-600 hover:underline">
                                    Explore Products &rarr;
                                </button>
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
                                disabled={paying || loading || data.length === 0}
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

export default CartCheckout;
