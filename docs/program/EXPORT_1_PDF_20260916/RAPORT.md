# EXPORT-1 — etap 4 PDF

Data: 2026-09-16
Tor: B
Wykonawca: `[B] Codex-2`
Baza: `3eae3a68934b0b999fab239ada847ba34a7320a4`

## Wynik

PDF raportowy ma jedną granicę produkcyjną: `DocumentSchema → CanonicalPdfExportService → documentPdfRenderer`. Oba wskazane w kontrakcie wywołania korzystają z tej granicy:

- DRD `/api/assessment-reports/assessment/:assessmentId/export/deck.pdf` buduje ten sam `AssessmentDrdReportSchema` co DOCX; usunięto rozjazd, w którym PDF był renderowany z modelu slajdów;
- Audits `/api/audits/reports/:id/export.pdf` zachowuje swój adapter domenowy, ale przekazuje wynik do wspólnego eksportera.

Eksporter odrzuca schemat bez tożsamości, tytułu lub sekcji, sprawdza kompletność bufora PDF i zwraca receipt z prawdziwym `documentId`, `artifactId`, wersją szablonu, liczbą sekcji, rozmiarem i SHA-256. Trasy zwracają `X-Export-Engine` i `X-Export-SHA256`.

Profil `consultify-client-final` renderuje zaakceptowany układ z 16.09: A4, okładka z pasem marki i trzema polami metadanych, granat `#1B2A41`, niebieski akcent `#2563EB`, co-branding w stopce, numerację stron poza okładką, tabele i osiem sekcji raportu. Chrome nie używa crimson. Font Lato jest osadzany w PDF jako bezpieczny serwerowy odpowiednik kontraktu Aptos/Arial i zachowuje polskie znaki.

## Dowody

- `dowody/northwind-client-final-report.pdf` — plik 4 strony A4, 8/8 sekcji;
- `dowody/northwind-client-final-report-page-1.png` — obejrzana okładka;
- `dowody/northwind-client-final-report-page-3.png` — obejrzana strona treści z tabelami i stopką;
- `dowody/receipt.json` — receipt eksportu z SHA-256;
- `dowody/pdfinfo.txt` i `dowody/northwind-client-final-report.txt` — struktura i odczyt widocznego tekstu.

## Walidacja

- test kanonicznego eksportera: poprawny PDF, widoczne sekcje/tabele/co-branding, receipt i fail-closed;
- parytet `documentPdfRenderer`: 10/10 PASS;
- polskie znaki i osadzony font: 1/1 PASS;
- adapter Audits: 10/10 PASS;
- test HTTP Audits ma nowe asercje nagłówków receipt; lokalnie SKIP bez autoryzowanego RealPG;
- render dowodowy: 8/8 sekcji, A4, 4 strony, kontrola wizualna stron 1 i 3;
- backend TypeScript, `git diff --check` i bramki repo uruchomione przed zamknięciem paczki.

## Granica dowodu

Zastany dump kroku 0 zawierał zero `audit_reports`, dlatego rzeczywisty eksport raportu Audits z tego dumpu pozostaje `NOT_PROVEN`; paczka nie tworzy sztucznego rekordu w bazie. Dowód DRD w tej paczce obejmuje wspólny schemat i żywy renderer, ale nie ponawia HTTP na zamkniętym kontenerze dumpu z kroku 0.

Nie wykonano wdrożenia ani zmian zmiennych Railway.
