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
| Deck/Presentation | `CZĘŚCIOWA+` | create/edit/CAS-save/reopen/export/share działają; restore bez CAS i brak pełnego golden E2E | `MAT-006` |
| artifact share/download | `CZĘŚCIOWA+` | Document list handoff działa; Document i Deck mają realne share API, Sheets brak; zamrożony export receipt do domknięcia | `MAT-005..007` |
| Finance Hub | `CZĘŚCIOWA` | `/finance` i `/economics` równolegle | `FIN-001` |
| Investment Case calculations | `CZĘŚCIOWA` | liczne workspaces/ROI; ownership i baseline/actual thread niezamknięte | `FIN-002` |
| statement import/mapping | `CZĘŚCIOWA` | realne routes i UI, potrzebny reprezentatywny E2E | `FIN-003` |
| Initiative Candidate Pack from Finance | `CZĘŚCIOWA` | kilka historycznych ścieżek tworzenia inicjatyw | `FIN-004` |
| Results Hub / KPI table | `CZĘŚCIOWA` | route nadal Benefits, lokalne KPI tables | `RES-001` |
| OKR definition quality gate | `CZĘŚCIOWA` | komponenty/metody istnieją fragmentarycznie | `RES-002` |
| threshold → Deviation → Recovery | `CZĘŚCIOWA/BRAK E2E` | elementy alertów i corrective actions rozproszone | `RES-003` |
| KPI visibility/roll-up | `CZĘŚCIOWA` | brak dowodu pełnego scope enforcement | `RES-004` |
| Execution List | `CZĘŚCIOWA` | kilka shelli i widoków, brak wyboru jednego kanonu | `EXE-001` |
| plan/tasks/milestones/roles | `CZĘŚCIOWA` | funkcje istnieją w wielu komponentach | `EXE-002` |
| risks/issues/change/decisions | `CZĘŚCIOWA` | lokalne moduły bez jednego management spine | `EXE-003` |
| closure → Results/Finance | `CZĘŚCIOWA/BRAK E2E` | execution spine istnieje, pełny round-trip nieudowodniony | `FLOW-001` |
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
