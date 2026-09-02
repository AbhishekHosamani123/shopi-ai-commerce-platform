"use client"

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import merchantLoginHandler from '@/app/api/merchantlogin';

export default function MerchantSignInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const identifier = (form.elements.namedItem('identifier') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    try {
      let res = await merchantLoginHandler({ identifier, password });
      // Backend 503 + recovering=true = Render free Postgres was wiped and
      // the self-heal is rebuilding. Auto-retry instead of dead-ending.
      if (res.status === 503 && (res.data as any)?.recovering) {
        setError('Account system is being restored — retrying automatically…');
        for (let retry = 0; retry < 2; retry++) {
          await new Promise(r => setTimeout(r, 15000));
          res = await merchantLoginHandler({ identifier, password });
          if (res.status !== 503 || !(res.data as any)?.recovering) break;
        }
      }
      if (res.status === 200) {
        router.push('/merchant');
        router.refresh();
      } else if (res.status === 403) {
        setError(res.data?.error || 'This account does not have merchant access.');
      } else if (res.status === 401) {
        setError(res.data?.error || 'Invalid credentials. Please check your username/email and password.');
      } else if (res.status === 503) {
        setError('The account database is being restored after a provider reset. This usually completes within a minute — please try again shortly.');
      } else {
        setError('Unable to reach the merchant service. Please try again.');
      }
    } catch {
      setError('Unable to reach the merchant service. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center px-4 merchant-ui font-sans">
      <div className="w-full max-w-md">
        <div className="bg-surface-1 border border-hairline rounded-lg p-8 space-y-6 shadow-2xs">
          <div className="text-center space-y-1">
            <div className="text-2xl font-semibold tracking-tight">
              <span className="text-linear-primary">✨</span> Shopi Merchant AI
            </div>
            <p className="text-xs text-ink-subtle">
              Restricted merchant/admin sign-in. Customer accounts do not have access.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-rose-300 text-xs font-mono">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="block mb-1.5 text-sm font-medium">
                Merchant username or email
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                required
                minLength={3}
                maxLength={128}
                autoComplete="username"
                placeholder="merchant@shopi.com"
                className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:border-linear-primary"
              />
            </div>
            <div>
              <label htmlFor="password" className="block mb-1.5 text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={32}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:border-linear-primary"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md bg-linear-primary hover:bg-linear-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in to Merchant AI'}
            </button>
          </form>

          <div className="text-center text-xs text-ink-tertiary">
            <Link href="/" className="hover:underline text-linear-primary-hover">
              ← Back to storefront
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
