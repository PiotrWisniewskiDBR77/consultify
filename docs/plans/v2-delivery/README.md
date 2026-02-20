# V2 Delivery — Control Room (122 taski → wdrożenie)

Ten katalog jest **jednym miejscem prawdy** dla dowiezienia V2: jak dzielimy pracę na paczki, jak pracujemy na branchach, jak robimy merge bez rozwalenia aplikacji oraz jak raportujemy postęp.

## Kanoniczne źródła (SSOT)
- **Specyfikacje tasków (T001–T122)**:
  - **SSOT (MD)**: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md`
  - **SSOT (TXT do wklejania)**: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.txt`
- **Lista tasków / registry**: `docs/plans/VC_MEETING_TASKLIST.md`
- **Manual QA checklist (T001–T122)**: `docs/test-quality/V2_MANUAL_QA_CHECKLIST_122_TASKS.md`
- **UI/UX standardy (MUST)**: `docs/ui-standards/README.md`

## Pliki w tym katalogu
- **Mapa paczek (30) + kolejność + pilot na jutro**: `30-bundles-plan.md`
- **Workflow pracy (branch/PR/testy/Codex/merge)**: `workflow.md`
- **Dashboard postępów + template raportu**: `progress.md`
- **Handoff dla nowego czatu (kontekst projektu + zasady)**: `agent-handoff.md`
- **EXTRA poza kodem (treści, demo website, mobile lean)**: `extras-non-coding.md`
- **Stream pracy “Piotr prep” (tematy trudne przed kodem)**: `piotr-prep-stream.md`
- **Runbook dla Konrada (zewn. integracje OAuth/Drive)**: `konrad-external-integrations-runbook.md`
- **Szablon promptów dla agentów (Cursor/Codex)**: `PROMPT_TEMPLATE_V2.md`
- **Archiwum promptów Wave 1**: `PROMPTS_WAVE_1.md`
- **Prompty Wave 2 (aktualne)**: `PROMPTS_WAVE_2.md`

## Cel operacyjny
- Maksymalna szybkość **bez syfu**:
  - **WIP = 3**: równolegle zawsze maks:
    - **1 paczka Codex**
    - **2 paczki Cursor (my)**
  - Merge tylko, jeśli spełnione bramki z `workflow.md` (minimum testów + manual QA).

## Gdy ten wątek rozmowy się „zapcha” (awaryjny restart)
Jeśli czat straci kontekst albo robimy handoff do nowego agenta:

1. Przeczytaj: `progress.md` → `workflow.md` → `30-bundles-plan.md` → `PROMPT_TEMPLATE_V2.md`.
2. Specy tasków bierz z: `docs/plans/chatgpt-export/V2_TASK_SPECS_FULL.md` (albo `.txt`).
3. Repo sanity: `git status` czysty przed startem nowych paczek.
4. WIP=3 (1 Codex + 2 Cursor). Agenty **nie edytują** `progress.md` (owner aktualizuje po review).

