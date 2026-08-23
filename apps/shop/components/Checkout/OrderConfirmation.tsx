'use client'
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import OrderNotFound from './OrderNotFound';
import PaymentFailed from './PaymentFailed';
import PaymentPending from './PaymentPending';
import Loading from '../Loading';
import { orderStatusDataHandler } from '@/app/api/paymentSystem';

const OrderConfirmation = () => {
    const router = useRouter();
    const params = useParams<{ orderID: string | string[] }>();
    const searchParams = useSearchParams();
    const paymentId = searchParams.get('payment_id');
    const isCart = searchParams.get('cart') === 'true';
    const found = useRef(false);
    const error = useRef(false);
    const paymentPending = useRef(false);
    const [loading, setloading] = useState(true);
    const [orderDetails, setOrderDetails] = useState<any>(null);

    async function sync() {
        const orderCheck = await orderStatusDataHandler({ orderID: params.orderID });
        switch (orderCheck.status) {
            case 200:
                found.current = true;
                setOrderDetails(orderCheck.data);
                setloading(false);
                break;
            case 402:
            case 205:
                found.current = true;
                paymentPending.current = true;
                setloading(false);
                break;
            case 400:
            case 210:
                error.current = true;
                setloading(false);
                break;
            case 404:
            default:
                setloading(false);
                break;
        }
    }

    useEffect(() => {
        sync();
    }, []);

    return (
        <>
            {(!loading && found.current && paymentPending.current) && <PaymentPending />}
            {(!loading && !found.current) && <OrderNotFound />}
            {(!loading && error.current) && <PaymentFailed />}
            {loading && <div className='w-full absolute h-[300px]'>{loading && <div className='absolute left-0 right-0 top-64 z-50'><Loading /></div>}</div>}
            {(!loading && found.current && !paymentPending.current) &&
                <div className='flex flex-col items-center w-screen relative py-8 px-4'>
                    <ol className="items-center flex w-full max-w-2xl text-center text-sm font-medium text-gray-500 dark:text-gray-400 sm:text-base mb-8">
                        <li className="after:border-1 flex items-center text-primary-700 after:mx-6 after:hidden after:h-1 after:w-full after:border-b after:border-gray-200 dark:text-primary-500 dark:after:border-gray-700 sm:after:inline-block sm:after:content-[''] md:w-full xl:after:mx-10">
                            <span className="flex items-center after:mx-2 after:text-gray-200 after:content-['/'] dark:after:text-gray-500 sm:after:hidden">
                                <svg className="me-2 h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                                {isCart ? 'Cart' : 'Product'}
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

                        <li className="flex shrink-0 items-center text-primary-700 font-semibold">
                            <svg className="me-2 h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            Order summary
                        </li>
                    </ol>

                    <div className="bg-white flex items-center justify-center relative w-full max-w-2xl">
                        <div className="bg-gray-50 border-2 flex relative gap-5 items-center flex-col text-gray-800 p-8 rounded-2xl shadow-lg w-full text-center">
                            <div className="text-2xl mb-2 text-white bg-green-500 rounded-full py-4 px-4 w-[75px] h-[75px] flex items-center justify-center shadow-md">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    className="w-10 h-10 mx-auto"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2.5"
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900">Order Confirmed ✓</h2>
                            <p className="text-gray-600 max-w-md">
                                Thank you for your purchase! Your order <span className="font-bold text-gray-900">#{params.orderID}</span> has been confirmed and is being processed for express delivery.
                            </p>

                            <div className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left space-y-2.5 text-sm my-2">
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">Order ID:</span>
                                    <span className="font-bold text-gray-900">#{params.orderID}</span>
                                </div>
                                {paymentId && (
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-500">Razorpay Payment ID:</span>
                                        <span className="font-mono text-primary-700 font-medium">{paymentId}</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">Payment Status:</span>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                        Confirmed / Paid
                                    </span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">Estimated Delivery:</span>
                                    <span className="font-semibold text-gray-900">Within 3–5 Business Days</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Shipping Method:</span>
                                    <span className="font-medium text-gray-900">Express Delivery (₹99)</span>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 w-full pt-2">
                                <button
                                    onClick={() => router.push(`/order-detail/${params.orderID}`)}
                                    className="bg-primary-700 hover:bg-primary-800 text-sm text-white font-semibold py-3.5 px-6 rounded-xl shadow-md transition-colors duration-150"
                                >
                                    Track Your Order
                                </button>
                                <button
                                    onClick={() => router.push('/orders')}
                                    className="bg-gray-700 hover:bg-gray-900 text-sm text-white font-semibold py-3.5 px-6 rounded-xl shadow-md transition-colors duration-150"
                                >
                                    View All Orders
                                </button>
                                <button
                                    onClick={() => router.push('/')}
                                    className="border border-gray-300 hover:bg-gray-100 text-sm text-gray-700 font-semibold py-3.5 px-6 rounded-xl transition-colors duration-150"
                                >
                                    Continue Shopping
                                </button>
                            </div>
                        </div>
                    </div>
                </div>}
        </>
    );
};

export default OrderConfirmation;