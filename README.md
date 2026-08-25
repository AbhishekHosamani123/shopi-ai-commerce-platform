# ⚡ Razorpay AI Commerce

> Production-Quality Autonomous AI Commerce Platform built for the Razorpay Hackathon.
> Combines **Next.js 15 Storefront**, **Express.js API**, **Prisma ORM**, **PostgreSQL**, **Redis**, the **Agorio AI Shopping Agent SDK**, and **Merchant Intelligence Hub**.

---

## 🏛️ Target Architecture

```
                    ┌────────────────────────────────────────┐
                    │      Next.js 15 Storefront             │
                    │   (Razorpay AI Commerce Branding)      │
                    │   - Product Discovery & Search         │
                    │   - Interactive AI Shopping Agent UI   │
                    │   - Cart, Checkout & Order Tracking    │
                    │   - Customer Account & Admin Dashboard │
                    └───────────────────┬────────────────────┘
                                        │ (HTTP / Server Actions / SSE)
                                        ▼
                    ┌────────────────────────────────────────┐
                    │      Express.js Commerce API           │
                    │   - REST Endpoints (Auth, Cart, Orders)│
                    │   - Agorio AI Shopping Agent Adapter   │
                    │   - Analytics Event Dispatcher         │
                    │   - Admin Management Endpoints         │
                    └───────────────┬────────────────┬───────┘
                                    │                │
                    ┌───────────────┴────┐     ┌─────┴──────────────┐
                    ▼                    │     ▼                    │
             ┌──────────────┐            │  ┌──────────────┐        │
             │   Prisma     │            │  │    Redis     │        │
             │     ORM      │            │  │ Cache/Session│        │
             └──────┬───────┘            │  └──────────────┘        │
                    │                    │                          │
                    ▼                    │                          │
             ┌──────────────┐            │                          │
             │ PostgreSQL   │            │                          │
             │ Commerce DB  │            │                          │
             └──────┬───────┘            │                          │
                    │                    │                          │
                    ▼                    ▼                          │
        ┌────────────────────────┐  ┌────────────────────┐          │
        │ Merchant Intelligence  │  │  Agorio AI Agent   │◄─────────┘
        │ Streamlit AI Analytics │  │  Shopping Engine   │
        └────────────────────────┘  └────────────────────┘
```

---

## 📦 Project Structure

```text
D:\Razorpay-Ai-Commerce\
├── storefront/
│   ├── apps/
│   │   ├── backend/            # Express.js + Prisma + PostgreSQL + Redis commerce API
│   │   └── storefront/         # Next.js 15 App Router Customer Storefront with AI Widget
│   └── package.json            # Monorepo root
│
├── agorio/                     # Autonomous AI shopping agent SDK (TypeScript / LLM)
│
└── merchant-intelligence/      # Merchant analytics, insights, and growth engine (Streamlit)
```

---

## 🚀 Getting Started (Windows PowerShell)

### Prerequisites:
- **Node.js** v20+ / v22+
- **pnpm** v10+
- **PostgreSQL** running on `localhost:5432`

---

### Step 1: Database Setup & Seeding

```powershell
cd D:\Razorpay-Ai-Commerce\storefront\apps\backend

# 1. Sync Prisma schema with PostgreSQL
npx prisma db push

# 2. Seed 32 realistic products across 5 categories + default users + coupons
npx tsx prisma/seed.ts
```

---

### Step 2: Start the Express Commerce API Backend (Port 9000)

```powershell
cd D:\Razorpay-Ai-Commerce\storefront\apps\backend
pnpm dev
```
*API Base URL:* `http://localhost:9000/api`  
*Healthcheck:* `http://localhost:9000/health`  
*Analytics CSV Export:* `http://localhost:9000/api/analytics/export.csv`

---

### Step 3: Start the Next.js Storefront (Port 8000)

```powershell
cd D:\Razorpay-Ai-Commerce\storefront\apps\storefront
pnpm dev
```
*Storefront URL:* `http://localhost:8000/in`

---

### Step 4: Start Merchant Intelligence Dashboard (Optional)

```powershell
cd D:\Razorpay-Ai-Commerce\merchant-intelligence
streamlit run app.py
```

---

## 🔑 Default Test Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@test.com` | `supersecret` |
| **Customer** | `customer@test.com` | `password123` |

---

## 🛍️ Supported Shopping Workflow

1. **Product Discovery:** Browse 32 curated tech products across 5 categories.
2. **AI Shopping Agent:** Click the floating **🤖 AI Shopping Agent** button or type prompts like *"Find black ANC headphones under ₹5,000"*.
3. **Cart & Coupons:** Add multiple variants to cart and apply promo codes like `RAZORPAY10` or `WELCOME500`.
4. **Direct Checkout:** Complete checkout with instant 256-bit SSL verified mock payment and real-time order confirmation.
5. **Merchant Intelligence Integration:** Commerce events (`product_viewed`, `cart_added`, `order_created`) automatically stream to the analytics engine.
