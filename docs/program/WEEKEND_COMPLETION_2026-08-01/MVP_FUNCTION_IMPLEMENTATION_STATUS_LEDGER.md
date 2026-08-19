---
doc_id: mvp-function-implementation-status-ledger
truth_type: verified-as-is
status: working-canonical
owner: codex
last_reviewed: 2026-08-01
---

# Remanent funkcji względem kodu

## Bieżący snapshot krytycznego spine'u

Operacyjne statusy branchy i kolejność rozstrzyga
[`CURRENT_MVP_CONTROL.md`](CURRENT_MVP_CONTROL.md). Poniższy ledger klasyfikuje
funkcje produktu i nie może samodzielnie zmienić `FIX_REQUIRED` na `DZIAŁA`.

| Zakres | Status review | Znaczenie |
| --- | --- | --- |
| Finance / FIN-005 | `CODE_GO_LOCAL / FROZEN_FOR_INTEGRATION` | HEAD `fbadd3c263`; jawna stopa fail-closed, zmienione testy 59/59 niezależnie potwierdzone; Railway `demo` runtime nadal osobną bramką |
| Assessment DRD / Line A | `CODE_GO_FROZEN` | HEAD `a3205f1151`; `ASM-01..04` odebrane, integracja i Railway `demo` pozostają osobną bramką |
| Assessment quality/output / Line 5 | `ACTIVE_FIX` | HEAD `e4f3b9cc3f`; testy funkcjonalne są zielone, lecz późniejszy review wykazał brak atomowości accept/return i snapshotu; `ASM-05..07` nie są obecnie doliczane |
| Results Recovery / Line B | `CODE_GO_FROZEN` | HEAD `882a721a92`; `RES-06..08` i `RES-13` odebrane, integracja i Railway `demo` pozostają osobną bramką |
| Decision→Initiative→Execution / Line C | `CODE_GO_FROZEN` | HEAD `7b59d3a63b`; `INI-07` odebrane bez ponownego liczenia `INI-06` i `EXE-07` |
| Document create/edit/autosave / MAT-02 | `CODE_GO_FROZEN` | HEAD `df79799cf4`; browser create→edit→hard reload, route 409/read-back i real-PG atomic CAS odebrane |
| Document share/rotate/revoke / MAT-04 | `CODE_GO_FROZEN` | HEAD `f24248bac8`; owner UI→public read→rotate→revoke, negatywne 404, fail-closed persistence, cold restart i współbieżność na real-PG odebrane |
| Materials registry list→open / MAT-01 | `CODE_GO_FROZEN` | HEAD `783e64dacb`; real-PG create→jeden wpis native_artifact→Documents drafts→open tego samego artifactId w Document Studio, browser 1/1 |
| Workbook create/edit/formula/reopen / MAT-05 | `CODE_GO_FROZEN` | HEAD `598613179c`; UI create→value/formula→wynik 42→hard reload→XLSX, real-PG i cross-tenant 404; fail-closed create, Playwright 1/1 |
| Ideas owner lifecycle / MW-09 | `CODE_GO_FROZEN` | HEAD `86f5c4024b`; real-PG create/update/read-back, lista UI po hard reloadzie i preview; cross-tenant read/write 404, Playwright 1/1 |
| Chat history/session context / CHAT-01 | `CODE_GO_FROZEN` | HEAD `bd9bb884b4`; real-PG composer/API message→UI deep-link→hard reload, cross-tenant read/write 404; browser 2/2 i routes 6/6 |
| SWOT output/report reopen / TLS-06 | `CODE_GO_FROZEN` | HEAD `d20fbac2d4`; zatwierdzony SWOT→kanoniczny Report Builder, trwała treść+lineage, API/PG read-back, quality-gated PDF, UI reopen i hard reload |
| Referral / Line D | `OUTSIDE_MVP_CONDITIONAL` | foundation poza MVP; backend feature gate pozostaje do domknięcia |
| Meeting / Line E | `OUTSIDE_MVP` | wynik zachowany, bez wpływu na release gate MVP |

## Statusy

- `DZIAŁA` — zamontowany realny tor z zapisem/read-back i dowodem.
- `CZĘŚCIOWA` — istotna część działa, ale flow, stan lub integracja jest niepełna.
- `ATRAPA` — widoczny element korzysta z mock/local-only/fake success albo nie ma skutku.
- `NIEPODŁĄCZONA` — kod istnieje, ale zamontowany runtime go nie uruchamia.
- `BRAK` — kontrakt funkcji istnieje, implementacji nie znaleziono.

`DZIAŁA` wymaga jeszcze odbioru golden flow; sam import lub endpoint nie wystarcza.

## Ledger pierwszego poziomu

| Moduł / funkcja | Status | Dowód / problem | Następna bramka |
| --- | --- | --- | --- |
| Materials Library | `DZIAŁA lokalnie / FROZEN` | MAT-01 (`783e64dacb`): kanoniczny registry i pełny Document Studio create→jeden wpis→Documents drafts→open owning runtime na real-PG; deck/sheet lifecycle są osobnymi MAT-05..09 | integracja + Railway `demo` |
| Document create/edit/save/reopen/version/export | `DZIAŁA lokalnie / FROZEN` | MAT-02 create→TipTap edit→trwały autosave→hard reload i real-PG atomic 409; checkpoint/restore MAT-03; MAT-04 (`f24248bac8`) owner UI→share→public read→rotate→revoke z real-PG cold restart/CAS | integracja + Railway `demo` |
| Workbook/Excel | `DZIAŁA lokalnie / FROZEN` | MAT-05 (`598613179c`) udowadnia create z UI→cell/formula edit→wynik→hard reload→XLSX read-back na real-PG, izolację tenantów i fail-closed persistence; wersje/share są osobnym MAT-06 | integracja + Railway `demo`; następnie `MAT-003B..D` / MAT-06 |
| Deck/Presentation | `BLOCKED staging` | `MAT-006B`: lista pokazuje seed `Ready/11`, ale builder otwiera ten sam deck jako `0` slajdów; eksport/share nie mogą być uczciwie odebrane | naprawa kanonicznej zawartości seeda + ponowny `MAT-006B` |
| artifact share/download | `CZĘŚCIOWA+` | Document share/rotate/revoke jest odebrany jako MAT-04 (`f24248bac8`); Deck pozostaje zablokowany seedem, Sheets nie ma pełnego share; wspólny receipt nadal do domknięcia | `MAT-006`, `MAT-09..10` |
| SWOT output/report/candidates | `CZĘŚCIOWA+` | TLS-06 (`d20fbac2d4`) domyka output→trwały raport→read-back→PDF→reopen; Candidate handoff pozostaje osobnym TLS-07 | `TLS-07` + integracja/Railway demo |
| Finance Hub | `BLOCKED staging` | route z `FIN-001` działa, ale `FIN-005` wykazał w demo Atelier Toys obce dane DBR77/Apator, duplikaty, surowe daty i niedostępny value engine | `FIN-005` + `FIN-002` |
| Investment Case calculations | `CZĘŚCIOWA/BRAK lifecycle` | realne NPV/IRR/payback, ale lokalny kalkulator bez ROI, save/version/reopen/scenario/baseline/actual | `FIN-002` |
| statement import/mapping | `CZĘŚCIOWA+` | realne upload/detect/extract/map/correct/confirm; dwa kontrakty, brak reprezentatywnego XLSX/CSV E2E i CSV w pickerze | `FIN-003` |
| Initiative Candidate Pack from Finance | `BRAK targetu` | historyczny flow tworzy Initiative bezpośrednio i ma atrapę receipt; brak Candidate Pack, dedupe i pełnego lineage | `FIN-004` |
| Results Hub / KPI table | `CZĘŚCIOWA+` | `/results` owner, `/benefits` i `/kpi-okr` redirect-only (`RES-001A`); jedna realna tabela KPI, ale scorecards nadal używają konkurencyjnego Goals store | `RES-001B` |
| OKR definition quality gate | `BRAK gate/CZĘŚCIOWA CRUD` | Objective/KR CRUD działa; brak enforcement owner/source/cadence/baseline/target i mierzalności | `RES-002` |
| threshold → Deviation → Recovery | `DZIAŁA lokalnie / FROZEN` | `882a721a92`: Recovery Card, Task handoff, effectiveness gate i legacy RBAC parity odebrane | integracja + Railway `demo` |
| KPI visibility/roll-up | `CZĘŚCIOWA/BRAK visibility` | org scope działa; brak polityki visibility, a roll-up istnieje w dwóch modelach scorecardów | `RES-004` |
| Execution List | `CZĘŚCIOWA+` | `EXE-001`: `/execution` jedyny owner, legacy aliases redirect-only; Hub domyślnie otwiera realną List/table aktywnych inicjatyw | `EXE-002` |
| plan/tasks/milestones/roles/resources | `CZĘŚCIOWA+` | realne CRUD/RACI/budget/capacity istnieją, ale są rozproszone i nie mają jednego plan→task→role→actual read-back | `EXE-002` |
| risks/issues/change/decisions | `CZĘŚCIOWA` | realne RAID/mitigation/decisions/rollout changes istnieją w kilku modelach bez jednego management spine | `EXE-003` |
| closure → Results/Finance | `CZĘŚCIOWA/BRAK E2E` | DONE uruchamia idempotentny, ale fire-and-forget Results handoff; brak transakcyjnego receipt i closure→Results→Finance actual round-trip | `FLOW-001` |
| Initiative List all statuses | `CZĘŚCIOWA+` | `INI-001` route slice: `/initiatives` jest jedynym mountem, legacy aliasy zachowują query/hash, default to List/table; V8/legacy continuity, status parity i write-path audit pozostają | dalszy `INI-001` |
| Candidates dedupe/merge/AI | `CZĘŚCIOWA+` | osobna zakładka, realne scan/accept/dismiss i canonical DRAFT; dedupe advisory/fail-open, brak jawnego merge UX i recovery dla accepted bez initiativeId | `INI-002` |
| Roles/projects/approval profile | `CZĘŚCIOWA+` | project scope, owner/sponsor/RACI i effective gate roles działają; brak jednej capability matrix i jawnego cross-project scope | `INI-003` |
| Portfolio/resources vs Roadmap/time/capacity | `CZĘŚCIOWA` | realne Analysis/Timeline/resources/dependencies, ale kilka read modeli i brak update→read-back→reopen między surfaces | `INI-004` |
| Decisions/go-no-go + handoff Execution | `DZIAŁA lokalnie / FROZEN` | `7b59d3a63b`: kanoniczne Decision→same-ID SCHEDULED→EXECUTING odebrane; `INI-07` zamknięte | integracja + browser Railway `demo` |
| Initiative cards dynamic selection | `CZĘŚCIOWA` | katalog i N-mode registry istnieją, deterministyczna kompozycja AI i persisted reopen nieudowodnione | `INI-006` |
| Assessment Library/Processes/Outputs/Reports/Initiatives | `DZIAŁA lokalnie / FROZEN` | `a3205f1151`: Library i pięć surfaces oraz session creation odebrane | integracja + Railway `demo` |
| DRD guided session + matrix round-trip | `DZIAŁA lokalnie / FROZEN` | `a3205f1151`: Form save/read-back i Matrix parity odebrane | integracja + Railway `demo` |
| evidence/scoring/quality review/accepted output | `ACTIVE_FIX` | `e4f3b9cc3f`: evidence/scoring i panel istnieją, lecz późniejszy review wykazał brak atomowości accept/return i snapshotu | atomowa transakcja + real-PG race/retry; Candidate Pack pozostaje `ASM-08` |
| SIRI/ADMA method packs | `CZĘŚCIOWA` | kod i KB istnieją; poza blokującym flow DRD | backlog P1 |
| Tools five surfaces | `CZĘŚCIOWA` | ModuleHub/known tools istnieją, shell niestandardowy | `TLS-001` |
| SWOT session save/resume/navigation | `DZIAŁA LOKALNIE` | `aa7ec91ead`: real-PG browser create→edit→API read-back→hard reload; conclusion bridge i cross-tenant isolation zielone | `TLS-002` |
| SWOT quality/review/approve | `DZIAŁA LOKALNIE / FROZEN` | `737a9384ca`: UI review→approve→reload, immutable real-PG snapshot, PUT 409, USER 403 i cross-tenant 404; bez niejawnego dev/test permission bypass | integracja + Railway `demo` (`TLS-05`) |
| SWOT output/report/candidates | `CZĘŚCIOWA` | scaffolds i conversion istnieją; full read-back do dowodu | `TLS-003` |
| Interview templates/sessions/assignments | `CZĘŚCIOWA+` | najbardziej dojrzały Hub i przepływy | `INT-001` |
| answer assistance/verification/review | `CZĘŚCIOWA` | komponenty istnieją, manager return/accept E2E do dowodu | `INT-002` |
| insight generator | `CZĘŚCIOWA` | modal/preview istnieją; wspólny generator contract do dowodu | `INT-003` |
| initiative generator | `CZĘŚCIOWA` | wiele wejść; musi delegować do jednego Candidate write path | `INT-004` |
| My Work Inbox/Tasks/Decisions | `CZĘŚCIOWA+` | szeroka adopcja standard components; owner read-back do testu | `MW-001` |
| Calendar sync/capacity | `CZĘŚCIOWA` | UI i integracje istnieją, provider i project markers do odbioru | `MW-002` |
| Notes/Ideas | `DZIAŁA lokalnie / FROZEN` | Notes core MW-08 oraz Ideas owner lifecycle MW-09 (`86f5c4024b`) mają real-PG create/update/read-back/reopen i izolację tenantów; zaawansowane narzędzia/UI pozostają osobnymi zakresami | integracja + Railway `demo` |
| Vault/Run Agent/Manager | `CZĘŚCIOWA` | bogate, nierówno dojrzałe runtime; szczegółowe audyty istnieją | `MW-003..007` |
| Chat history/composer/tools | `CZĘŚCIOWA+` | rozbudowany runtime, kilka regresji i duplikatów | `CHAT-001` |
| Teresa action registry/approval | `CZĘŚCIOWA` | manifest, registry i handler istnieją; lokalne ścieżki pozostają | `CHAT-002` |
| Chat → Canvas → owner object | `CZĘŚCIOWA` | kanoniczny Canvas persistence i Artifact content read-back są przyjęte w `CORE-ART-006E/F`; nadal brak domenowego E2E Chat→Canvas→zatwierdzenie→Material/Note/Initiative/Table | `CHAT-003` |

## Zasada pogłębiania

Każdy pakiet z powyższej tabeli musi przed implementacją rozbić pozycję na funkcje atomowe i potwierdzić status przez route → component → handler → API → service → DB/read-back → test. Ledger nie udaje jeszcze endpoint-level certification.
