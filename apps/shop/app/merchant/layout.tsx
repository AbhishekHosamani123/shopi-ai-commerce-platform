import type { Metadata } from 'next';
import React from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '../../components/Merchant/v2/AppShell';
import { getMerchantSession } from '../../lib/merchantSession';

export const metadata: Metadata = {
  title: 'Merchant Analytics & Operations | Razorpay AI Commerce',
  description: 'Enterprise commerce intelligence, sales analytics, and operational command center.',
};

/**
 * Merchant AI authentication guard (server-side).
 *
 * Every /merchant/* page is protected here.  Missing/expired/invalid merchant
 * sessions are redirected to the top-level /merchant-sign-in page (which
 * lives outside this layout so it renders standalone).
 *
 * Customer sessions never satisfy the role check, so a logged-in customer
 * cannot open the dashboard.
 *
 * Defense in depth: the /api/merchant/* proxy route independently enforces
 * the same session, so direct API calls are also blocked.
 */
export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getMerchantSession();
  if (!session) {
    redirect('/merchant-sign-in');
  }

  return <AppShell syncAgeSeconds={45}>{children}</AppShell>;
}
