# ⚠️ Phase 16N: Pilot Incident Logging, Severity Classification & Resolution

## 1. Incident Taxonomy & Severity Classification

To ensure operational transparency, all synchronization anomalies, API errors, data validation rejections, and action failures are recorded in the `merchant_pilot_incidents` ledger.

| Severity Level | Definition | SLA / Target Response | Example |
| :--- | :--- | :--- | :--- |
| **`P1_CRITICAL`** | Financial reconciliation delta, data loss, cross-tenant leak | Immediate Auto-Halt ($0\text{ min}$) | $\Delta_{\text{Revenue}} > 0$, Token exposure |
| **`P2_HIGH`** | Sync engine failure, webhook dropped, unrecoverable 401 | $< 15\text{ minutes}$ | Shopify access token revoked |
| **`P3_MEDIUM`** | Transient HTTP 429/503 error recovered via retry | Automated Exponential Backoff | Endpoint timeout overcome on retry 2 |
| **`P4_LOW`** | Minor schema warning, unmapped non-essential field | Next scheduled sync | Missing optional product tag |

---

## 2. Incident Audit Record Structure

```json
{
  "incident_id": "inc_1724521234_ab8c",
  "merchant_id": "default_pilot_merchant",
  "severity": "P3_MEDIUM",
  "component": "SYNC",
  "error_message": "Transient HTTP 503 from external platform. Auto-resolved via retry.",
  "root_cause": "Temporary upstream platform rate throttle.",
  "resolution": "BaseMerchantConnector exponential retry backoff recovered on attempt 2.",
  "status": "RESOLVED",
  "occurred_at": "2026-08-24T17:10:00Z",
  "resolved_at": "2026-08-24T17:10:02Z"
}
```

Active incidents are exposed live on the `/merchant/pilot` dashboard under the **Incidents & Safety** tab.
