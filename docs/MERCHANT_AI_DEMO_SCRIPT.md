# Merchant AI Demo Script — Razorpay Buildathon Evaluator Walkthrough

> **Duration:** ~12–15 minutes · **Setup:** all three services running, WhatsApp sender connected (QR via the WhatsApp Integration panel → Connect → scan the large popup)
>
> **Start at:** `http://localhost:3000/merchant` (Overview tab)
>
> **Throughout the demo, press `⌘J` / `Ctrl+J` (or the "Ask AI" button) anytime to open the AI Copilot drawer.** Every number the copilot quotes is read live from PostgreSQL — say this explicitly to the evaluator.

---

## ACT 1 — The Overview Tab: "The AI understands the whole business" (3 min)

**Open:** `/merchant`

**Say:** *"This is the Merchant AI command center. Everything on this dashboard is computed by AI from the live commerce ledger — and the copilot you see in the drawer understands every single widget on it. Let me prove that."*

**Click:** "Ask AI" (`⌘J`) → type:

> **`explain this page`**

**What the evaluator sees:** The copilot identifies the active tab and describes *exactly* what's on it — the KPI strip (with live numbers: ₹53,768 revenue, 55 orders, ₹944 AOV), the AI Daily Briefing, the Business Health Score (88/100 EXCELLENT), Audience Intelligence (25 cart abandoners · 20 checkout abandoners · 20 repeat viewers), the Opportunities Matrix, and the Priority Inbox — each tied to the widget visible on screen.

**Point at screen while narrating:** align each copilot line with the visible card.

**Follow-up questions (type these live):**

| You type | What it demonstrates |
|---|---|
| `what is my business health score` | Compose-grade answer from the health engine |
| `what changed today` | AI Daily Briefing narrative |
| `are there any alerts` | 7 live operational alerts with severities and recommended actions |

---

## ACT 2 — Tab Context Retention: "The AI follows me across the dashboard" (2 min)

**Navigate to** the **Sales Analytics** tab (sidebar).

**Say:** *"Watch — the copilot knows I changed tabs, and it remembers where we just were."*

**Type:** `what am I looking at`

**Evaluator sees:** A Sales-tab briefing — trend chart, **+38% period comparison**, top driver (*Campus Men Pod Sneakers*), AOV, refunds — **and a context bridge noting we just came from the Overview tab**, offering to connect the two views.

**Type:** `compare this month vs last month`

**Say:** *"Same drawer, new tab's data — zero re-explaining. The context travels with me."*

> **Why this matters:** page context is passed with every message (frontend derives the active tab from the URL and the backend builds the answer from that tab's live data). The conversation history also carries which tab each question came from.

---

## ACT 3 — Sales & Profitability: "Revenue is not profit" (2 min)

**On Sales Analytics**, type:

- `why did my sales change` → a diagnostic decomposition, not a guess
- `show me my top products` → ranked revenue drivers

**Navigate to Profitability & Margin.** Type: `walk me through this page`

**Say:** *"This is the tab that makes the discounts safe. Net revenue ₹51,949, COGS, refunds, shipping — contribution margin after ALL costs. Every AI discount proposal is validated against a 15% margin floor before it ever reaches approval."*

**Type:** `how much discount can I safely give`

**Evaluator sees:** the profit-safe offer answer — the maximum safe discount derived from COGS and the margin floor.

---

## ACT 4 — Audience Intelligence: "The AI knows who to talk to" (2 min)

**Navigate to Customers & Cohorts.** Type: `explain this page`

**Then the money questions — type these exactly:**

> **`how many people are there who added to cart but didn't purchase`**
> **`how many people viewed any product again and again but didn't add to cart and didn't purchase`**

**Evaluator sees:** *Observed* counts straight from the event ledger — **25 cart abandoners** and **20 repeat viewers**, each with named customers, products, prices, and last-activity dates. (Also: 20 checkout abandoners.)

**Point at the Audience Intelligence panel on the page** — the copilot's numbers match the dashboard cards exactly, because they come from the same queries.

---

## ACT 5 — The Decision Center: "AI proposes, the merchant decides" (4 min)

**Navigate to Actions & Outcomes.** Type: `walk me through this page`

**Say:** *"This is the heart of the human-in-the-loop design. Nothing executes without approval. Two hundred-ish profit-safe campaign proposals are staged — each one named for a specific customer and a specific product, with the offer already margin-validated."*

### 5a — Ask about a SPECIFIC campaign (the flagship demo moment)

**Type (point at a campaign card and use its title):**

> **`VIP RETENTION: Aarav Sharma • FUR JADEN Anti Theft Number Lock Backpack — tell me about this campaign`**

**Evaluator sees a complete dossier:** campaign ID, status, eligible/suppressed audience, the approved offer (₹25 OFF, coupon `SAVE25`), discounted price ₹674 from ₹699, post-discount margin 44.4% (floor preserved), break-even 0.084 orders, **why this exact customer was targeted** ("top-tier spend ₹3,196 across 3 orders"), and the delivery-channel options.

### 5b — Approve a campaign FROM THE CONVERSATION with channel selection

**Point at the Delivery Channels toggles above the campaign list.** Show Email ON / WhatsApp ON independently.

**Say:** *"I can also approve right here in the chat — and choose the channels in the same sentence."*

**Type:**

> **`approve campaign camp_CUST-0001_24_vip via email and whatsapp`**

**Evaluator sees:** ✅ approved, channels **EMAIL + WHATSAPP** recorded in the campaign's approval audit. *(Backend revalidates channels; zero channels = hard block.)*

### 5c — WhatsApp as a real delivery channel

**Say:** *"WhatsApp runs on a locally hosted Evolution API with a QR-paired WhatsApp Web session. Two security rules: the connected account is the only sender, and only the two approved Buildathon numbers can ever receive — everyone else is skipped with a recorded reason."*

**Proof points (fast, pick two):**
- Point at the **WhatsApp Integration** panel: sender **Connected**, disconnect/connect QR available
- Type `is whatsapp connected` in the copilot → live Evolution state
- On the **Approve & Launch** button: channels selected → dry-run executes → per-channel results (email X sent · WhatsApp Y sent/skipped) appear in the toast, and each channel keeps its own audit row in `merchant_campaign_messages`

**Say:** *"Everything is DRY_RUN by default. Real sends need an explicit double configuration flag. Nothing leaks in a demo accident."*

---

## ACT 6 — Trust & Safety close (1 min)

**Say:** *"Three design guarantees worth noting for evaluation:"*

1. **No hallucinated numbers** — every figure comes from tool/SQL outputs; answers carry trust tags (`[OBSERVED]`, `[CALCULATED]`, `[MODEL ESTIMATE]`).
2. **Margin floor is non-negotiable** — email and WhatsApp show the *same* approved offer; the banner is generated from the approved value only; a mismatch is rejected before send.
3. **Complete audit trail** — every decision, approval, and per-channel delivery result is persisted with idempotency (re-running a campaign never double-sends).

**Final flourish:** open the copilot and type `what can you do` → the full capability map.

---

## Cheat Sheet — 20 Commands That Always Work

| # | Command | Tab to demo on |
|---|---|---|
| 1 | `explain this page` | ANY tab — the flagship context demo |
| 2 | `what am I looking at` | any tab |
| 3 | `what is my business health score` | Overview |
| 4 | `what changed today` | Overview |
| 5 | `are there any alerts` | any |
| 6 | `why did my sales change` | Sales |
| 7 | `compare this month vs last month` | Sales |
| 8 | `how profitable am I` | Profitability |
| 9 | `how much discount can I safely give` | Profitability |
| 10 | `who should I target today` | Customers |
| 11 | `how many people added to cart but didn't purchase` | Customers |
| 12 | `how many people viewed products again and again but never added to cart` | Customers |
| 13 | `tell me about the campaign for Aarav Sharma` | Actions |
| 14 | `what message will you send for the VIP campaign` | Actions |
| 15 | `approve campaign camp_CUST-0001_24_vip via email and whatsapp` | Actions |
| 16 | `is whatsapp connected` | Actions |
| 17 | `what needs approval` | Actions |
| 18 | `what actions did merchant ai take` | Actions |
| 19 | `which product has the highest return rate` | Returns |
| 20 | `what should I restock` | Inventory |

---

## Q&A Prep — likely evaluator questions

- **"How does it know which page you're on?"** The frontend sends the active tab with every message; the backend builds the answer from that tab's data. History carries per-turn page tags, so context carries across navigation.
- **"Does the AI ever invent numbers?"** No — deterministic tools and SQL only; the system prompt forbids it and answers carry provenance tags.
- **"Can WhatsApp message random customers?"** No — hard recipient allowlist enforced in the backend; unauthorized numbers are refused before Evolution API is ever called.
- **"What happens if the merchant approves a 60% discount?"** The margin engine blocks anything below the 15% contribution floor before approval — approval itself revalidates.
- **"What if the AI is wrong?"** It's an advisor — every campaign, restock, and discount requires explicit human approval, and all decisions are auditable and reversible (rollback).
