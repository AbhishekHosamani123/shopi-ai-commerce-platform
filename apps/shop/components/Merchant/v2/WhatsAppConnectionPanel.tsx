'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TrustBadge } from './TrustBadge';

export type DeliveryChannel = 'EMAIL' | 'WHATSAPP';

interface WhatsAppSenderStatus {
  instanceName: string;
  state: string;
  isConnected: boolean;
  instanceExists: boolean;
}

interface WhatsAppIntegrationStatus {
  success: boolean;
  evolutionConfigured: boolean;
  sendMode: 'DRY_RUN' | 'LIVE';
  sender: WhatsAppSenderStatus;
  allowedRecipients: string[];
}

/**
 * WhatsApp connection panel (PHASE 1): shows the QR-connected SENDER account's
 * live Evolution API state and the Buildathon recipient allowlist, with a QR
 * connect flow. The scanned account becomes the sender; it is never confused
 * with the recipient allowlist.
 *
 * QR FRESHNESS: Evolution/Baileys rotates the pairing QR roughly every 45
 * seconds. An expired QR makes WhatsApp's scanner fail with "Could not
 * connect", so while we wait for a scan we re-fetch the CURRENT QR every
 * 30 seconds, display its fetch time, and offer a manual refresh. The QR
 * disappears the moment Evolution reports an open connection.
 */
export function WhatsAppConnectionPanel({ onStatusChange }: { onStatusChange?: (s: WhatsAppIntegrationStatus | null) => void }) {
  const [status, setStatus] = useState<WhatsAppIntegrationStatus | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrFetchedAt, setQrFetchedAt] = useState<Date | null>(null);
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/merchant/whatsapp/status', {
        headers: { 'x-merchant-id': 'default_merchant' }
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data);
        onStatusChange?.(data);
        // Clear a displayed QR once the scan completes.
        if (data.sender?.isConnected) {
          setQrImage(null);
          setQrFetchedAt(null);
        }
      }
    } catch {
      // Status panel is non-critical; leave prior state.
    }
  }, [onStatusChange]);

  // Fetch the CURRENT QR from Evolution (non-destructive while state is
  // 'connecting': Evolution returns its in-memory QR).
  const fetchQr = useCallback(async () => {
    setIsFetchingQr(true);
    setError(null);
    try {
      const res = await fetch('/api/merchant/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-merchant-id': 'default_merchant' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok && data.success && data.qrCode) {
        setQrImage(data.qrCode);
        setQrFetchedAt(new Date());
      } else if (res.ok && data.success) {
        setError('WhatsApp sender account is already connected.');
        setQrImage(null);
      } else {
        setError(data.error || 'Failed to retrieve QR code.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection request failed.');
    } finally {
      setIsFetchingQr(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // While a QR is waiting to be scanned, keep it fresh: re-fetch before the
  // ~45s server-side rotation makes the displayed QR expire.
  useEffect(() => {
    if (!qrImage) return;
    const refresh = setInterval(fetchQr, 30000);
    return () => clearInterval(refresh);
  }, [qrImage, fetchQr]);

  const startConnect = async () => {
    setQrImage(null);
    setQrFetchedAt(null);
    await fetchQr();
  };

  const sender = status?.sender;

  // Age of the currently displayed QR, for the freshness warning.
  const qrAgeSeconds = qrFetchedAt
    ? Math.floor((Date.now() - qrFetchedAt.getTime()) / 1000)
    : null;

  return (
    <div className="bg-surface-2 border border-hairline rounded-md p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-semibold text-ink uppercase tracking-[0.4px] font-display">
            WhatsApp Integration (Evolution API)
          </span>
          <TrustBadge tag="[LIVE STATUS]" />
        </div>
        {status && (
          <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-xs border ${
            status.sendMode === 'LIVE'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : 'bg-surface-3 text-ink-subtle border-hairline'
          }`}>
            SEND MODE: {status.sendMode}
          </span>
        )}
      </div>

      {status && !status.evolutionConfigured && (
        <p className="text-[11px] text-amber-300 font-mono">
          Evolution API is not configured on the backend (EVOLUTION_API_URL / EVOLUTION_API_KEY).
        </p>
      )}

      {/* SENDER: the QR-connected WhatsApp account */}
      <div className="flex items-center justify-between bg-surface-1 border border-hairline rounded-md px-3 py-2">
        <div className="flex flex-col">
          <span className="text-xs font-mono font-semibold text-ink">WhatsApp Sender Account</span>
          <span className="text-[10px] font-mono text-ink-tertiary">
            {sender?.instanceName || 'shopi-buildathon-whatsapp'} (whatever account you scan becomes the sender)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold ${
            sender?.isConnected ? 'text-semantic-success' : 'text-ink-subtle'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sender?.isConnected ? 'bg-semantic-success' : 'bg-ink-subtle'}`} />
            {sender?.isConnected ? 'Connected' : `Not Connected (${sender?.state || 'unknown'})`}
          </span>
          {!sender?.isConnected && (
            <button
              onClick={startConnect}
              disabled={isFetchingQr}
              className="px-2 py-1 text-[10px] font-medium rounded-md bg-linear-primary/10 border border-linear-primary/30 text-linear-primary-hover hover:bg-linear-primary/20 transition-colors font-mono disabled:opacity-50"
            >
              {isFetchingQr ? 'Loading…' : qrImage ? 'Refresh QR' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {/* RECIPIENTS: not shown in the dashboard UI — the Buildathon recipient
          allowlist remains enforced by the backend (whatsapp-allowlist-service)
          regardless of what is displayed here. */}

      {qrImage && (
        <div className="flex flex-col items-center gap-2 bg-surface-1 border border-hairline rounded-md p-3">
          <span className="text-[11px] font-semibold text-emerald-300 font-mono">
            Scan this QR NOW with the WhatsApp account you want to use as the SENDER
          </span>
          <span className="text-[10px] text-ink-subtle font-mono">
            WhatsApp → Settings → Linked Devices → Link a Device → point at this code
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrImage} alt="WhatsApp QR code" className="w-56 h-56 rounded border border-hairline bg-white p-1" />
          <span className="text-[10px] text-amber-300 font-mono">
            ⏱ This QR refreshes automatically every 30s (server rotates it ~45s).
            {qrAgeSeconds !== null ? ` Current QR is ${qrAgeSeconds}s old — scan immediately after a refresh.` : ''}
          </span>
          <button
            onClick={fetchQr}
            disabled={isFetchingQr}
            className="px-3 py-1.5 text-[10px] font-medium rounded-md bg-linear-primary hover:bg-linear-primary-hover text-white transition-colors font-mono disabled:opacity-50"
          >
            {isFetchingQr ? 'Fetching fresh QR…' : 'Refresh QR Now'}
          </button>
          <span className="text-[10px] text-ink-tertiary font-mono">
            Status refreshes every 5 seconds — the QR disappears the moment the account is connected.
          </span>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-amber-300 font-mono">{error}</p>
      )}
    </div>
  );
}
