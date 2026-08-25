# 📋 Phase 16A: Real Merchant Platform Connection Prerequisites

## 1. Overview & Honest Production Readiness Audit

This document details the exact technical prerequisites, credentials, OAuth/API scopes, environment variables, and webhook configurations required to connect a real third-party merchant store to the **Razorpay Merchant AI Operating System**.

> **Audit Disclosure**:
> No third-party production credentials were fabricated or simulated. If external merchant credentials are not yet provisioned in the hosting environment, the connection gate marks the provider state as `REAL_MERCHANT_BLOCKED — EXTERNAL CREDENTIALS REQUIRED`.

---

## 2. Provider Credential & Configuration Matrix

### A. Shopify Custom App / Partner Integration

| Requirement | Specification | Purpose |
| :--- | :--- | :--- |
| **Provider Type** | `SHOPIFY` | Target connector platform |
| **Store Identifier** | `{shop-name}.myshopify.com` | Merchant myshopify domain |
| **Authentication Mode** | Admin API Access Token (`X-Shopify-Access-Token`) | API Authentication |
| **Required API Scopes** | `read_products`, `read_orders`, `read_customers`, `read_inventory`, `read_returns`, `read_draft_orders` | Data Ingestion |
| **Required Env Variables**| `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET` | Backend Credential Vault |
| **API Version** | `2024-04` (or latest stable REST/GraphQL) | Admin API Target |
| **Webhook Topics** | `orders/create`, `orders/updated`, `products/update`, `inventory_levels/update` | Real-time incremental delta ingestion |
| **Webhook Endpoint URL** | `https://{domain}/api/merchant/connectors/webhooks/receive` | Public HTTPS callback |

---

### B. WooCommerce REST API Integration

| Requirement | Specification | Purpose |
| :--- | :--- | :--- |
| **Provider Type** | `WOOCOMMERCE` | Target connector platform |
| **Store URL** | `https://store.merchantdomain.com` | Base WordPress installation URL |
| **Authentication Mode** | Basic Auth (`Consumer Key` + `Consumer Secret`) | REST API v3 Auth |
| **Required API Permissions**| `Read` (or `Read/Write` with write blocked by Pilot Guard) | Orders, Products & Inventory |
| **Required Env Variables**| `WOOCOMMERCE_STORE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET` | Backend Credential Vault |
| **API Version** | WooCommerce REST API v3 (`/wp-json/wc/v3/`) | REST API Endpoints |
| **Webhook Topics** | `order.created`, `order.updated`, `product.updated` | Real-time delta updates |
| **Webhook Endpoint URL** | `https://{domain}/api/merchant/connectors/webhooks/receive` | Public HTTPS callback |

---

### C. Razorpay Payments & Orders Direct Integration

| Requirement | Specification | Purpose |
| :--- | :--- | :--- |
| **Provider Type** | `RAZORPAY_DIRECT` | Payment gateway and order ledger |
| **Authentication Mode** | API Key ID + API Key Secret (`Basic Auth`) | REST API Authentication |
| **Required Permissions**| `Payments (Read)`, `Orders (Read)`, `Refunds (Read)` | Payment Reconciliation |
| **Required Env Variables**| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Backend Credential Vault |
| **Webhook Events** | `payment.captured`, `order.paid`, `refund.processed` | Payment capture & refund tracking |
| **Webhook Endpoint URL** | `https://{domain}/api/merchant/connectors/webhooks/receive` | Webhook verification endpoint |

---

## 3. Merchant Onboarding & Action Checklist

To connect a live participating merchant store:
1. Merchant creates a Private/Custom App in Shopify Admin (or API Key in WooCommerce).
2. Grants read permissions for Orders, Products, Customers, and Inventory.
3. Obtains Admin Access Token and enters it into the encrypted input at `/merchant/data-connection` (or sets backend `.env`).
4. System executes 7-point Connection Gate evaluation.
5. Ingestion pipeline discovers store catalog size and commences initial sync with zero-delta mathematical financial reconciliation.
