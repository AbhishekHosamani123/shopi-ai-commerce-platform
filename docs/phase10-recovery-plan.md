# 🔄 Phase 10: Disaster Recovery, Backup & Incident Response Plan

## 1. Database Backup & Retention Architecture

```mermaid
graph TD
    PG[(Live PostgreSQL Database)] -->|Continuous WAL Archiving| S3WAL[S3 WAL Logs / Point-In-Time]
    PG -->|Daily Snapshot 02:00 UTC| DailySnap[Automated Daily Physical Snapshot]
    DailySnap -->|30-Day Retention| ColdStore[Encrypted Cold Storage]
    
    subgraph "Recovery Objectives"
        RPO[Recovery Point Objective: <= 5 Minutes]
        RTO[Recovery Time Objective: <= 15 Minutes]
    end
```

### 1.1 Snapshot Cadence & Tooling
- **Daily Physical Dumps**: `pg_dump -Fc -Z 6 -d razorpay_ecommerce` scheduled via cron at `02:00 UTC`.
- **WAL Archiving**: Continuous WAL segment archiving to secure cloud object storage.
- **Retention Policy**:
  - Daily backups: 30 days.
  - Weekly backups: 90 days.
  - Monthly archives: 1 year.
  - Immutable AI Action & Purchase Order Event Ledgers: Permanent (zero TTL deletion).

---

## 2. Migration Rollback Strategy

Every schema migration script in `data/` includes explicit rollback statements:
- `data/phase9_migration.ts`: Can be rolled back by dropping `merchant_onboarding_profile`, `merchant_system_notifications`, `merchant_data_imports` and associated composite indexes.
- All migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

---

## 3. Incident Severity Levels & Response Protocols

| Severity | Definition | Target Response SLA | Action Protocol |
| :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core database down, checkout blocked, or unauthorized data mutation detected. | < 15 Minutes | 1. Activate failover read-replica / PITR restore.<br>2. Freeze external webhook listeners.<br>3. Engage security on-call. |
| **SEV-2 (High)** | Merchant AI recommendations failing or Copilot offline; customer checkout unaffected. | < 1 Hour | 1. Switch Copilot to deterministic local heuristic fallback engine.<br>2. Check GROQ / AI provider rate limits. |
| **SEV-3 (Medium)** | Background sync delayed or notification queue backlogged. | < 4 Hours | 1. Drain queue workers.<br>2. Review composite index query performance. |
