---
doc_id: mvp-function-implementation-status-ledger
truth_type: verified-as-is
status: historical-baseline-superseded
owner: codex
last_reviewed: 2026-08-01
---

# Remanent funkcji względem kodu

> **Uwaga:** tabela poniżej jest historycznym remanentem z 2026-08-01. Nie jest
> bieżącym boardem wydania i nie może ponownie otwierać pakietów odebranych oraz
> zintegrowanych 2026-08-03. Aktualny task-level status znajduje się w
> `MVP_SUBMODULE_CONTROL_BOARD.md`, a runtime baseline w
> `FINAL_DEMO_RUNTIME_BASELINE_2026-08-03.md`. Historyczne wpisy `BLOCKED`,
> `CZĘŚCIOWA` i `BRAK` muszą zostać zweryfikowane od nowa dopiero w audycie 16
> kontraktów na finalnym SHA.

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
| Materials Library | `CZĘŚCIOWA+` | live registry bez produkcyjnych mocków; documents/decks realne, Sheets bez archive/share, ownership gate nadal rozdzielony | `MAT-001` |
| Document create/edit/save/reopen/version/export | `CZĘŚCIOWA+` | autosave z 409, reopen, checkpoint/restore (`MAT-005A`) i DOCX/PDF/MD działają; list→share handoff domknięty w `MAT-002`; brak pełnego lifecycle E2E i revoke/rotate UI | `MAT-005B` |
| Workbook/Excel | `CZĘŚCIOWA+` | `MAT-003A` udowadnia real-route SQLite create→cell/formula edit→reopen→XLSX read-back; brak wersji, concurrency, operacji strukturalnych i browser E2E; dwa runtime'y | `MAT-003B..D` |
| Deck/Presentation | `BLOCKED staging` | `MAT-006B`: lista pokazuje seed `Ready/11`, ale builder otwiera ten sam deck jako `0` slajdów; eksport/share nie mogą być uczciwie odebrane | naprawa kanonicznej zawartości seeda + ponowny `MAT-006B` |
| artifact share/download | `CZĘŚCIOWA+` | Document list handoff działa; Document i Deck mają realne share API, Sheets brak; zamrożony export receipt do domknięcia | `MAT-005..007` |
| Finance Hub | `BLOCKED staging` | route z `FIN-001` działa, ale `FIN-005` wykazał w demo Atelier Toys obce dane DBR77/Apator, duplikaty, surowe daty i niedostępny value engine | `FIN-005` + `FIN-002` |
| Investment Case calculations | `CZĘŚCIOWA/BRAK lifecycle` | realne NPV/IRR/payback, ale lokalny kalkulator bez ROI, save/version/reopen/scenario/baseline/actual | `FIN-002` |
| statement import/mapping | `CZĘŚCIOWA+` | realne upload/detect/extract/map/correct/confirm; dwa kontrakty, brak reprezentatywnego XLSX/CSV E2E i CSV w pickerze | `FIN-003` |
| Initiative Candidate Pack from Finance | `BRAK targetu` | historyczny flow tworzy Initiative bezpośrednio i ma atrapę receipt; brak Candidate Pack, dedupe i pełnego lineage | `FIN-004` |
| Results Hub / KPI table | `CZĘŚCIOWA+` | `/results` owner, `/benefits` i `/kpi-okr` redirect-only (`RES-001A`); jedna realna tabela KPI, ale scorecards nadal używają konkurencyjnego Goals store | `RES-001B` |
| OKR definition quality gate | `BRAK gate/CZĘŚCIOWA CRUD` | Objective/KR CRUD działa; brak enforcement owner/source/cadence/baseline/target i mierzalności | `RES-002` |
| threshold → Deviation → Recovery | `CZĘŚCIOWA+` | threshold→Deviation Case→notification→RCA/actions/resolve działa; Recovery owner object, Task handoff i clock escalation brak lub niepodłączone | `RES-003` |
| KPI visibility/roll-up | `CZĘŚCIOWA/BRAK visibility` | org scope działa; brak polityki visibility, a roll-up istnieje w dwóch modelach scorecardów | `RES-004` |
| Execution List | `CZĘŚCIOWA+` | `EXE-001`: `/execution` jedyny owner, legacy aliases redirect-only; Hub domyślnie otwiera realną List/table aktywnych inicjatyw | `EXE-002` |
| plan/tasks/milestones/roles/resources | `CZĘŚCIOWA+` | realne CRUD/RACI/budget/capacity istnieją, ale są rozproszone i nie mają jednego plan→task→role→actual read-back | `EXE-002` |
| risks/issues/change/decisions | `CZĘŚCIOWA` | realne RAID/mitigation/decisions/rollout changes istnieją w kilku modelach bez jednego management spine | `EXE-003` |
| closure → Results/Finance | `CZĘŚCIOWA/BRAK E2E` | DONE uruchamia idempotentny, ale fire-and-forget Results handoff; brak transakcyjnego receipt i closure→Results→Finance actual round-trip | `FLOW-001` |
| Initiative List all statuses | `CZĘŚCIOWA+` | `INI-001` route slice: `/initiatives` jest jedynym mountem, legacy aliasy zachowują query/hash, default to List/table; V8/legacy continuity, status parity i write-path audit pozostają | dalszy `INI-001` |
| Candidates dedupe/merge/AI | `CZĘŚCIOWA+` | osobna zakładka, realne scan/accept/dismiss i canonical DRAFT; dedupe advisory/fail-open, brak jawnego merge UX i recovery dla accepted bez initiativeId | `INI-002` |
| Roles/projects/approval profile | `CZĘŚCIOWA+` | project scope, owner/sponsor/RACI i effective gate roles działają; brak jednej capability matrix i jawnego cross-project scope | `INI-003` |
| Portfolio/resources vs Roadmap/time/capacity | `CZĘŚCIOWA` | realne Analysis/Timeline/resources/dependencies, ale kilka read modeli i brak update→read-back→reopen między surfaces | `INI-004` |
| Decisions/go-no-go + handoff Execution | `CZĘŚCIOWA/BRAK E2E` | gate/role/decision enforcement działa; brak jednego GO/NO-GO audit flow i same-ID SCHEDULED→EXECUTING reopen; konkurencyjny start-execution path | `INI-005` |
| Initiative cards dynamic selection | `CZĘŚCIOWA` | katalog i N-mode registry istnieją, deterministyczna kompozycja AI i persisted reopen nieudowodnione | `INI-006` |
| Assessment Library/Processes/Outputs/Reports/Initiatives | `CZĘŚCIOWA` | Hub i tabele obecne; różne generacje edytorów | `ASM-001` |
| DRD guided session + matrix round-trip | `CZĘŚCIOWA` | najbogatszy stary edytor, potrzebny scalenie i E2E | `ASM-002` |
| evidence/scoring/quality review | `CZĘŚCIOWA` | kontrakty i endpointy istnieją; enforcement do dowodu | `ASM-003` |
| SIRI/ADMA method packs | `CZĘŚCIOWA` | kod i KB istnieją; poza blokującym flow DRD | backlog P1 |
| Tools five surfaces | `CZĘŚCIOWA` | ModuleHub/known tools istnieją, shell niestandardowy | `TLS-001` |
| SWOT session save/resume/navigation | `CZĘŚCIOWA` | rozbudowany tool store/workspace, znane problemy UX | `TLS-002` |
| SWOT output/report/candidates | `CZĘŚCIOWA` | scaffolds i conversion istnieją; full read-back do dowodu | `TLS-003` |
| Interview templates/sessions/assignments | `CZĘŚCIOWA+` | najbardziej dojrzały Hub i przepływy | `INT-001` |
| answer assistance/verification/review | `CZĘŚCIOWA` | komponenty istnieją, manager return/accept E2E do dowodu | `INT-002` |
| insight generator | `CZĘŚCIOWA` | modal/preview istnieją; wspólny generator contract do dowodu | `INT-003` |
| initiative generator | `CZĘŚCIOWA` | wiele wejść; musi delegować do jednego Candidate write path | `INT-004` |
| My Work Inbox/Tasks/Decisions | `CZĘŚCIOWA+` | szeroka adopcja standard components; owner read-back do testu | `MW-001` |
| Calendar sync/capacity | `CZĘŚCIOWA` | UI i integracje istnieją, provider i project markers do odbioru | `MW-002` |
| Notes/Ideas/Vault/Run Agent/Manager | `CZĘŚCIOWA` | bogate, nierówno dojrzałe runtime; szczegółowe audyty istnieją | `MW-003..007` |
| Chat history/composer/tools | `CZĘŚCIOWA+` | rozbudowany runtime, kilka regresji i duplikatów | `CHAT-001` |
| Teresa action registry/approval | `CZĘŚCIOWA` | manifest, registry i handler istnieją; lokalne ścieżki pozostają | `CHAT-002` |
| Chat → Canvas → owner object | `CZĘŚCIOWA` | kanoniczny Canvas persistence i Artifact content read-back są przyjęte w `CORE-ART-006E/F`; nadal brak domenowego E2E Chat→Canvas→zatwierdzenie→Material/Note/Initiative/Table | `CHAT-003` |

## Zasada pogłębiania

Każdy pakiet z powyższej tabeli musi przed implementacją rozbić pozycję na funkcje atomowe i potwierdzić status przez route → component → handler → API → service → DB/read-back → test. Ledger nie udaje jeszcze endpoint-level certification.
