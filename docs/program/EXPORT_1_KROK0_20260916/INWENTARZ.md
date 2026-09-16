# EXPORT-1 — krok 0: inwentarz dzisiejszych ścieżek

**Werdykt:** eksport jest rozproszony między co najmniej pięć niezależnych ścieżek; na lokalnym zrzucie Northwind tylko DRD i Workbook dają plik przez rzeczywistą trasę HTTP. Report Builder i Deck Builder zatrzymują zasadne bramki jakości, a Audits nie ma obiektu źródłowego. **STOP przed implementacją.**

Pomiar wykonano 2026-09-16 na bazie `85541745e8`, z lokalnie odtworzonego dumpu `staging-thomas-przed-wdrozeniem-linii-20260911-2036.dump` (SHA-256 `85f0d5aafcd479b1b89b25b7fad3e46e3a147937f4f68ea47bbdd1a5c2f61531`), w prywatnym PG18 `cx-export1-pg:5293`. Dump ma 1808 tabel i dla Northwind: 1 ocenę, 2 decki, 1 workbook, 4 raporty Report Builder, 0 outputów audytu i 0 raportów audytu. Serwer lokalny słuchał wyłącznie na `127.0.0.1:4214`. Nie użyto stagingu ani Railway.

## Inwentarz plik:linia → biblioteka → działanie

| Powierzchnia | UI / trasa | Renderer i biblioteka | Wynik na Northwind z dumpu | Czy działa dzisiaj |
|---|---|---|---|---|
| Report Builder DOCX | `server/src/routes/report-builder.routes.ts:4057-4145`; właściwy renderer `:3716-3841` | lokalny `writeReportBuilderDocx`, `docx@9.5.1`; nie korzysta z szablonu systemowego | `GET /api/report-builder/1d10…/export/docx` → **409**, score 35, brak Executive Summary i 0% source refs; receipt `pliki-app/northwind-report-builder-409.json` | **NIE dla realnego zatwierdzonego raportu Northwind**; bramka zachowuje się prawidłowo |
| Deck Builder PPTX | `server/src/routes/presentations.routes.ts:2753-2835`; aktualizacja z bieżącego `deck_json` `:567-700` | `PptxPipelineService` `server/src/services/report/pptx/PptxPipelineService.ts:264-380`, `pptxgenjs@4.0.1` | realna trasa dla decku steering `56ba…` → **422 BLOCKED_P1** (6 low-information slides); engine probe generuje 6 slajdów/125 042 B bez ostrzeżeń, receipt `northwind-steering-route-422.json` | **NIE jako eksport użytkownika**; engine umie wyrenderować, ale jakość blokuje wydanie |
| Sheets / Workbook XLSX | UI pobiera `/api/workbook/:id/download`; `server/src/routes/workbook.routes.ts:1533-1624` | `WorkbookBuilder` `server/src/services/workbook/WorkbookBuilder.ts:992-1080`, `exceljs@4.4.0`; Table Platform ma `ExcelJS` premium + `SheetJS` fallback w `server/src/services/tablePlatform/ExportService.ts:217-330` | realna trasa workbooku `2352986d…` → **200**, 10 401 B, 3 arkusze po renderze; receipt `northwind-scrap-route-current.xlsx` | **TAK dla Scrap Cost Model**; dokładny Supplier Quality Scorecard nie występuje w tym dumpie |
| DRD „Download report/deck” | UI `src/components/assessment/report/AssessmentReportDocument.tsx:540-623`; trasy `server/src/routes/assessment-reports.routes.ts:3155-3267` | wspólny kontrakt oceny, `assessmentNarrativeComposer`; DOCX = `documentDocxRenderer` / `docx@9.5.1`; deck = `assessmentDeckPptxRenderer` / `pptxgenjs`; PDF = `pdfkit@0.17.2` | frozen DRD `b2de5832…`: **200** DOCX 161 676 B / PPTX 362 124 B / PDF 50 495 B; DOCX renderuje 18 stron | **TAK**, ale układ nie ma parytetu z zaakceptowaną makietą (patrz automat) |
| Method-core DOCX | `server/src/routes/method-core.routes.ts:627-757` | `buildAssessmentDrdReportSchema` + `documentDocxRenderer` | ta sama rodzina kontraktu co DRD, lecz inne źródło (`method_sessions`) | **ścieżka istnieje; nie była osobnym obiektem porównawczym w dumpie** |
| Audits „Pobierz DOCX/PDF” | UI `src/components/Audit/method/AuditReportDocumentView.tsx:561-633`; backend `server/src/routes/audits/reports.routes.ts:91-164` | wspólny `buildAuditReportDocumentSchema`; DOCX `documentDocxRenderer`, PDF `documentPdfRenderer` | dump ma program `e726e659-fec9-57a7-bfc9-4b32311ab067`, ale 0 `audit_outputs` i 0 `audit_reports`; wywołanie z tym realnym identyfikatorem → **404 AUDIT_NOT_FOUND**, receipt `northwind-audit-404.json` | **NOT_PROVEN** — brak obiektu, nie błąd renderera |
| Legacy assessment report PDF/PPTX/XLSX | `server/src/routes/assessment-reports.routes.ts:2637-2792` | PDFKit, bezpośredni PptxGenJS, SheetJS | równoległa, starsza rodzina rendererów | **istnieje i zwiększa fragmentację; nie jest kanonem ekranowego DRD** |

## Najważniejsze ustalenia

1. `assessmentNarrativeComposer` nie zasila Report Builder DOCX. Zasila kontrakt DRD. Report Builder ma własny, prostszy renderer `writeReportBuilderDocx`. Nazwa produktu sugeruje jeden silnik, kod ma dwa różne.
2. Deck Builder ma dojrzały pipeline, ale realny deck steering nie przechodzi jakości. Plik `northwind-steering-current.pptx` jest wyłącznie **engine probe**, nie dowodem dostępnego eksportu użytkownika.
3. Workbook jest jedyną ścieżką, która na tym dumpie przechodzi pełne HTTP 200 i zapisuje receipt eksportu. Nie dowodzi to scorecardu, którego dump nie zawiera.
4. DRD przechodzi realną trasą, lecz automat wykrywa: Calibri zamiast Aptos/Arial; 18 stron wobec 6 stron makiety; 1 sekcja OOXML wobec 2; 150 akapitów oznaczonych stylami Title/Heading wobec 16. Zrzut pokazuje formularzową okładkę z dużą tabelą, makieta opowiada historię klienta.
5. Audits ma technicznie bliźniacze renderery DOCX/PDF, ale bez realnego raportu Northwind nie wolno oznaczyć ścieżki jako działającej.
6. Pierwszy alarm fontów i czerwieni był błędny: tablica skryptowa motywu nie jest dowodem użycia fontu, a `B42318` jest dozwoloną czerwienią semantyczną dla Critical/RISK/Worsening. Po korekcie automat liczy wyłącznie fonty użyte w runach oraz blokuje brand crimson `85182F` i tokeny `primary-*` w chrome. Kontrakt fallbacku jest formatowy: DOCX zapisuje Aptos w theme/docDefaults i `altName=Arial` w `fontTable.xml`; PPTX/XLSX zapisują Aptos w theme bez literalnych nazw fontów w runach. Substytucję Arial potwierdza dopiero render na maszynie bez Aptos, nie drugi literal w pliku.

## Pełny zbiór producentów i importerów binarnych

Skan obejmuje kod produkcyjny `server/src/**` i `src/**`. „Bezpośredni” oznacza import/require biblioteki; „pośredni” oznacza żywy wołacz renderera, który tę bibliotekę ładuje. Rozdzielenie jest ważne: liczenie samych importów npm ukrywa powierzchnie migracji, a liczenie każdego pliku z napisem `pptx` zawyża wynik dokumentacją i testami.

### PPTX — 17 wejść produkcyjnych

| Rodzaj | Plik | Silnik / rola |
|---|---|---|
| bezpośredni | `server/src/routes/assessment-reports.routes.ts` | `pptxgenjs`, legacy assessment export |
| bezpośredni | `server/src/routes/sponsor-reports.routes.ts` | `pptxgenjs`, sponsor report |
| bezpośredni | `server/src/services/assessment/assessmentDeckPptxRenderer.ts` | `pptxgenjs`, DRD/SIRI/ADMA renderer |
| bezpośredni | `server/src/services/assessmentDeckService.ts` | `pptxgenjs`, legacy assessment deck |
| bezpośredni | `server/src/services/deliverables/bundlePptxRuntime.ts` | `pptxgenjs`, bundle deck |
| bezpośredni | `server/src/services/export/UnifiedExportService.ts` | `pptxgenjs`, wspólny prosty eksport |
| bezpośredni | `server/src/services/managementReportsService.ts` | `pptxgenjs`, management reports |
| bezpośredni | `server/src/services/report/PptxExportService.ts` | `pptxgenjs`, pipeline v1 |
| bezpośredni | `server/src/services/report/pptx/PptxPipelineService.ts` | `pptxgenjs`, pipeline v2 / Deck Builder |
| pośredni | `server/src/routes/presentations.routes.ts` | `PptxPipelineService`, download Deck Builder |
| pośredni | `server/src/services/presentationGeneratorService.ts` | `PptxPipelineService`, generacja decku |
| pośredni | `server/src/services/deliverables/bundleExportRuntime.ts` | `PptxPipelineService` lub `bundlePptxRuntime` |
| pośredni | `server/src/services/finance/canonical/valuationPptxExportService.ts` | `PptxPipelineService`, canonical valuation |
| pośredni | `server/src/routes/v8/finance-v2/valuation.routes.ts` | canonical valuation export |
| pośredni | `server/src/services/valuationExportService.ts` | `PptxPipelineService`, valuation legacy |
| pośredni | `server/src/services/v8/transformationFinalOutputService.ts` | `PptxPipelineService`, transformation output |
| pośredni | `server/src/routes/work-canvas.routes.ts` | `UnifiedExportService.exportPptx` |

### XLSX — 21 bezpośrednich importerów produkcyjnych

`exceljs`: `server/src/routes/v8/finance.routes.ts`, `server/src/services/export/UnifiedExportService.ts`, `server/src/services/finance/canonical/financeExportService.ts`, `server/src/services/finance/canonical/financeImportService.ts`, `server/src/services/managementReportsService.ts`, `server/src/services/workbook/WorkbookBuilder.ts`, `server/src/services/workbook/WorkbookStyler.ts`, `server/src/services/workbook/workbookImport.ts`.

`xlsx` (SheetJS): `server/src/routes/assessment-reports.routes.ts`, `server/src/routes/finance-statements.routes.ts`, `server/src/routes/v8/finance.routes.ts`, `server/src/routes/work-canvas.routes.ts`, `server/src/services/ai/knowledgeIndexer.ts`, `server/src/services/dataCollection/connectors/csvXlsx.ts`, `server/src/services/deliverables/uploadContextExtract.ts`, `server/src/services/documentTextExtractor.ts`, `server/src/services/notebookService.ts`, `server/src/services/organizationContext/ContextDocumentService.ts`, `server/src/services/tablePlatform/CsvImportService.ts`, `server/src/services/tablePlatform/ExportService.ts` oraz `src/utils/notebookExport.ts`.

### DOCX — 5 bezpośrednich importerów produkcyjnych

`server/src/routes/report-builder-public.routes.ts`, `server/src/routes/report-builder.routes.ts`, `server/src/services/documentStudio/documentDocxRenderer.ts`, `server/src/services/export/UnifiedExportService.ts` oraz `src/utils/notebookExport.ts`. Docelowa migracja eksportów serwerowych dotyczy pierwszych czterech; klientowy `notebookExport.ts` pozostaje osobną granicą przeglądarkową.

## Pliki porównawcze

- `pliki-app/` — odpowiedzi i realne pliki z lokalnych tras lub jawnie opisany engine probe.
- `pliki-makieta/` — zatwierdzone pliki z `template-1-makiety-20260916`.
- `porownanie/structure-comparison.json` — wynik automatu.
- `zrzuty/*-page1.png` — pierwsza strona/slajd/arkusz każdego dostępnego pliku aplikacji i makiety.

Automat uruchamia się:

```bash
node docs/program/EXPORT_1_KROK0_20260916/compare-structure.mjs
```

Brak pliku aplikacji jest wynikiem `exists:false`, a nie pominięciem. To celowo utrzymuje Supplier Scorecard jako `EVIDENCE_MISSING`.
