# Shopi AI 65-Query Hardened Retrieval & Negative Testing Report

**Evaluation Timestamp:** 2026-08-26T19:00:53.362Z  
**Total Test Queries:** 65 (60 Positive Shopping Queries + 5 Impossible Negative Tests)  

---

## 1. Executive Performance Metrics

| Evaluation Metric | Target Benchmark | Achieved Result | Evaluation Status |
| :--- | :---: | :---: | :---: |
| **Hard Constraint Violation Rate** | **0.0%** | **0.00%** | ✅ **100% PERFECT COMPLIANCE** |
| **No-Match Accuracy (Negatives)** | **100.0%** | **100.0%** | ✅ **ZERO HALLUCINATIONS** |
| **Mean Recall@5** | $\ge 90\%$ | **100.0%** | ✅ **EXCEEDED** |
| **Mean Recall@10** | $\ge 95\%$ | **100.0%** | ✅ **EXCEEDED** |
| **Mean Precision@5** | $\ge 80\%$ | **99.0%** | ✅ **EXCEEDED** |
| **Mean Reciprocal Rank (MRR)** | $\ge 0.900$ | **0.990** | ✅ **EXCEEDED** |

---

## 2. Performance Breakdown by Query Archetype

| Archetype | Query Count | Mean P@5 | Mean R@5 | Mean MRR | Hard Violations | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Category** | 10 | 100.0% | 100.0% | 1.000 | **0** | ✅ 100% PASS |
| **Budget** | 10 | 100.0% | 100.0% | 1.000 | **0** | ✅ 100% PASS |
| **Multi-Constraint** | 10 | 100.0% | 100.0% | 1.000 | **0** | ✅ 100% PASS |
| **Color** | 5 | 100.0% | 100.0% | 1.000 | **0** | ✅ 100% PASS |
| **Size** | 5 | 100.0% | 100.0% | 1.000 | **0** | ✅ 100% PASS |
| **Brand** | 5 | 100.0% | 100.0% | 1.000 | **0** | ✅ 100% PASS |
| **Occasion** | 5 | 100.0% | 100.0% | 1.000 | **0** | ✅ 100% PASS |
| **Use-Case** | 5 | 100.0% | 100.0% | 1.000 | **0** | ✅ 100% PASS |
| **Material/Fit** | 5 | 84.0% | 100.0% | 0.850 | **0** | ✅ 100% PASS |
| **Negative Test** | 5 | N/A | N/A | N/A | **0** | 100% No-Match Handled |

---

## 3. Negative Testing Audit (Out-of-Catalog / Impossible Queries)

| ID | Query | Expected Status | Actual Status | Relaxation Provided? | Hallucination Check |
| :-: | :--- | :---: | :---: | :---: | :---: |
| **NEG-01** | *"Red formal shoes size 12 UK"* | `NO_EXACT_MATCH` | `NO_EXACT_MATCH` | YES | ✅ **0 Hallucinations** |
| **NEG-02** | *"Leather jacket under ₹300"* | `NO_EXACT_MATCH` | `NO_EXACT_MATCH` | YES | ✅ **0 Hallucinations** |
| **NEG-03** | *"Green sneakers size 12 UK"* | `NO_EXACT_MATCH` | `NO_EXACT_MATCH` | YES | ✅ **0 Hallucinations** |
| **NEG-04** | *"Ray-Ban sunglasses under ₹500"* | `NO_EXACT_MATCH` | `NO_EXACT_MATCH` | YES | ✅ **0 Hallucinations** |
| **NEG-05** | *"Formal shoes size 15 UK"* | `NO_EXACT_MATCH` | `NO_EXACT_MATCH` | YES | ✅ **0 Hallucinations** |

---

## 4. Query-by-Query Detailed Results (Sample of 20 Queries)

| ID | Type | Query | Top Candidate | P@5 | R@5 | MRR |
| :-: | :--- | :--- | :--- | :---: | :---: | :---: |
| **CAT-01** | Category | *"Show me casual shirts for men"* | **SHIRT-007** (₹270, Score: 51.9) | **100%** | ✅ | **1** |
| **CAT-02** | Category | *"I want to see polo t-shirts"* | **T-SHIRT-006** (Packs Also Available ) | **100%** | ✅ | **1** |
| **CAT-03** | Category | *"Show me men denim jeans"* | **JEANS-007** (₹779, Score: 48.5) | **100%** | ✅ | **1** |
| **CAT-04** | Category | *"Looking for casual sneakers"* | **SNEAKER-004** (₹899, Score: 60.3) | **100%** | ✅ | **1** |
| **CAT-05** | Category | *"Show me sports shoes for running"* | **SPORTS-SHOE-002** (₹494, Score: 65) | **100%** | ✅ | **1** |
| **CAT-06** | Category | *"I need formal shoes for office"* | **FORMAL-SHOE-003** (₹569, Score: 61.7) | **100%** | ✅ | **1** |
| **CAT-07** | Category | *"Show me ethnic dresses and kurta sets"* | **DRESS-003** (₹699, Score: 50.5) | **100%** | ✅ | **1** |
| **CAT-08** | Category | *"Show me lightweight jackets"* | **JACKET-003** (₹799, Score: 49) | **100%** | ✅ | **1** |
| **CAT-09** | Category | *"Looking for a laptop backpack"* | **BAG-003** (₹525, Score: 58.3) | **100%** | ✅ | **1** |
| **CAT-10** | Category | *"Show me all footwear options"* | **SNEAKER-005** (₹999, Score: 45.5) | **100%** | ✅ | **1** |
| **BUD-01** | Budget | *"Show me shirts under ₹500"* | **SHIRT-001** (₹399, Score: 45.4) | **100%** | ✅ | **1** |
| **BUD-02** | Budget | *"Shoes below ₹1000"* | **SPORTS-SHOE-002** (₹494, Score: 53.9) | **100%** | ✅ | **1** |
| **BUD-03** | Budget | *"Sneakers under ₹800"* | **SNEAKER-003** (₹699, Score: 49.1) | **100%** | ✅ | **1** |
| **BUD-04** | Budget | *"Jeans under 1000"* | **JEANS-010** (₹645, Score: 47.6) | **100%** | ✅ | **1** |
| **BUD-05** | Budget | *"Formal shoes less than ₹600"* | **FORMAL-SHOE-003** (₹569, Score: 59.1) | **100%** | ✅ | **1** |
| **BUD-06** | Budget | *"Jackets under 1000"* | **JACKET-001** (₹648, Score: 45.6) | **100%** | ✅ | **1** |
| **BUD-07** | Budget | *"Backpacks below ₹600"* | **BAG-001** (₹499, Score: 45.4) | **100%** | ✅ | **1** |
| **BUD-08** | Budget | *"Kurta sets under 800"* | **DRESS-004** (₹728, Score: 47) | **100%** | ✅ | **1** |
| **BUD-09** | Budget | *"T-shirts between 300 and 600"* | **T-SHIRT-001** (₹396.99, Score: 48.1) | **100%** | ✅ | **1** |
| **BUD-10** | Budget | *"Sneakers around 800"* | **SNEAKER-005** (₹999, Score: 51.1) | **100%** | ✅ | **1** |

---

## 5. Remaining Weaknesses & Optimization Notes

1. **Empty Categories in Raw Dataset:** Belts and Caps currently have 0 records because their raw source files are 0-byte placeholders. A query for "Belts" correctly triggers `NO_EXACT_MATCH` until raw data is supplied.
2. **Footwear Brand Exclusivity:** `SPORTS-SHOE-004` has no brand name in raw JSON; queries for brand-specific sports shoes strictly exclude it to preserve 0% violation rate.
