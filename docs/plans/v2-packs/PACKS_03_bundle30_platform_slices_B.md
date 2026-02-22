## PACKS_03 — Bundle 30 (Platform P0) — Slices B (3 agentów)

### Agent A — T106 Feedback system + surfaces
- **Wejście**: gałąź od feedback (często łączona z T113), np. `bundle-30a-feedback-behavior-tracking`
- **Zakres**:
  - Merge do integracji.
  - `npm run verify:quick`
  - Sprawdzić, że feedback nie jest stubem w Gateway/routerach.

### Agent B — T113 Behavioral intelligence / journey tracking
- **Wejście**: `bundle-30a-feedback-behavior-tracking` (jeśli wspólna) lub osobna gałąź journey/analytics
- **Zakres**:
  - Merge do integracji.
  - `npm run verify:quick`
  - Sprawdzić: endpointy `/api/analytics/journey/*` są realne + tabele idempotentne (SQLite/Postgres).

### Agent C — T114 + T115 (Readiness + Sellix) “pełna integracja”
- **Wejście**: `bundle-30d-readiness-sellix`
- **Zakres**:
  - Merge do integracji.
  - `npm run verify:quick`
  - Sprawdzić: superadmin endpoints, cron recompute, inbound webhook + outbound dedupe/cooldown.

