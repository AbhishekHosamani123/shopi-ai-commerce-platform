# Shopi Customer AI Conversational Evaluation Report

**Evaluation Timestamp:** 2026-08-26T19:05:27.577Z  
**Total Multi-Turn Dialogues Tested:** 32 (52 total interaction turns)  
**Architecture:** Conversational State Manager + Intent Classifier + Verified Tool Layer + Guardrails  

---

## 1. Executive Performance Metrics

| Evaluation Metric | Target Benchmark | Achieved Result | Evaluation Status |
| :--- | :---: | :---: | :---: |
| **Product Fact Hallucination Rate** | **0.0%** | **0.00%** | ✅ **ZERO HALLUCINATIONS** |
| **Hard Constraint Violation Rate** | **0.0%** | **0.00%** | ✅ **100% PERFECT COMPLIANCE** |
| **Intent Classification Accuracy** | $\ge 95\%$ | **100.0%** | ✅ **EXCEEDED** |
| **Multi-Turn Constraint Preservation** | $\ge 95\%$ | **100.0%** | ✅ **EXCEEDED** |
| **Truthful No-Match Handling** | **100.0%** | **100.0%** | ✅ **EXCEEDED** |
| **Genuine Ambiguity Clarification** | **100.0%** | **100.0%** | ✅ **EXCEEDED** |
| **Cart & Shopping Action Triggers** | **100.0%** | **100.0%** | ✅ **EXCEEDED** |

---

## 2. Multi-Turn Conversation Scenarios Summary

| ID | Scenario Name | Turns | Intent Match | Constraint Preservation | Fact Fidelity |
| :-: | :--- | :---: | :---: | :---: | :---: |
| **CONV-01** | Search to Color Refinement | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-02** | Search to Budget Refinement | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-03** | Search to Size Refinement | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-04** | Search to Brand Refinement | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-05** | Search to Product Comparison | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-06** | Search to Criterion Comparison | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-07** | Search to Review Comparison | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-08** | Search to Details via Pronoun | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-09** | Search to Details via Ordinal | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-10** | Search to Review Inquiry | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-11** | Search to Review Complaints Inquiry | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-12** | Search to Price Check | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-13** | Search to Size Check | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-14** | Search to Color Check | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-15** | Generic Footwear Clarification | 1 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-16** | Generic Apparel Clarification | 1 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-17** | Impossible Size & Color No-Match | 1 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-18** | Unrealistic Budget Relaxation | 1 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-19** | Out of Catalog Entity | 1 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-20** | Search to Cheaper Refinement | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-21** | Search to Highly Rated Refinement | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-22** | Search to Color Shift Refinement | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-23** | Search to Size Constraint Refinement | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-24** | Search to Cart Action | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-25** | Cart View Request | 1 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-26** | Checkout Start Request | 1 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-27** | Single Turn Full Multi-Constraint | 1 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-28** | Single Turn Material Search | 1 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-29** | Single Turn Occasion Search | 1 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-30** | Single Turn Festive Ethnic Search | 1 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-31** | Single Turn Feature Backpack Search | 1 | ✅ 100% | ✅ 100% | ✅ 100% Verified |
| **CONV-32** | Greeting to Search Hand-off | 2 | ✅ 100% | ✅ 100% | ✅ 100% Verified |

---

## 3. Sample Multi-Turn Dialogue Breakdown

### Scenario 1: Search $\rightarrow$ Progressive Refinement Flow (`CONV-01`)
1. **User:** *"Show me running shoes under ₹1000"*
   - **Shopi Intent:** `PRODUCT_SEARCH` | **Constraints:** `category: Sports-Shoes, max_price: 1000`
   - **Shopi Message:** *"I found 6 options matching your preferences: ..."*
2. **User:** *"Only black ones"*
   - **Shopi Intent:** `PRODUCT_REFINEMENT` | **Merged State:** `category: Sports-Shoes, max_price: 1000, color: black`
   - **Shopi Message:** *"I found 2 options matching your preferences: ASIAN Wonder-13 (₹599) and SPORTS-SHOE-004 (₹499) ..."*

### Scenario 2: Search $\rightarrow$ Product Comparison Flow (`CONV-05`)
1. **User:** *"Show me running shoes under 1000"*
   - **Shopi Intent:** `PRODUCT_SEARCH` (Returns ranked running shoes)
2. **User:** *"Compare the first two"*
   - **Shopi Intent:** `PRODUCT_COMPARISON`
   - **Shopi Message:** Side-by-side comparison using verified advantages, prices, and ratings without subjective speculation.

### Scenario 3: Impossible Request $\rightarrow$ Truthful No-Match (`CONV-17`)
1. **User:** *"Red formal shoes size 12 UK under ₹500"*
   - **Shopi Intent:** `PRODUCT_SEARCH` | **Status:** `NO_EXACT_MATCH`
   - **Shopi Message:** *"I couldn't find an exact match for your request (category: Formal-Shoes, max_price: 500, color: red, size: 12 UK). Here are the closest available alternatives from our catalog..."*

---

## 4. Conclusion

The Shopi customer-side AI shopping assistant backend is robust, stateful, and strictly grounded in verified database facts. All multi-turn conversation flows, constraint refinements, comparisons, and negative no-match cases pass with 0% hallucinations and 0% constraint violations.
