## PACKS_01 — Merge V2 core do gałęzi docelowej (3 agentów)

Cel: wpiąć zaległe gałęzie V2 do gałęzi integracyjnej (docelowo `main`, a jeśli koniecznie “Londyn” — to przez merge `main -> Londyn` na końcu).

### Agent A — Bundle 03 (Interview/Survey/Acquisition: T013–T017)
- **Wejście**: gałęzie `bundle-03a-interview-inference`, `bundle-03b-survey-public-report` (oraz ewentualnie `bundle-03-interview-survey` jeśli używana).
- **Zakres**:
  - Zmergować do gałęzi integracyjnej.
  - Naprawić konflikty / regresje.
  - Odpalić `npm run verify:quick`.
- **Wyjście**: PR/merge gotowy + commit/PR link do Notion.

### Agent B — Bundle 20C (Kompetencje + skills gap + CV matching: T065–T067)
- **Wejście**: `bundle-20a-competency-taxonomy` (T065), `bundle-20b-skills-gap-cursor` (T066), `bundle-20c-cv-matching` (T067).
- **Zakres**:
  - Merge w kolejności: 20a → 20b → 20c (lub jedna gałąź “merge train”).
  - `npm run verify:quick`.
- **Wyjście**: PR/merge gotowy + linki do Notion.

### Agent C — Bundle 29 UI/UX final pack (T099, T101–T105 + i18n/analytics)
- **Uwaga**: ten pakiet robimy dopiero po Twoich wytycznych (nie implementować zmian UI teraz).
- **Zakres na teraz (bezpieczny)**:
  - Sprawdzić, czy istnieje gałąź `bundle-29-uiux-final-pack` i czy da się ją bezkonfliktowo wpiąć do integracji.
  - Przygotować listę konfliktów/ryzyk (bez rozwiązywania wizualnych decyzji).
- **Wyjście**: “merge readiness report” + plan rozwiązywania konfliktów po otrzymaniu wytycznych.

