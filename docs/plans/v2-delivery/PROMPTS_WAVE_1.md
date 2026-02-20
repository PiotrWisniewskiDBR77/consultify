# Wave 1 — 3 prompty do odpalenia równolegle

Odpal te 3 prompty jednocześnie:
- **Prompt A** → nowe okno Cursor (Agent mode)
- **Prompt B** → drugie okno Cursor (Agent mode)
- **Prompt C** → Codex

Każdy agent pracuje na swoim branchu. Gdy skończy — zgłasza gotowość. Ty decydujesz o merge.

---

## PROMPT A — Cursor Agent 1 → Bundle 25 (Trial + upgrade mechanics)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 25 — Trial + upgrade mechanics** (taski T091, T092).

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-25-trial-upgrade

## Krok 2: Aktualizuj progress
W pliku `docs/plans/v2-delivery/progress.md`, w tabeli paczek (30), zmień wiersz Bundle 25:
- Status: `in_progress`
- Link do branch: `bundle-25-trial-upgrade`
- Notatki: data startu

## Krok 3: Implementacja

### T091 — Define Technical Trial Architecture and Access Rules
Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T091")

Kluczowe deliverables:
- Canonical policy model: orgType DEMO/TRIAL/PAID, trial timing (trial_started_at, trial_expires_at), warning levels T-7/T-3/expired
- Limity per org: max projects, users, initiatives, storage, AI daily calls + token budget
- Enforcement: AccessPolicyService / AccessTrialService / quota.middleware.ts
- TrialService: zaimplementuj convertTrialToOrg, sendTrialWarnings, processExpiredTrials (TrialCron ma przestać być "skip")
- Honest UX gates: errorCode + reason + CTA upgrade (brak "mystery blocks")
- Anti-abuse: rate limiting + audit

Pliki do edycji (istniejące):
- server/src/services/access/AccessTypes.ts
- server/src/services/access/AccessLimitService.ts
- server/src/services/access/AccessTrialService.ts
- server/src/services/access/AccessPolicyService.ts
- server/src/services/trialService.ts
- server/src/cron/TrialCron.ts
- server/src/routes/trial.routes.ts
- server/src/middleware/quota.middleware.ts

### T092 — Design Trial-to-Paid Conversion Path
Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T092")

Kluczowe deliverables:
- Upgrade triggers: trial expiry → read-only + banner + CTA, approaching limit (70-90%), blocked action → CTA
- Value messaging: każda blokada ma errorCode, copy, CTA
- Plan selection UX: ekran porównania planów
- Checkout flow: plan → payment method → confirm → instant unlock
- Subscription lifecycle: trialing/active/past_due/cancelled
- Events: upgrade_viewed, upgrade_cta_clicked, plan_selected, checkout_started/completed/failed

Pliki do edycji (istniejące):
- src/components/access/AccessBlockedModal.tsx
- src/contexts/AccessPolicyContext.tsx
- src/components/shared/BillingCore.tsx
- src/components/settings/modules/BillingSubscriptionModule.tsx
- server/src/routes/billing/billing.routes.ts

## Krok 4: Testy
Po implementacji uruchom:
npm run verify:quick

Jeśli dotyka billing/auth/policy:
npm run test:protect

## Krok 5: Commit i raport
Rób małe logiczne commity po każdym kroku.
Na koniec zaktualizuj `docs/plans/v2-delivery/progress.md`:
- Status Bundle 25: `in_review`

Napisz raport:
- Co zrobione (lista plików)
- Co wymaga manual QA (z docs/test-quality/V2_MANUAL_QA_CHECKLIST_122_TASKS.md):
  T091: DEMO/TRIAL/PAID gating honest, limity egzekwowane, CTA upgrade, admin widzi status, audit
  T092: upgrade flow działa, payment failed/dunning, UI copy jasne, webhooks, downgrade
- Czy są ryzyka / otwarte pytania

## Zasady (MUST)
- NIGDY nie rób git reset --hard ani git clean -fd
- Brak stubów/placeholderów w produkcji
- i18n: EN + PL minimum
- Nie dotykaj plików spoza scope (T091, T092)
- UI zgodne z docs/ui-standards/README.md
```

---

## PROMPT B — Cursor Agent 2 → Bundle 26 (Legal acceptance)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 26 — Legal acceptance** (task T093).

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-26-legal-acceptance

## Krok 2: Aktualizuj progress
W pliku `docs/plans/v2-delivery/progress.md`, w tabeli paczek (30), zmień wiersz Bundle 26:
- Status: `in_progress`
- Link do branch: `bundle-26-legal-acceptance`
- Notatki: data startu

## Krok 3: Implementacja

### T093 — Legal Agreements Update and User Acceptance Flow Optimization
Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj "## T093")

Kluczowe deliverables:
- Canonical document set: TOS, PRIVACY, AUP, AI_POLICY, COOKIES, DPA, SUBSCRIPTION, SLA, REFUNDS
- Versioning & publishing: superadmin publikuje nową wersję, jedna aktywna per docType, effectiveFrom, archiwum
- API endpoints (spójne):
  - GET /api/legal/active → lista aktywnych dokumentów
  - GET /api/legal/active/:docType → pełny dokument + metadata
  - GET /api/legal/my-acceptances → lista akceptacji usera
  - GET /api/legal/pending → required/pending docs
  - POST /api/legal/accept → zapis akceptacji (scope USER/ORG_ADMIN)
- Acceptance tracking: acceptedAt, IP, userAgent
- Acceptance UX: modal "Legal updates required", checkbox per doc, summary-first, expand full text
- Registration integration: jedno źródło prawdy "czy user zaakceptował"
- Legal Center (/legal) publicznie dostępny
- Data model: legal_documents + legal_document_acceptances (jak w spec)

Pliki do edycji (istniejące):
- server/src/routes/legal.routes.ts
- server/src/database/DatabaseInitializer.ts (migracja tabel)
- src/components/legal/LegalAcceptanceModal.tsx (jeśli istnieje)
- src/views/LegalDocumentView.tsx
- src/views/legal/ (folder)

Pliki do sprawdzenia:
- server/src/routes/auth.routes.ts (onboarding accept-terms integration)

## Krok 4: Testy
Po implementacji uruchom:
npm run verify:quick
npm run test:protect (dotyka auth/policy)

## Krok 5: Commit i raport
Rób małe logiczne commity po każdym kroku.
Na koniec zaktualizuj `docs/plans/v2-delivery/progress.md`:
- Status Bundle 26: `in_review`

Napisz raport:
- Co zrobione (lista plików)
- Co wymaga manual QA (z docs/test-quality/V2_MANUAL_QA_CHECKLIST_122_TASKS.md):
  T093: legal docs wersjonowane, akceptacje z metadata, /legal publiczny, zmiana wersji → re-accept, audit/export
- Czy są ryzyka / otwarte pytania

## Zasady (MUST)
- NIGDY nie rób git reset --hard ani git clean -fd
- Brak stubów/placeholderów w produkcji
- i18n: EN + PL minimum
- Nie dotykaj plików spoza scope (T093)
- UI zgodne z docs/ui-standards/README.md
```

---

## PROMPT C — Codex → Bundle 21 (Onboarding + Feature news)

```
Jesteś agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 21 — Onboarding + Feature news** (taski T068, T069).

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-21-onboarding-news

## Krok 2: Aktualizuj progress
W pliku docs/plans/v2-delivery/progress.md, w tabeli paczek (30), zmień wiersz Bundle 21:
- Status: in_progress
- Link do branch: bundle-21-onboarding-news
- Notatki: data startu

## Krok 3: Implementacja

### T068 — Onboarding and Platform Introduction System
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T068")

Kluczowe deliverables:
- Onboarding playbooks in Help (3-5 ścieżek):
  - "First 30 minutes (Owner/Trial)"
  - "Consultant quickstart"
  - "PMO quickstart"
  - Każda: kroki (checklist), deep-links do modułów, "what you'll get" + expected time
- In-app entrypoints: floating widget lub side panel, CTA po pierwszym logowaniu (dismissible)
- Progress tracking: status kroków per user (not started/in progress/done), "resume where you left off", event logging (help_events)
- Content standard: copy premium, N-style readability, zero ścian tekstu
- i18n: PL + EN minimum

Pliki do edycji (istniejące):
- src/contexts/HelpContext.tsx
- src/components/Help/HelpSidePanel.tsx
- src/components/Help/FloatingHelpWidget.tsx (jeśli istnieje)
- src/components/Onboarding/OnboardingChecklist.tsx
- config/moduleHelpContent.ts
- server/src/routes/helpChat.routes.ts (lub help.routes.ts)
- public/locales/en/translation.json
- public/locales/pl/translation.json

### T069 — Automated Feature News and Update Communication System
Specyfikacja: docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md (szukaj "## T069")

Kluczowe deliverables:
- Update publishing: title, body (markdown), tags (module), importance (low/normal/high), status draft→published
- Distribution: in-app notification + "Updates feed" (lista), email (jeśli provider), throttling
- Seen tracking: "mark as read" per user, analytics open/click
- UX: jedno miejsce "What's new" w Help/Settings, kontekstowe linki "Try it now"

Pliki do edycji:
- Nowa tabela (migracja): feature_updates lub reuse help_articles z category "update"
- server/src/routes/ (nowy lub rozszerzenie istniejącego)
- src/components/ (nowy komponent "What's new" feed)
- server/src/services/notificationService (reuse)

## Krok 4: Testy
Po implementacji uruchom:
npm run verify:quick

## Krok 5: Commit i raport
Rób małe logiczne commity po każdym kroku.
Na koniec zaktualizuj docs/plans/v2-delivery/progress.md:
- Status Bundle 21: in_review

Napisz raport:
- Co zrobione (lista plików)
- Co wymaga manual QA (z docs/test-quality/V2_MANUAL_QA_CHECKLIST_122_TASKS.md):
  T068: "First 30 minutes" prowadzi usera, nie blokuje pracy, i18n EN/PL, user onboarded → brak powtarzania, analytics
  T069: release notes w app, mark as read, email (jeśli włączony), brak spamu, historia dostępna
- Czy są ryzyka / otwarte pytania

## Zasady (MUST)
- NIGDY nie rób git reset --hard ani git clean -fd
- Brak stubów/placeholderów w produkcji
- i18n: EN + PL minimum
- Nie dotykaj plików spoza scope (T068, T069)
- UI zgodne z docs/ui-standards/README.md
```

---

## Po zakończeniu pracy agentów

Gdy agent zgłosi gotowość ("in_review"):

1. Sprawdź branch: `git switch bundle-XX-nazwa`
2. Uruchom testy: `npm run verify:quick` (i `test:protect` jeśli dotyczy)
3. Manual QA z checklisty
4. Merge: `git switch main && git pull && git merge bundle-XX-nazwa --no-edit`
5. Push: `git push origin main`
6. Zaktualizuj progress.md: Status → `merged`
