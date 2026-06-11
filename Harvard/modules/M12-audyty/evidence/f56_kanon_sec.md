# M12 — Audyty (Audit Orchestrator): KANON + BEZPIECZEŃSTWO (Fazy 5–6)

Data: 2026-06-11. Branch: feat/deliverables-light. Agent: KANON+SEC.

Zakres plików:
- FE hub: `src/components/Audit/AuditsHub.tsx`
- FE kreator: `src/components/Audit/AuditOrchestratorWizard.tsx`
- FE API klient: `src/components/Audit/auditApi.ts`
- FE public showcase: `src/views/AuditsShowcasePage.tsx`
- Routing: `src/routes/AppRoutes.tsx`
- Beta SSOT: `src/utils/betaAccess.ts`, sidebar `src/components/navigation/Sidebar/menuConfig.ts`, `Sidebar.tsx`
- BE trasy (7 handlerów): `server/src/routes/audit-programs.routes.ts`
- BE serwis: `server/src/services/auditProgramService.ts`
- Fan-out: `server/src/services/InterviewAssignmentService.ts`
- Mount: `server/src/Gateway.ts:972` (`app.use('/api/audit', auditProgramsRouter)`)

---

## FAZA 5 — KANONY

### 1. §27 TABLE_AND_PREVIEW_CANON — lista programów (AuditsHub)
AuditsHub NIE jest tabelą §27 — to lista kart (`<ul>` z `<li>` / przyciskami, AuditsHub.tsx:343–462) + boczny panel dashboard. To wzorzec hub/lista-kart, nie kanoniczna tabela list+preview z Menu 1/2/3. Konsekwencje vs §27 A–S:
- (A) Paginacja: serwerowa „Load more" działa (offset = `programs.length`, AuditsHub.tsx:117–137, 466–484) + licznik „Pokazano X z Y". OK.
- (B) Wyszukiwarka: TYLKO klient (`filtered`, AuditsHub.tsx:156–163) — filtruje wyłącznie już-załadowaną stronę. Przy >50 programach szukana pozycja może być poza stroną → fałszywe „brak wyników". TODO #19e w kodzie to przyznaje. **P3 (UX)**.
- (B) Filtr statusu: TYLKO klient (ten sam problem co wyżej). **P3 (UX)**.
- (C–S) Brak Menu 1/2/3, brak bulk-action, brak kolumn sortowalnych, brak Archive/Delete scope (Active/Archived) — bo to nie tabela. Akcje per-wiersz: Generuj (Send) + Usuń (Trash). Delete = `window.confirm` (AuditsHub.tsx:171), bez miękkiego archiwum.
- **Wniosek:** §27 formalnie n.d. (nie-tabela). Jeśli moduł ma dojść do §27, lista wymaga migracji na kanoniczny komponent tabeli lub przeniesienia wyszukiwarki/filtra na serwer.

### 2. Wzorzec hubowy — ModuleHub?
AuditsHub NIE używa wspólnego `ModuleHub`. Renderuje własny pełnoekranowy layout (`min-h-screen`, własny header z back-arrow, AuditsHub.tsx:235–283). Komentarz w pliku: „self-contained page". Niespójność z modułami opartymi o ModuleHub. **P3 (spójność).**

### 3. UI-standards
- **EntityStatusChip: UŻYTY poprawnie** (import z `@/components/ui/primitives/chips`, AuditsHub.tsx:42, render 368–372). Status programu mapowany przez `STATUS_PILL_ALIAS` (draft/active/completed/archived), kolor z SSOT chipa, tekst z bilingual `statusLabel`. Dobry wzorzec.
- **Hardkod koloru: `accentColor="#3b82f6"`** w kreatorze (AuditOrchestratorWizard.tsx:285) zamiast tokena/zmiennej CSS (`primary-500`). **P3.**
- Reszta kolorów = klasy Tailwind tokenowe (primary-500, slate, navy, emerald) — OK, brak innych surowych hexów w AuditsHub.

### 4. i18n PL/EN
- Wzorzec `isPolish` + lokalny helper `tr(en, pl)` w obu plikach FE (AuditsHub.tsx:79–80, Wizard:67–68) — wzorzec M19/M21 (`isPolish`), NIE M15 (0× hardcode przez `t()`). Inline-bilingual zamiast kluczy i18next.
- **Pokrycie bilingual: pełne** — wszystkie etykiety UI mają PL+EN (nagłówki, filtry, statusy, empty/loading/error, confirm-dialogi, aria-labele). Nie znaleziono EN-only ani PL-only stringów w ścieżkach widocznych.
- Drobne: showcase publiczny (`AuditsShowcasePage`) ciągnie treści z `@/data/auditShowcaseData` (`AUDIT_METHODOLOGIES`) — sprawdzić tam osobno, ale to dane marketingowe statyczne.
- **Ocena i18n: dobra** (porównywalna z wzorcem isPolish; nie idealny M15-zero, ale brak braków/mieszanki). **P3 informacyjnie** (inline-bilingual zamiast kluczy = dług, nie błąd).

### 5. Stany empty / loading / error + walidacja kreatora
- empty: AuditsHub.tsx:330–341 (rozróżnia „brak programów" vs „brak pasujących do filtrów"). OK.
- loading: 325–329 (spinner). OK.
- error: 316–320 (czerwony baner, wszystkie ścieżki mutacji ustawiają `error`). OK.
- Dashboard completion: osobne loading/empty/unavailable (587–618). OK.
- Kreator 4-krokowy (objective → templates → assignees → review): walidacja per-krok w `canProceed` — assignees wymaga ≥1 (Wizard:226–227), objective/templates analogicznie. `maxReachableIndex` blokuje przeskok. OK.

### 6. CARD_CONTENT_FORMULA — n.d. (moduł nie generuje kart wniosków/inicjatyw).

---

## FAZA 6 — BEZPIECZEŃSTWO

### Stack middleware (BE) — audit-programs.routes.ts:40–43
```
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);
```
`organizationId` brany z `authContext(req)` (z tokena/sesji, NIE z URL — routes.ts:48–55). Dobry fundament.

---

### FINDING SEC-1 — Beta-lock TYLKO nawigacyjny; direct URL `/audit-programs` omija (P3)
- Beta status: `MODULE_AUDITS: 'closed'` (betaAccess.ts:41). `BETA_ALLOW_TEAM=false` → zamknięte też dla admina.
- Egzekwowanie: WYŁĄCZNIE w sidebarze — `lockClosedBetaModules(...)` w `Sidebar.tsx:156`. Filtruje strukturę menu.
- Trasa `/audit-programs` (AppRoutes.tsx:1198–1211) NIE ma żadnego beta-guarda — tylko `MainLayout` (powłoka auth). **Każdy zalogowany user z dowolnej org, wpisując URL bezpośrednio, wchodzi do funkcjonalnego huba.** Potwierdza wzorzec systemowy M16–M20: beta-lock omijany przez direct URL.
- Severity **P3**: to bariera UX/polityki, nie ekspozycja danych — API niżej dalej egzekwuje org-scope. Ale „closed beta" jest realnie otwarta dla każdego konta.
- Dowód: AppRoutes.tsx:1198–1211 (brak guarda) vs Sidebar.tsx:156 (jedyne egzekwowanie).

---

### FINDING SEC-2 — ORG-SCOPE wszystkich 7 handlerów: CZYSTE (brak IDOR)
Wszystkie 7 handlerów biorą `organizationId` z `authContext` (nie z URL) i przekazują do serwisu, który filtruje `WHERE organization_id = ?` przy KAŻDYM odczycie/zapisie. `:id` z URL jest zawsze parowany z org w `WHERE id = ? AND organization_id = ?`.

| # | Handler | routes.ts | Serwis: zapytanie (plik:linia) |
|---|---------|-----------|-------------------------------|
| 1 | GET /programs (list) | :61–73 | `WHERE organization_id = ?` — auditProgramService.ts:227 (count) + 234–238 (list) |
| 2 | POST /programs (create) | :78–101 | INSERT z `organization_id` z authContext — :266–285 |
| 3 | GET /programs/:id (read) | :106–117 | `WHERE id = ? AND organization_id = ?` — :248 |
| 4 | PATCH /programs/:id (update) | :122–147 | getProgram(org,id) guard :298 + `UPDATE ... WHERE id = ? AND organization_id = ?` :319 |
| 5 | POST /programs/:id/generate-surveys | :155–166 | getProgram(org,id) guard :382 (zwraca null→404 dla cudzej org) |
| 6 | GET /programs/:id/completion | :172–183 | getProgram(org,id) guard :499 + `WHERE organization_id = ? AND id IN (...)` :513–516 |
| 7 | DELETE /programs/:id | :188–199 | getProgram(org,id) guard :339 + `DELETE ... WHERE id = ? AND organization_id = ?` :342 |

**Wniosek: brak cross-org IDOR na poziomie samego rekordu programu.** Moduł należy do „czystych" (jak M02/M25/M17/M18/M19/M21), NIE do dziurawych. Pozytyw.

---

### FINDING SEC-3 — Cross-org assignment przez fan-out: BRAK walidacji org-membership assignee (P1)
Najważniejszy finding. Łańcuch:
1. `assigneeIds` żyją w wolnym JSON `config` programu. `createProgram`/`updateProgram` zapisują `config` BEZ walidacji, że te user-id należą do org (auditProgramService.ts:263–264, 308–311 — `config` przyjmowane „jak leci", typeof object only). PATCH body przyjmuje dowolne `config` (routes.ts:139).
2. `generateSurveys` czyta `program.config.assigneeIds`, robi kartezjan template×assignee i woła `interviewAssignmentService.create({ organizationId, assigneeUserIds:[assigneeId], ... })` (auditProgramService.ts:409–425). **Nie sprawdza, czy assigneeId należy do `organizationId`.**
3. `InterviewAssignmentService.create` (InterviewAssignmentService.ts:393–461) INSERT-uje przydział z `organization_id = input.organizationId` ale `assignee_user_id = primaryAssignee` **bez żadnej weryfikacji, że ten user istnieje w tej org** (linie 402–425). Dodatkowo woła `sendAssignmentNotification` (:455) i tworzy mirror-task w MyWork (:443) dla obcego usera.

**Eksploatacja:** zalogowany user org A robi `PATCH /api/audit/programs/:id` z `config.assigneeIds = ["<userId z org B>"]`, potem `POST /:id/generate-surveys`. Powstaje przydział wywiadu + powiadomienie + zadanie MyWork wskazujące usera z org B. Cross-org assignment / przeciek tożsamości + spam powiadomień. Rekord przydziału ma `organization_id` org A (więc obcy user może go nie zobaczyć w swoim scope listy — co ogranicza wyciek danych), ale notyfikacja/mirror-task celują w userId obcej org.

- Severity **P1** (cross-org write/assignment + notyfikacja do obcego usera; ograniczone tym, że org_id przydziału = atakującego, więc nie jest to pełny odczyt danych ofiary).
- Przez UI nie da się tego wywołać (kreator ładuje assignees z org-scoped `/users`, auditApi.ts:221 → `Api.get('/users')`), ale API tego NIE wymusza. Klasyczny „UI-only validation".
- **Remediacja:** w `generateSurveys` (lub w `InterviewAssignmentService.create`) zwalidować, że każdy `assigneeId` należy do `organizationId` (SELECT z `organization_users`/`users WHERE id=? AND organization_id=?`), odrzucać/raportować obce id jako `errors[]`. Najlepiej twardo w serwisie przydziałów (chroni wszystkich wołających).
- Dowód: auditProgramService.ts:409–425 (brak walidacji w fan-out) + InterviewAssignmentService.ts:402–425, 443–455 (create akceptuje dowolny userId).

---

### FINDING SEC-4 — Public showcase `/audits`: CZYSTE, brak przecieku (OK)
`AuditsShowcasePage` (src/views/AuditsShowcasePage.tsx) renderuje WYŁĄCZNIE statyczne dane marketingowe z `@/data/auditShowcaseData` (`AUDIT_METHODOLOGIES`, import :35). Brak `fetch`/`Api`/`useQuery` po dane programów lub klientów. Jedyna „logika": `handleOpenAuditHub` przekierowuje zalogowanych do `/audit-programs`, resztę do `/login` (:234–239). **Nie wycieka żadnych programów ani danych klientów.** Trasa publiczna (AppRoutes.tsx:998–1007, `AuthLayout` bez auth-guarda) — poprawnie, bo brak wrażliwych danych.

---

### FINDING SEC-5 — Sekrety / PII w logach: czyste
`logger.error` w routes loguje `{ error }` (komunikaty), nie body z `assigneeIds`/PII (routes.ts:70,98,114,143,163,179,196). W serwisie `generateSurveys` loguje `programId/templateId/assigneeId/error` (auditProgramService.ts:429–434) — to ID-ki (UUID), nie maile/hasła. `InterviewAssignmentService` loguje liczbę userów, nie maile (:457–458). Brak surowych sekretów/maili w logach. **OK (P3 informacyjnie:** assigneeId w logu to ID, nie PII wrażliwa).

---

## PODSUMOWANIE FINDINGÓW

| ID | Severity | Tytuł | Dowód |
|----|----------|-------|-------|
| SEC-3 | **P1** | Cross-org assignment przez fan-out (brak walidacji org-membership assignee) | auditProgramService.ts:409–425 + InterviewAssignmentService.ts:402–455 |
| SEC-1 | P3 | Beta-lock tylko nawigacyjny; direct URL `/audit-programs` omija | AppRoutes.tsx:1198–1211 vs Sidebar.tsx:156 |
| KANON-B | P3 | Wyszukiwarka + filtr statusu tylko po stronie klienta (gubi pozycje poza stroną) | AuditsHub.tsx:156–163 |
| KANON-acc | P3 | Hardkod koloru `#3b82f6` (accentColor) zamiast tokena | AuditOrchestratorWizard.tsx:285 |
| KANON-hub | P3 | Brak wspólnego ModuleHub (własny self-contained layout) | AuditsHub.tsx:235–283 |
| SEC-2 | — (OK) | Org-scope 7/7 handlerów czysty, brak IDOR | tabela powyżej |
| SEC-4 | — (OK) | Public showcase bez logiki/danych | AuditsShowcasePage.tsx:35 |
| SEC-5 | — (OK) | Brak sekretów/PII wrażliwej w logach | routes.ts:70 i in. |

**NAJWAŻNIEJSZE:** SEC-3 (P1 cross-org assignment fan-out). SEC-2 i SEC-4 to mocne pozytywy — rekord programu szczelnie org-scoped, showcase nieprzeciekowy.
