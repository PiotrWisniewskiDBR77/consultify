# CODEX DAY 298 — silnik raportu Oceny DRD

Stan bieżący: `IN_PROGRESS` — R1–R2 zakończone, R3–R4 częściowe, R5 w toku, R6 niewykonane.

## Baza i sanity

```text
MARKER OK
ebfcf3d580d58734d1c2eeabcc4aa90dbfd16943
git status --short: pusty
```

Po aktualnym fetchu tip `github-backup/grafika/m03-20260902` jest przed markerem. Zgodnie z DEC-2026-08-26-95 praca pozostaje na markerze; scalenie nowszego tipa należy do nadzorcy.

## R1 — pomiar

Wynik: wykonany. Szczegółowa tabela źródeł i braków znajduje się w `REJESTR_SILNIK_RAPORTU_OCENY_20260903.md`.

Najważniejszy wynik: istniejąca trasa Method Core zapisuje snapshot strukturalny dostarczony przez klienta, lecz nie generuje ani nie przechowuje DOCX/PDF. Istniejący silnik DRD produkuje starszy model HTML, nie zaakceptowany model prototypu.

## R2 — model zaakceptowanego raportu

Wynik: wykonany w `2c9be2b1b8`. Builder bierze identyfikowalną sesję, wyniki 39 obszarów i jawnie dostarczoną treść raportu. Skale i wyniki osi wyprowadza z kernela. Test równości dla `SAMPLE_DRD_SCORES` porównuje cały model treści z modelem prototypu i przechodzi 1:1.

Pomiar RED wykazał, że stary `calculateAxisScore` zaokrągla wynik osi do jednego miejsca (`4,2` zamiast zaakceptowanego `4,22`). Builder liczy średnią z obszarów bez pośredniej utraty precyzji. Po korekcie: 3/3 testy zielone.

## R3 — dane brakujące

Stan: `PARTIAL`. Migracja `20260903_assessment_report_metadata.sql` tworzy addytywną tabelę 1:1 z sesją, FK do organizacji i sesji oraz tenantowy unikat. Serwis przechowuje zespoły, okres, zakres, wyłączenia, kalendarz, rekomendacje z priorytetem/horyzontem/właścicielem oraz uzasadnienie sufitu per oś. Jedna reguła E0–E4 → cztery etykiety ma test w R2.

Migracja na 6302: pierwszy przebieg zastosował dokładnie 1 plik, drugi `Applying migrations: 0`. Zimny odczyt osobnym klientem `pg` zwrócił dokładnie jeden wiersz `day298-session`, w tym `advisory_team`, `exclusions`, `recommendations` i `recommended_ceiling_rationales`; dowód: `/private/tmp/cx-day298-silnik-raportu-artefakty/metadata-cold-read.json`.

### STOP — R3 karta UI i tłumaczenia poziomów

Rodzaj: MERYTORYCZNY

Powód: instrukcja zapowiada tabelę licencji, ale jej nie zawiera; karta wymaga zmiany istniejącego ekranu sesji, a tłumaczenia zmiany dwóch luster struktury DRD i istniejących testów kontraktowych.

Licencja, którą sprawdziłem: brak tabeli licencji w 685-liniowej instrukcji; Z13 wymienia migrację, moduł modelu/składu i testy, lecz nie wymienia konkretnego komponentu karty ani luster `drdStructure.ts` do zapisu.

Dowód: grep instrukcji dla `LICENC`/`W1`–`W5` nie znalazł tabeli; R1 ustalił rzeczywiste ścieżki struktur.

Co dostarczyłem ZAMIAST zmiany: gotowa migracja, tenantowy serwis zapisu/odczytu i zimny readback pól, czyli backendowy kontrakt dla późniejszej karty; brakujące UI pozostaje jawne.

Co zrobiłbym, gdyby zapadła decyzja X: po imiennej licencji podłączyłbym formularz kanoniczny do serwisu przez tenantową trasę i zsynchronizował tłumaczenia w obu lustrach z testem parytetu.

Rekomendacja dla nadzorcy: wskazać dokładny komponent sesji i licencję na oba lustra struktury albo rozdzielić tłumaczenia na osobny duty o dużym promieniu rażenia.

Stan: zacommitowano częściowo po zweryfikowaniu migracji i odczytu.

Czy kontynuowałem pozostałe pozycje: TAK — R4 nie wymaga improwizowania brakującego UI.

## R4 — skład i podpięcie

Stan: `PARTIAL`. Zaakceptowany generator przyjmuje teraz opcjonalny moduł modelu, więc prototyp i silnik używają dokładnie jednego kodu składu. Przebieg domyślny i przebieg z jawnym modelem miały identyczne `word/document.xml`. PDF ma 21 stron A4; wyciąg zarządczy ma 4 strony (okładka, zbiorcze, mapa drogowa, kolejny krok/granice).

Artefakty poza repo:

- DOCX SHA-256 `10c4e8ec747aca491aca3b745d008d5f7757da8f95255611c674dd94c071d736`
- PDF pełny SHA-256 `22e3896986e52d11e01b24346f060468931431234e5cf76f3fc04696cbeff6a7`
- PDF zarządczy SHA-256 `0544be6b1c46e22947ffdda0a8945914d9833c828ea5f237a3e8930d684ba584`

### STOP — R4 realna trasa i magazyn plików

Rodzaj: MERYTORYCZNY

Powód: obecna trasa Method Core wymaga gotowego `content` od klienta i zapisuje wyłącznie JSON; brakuje imiennej licencji na zmianę handlera oraz decyzji o docelowym magazynie binarnych DOCX/PDF.

Licencja, którą sprawdziłem: Z13 zezwala na moduł modelu/składu, migrację i testy; brak tabeli licencji oraz brak wskazania konkretnego magazynu plików.

Dowód: `createArtefactSnapshot` w `server/src/routes/method-core.routes.ts` oblicza hash `body.content` i zapisuje `method_report_snapshots`; nie ma ścieżki pliku ani wywołania kompozytora.

Co dostarczyłem ZAMIAST zmiany: wspólny skład DOCX, pełny PDF i czterostronicowy wyciąg z jednego modelu, wraz z hashami i renderami. Nie podłączyłem atrapy pliku do przypadkowego magazynu.

Co zrobiłbym, gdyby zapadła decyzja X: dodałbym generowanie po odczycie zamrożonej sesji, atomowy zapis obu plików w wskazanym magazynie oraz manifest plików powiązany z `method_report_snapshots`.

Rekomendacja dla nadzorcy: wskazać istniejący kanoniczny magazyn binarnych artefaktów lub zatwierdzić nową tabelę manifestu i katalog storage; przyznać licencję na handler `/outputs/:id/report`.

Stan: zacommitowano częściowo wspólny skład; brak realnego HTTP i pliku z sesji.

Czy kontynuowałem pozostałe pozycje: TAK — dowód wizualny wspólnego składu jest niezależny.

## Z30 — deklaracja testowa

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Dowody: `env` → `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` → 0 wierszy; grep drenów w `server/src/Gateway.ts` → 0 trafień.

## Migracje wejściowe

Pierwszy pełny przebieg zakończył się `Postgres migrations complete`. Drugi przebieg: `Applying migrations: 0`; idempotencja potwierdzona. Logi są poza repo w `/private/tmp/cx-day298-silnik-raportu-artefakty/`.

## Pomiar zasięgu testów

PRZED zmianami produktu zapisano 68 pełnych nazw przypadków do `/private/tmp/cx-day298-silnik-raportu-artefakty/przed-nazwy.txt`. Pomiar PO i diff nazw pozostają do wykonania w R5.

## Korekty wobec instrukcji

- Ścieżka `src/method-core/methods/drd/drdStructure.ts` nie istnieje na markerze; rzeczywiste lustra to `src/services/drdStructure.ts` i `server/src/data/drdStructure.ts`.
- Dokument instrukcji nie zawiera zapowiadanej tabeli licencji. Stosuję interpretację bezpieczniejszą: modyfikacje ograniczam do plików wskazanych imiennie lub nowych plików jawnie dozwolonych przez Z13.

## Twierdzenia niezweryfikowane

- Zgodność modelu z prototypem: `NOT_PROVEN`.
- DOCX/PDF oraz wyciąg 4-stronicowy: `NOT_PROVEN`.
- Realny HTTP → ApiGateway → JWT → PostgreSQL → plik → zimny odczyt: `NOT_PROVEN`.
- Zgodność wizualna strona po stronie oraz osiem kadrów: `NOT_PROVEN`.
