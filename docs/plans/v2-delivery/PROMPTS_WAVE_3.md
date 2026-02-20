# Wave 3 — prompty do odpalenia rownolegle (Cursor x2) + Codex (Bundle 28)

Odpal te 3 prompty jednoczesnie:
- **Prompt A** -> Cursor (Agent mode, Opus) — My Work (slice)
- **Prompt B** -> Cursor (Agent mode, Opus) — Licensed Tools rename (T025)
- **Prompt C** -> Codex — Partner program (Bundle 28)

Kazdy agent pracuje na SWOIM branchu. Po skonczeniu — raport wg `PROMPT_TEMPLATE_V2.md`.

Uwaga: prompty sa zgodne z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md` (PostgreSQL, strict TS, FunnelEventName, i18n rules, nie edytujemy progress.md).

---

## PROMPT A — Cursor Agent 1 -> Wave 3A — Bundle 02 (My Work) — SLICE 02.1 (T007 + T009)

```
Jestes agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Wave 3A — Bundle 02 (My Work) — SLICE 02.1**:
- **T007 — Individual Tasks (ClickUp-like)**
- **T009 — My Ideas (Private Idea Repository)**

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj \"## T007\" i \"## T009\")

Uwaga:
- **T008** (External System Synchronization) jest **defer / post-V2** — nie robisz sync.

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-02-my-work-slice-02-1

## Krok 2: Implementacja (V2 deliverables)

### T007 — Personal tasks (V2 core)
- Osobne źródło tasków: personal tasks per user
- Widok List (ClickUp-like): podstawowe kolumny + sort/filter
- Statusy minimum: To do / In progress / Done (+ opcjonalnie Blocked)
- Quick add (1 linia + enter) + inline quick actions (status, done)
- Minimalne pola: title (req), due date, priority, notes/description, tags (opcjonalnie)
- Integracja wewnętrzna (w ograniczonym zakresie): Today/This week/Later filtr na due date

### T009 — My Ideas (V2 core)
- Prywatne repo pomyslow (title/body/tags)
- Zapis z czatu (minimum: „Save as idea” z kontekstu wiadomości)
- Lista + wyszukiwarka + tag filtering

## Kontekst / pliki startowe (podpowiedz)
- Store: `src/store/*` (zustand)
- Widoki MyWork: `src/components/MyWork/**` i routing (sprawdz `src/routes/*`)
- Chat export: `src/components/AIChat/**` (akcja \"Save as idea\")
- Backend (jesli potrzebny): `server/src/routes/*`, `server/src/services/*`

## Zasady (MUST)
- DB = PostgreSQL. Migracje SQL w `server/migrations/*.sql` pisz natywnie PostgreSQL.
- i18n: minimum EN+PL. Nowe klucze na koncu `public/locales/*/translation.json`, prefix `myWork.*`.
- Jesli dodajesz analytics events -> rozszerz `FunnelEventName` w `src/services/funnelAnalytics.ts`.
- NIE edytuj `docs/plans/v2-delivery/progress.md`.

## Testy
npm run verify:quick
Jesli dotykasz auth/policy/middleware: npm run test:protect

## Raport koncowy
Wypelnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md`.
```

---

## PROMPT B — Cursor Agent 2 -> Wave 3B — Bundle 06 (Licensed Tools) — SLICE 06.1 (T025)

```
Jestes agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Wave 3B — Bundle 06 — SLICE 06.1**:
- **T025 — Rename Module: Assessment → Licensed Tools (UI + i18n + nav)**

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj \"## T025\")

Uwaga:
- T026 i T027 to osobne, ciezsze tematy (pozniej). Teraz robimy tylko rename (T025) bez „content parity”.

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-06-licensed-tools-rename

## Krok 2: Implementacja (V2 deliverables)
- W calym UI label i copy „Assessment (module)” -> **Licensed Tools** (spojnie w nav, naglowkach, hubach)
- i18n: EN+PL minimum, dodaj klucze na koncu, prefix `licensedTools.*` albo update istniejacych
- Routing: nie psuj deep-linkow `/assessment/*`. Opcjonalnie dodaj alias `/licensed-tools` (bez duplikacji logiki, bez petli redirect)
- Help/KB: aktualizuj etykiety modułu (tam gdzie mowa o module, nie o encji danych)

## Pliki startowe (z task spec)
- `src/views/AssessmentView.tsx`
- `src/components/assessment/AssessmentModuleHub.tsx`
- `src/routes/AppRoutes.tsx`
- `src/config/helpContent.ts`

## Zasady (MUST)
- NIE zmieniaj canonical tech-route `/assessment/*` jako breaking change.
- i18n: minimum EN+PL. Nowe klucze na koncu translation.json.
- NIE edytuj `docs/plans/v2-delivery/progress.md`.

## Testy
npm run verify:quick

## Raport koncowy
Wypelnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md`.
```

---

## PROMPT C — Codex -> Bundle 28 (Partners) — T096–T098

```
Jestes agentem implementacyjnym w projekcie Consultify (B2B SaaS).
Pracujesz na SWOIM BRANCHU. Nie dotykasz main.

## Twoje zadanie
Zaimplementuj **Bundle 28 — Partners program**:
- **T096 — Partner Program Toolkit & Promotional Materials**
- **T097 — Partner Sales Certification & Incentive Training System**
- **T098 — Partner Outreach Automation & Campaign System**

Specyfikacja: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (szukaj \"## T096\", \"## T097\", \"## T098\")

## Krok 1: Branch
git switch main && git pull && git switch -c bundle-28-partners-program

## Wazne deliverables (minimum V2)
- T096: realne zasoby w Partner Portal (Resources) + realny download plikow + wersjonowanie + gating po tier + audit pobran
- T097: certyfikacja (learning path + quiz/exam) + certyfikat do pobrania + reguly odblokowania prowizji/tier
- T098: kampanie/outreach (templates, compliance, tracking) + panel admin/superadmin

## Zasady (MUST)
- DB = PostgreSQL. Migracje w `server/migrations/*.sql` pisz natywnie PostgreSQL.
- i18n: EN+PL minimum. Nowe klucze na koncu translation.json z prefixem `partners.*`.
- Jesli dodajesz analytics events -> rozszerz `FunnelEventName` w `src/services/funnelAnalytics.ts`.
- NIE edytuj `docs/plans/v2-delivery/progress.md`.

## Testy
npm run verify:quick

## Raport koncowy
Wypelnij format z `docs/plans/v2-delivery/PROMPT_TEMPLATE_V2.md`.
```

