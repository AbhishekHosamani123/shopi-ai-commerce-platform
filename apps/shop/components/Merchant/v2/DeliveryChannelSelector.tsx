'use client';

import React from 'react';
import { TrustBadge } from './TrustBadge';
import { WhatsAppConnectionPanel, DeliveryChannel } from './WhatsAppConnectionPanel';

export type { DeliveryChannel };

interface WhatsAppIntegrationStatus {
  success: boolean;
  evolutionConfigured: boolean;
  sendMode: 'DRY_RUN' | 'LIVE';
  sender: { instanceName: string; state: string; isConnected: boolean; instanceExists: boolean };
  allowedRecipients: string[];
}

/**
 * Delivery-channel selector rendered directly above the campaign queue.
 * Independent Email / WhatsApp toggles; approving with zero channels is
 * blocked in this UI and re-validated in the backend.
 */
export function DeliveryChannelSelector({
  selectedChannels,
  onToggleChannel,
  whatsAppStatus,
  onWhatsAppStatusChange
}: {
  selectedChannels: DeliveryChannel[];
  onToggleChannel: (channel: DeliveryChannel) => void;
  whatsAppStatus: WhatsAppIntegrationStatus | null;
  onWhatsAppStatusChange?: (status: WhatsAppIntegrationStatus | null) => void;
}) {
  const emailOn = selectedChannels.includes('EMAIL');
  const whatsAppOn = selectedChannels.includes('WHATSAPP');
  const noneSelected = selectedChannels.length === 0;
  const senderConnected = whatsAppStatus?.sender?.isConnected ?? false;

  const channelButton = (channel: DeliveryChannel, label: string, on: boolean) => (
    <button
      key={channel}
      onClick={() => onToggleChannel(channel)}
      aria-pressed={on}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-2 border ${
        on
          ? 'bg-emerald-600/15 text-emerald-300 border-emerald-500/40 shadow-2xs'
          : 'bg-surface-2 text-ink-subtle border-hairline hover:text-ink'
      }`}
    >
      <span className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center text-[9px] font-bold ${
        on ? 'bg-emerald-500 border-emerald-400 text-surface-1' : 'border-ink-subtle text-transparent'
      }`}>
        ✓
      </span>
      {label}
    </button>
  );

  const summaryLabel = selectedChannels.length === 0
    ? 'No channel selected'
    : selectedChannels.join(' + ');

  return (
    <div className="space-y-3">
      <WhatsAppConnectionPanel onStatusChange={onWhatsAppStatusChange} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface-2 border border-hairline rounded-md p-3.5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-ink uppercase tracking-[0.4px] font-display">
              Delivery Channels
            </span>
            <TrustBadge tag="[MERCHANT CONTROL]" />
          </div>
          <div className="flex items-center gap-2">
            {channelButton('EMAIL', 'Email', emailOn)}
            {channelButton('WHATSAPP', 'WhatsApp', whatsAppOn)}
          </div>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-1.5">
          <span className={`text-[11px] font-mono font-medium ${noneSelected ? 'text-rose-300' : 'text-ink'}`}>
            Will send via: <span className="font-bold">{summaryLabel}</span>
          </span>
          {whatsAppOn && !senderConnected && (
            <span className="text-[10px] font-mono text-amber-300">
              ⚠ WhatsApp sender not connected — WhatsApp delivery will be simulated (DRY_RUN) or fail closed (LIVE).
            </span>
          )}
          {whatsAppOn && (
            <span className="text-[10px] font-mono text-ink-tertiary">
              WhatsApp delivers only to the approved Buildathon recipients; other customers are skipped.
            </span>
          )}
          {noneSelected && (
            <span className="text-[10px] font-mono text-rose-300">
              Select at least one delivery channel to approve &amp; launch.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
