# CODEX DAY 298 — silnik raportu Oceny DRD

Stan końcowy duty: `PARTIAL` — R1–R2 wykonane; R3–R5 częściowe; R6 wykonane jako uczciwy raport. Nie promować do demo/release.

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

PRZED zmianami produktu zapisano 68 pełnych nazw przypadków do `/private/tmp/cx-day298-silnik-raportu-artefakty/przed-nazwy.txt`. PO zmianach: 71/71 PASS, pełne nazwy w `po-nazwy.txt`. Diff zawiera dokładnie trzy nazwy dodane i zero znikniętych:

```text
accepted DRD report model from MethodSession fails closed when required axis content is absent
accepted DRD report model from MethodSession maps E0-E4 to the four accepted evidence labels with one rule
accepted DRD report model from MethodSession reproduces the accepted prototype model for SAMPLE_DRD_SCORES
```

Pułapki §0.2d dla tego pakietu: (a), (b), (d) nie leżą na ścieżce, bo są to czyste funkcje modelu bez routera/middleware; (c) nie dotyczy jako dowód bazy, bo pakiet jawnie uruchomiono `RUN_DB_TESTS=0 MOCK_DB=true` i nie jest raportowany jako egzekucja PG; (e1–e5) są przedmiotem testu modelu i wspólnego składu, ale (e6) dowiedziono osobno zimnym klientem `pg`, a (e7) renderem PNG. Komenda pakietu zawierała `--retry=0`.

Migracje/zimny odczyt: nie są częścią pakietu jednostkowego. Biegły z `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres` i jawnym `DATABASE_URL` do `127.0.0.1:6302/cx298`; końcowy przebieg migracji = 0. Nie uruchomiono routera, więc bramki (a), (b), (d) nie mogły fałszować wyniku. Asercja `DB_TYPE=postgres` w nowym pakiecie PG nie powstała, dlatego nie nazywam tego testem Vitest PG — jest to osobny zimny readback klientem `pg`.

## R5 — dowód

Stan: `PARTIAL`.

- 21 stron modelu przykładowego wyrenderowano i obejrzano; wszystkie są piksel-w-piksel identyczne z prototypem (`mean_abs_rgb=0.0000` każda).
- DOCX render: 21 stron; pełny PDF: 21 stron A4; wyciąg: 4 strony A4. Brak ucięć, nakładania i sierot w oględzinach.
- `check-artefakt`: brak nowych naruszeń, baseline 9 → aktualnie 9.
- Przykładowy raport ma poprawione skale osi 5 i 6 na 1–6 w osobnym commicie `412d3beb96`.
- Nie wykonano ośmiu kadrów runtime. Ekran nie ma podpiętego silnika; sfotografowanie starego UI lub repliki nie dowodziłoby działania.
- Nie wygenerowano raportu z realnej sesji demo przez HTTP. Dowód wizualny dotyczy wyłącznie modelu `SAMPLE_DRD_SCORES`.

## R6 — przekazanie

Zdanie dla `ASM-OWN-024/025`: **zaakceptowany skład raportu DRD jest odtwarzany 1:1 z wymiennego modelu i ma backendowe pola sesyjne, ale przycisk „Generuj raport” nadal nie uruchamia tego silnika ani nie zapisuje DOCX/PDF; pozycje pozostają PARTIAL do czasu realnego HTTP/PG/storage i kadrów runtime.**

Nadzorca może bezpiecznie integrować R1/R2 oraz migrację/metadane po przeglądzie. Nie powinien oznaczać całego duty jako zamkniętego ani włączać narratora LLM. Flaga LLM default OFF nie została dodana; istniejący narrator starszego HTML przyjmuje klienta przez injection, ale nowy zaakceptowany skład go nie wywołuje.

## Korekty wobec instrukcji

- Ścieżka `src/method-core/methods/drd/drdStructure.ts` nie istnieje na markerze; rzeczywiste lustra to `src/services/drdStructure.ts` i `server/src/data/drdStructure.ts`.
- Dokument instrukcji nie zawiera zapowiadanej tabeli licencji. Stosuję interpretację bezpieczniejszą: modyfikacje ograniczam do plików wskazanych imiennie lub nowych plików jawnie dozwolonych przez Z13.

## Twierdzenia niezweryfikowane

- Zgodność modelu przykładowego z prototypem: zweryfikowana testem 1:1; zgodność modelu z realnej sesji: `NOT_PROVEN`.
- DOCX/PDF oraz wyciąg 4-stronicowy dla modelu przykładowego: zweryfikowane; dla realnej sesji: `NOT_PROVEN`.
- Realny HTTP → ApiGateway → JWT → PostgreSQL → plik → zimny odczyt: `NOT_PROVEN`.
- Zgodność wizualna 21 stron modelu przykładowego: zweryfikowana; osiem kadrów runtime: `NOT_PROVEN`.
- Karta „Metryka badania” w UI: `NOT_PROVEN` / niewykonana.
- Polskie tytuły poziomów osi 1–4 i 7: niewykonane.
- Narrator deterministyczny zaakceptowanego modelu oraz flaga LLM default OFF: niewykonane.
