'use client'
import React, { useLayoutEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation';
import { checkoutProductDataHandler, paymentOnDeliveryHandler, createRazorpayOrderHandler, verifyRazorpayPaymentHandler } from '@/app/api/paymentSystem';
import Loading from '../Loading';
import useAuth from '@/controllers/Authentication';
import { useApp } from '@/Helpers/AccountDialog';
import userData from '@/controllers/userData';
import { Description, Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
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

interface Account {
    userID: number;
    userName: string;
    email: string;
    mobile_number: string;
    dob: string;
}

interface Address {
    addressID: number;
    addressType: string;
    contactNumber: number;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    userName: string;
    is_default: boolean;
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
    const { appState } = useApp();
    const loggedIn = appState.loggedIn;
    const [paymentCharge, setPaymentCharge] = useState(0);
    const params = useParams<{ productID: string, colorID: string, sizeID: string }>();
    const [loading, setloading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const dataChecked = useRef(false);
    const found = useRef(false);
    const [onlinePayment, setonlinePayment] = useState(true);
    const router = useRouter();
    // Product in STATE (see CartCheckout): a bare ref mutation never
    // re-rendered, leaving the page stuck on the empty first render.
    const dataVar = useRef<ProductDetails>(emptyProductDetails);
    const [product, setProduct] = useState<ProductDetails>(emptyProductDetails);
    const data = product;
    const genUserData = useRef<Account>({
        userID: 0,
        userName: '',
        email: '',
        mobile_number: '',
        dob: ''
    });
    const genUserAddress = useRef<Address>({
        addressID: 0,
        addressType: 'HOME',
        contactNumber: 0,
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        userName: '',
        is_default: true
    });

    const shipping = data.shippingcost || 99;
    const taxes = (parseFloat(data.price || '0') * (18 / 100));
    const subTotal = parseFloat(data.price || '0');
    const subTotalWithoutTax = (parseFloat(data.price || '0') - (parseFloat(data.price || '0') * 18 / 100));
    const discount = parseFloat(data.price || '0') - parseFloat(data.discount || '0');
    const totalAmount = (subTotal + shipping + paymentCharge) - discount;
    const formattedSubTotal = subTotalWithoutTax.toFixed(2);
    const formattedShipping = shipping.toFixed(2);
    const formattedTaxes = taxes.toFixed(2);
    const formattedDiscount = discount.toFixed(2);
    const formattedTotalAmount = totalAmount.toFixed(2);
    const [dialogType, setdialogType] = useState<null | string>(null);
    const orderID = useRef(0);
    const { checkSession } = useAuth();
    const { grabUserData } = userData();
    const orderCreationError = useRef(false);

    async function dataRequest() {
        const response = await checkoutProductDataHandler({
            productID: params.productID,
            colorID: params.colorID,
            sizeID: params.sizeID
        });
        switch (response.status) {
            case 200:
                dataVar.current = response.data;
                setProduct(response.data);
                found.current = true;
                break;
            case 500:
            default:
                router.push('/');
                break;
        }
    }

    async function sync() {
        await dataRequest();
        if (!found.current) return;
        const sessionCheck = await checkSession();
        const userDataCheck = await grabUserData();
        dataChecked.current = true;
        if (sessionCheck?.success && userDataCheck?.success) {
            if (userDataCheck.addresses?.length === 0) {
                setdialogType('addressRequired');
                setloading(false);
                return;
            }
            if (sessionCheck.data != undefined) genUserData.current = sessionCheck.data;
            if (userDataCheck.addresses != undefined && userDataCheck.addresses.length > 0) {
                userDataCheck.addresses.map((each: Address) => {
                    if (each.is_default) genUserAddress.current = each;
                });
            }
            if (genUserAddress.current.addressID === 0) {
                setdialogType('defaultAddressRequired');
                setloading(false);
                return;
            }
            setloading(false);
        } else {
            router.push('/sign-in');
        }
    }

    async function handleRazorpayPayment() {
        if (!loggedIn) {
            router.push('/sign-in');
            return;
        }
        if (genUserAddress.current.addressID === 0) {
            setdialogType('defaultAddressRequired');
            return;
        }

        try {
            setPaying(true);
            setErrorMessage(null);

            // 1. Create Razorpay order on server
            const orderRes = await createRazorpayOrderHandler({
                userid: genUserData.current.userID,
                productid: params.productID,
                colorid: params.colorID,
                sizeid: params.sizeID
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
                    name: genUserData.current.userName || genUserAddress.current.userName,
                    email: genUserData.current.email,
                    contact: genUserData.current.mobile_number || String(genUserAddress.current.contactNumber || '')
                },
                theme: {
                    color: '#6366f1'
                },
                handler: async (response) => {
                    setPaying(true);
                    // 3. Verify Razorpay cryptographic signature on backend
                    const verifyRes = await verifyRazorpayPaymentHandler({
                        userid: genUserData.current.userID,
                        productid: params.productID,
                        colorid: params.colorID,
                        sizeid: params.sizeID,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature
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

    async function createOrder(e: any) {
        e.preventDefault();
        if (onlinePayment) {
            await handleRazorpayPayment();
            return;
        }

        setloading(true);
        const createOrder = await paymentOnDeliveryHandler({
            userid: genUserData.current.userID,
            productid: params.productID,
            colorid: params.colorID,
            sizeid: params.sizeID
        });

        switch (createOrder.status) {
            case 200:
                setloading(false);
                orderID.current = createOrder.data.orderid;
                router.push(`/order-confirmation/${createOrder.data.orderid}`);
                break;
            default:
                orderCreationError.current = true;
                setErrorMessage('Failed to place Cash on Delivery order.');
                setloading(false);
                break;
        }
    }

    useLayoutEffect(() => {
        sync();
    }, []);

    return (
        <section className="bg-white py-8 h-screen w-screen overflow-x-hidden antialiased relative dark:bg-gray-900 md:py-6">
            <Dialog open={dialogType === 'addressRequired'} onClose={() => setdialogType('addressRequired')} className="relative z-50">
                <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
                    <DialogPanel className="max-w-lg space-y-4 border bg-white p-12 rounded-xl text-center drop-shadow-custom-xl">
                        <DialogTitle className="font-bold">Address Required</DialogTitle>
                        <Description>Please add an address to proceed with checkout.</Description>
                        <div className="flex justify-center gap-4">
                            <button className="border-[1.5px] hover:bg-black transition-colors duration-300 hover:text-white py-2 px-6 rounded-xl" onClick={() => { router.push('/account-settings') }}>Go to Account Settings</button>
                        </div>
                    </DialogPanel>
                </div>
            </Dialog>

            <Dialog open={dialogType === 'defaultAddressRequired'} onClose={() => setdialogType('defaultAddressRequired')} className="relative z-50">
                <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
                    <DialogPanel className="max-w-lg space-y-4 border bg-white p-12 rounded-xl text-center drop-shadow-custom-xl">
                        <DialogTitle className="font-bold">Default Address Required</DialogTitle>
                        <Description>Please add a default address or set an existing address to default to proceed with checkout.</Description>
                        <div className="flex justify-center gap-4">
                            <button className="border-[1.5px] hover:bg-black transition-colors duration-300 hover:text-white py-2 px-6 rounded-xl" onClick={() => { router.push('/account-settings') }}>Go to Account Settings</button>
                        </div>
                    </DialogPanel>
                </div>
            </Dialog>

            {loading && <div className="w-screen h-screen absolute">{loading && <div className="absolute left-0 right-0 top-[30%] z-50"><Loading /></div>}</div>}

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
                    <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex justify-between items-center">
                        <span>{errorMessage}</span>
                        <button onClick={() => setErrorMessage(null)} className="text-sm font-semibold hover:underline">Dismiss</button>
                    </div>
                )}

                <div className="mt-6 sm:mt-8 lg:flex lg:items-start lg:gap-12 xl:gap-16">
                    <form id="informational-form" onSubmit={createOrder} className="min-w-0 flex-1 space-y-8">
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Delivery Details</h2>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="your_name" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"> Your name </label>
                                    <input disabled={true} value={genUserData.current.userName} type="text" id="your_name" className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="Suresh Kumar" required />
                                </div>

                                <div>
                                    <label htmlFor="your_email" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"> Your email* </label>
                                    <input disabled={true} value={genUserData.current.email} type="email" id="your_email" className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" placeholder="suresh@gmail.com" required />
                                </div>

                                <div>
                                    <div className="mb-2 flex items-center gap-2">
                                        <label htmlFor="select-country-input-3" className="block text-sm font-medium text-gray-900 dark:text-white"> Country* </label>
                                    </div>
                                    <input disabled={true} value={genUserAddress.current.country || 'India'} type="text" placeholder="India" id="select-country-input-3" className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                                </div>

                                <div>
                                    <div className="mb-2 flex items-center gap-2">
                                        <label htmlFor="select-city-input-3" className="block text-sm font-medium text-gray-900 dark:text-white"> City* </label>
                                    </div>
                                    <input disabled={true} value={genUserAddress.current.city} type="text" placeholder="Delhi" id="select-city-input-3" className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                                </div>

                                <div>
                                    <label htmlFor="phone-input-3" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"> Phone Number* </label>
                                    <div className="flex items-center">
                                        <button id="dropdown-phone-button-3" data-dropdown-toggle="dropdown-phone-3" className="z-10 inline-flex shrink-0 items-center rounded-s-lg border border-gray-300 bg-gray-100 px-4 py-2.5 text-center text-sm font-medium text-gray-900" type="button">
                                            +91
                                        </button>
                                        <div className="relative w-full">
                                            <input disabled={true} value={genUserData.current.mobile_number || genUserAddress.current.contactNumber || ''} type="text" id="phone-input" className="z-20 block w-full rounded-e-lg border border-s-0 border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900" placeholder="9876543210" required />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="pincode" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"> Pin Code </label>
                                    <input disabled={true} value={genUserAddress.current.postalCode} type="text" id="pincode" className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900" placeholder="110001" required />
                                </div>

                                <div>
                                    <label htmlFor="address1" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Address 1</label>
                                    <input disabled={true} value={genUserAddress.current.addressLine1} type="text" id="address1" className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900" placeholder="Address Line 1" required />
                                </div>

                                <div>
                                    <label htmlFor="address2" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">Address 2</label>
                                    <input disabled={true} value={genUserAddress.current.addressLine2} type="text" id="address2" className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900" placeholder="Address Line 2" required />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Payment Method</h3>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className={`rounded-lg border p-4 cursor-pointer transition-all ${onlinePayment ? 'border-primary-600 bg-primary-50 dark:bg-gray-800 ring-2 ring-primary-500' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'}`} onClick={() => { setonlinePayment(true); setPaymentCharge(0); }}>
                                    <div className="flex items-start">
                                        <div className="flex h-5 items-center">
                                            <input checked={onlinePayment} onChange={() => { setonlinePayment(true); setPaymentCharge(0); }} id="online-payment" type="radio" name="payment-method" className="h-4 w-4 text-primary-600 focus:ring-primary-500" />
                                        </div>
                                        <div className="ms-4 text-sm">
                                            <label htmlFor="online-payment" className="font-semibold text-gray-900 dark:text-white cursor-pointer flex items-center gap-2">
                                                <span>Razorpay Standard Checkout</span>
                                                <span className="bg-primary-100 text-primary-800 text-xs px-2 py-0.5 rounded font-medium">Official</span>
                                            </label>
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Cards, UPI (Google Pay, PhonePe, Paytm), NetBanking & Wallets</p>
                                        </div>
                                    </div>
                                </div>

                                <div className={`rounded-lg border p-4 cursor-pointer transition-all ${!onlinePayment ? 'border-primary-600 bg-primary-50 dark:bg-gray-800 ring-2 ring-primary-500' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'}`} onClick={() => { setonlinePayment(false); setPaymentCharge(15); }}>
                                    <div className="flex items-start">
                                        <div className="flex h-5 items-center">
                                            <input checked={!onlinePayment} onChange={() => { setonlinePayment(false); setPaymentCharge(15); }} id="pay-on-delivery" type="radio" name="payment-method" className="h-4 w-4 text-primary-600 focus:ring-primary-500" />
                                        </div>
                                        <div className="ms-4 text-sm">
                                            <label htmlFor="pay-on-delivery" className="font-semibold text-gray-900 dark:text-white cursor-pointer">
                                                Payment on Delivery (POD)
                                            </label>
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">+₹15 cash handling fee</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 mb-8 flex flex-col gap-4 border rounded-xl bg-gray-50 dark:bg-gray-800">
                            <div className="flex min-h-[120px] items-center">
                                <img src={data.imglink} alt={data.imgalt} width={100} height={100} className="mr-8 bg-white rounded-xl object-cover" />
                                <div className="flex flex-col sm:flex-row justify-between w-full items-start sm:items-center">
                                    <div className="flex flex-col gap-1">
                                        <h4 className="font-semibold text-lg">{data.title}</h4>
                                        {data.sizename != null && <p className="text-sm">Size: <span className="font-medium">{data.sizename}</span></p>}
                                        {data.colorname != null && <p className="text-sm">Color: <span className="font-medium">{data.colorname}</span></p>}
                                        <p className="text-sm text-gray-500">Qty: <span className="text-black font-semibold">1</span></p>
                                    </div>
                                    <div className="mt-2 sm:mt-0 text-right">
                                        <p className="font-bold text-2xl text-primary-700">₹{data.discount}</p>
                                        <p className="font-medium text-sm line-through text-gray-400">₹{data.price}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>

                    <div className="mt-6 w-full space-y-6 sm:mt-8 lg:mt-0 lg:max-w-xs xl:max-w-md">
                        <div className="flow-root bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Price Summary</h3>
                            <div className="-my-3 divide-y divide-gray-200 dark:divide-gray-700">
                                <dl className="flex items-center justify-between gap-4 py-3">
                                    <dt className="text-sm text-gray-500 dark:text-gray-400">Subtotal (Excl. Tax)</dt>
                                    <dd className="text-sm font-medium text-gray-900 dark:text-white">₹{formattedSubTotal}</dd>
                                </dl>

                                <dl className="flex items-center justify-between gap-4 py-3">
                                    <dt className="text-sm text-gray-500 dark:text-gray-400">Shipping Charge (Express)</dt>
                                    <dd className="text-sm font-medium text-gray-900 dark:text-white">₹{formattedShipping}</dd>
                                </dl>

                                {paymentCharge !== 0 && (
                                    <dl className="flex items-center justify-between gap-4 py-3">
                                        <dt className="text-sm text-gray-500 dark:text-gray-400">Payment Processing Fee</dt>
                                        <dd className="text-sm font-medium text-gray-900 dark:text-white">₹{paymentCharge}</dd>
                                    </dl>
                                )}

                                <dl className="flex items-center justify-between gap-4 py-3">
                                    <dt className="text-sm text-gray-500 dark:text-gray-400">Taxes (GST 18%)</dt>
                                    <dd className="text-sm font-medium text-gray-900 dark:text-white">₹{formattedTaxes}</dd>
                                </dl>

                                <dl className="flex items-center justify-between gap-4 py-3">
                                    <dt className="text-sm text-gray-500 dark:text-gray-400">Discount Savings</dt>
                                    <dd className="text-sm font-medium text-green-600 dark:text-green-400">-₹{formattedDiscount}</dd>
                                </dl>

                                <dl className="flex items-center justify-between gap-4 py-3 border-t-2 border-gray-300 dark:border-gray-600">
                                    <dt className="text-base font-bold text-gray-900 dark:text-white">Grand Total</dt>
                                    <dd className="text-lg font-bold text-primary-700 dark:text-primary-400">₹{formattedTotalAmount}</dd>
                                </dl>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {onlinePayment ? (
                                <button
                                    onClick={handleRazorpayPayment}
                                    disabled={!loggedIn || paying}
                                    type="button"
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-5 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-primary-800 focus:outline-none focus:ring-4 focus:ring-primary-300 disabled:opacity-50 transition-all duration-150"
                                >
                                    {paying ? (
                                        <span>Processing with Razorpay...</span>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5z" />
                                            </svg>
                                            <span>Pay ₹{formattedTotalAmount} with Razorpay</span>
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    form="informational-form"
                                    disabled={!loggedIn || paying}
                                    type="submit"
                                    className="flex w-full items-center justify-center rounded-xl bg-gray-800 px-5 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-black focus:outline-none focus:ring-4 focus:ring-gray-300 disabled:opacity-50 transition-all duration-150"
                                >
                                    <span>Place Order (Payment on Delivery)</span>
                                </button>
                            )}

                            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 pt-2">
                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span>256-bit SSL Encrypted & Official Razorpay Secured Checkout</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Checkout;