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
 * WhatsApp connection panel: shows the QR-connected SENDER account's live
 * Evolution API state with Connect (large QR modal popup) and Disconnect
 * actions.
 *
 * QR FRESHNESS: Evolution/Baileys rotates the pairing QR roughly every 45
 * seconds. An expired QR makes WhatsApp's scanner fail with "Could not
 * connect", so the modal auto-refreshes the QR every 30 seconds, shows its
 * age, and offers a manual refresh. The modal closes automatically the
 * moment Evolution reports an open connection.
 */
export function WhatsAppConnectionPanel({ onStatusChange }: { onStatusChange?: (s: WhatsAppIntegrationStatus | null) => void }) {
  const [status, setStatus] = useState<WhatsAppIntegrationStatus | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrFetchedAt, setQrFetchedAt] = useState<Date | null>(null);
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
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
        // The QR scan completed: close the modal and clear any stale QR.
        if (data.sender?.isConnected) {
          setIsQrModalOpen(false);
          setQrImage(null);
          setQrFetchedAt(null);
        }
      }
    } catch {
      // Status panel is non-critical; leave prior state.
    }
  }, [onStatusChange]);

  // Fetch the CURRENT QR from Evolution (creates the instance if missing).
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
        // Already connected — status poll will close the modal.
        setError('WhatsApp sender account is already connected.');
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

  // While the QR modal is open, keep the QR fresh ahead of the ~45s rotation.
  useEffect(() => {
    if (!isQrModalOpen) return;
    const refresh = setInterval(fetchQr, 20000);
    return () => clearInterval(refresh);
  }, [isQrModalOpen, fetchQr]);

  const openQrModal = async () => {
    setQrImage(null);
    setQrFetchedAt(null);
    setError(null);
    setIsQrModalOpen(true);
    await fetchQr();
  };

  const closeQrModal = () => {
    setIsQrModalOpen(false);
    setQrImage(null);
    setQrFetchedAt(null);
  };

  const disconnect = async () => {
    setIsDisconnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/merchant/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-merchant-id': 'default_merchant' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchStatus();
      } else {
        setError(data.error || 'Failed to disconnect the WhatsApp sender.');
      }
    } catch (err: any) {
      setError(err.message || 'Disconnect request failed.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const sender = status?.sender;

  // Age of the displayed QR for the freshness warning.
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
          {sender?.isConnected ? (
            <button
              onClick={disconnect}
              disabled={isDisconnecting}
              className="px-2 py-1 text-[10px] font-medium rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition-colors font-mono disabled:opacity-50"
            >
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={openQrModal}
              disabled={isFetchingQr && !qrImage}
              className="px-2 py-1 text-[10px] font-medium rounded-md bg-linear-primary/10 border border-linear-primary/30 text-linear-primary-hover hover:bg-linear-primary/20 transition-colors font-mono disabled:opacity-50"
            >
              {isFetchingQr && isQrModalOpen ? 'Loading…' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {error && !isQrModalOpen && (
        <p className="text-[11px] text-amber-300 font-mono">{error}</p>
      )}

      {/* ===== Large QR modal popup ===== */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={closeQrModal}
        >
          <div
            className="bg-surface-1 border border-hairline-strong rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">Connect WhatsApp Sender</span>
                <span className="text-[11px] text-ink-subtle font-mono">
                  {sender?.instanceName || 'shopi-buildathon-whatsapp'} · scan with the account to use as SENDER
                </span>
              </div>
              <button
                onClick={closeQrModal}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-hairline text-ink-subtle hover:text-ink hover:border-hairline-strong transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              {qrImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImage}
                    alt="WhatsApp QR code"
                    className="w-80 h-80 sm:w-96 sm:h-96 max-w-full rounded-lg border-4 border-white bg-white p-2"
                  />
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="text-[11px] text-ink-subtle font-mono">
                      WhatsApp → Settings → Linked Devices → Link a Device → point at this code
                    </span>
                    <span className="text-[10px] text-amber-300 font-mono">
                      ⏱ QR refreshes automatically every 20s (server rotates it ~45s).
                      {qrAgeSeconds !== null ? ` Current QR is ${qrAgeSeconds}s old.` : ''}
                    </span>
                  </div>
                  <button
                    onClick={fetchQr}
                    disabled={isFetchingQr}
                    className="px-4 py-2 text-xs font-medium rounded-md bg-linear-primary hover:bg-linear-primary-hover text-white transition-colors font-mono disabled:opacity-50"
                  >
                    {isFetchingQr ? 'Fetching fresh QR…' : 'Refresh QR Now'}
                  </button>
                  <span className="text-[10px] text-ink-tertiary font-mono">
                    The modal closes automatically once the scan completes.
                  </span>
                </>
              ) : isFetchingQr ? (
                <div className="w-80 h-80 sm:w-96 sm:h-96 flex flex-col items-center justify-center gap-3">
                  <span className="w-8 h-8 rounded-full border-2 border-ink-subtle border-t-transparent animate-spin" />
                  <span className="text-[11px] text-ink-subtle font-mono">Generating QR code…</span>
                </div>
              ) : error ? (
                <div className="w-80 sm:w-96 flex flex-col items-center gap-3 py-10">
                  <span className="text-2xl">⚠️</span>
                  <span className="text-[11px] text-amber-300 font-mono text-center">{error}</span>
                  <button
                    onClick={fetchQr}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-linear-primary/10 border border-linear-primary/30 text-linear-primary-hover hover:bg-linear-primary/20 transition-colors font-mono"
                  >
                    Try Again
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
