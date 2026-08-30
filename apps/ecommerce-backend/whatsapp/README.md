# WhatsApp Delivery Channel — Evolution API Integration (Buildathon)

Local WhatsApp channel for the Shopi Merchant AI marketing campaigns, powered by
[Evolution API](https://github.com/evolution-foundation/evolution-api) using the
WhatsApp Web (Baileys) connection method. **No Meta WhatsApp Cloud API is used.**

## Architecture (hard Buildathon constraints)

```
Connected WhatsApp account (QR-scanned sender)
        ↓  Evolution API instance: shopi-buildathon-whatsapp (port 8080)
Shopi WhatsApp Service (this module)
        ↓  HARD RECIPIENT ALLOWLIST — the ONLY permitted recipients:
        ├── +91 8431406956
        └── +91 6366475180
```

- **SENDER** — whatever WhatsApp account was physically connected via QR scan
  (`WHATSAPP_SENDER_INSTANCE=shopi-buildathon-whatsapp`). Not tied to any number.
- **RECIPIENTS** — `WHATSAPP_ALLOWED_RECIPIENTS` (+918431406956, +916366475180)
  are the ONLY numbers that may receive WhatsApp messages. Every other number —
  including the rest of the customer database — is refused by the backend with
  `Recipient not in Buildathon WhatsApp allowlist.` Campaign eligibility, valid
  phone, and allowlist membership are ALL required:

```
Merchant AI selects customer → campaign eligibility → WhatsApp channel chosen
  → valid phone → Buildathon recipient allowlist → Evolution API → WhatsApp
```

The WhatsApp layer is **only a delivery channel**: audience targeting, offer
generation, margin validation and merchant approval remain owned by the
existing campaign intelligence stack, and the exact same approved offer is
delivered on both channels.

## QR connection lifecycle (important)

Evolution/Baileys rotates the pairing QR roughly every **45 seconds**. An
expired QR makes WhatsApp's scanner fail with "Could not connect". The
dashboard panel therefore:
- auto-refreshes the QR every 30s while waiting for a scan,
- shows the QR's age and a manual "Refresh QR Now" button,
- polls connection status every 5s,
- removes the QR the moment Evolution reports `state: open`.

To connect: open `/merchant/actions` → **WhatsApp Integration (Evolution API)**
→ Connect → on the phone: **WhatsApp → Settings → Linked Devices → Link a
Device** → scan within seconds of a refresh.

## Send modes (safety)

`WHATSAPP_SEND_MODE` in the backend `.env` (default `DRY_RUN`):
- **DRY_RUN** — validates and records per-recipient results without sending.
  Non-allowlisted recipients are `SKIPPED` with the allowlist reason; email
  still delivers normally.
- **LIVE** — real sends, and additionally requires `COMMUNICATION_MODE=PRODUCTION`.
  Live sends only ever go to allowlisted recipients.

## Merchant flow

1. `/merchant/actions` → **Delivery Channels** toggles above the campaign queue
   (Email ON by default; WhatsApp independent; zero channels blocks launch —
   enforced in UI and re-validated in the backend).
2. **Approve & Launch** persists `deliveryChannels` into the campaign's approval
   audit and auto-runs a dry run with per-channel results in the toast.
3. `POST /campaigns/:id/execute` runs the full pipeline writing one audit row
   per channel in `merchant_campaign_messages` — email status is never
   overwritten by WhatsApp status and vice versa. Idempotency keys prevent
   duplicate sends on re-execution.

## Backend API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/merchant/whatsapp/status` | Sender instance state + recipient allowlist + send mode (no secrets) |
| `POST /api/merchant/whatsapp/connect` | Current QR for the sender instance |
| `POST /api/merchant/whatsapp/test-send` | Controlled test message (recipient-allowlist enforced) |
| `POST /api/merchant/campaigns/:id/approve` | Accepts `deliveryChannels` (persisted in approval audit) |
| `POST /api/merchant/campaigns/:id/dry-run` | Per-channel simulated results with skip reasons |
| `POST /api/merchant/campaigns/:id/execute` | Full pipeline with per-channel audit records |

## Environment variables (backend `.env`)

```
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=shopi_evolution_local_key_2026   # must match evolution-api/.env AUTHENTICATION_API_KEY
WHATSAPP_SEND_MODE=DRY_RUN                          # DRY_RUN | LIVE (LIVE also needs COMMUNICATION_MODE=PRODUCTION)
WHATSAPP_SENDER_INSTANCE=shopi-buildathon-whatsapp  # neutral sender instance
WHATSAPP_ALLOWED_RECIPIENTS=+918431406956,+916366475180
```

## Files

- `whatsapp/` — integration layer (client, allowlist, validator, message builder, service)
- `merchant-communication/campaign-execution-service.ts` — multi-channel execution + audit
- `merchant-campaigns/campaign-builder-service.ts` — approval, allowlist-aware dry run
- `apps/shop/components/Merchant/v2/WhatsAppConnectionPanel.tsx` — QR/status panel
- `apps/shop/components/Merchant/v2/DeliveryChannelSelector.tsx` — channel toggles
