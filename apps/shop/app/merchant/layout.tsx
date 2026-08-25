import type { Metadata } from 'next';
import React from 'react';
import { AppShell } from '../../components/Merchant/v2/AppShell';

export const metadata: Metadata = {
  title: 'Merchant Analytics & Operations | Razorpay AI Commerce',
  description: 'Enterprise commerce intelligence, sales analytics, and operational command center.',
};

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell syncAgeSeconds={45}>
      {children}
    </AppShell>
  );
}
