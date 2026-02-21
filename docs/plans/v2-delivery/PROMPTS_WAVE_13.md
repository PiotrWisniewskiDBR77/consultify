# Wave 13 — 3 paczki (Cursor x3) — Payments + Feedback/Behavior + Readiness/Sellix (T109, T106+T113, T114+T115)

Odpal te 3 prompty jednocześnie (3 agentów). Każdy agent pracuje na **SWOIM branchu** i na końcu raportuje wg `PROMPT_TEMPLATE_V2.md`.

**Ostatni numer migracji (prefix cyfrowy w `server/migrations/`)**: `20260220`

Zarezerwowane numery migracji (jeśli potrzebne):
- Agent A: `20260302_*`
- Agent B: `20260303_*`
- Agent C: `20260304_*`

---

## PROMPT A — Cursor Agent 1 → Bundle 30C — T109 (Stripe billing + webhooks + dunning + SuperAdmin ops)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 30C — Payment System Integration hardening** (T109).

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T109")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-30c-stripe-payments-dunning

## Krok 2: Implementacja

### T109 — Kluczowe deliverables (V2)
- Stripe subscription billing end‑to‑end (subscribe/change/cancel) + spójne statusy w aplikacji.
- Webhooks:
  - jeden kanoniczny handler z raw body + signature verification (prod required)
  - idempotency (event.id dedupe) + retry strategy + delivery log
  - usuń/aliasuj niepodpisane/legacy webhooki tak, by w prod nie było “unsafe path”
- Dunning & recovery:
  - payment_failed → stages + komunikacja + controlled access restriction (AccessPolicy)
  - recovered → exit dunning
- SuperAdmin billing ops (guardrails + reason + audit): podgląd sub/PM/invoices + (minimal) plan change.
- Token billing purchase + idempotent credit (jeśli jeszcze nie domknięte).

### Migracje
- Jeśli dodajesz/zmieniasz DB: użyj `20260302_*`.

### Pliki startowe (grounded w repo)
- Billing API: `server/src/routes/billing/billing.routes.ts`
- Webhooks: `server/src/routes/webhooks/stripe.routes.ts` (kanoniczna raw/signature implementacja)
- Dunning: `server/src/services/dunningService.ts`
- Frontend billing: `src/components/settings/modules/BillingSubscriptionModule.tsx`, `src/services/api/billing.api.ts`
- SuperAdmin revenue: `src/views/superadmin/revenue/*`

## Zasady (MUST)
- PCI-safe: żadnych PAN/CVC w DB.
- test:protect wymagane (billing/auth/policy).
- NIE edytuj `docs/plans/v2-delivery/progress.md`

## Testy
npm run verify:quick
npm run test:protect

## Raport końcowy
Wypełnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` i ustaw Status=in_review.
```

---

## PROMPT B — Cursor Agent 2 → Bundle 30A — T106 + T113 (Feedback loop + Behavioral intelligence)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 30A — Feedback loop + Behavior intelligence foundation**:
- T106 — Advanced User Feedback System
- T113 — User Behavioral Intelligence Tracking System

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T106" i "## T113")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-30a-feedback-behavior-tracking

## Krok 2: Implementacja

### T106 — Kluczowe deliverables (V2)
- Ujednolicenie statusów feedback (kanoniczne NEW→…→ARCHIVED) i UI triage detail.
- Capture UX + metadata context (route/device/lang/theme/workspace context).
- SuperAdmin/Admin triage: lista + filtry + detail + status history + respond.
- Feature requests + voting (minimum) + routing CRITICAL (NotificationService).

### T113 — Kluczowe deliverables (V2)
- Backend ingest dla journey events:
  - `POST /api/analytics/journey/track` (+ opcjonalnie batch)
  - zapis do `journey_events` i aktualizacja `user_activation_status`
- Request logging do `api_logs` (bez PII).
- SuperAdmin: adoption metrics i churn signals muszą być realne (nie placeholder).
- Opt‑out + retention (minimum respektowanie flag).

### Migracje
- Jeśli dodajesz/zmieniasz DB: użyj `20260303_*`.

### Pliki startowe (grounded w repo)
- Feedback:
  - `server/src/routes/feedback.routes.ts`
  - `server/src/services/feedbackService.ts`
  - UI entrypoint: `src/components/Feedback/FeedbackSidePanel.tsx`
  - SuperAdmin triage: `src/views/superadmin/SuperAdminFeedbackView.tsx`
- Journey tracking:
  - frontend: `src/hooks/useJourneyTracking.ts`
  - backend: `server/src/routes/analytics-superadmin.routes.ts`, `server/src/routes/superadmin.routes.ts` (adoption endpoints)

## Zasady (MUST)
- No PII in metadata (journey events).
- Jeśli dodajesz nowe funnel events → dopisz do `src/services/funnelAnalytics.ts`.
- NIE edytuj `docs/plans/v2-delivery/progress.md`

## Testy
npm run verify:quick
npm run test:protect (jeśli dotykasz auth/policy)

## Raport końcowy
Wypełnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` i ustaw Status=in_review.
```

---

## PROMPT C — Cursor Agent 3 → Bundle 30D — T114 + T115 (Transaction readiness score + Sellix integration)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 30D — Transaction Readiness + Sellix conversion activation**:
- T114 — Transaction Readiness Scoring Algorithm
- T115 — Readiness Integration with Sellix

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T114" i "## T115")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-30d-readiness-sellix

## Krok 2: Implementacja

### T114 — Kluczowe deliverables (V2)
- Score 0–100 + tier + breakdown + blockers (explainable, stabilny, audytowalny).
- Snapshots w DB + API:
  - org drilldown + ranking
  - recompute endpoint (guardrails + reason)
- Cron/trigger recompute (minimum daily + trigger na kluczowe eventy).

### T115 — Kluczowe deliverables (V2)
- Outbound signal do Sellix po crossing do READY (idempotent + cooldown).
- Inbound webhook z Sellix:
  - signature verify + dedupe po eventId
  - zapis do analytics (`journey_events` + opcjonalnie `conversion_events`)
- SuperAdmin config: enable/disable + threshold + cooldown + test event + delivery status.

### Migracje
- Jeśli dodajesz/zmieniasz DB: użyj `20260304_*`.

### Pliki startowe (grounded w repo)
- SuperAdmin routes: `server/src/routes/superadmin.routes.ts`
- Webhook infra: `server/src/services/WebhookService.ts`, integrations routes
- Readiness inputs: journey events (T113), billing/dunning (T109), legal acceptance (T093)

## Zasady (MUST)
- Brak PII w breakdown i event payloadach.
- Wszystkie high‑risk actions: confirmation + reason + audit.
- NIE edytuj `docs/plans/v2-delivery/progress.md`

## Testy
npm run verify:quick
npm run test:protect

## Raport końcowy
Wypełnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` i ustaw Status=in_review.
```

