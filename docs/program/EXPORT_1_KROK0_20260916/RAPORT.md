# EXPORT-1 krok 0 — freeze

**GO Z POPRAWKAMI W118:** pełny inwentarz, realne lokalne wywołania, pliki porównawcze, poprawiony automat struktury i plan rozszerzenia istniejącego `UnifiedExportService` są gotowe. Etap PPTX może ruszyć w następnym commicie.

- Baza: `85541745e8226562b75ab318e1efe1f8178b5097`.
- Dane: lokalny dump Northwind, 1808 tabel, hash w `HTTP_RECEIPT.json`.
- Realne HTTP: DRD 3×200, Workbook 200, Report Builder 409 przez quality gate, Deck Builder 422 przez quality gate, Audits 404 przez brak raportu.
- Automat: `node compare-structure.mjs`; wynik `porownanie/structure-comparison.json`.
- Zrzuty: 6 pierwszych stron/slajdów/arkuszy, każdy < 125 KB.
- Najważniejszy brak dowodu: Supplier Quality Scorecard i Audit report nie występują w użytym dumpie. Wymagają nowszego dumpu lub jawnego lokalnego fixture przed implementacyjnym freeze.
- Najważniejsza luka jakości: obecny DRD działa, lecz nie przypomina zatwierdzonej makiety; Report Builder i deck steering nie przechodzą własnych bramek jakości.
- Korekta W118: `B42318` jest dozwoloną czerwienią semantyczną, a fallback fontu ma inny dowód per format. Blokowany brand crimson to `85182F`/`primary-*`; fonty w parytecie liczone są tylko z runów.
- Propozycja granicy i kolejność PPTX → DOCX → XLSX: `KONTRAKT_MODULU.md`.
- PDF przez `documentPdfRenderer` jest etapem 4 po XLSX.
