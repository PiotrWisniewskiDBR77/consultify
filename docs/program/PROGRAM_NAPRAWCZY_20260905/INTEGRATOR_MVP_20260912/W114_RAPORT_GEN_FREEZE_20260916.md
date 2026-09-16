# RAPORT-GEN · W114 — freeze 2026-09-16

**Werdykt: READY FOR CTO REVIEW.** Paczka bazuje na `85541745e8`, naprawia U-25 i U-31 bez migracji, flag, zapisów stagingowych ani zmian spoza generatorów raportów Assessment/Audits.

## Zachowanie

- U-25: wiersz kanonicznej sesji Method Core zachowuje `method_sessions.id` jako identyfikator sesji, ale generator dostaje osobne `reportSourceId` z dopasowanego legacy twin `assessments.id`. Dopasowanie wykorzystuje istniejącą parę `projectId + type=DRD`.
- Gdy kanoniczna sesja nie ma legacy twin, tworzenie draftu jest zablokowane i użytkownik dostaje uczciwy komunikat: `This session has no report source yet — freeze it first` (EN + PL).
- U-31: platformowy `OWNER` bez wpisu w `audit_program_members` dostaje wyłącznie dodatkową capability `report.draft`. Nie dostaje `report.approve`, `report.publish`, `evidence.review` ani `finding.draft`.
- Test RealPG potwierdza, że taki OWNER tworzy draft raportu dla istniejącego wyniku audytu, a stan testowy jest następnie usuwany.

## Commity implementacyjne

- `dca0277e60` — osobne źródło legacy dla raportu Assessment oraz fail-closed bez twina.
- `f14b67c7a3` — minimalna capability `report.draft` dla platform OWNER i test RealPG.
- `2f956653fd` — harness realnej powłoki i dwa dowody EN generatorów.

## Dowody

- Importery Assessment: **6/6 PASS** w 3 plikach, `--retry=0`, jeden worker.
- Audits RealPG: **3/3 PASS**, w tym `platform OWNER bez audit_program_members tworzy wyłącznie draft raportu`; własny PostgreSQL `127.0.0.1:6455/consultify_raport_gen`.
- Readback po cleanupie RealPG: `audit_reports=0`, `audit_outputs=0`, `audit_program_members=0`, `audit_programs=0`.
- Pełny frontend TypeScript bez limitu: baza **169**, kandydat **169**, delta **0**.
- Pełny server TypeScript bez limitu: baza **0**, kandydat **0**, delta **0**.
- Esbuild: `AssessmentHub.tsx`, `NewAssessmentReportModal.tsx`, `permissions.ts` i test RealPG — PASS.
- `git diff --check`: PASS.
- Obejrzane zrzuty realnych komponentów w angielskiej, jasnej powłoce 1440x900:
  - `evidence/raport-gen-w114/assessment-new-report-en-light-1440x900.png` — generator Assessment z kanoniczną sesją, dopasowanym twin source i aktywnym `Create draft`.
  - `evidence/raport-gen-w114/audits-new-report-en-light-1440x900.png` — generator Audits z wynikiem audytu i aktywnym `Generate`.
- Lokalne URL-e dowodowe:
  - `http://127.0.0.1:4215/?screen=assessment-reports-table&lang=en&theme=light&tab=reports`
  - `http://127.0.0.1:4215/?screen=audyty-piec-powierzchni&tab=reports&lang=en&theme=light`

## Granice

Zrzuty potwierdzają realną powłokę i aktywną ścieżkę obu generatorów na danych harnessu. Poprawne `sourceId` U-25 potwierdza test zachowania komponentu, a zapis draftu U-31 potwierdza osobny RealPG. Nie wykonywano deployu, migracji, zmian Railway, zapisów stagingowych ani pushu na ref chroniony.
