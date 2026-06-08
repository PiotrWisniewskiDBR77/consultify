# Program naprawczy — QA Session 1+2 (2026-06-08)

Cel: usunąć blokery przed rolloutem VTS (prod). Poprawki kodu wdrażane od razu; migracje DB przygotowane jako pliki, **nie aplikowane na prod bez zgody** (prod = brak backupu).

## Zakres i status
| FIX | Bug | Warstwa | Plik | Ryzyko | Status |
|-----|-----|---------|------|--------|--------|
| FIX-1 | BUG-18 wyciek PII | server | `routes/v8/execution-control.routes.ts` | niskie | wdrożone |
| FIX-2 | BUG-14 self-DoS 429 | front | `src/services/api.ts` | niskie | wdrożone |
| FIX-3 | AI ModelRouter integer=boolean | server | `services/ai/modelRouter.ts` | niskie | wdrożone |
| FIX-4 | BUG-22 crash My Work | front | `components/MyWork/Home/useHomeData.ts` | niskie | wdrożone |
| FIX-5 | BUG-21 web-vitals 404 | server | `routes/analytics.routes.ts` | niskie | wdrożone |
| FIX-6 | drift schematu DB | DB | `migrations/2026-06-08-qa-schema-drift.sql` | **wysokie (prod)** | przygotowane, NIE zaaplikowane |
| FIX-7 | weryfikacja | — | tsc/build | — | ✅ czyste (0 nowych błędów) |

**Weryfikacja (tsc --noEmit):** backend ma 4644 wcześniej istniejących błędów (repo buduje przez `tsc --noCheck`; wzorzec „No overload" na każdej trasie) — moje zmiany **nie dodały żadnego nowego** błędu (import `requirePermission` OK, modelRouter czysty, analytics/execution-control tylko istniejący wzorzec). Frontend: 4 wcześniej istniejące błędy w niezwiązanych plikach; `api.ts` i `useHomeData.ts` **czyste**. Zmiany NIE zacommitowane (czekam na decyzję).

## Druga tura (wykonana w nocy 2026-06-08)
| FIX | Bug | Warstwa | Plik | Status |
|-----|-----|---------|------|--------|
| FIX-8 | BUG-16 mobile i18n | front | `public/locales/{en,pl}/translation.json` | ✅ dodane klucze `sidebar.module3_1` (Initiatives/Inicjatywy), `common.more` (More/Więcej) — bez regresji PL |
| FIX-9 | BUG-02/15 voice 403 (część frontowa) | front | `src/contexts/OrgContext.tsx` | ✅ guard czyszczący nieaktualny `consultify_current_org_id`, gdy nie ma ważnej org |

### FIX-8 szczegóły
Tester widział „Inicjatywy"/„Więcej" (PL) obok „My Work"/„Licensed Tools" (EN), bo klucze `sidebar.module3_1` i `common.more` **nie istniały w żadnym locale** → wszędzie wpadał polski `defaultValue` z kodu. Dodane do obu plików (EN ang., PL pol.). Default w kodzie pozostawiony jako ostatni fallback.

### FIX-9 szczegóły
Ustalenie (analiza kodu): **nie ma rozbieżności voice vs czat tekstowy** — obie ścieżki używają tego samego `useConversationStore.createConversation` → nagłówek `x-org-context` z `localStorage['consultify_current_org_id']`. 403 `ORG_MEMBERSHIP_REVOKED` powstaje serwerowo, gdy rozwiązany org (z tokenu lub nieaktualny z localStorage) nie ma ACTIVE membership. Voice pojawia się jako pierwszy, bo wymusza utworzenie rozmowy po kliknięciu. Część frontowa (guard) usuwa nieaktualny kontekst. **Pełne domknięcie wymaga zmiany serwerowej** (patrz niżej).

## Świadomie odłożone (wymagają decyzji/przeglądu — na rano)
- **BUG-02/15 — część SERWEROWA (P1, do przeglądu).** W `server/src/middleware/auth.middleware.ts:585-642` gdy `x-org-context` jest pusty, wygrywa `tokenOrganizationId`; jeśli ten org nie ma ACTIVE membership → `validateOrgMembership` (`:1344-1408`) rzuca 403. Rekomendacja: gdy token-org nie przechodzi membership, fallback do realnej bieżącej ACTIVE org użytkownika zamiast 403. To zmiana wrażliwa (auth dla 131 userów VTS) — **nie ruszałem nocą, wymaga Twojego przeglądu.**
- **BUG-13 (Settings sub-nav) — NIE jest bugiem kodu.** Łańcuch klik→navigate→URL→`activeSection`→render jest poprawny (`SettingsView.tsx:254-298,355-423`, routing-driven). Najpewniej **gating pilotażowy**: pilot user ma dozwolone tylko `profile/auth-access/language/theme` (`SettingsView.tsx:238-241`) — inne sekcje cicho przekierowują. Albo over-report (por. [[finding_gap_reports_overstate]]). **Do weryfikacji na żywo kontem VTS USER rano** — nie zmieniam działającego kodu.
- **BUG-17 (sidebar @375px)** — breakpoint; osobny pas pracy frontowy (nie tknięte).
- **BE-S2-1 (N+1 164 zapytania w title/generate)** — refaktor zapytań; nie blokuje, do monitorowania pod obciążeniem 131 userów.

## Szczegóły poprawek
### FIX-1 — RBAC na widoku managera (PII)
Bramka `requirePermission('manage_workstreams')` na endpointach `/manager/lanes/:laneId/problems` i `/manager/lanes/:laneId/problem-actions/execute`. `manage_workstreams` mają SUPERADMIN/OWNER/ADMIN/PROJECT_MANAGER — zwykły USER dostanie 403, nie zobaczy cudzych zadań i nazwisk.

### FIX-2 — Circuit breaker
`GLOBAL_TRANSPORT_FAILURE_THRESHOLD` 2→6, `GLOBAL_TRANSPORT_FAILURE_WINDOW_MS` 8000→20000, `GLOBAL_TRANSPORT_BLOCK_MS` 300000→45000. Realny user z kilkoma tabami nie wywoła 5-min blackoutu po 2 błędach.

### FIX-3 — ModelRouter SQL
`mta.is_active = true` → `mta.is_active = 1` (spójność z `p.is_active = 1`, `ops.is_enabled = 1`). Usuwa `operator does not exist: integer = boolean`, przywraca routing modeli z DB zamiast hardcoded fallback.

### FIX-4 — commandDock
Dodany domyślny blok `commandDock` do `MOCK_SCREEN.blocks` + guard w `cloneDefaultBlock` (nie rzuca wyjątku, loguje i degraduje). Usuwa wyjątek „Missing default home block for commandDock".

### FIX-5 — web-vitals
`POST /api/analytics/web-vitals` → 204 (przyjmuje telemetrię, nie gubi jej jako 404).

### FIX-6 — Migracje (DO URUCHOMIENIA RĘCZNIE)
Plik `migrations/2026-06-08-qa-schema-drift.sql` (idempotentny, ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS). Uruchomić najpierw na staging, zweryfikować, potem na prod **po wykonaniu backupu**.
