# EXPORT-1 etap 3 — XLSX

Data: 2026-09-16
Tor: B
Profil: `consultify-supplier-scorecard`

## Wynik

Produkcyjne wejścia XLSX korzystają z `CanonicalXlsxExportService`:

- Table Studio `GET /api/table-platform/tables/:tableId/export/xlsx`,
- Materials `GET /api/workbook/:id/download` oraz tworzenie z szablonu, pustego
  skoroszytu i klonowanie.

Warunkowy renderer premium i stary fallback SheetJS zostały usunięte z eksportu Table Studio. Materiały są odbudowywane z utrwalonego `schema_json`, z zachowaniem bramki governance i receiptów eksportu.

Profil scorecard ma dwa arkusze zgodne z zaakceptowaną makietą: `Supplier scorecard`
i `Template fields`. Pierwszy
odwzorowuje zaakceptowaną makietę: zamrożenie `xSplit=2/ySplit=6`, nagłówki,
zebra, realne typy i formaty liczbowe, formuły E/H/I/J, formułowy wiersz Total,
semantyczne formatowanie warunkowe i legendę progów. `Template fields` zachowuje
mapę pól makiety 1:1. Profil uruchamia jawny parametr `profile` albo potwierdzone
pochodzenie SHEET-BASE; zgodny zestaw nagłówków Table Studio nie podmienia danych
formułami.
Portable font to Arial, zgodny z zaakceptowaną makietą i dostępny w LibreOffice.

Dla Table Studio silnik zachowuje wszystkie arkusze, wartości i jawne formuły
oraz dodaje formułowy `Summary`. Wartości złożone przechodzą przez ten sam
`formatFieldValue` co CSV, a szerokość uwzględnia treść. Dla Materials pełny
`WorkbookSchema` przechodzi przez kanoniczny adapter bez utraty CF, walidacji,
scaleń, arkusza Info i nazwanych zakresów.

## Dowody

- `evidence/parity.json` — 16/16 kontroli PASS, w tym nazwy arkuszy z fixture,
  poprawne reguły OOXML i piksele czerwone/zielone po renderze LibreOffice.
- `artifacts/northwind-supplier-scorecard.xlsx` — wygenerowany plik Northwind.
- `artifacts/data.png` i `artifacts/template-fields.png` — render LibreOffice obejrzany ręcznie; brak ucięć i nakładania, formuły zostały przeliczone, kolory wyniku są czytelne.
- `evidence/artifact-sha256.txt` — sumy SHA-256 artefaktów.

## Walidacja

```text
npx vitest run tests/unit/backend/services/CanonicalXlsxExportService.test.ts \
  server/src/services/tablePlatform/__tests__/ExportService.test.ts \
  tests/unit/backend/routes/workbook.routes.schema-endpoint.test.ts
# 58/58 PASS

npx vitest run tests/integration/routes/table-platform.sheet-artifact.sqlite.integration.test.ts
# 8/8 PASS na wbudowanym SQLite Node 24, bez natywnego sqlite3

npx tsc -p server/tsconfig.json --noEmit
# PASS

node scripts/dev/export1-xlsx-parity.mjs <accepted.xlsx> <generated.xlsx>
# 16/16 PASS; render LibreOffice: czerwone 6798, zielone 6756

soffice --headless --convert-to pdf <generated.xlsx>
pdftoppm -png -r 150 <generated.pdf> page
# 2 strony, obie obejrzane
```

Test HTTP Table Studio używa wbudowanego `node:sqlite`, więc działa na Node 24
bez ABI-zależnego `node_sqlite3.node`.
