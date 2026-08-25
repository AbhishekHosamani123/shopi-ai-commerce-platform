# 🚀 Phase 10: Production Deployment & Operations Runbook

## 1. Required Production Environment Variables

| Variable | Description | Required in Production | Default / Sample |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment (`development`, `staging`, `production`) | **YES** | `production` |
| `PORT` | Express API server port | **YES** | `3500` |
| `DATABASE_URL` | PostgreSQL connection URI | **YES** | `postgres://user:pass@host:5432/razorpay_ecommerce` |
| `API_SECRET` | Merchant API secret key for server-to-server auth | **YES** | Strong random 64-char string |
| `GROQ_API_KEY` | LLM inference API key | **YES** | `gsk_...` |
| `RAZORPAY_KEY_ID` | Razorpay payment gateway key | **YES** | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay payment webhook secret | **YES** | Strong random string |

---

## 2. Production Deployment Sequence

### Step 1: Validate Environment Variables
```bash
node -e "require('./dist/utils/env_validator').validateEnvironment()"
```

### Step 2: Run Database Migrations
```bash
npx tsx data/phase9_migration.ts
```

### Step 3: Compile Backend TypeScript
```bash
cd storefront/apps/ecommerce-backend
npm run build
```

### Step 4: Compile Frontend Next.js Application
```bash
cd storefront/apps/shop
npx tsc --noEmit
npm run build
```

### Step 5: Start Production Services
```bash
# Start Backend
cd storefront/apps/ecommerce-backend
node dist/index.js

# Start Storefront
cd storefront/apps/shop
npm run start
```

### Step 6: Health & Readiness Verification
```bash
curl -f http://localhost:3500/health
curl -f -H "x-api-secret: $API_SECRET" http://localhost:3500/api/merchant/ai/readiness/checklist
```

---

## 3. Rollback Procedure

If deployment verification fails:
1. Revert container/service to previous image tag: `docker rollout rollback deployment/ecommerce-backend`.
2. Verify `/health` responds with `200 OK`.
3. If database schema was modified, execute rollback SQL migration script.
4. Notify operations team in `#engineering-deployments`.
