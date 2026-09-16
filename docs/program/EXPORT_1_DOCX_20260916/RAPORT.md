# EXPORT-1 — DOCX

Data: 2026-09-16
Tor: B
Wykonawca: `[B] Codex-2`
Baza pakietu: `23303ff47dbda558f77213275c7998e34c5f4d83`
Wzorzec zaakceptowany przez właściciela: `template-1-makiety-20260916/pliki/client-final-report.docx`

## Wynik

Report Builder eksportuje DOCX przez wspólny kontrakt `DocumentSchema → documentDocxRenderer`, z zatwierdzonym systemowym `DOC-BASE` (`doc-template-system-en-client_final_report`) jako wymaganym wejściem. Prywatny renderer DOCX w trasie Report Builder został usunięty.

Profil `consultify-client-final` realizuje zaakceptowaną makietę z 16.09:

- A4, marginesy 20 mm góra/dół i 23 mm lewo/prawo;
- okładka z co-brandingiem Consultify · DBR77, miejscem na logo klienta, metadanymi i bez numeru strony;
- osobny spis treści i osiem sekcji: Executive summary, Context and scope, Methodology, Findings by axis, Maturity matrix, Recommendations, Roadmap, Appendix;
- nagłówek dokumentu z tytułem po lewej i klientem po prawej;
- stopka z co-brandingiem i `Page X of Y`;
- granat `#1B2A41`, akcent `#2563EB`, zebra `#F1F4F8`, linie `#D8DEE8`, zero crimson w chrome;
- powtarzalne nagłówki tabel i wiersze `cantSplit`;
- font contract: theme Aptos/Aptos Display, `docDefaults minorHAnsi`, `altName Arial` w `fontTable.xml`;
- referencje źródłowe raportu i sekcji zachowane w `DocumentSchema` oraz w sekcji traceability;
- język rekordu eksportu wyprowadzany z raportu/sekcji zamiast stałego `pl`.

PDF pozostaje etapem 4 po XLSX zgodnie z kontraktem EXPORT-1.

## Zmienione powierzchnie

- `server/src/services/export/docx/ReportBuilderDocxExportService.ts` — adapter Report Builder → `DocumentSchema`, zatwierdzony DOC-BASE, mapowanie Markdown i źródeł;
- `server/src/services/export/docx/docBaseThemePostprocessor.ts` — kontrakt theme/font fallback w OOXML;
- `server/src/services/documentStudio/documentDocxRenderer.ts` — opt-in profil zaakceptowanego Client final report;
- `server/src/services/documentStudio/documentDocxStyles.ts` — paleta i style profilu;
- `server/src/routes/report-builder.routes.ts` — oba wołacze DOCX (download i cloud publish) używają kanonicznego eksportera;
- `server/src/services/export/docx/__tests__/ReportBuilderDocxExportService.test.ts` — kontrakt schematu, źródeł, theme i fail-closed dla niezatwierdzonego szablonu;
- `server/scripts/export1-docx-proof.ts` — deterministyczny dokument Northwind;
- `server/scripts/verify-export1-docx-parity.ts` — automatyczne porównanie struktury z zaakceptowaną makietą.

## Dowody

- `dowody/northwind-client-final-report.docx` — wynik z ośmioma sekcjami;
- `dowody/northwind-client-final-report-page-3.png` — strona treści po renderze LibreOffice;
- `dowody/verification.txt` — PASS porównania OOXML.

Kontrola wizualna objęła wszystkie cztery strony: brak nachodzenia elementów, obcięcia treści, osieroconych wierszy tabel i niezamierzonych pustych stron.

## Walidacja

- `npx tsc -p server/tsconfig.json --noEmit` → PASS;
- ESLint dla zmienionych plików z `--quiet` → PASS (0 błędów);
- 5 plików testowych DOCX/template persistence → 55/55 PASS;
- test własny adaptera → 2/2 PASS;
- automatyczny parity check makieta ↔ wynik → PASS;
- render DOCX przez LibreOffice → 4 strony, każda obejrzana;
- szerszy zestaw E15: kandydat 31 PASS / 8 FAIL; baza 29 PASS / 8 FAIL. Delta regresji = 0. Dwa zastane FAIL dotyczą nieaktualnych asercji natywnego TOC wobec obecnego statycznego TOC, sześć zastanego problemu fontu PDFKit. PDF jest poza tym etapem.

Nie wykonano zmian na stagingu, wdrożenia, pushu ani zmian w torze A.
