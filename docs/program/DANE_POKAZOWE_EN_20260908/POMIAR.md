# POMIAR bazy — 2026-09-08

**Źródło:** kopia bazy stagingu `consultify_staging_kopia` (Postgres 18, kontener
`consultify-pg18`, port 54418). **Wyłącznie SELECT.** Nie dotykano stagingu (thomas),
demo (trolley) ani produkcji (centerbeam).

**Zasada:** każda liczba w tym pliku pochodzi z zapytania w
[`POMIAR.sql`](POMIAR.sql) albo z grepa, którego polecenie podano przy wierszu.
Surowy odczyt liczby wierszy dla wszystkich 1808 tabel:
[`pomiar-wiersze-per-tabela.txt`](pomiar-wiersze-per-tabela.txt).

---

## 1. Skala

| Miara | Wartość | Zapytanie |
|---|---:|---|
| Tabele (BASE TABLE, schema `public`) | **1808** | Q1 |
| Tabele z ≥1 wierszem | **546** (30 %) | Q2 |
| Tabele puste | **1262** (70 %) | Q2 |
| Wierszy w całej bazie (suma) | **164 403** | Q2 |
| Tabele mające kolumnę `organization_id` | **1283** | Q3 |
| Wierszy w tabelach z `organization_id` | **123 497** | Q4 |
| Organizacje | **331** | Q5 |
| Użytkownicy | **1434** | Q6 |
| Wiersze `organization_members` | **1445** | Q6 |

> **Uwaga o mianowniku.** 1262 puste tabele to nie jest „dług do usunięcia" —
> to schemat, który nigdy nie dostał danych. Sprzątanie dotyczy **164 403
> wierszy**, nie 1808 tabel. Kasowanie tabel jest poza zakresem tego planu
> (usunięcie tabeli to migracja destrukcyjna, a demo jest święte).

---

## 2. Organizacje — 331, z czego realnych 6

| Kategoria | Ile | Przykłady |
|---|---:|---|
| `E2E …` (tenanci testów end-to-end) | **286** | `E2E Tenant (m06-mqrjpenp-ac5s)`, `E2E-local-mqn4oig7`, `E2E Feedback Co` ×7 |
| Testowe/QA po nazwie | **32** | `Auto Co 1777779820855`, `Antigravity QA 1714715040Antigravity QA`, `Persist Co`, `Retest Corp`, `UniqueCorp8069`, `Jetski QA` |
| `My Company` (pusty formularz rejestracji) | **4** | — |
| Organizacje z jakąkolwiek treścią produktową | **6** | patrz niżej |
| Klon sesyjny | **1** | `demo-org-session-d1538cccff-msarpqu3` = drugie „Atelier Toys" |
| Organizacja-worek | **1** | `demo-org` „Demo Organization" |

Q7. **318 z 331 organizacji (96 %) to śmieć po testach.**

### 2.1 Ile wierszy zniknie po usunięciu organizacji śmieciowych

| Grupa | Wierszy w tabelach z `organization_id` | Udział |
|---|---:|---:|
| 6 organizacji realnych (DBR77, atelier, nordwind, vts, dbr77, system) | **52 841** | 43 % |
| `demo-org` „Demo Organization" | **14 352** | 12 % |
| **Reszta (325 organizacji testowych)** | **56 304** | **46 %** |
| Razem | 123 497 | 100 % |

Q8. Największe pojedyncze wygrane (wiersze należące do organizacji spoza
listy 6 realnych + `demo-org`):

| Tabela | Do kasacji | Z ilu |
|---|---:|---:|
| `organization_context_claims` | 34 617 | 36 836 |
| `v8_consumer_tool_policies` | 3 366 | 3 509 |
| `v8_tool_catalog` | 3 366 | 3 492 |
| `organization_context_items` | 1 907 | 5 069 |
| `organization_context_snapshots` | 1 499 | 1 503 |
| `v8_output_artifacts` | 1 360 | 2 223 |
| `v8_artifact_origin_links` | 1 341 | 2 081 |
| `activity_logs` | 1 079 | 13 472 |
| `collab_sessions` | 890 | 7 530 |
| `audit_log` | 883 | 8 190 |
| `users` | 335 | 1 434 |

Q9. `demo-org` osobno — to nie jest organizacja pokazowa, to worek:

| Tabela | Wierszy w `demo-org` |
|---|---:|
| `my_ideas` | 1278 |
| `organization_members` | **1061** |
| `conversations` | 192 |
| `tasks` | 152 |
| `decisions` | 67 |

1061 członków w organizacji „demonstracyjnej" pochodzi z rejestracji testowych
(każde konto E2E dostawało członkostwo w `demo-org`). Zero wartości pokazowej.

---

## 3. Sześć organizacji realnych — co która ma

Q10. Liczby per organizacja, ułożone w kolejności 16 pozycji menu
(`docs/FUNCTIONAL_DOCUMENTATION.md`):

| # Moduł · tabela | DBR77 | Atelier Toys | Nordwind | VTS |
|---|---:|---:|---:|---:|
| 01 Chat · `conversations` | 491 | 32 | 0 | 0 |
| 02 My Work · `tasks` | 197 | 50 | 0 | 0 |
| 02 My Work · `my_ideas` | 37 | 53 | 0 | 0 |
| 03 Interview · `interview_sessions` | 11 | 7 | 0 | 0 |
| 03 Interview · `interview_questions` | 51 | 40 | 0 | 0 |
| 04 Tools · `tool_sessions` | 115 | 6 | 0 | 0 |
| 05 Assessment · `assessments` | 11 | 1 | 0 | 0 |
| 05 Assessment · `assessment_reports` | 1 | 4 | 0 | 0 |
| 06 Initiatives · `initiatives` | 104 | 24 | 9 | 0 |
| 06 Initiatives · `ie_aggregate_state` | 115 | **0** | 0 | 0 |
| 07 Execution · `projects` | 16 | 7 | 0 | 0 |
| 07 Execution · `decisions` | 79 | 25 | 0 | 0 |
| 07 Execution · `raid_items` | 7 | 2 | 0 | 0 |
| 07 Execution · `initiative_milestones` | **0** | 39 | 0 | 0 |
| 07 Execution · `status_reports` | **0** | 7 | 0 | 0 |
| 08 Results · `rvn_kpi_definitions` | 140 | **0** | 0 | 0 |
| 08 Results · `rvn_kpi_measurements` | 1100 | **0** | 0 | 0 |
| 08 Results · `okr_vnext_objectives` | 11 | **0** | 0 | 0 |
| 09 Finance · `financial_statements` | 50 | 2 | **28** | 0 |
| 09 Finance · `budgets` | 3 | 0 | 1 | 0 |
| 10 Materials · `knowledge_docs` | 47 | 11 | 0 | 0 |
| 10 Materials · `presentation_decks` | 113 | 3 | 0 | 0 |
| 10 Materials · `generated_workbooks` | 44 | 0 | 0 | 0 |
| 11 Audits · `audits` | **0** | 3 | 0 | 0 |
| 12 Meeting · `meetings` | 15 | 5 | 0 | 0 |
| 13 Organization · `organization_members` | 16 | 22 | **0** | 1 |
| 13 Organization · `teams` | **0** | 5 | 0 | 0 |

**Wniosek pomiaru: żadna organizacja nie ma kompletu.** DBR77 jest najbogatsza,
ale po polsku, bez kamieni milowych, bez raportów statusu, bez zespołów, bez
audytów. Atelier ma to, czego DBR77 nie ma, ale ma zero w Wynikach i Finansach.
Nordwind to wyłącznie 28 sprawozdań finansowych i 9 inicjatyw bez opisów. VTS ma
jednego członka i zero treści.

---

## 4. Dane w formacie sprzed obecnej struktury

Q11.

| Defekt | Ile | Komentarz |
|---|---:|---|
| `initiatives` bez opisu (`description` puste) | **149 z 173** (86 %) | Karta inicjatywy jest pusta na podglądzie |
| `initiatives` w `IN_EXECUTION` bez `project_id` | **10** | **Fail-closed** — realizacja niewidoczna, patrz §5 |
| `tasks` bez `initiative_id` | **251 z 453** (55 %) | Zadania-sieroty; DBR77 sam ma 92 z 197 |
| `tasks` bez `assignee_id` | 39 | Ekran Obciążenia nie ma czego liczyć |
| `users` bez `job_title` | **1431 z 1434** | Zasoby/Obciążenie nie znają roli |
| `users.role` = **stanowisko**, nie rola systemowa | 4 | `UX Designer`, `DevOps Engineer`, `Product Manager`, `Senior Data Engineer` — wartości spoza słownika ról |
| `users.job_title` z podwójnie zakodowanym HTML | 1 | `tomasz.jankowski@dbr77.com` → `R&amp;amp;amp;D Specjalist` (3× encja + literówka) |
| `users.job_title` = rola platformy | 2 | `Platform SuperAdmin`, `Tenant Admin` |
| `initiative_stakeholders` (RACI, „właściciel biznesowy") | **0 wierszy** | Tabela istnieje, nikt jej nie wypełnił |
| `initiatives` ze statusem spoza słownika DEC-424 | **0** | ✅ jedyna rzecz, która jest w porządku |

### 4.1 Sprostowanie do zlecenia — `ON_HOLD` nie jest statusem

Zlecenie prosiło o rozkład statusów „…`ON_HOLD`, `CLOSED`, `REJECTED`".
Kanoniczny słownik (`server/src/constants/initiativeStatuses.ts:1-15`, DEC-424)
ma **siedem statusów**: `PROPOSED`, `DRAFT`, `PENDING_APPROVAL`, `APPROVED`,
`IN_EXECUTION`, `CLOSED`, `REJECTED`. `on_hold` i `archived` to **flagi**
(`INITIATIVE_FLAGS`, tamże `:13`), nie statusy. Seed musi to odwzorować:
inicjatywa „wstrzymana" ma status `APPROVED`/`IN_EXECUTION` **i** `on_hold=true`.

Q12. Rozkład zastany (cała baza, 173 inicjatywy):

| Status | Ile |
|---|---:|
| `DRAFT` | 88 |
| `IN_EXECUTION` | 36 |
| `REJECTED` | 17 |
| `APPROVED` | 11 |
| `PENDING_APPROVAL` | 11 |
| `CLOSED` | 10 |
| `PROPOSED` | 0 |
| z flagą `on_hold=true` | 4 |

---

## 5. Język danych

Q13. Heurystyka: tytuł zawiera polski znak diakrytyczny.

| Tabela | Wierszy | Z polskimi znakami | Uwaga |
|---|---:|---:|---|
| `initiatives` | 173 | 29 | reszta to angielskie tytuły **bez opisów** |
| `tasks` | 453 | 83 | DBR77: 83 z 197 |
| `decisions` | 198 | 41 | |
| `conversations` | 801 | 79 | |
| `meetings` | 20 | 6 | |
| `raid_items` | 9 | 0 | |

> **Ograniczenie metody, powiedziane wprost.** Brak polskich znaków ≠ tekst
> angielski. „Wdrozenie RPA" i „Plan" przechodzą jako „angielskie". Ten pomiar
> daje **dolną granicę** polskości. Realny odsetek jest wyższy i bez oglądania
> tekstu nie da się go podać. Dlatego plan **nie tłumaczy zastanych danych** —
> seeduje nowe po angielsku (patrz PLAN §2).

Q14. Atelier Toys — jedyna organizacja z materiałem po angielsku i pełnym
rozkładem statusów DEC-424 na 24 inicjatywach, z deterministycznymi
identyfikatorami `atelier--initiative--*` (np. `Warehouse Automation Wave 1`
IN_EXECUTION, `Legacy CRM Retirement` CLOSED, `Classroom Community App`
REJECTED). **Ale**: 0 z 24 ma opis, 0 agregatów runtime-v1, 0 KPI.
Wśród 22 członków 19 to spójny zestaw francuskich nazwisk na domenie
`demo.ateliertoys.com`, a 3 to śmieci: `audit-m07-1783274894@local.test`,
`cleanup-1783274965@local.test`, `codex.qa.20260807.0400@example.com`.

Q15. DBR77 — 16 kont, z tego do usunięcia `acceptance.owner@consultify.local`;
`admin@dbr77.com` ma `role=SUPERADMIN`; dwa konta tej samej osoby
(`piotr@dbr77.com` i `piotr.wisniewski@dbr77.com`).

---

## 6. Tabele bez czytającego kodu

**Metoda A (grep po samej nazwie w `server/src`, 546 niepustych tabel):**
martwych **8**. To zawyżony wynik na korzyść „żywe" — nazwa tabeli bywa
w komentarzu, w typie TS albo w skrypcie migracji, a nie w zapytaniu.

| Tabela | Wierszy | Charakter |
|---|---:|---|
| `_z139_repair_backup_20260710` | 49 | **kopia zapasowa po naprawie** |
| `finance_periods` | 45 | osierocona po przejściu na `finance_stmt_periods` |
| `z139_backup_919_work_canvas_versions` | 23 | **kopia zapasowa** |
| `finance_reason_codes` | 14 | słownik bez czytelnika |
| `ai_deep_thinking_confirms` | 8 | |
| `z139_backup_919_tasks` | 2 | **kopia zapasowa** |
| `_v8_flag_backup_20260710` | 2 | **kopia zapasowa** |
| `_migration_518_done` | 1 | znacznik migracji |

Rodzina tabel kopii zapasowych (prefiksy `_`, `z139_backup_`) jest widoczna też
w pełnym odczycie: `z139_backup_919_initiatives`, `z139_backup_919_decisions`,
`z139_backup_t5_notebook_pages_title`. **Kandydaci do usunięcia bez ryzyka** —
to kopie z naprawy z lipca 2026, nie dane produktu.

**Metoda B (grep po czasownikach SQL `FROM|JOIN|INTO|UPDATE|DELETE FROM <tabela>`)**
uruchomiona, nie dobiegła końca w czasie tej sesji — wynik cząstkowy nie
uprawnia do wniosku i **nie jest tu podany**. D0 ma ją dokończyć jako pierwszy
krok (patrz PLAN §4, paczka D0, krok 2).

---

## 7. Mechanizmy, które już są w repo (nie budować od nowa)

| Plik | Co daje |
|---|---|
| `scripts/demo/seed-organizacja-pilotaz.ts` | **WZÓR MECHANIZMU.** `--dry-run` / `--apply` / `--rollback`, `--oczekiwany-host` (guard bazy), deterministyczne UUIDv5 z e-maila, twarda idempotencja („drugi `--apply` musi dać `utworzono=0 zmieniono=0`"), hasła poza repo, zakaz `SUPERADMIN` |
| `server/scripts/higiena-wlasciciela/wspolne.ts` | Biblioteka trybów: wymusza `--org=` + dokładnie jeden z `--dry-run\|--apply\|--rollback=<manifest.json>`; manifest z `before`-snapshotem + CSV do `evidence/` |
| `server/scripts/usun-rekordy-aco.ts` | Referencyjny konsument powyższej biblioteki (chirurgiczne kasowanie agregatów runtime-v1) |
| `server/scripts/cleanup-orphan-demo-orgs.ts` | Najbliżej „usuń organizację": dry-run domyślnie, `--apply` **wymaga** `FORCE_PURGE=true`, odmowa na hoście produkcyjnym bez `ALLOW_PROD=true`, backup JSON. **Opisuje topologię: 164 klucze obce na `organizations.id` — 129 CASCADE, 8 SET NULL, 27 NO ACTION** (te 27 trzeba skasować ręcznie przed organizacją) |
| `server/scripts/seedLegolexDemoOrg.js:159-221` | Kompletna **kolejność DELETE** przy kasowaniu tenanta (20+ tabel) |
| `server/scripts/seed-demo-dataset-contract.ts:547-590` | `validateContract()` — asercje progowe (`initiatives>=8`, `tasks>=8`…). Wzór dla `--verify` |
| `server/scripts/seed-wave3-initiatives-owner-review.ts:422,640` | Precedens **SQL-owego seedu agregatów runtime-v1** (`INSERT INTO ie_aggregate_state`) z guardem hosta i sekcją weryfikacyjną |

**Nie ma** ogólnego `purge-tenant --org=<dowolna>`. D0 go zbuduje z powyższych
składników.

---

## 8. Kontrakty zapisu — co wolno SQL-em, a co musi przejść przez API

Ustalone grepem w `server/src` (cytaty `plik:linia`).

| Obiekt | Kanoniczna droga | Czy INSERT SQL wystarczy? |
|---|---|---|
| Projekt | `POST /api/projects` → `ProjectController.ts:263` | **TAK.** Uwaga na `projects.is_system` + partial unique `uq_projects_org_system_portfolio` (migracja 912) — portfel systemowy zakładaj przez `initiativeProjectPolicyService.ts:71` |
| Zadanie | `POST /api/tasks` → `TaskService.ts:153` | **TAK.** `tasks.routes.ts:61-80` mówi wprost: `postgresMaterialCommandUnitOfWork.ts` nie ma ani jednego `INSERT/UPDATE` na `tasks` — legacy jest dziś jedyną działającą drogą (bramka zdjęta DEC-453) |
| Spotkanie | `POST /api/meeting` → `meetingService.ts:331` | **TAK.** `legacyCutover/registry/meetings.ts`: „No canonical meeting-creation route exists" |
| Inicjatywa (legacy) | `POST /api/initiatives` → `createInitiativeService.ts` | **PRAWIE.** Zgubisz normalizację `name`+`title`, walidację lineage, auto-anchor projektu (`resolveOrCreateSystemPortfolioProject`), `assertCardMeetsFormula`, audyt. Wiersz i tak pokaże się na liście (merge legacy w `InitiativesHub`) |
| RAID | `POST /api/initiatives/runtime-v1/initiatives/:id/raid-items/:raidItemId` | **DEGRADUJE BEZPIECZNIE.** UoW robi dual-write do `raid_items` **i** `ie_aggregate_state`; czysty INSERT da widoczny wiersz (`raid.routes.ts:70-83` robi `LEFT JOIN`, `aggregateVersion: null` → writer adoptuje), ale bez CAS/outboxu/audytu |
| Kamień milowy | `POST /runtime-v1/execution-cases/:caseId/milestones/:id` | **TAK dla ekranu legacy** (`initiative_milestones` ma własnych pisarzy: `InitiativeController.ts:3531`, `initiatives.routes.ts:1831`), ale kamień nie pojawi się w realizacji runtime |
| Decyzja | `POST /api/decisions` → `DecisionController.ts:1345` | **PRAWIE.** Zgubisz `decision_history` i CAS `row_version`. Do listy wystarczy |
| **KPI (Wyniki)** | `POST /api/vnext/results/kpi` → `kpiDefinitionCommands.ts` → `platform/atomicWrite.ts` | **NIE.** Zgubisz event-log + outbox platformy (`20260809_rvn_platform_events_outbox.sql`), CAS `row_version`, `state_hash`, idempotencję, wersjonowanie `rvn_kpi_definition_versions`. **Najmocniejszy argument za seedem przez API** |
| **Agregat runtime-v1** | `POST /runtime-v1/registrations`; most: `POST /runtime-v1/planning/initiatives/:id/register` (`initiativesExecutionRuntime.routes.ts:3599`) | **NIE.** Zgubisz `ie_aggregate_state` (wersja CAS), `ie_audit_events`, `ie_outbox_events`, `ie_command_receipts`, `ie_aggregate_relations` → agregat nie istnieje dla planowania i realizacji |
| **Bramka cyklu życia** | `POST /api/initiatives/:id/lifecycle-gate-decisions` → `initiativeLifecycleGateDecisionService.ts:465` | **NIE.** 17 kolumn NOT NULL, w tym `source_digest` (sha256), `baseline_refs_json` (niepusta tablica), `a05_proposal_version_id` → FK do `v8_agent_proposal_versions`, `a05_approval_receipt_ref` → FK do `v8_agent_proposal_scope_reviews`. Trigger `initiative_lifecycle_gate_decisions_immutable` zabrania UPDATE/DELETE. Wartości: `approved` / `rejected` — **tylko dwie**, nie ma `CONDITIONAL` |

### 8.1 Fail-closed realizacji — trzy miejsca, nie jedno

1. `initiativesExecutionRuntime.routes.ts:4844-4860` — `GET /runtime-v1/execution-cases`:
   `projectIdOf()` zwraca `null` przy pustym `projectId`, filtr wyrzuca realizację z listy.
2. `initiativesExecutionRuntime.routes.ts:1446-1455` — `authorizeProjects`:
   `projectIds.length > 0 && (…).every(Boolean)` → **pusta lista projektów = brak dostępu**.
3. `executionBvpService.ts:198-201` — `required(String(payload_json.projectId||''),
   'execution_runtime_project_required')` → rzuca przy wpinaniu realizacji.

Obejście dla legacy: `registerModuleInitiativeForPlanning.ts:78-92` podstawia
`organizationId` jako zakres, gdy `project_id` jest NULL.
Bramka przy tworzeniu: `InitiativeController.ts:500-509` → `400
INITIATIVE_PROJECT_REQUIRED`, flaga `REQUIRE_INITIATIVE_PROJECT`
(`initiativeProjectPolicyService.ts:33-35`) **domyślnie ON**.

### 8.2 Ekran Inicjatyw czyta z DWÓCH źródeł

`src/components/Initiatives/InitiativesHub.tsx:522-575` —
`Promise.all([listRegisteredInitiatives(), listLegacyInitiatives()])` +
`mergeLegacyInitiativesIntoRegister(...)`, **bez flagi**. Powód (DEC-397,
komentarz `runtimeApi.ts:1256-1273`): DBR77 miało 71 wierszy legacy i 0 runtime,
więc lista była pusta. **Skutek dla seedu:** inicjatywa wstawiona SQL-em do
`initiatives` BĘDZIE widoczna na liście; nie będzie widoczna w planowaniu ani
realizacji, dopóki nie przejdzie przez `register`.

---

## 9. Zapytania

Wszystkie w [`POMIAR.sql`](POMIAR.sql), numeracja Q1–Q15 zgodna z powyższymi
odwołaniami.
