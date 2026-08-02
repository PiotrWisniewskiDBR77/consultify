# EXE-08 — Closure/Evidence Gate — Completion Report

Data: 2026-08-02
Status: **ACTIVE_FIX → gotowe do ponownego review** (fix packet po Codex review z blokerami 1-4). Nie deklaruję CODE_GO.

## Branch / base / HEAD / worktree

- Branch: `feat/exe-008-closure-evidence-gate`
- Base: `fc0eb001a9` (EXE-05/06, frozen, Codex-accepted)
- HEAD: `3d206d7e02ef41744bb89a6f8df3da087006bd3c`
- Worktree: `.../scratchpad/wt-exe-008`, izolowany, drzewo czyste (`git status --short` puste), brak drugiego aktywnego writera, brak push/merge/deploy.
- 13 commitów od base (9 z pierwszego przejścia + 4 z tego fix packetu).

## Commity tego fix packetu (po pierwszym review)

1. `e281e88652` — fix: porównanie wersji inicjatywy po instancie czasu, nie po stringu (bug znaleziony przez własny test, sprzed review Codex).
2. `78c6ca5f61` — fix: migracja musi działać na PUSTYM Postgresie, nie tylko na już-zmigrowanym (BLOCKER 1, część 1).
3. `40fb4924fd` — fix: przenumerowanie migracji poza zepsutą strefę dated-filename; twardy FAIL zamiast vacuous skip przy niekompletnym schemacie (BLOCKER 1, część 2).
4. `0659e074d1` — fix: evidence musi należeć do zamykanej inicjatywy, nie tylko do organizacji (BLOCKER 2).
5. `3d206d7e02` — feat: realny recovery dla obu punktów awarii modelu dwóch jednostek (BLOCKER 3).

(BLOCKER 4 = ten dokument.)

## Canoniczny właściciel statusu inicjatywy

Jedyny kod w tym pakiecie piszący `initiatives.status` to `initiativeClosureService.approveClosureRequest` (i jej wewnętrzna funkcja pomocnicza `reconcileClosureRequestStatus`, patrz niżej) — obie wołają WYŁĄCZNIE `executeInitiativeTransition` (silnik kanoniczny, FROZEN, nietknięty w całym pakiecie).

### Inwentarz WSZYSTKICH ścieżek mogących ustawić DONE/CLOSED

Sprawdzone ręcznie (`grep -rn "UPDATE initiatives SET" server/src`, ~35 wystąpień) + zweryfikowane przez uruchomienie:

| Ścieżka | Stan przed EXE-08 | Stan po EXE-08 |
|---|---|---|
| `initiativeClosureService.approveClosureRequest` → `executeInitiativeTransition` | nie istniała | **JEDYNA** legalna ścieżka do DONE |
| `InitiativeController.completeInitiative` (`POST /:id/complete`) | raw `UPDATE ... status='done'`, zero walidacji/audytu, dostępny dla każdego membera org | **Zamknięty**: `410 CLOSURE_REQUEST_REQUIRED`, zero zapisu do `status` (test: negative control "legacy POST /:id/complete") |
| `executionControl.routes.ts` `/timeline-update` (`field:'status'`) | ten sam wzorzec bypassu | **Już zamknięty wcześniej** (komentarz „INI-005 follow-up fix 2026-08-01" w kodzie, zweryfikowany na żywo — `field==='status'` → `400 TIMELINE_UPDATE_STATUS_FORBIDDEN`) |
| `v8/execution-control.routes.ts` `/timeline-update` | identyczny wzorzec, BEZ nawet role-checka | **Już zamknięty wcześniej** (ten sam INI-005 fix) |
| `InitiativeController.archiveInitiative` (`POST /:id/archive`) | raw `UPDATE ... status='ARCHIVED'` | **Świadomie POZA zakresem** — inny status (ARCHIVED, nie DONE), brief ogranicza się do DONE/CLOSED. Oznaczony komentarzem informacyjnym w kodzie dla przyszłego pakietu. |
| Wszystkie pozostałe `UPDATE initiatives SET ...` (~30) | — | Dotyczą innych kolumn (`priority_order`, `sponsor_id`, `progress`, `owner_execution_id`, itd.) — żaden nie pisze `status`. |

## Kontrakt closure/evidence

Dwie tabele (`server/migrations/934_initiative_closure_evidence_gate.sql`): `initiative_closure_requests` (workflow: `draft → submitted → (returned → submitted)* → approved_pending_transition → done`, z `transition_failed` jako retryable) i `initiative_closure_evidence` (referencje do `task|milestone|decision`, **teraz wymagające przynależności do KONKRETNEJ inicjatywy i stanu terminalnego** — patrz sekcja evidence poniżej).

Endpointy (`server/src/routes/pmo/initiativeClosure.routes.ts`, zamontowane w `Gateway.ts` pod `/api/initiatives`): `POST/GET closure-requests`, `GET :id`, `GET :id/readiness`, `POST :id/evidence`, `POST :id/submit`, `POST :id/return`, `POST :id/approve`.

## Atomiczność — model dwóch jednostek (uczciwie, nie jedna transakcja)

`executeInitiativeTransition` otwiera własną, niezależną `withPgTransaction` i nie przyjmuje zewnętrznego klienta — nie da się jej zagnieździć bez fałszywej atomiczności (dwa różne fizyczne połączenia Postgres to NIE jest jedna transakcja). Design pozostaje uczciwym podziałem na **Jednostkę 1** (własna transakcja `initiativeClosureService`: blokada `FOR UPDATE`, walidacja gate, trwały zapis decyzji approval → `approved_pending_transition`, COMMIT) i **Jednostkę 2** (silnik kanoniczny: właściwa zmiana statusu + własny atomowy audyt).

### Recovery — DOMKNIĘTE w tym fix packecie (było niekompletne)

Pierwsze review Codex trafnie zauważyło: test nazwany „fault injection" sprawdzał tylko sfabrykowany `closureRequestId` → 404 — nie dotykał w ogóle modelu dwóch jednostek. Głębsza analiza pokazała, że `reconcileClosureRequestStatus` leczyła TYLKO scenariusz „silnik zdążył, finalize nie" — scenariusz „Jednostka 1 się zacommitowała, silnik nigdy nie został wywołany" nie miał ŻADNEJ ścieżki powrotu — request zawisałby w `approved_pending_transition` na zawsze, z inicjatywą wciąż `EXECUTING`.

Naprawione: dodano test-only seam do `approveClosureRequest` (`__testFailBeforeUnit1Commit`, `__testFailAfterUnit1`, `__testFailAfterEngineBeforeFinalize` — nigdy nieosiągalne przez HTTP, adapter routingu przekazuje tylko nazwane pola z body) oraz rozszerzono `reconcileClosureRequestStatus` (wołaną przy KAŻDYM GET i teraz też na starcie KAŻDEGO `approveClosureRequest`) o realny retry Jednostki 2, gdy inicjatywa jeszcze nie jest DONE. Bezpieczne pod konkurencją: silnik ma własną blokadę wiersza + sprawdzenie `expectedCurrentStatus`, więc drugie równoległe wywołanie Jednostki 2 albo się serializuje i widzi już-DONE (czysty no-op), albo faktycznie wykonuje jedyną transakcję.

Trzy scenariusze udowodnione real-PG testami (`recovery scenario A/B/C`):
- **A** (crash po commit Jednostki 1, przed silnikiem): request utyka w `approved_pending_transition`, inicjatywa `EXECUTING`, DOKŁADNIE 1 wiersz `closure_approved`, 0 `status_changed` → retry → DOKŁADNIE 1 `status_changed` (nowy), request `done`, inicjatywa `DONE`.
- **B** (crash po sukcesie silnika, przed finalize): inicjatywa już `DONE`, request wciąż `approved_pending_transition` → retry → finalize BEZ nowego wywołania silnika, wciąż dokładnie 1+1.
- **C** (crash przed commitem Jednostki 1): ROLLBACK, zero zapisów, request wciąż `submitted` → czysty retry od zera.

## Zmienione pliki (cały pakiet, od base)

```
public/locales/en/translation.json
public/locales/pl/translation.json
server/migrations/933_initiative_section_types_closure.sql
server/migrations/934_initiative_closure_evidence_gate.sql
server/src/Gateway.ts
server/src/controllers/InitiativeController.ts
server/src/routes/pmo/initiativeClosure.routes.ts
server/src/services/initiative/initiativeClosureService.ts
src/components/Initiatives/sections/ClosureSection.tsx
src/components/Initiatives/sections/registry.ts
tests/components/Initiatives/ClosureSection.test.tsx
tests/integration/execution-closure-evidence-gate.golden-flow.realdb.test.ts
```

## BLOCKER 1 — migracja na pustym Postgresie (naprawione)

**Znalezione problemy** (pierwszy przez Codex, dwa kolejne przez głębszą reprodukcję):
1. `INSERT OR IGNORE` — składnia SQLite, nieprawidłowa w surowym Postgresie. Naprawione: natywne `INSERT ... ON CONFLICT (id) DO NOTHING` (`initiative_section_types` ma tylko `PRIMARY KEY(id)`, brak unikalności na `key`).
2. `requested_by`/`added_by`: `NOT NULL` + `ON DELETE SET NULL` — sprzeczność rzucająca błąd przy PIERWSZYM skasowaniu użytkownika. Naprawione: usunięcie FK (ten sam wzorzec co `decisions.decision_maker_id`/`initiative_history.changed_by` w tym schemacie — dokładnie ten sam bug naprawiony wcześniej w pakiecie EXE-05/06 fix). Idempotentny blok `DROP CONSTRAINT IF EXISTS` dla środowisk gdzie stara definicja już się zaaplikowała.
3. **Głębszy problem, niezłapany przez pierwszy review**: runner migracji sortuje nazwy plików jako zwykłe stringi — każdy plik z prefiksem daty (`2026....sql`) uruchamia się PRZED każdym plikiem numerowanym zwykłą liczbą, w tym przed `529_initiative_section_types.sql`. Ponieważ każdy plik migracji commituje się jako jedna transakcja, seed INSERT do `initiative_section_types` (tabela jeszcze nieistniejąca) wywalał CAŁY plik — łącznie z dwoma `CREATE TABLE` dla closure/evidence. Na czystym Postgresie cała funkcja closure/evidence znikała bez śladu. To samo dotyczyło `initiative_history.idempotency_key` (dodawane przez FROZEN `20260802_exe005006_change_progress_spine.sql`, który sam pada na `execution_audit_log` nieistniejącym jeszcze w tym miejscu sekwencji).

**Naprawa**: przenumerowanie `20260802_exe008_closure_evidence_gate.sql` → `934_initiative_closure_evidence_gate.sql` (po `933_initiative_section_types_closure.sql`, w bezpiecznej strefie liczbowej po `529`), z defensywnym `CREATE TABLE IF NOT EXISTS initiative_history` (kopia wierna z frozen pliku EXE-05/06, BEZ modyfikowania tego pliku) + `ALTER ... ADD COLUMN IF NOT EXISTS idempotency_key`.

**Dowód (dwukrotnie zreprodukowany, deterministycznie)**:
- Pełny bootstrap z PUSTEGO kontenera Postgres (`migrate.postgres.ts --safe` + rekoncyliacja 293/247/063 — patrz niżej) → `934`/`933` status `success` → 18/18 real-PG testów zielone.
- Surowy `psql -v ON_ERROR_STOP=1 < plik.sql` (dokładnie jak zrobił Codex) przeciw minimalnemu schematowi, DWA razy pod rząd (dowód idempotencji) → zero błędów.
- Negatywny dowód „fail loudly": ręczne ukrycie `initiative_closure_requests` na kompletnej bazie → cały suite pada (`beforeAll` throw), NIE cichy skip. Przywrócenie tabeli → z powrotem zielono.

**Przedegzystujący, NIEZWIĄZANY gap** (nie mój bug, udokumentowany już w poprzednich pakietach EXE-02/03/04): `293_initiative_milestones.sql`, `247_initiative_enhancements.sql`, `063_raid_items.sql` są numerowane <500 i domyślnie wykluczone przez `isSqliteOnlyMigration` (`versionNum < 500` bez prefiksu `000_z_core_baseline`). Wymagają jawnej rekoncyliacji `--only` — udokumentowane w błędzie testu i w tym raporcie, żeby nikt nie musiał tego odkrywać od nowa.

## BLOCKER 2 — evidence ownership (naprawione)

`assertEvidenceRefBelongsToOrg` sprawdzała TYLKO `organization_id` — dowód (task/milestone/decision) przypięty do inicjatywy A mógł zamknąć zupełnie inną inicjatywę B w tej samej organizacji. Test wcześniej TO WYKORZYSTYWAŁ świadomie (komentarz w nagłówku pliku: „intentional, matching real service behavior") dzieląc jedną parę dowodów między wszystkie zamknięcia.

Naprawa: `assertEvidenceRefBelongsToInitiative` — dodano `initiative_id = ?` do wszystkich trzech zapytań (kolumna istnieje na `tasks`/`initiative_milestones`/`decisions`) ORAZ sprawdzenie stanu terminalnego w TYM SAMYM wywołaniu (task `done`/`completed`, milestone `COMPLETED`, decision `approved` — zgodnie z domeną `DecisionStatus` w `types/index.ts`). Nowy kod błędu `409 EVIDENCE_NOT_TERMINAL` odróżniony od `404 EVIDENCE_REF_NOT_FOUND` (ten drugi nie zdradza, czy rekord istnieje w ogóle, czy tylko należy do kogo innego).

Fixtures przebudowane: każda inicjatywa potrzebująca 2 dowodów dostaje WŁASNĄ, świeżo zminionowaną parę task+milestone (`evidenceByInitiative`). Dodano 6 nowych negative controls (B2-B7): task/milestone z innej inicjatywy w tej samej org, decision bez żadnego powiązania z inicjatywą, oraz task/milestone/decision należące do właściwej inicjatywy ale jeszcze niedokończone — wszystkie odrzucone, wszystkie dowiedzione że nie zostawiają wiersza w `initiative_closure_evidence`.

## BLOCKER 3 — realny recovery (naprawione, patrz sekcja atomiczności wyżej)

## BLOCKER 4 — ten dokument

## Testy i wyniki

### Real-PG (`tests/integration/execution-closure-evidence-gate.golden-flow.realdb.test.ts`) — **18/18 PASS**

Uruchomione przeciw świeżo zbootstrapowanemu Postgresowi (empty → `migrate.postgres.ts --safe` → rekoncyliacja 293/247/063 → suite):

- Golden flow (12 kroków z brief): draft → readiness → evidence ×3 (task+milestone+decision) → submit(422 odrzucony) → submit → 403(brak roli) → return → resubmit → approve → DONE, spójne po reopen, `initiative_history` kompletne (`closure_requested`+`closure_approved`+`status_changed`), `transitionAuditRef` wskazuje na realny wiersz.
- Negative control A: <2 evidence → 422.
- Negative control B: cudza org evidence → 404.
- **Negative control B2-B7** (NOWE, BLOCKER 2): task/milestone z innej inicjatywy tej samej org → 404 (×2); decision bez powiązania z inicjatywą → 404; task/milestone/decision własne ale niedokończone → 409 EVIDENCE_NOT_TERMINAL (×3).
- Negative control D: idempotentny retry approve (ten sam idempotencyKey) → dokładnie 1 wiersz audytu.
- Negative control E: concurrent double-approve (Promise.all, różne idempotencyKey) → dokładnie 1 transakcja silnika, oba requesty kończą 200.
- Negative control F: stale expectedInitiativeVersion → 409 STALE_VERSION.
- Negative control G: cross-tenant closure request → 404 wszędzie, zero zmian stanu.
- Negative control (legacy bypass): `POST /:id/complete` → 410 CLOSURE_REQUEST_REQUIRED.
- Negative control (honestly named, było „fault injection"): sfabrykowany closureRequestId → 404, zero zapisów.
- **Recovery scenario A/B/C** (NOWE, BLOCKER 3): patrz sekcja atomiczności.

### Component (`tests/components/Initiatives/ClosureSection.test.tsx`) — **8/8 PASS**

Readiness checklist, evidence 404, submitted state, 422 z konkretną listą braków, return-walidacja, **no-premature-success** (fake timers, dwa ticki pollingu przed sukcesem), conflict 409, reopen-DONE-snapshot bez interakcji.

### Razem: **26/26 PASS**, zero mocków w warstwie real-PG.

## Dowód świeżego schematu (fresh-schema proof)

1. Pusty kontener Postgres → `migrate.postgres.ts --safe` (standardowy bootstrap, bez ręcznych patchy poza udokumentowaną rekoncyliacją 293/247/063) → `934`/`933` status `success` w `schema_migrations` → 18/18 testów zielone.
2. Ten sam bootstrap powtórzony deterministycznie (dwa razy, z różnymi kontenerami) — identyczny wynik za każdym razem.
3. Surowy `psql -v ON_ERROR_STOP=1 < plik.sql` (metoda Codex) przeciw minimalnemu schematowi, dwukrotnie — zero błędów, druga runda czysto idempotentna (same `NOTICE: already exists, skipping`).
4. Negatywny dowód: ukrycie tabeli na kompletnej bazie → suite failuje głośno (nie skip); przywrócenie → z powrotem zielono.

## Bezpieczeństwo (przegląd adwersarialny, pierwsze przejście + rozszerzony po BLOCKER 2)

- Forged actor/org/approver — niemożliwe (sesja, nie body; `assertActorCanApprove` czyta role z bazy przez `resolveInitiativeAccessContext`, ignoruje claim roli z JWT).
- Cudza inicjatywa / cross-tenant evidence — 404 przy zapisie, sprawdzone testem.
- **Nonexistent/wrong-initiative/incomplete evidence — NOWO domknięte w tym fix packecie (BLOCKER 2), 6 nowych negative controls.**
- Wygasła wersja — 409, sprawdzone testem.
- Duplicate/concurrent approve — idempotencja + row lock, sprawdzone testem.
- Legacy DONE bypass — zamknięty i przetestowany.
- XSS w rationale — brak `dangerouslySetInnerHTML` w `ClosureSection.tsx`, React escapuje domyślnie.
- Wyciek evidence między org — niemożliwy (closure request 404 zanim evidence się w ogóle pobiera).
- Plain-update bypass na `status` — już zamknięty wcześniej (INI-005), zweryfikowany na żywo jako wciąż zamknięty.

## Nierozstrzygnięte (NEEDS_PRODUCT_DECISION)

1. **Self-approval** — kod nie zabrania osobie, która złożyła wniosek, samodzielnie go zatwierdzić (jeśli ma rolę INITIATIVE_OWNER/PMO/ADMIN). Nigdzie w bazie nie znaleziono reguły to zakazującej.
2. Reguła „wszystkie taski/milestone'y muszą być DONE" — nieudokumentowana, więc gate wymaga 2+ evidence + jawny `exceptionsWaivers` przy niedokończonych pozycjach, zamiast twardej blokady.
3. Evidence types ograniczone do `task|milestone|decision` (MVP) — szersze typy (artefakty, deliverable bundles) odłożone.
4. `archiveInitiative` ma dokładnie ten sam wzorzec bypassu co `completeInitiative` miał — świadomie POZA zakresem tego pakietu (inny status, ARCHIVED nie DONE), oznaczone w kodzie.

## Kolizje

Brak — jeden writer per plik przez cały czas trwania pakietu, włącznie z fix packetem.

## Dowód czystego drzewa

- `git status --short` — puste.
- `git diff fc0eb001a9..HEAD --check` — bez uwag (whitespace).
- Skan sekretów po zmienionych plikach — zero trafień.
- Scoped esbuild na wszystkich zmienionych plikach TS/TSX — zero błędów.
- JSON i18n (en/pl) — parsowalne.
- Brak push/merge/deploy, brak dotknięcia Railway/demo.

Nie deklaruję samodzielnie CODE_GO.

**AWAITING_CODEX_REVIEW.**
