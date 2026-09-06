# Generator raportu realizacji (`execution-report-generator`) — NIE karta N

**Status:** ROZSTRZYGNIĘTE (CTO, ta partia) — nie jest kartą N, i to najbardziej oczywisty
przypadek grupy (nazwa sama mówi „generator”). Wzorzec rozstrzygnięcia:
`_wzorzec-raport-dokument.md` §„Rozstrzygnięcie CTO".

## Co to jest

`src/components/Execution/reports-intelligence/UnifiedExecutionReportGenerator.tsx:25` (371 linii)
— formularz: definicja + cel + odbiorca + okres + horyzont prognozy + strefa czasowa + zakres,
plus wybór wielu `reportRunId` do złączenia (`selectedRunIds`, `:24`). Czyta
`listReportDefinitions`/`listReportRuns`/`getReportDefinition`, zapisuje przez `createReportRun`
(`:5-9`) — to jest wejście do **innego** systemu (`report_run`/`ReportRun`, event-sourced,
`reportRun.ts`, wymaga dwóch aktorów owner≠approver do publikacji — patrz komentarz w
`server/src/routes/executionReports.routes.ts:1-14`), NIE do `execution_report_snapshots`.

## Dlaczego nie karta N

Ekran generatora z definicji: żąda parametrów, tworzy NOWY rekord gdzie indziej (`report_run`), nie
ma własnej tożsamości do otworzenia ponownie jako „ten sam ekran” — po zapisaniu formularza
użytkownik idzie do wynikowego `ReportRun`, nie wraca do generatora. Dokładnie wykluczenie z
reguły CTO: „raport na żądanie bez rekordu — to ekran generatora”.

## Stan runtime

Nieosiągalny poza opt-in — `execReportsIntelligence` ma twardy `return false`
(`executionFeatureFlags.ts:128`). Mount: `ExecutionHub.tsx:5848`
(`activeDocumentId === 'execution-intelligence:generator'`).

## Rekomendacja

Brak kontraktu K1–K30. Jeśli generator zostanie odsłonięty, właściwy kanon to formularz/wizard
(analogiczny do istniejącego wizarda migawek w `ExecutionReportsSurface.tsx` — „Nowy raport” →
definicja → okres → generuj), NIE karta N. Uwaga poboczna: ten generator celuje w system `ReportRun`
(dwóch aktorów, atestacja źródeł), a NIE w `execution_report_snapshots` (który ma już własny,
prostszy wizard w `ExecutionReportsSurface.tsx` — patrz `execution-report.md` §0). To DWA różne
mechanizmy generowania „raportu realizacji” obok siebie, oba za flagami/częściowo — do
rozstrzygnięcia przy ewentualnym odmrożeniu, nie w tej partii dokumentacyjnej.
