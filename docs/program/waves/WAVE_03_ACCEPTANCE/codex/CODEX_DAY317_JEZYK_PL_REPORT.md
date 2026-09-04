# CODEX — dyżur 317 — język PL

Data: 2026-09-04  
Marker: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`  
Gałąź: `codex/day317-jezyk-pl-20260904`  
Werdykt: **R0–R5 wykonane lokalnie; słowniki i bezpiecznik gotowe do odbioru. Dowód wizualny i wdrożeniowy: NOT_PROVEN.**

## Stan pozycji

| Pozycja | Stan | Wynik |
|---|---|---|
| R0 | ZROBIONE | oba źródła przeczytane; 2702 + 289 linii |
| R1 | ZROBIONE | 631 sklasyfikowanych: 113 DEFEKT-PL, 518 UZASADNIONE; 73 różne napisy defektowe |
| R2 | ZROBIONE DLA SŁOWNIKA | 113 wartości PL poprawionych w 3 rodzinach; 71 literalnych wołaczy, 42 bez potwierdzonego pełnego wołacza |
| R3 | ZROBIONE | 24 DEFEKT-EN poprawione; 2 fałszywe alarmy nazwisk odrzucone |
| R4 | ZROBIONE | podłogi liści i sufity defektów; dwa RED→GREEN |
| R5 | ZROBIONE | ten raport |

## Wejście — wyniki dosłowne

`git log --oneline -25 github-backup/grafika/m03-20260902` pokazał tip `192b38d022` i marker w historii jako:

```text
bc18bc7aca docs(rejestr): M6/M7 zamkniete, M8-M12 — '11 z 15' bylo liczba z obrazka, pulapka fikstury zamknieta, blad nadzorcy
MARKER OK
```

Sanity po założeniu worktree:

```text
bc18bc7acac2ec825ebb3db2f1309738ab034d58
```

`git status --short | head -3` nie wypisał żadnej linii. Dysk: 76 GiB wolne przed startem. Porty `5473` i `6333`: bez listenerów. Kontenery `cx-day317*`: `0`. Zdalna gałąź przed pierwszym pushem: brak.

Tip był 6 commitów przed markerem. Lista commitów i plików: `/private/tmp/cx-day317-jezyk-pl-artefakty/tip-ahead-log.txt` i `tip-ahead-files.txt`.

## Mianowniki

| Pomiar | PRZED | PO |
|---|---:|---:|
| liście PL | 34310 | 34310 |
| liście EN | 32321 | 32321 |
| identyczne PL=EN >3 znaki | 631 | 505 |
| Status | 114 | 114 |
| DEFEKT-PL | 113 | 0 |
| UZASADNIONE | 518 | 505 |
| DEFEKT-EN | 24 | 0 |
| PL bez EN | 2005 | 2005 |

Spadek identycznych `631 → 505` wynika z 113 napraw PL i 13 spośród napraw EN, które wcześniej były identyczne z PL. Liście nie spadły.

## R1 — klasyfikacja semantyczna

Skrypt zachowuje eksporty `flatten`, `justification`, `audit`, `render`, `run`. Reguła nie koduje 631 kluczy: używa zamkniętej mapy pojęć UI wymagających polskiego odpowiednika oraz ogólnych kategorii poprawnej identyczności (polskie internacjonalizmy, marki, metodyki, skróty, jednostki, placeholdery, daty i strefy czasowe).

Próbka kontrolna: `Status → UZASADNIONE`, `Tempo → UZASADNIONE`, `Owner → DEFEKT-PL`. Dodatkowa próbka 20 uzasadnionych była rozłożona równomiernie po 518 rekordach; wykryła i doprowadziła do przeklasyfikowania m.in. ról zawodowych, `custom setup`, `Budget-boxed`, `Branding`, `Certified` i `Registered`.

## R2 — naprawy PL i wołacze

Commity rodzin:

1. `542eb87171` — rdzeń pracy i inicjatyw, 21 wartości;
2. `40ba623764` — nawigacja, ustawienia i współpraca, 64 wartości;
3. `d7edcd8c54` — raporty i narzędzia odkrywania, 28 wartości.

Pełne wyszukanie bez obcięcia: `/private/tmp/cx-day317-jezyk-pl-artefakty/r2-callers.txt`. Wynik: 71 kluczy miało literalny pełny wołacz w `src/**`; 42 nie miały takiego trafienia i są raportowane jako **defekt bez potwierdzonego wołacza**. Wyszukanie samego liścia dawało masowe niejednoznaczne trafienia, więc nie zostało użyte jako dowód osiągalności.

Nie uruchomiono harnessu ani kadrów. Tłumaczenia są poprawione w danych, ale brak dowodu, że dłuższe etykiety nie łamią layoutu na każdym konsumencie.

## R3 — DEFEKT-EN

Detektor słownikowy (nie tylko diakrytyki) znalazł 24 prawdziwe defekty. Pełna lista plik:linia, wartości przed/po i commit jest w `REJESTR_JEZYK_PL_DEFEKT_EN_20260904.md`.

Fałszywe alarmy:

- `Guided by Dr. Piotr Wiśniewski` — nazwisko własne;
- `Paweł Bochniarz` — imię i nazwisko.

## R4 — testy i dowód mutacyjny

Pakiety są czysto plikowe. Pułapki Z33 (a)–(d) nie leżą na ścieżce: brak HTTP, ApiGateway, bazy, auth i middleware. Pułapka (e) nie dotyczy: testy nie renderują Reacta ani nie importują `react-i18next`.

Pełne nazwy PO:

```text
empty assertion baseline rejects growth in weak-only network/database assertion blocks
i18n PL semantic classification finds Polish words without relying on diacritics and preserves proper names
i18n PL semantic classification separates justified shared terms from untranslated interface concepts
i18n locale parity baseline prevents locale leaf loss and growth of classified language defects
```

Diff nazw PRZED→PO: 3 dodane powyższe testy i18n, 0 znikniętych. Plik: `/private/tmp/cx-day317-jezyk-pl-artefakty/nazwy.diff`.

Dowody mutacyjne, `--retry=0`:

- usunięto tymczasowo `common.chatAbout`: RED `expected 34309 to be greater than or equal to 34310`; po `cp` z kopii: GREEN;
- przywrócono tymczasowo `myWork.home = Home`: RED `expected 1 to be less than or equal to 0`; po `cp` z kopii: GREEN;
- po obu przywróceniach diff `public/locales/pl/translation.json` był pusty.

JSON-y: `r4-red-leaf.json`, `r4-red-defect.json`, `r4-green-after.json` w katalogu artefaktów.

## Bezpieczeństwo wysyłki i środowiska

Nie ustawiono żadnej zmiennej SMTP ani flagi wysyłki. Nie uruchomiono bazy, `server/src/index.ts`, runtime'u ani drenażu outboxu; testy były wyłącznie plikowe. Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane. Nie było połączeń do Railway, demo, stagingu ani produkcji.

## Korekty wobec instrukcji

1. B.3 podaje około `106 DEFEKT-PL / 62 napisy`; pełna klasyfikacja na markerze dała `113 / 73`. Nie dopasowywano liczby sztucznie.
2. B.3 podaje około `13 DEFEKT-EN`; słownikowa heurystyka plus ręczny przegląd dały 24. Dodatkowe 11 to głównie rodzina `Tabele` w angielskich aria-labelach.
3. §0.2c (B)/(C) zawiera w miejscu ścieżki testu opis prose w backtickach, więc polecenie nie jest wykonywalnym shellem. Zastosowano bezpieczne komendy punktowe `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run <jawne pliki> --retry=0`.
4. B.2 odwołuje się do struktury `§R.2`, ale w dokumencie nie ma sekcji `§R.2`. Raport zawiera wszystkie jawnie wymagane elementy z R5, B.3, §0.4a i Z33.
5. Uruchomienie wzorcowego `noEmptyAssertions.test.ts` regenerowało plik poza licencją `REJESTR_TESTY_PUSTE_20260903.md`. Za każdym razem zmianę przywrócono do markera; nie weszła do żadnego commita.

## TWIERDZENIA NIEZWERYFIKOWANE

- NOT_PROVEN: brak kadrów i pomiaru layoutu po wydłużeniu części etykiet.
- NOT_PROVEN: 42 klucze bez pełnego literalnego wołacza mogą być używane przez dynamicznie składany namespace; nie udowodniono osiągalności ani martwości.
- NOT_PROVEN: heurystyka DEFEKT-EN nie jest pełnym analizatorem języka naturalnego; `0` oznacza zero trafień obecnej jawnej reguły, nie matematyczny dowód braku każdego polskiego zdania.
- NOT_PROVEN: zachowanie produkcyjne, urządzenia, eksporty, owner acceptance i wdrożenie.
- EVIDENCE_MISSING: nie uruchomiono szerokiego korpusu komponentów; jednostkowe testy dowodzą klasyfikatora i ratchetu, nie renderowania wszystkich konsumentów.

## Artefakty i sumy

Katalog: `/private/tmp/cx-day317-jezyk-pl-artefakty`.

- `final-audit.json`: `6f7bca7de9544757dcdb54fa97241ab16ea0417c74662a7f398b9462a1d72774`
- `po.json`: `03ec80070047b18bd5945595aa25ba2be8994f83325043b14d33c310849f9f15`
- `przed-nazwy.txt`: `59a5f9b2b797493d836631e0ef5863c74325ed3041084828346fbcefe625a70e`
- `po-nazwy.txt`: `66cef102060d0103d4f2193bde3eed230f998f45c8327f373dd3769e256920be`
- `nazwy.diff`: `b934a426bef6c04e39197fe0fa4d8720ee3befb138af09d6729cb29c883420ae`
- komplet: `/private/tmp/cx-day317-jezyk-pl-artefakty/SHA256SUMS.txt`

## Commity

`8f10c1a036`, `542eb87171`, `40ba623764`, `d7edcd8c54`, `2d8718a037`, `82d0818c9d`, `932c9d0cf1`. Wszystkie zostały wypchnięte na `github-backup/codex/day317-jezyk-pl-20260904` po ukończeniu pozycji/rodziny.
