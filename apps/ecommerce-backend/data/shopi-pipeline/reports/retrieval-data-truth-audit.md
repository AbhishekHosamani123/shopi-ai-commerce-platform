# Shopi Retrieval Data Truth & Anti-Fabrication Audit

**Audit Generated:** 2026-08-26  
**Audited Subsystem:** Hybrid Retrieval & Fact Verification Pipeline  
**Source of Truth:** Live Supabase Database (`https://ogppkxqvfzsusdawqbzx.supabase.co`) & Canonical Datasets  

---

## 1. Traceability & Source-of-Truth Verification

Every customer-facing field exposed by the retrieval system has been audited against its authoritative source in Supabase:

| Customer-Facing Field | Target Supabase Table / Column | Canonical Source Key | Handling of Missing / Null Values | Fabrication Risk | Audit Status |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Product ID / SKU** | `shopi_products.sku` | `product_id` | Strict string match | None | ✅ **VERIFIED** |
| **Title / Name** | `shopi_products.title` | `name` / `title` | Preserves exact source title | None | ✅ **VERIFIED** |
| **Brand** | `shopi_products.brand` | `brand` | **Preserved as `null`** (Never defaulted to fake brand) | None | ✅ **VERIFIED** |
| **Category** | `shopi_products.category` | `category` | Preserved canonical category | None | ✅ **VERIFIED** |
| **Subcategory** | `shopi_products.subcategory` | `subcategory` | **Preserved as `null`** if absent | None | ✅ **VERIFIED** |
| **Selling Price** | `shopi_products.selling_price` | `selling_price` | Exact numeric INR value | None | ✅ **VERIFIED** |
| **MRP** | `shopi_products.mrp` | `mrp` | Exact numeric INR value | None | ✅ **VERIFIED** |
| **Discount %** | `shopi_products.discount_percentage` | `discount_percentage` | Mathematical derivation: `round((mrp - sp) / mrp * 100)` | None | ✅ **VERIFIED** |
| **Currency** | `shopi_products.currency` | `currency` | Always `'INR'` | None | ✅ **VERIFIED** |
| **Material & Fabric** | `shopi_product_attributes.material` | `material` / `fabric` | **Preserved as `null`** if absent in raw source | None | ✅ **VERIFIED** |
| **Color Variants** | `shopi_product_variants.color` | `variants.colors` | Only lists colors actually extracted from source | None | ✅ **VERIFIED** |
| **Size Variants** | `shopi_product_variants.size` | `variants.sizes` | Only lists sizes actually extracted from source (UK footwear preserved) | None | ✅ **VERIFIED** |
| **Image URLs** | `shopi_product_images.image_url` | `images.image_path` | Exact relative disk paths (no fake external URLs) | None | ✅ **VERIFIED** |
| **Customer Rating** | `shopi_product_review_summary.average_rating` | `rating.average` | Exact rating from source (`null` if no reviews) | None | ✅ **VERIFIED** |
| **Review Count** | `shopi_product_review_summary.review_count` | `rating.global_rating_count` | Exact count from source (`0` if no reviews) | None | ✅ **VERIFIED** |
| **Review Pros / Cons** | `shopi_product_review_summary.pros / cons` | `review_summary.pros / cons` | Array of customer quotes / aspect themes | None | ✅ **VERIFIED** |
| **Buying Advice** | `shopi_product_review_summary.recommendation_summary` | `buying_advice` | Source-derived advice (`null` if absent) | None | ✅ **VERIFIED** |

---

## 2. Suspicious / Edge-Case Field Audit

| SKU | Field | Database Value | Source Trace | Verified Factual? | Action Taken |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `FORMAL-SHOE-006` | `brand` | `null` | Review-only source file | ✅ YES | Kept as `null`. Retrieval pipeline does not claim a brand. |
| `FORMAL-SHOE-006` | `material` | `null` | Review-only source file | ✅ YES | Kept as `null`. Excluded from strict material filter matches. |
| `FORMAL-SHOE-006` | `title` | `"FORMAL-SHOE-006"` | Fallback ID | ✅ YES | Displayed as product identifier without inventing commercial titles. |
| `SPORTS-SHOE-004` | `brand` | `null` | Raw JSON lacked brand block | ✅ YES | Kept as `null`. Excluded from strict brand filter matches. |
| `SHIRT-006` | `material` | `"Linen Cotton"` | Raw JSON had disputed note | ✅ YES | Clean name in `material`; dispute analysis preserved in `additional_attributes`. |

---

## 3. Anti-Fabrication Safeguards in Retrieval Code

1. **No Fallback Brand Names:** Changed code so missing brands remain `null` instead of falling back to `'Unbranded'`.
2. **No Fallback Ratings:** Changed code so products without review summaries have `rating: null` and `review_count: 0` instead of a static 4.0 fallback.
3. **Hard Constraint Enforcement:** Products with `material: null` will NEVER match a hard filter `material = 'leather'`, preventing false claims.
4. **Verified Fact Extractor:** Implemented `getVerifiedProductFacts(productId)` to provide an immutable, factual snapshot directly from Supabase for all downstream components.
