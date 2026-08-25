# Merchant AI Data Architecture & Schema Specification

## 1. Executive Summary

Merchant AI is designed to serve as an intelligent, autonomous commerce copilot for store merchants, business owners, and operations managers. Unlike customer-side Shopi AI (which focuses on semantic product discovery, cart recommendations, and checkout assistance), Merchant AI analyzes store health, inventory velocity, revenue growth, customer behavior, and operational risks.

This document outlines the foundation of Merchant AI Phase 1:
- The existing PostgreSQL database schema and relationships.
- The minimum supplementary analytics and inventory ledger data model.
- The deterministic historical data generation strategy (12 months of realistic e-commerce operations).
- Mathematical consistency, reconciliation equations, and security boundaries.

---

## 2. Existing Database Schema Analysis

The PostgreSQL database (`razorpay_ecommerce`) contains 24 tables. Below is the breakdown of existing core tables:

```
                                  ┌────────────────────┐
                                  │      sellers       │
                                  └─────────┬──────────┘
                                            │ 1:N
┌──────────────────┐              ┌─────────┴──────────┐              ┌────────────────────┐
│    categories    │ 1:N ──────── │      products      │ ──────── 1:N │   productimages    │
└──────────────────┘              └────┬───────┬───────┘              └────────────────────┘
                                       │       │
                                  1:N  │       │ 1:N
                        ┌──────────────┘       └──────────────┐
                        ▼                                     ▼
             ┌────────────────────┐                 ┌────────────────────┐
             │   productcolors    │                 │    productsizes    │
             └────────────────────┘                 └────────────────────┘
                        │                                     │
                        │                                     │
┌──────────────────┐    │         ┌────────────────────┐      │       ┌────────────────────┐
│      users       │────┼──────── │       orders       │◄─────┴───────┤     orderitems     │
└────────┬─────────┘    │         └────┬──────────┬────┘              └────────────────────┘
         │ 1:N          │              │ 1:N      │ 1:N
         ▼              ▼              ▼          ▼
┌──────────────────┐  ┌────────────────────┐    ┌────────────────────┐
│    addresses     │  │      shipping      │    │      payments      │
└──────────────────┘  └────────────────────┘    └────────────────────┘
```

### Table Inventory

| Table Name | Primary Key | Key Fields | Purpose in E-Commerce |
|---|---|---|---|
| `products` | `productid` | `title`, `price`, `discount`, `stock`, `categoryid`, `seller_id` | Product catalog (40 real products). |
| `productparams` | `productid` | `stars`, `views`, `sold`, `rating`, `issale`, `isdiscount` | Product operational metadata & counters. |
| `productcolors` | `colorid` | `productid`, `colorname`, `colorclass` | Color variants per product. |
| `productsizes` | `sizeid` | `productid`, `sizename`, `instock` | Size variants per product. |
| `productimages` | `imageid` | `productid`, `imglink`, `imgalt`, `isprimary` | Visual assets for products. |
| `categories` | `categoryid` | `name`, `slug`, `maincategory` | Product categorization hierarchy. |
| `sellers` | `seller_id` | `name`, `company_name`, `email`, `rating` | Merchant / vendor entity. |
| `users` | `userid` | `username`, `email`, `password`, `mobile_number`, `role` | Registered user profiles. |
| `addresses` | `addressid` | `userid`, `addresstype`, `city`, `state`, `postalcode`, `is_default` | Shipping & billing locations. |
| `orders` | `orderid` | `userid`, `totalamount`, `orderstatus`, `order_code`, `createdat` | Master order records. |
| `orderitems` | `orderitemid` | `orderid`, `productid`, `quantity`, `shippingid`, `paymentid`, `sizeid`, `colorid` | Individual line items. |
| `payments` | `paymentid` | `orderid`, `paymentmethod`, `paymentstatus`, `amount`, `transactionid`, `razorpay_*` | Payment transactions. |
| `shipping` | `shippingid` | `orderid`, `addressid`, `shippingmethod`, `shippingcost`, `trackingnumber`, `deliveredat` | Fulfillment & logistics. |
| `cartitems` | `cartitemid` | `userid`, `productid`, `quantity`, `sizeid`, `colorid` | Active shopping carts. |
| `wishlistitems` | `wishlistitemid` | `userid`, `productid`, `addedat` | Customer wishlists. |
| `coupons` | `couponid` | `code`, `discountpercentage`, `maxdiscountamount`, `minpurchaseamount` | Promotional discount rules. |
| `usercoupons` | `usercouponid` | `userid`, `couponid`, `usedat` | Coupon usage tracking. |
| `giftcards` | `cardid` | `cardcode`, `balance`, `currency`, `expirydate`, `status` | Prepaid digital balances. |

---

## 3. Merchant AI Additional Data Model (Phase 1 Extensions)

To support complete business intelligence without modifying existing customer-facing tables, the following 6 supplementary tables are introduced:

```
┌─────────────────────────┐         ┌─────────────────────────┐         ┌─────────────────────────┐
│   inventory_movements   │         │      order_returns      │         │   order_cancellations   │
├─────────────────────────┤         ├─────────────────────────┤         ├─────────────────────────┤
│ movement_id (PK)        │         │ return_id (PK)          │         │ cancellation_id (PK)    │
│ productid (FK)          │         │ orderid (FK)            │         │ orderid (FK)            │
│ sizeid (FK, opt)        │         │ orderitemid (FK)        │         │ userid (FK)             │
│ movement_type           │         │ productid (FK)          │         │ reason                  │
│ quantity                │         │ userid (FK)             │         │ refund_status           │
│ stock_before            │         │ return_reason           │         │ source                  │
│ stock_after             │         │ refund_amount           │         │ cancelled_at            │
│ reference_type          │         │ is_restocked            │         └─────────────────────────┘
│ reference_id            │         │ source                  │
│ source                  │         │ createdat / updatedat   │
│ created_at              │         └─────────────────────────┘
└─────────────────────────┘

┌─────────────────────────┐         ┌───────────────────────────────┐   ┌─────────────────────────┐
│ merchant_daily_metrics  │         │ merchant_product_daily_metrics│   │ merchant_demo_seed_meta │
├─────────────────────────┤         ├───────────────────────────────┤   ├─────────────────────────┤
│ metric_date (PK)        │         │ metric_id (PK)                │   │ seed_id (PK)            │
│ total_orders            │         │ metric_date                   │   │ seed_version            │
│ total_units_sold        │         │ productid (FK)                │   │ started_at / completed_at│
│ gross_revenue           │         │ units_sold                    │   │ total_customers         │
│ total_discounts         │         │ gross_revenue                 │   │ total_orders            │
│ total_refunds           │         │ orders_count                  │   │ total_items             │
│ net_revenue             │         │ returns_count                 │   │ total_movements         │
│ total_cancellations     │         │ refund_amount                 │   │ total_gross_revenue     │
│ total_returns           │         │ closing_stock                 │   │ status                  │
│ average_order_value     │         │ sales_velocity_7d             │   └─────────────────────────┘
│ source                  │         │ source                        │
│ created_at / updated_at │         │ created_at / updated_at       │
└─────────────────────────┘         └───────────────────────────────┘
```

### Table Details & Indexes

1. **`inventory_movements`**:
   - Primary Key: `movement_id`
   - Foreign Keys: `productid` → `products(productid)`, `sizeid` → `productsizes(sizeid)`
   - Indexes: `idx_inv_mov_product_date (productid, created_at)`, `idx_inv_mov_type (movement_type)`
   - Purpose: Immutable audit log of every stock alteration (restocks, sales, returns, adjustments).

2. **`order_returns`**:
   - Primary Key: `return_id`
   - Foreign Keys: `orderid` → `orders(orderid)`, `orderitemid` → `orderitems(orderitemid)`, `productid` → `products(productid)`, `userid` → `users(userid)`
   - Indexes: `idx_order_returns_prod (productid)`, `idx_order_returns_order (orderid)`
   - Purpose: Granular return reason tracking, refund amounts, and stock restoration indicators.

3. **`order_cancellations`**:
   - Primary Key: `cancellation_id`
   - Foreign Keys: `orderid` → `orders(orderid)`, `userid` → `users(userid)`
   - Purpose: Post-order pre-delivery cancellation logs.

4. **`merchant_daily_metrics`**:
   - Primary Key: `metric_date`
   - Indexes: `idx_merchant_daily_date (metric_date)`
   - Purpose: High-speed pre-aggregated store performance metrics for time-series analytics.

5. **`merchant_product_daily_metrics`**:
   - Primary Key: `metric_id`, Unique: `(metric_date, productid)`
   - Indexes: `idx_merchant_prod_daily (productid, metric_date)`
   - Purpose: Product-level daily velocity, revenue, returns, and inventory snapshots.

6. **`merchant_demo_seed_meta`**:
   - Primary Key: `seed_id`
   - Purpose: Stores metadata for seed execution runs, enabling idempotent re-runs and audit tracking.

---

## 4. Product Behavioral Archetypes

The 40 actual catalog items are mapped into 10 realistic business behavior profiles:

| Archetype | Behavior Description | Catalog Examples (IDs) | Demand Weight | Return Rate |
|---|---|---|---|---|
| **1. High-Demand Champion** | Consistently high sales volume, fast inventory turnover, frequent restocks. | Relaxed Short Full Sleeves (20000001), Mens Winter Leather Jacket (20000006), Running & Trekking Shoes (20000009) | 3.5x | 3.5% |
| **2. Low-Demand Steady** | Slow, steady, niche purchases; low inventory velocity. | Shampoo Conditioner Packs (20000023), Woolen Hat (30000028) | 0.4x | 2.0% |
| **3. Trending Upward** | Low sales in months 1–4, accelerating growth in months 5–12. | Smart Watch Vital Plus (20000022, 34600034), Titan 100 Ml Perfume (20000019) | 0.5x → 2.8x | 4.0% |
| **4. Winter Seasonal** | Heavy spike in Nov, Dec, Jan, Feb; modest sales in summer. | Mens Winter Leather Jackets (20000006, 20000007, 34000034, 34800034), Fleece Full-Zip Jacket (20000005, 34200034) | 0.2x (summer) → 4.5x (winter) | 5.0% |
| **5. Weekend Spike** | Significantly higher sales volume on Fridays, Saturdays, and Sundays. | Casual Shirts (20000004, 34100034), Sweatshorts (20000008, 35100034), Midi Skirts (20000003, 34300034) | 1.8x on Fri–Sun | 4.5% |
| **6. Declining** | Strong sales in the first half of the year, steadily fading demand recently. | Pocket Watch Leather Pouch (20000017, 34500034) | 2.5x → 0.3x | 3.0% |
| **7. High-Return Sizing** | Good sales volume but unusually high return rates due to sizing/fit issues. | Womens Party Wear Shoes (20000011, 34700034), Baby Fabric Shoes (30000025) | 1.6x | 13.5% |
| **8. High-Margin Luxury** | Lower volume, high price tag, high gross margin contribution. | Platinum Zircon Classic Ring (20000021), Silver Deer Heart Necklace (20000018) | 0.8x | 2.5% |
| **9. Low-Margin Volume** | High volume, low unit price, modest margin. | Girls T-Shirt (30000027), Men Hoodies T-Shirt (30000026) | 2.2x | 4.0% |
| **10. Stockout-Prone** | Strong surges that repeatedly deplete inventory before restocks arrive. | Trekking & Running Shoes Black (20000010, 34900034), Air Trekking Shoes White (20000013) | 2.4x | 4.0% |

---

## 5. Mathematical Consistency Rules

### Rule 1: Order Total Consistency
For every generated order $O$:
$$\text{TotalAmount} = \sum_{i \in \text{Items}} (\text{Quantity}_i \times \text{UnitPrice}_i) + \text{ShippingCost} + \text{PaymentFee} - \text{DiscountAmount}$$

### Rule 2: Payment Sum Consistency
For every order $O$ with payment records $P$:
$$\sum \text{Payment.Amount} = \text{Order.TotalAmount}$$

### Rule 3: Complete Inventory Reconciliation
For every product $P$ across the 12-month period:
$$\text{CurrentStock} = \text{OpeningStock} + \sum \text{Restocks} - \sum \text{SoldUnits} + \sum \text{RestockedReturns} - \sum \text{Adjustments}$$
Every transition is recorded with timestamp, before-stock, quantity delta, and after-stock.

### Rule 4: Daily Metrics Aggregation Identity
For every date $D$:
$$\text{GrossRevenue}_D = \sum_{O \in \text{Orders}_D} \text{TotalAmount}_O$$
$$\text{TotalUnitsSold}_D = \sum_{I \in \text{OrderItems}_D} \text{Quantity}_I$$
$$\text{NetRevenue}_D = \text{GrossRevenue}_D - \text{TotalRefunds}_D$$
$$\text{AOV}_D = \frac{\text{GrossRevenue}_D}{\text{TotalOrders}_D}$$

---

## 6. Time Distribution & Seasonality Strategy

The 12-month simulation spans 365 days leading up to the current date. The transaction distribution incorporates:
1. **Base Daily Volume**: Average 28–35 orders/day with Poisson-like natural variance ($\pm 25\%$).
2. **Day-of-Week Effect**:
   - Monday–Thursday: $1.0\times$
   - Friday: $1.3\times$
   - Saturday–Sunday: $1.5\times$
3. **Monthly & Seasonal Factors**:
   - **Diwali / Festive Peak (Oct–Nov)**: $+60\%$ overall traffic surge.
   - **Winter Fashion Spike (Dec–Jan)**: $+120\%$ surge for jackets, woolen apparel, and outdoor footwear.
   - **Republic Day / New Year Sales (Jan)**: Promotional volume spikes.
   - **Monsoon Dip (July–Aug)**: Lower footwear/partywear velocity.

---

## 7. Customer Modeling Strategy

A cohort of 650 synthetic customer profiles is generated with Indian geographic diversity across 25 cities (Mumbai, Bengaluru, Delhi, Hyderabad, Pune, Chennai, Jaipur, Ahmedabad, Kolkata, Kochi, etc.):
- **VIP / High-Value (10%)**: 15–30 orders/year, average basket ₹4,500+.
- **Repeat Customers (35%)**: 4–10 orders/year, consistent cadence.
- **Occasional / One-Time (45%)**: 1–2 orders/year.
- **Inactive / Churned (10%)**: Purchased heavily 8–12 months ago, zero orders in the last 120 days.

All synthetic customers are created with:
- `email LIKE '%@merchantai-demo.local'`
- `role = 'customer'`
- Deterministic addresses with proper state/pincode mappings.

---

## 8. Security Boundaries & Architectural Isolation

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER-FACING LAYER                           │
│  Storefront UI (Next.js)  ───►  /api/ai/chat  ───►  Shopi Agent        │
│  Public Endpoints: /api/products, /api/cart, /api/razorpay/*           │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                           ISOLATION BARRIER
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                        MERCHANT INTELLIGENCE LAYER                     │
│  Merchant Dashboard / APIs (Internal / Admin Authorized)               │
│  Backend Services: apps/ecommerce-backend/merchant-intelligence/       │
│  - revenue-analytics.ts                                                │
│  - product-analytics.ts                                                │
│  - inventory-analytics.ts                                              │
│  - customer-analytics.ts                                               │
│  * Strictly read-only queries with zero exposure to customer endpoints *│
└────────────────────────────────────────────────────────────────────────┘
```

1. Customer Shopi AI and public shopping routes have **no access** to merchant intelligence functions or aggregate revenue views.
2. All merchant intelligence services are strictly read-only analytical queries against PostgreSQL.
3. Seeded demo records are strictly tagged with `source = 'merchant_ai_demo_seed'`, guaranteeing that cleanup or data audits can isolate test data with 100% precision.
