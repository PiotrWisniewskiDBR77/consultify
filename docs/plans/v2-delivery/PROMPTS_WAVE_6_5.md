# Wave 6.5 — Cursor-only (równolegle do Codex Bundle 11)

**Cel:** Wykorzystać czas, gdy Codex pracuje nad Bundle 11. Dwa bundley **Cursor** w obszarach, które **nie kolidują** z Bundle 11 (Execution: people/change/comms).

Merge do main: najpierw Wave 6.5 (07, 10.2, 12, 23), potem Bundle 11 gdy Codex skończy.

Odpal te 2 prompty jednocześnie (tylko Cursor):
- **Prompt A** → Cursor Agent 1 — Bundle 12 (Benefits/KPI)
- **Prompt B** → Cursor Agent 2 — Bundle 23 (Admin Sync Hub)

---

## PROMPT A — Cursor Agent 1 → Bundle 12 — T046–T049

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 12 — Benefits / KPI / Finance mapping**:
- **T046 — Initiative ROI Tracking and Validation** (assumptions → tracking → realized vs projected)
- **T047 — Initiative‑to‑KPI Mapping and Performance Tracking** (KPI ↔ initiatives, time series)
- **T048 — KPI Impact Attribution Analysis** (contribution estimate + uncertainty, sponsor‑grade)
- **T049 — KPI to Financial Statement Mapping** (KPI ↔ BS/P&L/CF, transparent & editable)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T046" ... "## T049")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-12-benefits-kpi-finance

## Krok 2: Implementacja (V2 deliverables)

### T046 — ROI Tracking
- Assumptions → tracking → realized vs projected per inicjatywa
- Widok ROI w kontekście inicjatywy (projected vs actual)
- Sygnały gdy realized znacząco odbiega od projected

### T047 — Initiative‑to‑KPI Mapping
- Mapowanie inicjatywa ↔ KPI
- Time series: KPI w czasie w kontekście delivery
- UI: KPI ↔ initiatives w Execution / Benefits

### T048 — KPI Impact Attribution
- Estymacja wkładu inicjatyw do KPI (contribution)
- Uncertainty / confidence
- Sponsor-grade output („kto robi wynik”)

### T049 — KPI to Financial Statement
- Mapowanie KPI ↔ BS/P&L/CF
- Transparent & editable
- Uziemienie finansowe dla KPI

## Pliki startowe (podpowiedź)
- src/components/Execution/BenefitsTracker.tsx
- src/components/Initiatives/* (sekcje benefits/ROI)
- server/src/routes/initiative*, server/src/services/*

## Zasady (MUST)
- DB = PostgreSQL. Migracje w server/migrations/*.sql — natywny PostgreSQL. Ostatni numer: 562.
- i18n: EN+PL minimum. Klucze na końcu translation.json, prefix benefits.* lub kpi.*
- Jeśli dodajesz analytics events → rozszerz FunnelEventName w src/services/funnelAnalytics.ts
- NIE edytuj docs/plans/v2-delivery/progress.md
- UI: docs/ui-standards/README.md, N-mode, lucide-react

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## PROMPT B — Cursor Agent 2 → Bundle 23 — T086 + T008

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 23 — Admin Sync Hub + External system sync guardrails**:
- **T086 — Build Unified Sync Hub for External Work Systems** (integrations command center)
- **T008 — External system sync guardrails** (jeśli dotyka UI/validation)

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T086", "## T008")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-23-admin-sync-hub

## Krok 2: Implementacja (V2 deliverables)

### T086 — Unified Sync Hub
- Ekran w Admin/Settings: Integrations Hub
- Sekcje: Connected apps, Webhooks, Sync health, Permissions & scopes
- UX: ClickUp-style table, status chips, inline actions (Connect / Re-auth / Pause / Run now / Disconnect)
- Wykorzystaj istniejące: integrations.routes.ts, connectors.routes.ts, integrationHubService.ts, webhooks.routes.ts
- Status model: connected / disconnected / error / requires_reauth / pending
- Sync runs: last sync, last result, "Run now", pause/resume
- Security: scope visibility, audit log, encrypted secrets
- V2 minimal: realne integracje (Slack, Jira, Google Calendar — top 1–2 per kategoria) bez stubów

### T008 — Sync guardrails
- Walidacje przy sync (rate limits, error handling)
- Guardrails UI jeśli dotyczy (np. warnings przy błędach)

## Pliki startowe (podpowiedź)
- server/src/routes/integrations/integrations.routes.ts
- server/src/routes/integrations/connectors.routes.ts
- server/src/services/integrationHubService.ts
- server/src/routes/integrations/webhooks.routes.ts
- src/views/* (Admin/Settings routing)

## Zasady (MUST)
- DB = PostgreSQL. Migracje w server/migrations/*.sql — natywny PostgreSQL. Ostatni numer: 562.
- i18n: EN+PL minimum. Klucze na końcu translation.json, prefix admin.* lub integrations.*
- Jeśli dodajesz analytics events → rozszerz FunnelEventName w src/services/funnelAnalytics.ts
- NIE edytuj docs/plans/v2-delivery/progress.md
- UI: docs/ui-standards/README.md, N-mode, lucide-react

## Testy
npm run verify:quick

## Raport końcowy
Wypełnij format z docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md
```

---

## Merge order (gdy wszystko gotowe)

1. **Wave 6 (Cursor):** merge bundle-07, bundle-10-execution-t041-t042
2. **Wave 6.5 (Cursor):** merge bundle-12, bundle-23
3. **Bundle 11 (Codex):** merge bundle-11 gdy Codex zgłosi in_review

Konflikty: translation.json, funnelAnalytics.ts — rozwiąż ręcznie (klucze na końcu).
