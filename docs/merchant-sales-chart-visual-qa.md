# 📊 Merchant Sales Performance Chart — Visual QA & Technical Audit

**Target URL:** [http://localhost:3000/merchant/sales](http://localhost:3000/merchant/sales)  
**Date:** 2026-08-25  
**Status:** ✅ RESOLVED & VERIFIED

---

## 1. Root Cause Analysis

### Problem 1: Insufficient Visual Importance
* **Root Cause:** The chart canvas was restricted to `h-44` (176px total height with a tiny `130px` drawable plotting region). The surrounding Executive Posture and KPI cards overwhelmed the vertical space, making the primary analytical curve appear small and secondary.
* **Resolution:** Rebalanced the layout and increased the chart canvas to `h-72 sm:h-80 md:h-96 lg:h-[380px]` with a 960x360 SVG coordinate system (284px plotting height), signature Linear lavender stroke (`#5E6AD2`), subtle glowing area gradient, and high-visibility hierarchy.

### Problem 2: Weekly & Monthly Graph Escaping Container (Upward Line Escape)
* **Root Cause:** In [`AnalyticalChartCard.tsx`](file:///d:/Razorpay-Ai-Commerce/storefront/apps/shop/components/Merchant/v2/AnalyticalChartCard.tsx), the Y-axis maximum was hardcoded to `const maxAmount = 240000;` (₹2.4 Lakhs). In Daily mode, gross revenue was ~₹1.2L–₹2.2L, fitting under ₹2.4L. However, in **Weekly mode** aggregated gross revenue reached **₹10.25L**, and in **Monthly mode** reached **₹31.24L**.
  * For Weekly (₹10.25L): `getY(1025378)` evaluated to `20 + 130 - (1025378 / 240000) * 130` = **-405px**.
  * Because the SVG had `overflow-visible`, the negative Y coordinate drew the trajectory line 400px above the card, directly crossing through the Executive Posture Banner.
* **Resolution:** Replaced the hardcoded maximum with dynamic Y-axis scale generation (`computeNiceYScale`) that derives clean step sizes and ceilings (`step * 4 >= peak * 1.05`), strictly clamps `getY(val)` within `[paddingTop, paddingTop + chartHeight]`, and applies an SVG `<clipPath id="chartPlotClip">` as a defensive boundary.

### Problem 3: Header Text Attached to Card Border
* **Root Cause:** The outer card container specified `className="bg-surface-1 p-4.5 ..."`. Because `p-4.5` is not a standard Tailwind spacing utility and was not configured in `tailwind.config.ts`, Tailwind dropped the utility, resulting in `padding: 0px`. The text `REVENUE PERFORMANCE` and `[FACT]` badge literally touched the top and left borders.
* **Resolution:** Upgraded container padding to standard design system tokens `p-5 sm:p-6 space-y-4 sm:space-y-5`, added a clean divider (`pb-4 border-b border-hairline`), and provided proper breathing room between the title, subtitle, and interval toggle pills.

### Problem 4: Daily X-Axis Label Collision
* **Root Cause:** The SVG was rendering a `<text>` element for all 28–31 data points in the daily dataset (`chartPoints.map((pt, i) => ...)`). Across the SVG width, this caused 30 date strings to render every ~18px, creating severe text collisions and unreadable blobs.
* **Resolution:** Implemented `visibleXTicks` adaptive tick selection:
  * For `N <= 6` (Weekly/Monthly): displays all interval dates cleanly.
  * For `N > 6` (Daily): picks ~5 to 6 evenly spaced sample dates (`[0, 25%, 50%, 75%, N-1]`), always preserving the start and end dates for clear context while eliminating all text overlap.

---

## 2. Exact Files Changed

1. [`storefront/apps/shop/components/Merchant/v2/AnalyticalChartCard.tsx`](file:///d:/Razorpay-Ai-Commerce/storefront/apps/shop/components/Merchant/v2/AnalyticalChartCard.tsx)
   - Rebuilt component with dynamic mathematical scale calculation (`computeNiceYScale`).
   - Added adaptive X-axis tick generator (`visibleXTicks`) and date formatter.
   - Expanded coordinate bounds: `960x360` viewBox, 284px plotting height.
   - Added `<linearGradient id="revenueFillGrad">` and safe `<clipPath id="chartPlotClip">`.
   - Enhanced rich hover tooltip with gross revenue, baseline, volume, and delta lift.
   - Corrected card padding to `p-5 sm:p-6`.

2. [`storefront/apps/shop/app/merchant/sales/page.tsx`](file:///d:/Razorpay-Ai-Commerce/storefront/apps/shop/app/merchant/sales/page.tsx)
   - Supported direct URL interval parameters (`?interval=weekly`, `?interval=monthly`, `?interval=daily`) in `useEffect`.
   - Passed live grounded totals, baseline, and growth percentage props to `AnalyticalChartCard`.
   - Balanced vertical hierarchy between executive header, primary chart, category matrix, and sales ledger.

3. [`storefront/apps/shop/app/merchant/page.tsx`](file:///d:/Razorpay-Ai-Commerce/storefront/apps/shop/app/merchant/page.tsx)
   - Added missing `'use client'` directive.
   - Fixed missing `CopilotDrawer` import and `isCopilotOpen` state variable.

---

## 3. Daily / Weekly / Monthly Behavior Matrix

| Interval | Data Points | Max Revenue | Dynamic Y-Axis Ticks | X-Axis Density | Container Boundary Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Daily** | 28 days | ₹2.28L | `₹0`, `₹75k`, `₹1.5L`, `₹2.3L`, `₹3L` | 6 adaptive sample dates (Start, Mid, End) | ✅ 100% Contained (no overflow) |
| **Weekly** | 5 weeks | ₹10.25L | `₹0`, `₹3L`, `₹6L`, `₹9L`, `₹12L` | 5 weekly dates (`Jul 20` ... `Aug 17`) | ✅ 100% Contained (no escape) |
| **Monthly**| 2–12 months | ₹31.24L | `₹0`, `₹10L`, `₹20L`, `₹30L`, `₹40L` | Clean monthly labels (`Jul '26`, `Aug '26`) | ✅ 100% Contained (no escape) |

---

## 4. Viewport Verification & Screenshots Captured

All 15 viewport and interval combinations were captured and verified using headless Edge rendering at actual device dimensions:

| Viewport | Device Class | Daily Capture | Weekly Capture | Monthly Capture | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1440x900** | Desktop Large | `sales_chart_daily_1440x900.png` | `sales_chart_weekly_1440x900.png` | `sales_chart_monthly_1440x900.png` | ✅ PASSED |
| **1280x800** | Desktop Medium | `sales_chart_daily_1280x800.png` | `sales_chart_weekly_1280x800.png` | `sales_chart_monthly_1280x800.png` | ✅ PASSED |
| **1024x768** | Tablet Landscape | `sales_chart_daily_1024x768.png` | `sales_chart_weekly_1024x768.png` | `sales_chart_monthly_1024x768.png` | ✅ PASSED |
| **768x900** | Tablet Portrait | `sales_chart_daily_768x900.png` | `sales_chart_weekly_768x900.png` | `sales_chart_monthly_768x900.png` | ✅ PASSED |
| **390x844** | Mobile | `sales_chart_daily_390x844.png` | `sales_chart_weekly_390x844.png` | `sales_chart_monthly_390x844.png` | ✅ PASSED |

### Full Height Verification Captures:
- `full_sales_chart_daily_1440x1400.png` (Desktop Full Hierarchy)
- `full_sales_chart_weekly_1440x1400.png` (Weekly Full Hierarchy)
- `full_sales_chart_weekly_390x1600.png` (Mobile Full Hierarchy)

---

## 5. Verification Checklist

* [x] **Revenue chart stays completely inside its card:** Verified across all intervals and resolutions.
* [x] **Weekly chart does not escape upward:** Y-scale dynamically adjusts to ₹12L ceiling; path stays inside clip boundary.
* [x] **Monthly chart does not escape upward:** Y-scale dynamically adjusts to ₹40L ceiling; path stays inside clip boundary.
* [x] **Chart has substantially more visual importance:** Expanded canvas height to `h-72 sm:h-80 md:h-96 lg:h-[380px]`.
* [x] **Revenue Performance header has proper padding:** Using `p-5 sm:p-6` with standard design system scale.
* [x] **FACT badge does not touch heading:** Rendered with `gap-2.5` spacing.
* [x] **Subtitle has proper spacing:** Clear margin and dynamic descriptive copy.
* [x] **Chart has proper top/bottom breathing room:** 28px top padding and 48px bottom margin for labels.
* [x] **Daily x-axis labels do not overlap:** Adaptive tick stride keeps 6 clean non-overlapping ticks.
* [x] **Weekly labels are readable:** Clean week-commencement date labels.
* [x] **Monthly labels are readable:** Clean month/year labels.
* [x] **No page-level horizontal overflow:** Zero horizontal scrollbars across all viewports down to 390px.
* [x] **No SVG overflow:** `<clipPath>` and strict coordinate clamping prevent rendering leaks.
* [x] **No layout jump when switching periods:** Card preserves structured geometry.
* [x] **Chart remains responsive on mobile:** Responsive aspect ratio scaling.

---

## 6. TypeScript & Regression Results

### TypeScript Type-Check
```bash
npx tsc --noEmit
# Exit code: 0 (0 errors)
```

### Full Automated Regression Test Matrix
1. **Customer-Side Shopi AI & Public Commerce Suite:**
   `node storefront/apps/ecommerce-backend/node_modules/tsx/dist/cli.mjs scratch/test_customer_side_regression.ts`
   **Result:** ✅ **PASSED (100% Operational)**

2. **Merchant AI Dashboard API Layer:**
   `node storefront/apps/ecommerce-backend/node_modules/tsx/dist/cli.mjs scratch/test_merchant_dashboard_api.ts`
   **Result:** ✅ **11 PASSED | 0 FAILED**

3. **Merchant AI Copilot Engine:**
   `node storefront/apps/ecommerce-backend/node_modules/tsx/dist/cli.mjs scratch/test_merchant_ai_copilot.ts`
   **Result:** ✅ **18 PASSED | 0 FAILED**

4. **Merchant AI Action & Approval Engine:**
   `node storefront/apps/ecommerce-backend/node_modules/tsx/dist/cli.mjs scratch/test_merchant_ai_actions.ts`
   **Result:** ✅ **18 PASSED | 0 FAILED**

5. **Merchant Action Governance & Outcome Verification:**
   `node storefront/apps/ecommerce-backend/node_modules/tsx/dist/cli.mjs scratch/test_phase15_action_governance.ts`
   **Result:** ✅ **18/18 PASSED (100%)**

---

## 7. Remaining Visual Issues

* **None.** All 4 reported problems have been resolved, verified against visual captures across 5 viewports, and validated with zero regressions.
