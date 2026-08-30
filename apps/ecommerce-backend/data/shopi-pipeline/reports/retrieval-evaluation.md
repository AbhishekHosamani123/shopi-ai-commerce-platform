# Shopi AI Hybrid Retrieval & Ranking Evaluation Report

**Evaluation Timestamp:** 2026-08-26T18:57:04.656Z  
**Architecture:** Structured SQL Filter Pre-Filtering + Dense Vector Semantic Search + Multi-Signal Ranking  
**Total Test Queries:** 22  

---

## 1. Executive Performance Metrics

| Evaluation Metric | Target Benchmark | Achieved Result | Status |
| :--- | :---: | :---: | :---: |
| **Recall@5** | $\ge 90\%$ | **100.0%** | ✅ **EXCEEDED** |
| **Recall@10** | $\ge 95\%$ | **100.0%** | ✅ **EXCEEDED** |
| **Precision@5** | $\ge 80\%$ | **86.0%** | ✅ **EXCEEDED** |
| **Mean Reciprocal Rank (MRR)** | $\ge 0.900$ | **0.950** | ✅ **EXCEEDED** |

---

## 2. Query-by-Query Detailed Evaluation Matrix

| ID | Archetype | Customer Query | Inferred Constraints | Top-1 Candidate | P@5 | R@5 | MRR |
| :-: | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **Q01** | Category Search | *"Show me casual shirts for men"* | `category:Shirts` | **SHIRT-015** (₹399, Score: 60.3) | **100%** | ✅ | **1** |
| **Q02** | Budget Search | *"Show me shoes under ₹1000"* | `max_price:1000; category:Sneakers,Sports-Shoes,Formal-Shoes` | **SPORTS-SHOE-002** (₹494, Score: 62.3) | **100%** | ✅ | **1** |
| **Q03** | Color Search | *"I want a white sneaker"* | `category:Sneakers; color:white` | **SNEAKER-006** (₹799, Score: 61.9) | **100%** | ✅ | **1** |
| **Q04** | Brand Search | *"Show me SPARX sneakers"* | `category:Sneakers; brand:sparx` | **SNEAKER-008** (₹722, Score: 43.8) | **100%** | ✅ | **1** |
| **Q05** | Size Search | *"Running shoes size 8 UK"* | `category:Sports-Shoes; size:8 UK` | **SPORTS-SHOE-002** (₹494, Score: 75.9) | **20%** | ✅ | **1** |
| **Q06** | Occasion Search | *"I need a dress for party wear"* | `category:Dresses` | **DRESS-006** (₹749, Score: 61.7) | **100%** | ✅ | **1** |
| **Q07** | Use-Case Search | *"Find running shoes for daily walking"* | `category:Sports-Shoes` | **SPORTS-SHOE-002** (₹494, Score: 69.1) | **80%** | ✅ | **1** |
| **Q08** | Material Search | *"Pure cotton shirts for men"* | `category:Shirts` | **SHIRT-013** (₹395, Score: 60.6) | **80%** | ✅ | **1** |
| **Q09** | Discount Search | *"Show me dresses with big discounts"* | `category:Dresses` | **DRESS-009** (₹998, Score: 49.7) | **100%** | ✅ | **1** |
| **Q10** | Comparative Query | *"Which shoes are best for running?"* | `category:Sneakers,Sports-Shoes,Formal-Shoes` | **SPORTS-SHOE-002** (₹494, Score: 69.3) | **80%** | ✅ | **0.5** |
| **Q11** | Vague Natural Language | *"I need something comfortable for summer travel"* | `None` | **T-SHIRT-001** (₹396.99, Score: 51.7) | **100%** | ✅ | **1** |
| **Q12** | Multi-Constraint Query | *"I need black running shoes under ₹1000"* | `max_price:1000; category:Sports-Shoes; color:black` | **SPORTS-SHOE-001** (₹599, Score: 72.3) | **60%** | ✅ | **1** |
| **Q13** | Budget Formal Query | *"Show me formal shoes under ₹800"* | `max_price:800; category:Formal-Shoes` | **FORMAL-SHOE-006** (₹399, Score: 56.7) | **100%** | ✅ | **1** |
| **Q14** | Specific Size & Color | *"I want a white shirt in M"* | `category:Shirts; color:white; size:M` | **SHIRT-010** (₹503, Score: 72.5) | **100%** | ✅ | **1** |
| **Q15** | Feature Specific | *"Laptop backpack 15L with bottle pocket"* | `category:Bags` | **BAG-001** (₹499, Score: 65.5) | **100%** | ✅ | **1** |
| **Q16** | Office Casual Query | *"Smart casual shirt for office meetings"* | `category:Shirts` | **SHIRT-015** (₹399, Score: 64.7) | **40%** | ✅ | **0.33** |
| **Q17** | Stretch Denim Query | *"Stretchable black jeans under ₹1500"* | `max_price:1500; category:Jeans; color:black` | **JEANS-003** (₹650, Score: 65.9) | **100%** | ✅ | **1** |
| **Q18** | Ethnic Festive Query | *"Traditional kurta set for family function"* | `category:Dresses` | **DRESS-004** (₹728, Score: 62.1) | **80%** | ✅ | **1** |
| **Q19** | Budget Sneaker Query | *"Casual sneakers under ₹800"* | `max_price:800; category:Sneakers` | **SNEAKER-006** (₹799, Score: 62.7) | **100%** | ✅ | **1** |
| **Q20** | Review Quality Query | *"Which products have the best customer reviews?"* | `None` | **DRESS-004** (₹728, Score: 49.6) | **60%** | ✅ | **1** |
| **Q21** | Light Jacket Query | *"Lightweight bomber jacket for casual outings"* | `category:Jackets` | **JACKET-003** (₹799, Score: 63.2) | **100%** | ✅ | **1** |
| **Q22** | Daily Wear Jeans | *"Comfortable straight fit jeans for everyday wear"* | `category:Jeans` | **JEANS-008** (₹599, Score: 67.4) | **100%** | ✅ | **1** |

---

## 3. Explainability & Multi-Signal Breakdown Samples

### Sample 1: *"Show me casual shirts for men"*
- **Parsed Constraints:** `{"category":"Shirts"}`
- **Top Ranked Match:** `SHIRT-015` - Pinkmint Men's Cotton Blend Regular Fit Long Sleeve Button Down Shirt
- **Selling Price:** ₹399 (MRP: ₹1999)
- **Explainable Score:** **60.3 / 100**
- **Signal Attribution:** Semantic (9.1/35) + Category (15/15) + Color (5/10) + Budget (9/10) + Rating (7.2/10) + Tags (10/10)
- **Recommendation Reason:** *Matched category 'Shirts' | Matched tags: casual shirt, office casual shirt, smart casual shirt*

### Sample 2: *"Show me shoes under ₹1000"*
- **Parsed Constraints:** `{"max_price":1000,"category":["Sneakers","Sports-Shoes","Formal-Shoes"]}`
- **Top Ranked Match:** `SPORTS-SHOE-002` - BRUTON EVA Lite Sport Shoes Running Shoes for Men - White
- **Selling Price:** ₹494 (MRP: ₹1299)
- **Explainable Score:** **62.3 / 100**
- **Signal Attribution:** Semantic (11.8/35) + Category (15/15) + Color (5/10) + Budget (8.5/10) + Rating (7/10) + Tags (10/10)
- **Recommendation Reason:** *Matched category 'Sports-Shoes' | Priced at ₹494 (Under ₹1000) | Matched tags: sports shoes, running shoes, men's shoes*

### Sample 3: *"I want a white sneaker"*
- **Parsed Constraints:** `{"category":"Sneakers","color":"white"}`
- **Top Ranked Match:** `SNEAKER-006` - ASIAN Nexus-11 Men's Printed Sneakers
- **Selling Price:** ₹799 (MRP: ₹1499)
- **Explainable Score:** **61.9 / 100**
- **Signal Attribution:** Semantic (6.5/35) + Category (15/15) + Color (10/10) + Budget (7.4/10) + Rating (8/10) + Tags (10/10)
- **Recommendation Reason:** *Matched category 'Sneakers' | Available in 'white' color variant | Matched tags: men sneakers, casual sneakers, budget sneakers | Rated 4★ by verified customers*

---

## 4. Conclusion & AI Readiness

The hybrid retrieval engine successfully solves exact structured constraints (price bounds, color variants, size availability) while retrieving semantically relevant products for natural-language descriptive queries. The ranking layer is 100% deterministic, explainable, and ready for integration into the Shopi sales assistant.
