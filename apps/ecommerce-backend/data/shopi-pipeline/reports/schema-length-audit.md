# Shopi AI Schema Length & Type Constraint Diagnostic Report

**Audit Generated:** 2026-08-26T18:44:55.574Z  
**Total Violations Detected:** 30  

--- 

## 1. Summary of Identified Violations

| Table | Column | Max Allowed | Record ID | Actual Length | Classification | Recommended Fix |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| `shopi_product_attributes` | `material` | 100 | `SHIRT-006` | **171** | B | Extract clean material string: "Linen Cotton" and preserve the full JSON in additional_attributes. |
| `shopi_product_attributes` | `occasion` | 100 | `SHIRT-008` | **202** | C | Normalize to primary occasion summary (under 100 chars) and preserve detailed occasion list in additional_attributes / shopi_product_tags. |
| `shopi_product_attributes` | `material` | 100 | `SHIRT-009` | **173** | B | Extract clean material string: "80% Cotton, 20% Silk" and preserve the full JSON in additional_attributes. |
| `shopi_product_attributes` | `material` | 100 | `SHIRT-010` | **276** | B | Extract clean material string: "Cotton Blend" and preserve the full JSON in additional_attributes. |
| `shopi_product_attributes` | `material` | 100 | `SHIRT-012` | **253** | B | Extract clean material string: "Cotton Blend" and preserve the full JSON in additional_attributes. |
| `shopi_product_attributes` | `material` | 100 | `SHIRT-013` | **217** | B | Extract clean material string: "Cotton Blend" and preserve the full JSON in additional_attributes. |
| `shopi_product_attributes` | `material` | 100 | `SHIRT-014` | **140** | B | Extract clean material string: "Cotton Blend" and preserve the full JSON in additional_attributes. |
| `shopi_product_attributes` | `occasion` | 100 | `SNEAKER-006` | **109** | C | Normalize to primary occasion summary (under 100 chars) and preserve detailed occasion list in additional_attributes / shopi_product_tags. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-002:DRESS-002-REV-10` | **23** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-002:DRESS-002-REV-28` | **22** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-004:DRESS-004-REV-10` | **28** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-005:DRESS-005-REV-05` | **24** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-005:DRESS-005-REV-13` | **24** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-005:DRESS-005-REV-23` | **24** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-005:DRESS-005-REV-29` | **24** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-006:DRESS-006-REV-02` | **29** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-006:DRESS-006-REV-04` | **27** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-006:DRESS-006-REV-11` | **29** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-006:DRESS-006-REV-13` | **27** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-006:DRESS-006-REV-14` | **29** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-007:DRESS-007-REV-09` | **28** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `DRESS-007:DRESS-007-REV-11` | **28** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `JEANS-001:JEANS-001-REV-02` | **28** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `JEANS-003:JEANS-003-REV-04` | **28** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `JEANS-005:JEANS-005-REV-05` | **22** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `SHIRT-001:SHIRT-001-REV-01` | **33** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `SHIRT-001:SHIRT-001-REV-05` | **27** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `T-SHIRT-007:T-SHIRT-007-REV-02` | **25** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `T-SHIRT-008:T-SHIRT-008-REV-02` | **27** | D | Shorten value to fit column constraint. |
| `shopi_product_reviews` | `sentiment` | 20 | `T-SHIRT-008:T-SHIRT-008-REV-08` | **27** | D | Shorten value to fit column constraint. |

--- 

## 2. Detailed Breakdown of Violations

### Violation 1: `shopi_product_attributes.material` on Product `SHIRT-006`
- **Column Type Limit:** `VARCHAR(100)`
- **Offending String Length:** **171** characters
- **Classification:** B (Nested JSON object stringified instead of extracting clean material name)
- **Offending Value:**
```text
{"listed_material":"Linen Cotton","material_status":"Disputed","customer_reported_material":"Polyester","ai_display_rule":"Do not make an unqualified linen/cotton claim."}
```
- **Recommended Resolution:** Extract clean material string: "Linen Cotton" and preserve the full JSON in additional_attributes.

### Violation 2: `shopi_product_attributes.occasion` on Product `SHIRT-008`
- **Column Type Limit:** `VARCHAR(100)`
- **Offending String Length:** **202** characters
- **Classification:** C (Verbose comma-separated list exceeding 100 chars)
- **Offending Value:**
```text
Casual Wear, Daily Wear, Regular Outing, Party Wear, Wedding, Sangeet, Mehendi, Evening Wear, Work Wear, Formal Wear, Business Wear, Professional Wear, Birthday, Anniversary, Independence Day, Honeymoon
```
- **Recommended Resolution:** Normalize to primary occasion summary (under 100 chars) and preserve detailed occasion list in additional_attributes / shopi_product_tags.

### Violation 3: `shopi_product_attributes.material` on Product `SHIRT-009`
- **Column Type Limit:** `VARCHAR(100)`
- **Offending String Length:** **173** characters
- **Classification:** B (Nested JSON object stringified instead of extracting clean material name)
- **Offending Value:**
```text
{"composition":"80% Cotton, 20% Silk","cotton_percentage":80,"silk_percentage":20,"material_description":"Soft Touch Cotton Fabric","material_status":"Confirmed by listing"}
```
- **Recommended Resolution:** Extract clean material string: "80% Cotton, 20% Silk" and preserve the full JSON in additional_attributes.

### Violation 4: `shopi_product_attributes.material` on Product `SHIRT-010`
- **Column Type Limit:** `VARCHAR(100)`
- **Offending String Length:** **276** characters
- **Classification:** B (Nested JSON object stringified instead of extracting clean material name)
- **Offending Value:**
```text
{"listing_highlight":"100% Cotton","description_claim":"Poly Cotton","review_claim":"One customer reported nylon-mixed fabric","resolved_material":null,"material_status":"CONFLICTING_SOURCE_DATA","ai_rule":"Do not make an unqualified fabric-composition claim until verified."}
```
- **Recommended Resolution:** Extract clean material string: "Cotton Blend" and preserve the full JSON in additional_attributes.

### Violation 5: `shopi_product_attributes.material` on Product `SHIRT-012`
- **Column Type Limit:** `VARCHAR(100)`
- **Offending String Length:** **253** characters
- **Classification:** B (Nested JSON object stringified instead of extracting clean material name)
- **Offending Value:**
```text
{"listed_composition":"Popcorn","marketing_description":"Premium textured fabric","linen_claim":"Product is marketed as a linen shirt","verified_fiber_composition":false,"confidence":"low","ai_rule":"Do not claim 100% linen, pure linen or 100% cotton."}
```
- **Recommended Resolution:** Extract clean material string: "Cotton Blend" and preserve the full JSON in additional_attributes.

### Violation 6: `shopi_product_attributes.material` on Product `SHIRT-013`
- **Column Type Limit:** `VARCHAR(100)`
- **Offending String Length:** **217** characters
- **Classification:** B (Nested JSON object stringified instead of extracting clean material name)
- **Offending Value:**
```text
{"listed_composition":"Cotton","description_material":"Satin","marketing_description":"Premium Cotton Fabric","verified_fiber_composition":false,"confidence":"low","ai_rule":"Do not claim 100% cotton or pure cotton."}
```
- **Recommended Resolution:** Extract clean material string: "Cotton Blend" and preserve the full JSON in additional_attributes.

### Violation 7: `shopi_product_attributes.material` on Product `SHIRT-014`
- **Column Type Limit:** `VARCHAR(100)`
- **Offending String Length:** **140** characters
- **Classification:** B (Nested JSON object stringified instead of extracting clean material name)
- **Offending Value:**
```text
{"composition":"Cotton Blend","material_type":"Cotton Blend","confidence":"high","note":"The product details explicitly list Cotton Blend."}
```
- **Recommended Resolution:** Extract clean material string: "Cotton Blend" and preserve the full JSON in additional_attributes.

### Violation 8: `shopi_product_attributes.occasion` on Product `SNEAKER-006`
- **Column Type Limit:** `VARCHAR(100)`
- **Offending String Length:** **109** characters
- **Classification:** C (Verbose comma-separated list exceeding 100 chars)
- **Offending Value:**
```text
Casual, College, Everyday Use, Travel, Walking, Light Outdoor Activities, Street Fashion, Party Wear, Dancing
```
- **Recommended Resolution:** Normalize to primary occasion summary (under 100 chars) and preserve detailed occasion list in additional_attributes / shopi_product_tags.

### Violation 9: `shopi_product_reviews.sentiment` on Product `DRESS-002:DRESS-002-REV-10`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **23** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
negative_image_accuracy
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 10: `shopi_product_reviews.sentiment` on Product `DRESS-002:DRESS-002-REV-28`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **22** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
negative_colour_signal
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 11: `shopi_product_reviews.sentiment` on Product `DRESS-004:DRESS-004-REV-10`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **28** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_sizing_concern
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 12: `shopi_product_reviews.sentiment` on Product `DRESS-005:DRESS-005-REV-05`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **24** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
negative_material_signal
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 13: `shopi_product_reviews.sentiment` on Product `DRESS-005:DRESS-005-REV-13`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **24** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
negative_material_signal
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 14: `shopi_product_reviews.sentiment` on Product `DRESS-005:DRESS-005-REV-23`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **24** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
negative_material_signal
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 15: `shopi_product_reviews.sentiment` on Product `DRESS-005:DRESS-005-REV-29`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **24** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
negative_material_signal
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 16: `shopi_product_reviews.sentiment` on Product `DRESS-006:DRESS-006-REV-02`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **29** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_thinness_signal
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 17: `shopi_product_reviews.sentiment` on Product `DRESS-006:DRESS-006-REV-04`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **27** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_color_concern
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 18: `shopi_product_reviews.sentiment` on Product `DRESS-006:DRESS-006-REV-11`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **29** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_thinness_signal
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 19: `shopi_product_reviews.sentiment` on Product `DRESS-006:DRESS-006-REV-13`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **27** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_color_concern
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 20: `shopi_product_reviews.sentiment` on Product `DRESS-006:DRESS-006-REV-14`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **29** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_thinness_signal
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 21: `shopi_product_reviews.sentiment` on Product `DRESS-007:DRESS-007-REV-09`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **28** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_sleeve_concern
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 22: `shopi_product_reviews.sentiment` on Product `DRESS-007:DRESS-007-REV-11`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **28** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_dupattaconcern
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 23: `shopi_product_reviews.sentiment` on Product `JEANS-001:JEANS-001-REV-02`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **28** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_fading_concern
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 24: `shopi_product_reviews.sentiment` on Product `JEANS-003:JEANS-003-REV-04`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **28** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_length_concern
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 25: `shopi_product_reviews.sentiment` on Product `JEANS-005:JEANS-005-REV-05`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **22** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
mixed_negative_quality
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 26: `shopi_product_reviews.sentiment` on Product `SHIRT-001:SHIRT-001-REV-01`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **33** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_temperature_concern
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 27: `shopi_product_reviews.sentiment` on Product `SHIRT-001:SHIRT-001-REV-05`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **27** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
negative_temperature_signal
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 28: `shopi_product_reviews.sentiment` on Product `T-SHIRT-007:T-SHIRT-007-REV-02`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **25** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_fit_concern
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 29: `shopi_product_reviews.sentiment` on Product `T-SHIRT-008:T-SHIRT-008-REV-02`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **27** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_price_concern
```
- **Recommended Resolution:** Shorten value to fit column constraint.

### Violation 30: `shopi_product_reviews.sentiment` on Product `T-SHIRT-008:T-SHIRT-008-REV-08`
- **Column Type Limit:** `VARCHAR(20)`
- **Offending String Length:** **27** characters
- **Classification:** D (Value length exceeds column constraint)
- **Offending Value:**
```text
positive_with_style_concern
```
- **Recommended Resolution:** Shorten value to fit column constraint.

