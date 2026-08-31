# Production Deployment Guide — Shopi Merchant AI Platform

Complete architecture, step-by-step deployment, and verification for running
the entire platform in production:

- **Frontend (Next.js 15 storefront + Merchant AI dashboard) → Vercel**
- **Backend (Express API + Merchant AI + campaigns + WhatsApp + email) → Render Web Service**
- **PostgreSQL → Render Postgres** (schema self-bootstraps on first boot)
- **Evolution API (WhatsApp sender) → Render Web Service** (second service)

---

## 1. Architecture

```
                         ┌──────────────────────────┐
   Users / Evaluators ──▶ │      Vercel (frontend)    │
                         │  Next.js 15 production    │
                         │  • Storefront (customer)  │
                         │  • Merchant AI dashboard  │
                          └───────────┬──────────────┘
                                     │ server-side only
                                     │ (BACKEND_URL + API_SECRET)
                         ┌───────────▼──────────────┐
                         │   Render (backend API)   │
                         │  Express + Merchant AI    │
                         │  • AI copilot engine      │
                         │  • Campaign intelligence │
                         │  • Banner generator (Py)  │
                         │  • Gmail SMTP email       │
                         └───────┬───────────┬──────┘
                                 │           │
                    ┌────────────▼──┐   ┌────▼─────────────┐
                    │ Render Postgres│   │ Evolution API     │
                    │ razorpay_      │   │ (Render service 2)│
                    │ ecommerce      │   │ WhatsApp Web /   │
                    │ (self-         │   │ Baileys sender   │
                    │  bootstrapping │   │ via QR pairing   │
                    │  schema)       │   └──────────────────┘
                    └────────────────┘
```

**Key property:** the browser NEVER talks to the Render backend directly. All
frontend→backend traffic flows server-side through Next.js (server actions +
the `/api/merchant/[...path]` proxy), so there is no CORS exposure of the
backend and no backend URL in the browser bundle.

**Cold-start handling:** `RenderWakeBeacon` (mounted in the root layout)
pings `/health` on every page load — background, non-blocking, silent-failure
— waking a sleeping Render service while the user reads the page. See §7.

---

## 2. Step-by-step deployment

### Step A — Push the repo

```bash
cd D:\Razorpay-Ai-Commerce\storefront
git add -A
git commit -m "feat: production deployment hardening (Render + Vercel)"
git push origin main
```

### Step B — Render backend (do this FIRST; Vercel needs its URL)

1. Render Dashboard → **New → Blueprint** → select the repo (`AbhishekHosamani123/shopi-ai-commerce-platform`). The
   `render.yaml` at the repo root provisions:
   - `shopi-postgres` (free Postgres 16, database `razorpay_ecommerce`)
   - `shopi-backend` web service (rootDir `apps/ecommerce-backend`,
     build `npm install && npm run build:render`, start `npm run start:render`, health check `/health`)
2. Fill the `sync: false` env vars (§4 table). Secrets: generate
   `JWT_ENCRYPTION_KEY` and `API_SECRET` with Render's generator — copy the
   `API_SECRET` value, you'll paste the same one into Vercel.
3. First deploy: build installs Python+Pillow (for the email banner
   generator), npm installs, and boots. The 30+ `ensureSchema` blocks
   CREATE all tables on first API call — no migration step needed.
4. Note the service URL: `https://shopi-backend.onrender.com`.
   Verify: `curl https://shopi-backend.onrender.com/health` → `{"status":"ok"}`.

### Step C — Seed the production database

On your local machine (one-time), point at the Render DB and seed the same
canonical dataset used locally:

```powershell
cd D:\Razorpay-Ai-Commerce\storefront\apps\ecommerce-backend

# In .env, temporarily set:
#   DB_HOST=<render-postgres-host>  DB_PORT=5432
#   DB_USER=shopi_app  DB_PASS=<render-password>  DB_NAME=razorpay_ecommerce

npx tsx data/phase11b_migration.ts   # shopi_* canonical tables + demo data
```

(Or, from the Render shell: `psql $DATABASE_URL < shopi-seed.sql` if you
export one.) Then restore the local `.env`.

### Step D — Vercel frontend

1. vercel.com → **Add New → Project** → import the repo (`AbhishekHosamani123/shopi-ai-commerce-platform`).
2. **Root Directory:** `apps/shop` (Vercel auto-detects Next.js).
3. Build command: `npm run build` (default). Node 20+.
4. Set env vars (§4). `BACKEND_URL` = the Render URL from Step B, and
   `API_SECRET` = the SAME value as Render's.
5. Deploy. Verify: storefront loads, `/merchant` loads, and
   `https://<app>.vercel.app/api/merchant/overview` returns live KPIs.

### Step E — Evolution API (WhatsApp sender)

Deploy Evolution API as a **second Render web service** (or any always-on
host — see §6 for the recommended path):

1. Render → New Web Service → repo `evolution-foundation/evolution-api`
   (public), or your fork.
2. Runtime Node. Build: `npm install && npm run db:generate` (with
   `DATABASE_PROVIDER=postgresql`). It needs its own Postgres — create
   another free Render Postgres for it, and set `DATABASE_CONNECTION_URI`.
3. Set `AUTHENTICATION_API_KEY` to a strong secret.
4. After boot: create instance `shopi-buildathon-whatsapp` and pair your
   WhatsApp account by QR (see §6).
5. Put the service URL + the API key into `shopi-backend` env
   (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`) and redeploy the backend.

---

## 3. Configuration files in the repo

| File | Purpose |
|---|---|
| `render.yaml` (repo root) | Blueprint: Postgres + backend service + env wiring |
| `apps/shop/vercel.json` | Frontend framework settings |
| `apps/ecommerce-backend/package.json` | `build:render` (installs Pillow), `start:render` |
| `.env.example` (both apps) | Full documented env matrix — no secrets |

---

## 4. Environment variables

### Vercel (frontend) — all required

| Var | Value | Notes |
|---|---|---|
| `BACKEND_URL` | `https://shopi-backend.onrender.com` | server-side only; powers all server actions + merchant proxy |
| `API_SECRET` | same as Render | shared secret for backend auth |
| `NEXT_PUBLIC_DOMAIN` | `https://<app>.vercel.app` | |
| `NEXT_PUBLIC_BACKEND_URL` | Render backend URL | OPTIONAL — only used by the wake beacon; if unset the beacon uses the same-origin `/health` proxy |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `rzp_test_...` | checkout public key |
| `NEXT_PUBLIC_FRONTEND_GOOGLE_CLIENT_ID` | OAuth client id | optional auth |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | legacy | optional |

### Render (backend) — required

| Var | Value |
|---|---|
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASS` `DB_NAME` | wired automatically from the Render Postgres by `render.yaml` |
| `FRONTEND_SERVER_ORIGIN` | `https://<app>.vercel.app` (comma-separate extra preview URLs if wanted) |
| `STOREFRONT_BASE_URL` | `https://<app>.vercel.app` (email CTA links) |
| `JWT_ENCRYPTION_KEY` | random (Render generator) |
| `API_SECRET` | random — COPY to Vercel |
| `EMAIL_PROVIDER` | `GMAIL_SMTP` |
| `EMAIL` / `PASSWORD` | sender Gmail + **App Password** (Google Account → Security → 2FA → App passwords) |
| `EMAIL_TEST_RECIPIENT` | authorized recipient (TEST mode restricts sends to this address) |
| `COMMUNICATION_MODE` | `DRY_RUN` (safe) → `TEST` (controlled real emails) → `PRODUCTION` |
| `GROQ_API_KEY` / `GROQ_MODEL` | customer AI shopping agent |
| `RAZORPAY_KEY_ID` / `_SECRET` / `_WEBHOOK_SECRET` | payments |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` | WhatsApp (Step E) |
| `WHATSAPP_SEND_MODE` | `DRY_RUN` (default) / `LIVE` (also requires COMMUNICATION_MODE=PRODUCTION) |
| `WHATSAPP_SENDER_INSTANCE` | `shopi-buildathon-whatsapp` |
| `WHATSAPP_ALLOWED_RECIPIENTS` | `+918431406956,+916366475180` |
| `PYTHON_BIN` | `python3` (Render Linux) |
| `BANNER_OUTPUT_DIR` | `/tmp/generated_campaign_assets` (ephemeral; regenerated per recipient) |

Do **not** commit `.env`. Vercel/Render dashboards are the source of truth.

---

## 5. Database

- **Render Postgres** creates the database; the backend **self-bootstraps
  the schema** — 30+ services run `CREATE TABLE IF NOT EXISTS` on first use,
  so no migration files are needed.
- **Seed data** (Step C): the demo dataset (77 products, 120 customers,
  shopi_* canonical events/orders) must be seeded once into the Render DB.
  Without it, dashboards will be empty but healthy.
- Banner cache lives on the container's ephemeral disk (`/tmp/...`) — it
  regenerates per recipient per boot; the pre-baked discount base images
  (`banner-generator/banner-bases/*.png`) ship in the repo and are read-only.

---

## 6. WhatsApp setup in production

1. **Host Evolution API** (Step E). It must be reachable over HTTPS from the
   backend service: `EVOLUTION_API_URL=https://<evolution>.onrender.com`.
2. **Pair the sender:** open the Merchant dashboard → Actions tab →
   WhatsApp Integration panel → **Connect** → the large QR modal appears →
   on the phone: WhatsApp → Settings → Linked Devices → Link a Device →
   scan. The modal auto-refreshes the QR every 20s (server rotates ~45s)
   and closes automatically once connected. The scanned account becomes
   the SENDER.
3. **Verify:** panel shows ● Connected; `GET /api/merchant/whatsapp/status`
   returns `state: open`.
4. **Security model (unchanged in prod):** hard recipient allowlist
   (`WHATSAPP_ALLOWED_RECIPIENTS` = the two Buildathon numbers only);
   `WHATSAPP_SEND_MODE` defaults DRY_RUN; LIVE additionally requires
   `COMMUNICATION_MODE=PRODUCTION`. Unauthorized recipients are refused
   before Evolution is ever called.
5. If the session expires: Disconnect in the panel → Connect → rescan.
   (Render's ephemeral disk means Evolution's session data should be on its
   Postgres — configure `DATABASE_SAVE_DATA_INSTANCE=true` there.)

---

## 7. Render cold-start / wake-up — how it works

**Problem:** Render's free tier sleeps idle services after ~15 min; the
first request then pays a 30–60s cold start.

**Solution — `RenderWakeBeacon`** (`components/RenderWakeBeacon.tsx`,
mounted once in the root layout):

1. User opens any page → renders instantly (nothing blocks).
2. After the browser `load` event, the beacon fires
   `GET /health?_wake=<timestamp>` with `keepalive`, `priority: 'low'`,
   `cache: 'no-store'`.
3. The request hits either the backend directly
   (`NEXT_PUBLIC_BACKEND_URL`) or the storefront's same-origin
   `/health` route (`app/health/route.ts`), which server-side fetches
   the Render backend — waking it.
4. Failures are swallowed silently (`catch(() => {})`) — no console errors,
   no UI state, no retries.
5. Runs once per page load (a full browser load, not per Next route
   change), so it never hammers the service.

Result: by the time the user clicks anything that needs the backend, the
service is typically already awake. (First deploy's very first page hit can
still pay the cold start — optionally ping the URL once after deploying.)

**Optional extra:** an external cron (e.g. cron-job.org hitting
`/health` every 10 min) eliminates sleep entirely, but the beacon is the
zero-infrastructure default and satisfies the "wake on visit" requirement.

---

## 8. Production testing checklist

Run this after every deploy:

**Frontend**
- [ ] Storefront home loads with products
- [ ] Product page → Add to cart → checkout flow
- [ ] `/merchant` Overview renders (KPIs, Audience Intelligence panel, Health Score)
- [ ] Sidebar navigation on all 8 tabs returns 200

**Merchant AI (copilot)**
- [ ] "explain this page" on Overview → tab-aware briefing with live numbers
- [ ] "how are my sales this month" → KPIs
- [ ] "are there any alerts" → real alerts
- [ ] "how many people added to cart but didn't purchase" → 25
- [ ] "tell me about the campaign for Aarav Sharma" → full dossier
- [ ] "what can you do" → capability map

**Campaigns + channels**
- [ ] Decision Center lists campaign proposals
- [ ] Channel toggles Email/WhatsApp; both-off blocks launch
- [ ] "approve campaign <id> via email and whatsapp" → approved + audit shows channels
- [ ] Dry-run execute → per-channel results toast

**WhatsApp**
- [ ] Panel: sender Connected
- [ ] Unauthorized recipient blocked ("not in Buildathon WhatsApp allowlist")
- [ ] (LIVE only, if configured) controlled send to +916366475180 delivers

**Email**
- [ ] Controlled test send (TEST mode) delivers to `EMAIL_TEST_RECIPIENT`
- [ ] Received email: personalized CID banner (Hey <Name> + approved % OFF), product, price, coupon, CTA; no localhost URLs, no broken images

**Infrastructure**
- [ ] `curl <backend>/health` → 200
- [ ] `curl <frontend>/health` → 200 (beacon proxy wakes backend)
- [ ] Beacon fires on page load (Network tab shows `/health?_wake=...`)
- [ ] No localhost in browser console/network requests
- [ ] Render logs: no recurring errors
