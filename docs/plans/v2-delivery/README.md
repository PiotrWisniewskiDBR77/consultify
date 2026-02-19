# V2 Delivery — Control Room (122 taski → wdrożenie)

Ten katalog jest **jednym miejscem prawdy** dla dowiezienia V2: jak dzielimy pracę na paczki, jak pracujemy na branchach, jak robimy merge bez rozwalenia aplikacji oraz jak raportujemy postęp.

## Kanoniczne źródła (SSOT)
- **Specyfikacje tasków (T001–T122)**: `docs/plans/V2_TASK_SPECS.md`
- **Lista tasków / registry**: `docs/plans/VC_MEETING_TASKLIST.md`
- **Manual QA checklist (T001–T122)**: `docs/test-quality/V2_MANUAL_QA_CHECKLIST_122_TASKS.md`
- **UI/UX standardy (MUST)**: `docs/ui-standards/README.md`

## Pliki w tym katalogu
- **Mapa paczek (30) + kolejność + pilot na jutro**: `30-bundles-plan.md`
- **Workflow pracy (branch/PR/testy/Codex/merge)**: `workflow.md`
- **Dashboard postępów + template raportu**: `progress.md`
- **Handoff dla nowego czatu (kontekst projektu + zasady)**: `agent-handoff.md`
- **EXTRA poza kodem (treści, demo website, mobile lean)**: `extras-non-coding.md`

## Cel operacyjny
- Maksymalna szybkość **bez syfu**:
  - **WIP = 3**: równolegle zawsze maks:
    - **1 paczka Codex**
    - **2 paczki Cursor (my)**
  - Merge tylko, jeśli spełnione bramki z `workflow.md` (minimum testów + manual QA).

