# 🛡️ Phase 14: Data Quality Gates & Reconciliation

## 1. Data Quality Gate Rules

| Violation Trigger | Action Taken | Reason Logged |
| :--- | :--- | :--- |
| **Missing Product SKU / Title** | Row Rejected | Cannot anchor analytics without stable external identifier. |
| **Negative Price ($\le 0$)** | Row Rejected | Prevents corrupted financial averages and margin inversion. |
| **Duplicate External IDs** | Deduplicated / Updated | Enforces strict idempotent data storage. |
| **Formula Injections ($=$, $+$, $-$, $@$)** | Escaped with `'` | Neutralizes spreadsheet execution vulnerabilities. |

---

## 2. Ingestion Reconciliation Matrix

- **Source Revenue** $=$ $\sum(\text{CSV Total Amount})$
- **Imported Database Revenue** $=$ $\sum(\text{merchant\_canonical\_orders.total\_amount})$
- **Reconciliation Status**: `RECONCILED` ($0.00$ delta) or `RECONCILIATION_FAILED`.
