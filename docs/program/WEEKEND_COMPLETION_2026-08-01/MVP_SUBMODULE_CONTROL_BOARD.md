---
doc_id: mvp-submodule-control-board-2026-08-01
truth_type: delivery-status
status: canonical-working
owner: codex
business_owner: piotr
last_reviewed: 2026-08-02
---

# Board podmodułów MVP

## Zastosowanie

To jest operacyjna jednostka sterowania wdrożeniem. Status całego modułu nie
może zastąpić statusów jego podmodułów. Raport agenta nie zmienia statusu:
`CODE_GO_FROZEN` nadaje wyłącznie Codex po niezależnym review.

Statusy:

- ✅ `CODE_GO_FROZEN` — kod lokalnie przyjęty, zatrzymany do integracji;
- 🔵 `AWAITING_CODEX_REVIEW` — implementator skończył, Codex jeszcze nie przyjął;
- 🟡 `ACTIVE_BUILD` / `ACTIVE_FIX` — praca nadal trwa;
- `ACTIVE_BUILD` — trwa implementacja;
- `ACTIVE_FIX` — review wykazało blocker i trwa korekta;
- `PARTIAL_EXISTING` — istotny kod istnieje, ale brakuje pełnego dowodu MVP;
- `NOT_VERIFIED` — powierzchnia istnieje, ale nie przeszła bieżącego remanentu;
- `MISSING` — wymagany element nie istnieje;
- `BLOCKED` — znany defekt uniemożliwia uczciwy odbiór;
- `INTEGRATION_REQUIRED` — komponenty istnieją, lecz nie tworzą aktywnego flow;
- `OUTSIDE_MVP` — jawnie odroczone.
- `PAUSED_FOR_PLAN_HANDOFF` — niezakończony packet zachowany do przejęcia przez
  workera w kolejnym planie taryfowym; nie oznacza odbioru ani porzucenia pracy.

## Licznik postępu

Stan po odbiorach i zatrzymaniu bieżącego planu taryfowego 2026-08-02:

| Kategoria | Liczba | Udział wszystkich 93 podmodułów |
| --- | ---: | ---: |
| ✅ Lokalnie zrobione i odebrane (`CODE_GO_FROZEN`) | 66 | 71,0% |
| 🔵 Zrobione przez agenta, czekają na odbiór Codex | 0 | 0,0% |
| 🟡 Aktywnie wykonywane w kończącym się planie | 0 | 0,0% |
| ⚪ Pozostałe w zakresie MVP | 26 | 28,0% |
| ⏸ Poza MVP | 1 | 1,1% |

Trzy work packets wymagają przekazania do kolejnego planu: `FIN-05`, `MAT-10`
oraz niezintegrowana korekta `INT-08`. Ostatni z nich dotyczy pozycji już
odebranej na branchu integracyjnym, dlatego nie zwiększa licznika brakujących
podmodułów; nowy worker ma najpierw rozstrzygnąć relację jego branchu do
zamrożonego dowodu, a nie automatycznie nadpisywać status `CODE_GO_FROZEN`.

### ✅ Zrobione i lokalnie odebrane

- [x] `MAT-01` — kanoniczny Materials registry i lifecycle list→open
- [x] `MAT-02` — utworzenie dokumentu, ręczna edycja, trwały autosave i reopen
- [x] `MAT-03` — wersje, checkpoint i restore dokumentu
- [x] `MAT-04` — trwały share→public read→rotate→revoke dokumentu
- [x] `MAT-05` — trwały workbook create→edit→formula→reopen→XLSX
- [x] `MAT-06` — workbook version/checkpoint/restore/share/revoke oraz bezpieczny XLSX/CSV
- [x] `MW-09` — Ideas owner create→update→read-back→UI reopen
- [x] `CHAT-01` — trwała, tenant-scoped historia sesji po hard reloadzie
- [x] `MAT-08` — historia i restore prezentacji
- [x] `FIN-01` — Finance Hub / coherence Atelier
- [x] `FIN-02` — kalkulacje inwestycyjne
- [x] `MW-01` — materializacja i triage Inbox
- [x] `MW-02` — Inbox → Task golden flow
- [x] `MW-03` — szczegóły i aktualizacja Task
- [x] `MW-04` — współpraca nad istniejącą decyzją
- [x] `CHAT-06` — trwałość Canvas
- [x] `INT-05` — submit z trwałym snapshotem odpowiedzi i blokadą edycji podczas review
- [x] `INT-06` — manager accept/return przez UI z trwałym read-backiem w PostgreSQL
- [x] `INT-04` — trwały audyt sugestii Teresy generate→accept/reject z read-backiem
- [x] `INT-07` — trwały generator insightów create→completed→SQL→reopen
- [x] `INT-02` — assignment z kontrolą roli/tenantu, mirror taskiem i trwałym notification read-backiem
- [x] `INI-06` — fundament bramki decyzji GO/NO-GO
- [x] `EXE-07` — canonical start/unblock dla ścieżek HTTP i cron
- [x] `INI-01` — kanoniczna lista i routing Initiatives
- [x] `INI-02` — Candidate intake z retry po nieudanym utworzeniu
- [x] `INI-03` — dedupe/merge z trwałym, idempotentnym receipt
- [x] `INI-09` — lineage source→candidate→initiative
- [x] `INI-08` — trwała, deterministyczna kompozycja dynamicznych kart
- [x] `RES-01` — kanoniczny Results Hub i przekierowania legacy
- [x] `RES-05` — współbieżny Deviation Case i pełny audyt lifecycle
- [x] `EXE-01` — kanoniczny Execution Hub i przekierowania legacy
- [x] `MW-08` — core lifecycle Notatek, ponowne otwarcie i izolacja organizacji
- [x] `ASM-01` — Library i pięć surfaces
- [x] `ASM-02` — Process/session creation
- [x] `ASM-03` — DRD Form save/read-back
- [x] `ASM-04` — DRD Matrix parity
- [x] `RES-06` — Recovery Card
- [x] `RES-07` — Recovery→Task handoff
- [x] `RES-08` — Effectiveness/close gate
- [x] `RES-13` — Legacy benefits RBAC parity
- [x] `INI-07` — SCHEDULED→EXECUTING same ID
- [x] `MW-05` — tworzenie prawdziwej decyzji
- [x] `MW-06` — aktywne DecisionWorkspace bez localStorage jako źródła prawdy
- [x] `TLS-02` — SWOT create/start/resume z trwałym PostgreSQL read-backiem
- [x] `TLS-03` — SWOT navigation/edit/autosave i hard-reload bez utraty danych
- [x] `TLS-05` — quality/review/approve z immutable snapshotem i bezpiecznym RBAC
- [x] `TLS-06` — zatwierdzony SWOT→kanoniczny raport→read-back→PDF→reopen/hard reload
- [x] `INT-03` — respondent session→save answer→fresh same-ID resume, real-PG read-back i izolacja tenantów
- [x] `EXE-02` — trwały plan/tasks/milestones z idempotentnym retry
- [x] `EXE-03` — role/resources/capacity z project scope i reopen
- [x] `EXE-04` — trwały RAID z dedupe pod concurrency
- [x] `ASM-05` — evidence/scoring z izolacją tenantów i kontrolą ról
- [x] `ASM-06` — atomowy accept/return z lockiem, audytem i rollbackiem
- [x] `ASM-07` — immutable output i dokładnie jeden current snapshot pod concurrency
- [x] `FIN-03` — aktywny Investment Case save/version/CAS conflict i trwały reopen
- [x] `FIN-04` — aktywne scenarios/baseline z trwałym read-backiem
- [x] `MAT-07` — Presentation create/open/edit/autosave/hard reload na kanonicznym decku
- [x] `MAT-09` — aktualny PPTX/PDF, share/public read/revoke oraz fresh-DB guard
- [x] `TLS-01` — Tools Library i pięć stabilnych, URL-routowalnych surfaces
- [x] `ASM-08` — accepted Assessment Output→kanoniczny Candidate z lineage i idempotentnym receipt
- [x] `EXE-05` — canonical change/decision lifecycle z idempotency, audit i tenant isolation
- [x] `EXE-06` — spójny progress/reforecast read-back z concurrency guard
- [x] `EXE-08` — closure/evidence gate z zatwierdzeniem przed DONE
- [x] `INT-08` — Interview accepted output→kanoniczny Candidate z receipt i lineage
- [x] `TLS-07` — SWOT recommendation→kanoniczny Candidate z receipt i lineage

Te pozycje są ukończone lokalnie, ale nadal mogą wymagać integracji i testu na
środowisku demo.

### 🔵 Zrobione przez agenta, czekają na odbiór

Brak.

### 🔴 Zweryfikowane, ale wymagające integracji

Brak w zamkniętej fali A/B/C. Integracja z szerszym MVP i Railway `demo` jest
oddzielną bramką wydania, a nie ponownym otwarciem dziewięciu odebranych zadań.

### ⏸ Wstrzymane do przekazania między planami taryfowymi

- [ ] `FIN-05` — Statement upload→extract→map — `PAUSED_FOR_PLAN_HANDOFF`,
  branch `feat/fin-005-statement-ingestion-golden-flow`, ostatni odrzucony HEAD
  `03f01021ac`; otwarty blocker: trwały exactly-once result dla keyed uploadu.
- [ ] `MAT-10` — Artifact Receipt/lineage — `PAUSED_FOR_PLAN_HANDOFF`, branch
  `feat/mat-010-canonical-artifact-receipt-lineage`, reviewed HEAD
  `48a757ba2c`; otwarte: pełne real-route hooks, durable recovery i cache tenant leak.
- [x] `INT-08` — status kanoniczny pozostaje `CODE_GO_FROZEN`; osobny branch
  `feat/int-008-canonical-candidate-handoff` / `1c4a430154` ma niezacommitowany
  fix packet i wymaga najpierw audytu kolizji/supersession w nowym planie.

## Snapshot wykonawczy

| Linia | Zakres | Branch / HEAD | Stan |
| --- | --- | --- | --- |
| Finance frozen | FIN-005 | `fix/fin-005-atelier-coherence` / `fbadd3c263` | `CODE_GO_FROZEN` |
| My Work core frozen | Inbox→Task | `feat/mw-core-001-inbox-task-golden-flow` / `bdb93afd3c` | `CODE_GO_FROZEN` |
| Decision foundation frozen | istniejąca decyzja | `feat/mw-dec-001-canonical-decision-workflow` / `d1826a474f` | `CODE_GO_FROZEN` |
| A frozen | Assessment DRD round-trip | `feat/asm-001a-drd-form-matrix-roundtrip` / `a3205f1151` | `CODE_GO_FROZEN` |
| B frozen | Results Deviation→Recovery | `feat/res-002-canonical-kpi-recovery-loop` / `882a721a92` | `CODE_GO_FROZEN` |
| C frozen | Decision→Initiative→Execution | `integrate/decision-initiative-execution-gate` / `7b59d3a63b` | `CODE_GO_FROZEN` |
| Wave 1+2+EXE-08+INT-08+TLS-07 integration frozen | zintegrowany core MVP, closure gate oraz Interview/SWOT→Candidate | `integrate/mvp-wave1-abc` / `01cb107b2c` | `CODE_GO_FROZEN_INTEGRATION` |
| Line 2 frozen | Decision create/live | `feat/mw-005-006-decision-create-live` / `59360f9ec1` | `CODE_GO_FROZEN` |
| Codex Materials frozen | Document share/rotate/revoke | `codex/mat-document-share-revoke` / `f24248bac8` | `CODE_GO_FROZEN` |
| Codex Materials frozen | Registry list→Document Studio open | `codex/mat-materials-library-list-open` / `783e64dacb` | `CODE_GO_FROZEN` |
| Codex Materials frozen | Workbook create/edit/formula/reopen | `codex/mat-materials-library-list-open` / `598613179c` | `CODE_GO_FROZEN` |
| Codex My Work frozen | Ideas owner lifecycle | `codex/mat-materials-library-list-open` / `86f5c4024b` | `CODE_GO_FROZEN` |
| Codex Chat frozen | Session history/read-back/tenant isolation | `codex/mat-materials-library-list-open` / `bd9bb884b4` | `CODE_GO_FROZEN` |
| Codex Interview frozen | Manager accept/return przez UI | `codex/tls-swot-conclusion-fix` / `4512a8c492` | `CODE_GO_FROZEN` |
| Codex Interview frozen | Teresa suggestion provenance/audit | `codex/tls-swot-conclusion-fix` / `ce9e4cfa09` | `CODE_GO_FROZEN` |
| Codex Interview frozen | Insight generation persistence/reopen | `codex/tls-swot-conclusion-fix` / `0ce4640146` | `CODE_GO_FROZEN` |
| Codex Interview frozen | Assignment tenant/role/delivery proof | `codex/tls-swot-conclusion-fix` / `de35c444c4` | `CODE_GO_FROZEN` |
| Codex Results frozen | Deviation Case concurrency/audit | `codex/tls-swot-conclusion-fix` / `f903185f0b` | `CODE_GO_FROZEN` — atomowy upsert, pełny lifecycle i trwały actor audit; real-PG 1/1 |
| Line 5 frozen | Assessment evidence/quality/immutable output | `feat/asm-005-007-quality-output` / `a0dad7d024` | `CODE_GO_FROZEN` — atomowy review, fault injection i concurrency, real-PG 16/16 |
| Line 1 frozen | Finance case/scenarios | `feat/fin-003-004-case-scenario-lifecycle` / `4811abcb94` | `CODE_GO_FROZEN` — aktywny UI, CAS/read-back/baseline; Codex scoped run 20/20 |
| Codex Tools frozen | SWOT create/resume/navigation/edit/approve/report | `codex/tls-swot-conclusion-fix` / `d20fbac2d4` | `CODE_GO_FROZEN` — TLS-02/03/05/06; real-PG, immutable approval, trwały Report Builder read-back, PDF i hard reload zielone |
| Line 3 frozen | Presentations | `feat/mat-007-009-presentation-golden-flow` / `edd394c164` | `CODE_GO_FROZEN` — browser edit/reload, real PPTX/PDF 200 dla quality content, share/revoke i additive fresh-DB guard |
| Line 4 frozen | Execution management spine | `feat/exe-002-004-management-spine` / `8e20a450eb` | `CODE_GO_FROZEN` — świeży schemat i pełny real-PG 11/11 |
| Line 2 frozen | Tools five surfaces | `feat/tls-001-003-swot-golden-flow` / `0ab035a572` | `CODE_GO_FROZEN` — Codex scoped URL/deep-link run 12/12 |
| Line 2 frozen | Teresa-assisted SWOT | `feat/tls-004-teresa-assisted-swot` / `d383ac7106` | `CODE_GO_FROZEN` — reviewed code `e9ee56a26a`; Codex independent 43/43 PASS; final docs-only correction clean |
| Line 5 frozen | Assessment Candidate handoff | `feat/asm-008-candidate-pack-handoff` / `da06ad77a7` | `CODE_GO_FROZEN` — canonical writer, retry/concurrency/rollback, Codex real-PG 10/10 |
| Line 4 frozen | Execution changes/progress | `feat/exe-005-006-change-progress-spine` / `fc0eb001a9` | `CODE_GO_FROZEN` — session-derived decision maker; Codex isolated real-PG 12/12 |
| Line 1 paused | Statement ingestion | `feat/fin-005-statement-ingestion-golden-flow` / `03f01021ac` | `PAUSED_FOR_PLAN_HANDOFF` — keyed-upload marker nadal fail-open |
| Line 3 frozen | Workbook version/share/export | `feat/mat-006-workbook-version-share-export` / `8fac42e85e` | `CODE_GO_FROZEN` — Codex isolated real-PG 11/11 |
| Line 2 frozen | Teresa-assisted SWOT | `feat/tls-004-teresa-assisted-swot` / `d383ac7106` | `CODE_GO_FROZEN` — Codex independent 43/43 |
| Line 4 frozen | Closure/evidence gate | `integrate/mvp-wave1-abc` / `0ff97ecc1b` | `CODE_GO_FROZEN` — pełny Execution real-PG 32/32, UI+closure 17/17, type-check PASS, migracja replay-safe |
| Line 5 frozen | Interview→canonical Candidate | `integrate/mvp-wave1-abc` / `692bbc855d` | `CODE_GO_FROZEN` — real-PG 12/12, Candidate writer 38/38, type-check PASS, świeży schemat i helper transakcyjny uzgodnione w integracji |

HEAD jest tylko snapshotem. Każdy tracker ma ponownie sprawdzić branch i drzewo.

## Materials

| ID | Podmoduł | Stan | Dowód bieżący | Następna bramka |
| --- | --- | --- | --- | --- |
| MAT-01 | Library i registry | `CODE_GO_FROZEN` | `783e64dacb` nad `f24248bac8`; real-PG: Document Studio create→dokładnie 1 wpis `native_artifact`→Documents/„Pokaż robocze”→dwuklik→ten sam artifactId w owning runtime, Playwright 1/1; artifacts routes 22/22 | integracja i Railway demo z rollout flags/allowlistą zgodną ze środowiskiem |
| MAT-02 | Documents create/edit/autosave | `CODE_GO_FROZEN` | `df79799cf4`; UI Czysto→TipTap edit→autosave→hard reload 1/1; API save/read-back/409 1/1; real PostgreSQL CAS: 1 winner + 1 conflict + durable read-back | integracja gałęzi; bez ponownego otwierania zakresu MAT-03/04 |
| MAT-03 | Document version/checkpoint/restore | `CODE_GO_FROZEN` | `MAT-005A` | integracja z pełnym lifecycle |
| MAT-04 | Document export/share/revoke | `CODE_GO_FROZEN` | `f24248bac8`; owner UI→share→public read→rotate (stary token 404)→revoke (nowy token 404) Playwright 1/1; service 36/36, routes 25/25; real-PG cold restart i CAS race rotate/revoke PASS | integracja gałęzi i Railway demo; bez ponownego otwierania MAT-02/03 |
| MAT-05 | Workbook create/edit/formula/reopen | `CODE_GO_FROZEN` | `598613179c`; create z UI→A2=21→B2=`=A2*2`/wynik 42→hard reload→XLSX read-back na real-PG, cross-tenant 404, fail-closed create; Playwright 1/1, unit/integration 17/17, build i type-check PASS | integracja gałęzi i Railway demo; wersje/share pozostają wyłącznie w MAT-06 |
| MAT-06 | Workbook version/share/export | `CODE_GO_FROZEN` | `8fac42e85e`; Codex isolated real-PG 11/11: CAS/concurrency, atomowy restore+rollback, tenant isolation, share/public/revoke oraz bezpieczny XLSX/CSV; agent udokumentował real-browser create→edit→checkpoint→restore→reload→share→revoke→export | integracja i niezależny visual capture; przy integracji pominąć nieużywany wpis MAT-006 w `.claude/launch.json` |
| MAT-07 | Presentation generate/edit/autosave | `CODE_GO_FROZEN` | `edd394c164`; canonical deck create/open, real-browser edit→autosave→hard reload i targeted 10/10 | integracja i niezależny visual capture |
| MAT-08 | Presentation history/restore | `CODE_GO_FROZEN` | `MAT-006A`, CAS 409/read-back | połączenie z naprawionym deckiem |
| MAT-09 | Presentation PPTX/PDF/share/revoke | `CODE_GO_FROZEN` | `edd394c164`; quality content→real PPTX/PDF 200, placeholder→uczciwe 422, share→public 200→revoke→404; additive fresh-DB guard | integracja i niezależny visual capture |
| MAT-10 | Artifact receipt i lineage | `PAUSED_FOR_PLAN_HANDOFF` | `48a757ba2c`; rdzeń receipt i Workbook 12/12 istnieją, lecz review odrzucił niepełne real-route hooks, fail-open lineage oraz tenant leak cache | przejęcie fix packetu w kolejnym planie |

## Finance

| ID | Podmoduł | Stan | Dowód bieżący | Następna bramka |
| --- | --- | --- | --- | --- |
| FIN-01 | Finance Hub/coherence Atelier | `CODE_GO_FROZEN` | `fbadd3c263`, testy lokalne i real-PG | integracja i Railway demo |
| FIN-02 | Investment calculations | `CODE_GO_FROZEN` | NPV/IRR/payback, poprawiony znak OpEx i stopa | integrated UI read-back |
| FIN-03 | Investment Case save/version/reopen | `CODE_GO_FROZEN` | `4811abcb94`; aktywny `FinancialModelWorkspace`, CAS conflict, success po read-backu, Codex scoped run 20/20 | integracja i niezależny visual capture |
| FIN-04 | Scenarios/baseline | `CODE_GO_FROZEN` | `4811abcb94`; Base/Upside/Downside, atomowy baseline, backend re-fetch/reopen i cross-org guard | integracja i niezależny visual capture |
| FIN-05 | Statement upload/extract/map | `PAUSED_FOR_PLAN_HANDOFF` | `03f01021ac`; strict fresh-schema i XLSX/CSV przechodzą, lecz sukces keyed uploadu może istnieć bez trwałego markera | exactly-once marker/result i fault-recovery w kolejnym planie |
| FIN-06 | Candidate Pack→Initiative | `MISSING` | historyczny direct create i fake receipt | canonical Candidate Pack z dedupe |
| FIN-07 | Post-investment actuals | `MISSING` | brak zamkniętej pętli | Results/Execution→Finance round-trip |

## Results/KPI

| ID | Podmoduł | Stan | Dowód bieżący | Następna bramka |
| --- | --- | --- | --- | --- |
| RES-01 | Results Hub/canonical route | `CODE_GO_FROZEN` | `61381da0f9`; lokalny mock runtime: `/results`, `/benefits`, `/kpi-okr`, sidebar i query/hash; kontrakt 6/6, browser 5/5 | integracja i Railway demo |
| RES-02 | KPI catalog/definition | `PARTIAL_EXISTING` | `initiative_kpis` żywe, multi-writer | jeden owner i versioning |
| RES-03 | KPI measurement/time series | `PARTIAL_EXISTING` | zapis i read-back istnieją | idempotency i wszystkie writery |
| RES-04 | Threshold evaluation | `PARTIAL_EXISTING` | działa na głównych Results writes | adapter dla Initiative/Execution |
| RES-05 | Deviation Case | `CODE_GO_FROZEN` | `f903185f0b`; atomowy upsert po `(organization_id, kpi_id, period_start)` scala 8 równoległych zapisów do jednego case ID i ponownie otwiera ten sam rekord; realny V8 HTTP→PostgreSQL potwierdza acknowledge→RCA→action→resolve→close z evidence, aktorem i 15 trwałymi wpisami audytu; acceptance 1/1, unit/router 63/63, pełny type-check PASS | integracja commita i Railway demo smoke; migracja 750 musi być obecna w środowisku |
| RES-06 | Recovery Card | `CODE_GO_FROZEN` | `882a721a92`; real owner object i lifecycle | integracja i demo |
| RES-07 | Recovery→Task handoff | `CODE_GO_FROZEN` | durable reference/read-back/retry | integracja i demo |
| RES-08 | Effectiveness/close gate | `CODE_GO_FROZEN` | measurement→review→close/continue/escalate | integracja i demo |
| RES-09 | Strategic OKR | `PARTIAL_EXISTING` | osobny `okr_*` CRUD | definition quality gate `RES-002` |
| RES-10 | Goals/scorecards | `INTEGRATION_REQUIRED` | UI miesza Initiatives goals z Results | rozdzielenie ownership, bez migracji danych teraz |
| RES-11 | Visibility/roll-up | `MISSING` | tylko org scope, brak polityki visibility | `RES-004` |
| RES-12 | Reporting snapshot | `PARTIAL_EXISTING` | cząstkowe raporty | immutable snapshot z lineage |
| RES-13 | Legacy benefits RBAC parity | `CODE_GO_FROZEN` | fail-closed parity i negative tests w `882a721a92` | integracja i demo |

## Initiatives

| ID | Podmoduł | Stan | Dowód bieżący | Następna bramka |
| --- | --- | --- | --- | --- |
| INI-01 | Canonical List/routing | `CODE_GO_FROZEN` | browser: realna tabela 71 rekordów; `/portfolio`→`/initiatives` zachowuje query/hash; routing 10/10, statusy 10/10 | integracja i Railway demo |
| INI-02 | Candidate intake | `CODE_GO_FROZEN` | `63674e692d`; status accepted dopiero po utworzeniu/powiązaniu inicjatywy; błąd pozostawia retry; unit+integration 72/72 | integracja i Railway demo |
| INI-03 | Candidate dedupe/merge | `CODE_GO_FROZEN` | `63674e692d`; jawny duplicate receipt, retry nie tworzy i nie wypełnia ponownie; unit+integration 72/72 | integracja i Railway demo |
| INI-04 | Roles/project/approval profile | `PARTIAL_EXISTING` | owner/sponsor/RACI/effective roles | jedna capability matrix |
| INI-05 | Portfolio/resources/roadmap | `PARTIAL_EXISTING` | kilka realnych read modeli | update→read-back→reopen |
| INI-06 | GO/NO-GO decision gate — C-owned foundation | `CODE_GO_FROZEN` | `06cd5a0c36`; pinned-client recheck, 39/39 real-PG | kontrolowana naprawa Decision writerów |
| INI-07 | SCHEDULED→EXECUTING same ID | `CODE_GO_FROZEN` | `7b59d3a63b`; Decision BLOCK/UNBLOCK przez canonical transition, 89/89 | integracja i browser demo |
| INI-08 | Dynamic initiative cards | `CODE_GO_FROZEN` | `c568f0126d`; create→response→real-PG reopen zachowuje cardScope, visibility, order i config; unit 13/13; cleanup 0 rekordów | integracja i Railway demo |
| INI-09 | Source lineage/Candidate receipt | `CODE_GO_FROZEN` | `63674e692d`; trwałe source_type/source_id→candidateId→initiativeId + accepted_at; migracja sprawdzona na realnym Postgres | integracja i Railway demo |

## Execution

| ID | Podmoduł | Stan | Dowód bieżący | Następna bramka |
| --- | --- | --- | --- | --- |
| EXE-01 | Canonical List/routing | `CODE_GO_FROZEN` | `230c00cdee`; lokalny mock runtime: `/execution`, `/implementation`, `/rollout`, sidebar i ten sam initiativeId/query/hash; kontrakt 5/5, browser 6/6 | integracja i Railway demo |
| EXE-02 | Plan/tasks/milestones | `CODE_GO_FROZEN` | `8e20a450eb`; fresh-PG, idempotent retry i pełny spine 11/11 | integracja i Railway demo |
| EXE-03 | Roles/resources/capacity | `CODE_GO_FROZEN` | `8e20a450eb`; project scope, reopen i cross-tenant guard w pełnym real-PG 11/11 | integracja i Railway demo |
| EXE-04 | RAID | `CODE_GO_FROZEN` | `8e20a450eb`; persistence oraz race/dedupe w pełnym real-PG 11/11 | integracja i Railway demo |
| EXE-05 | Changes/decisions | `CODE_GO_FROZEN` | `fc0eb001a9`; canonical endpoint, session-derived decision maker, idempotency/concurrency i cross-tenant guard; Codex isolated real-PG 12/12 | integracja i visual capture |
| EXE-06 | Progress/reforecast/EVM | `CODE_GO_FROZEN` | `fc0eb001a9`; progress/reforecast/audit/reopen, idempotency i concurrency; Codex isolated real-PG 12/12 | integracja i visual capture |
| EXE-07 | Start/unblock transition — C-owned paths | `CODE_GO_FROZEN` | `06cd5a0c36`; HTTP/cron/unblock przez canonical engine | Decision auto-unblock musi użyć tego samego engine |
| EXE-08 | Closure/evidence | `CODE_GO_FROZEN` | `0ff97ecc1b`; zintegrowany draft→evidence→submit→return/resubmit→approve→DONE, stale-version 409, idempotentny i współbieżny approve, tenant isolation; pełny Execution real-PG 32/32, komponent+closure 17/17, type-check PASS; aktywna migracja poprawiona do bezbłędnego replay na PostgreSQL | Railway demo i visual capture |
| EXE-09 | Closure→Results/Finance | `INTEGRATION_REQUIRED` | fire-and-forget handoff | transakcyjny/idempotentny receipt |

## Assessment

| ID | Podmoduł | Stan | Dowód bieżący | Następna bramka |
| --- | --- | --- | --- | --- |
| ASM-01 | Library i pięć surfaces | `CODE_GO_FROZEN` | `a3205f1151`; canonical tabs i published definition | integracja i demo |
| ASM-02 | Process/session creation | `CODE_GO_FROZEN` | org-scoped definition ID/version | integracja i demo |
| ASM-03 | DRD Form save/read-back | `CODE_GO_FROZEN` | real-PG 5/5 w czystym env | integracja i demo |
| ASM-04 | DRD Matrix parity | `CODE_GO_FROZEN` | Form/Matrix parity i per-axis levelCount | integracja i demo |
| ASM-05 | Evidence/scoring | `CODE_GO_FROZEN` | `a0dad7d024`; evidence/scoring, tenant/role i real-PG 16/16 | integracja i Railway demo |
| ASM-06 | Quality review | `CODE_GO_FROZEN` | `a0dad7d024`; pinned-client transaction, row lock, audit/status/snapshot atomowo, fault-injection rollback | integracja i Railway demo |
| ASM-07 | Immutable output/report | `CODE_GO_FROZEN` | `a0dad7d024`; concurrent double-accept zachowuje dokładnie jeden current snapshot | integracja i Railway demo |
| ASM-08 | Candidate Pack handoff | `CODE_GO_FROZEN` | `da06ad77a7`; canonical Candidate writer, persistent receipt/lineage, retry/concurrency/rollback; Codex real-PG 10/10 | integracja i visual capture |
| ASM-09 | SIRI/ADMA packs | `OUTSIDE_MVP` | kod i KB istnieją | po DRD MVP |

## Tools

| ID | Podmoduł | Stan | Dowód bieżący | Następna bramka |
| --- | --- | --- | --- | --- |
| TLS-01 | Library/five surfaces | `CODE_GO_FROZEN` | `0ab035a572`; Library/Sessions/Outputs/Reports/Initiatives są URL-first, deep-link/back-forward/hard reload; Codex scoped run 12/12 | integracja i visual capture |
| TLS-02 | SWOT create/start/resume | `CODE_GO_FROZEN` | `aa7ec91ead`; real-PG browser create→deep-link→resume→hard reload 1/1; H31 lifecycle + conclusion bridge + cross-tenant isolation 1/1; formalna migracja archive columns | integracja i Railway demo |
| TLS-03 | SWOT navigation/edit | `CODE_GO_FROZEN` | `aa7ec91ead`; UI edycja weakness→API/PG read-back→hard reload 1/1; component navigation/unmount autosave + ACL 10/10; type-check PASS | integracja i Railway demo |
| TLS-04 | Teresa-assisted SWOT | `CODE_GO_FROZEN` | `d383ac7106`; proposal lifecycle, server-owned CAS, immutable editedAfter, semantic source/target validation, honest model provenance; Codex independent 43/43 PASS | integracja lokalna i visual acceptance |
| TLS-05 | Quality/finalize | `CODE_GO_FROZEN` | `737a9384ca`; UI request-review→approve→hard reload 1/1; snapshot równy trwałemu stanowi z chwili approval; PUT po approval 409; USER 403, cross-tenant 404; backend contracts 28/28 i type-check PASS | integracja i Railway demo |
| TLS-06 | Output/report reopen | `CODE_GO_FROZEN` | `d20fbac2d4`; UI Generate report zapisuje kanoniczny `report_builder_reports` z treścią i lineage; API/PG read-back, quality-gated PDF, Report Builder reopen i hard reload 1/1; idempotentny link i fail-closed zapis | integracja i Railway demo |
| TLS-07 | Candidate handoff | `CODE_GO_FROZEN` | `01cb107b2c`; Dynamic SWOT nie tworzy już Initiative bezpośrednio: wspólny Candidate writer + atomowy receipt, retry/concurrency/rollback i tenant isolation; real-PG 8/8, Candidate regression 38/38, type-check i build PASS | Railway demo i visual capture |

## Interview

| ID | Podmoduł | Stan | Dowód bieżący | Następna bramka |
| --- | --- | --- | --- | --- |
| INT-01 | Template library/editor | `PARTIAL_EXISTING` | dojrzały Hub | publish/version E2E |
| INT-02 | Assignment/invitations | `CODE_GO_FROZEN` | `de35c444c4`; real-PG/router: zwykły członek nie może tworzyć assignmentów (403), foreign-admin nie może przypisać użytkownika z obcego tenantu (`ASSIGNEE_NOT_IN_ORG`), owner tworzy assignment ze snapshotem template version i mirror taskiem; SQL potwierdza assignment/task/notification receipt, a odbiorca widzi to samo powiadomienie po świeżym GET `/api/notifications`; acceptance 1/1 i pełny type-check PASS | integracja commita i Railway demo smoke |
| INT-03 | Respondent session/save/resume | `CODE_GO_FROZEN` | `9ff284e6fd` + `387e662534`; real-PG API/SQL create→question→save→same-ID read-back/progress, obcy user/org ma 404 na read/write bez nadpisania; browser real-PG: jawna tenantowa flaga V8, save przez PATCH, świeży deep-link tego samego `sessionId`, wybór tego samego pytania i identyczna odpowiedź; acceptance 1/1, Playwright 1/1, flag service 38/38, type-check PASS | integracja commita i Railway demo smoke |
| INT-04 | Teresa answer assistance | `CODE_GO_FROZEN` | `ce9e4cfa09`; fail-closed generate zapisuje actor/source/model/provider/prompt metadata i draft; jawny Save atomowo zapisuje finalną odpowiedź oraz `accepted`, Cancel trwale zapisuje `rejected`; replay accepted suggestion daje 409; real-PG/router lifecycle + foreign tenant 404 + fresh audit read-back 1/1, UI/regresje 25/25, pełny type-check i migracja PASS | integracja commita i Railway demo smoke |
| INT-05 | Verification/submit | `CODE_GO_FROZEN` | `50e4edac4e`; submit zapisuje fail-closed, append-only snapshot `reason=submission` przed zmianą stanu; `submitted` blokuje zmianę odpowiedzi/notatek/evidence do jawnego send-back; real-PG HTTP: submit→SQL snapshot→edit 409, foreign tenant 404, send-back→edit→resubmit z drugim snapshotem→approve→edit 409; acceptance 1/1, unit 14/14, type-check PASS | integracja commita i Railway demo smoke |
| INT-06 | Manager accept/return | `CODE_GO_FROZEN` | `4512a8c492`; naprawiono brakujące podłączenie akcji approve/send-back w aktywnym manager preview; realny Chromium + real-PG potwierdza klikowy send-back→`in_progress` oraz approve→assignment `approved` i session `completed`; Playwright 1/1, regresje Interview 23/23, pełny type-check PASS | integracja commita i Railway demo smoke |
| INT-07 | Insight generator | `CODE_GO_FROZEN` | `0ce4640146`; jeden `InterviewInsightService` obsługuje create/generate/regenerate/read; naprawiono automatyczną migrację pól V6 i opcjonalny brak `user_profile_extended`; real-PG/router: approved source→async `completed`→SQL summary/source/evidence→fresh GET, foreign tenant 404; acceptance 1/1, generator/lineage/UI 14/14, pełny type-check PASS | integracja commita i Railway demo smoke |
| INT-08 | Candidate generator | `CODE_GO_FROZEN` | `692bbc855d`; zaakceptowany submission lub insight-finding trafia przez wspólny `initiative_candidates` writer, z trwałym receipt/lineage, rozróżnionymi typami źródła, idempotentnym retry, concurrency i rollbackiem; real-PG 12/12, wspólna regresja Candidate 38/38, type-check PASS | Railway demo i visual capture |

## My Work

| ID | Podmoduł | Stan | Dowód bieżący | Następna bramka |
| --- | --- | --- | --- | --- |
| MW-01 | Inbox materialization/triage | `CODE_GO_FROZEN` | Line A, real-PG 17/17 | integracja i migration renumber |
| MW-02 | Inbox→Task golden flow | `CODE_GO_FROZEN` | owner-scoped close i recovery | integrated browser spine |
| MW-03 | Task detail/update | `CODE_GO_FROZEN` | canonical `PUT /api/tasks/:id` | integration/shared UI |
| MW-04 | Existing Decision collaboration | `CODE_GO_FROZEN` | backend 31/31, frontend 14/14 | live swap po integracji |
| MW-05 | Decision creation | `CODE_GO_FROZEN` | `59360f9ec1`; create→GET→reopen, real-PG 6/6 | integracja i demo |
| MW-06 | Decision live wiring | `CODE_GO_FROZEN` | DecisionWorkspace default ON z kill-switchem; test flagi 5/5 | integracja i demo |
| MW-07 | Calendar/time/capacity | `PARTIAL_EXISTING` | read i integracje istnieją | provider/project markers E2E |
| MW-08 | Notes — core lifecycle | `CODE_GO_FROZEN` | `19091b826d`; real-PG API 5/5: create→raw DB→update→same-ID reopen + obcy tenant read/write/delete odrzucony; real-PG browser 1/1: notebook + 2 notes, autosave obu tytułów, przełączenie, tag i reopen; cleanup 0 | UI/UX `FIX_REQUIRED`: responsive, save/conflict state, owner/visibility, minimalizm; potem integracja i Railway demo |
| MW-09 | Ideas | `CODE_GO_FROZEN` | `86f5c4024b`; real-PG create→update→GET read-back→lista UI→hard reload→open preview; obcy tenant read/write 404 i brak nadpisania właściciela, Playwright 1/1, cleanup wykonany | integracja i Railway demo; odbiór dotyczy owner lifecycle, nie rozszerza zakresu czterech narzędzi Ideas |
| MW-10 | Vault | `PARTIAL_EXISTING` | realne upload/list/scope, owner-private edit i org-scoped delete; audyt 2026-08-01 potwierdza tylko kolumnę `version`, bez kompletnego create/list/restore canonical-version API i bez golden flow | dodać wersję dokumentu z permission parity, durable read-back/reopen i real-PG browser E2E; do tego czasu nie zamykać |
| MW-11 | Run Agent | `NOT_VERIFIED` | funkcje istnieją | approval/audit/materialization |
| MW-12 | Manager | `NOT_VERIFIED` | funkcje istnieją | action ownership i read-back |

## Chat/Teresa

| ID | Podmoduł | Stan | Dowód bieżący | Następna bramka |
| --- | --- | --- | --- | --- |
| CHAT-01 | History/session context | `CODE_GO_FROZEN` | `bd9bb884b4`; composer→message→hard reload oraz kontrolowany create/message→GET→UI deep-link→hard reload na real-PG; obcy tenant read/write 404, historia właściciela bez zmiany; browser 2/2, routes 6/6, type-check PASS | integracja i Railway demo; retrieval/proposals pozostają osobnymi CHAT-03..05 |
| CHAT-02 | Composer/streaming/tools | `PARTIAL_EXISTING` | funkcje działają cząstkowo | aktualny smoke i error recovery |
| CHAT-03 | Retrieval/citations | `PARTIAL_EXISTING` | mechanizmy istnieją | provenance acceptance |
| CHAT-04 | Teresa action registry | `PARTIAL_EXISTING` | manifest/registry/handlers | usunięcie lokalnych bypassów |
| CHAT-05 | Proposal/approval/audit | `PARTIAL_EXISTING` | fragmenty | current/proposed i durable receipt |
| CHAT-06 | Canvas persistence | `CODE_GO_FROZEN` | `CORE-ART-006E/F` | domenowe E2E |
| CHAT-07 | Canvas→Material/Note/Table | `INTEGRATION_REQUIRED` | canonical artifact persistence istnieje | owner-object handoff |
| CHAT-08 | Chat→Initiative | `MISSING` | brak przyjętego Candidate receipt | Candidate writer + lineage |
| CHAT-09 | Cross-module receipt/reopen | `MISSING` | brak jednego E2E | chat receipt otwiera owner object |

## Kolejka operacyjna

1. Domknąć aktywne A/B/C do `AWAITING_CODEX_REVIEW` i wykonać niezależny review.
2. Zintegrować zamrożone MW foundations z Initiative/Execution/Results spine.
3. Uruchomić Materials `MAT-07..10`, bo blokuje uczciwy artifact output.
4. Następne fale: Tools → Interview → pozostałe My Work → Chat.
5. Railway `demo` acceptance następuje dopiero po kontrolowanej integracji.

## Reguła aktualizacji

Tracker może dopisywać dowód i proponować zmianę statusu, ale nie może
samodzielnie nadać `CODE_GO_FROZEN`, `ACCEPTED` ani `READY_FOR_STAGING`.
Każda zmiana statusu musi wskazać branch, base, HEAD, test wykonany bezpośrednio,
negative control oraz decyzję Codex.
