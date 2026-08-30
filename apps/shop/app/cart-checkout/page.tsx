'use client'
import { MenuProvider } from '@/Helpers/MenuContext'
import React from 'react'
import { AppProvider } from '@/Helpers/AccountDialog'
import { Provider } from 'react-redux'
import { store } from '@/app/store'
import dynamic from 'next/dynamic'
import CartCheckout from '@/components/Checkout/CartCheckout'

// Shopi AI available on checkout so customers can ask about addresses/cart
// (dynamically loaded to keep the checkout render light)
const ShopiAiAssistant = dynamic(() => import('@/components/AI/ShopiAiAssistant'), {
  ssr: false,
})

const page = () => {
    return (
        <Provider store={store}>
                <MenuProvider>
                    <AppProvider>
                        <CartCheckout/>
                        <ShopiAiAssistant />
                    </AppProvider>
                </MenuProvider>
        </Provider>
    )
}

export default page