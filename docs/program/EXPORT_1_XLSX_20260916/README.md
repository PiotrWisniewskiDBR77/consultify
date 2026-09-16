# EXPORT-1 etap 3 — XLSX

Data: 2026-09-16
Tor: B
Profil: `consultify-supplier-scorecard`

## Wynik

Oba produkcyjne wejścia XLSX korzystają z `CanonicalXlsxExportService`:

- Table Studio `GET /api/table-platform/tables/:tableId/export/xlsx`,
- Materials `GET /api/workbook/:id/download`.

Warunkowy renderer premium i stary fallback SheetJS zostały usunięte z eksportu Table Studio. Materiały są odbudowywane z utrwalonego `schema_json`, z zachowaniem bramki governance i receiptów eksportu.

Profil scorecard ma dwa arkusze: `Data` i `Summary`. `Data` odwzorowuje zaakceptowaną makietę: zamrożenie `xSplit=2/ySplit=6`, nagłówki, zebra, realne typy i formaty liczbowe, formuły E/H/I/J, formułowy wiersz Total, semantyczne formatowanie warunkowe i legendę progów. `Summary` zawiera wyłącznie formuły odwołujące się do `Data`. Font to Aptos, nagłówek wydruku zawiera Consultify i nazwę organizacji, a paleta nie zawiera crimson `A50034`.

Dla innych skoroszytów ten sam silnik zachowuje wszystkie arkusze źródłowe, ich wartości i jawne formuły oraz dodaje formułowy `Summary`. Dane tekstowe z Table Studio nadal przechodzą neutralizację formuł/DDE na granicy eksportu.

## Dowody

- `evidence/parity.json` — 11/11 kontroli PASS: liczba i nazwy arkuszy, nagłówki, formaty, formuły danych, formuły Total, formuły Summary, zamrożenie, Aptos, co-branding, zero crimson.
- `artifacts/northwind-supplier-scorecard.xlsx` — wygenerowany plik Northwind.
- `artifacts/data.png` i `artifacts/summary.png` — render LibreOffice obejrzany ręcznie; brak ucięć i nakładania, formuły zostały przeliczone, kolory wyniku są czytelne.
- `evidence/artifact-sha256.txt` — sumy SHA-256 artefaktów.

## Walidacja

```text
npx vitest run tests/unit/backend/services/CanonicalXlsxExportService.test.ts \
  server/src/services/tablePlatform/__tests__/ExportService.test.ts \
  tests/unit/backend/routes/workbook.routes.schema-endpoint.test.ts
# 44/44 PASS

npx tsc -p server/tsconfig.json --noEmit
# PASS

node scripts/dev/export1-xlsx-parity.mjs <accepted.xlsx> <generated.xlsx>
# 11/11 PASS

soffice --headless --convert-to pdf <generated.xlsx>
pdftoppm -png -r 150 <generated.pdf> page
# 2 strony, obie obejrzane
```

Test SQLite `table-platform.sheet-artifact.sqlite.integration.test.ts` nie uruchamia się w tym worktree z powodu brakującego natywnego bindingu `sqlite3` dla Node 24. Ścieżkę Table Studio pokrywa test zachowania serwisu, a ścieżkę Materials test HTTP, który parsuje zwrócony XLSX i sprawdza `Summary` oraz formuły.
