# EXPORT-1 — etap 2, poprawka W151

## Wynik

Poprawka zamyka cztery P1 z Wpisu 151 i zachowuje kontrakt DEC-543: ustalenia jakościowe są zwracane jako ostrzeżenia, ale błąd renderowania nadal blokuje zapis uszkodzonego PPTX. Nowy renderer ma jawny cutover `VITE_EXPORT_PPTX_V2`; kod jest domyślnie OFF, staging ma zmienną `true` ustawioną bez wywołania deploymentu.

Paczka rozpoczęła się z bazy `a1932f5caa` wskazanej we Wpisie 159. Przed freeze została przeniesiona na najnowszą linię wskazaną przez CTO. Nie zmienia migracji ani plików toru A.

## Cztery P1

1. Trasa download pobiera `organizations.name AS organization_name`; `BoardDeckExportService` nie używa już `organization_id` jako tekstu stopki. Test i artefakt używają realnego kształtu sluga `ateliertoys-demo-session-*` i dowodzą stopki `Consultify · Atelier Toys · Internal` oraz braku sluga w XML.
2. Adapter wypisuje wyłącznie pola treści. Identyfikatory, typy, flagi, kolejność, style i inne pola techniczne są pomijane; `c-77`, `true` i metadata `count: 12` nie trafiają do PPTX.
3. `deck_json` jest nadal nakładany na bogaty `unified_json`. Stary `PptxPipelineService` działa jako walidator integralności przed rendererem V2, a jego `warnings[]` przechodzi do istniejącej bramki. Test z celowo zepsutym blokiem potwierdza błąd fail-closed, brak persystencji i zachowanie poprzednich bajtów pliku.
4. `presentations.builder.export.pptx` ma wartość `Export PPTX` w katalogach EN i PL; fallback w `ShareModal` jest zgodny.

## Cutover i rollback

- `isExportPptxV2Enabled()` zwraca `true` wyłącznie dla dokładnej wartości `VITE_EXPORT_PPTX_V2=true`; brak, `false` i `TRUE` pozostawiają stary renderer.
- `Dockerfile.api` i `Dockerfile.ie-demo` deklarują build arg i env dla flagi.
- Railway: projekt `consultify`, środowisko `staging`, usługa `consultify`; zmienna została ustawiona na `true` z `--skip-deploys` i odczytana zwrotnie jako `true`. Nie uruchomiono deploymentu.
- Rollback: ustawić `VITE_EXPORT_PPTX_V2=false` dla usługi `consultify` na stagingu i przebudować/wdrożyć usługę. Ścieżka OFF generuje plik bezpośrednio przez dotychczasowy `PptxPipelineService`.

## Dowód treści i parytetu

`dowody/deck-builder-export.pptx` ma 3 slajdy i został wygenerowany powtarzalnym skryptem `dowody/generate-evidence.ts`. Kontrola OOXML liczy trzy punkty oraz nagłówki i komórki tabeli po dokładnej treści. Każdy oczekiwany element występuje jeden raz; pola metadata nie występują. Render LibreOffice ma trzy obrazy 1921×1080, a montaż został obejrzany po poprawce.

## Walidacja

- skupiona rodzina: 32 PASS i 1 test RealPG pominięty bez lokalnego URL przed końcowym rebase; osobna rodzina renderera bieżącego: 13/13 PASS, w tym realny V2 cutover i zepsuty blok;
- server TypeScript: RC=0;
- Docker VITE flag guard: 4/4 PASS;
- ESLint zmienionych plików: 0 błędów; zastane warningi dużej trasy nie są podnoszone;
- `git diff --check`: PASS;
- artefakt PPTX: 72 946 B, SHA-256 `e45ff0128dd2a8d10cbea8ef669c82e865337acf66a5e466d24d9a664e16796e`;
- montaż: SHA-256 `77cc38ec84f17b0d0a7fa7b304070863a054f9da495da47cc658f42ca0c41123`.

Końcowy SHA, wyniki po rebase i dokładny receipt są w `dowody/verification.txt`.
