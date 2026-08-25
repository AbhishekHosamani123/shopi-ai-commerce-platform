"use client";
import React from 'react';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { MenuProvider } from '@/Helpers/MenuContext';
import { AppProvider } from '@/Helpers/AccountDialog';
import Session from '@/components/Session';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <MenuProvider>
        <AppProvider>
          <Session />
          {children}
        </AppProvider>
      </MenuProvider>
    </Provider>
  );
}
