# RP1 kosmetyka W201 — READY FOR CTO REVIEW

Werdykt: READY FOR CTO REVIEW. Paczka domyka wyłącznie kosmetykę RP1 z Wpisu 201 pkt 4: neutralny tytuł sekcji decyzji, gdy raport nie ma kontekstu zalogowanego użytkownika, oraz etykiety zamiast surowych kodów w raporcie pracy inicjatyw.

## Zakres

- `src/components/Execution/executionReportModel.ts`
  - `buildExecutionReportSnapshot` przyjmuje opcjonalny `viewerUserId`.
  - Sekcja decyzji w `initiative-card` pokazuje `Decisions I owe` tylko wtedy, gdy wszystkie decyzje należą do `viewerUserId`; bez tego kontekstu pokazuje neutralne `Decisions owed`.
  - PL/EN klucze: `executionReports.section.decisionsIOwe`, `executionReports.section.decisionsOwed`.
- `src/components/Initiatives/InitiativeWorkReportView.tsx`
  - `purpose` definicji raportu używa etykiety szablonu (`Weekly team update`) zamiast surowego `WEEKLY_TEAM_UPDATE`.
  - Podsumowanie `byStatus` przechodzi przez `initiativeStatusLabel`, więc `UNKNOWN: 5` staje się `Unknown: 5` / PL odpowiednik.
  - Nowy helper `initiativeWorkReportStatusBreakdown` jest używany przez render podsumowania i testowany bez pełnego workflow formularza.
- `public/locales/en/translation.json`, `public/locales/pl/translation.json`
  - Dodane klucze EN/PL dla nowych etykiet, bez usuwania istniejących tłumaczeń.

## Dowody

- Focused Vitest: `src/components/Execution/__tests__/executionReportModel.test.ts` + `src/components/Initiatives/__tests__/InitiativeWorkReportView.kanon.test.tsx` → 2 pliki / 19 testów PASS (`--retry=0 --no-file-parallelism`).
- `npm run check:jezyk:staged -- --przyklady 50` → pełny skan z powodu locale JSON, PASS; spadki: `K4obj -4`, `K5en -1`, `K8sen -2`.
- `git diff --cached --check` → PASS.
- `npm run type-check:server` → PASS, 0 `error TS`.
- `npm run type-check` → RC 2, 167 `error TS` total, 5 w `node_modules`, 0 w zmienionych plikach RP1. Nie oznaczam front tsc jako PASS; dowód delty własnych plików = 0.

## Granice

- 0 migracji.
- 0 zmian w rdzeniu RP1 Qodera (`postgresInitiativeReader.ts`, pluralizacja dni w serwisie, czytnik decyzji poza wskazanymi plikami).
- 0 staging/demo/Londyn/integracja push, 0 deploy/Railway/env.
- Bez `--no-verify`.
