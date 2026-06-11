# M12 — Audyty (Audit Orchestrator) — FAZA 1: Prawda kodu

Branch: `feat/deliverables-light`. Data: 2026-06-11. Agent KOD.

Zakres: orkiestrator programów audytowych opartych o szablony wywiadów (fan-out ankiet
przez kanoniczny `interviewAssignmentService` z M10). To **NIE** runner DRD/SIRI/ADMA/Lean
(te metodyki żyją tylko jako statyczna strona pokazowa `/audits`).

## Pliki kluczowe
- BE serwis: `server/src/services/auditProgramService.ts` (540 linii)
- BE trasy: `server/src/routes/audit-programs.routes.ts` (202 linie, 7 handlerów)
- BE mount: `server/src/Gateway.ts:972` → `app.use('/api/audit', auditProgramsRouter)`
- BE handoff M10: `server/src/services/InterviewAssignmentService.ts:393` (`create`)
- FE klient API: `src/components/Audit/auditApi.ts`
- FE hub: `src/components/Audit/AuditsHub.tsx` (650 linii)
- FE kreator: `src/components/Audit/AuditOrchestratorWizard.tsx` (536 linii)
- FE presety: `src/components/Audit/auditPresets.ts`
- FE showcase publiczny: `src/views/AuditsShowcasePage.tsx` → trasa `/audits`
- Trasa hub: `src/routes/AppRoutes.tsx:1199` → `/audit-programs` (w MainLayout, auth)
- Beta gate: `src/utils/betaAccess.ts:41` `MODULE_AUDITS: 'closed'`; sidebar `menuConfig.ts:128` badge `beta`

---

## Werdykty per pozycja inwentarza

### 1. Lista programów — paginacja serwerowa, wyszukiwarka, filtr statusu → **REALNE**
- Serwer: `listPrograms()` `auditProgramService.ts:218-243` — realne `SELECT ... WHERE organization_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?` + osobny `COUNT(*)` (linie 226-240). Zwraca `{programs,total,limit,offset}`. Paginacja **serwerowa, prawdziwa**.
- Trasa: `GET /programs` `routes:61-73`, przekazuje `limit/offset` z query.
- FE: `AuditsHub.tsx` `load()` (offset 0) + `loadMore()` (offset=programs.length) `:97-137` — realny "Load more" z dedupingiem po id. UWAGA: wyszukiwarka i filtr statusu są **klienckie** (`filtered` useMemo `:156-163`), nie serwerowe — przy >1 stronie filtr działa tylko na załadowanym buforze (znany TODO `:154`). Działa, ale nie jest „pełnym" serwerowym filtrem.

### 2. Kreator programu 4 kroki → **REALNE** (z jedną nieaktualną etykietą)
- `AuditOrchestratorWizard.tsx` — kroki Objective+preset → Templates → Assignees → Review. Realny `WizardStepper`, realne multiselecty zasilone z M10/users (`listTemplateOptions` → `GET /interview/templates`; `listUserOptions` → `GET /users`, `auditApi.ts:191-244`).
- `handleCreate()` `:165-194` realnie POST-uje program z `config{templateIds,assigneeIds,plan,surveysGenerated:false}`.
- **Przeszacowanie/dług:** kreator zapisuje tylko DEFINICJĘ i pokazuje bursztynowy baner „generowanie ankiet to kolejny krok, jeszcze niezautomatyzowany w tym MVP" (`:467-473`). Ten baner jest **NIEAKTUALNY** — fan-out JEST zaimplementowany i podpięty w hubie (poz. 5). Etykieta wprowadza w błąd, ale logika kreatora jest realna.

### 3. Presety iso27001, new-company + quick-launcher → **REALNE (statyczne blueprinty)**
- `auditPresets.ts`: `ISO_27001_PRESET` = 14 obszarów Annex A (a5–a18) z sugerowanymi rolami; `NEW_COMPANY_PRESET` = 6 obszarów funkcjonalnych. Dwujęzyczne (en/pl).
- `buildPlanFromPreset()` `:219-225` — deterministyczne mapowanie obszar→rola (NIE AI; uczciwie udokumentowane).
- Quick-launcher: `AuditsHub.tsx:267` przycisk „ISO 27001" → `openWizard('iso27001')`. Realny.
- Plan jest **advisory metadata** (round-trip w config), nie tworzy automatycznie przypisań — uczciwie opisane.

### 4. Dashboard programu — status, liczniki, wskaźnik ukończenia → **REALNE**
- `ProgramDashboard` `AuditsHub.tsx:521-640`: liczniki templates/assignees z config; status chip (`EntityStatusChip`).
- Wskaźnik ukończenia: gdy `surveysGenerated` — fetchuje REALNY rollup `getCompletion(program.id)` `:543` → `GET /programs/:id/completion`. Pasek postępu z `completion.percent`, tekst „X z Y ankiet ukończonych". To **nie** jest fabrykowane — liczby z DB (poz. 6).

### 5. Generuj ankiety fan-out → **REALNE — prawdziwy handoff do M10, idempotentny**
- Serwer: `generateSurveys()` `auditProgramService.ts:376-470`. Pętla kartezjańska templateIds × assigneeIds (`:409-437`), każda para woła **kanoniczny** `interviewAssignmentService.create({organizationId, templateId, assigneeUserIds:[assigneeId], dueAt, priority, createdBy, processRef:'audit_program:<id>'})` (`:416-424`).
- Handoff jest PRAWDZIWY: `InterviewAssignmentService.create` `:393-459` realnie INSERT-uje wiersz do `interview_assignments` (status `'assigned'`), tworzy mirror-task w MyWork (`createMirrorTask`), wysyła powiadomienia. To ten sam tor co AssignInterviewModal/`/interview/assignments` — NIE re-implementacja, NIE stub.
- Idempotencja REALNA: `if (program.config.surveysGenerated === true) return {alreadyGenerated:true}` `:393-402`. Zapisuje `generatedAssignmentIds` + snapshot `generation{requested,created,failed,at}` w config (`:444-454`). Per-para błędy łapane i raportowane (`:426-435`), `surveysGenerated` ustawiane tylko gdy `created>0` — można ponowić.
- Promocja statusu: draft→active gdy created>0 (`:459`).
- Trasa: `POST /programs/:id/generate-surveys` `routes:155-166`.
- FE: hub `handleGenerate()` `AuditsHub.tsx:181-228` — przycisk Send (ikona) z confirm „Wygenerować N przydziałów (T×A)?", obsługa alreadyGenerated/failed. **Podpięty i działający** (wbrew nieaktualnemu banerowi w kreatorze).

### 6. Completion rollup {generated,total,done,percent,byStatus} → **REALNE — liczby z DB**
- `computeCompletion()` `auditProgramService.ts:494-539`. Realny `SELECT status, COUNT(*) FROM interview_assignments WHERE organization_id = ? AND id IN (...) GROUP BY status` po zapisanych `generatedAssignmentIds` (`:511-518`).
- `DONE_STATUSES = {submitted, approved, completed}` `:492` — zgodne z kanonem lifecycle M10 (`AssignmentStatus` w InterviewAssignmentService `:37-43`). Mianownik = liczba zapisanych id (uczciwy, nie survivorship-biased) `:533`; brakujące przypisania surfaceowane jako `byStatus.missing` `:536`. **Zero fabrykacji.**
- Trasa: `GET /programs/:id/completion` `routes:172-183`.

### 7. Edycja/usuwanie programu → **REALNE**
- `updateProgram()` `:292-335` realny UPDATE z merge config; `deleteProgram()` `:337-347` realny DELETE. Oba `WHERE id=? AND organization_id=?`, oba sprawdzają istnienie najpierw.
- Trasy: `PATCH /programs/:id` `routes:122-147`, `DELETE /programs/:id` `routes:188-199`.
- FE: hub `handleDelete()` `:170-179` z confirm. UWAGA: **brak FE do edycji** — PATCH istnieje w serwisie/trasie i w `auditApi.updateProgram`, ale żaden ekran hub/kreator nie woła `updateProgram` (poza pośrednim wywołaniem z `generateSurveys`). Edycja programu = martwy FE, żywy BE. Drobny gap.

### 8. Public showcase /audits → **REALNE, publiczne, bez wycieku**
- `AuditsShowcasePage.tsx` — czysto statyczna strona marketingowa (metodyki DRD/SIRI/ADMA/Lean z `@/data/auditShowcaseData`, i18n, framer-motion). **Zero wywołań API, zero danych org.** Embeduje `AssessmentV8CanonPanel mode="catalog"` (publiczny katalog). Link do `/audit-programs` tylko dla zalogowanych (`handleOpenAuditHub` `:234-240`). **Brak wycieku danych** — zgodnie z oczekiwaniem.

---

## Tabela 1e — Wiring (persystencja)
| Encja | Tabela DB | Mechanizm | Przeżywa restart? |
|---|---|---|---|
| Program audytu | `audit_programs` | `CREATE TABLE IF NOT EXISTS` (DB_MANAGED_SCHEMA off, lazy `ensureSchema()` `:124-148`), kolumny + JSON `config`, index na `organization_id` | **TAK** — realna tabela SQL, nie `new Map()` |
| Przydziały ankiet | `interview_assignments` (M10) | tworzone przez `interviewAssignmentService.create`, INSERT | **TAK** |
| Rollup | (liczony) | `SELECT...GROUP BY status` z `interview_assignments` po `generatedAssignmentIds` z config | n/d (liczony na żądanie) |

**Persistencja-fasada: NIE.** Brak `new Map()`, brak in-memory store. Wszystko w SQL. Config jako JSON-blob to świadomy wybór (uniknięcie migracji per-pole) — uczciwie udokumentowany `auditProgramService.ts:19-24`.

## Tabela 1f — Flagi
- `MODULE_AUDITS: 'closed'` `src/utils/betaAccess.ts:41`. Sidebar `badge: 'beta'` `menuConfig.ts:132`. Beta gate REALNY i zamknięty.

## Tabela 1g — Połączenia (KLUCZOWE)
- **M10 Wywiad — fan-out:** `auditProgramService.ts:416` → `interviewAssignmentService.create` (`InterviewAssignmentService.ts:393`). **PRAWDZIWY handoff**, nie stub. Tag `processRef: audit_program:<id>` linkuje przydziały z powrotem.
- **M10 Wywiad — szablony:** `auditApi.listTemplateOptions` → `GET /interview/templates` (`auditApi.ts:191`).
- **Users:** `auditApi.listUserOptions` → `GET /users`.
- **MyWork (M03):** pośrednio — `create` tworzy mirror-task (`InterviewAssignmentService.ts:443`).
- **Rollup ↔ M10:** `computeCompletion` czyta `interview_assignments` (DB M10) bezpośrednio.

---

## SEC — org-scope / cross-org IDOR
**M12 CZYSTY — brak IDOR.** Wszystkie 7 handlerów:
- `routes.use(verifyToken)` + `requireOrgAccess()` `routes:41-42`. `organizationId` pochodzi WYŁĄCZNIE z `authContext(req)` `:48-55` (token/req, nie z body/URL).
- Każdy `:id`/`:programId` z URL jest ZAWSZE parowany z `AND organization_id = ?` w SQL:
  - `getProgram` `:248`, `updateProgram` `:319`, `deleteProgram` `:343`, `listPrograms` `:227/235`.
  - `generateSurveys` → `getProgram(organizationId, id)` `:382` (404 jeśli nie ta org).
  - `computeCompletion` → `getProgram(organizationId, id)` `:499` + rollup `WHERE organization_id = ? AND id IN (...)` `:514` (podwójne scoping: po programie i po przydziałach).
- Fan-out przekazuje `organizationId` z kontekstu do `interviewAssignmentService.create` `:416-422` — nowe przydziały dziedziczą org wołającego.
- Public `/audits` — bez logiki/API, bez wycieku.

**Sygnał systemowy:** M12 NIE jest w grupie dziurawych modułów (M20/M16/M15). Wzorzec org-scope tu zgodny z czystymi (M02/M25/M17/M18/M19/M21).

---

## WERDYKT KOŃCOWY: czy „kodowo kompletne E2E" potwierdzone?
**W ZNACZNEJ MIERZE TAK — z poprawkami nazewnictwa i drobnymi gapami.**

Pełna pętla E2E DZIAŁA w runtime:
kreator/preset → POST program (`audit_programs`) → hub „Generuj ankiety" → kartezjański fan-out
przez kanoniczny serwis M10 (realne `interview_assignments`) → idempotencja → dashboard fetchuje
realny rollup z DB → pasek postępu. Persystencja realna (SQL), restart-safe. Org-scope szczelny.

**Korekty/długi (nie podważają werdyktu REALNE):**
1. Baner w kreatorze (`AuditOrchestratorWizard.tsx:467-473`) twierdzi, że generowanie „nie jest zautomatyzowane w tym MVP" — **NIEAKTUALNE**, fan-out jest podpięty w hubie. Mylące dla użytkownika.
2. Wyszukiwarka/filtr statusu — **klienckie**, nie serwerowe (TODO `AuditsHub.tsx:154`); przy wielu stronach filtruje tylko bufor.
3. **Edycja programu — martwy FE:** PATCH żyje w BE+auditApi, ale brak ekranu wołającego `updateProgram` (poza generate). Plan/templates/assignees nie da się edytować po utworzeniu przez UI.
4. Plan presetu jest advisory-only (nie auto-przypisuje) — uczciwie udokumentowane, nie wada.

Żaden element NIE jest MOCK-STUB ani fabrykowany. Brak ZEPSUTYCH/MARTWYCH ścieżek runtime
(poza martwym FE edycji — żywy BE). Inwentarzowe gwiazdki (*) są zasadne; główne
przeszacowanie to wyłącznie **nieaktualny baner „MVP"** sugerujący, że poz. 5 nie działa,
gdy w rzeczywistości działa.
