---
doc_id: mvp-function-implementation-status-ledger
truth_type: verified-as-is
status: working-canonical
owner: codex
last_reviewed: 2026-07-31
---

# Remanent funkcji względem kodu

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
| Deck/Presentation | `CZĘŚCIOWA+` | create/edit/CAS-save/reopen/export/share oraz CAS restore z canonical read-back (`MAT-006A`) działają; historia nadal fail-soft i brak pełnego golden E2E | `MAT-006B` |
| artifact share/download | `CZĘŚCIOWA+` | Document list handoff działa; Document i Deck mają realne share API, Sheets brak; zamrożony export receipt do domknięcia | `MAT-005..007` |
| Finance Hub | `CZĘŚCIOWA+` | `FIN-001`: `/finance` jest jedynym ownerem UI, `/economics` zachowuje query/hash i przekierowuje; V8/legacy data fallback pozostaje | `FIN-002` |
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
| Initiative List all statuses | `CZĘŚCIOWA` | Hub istnieje, statusy/źródła wymagają kanonizacji | `INI-001` |
| Candidates dedupe/merge/AI | `CZĘŚCIOWA` | fragmenty analiz i generatorów istnieją | `INI-002` |
| Portfolio/resources vs Roadmap/time | `CZĘŚCIOWA` | osobne widoki/analizy, wspólny read model nieudowodniony | `INI-003` |
| Decisions/go-no-go | `CZĘŚCIOWA` | approval fragments istnieją, role/default workflow niepełne | `INI-004` |
| Initiative cards dynamic selection | `CZĘŚCIOWA` | katalog i N-mode registry istnieją, pełna kompozycja AI nieudowodniona | `INI-005` |
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
| Chat → Canvas → owner object | `CZĘŚCIOWA/NO-GO` | Canvas bez kompletnego materialization read-back | `CHAT-003` |

## Zasada pogłębiania

Każdy pakiet z powyższej tabeli musi przed implementacją rozbić pozycję na funkcje atomowe i potwierdzić status przez route → component → handler → API → service → DB/read-back → test. Ledger nie udaje jeszcze endpoint-level certification.
