# CODEX DAY 350 — G16 PAKIET — RAPORT

Stan roboczy: R0–R5 wykonane; R6 w toku.

## R0 — twarde zasady

1. Przeczytałem i stosuję zasadę, że bramkę właścicielską podnosi wyłącznie właściciel; nie nadam jej wyniku pozytywnego i nie dotknę żadnego `MODULE_ACCEPTANCE.md`.
2. Przeczytałem i stosuję bezwzględny zakaz połączeń ze stagingiem, demo i produkcją (`Z28`).
3. Przeczytałem i stosuję zasadę, że każde zdanie dodane do pakietu musi mieć odtwarzalne źródło w repo; niepotwierdzone twierdzenia trafią do pytań raportu.

## Start

`df -h /` przed materializacją: 17 GiB wolnego; po materializacji: 8.4 GiB wolnego. Porty 6397 i 5537 były wolne. Kontener `cx-day350-pg` nie został postawiony, ponieważ dyżur dokumentacyjny go nie potrzebuje.

Wynik markera (dosłownie):

```text
MARKER OK
```

Wynik sanity (dosłownie):

```text
6a4919f72db338e7f49a2cacb3787d20cc649883
```

`git status --short | head -3` nie wypisał żadnej linii.

## R1 — inwentarz dryfu

- pakiet: 381 wierszy, 16 sekcji modułowych;
- ostatni commit pakietu: `3cb7390766`;
- 49 scaleń na pierwszym rodzicu;
- 171 unikalnych zmienionych plików produktu;
- pełny inwentarz, reguły mapowania, lista 49 scaleń i tabela 16 modułów: `evidence/g16/day350/dryf-pakietu.md`.

Rozbieżności wobec instrukcji: brak w mianownikach R1.

## R2 — przegląd 16 modułów

| Moduł | Werdykt |
| --- | --- |
| Chat | poprawione: preferencje per użytkownik (`15309dd3a6`) i usunięcie martwego poddrzewa (`1c4b5a5635`) |
| My Work | poprawione: prawy panel Idei podłączony (`660482d485`) |
| Interview | poprawione: kontrakt menu akcji (`924ebd3c7a`) |
| Tools | poprawione: 7-etapowy SWOT podłączony za flagą OFF (`937f2d3193`) |
| Assessment | sprawdzona, bez zmiany kroków pakietu; wybór silnika `DEC-389` nie jest jeszcze rozstrzygniętym ekranem |
| Initiatives | poprawione: kontrakty kart i ograniczenie 6/24 (`500ae7d68c`, `e25eb19b64`, `DEC-387`, `DEC-388`) |
| Execution | sprawdzona, bez zmian |
| Results | sprawdzona, bez zmian |
| Finance | sprawdzona, bez zmian |
| Materials | sprawdzona, bez zmian |
| Audits | sprawdzona, bez zmian |
| Meeting | sprawdzona, bez zmian |
| Organization | sprawdzona, bez zmian |
| Admin Panel | sprawdzona, bez zmian |
| Settings | sprawdzona, bez zmian |
| Partner Portal | sprawdzona, bez zmian |

Każdy moduł sprawdzono pod kątem kroków, nowych zmian i pozycji „Czego NIE zgłaszaj”. Weryfikacja była statyczna w repo; nie łączono się ze stagingiem (`Z28`).

## R3 — stan oczekiwany, nie zgłaszaj

Pakiet otrzymał listę pięciu jawnie zmierzonych flag domyślnie OFF:
`VITE_VF1_INITIATIVE_SECTIONS_COMPLETE`, `VITE_VF1_INITIATIVE_CARD_CONTRACT`,
`VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES`, `VITE_VF1_DECISION_CARD_CONTRACT` i
`VITE_VF1_DECISION_SPECA`. Źródła kodowe: `InitiativeDocumentView.tsx:5291-5302`,
`initiativeCardContract.ts:939-960`, `dynamicSwotSevenStagesFlag.ts:1-16`,
`DecisionDetailView.tsx:490-530`.

Własny pomiar 6/24: lista sekcji w `InitiativeDocumentView.tsx` ma 24 deskryptory, a filtr
szablonu przy niepustej konfiguracji przepuszcza zmierzone 6; wynik potwierdzają `DEC-388` i
R1/R2 dyżuru 338 (`e25eb19b64`). Nie utożsamiam tej liczby z pojemnością kadru.

Komplet pozycji fali 2 dodano z numerami decyzji na podstawie `FALA_2_PO_STAGINGU.md`. Dwie
pozycje z tego starszego rejestru — panel Idei i preferencje Czatu — oznaczono jako później
scalone (`660482d485`, `15309dd3a6`), zamiast nadal przedstawiać je jako niewykonane.

## R4 — zobaczysz inaczej

Do pakietu dodano tabelę sześciu zmian z modułem, ekranem, stanem przed/po, SHA i bezwzględnym
warunkiem redeployu. Zmiany za flagami OFF są oznaczone jako niewidoczne bez decyzji; żadnej
flagi nie włączono.

## R5 — spójność pakietu

1. Zasady wspólne poprawiono: decyzje ON dla Wyników/Finansów/Organizacji/kreatora wywiadu
   pochodzą z `DEC-2026-09-03-347`…`350`, ale ich widoczność pozostaje niezweryfikowana (`Z28`).
2. Wersję stagingu zmieniono na podane przez nadzorcę `1c4b5a5635`, jawnie niezweryfikowane;
   zachowano poprzednie brzmienie `fb6547b7d0`.
3. Format zgłoszenia pozostał bez zmian: `moduł · ekran · co widzę · co oczekiwałem · zrzut`.
4. Dopisano, że przelot może być rozłożony na raty; źródłem jest kolumna `Data` w tabeli.
5. W istniejących krokach dotyczących osi/sekcji pozostaje jawne polecenie „rozwiń”; nowe
   pozycje nie każą oceniać zwiniętej sekcji.
6. Nie zmieniano twierdzeń o wartościach PL/EN, więc nie wprowadzono wniosku opartego wyłącznie
   na istnieniu klucza. Słowniki zostały zmierzone jako 35198/33065.

## Kontrole przed commitem R1

Pierwsze uruchomienie strażnika znalazło fałszywe trafienia wyłącznie w opisowych zdaniach tego raportu. Sformułowania poprawiono, po czym kontrolę wykonano ponownie:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY350_G16_PAKIET_REPORT.md
evidence/g16/day350/dryf-pakietu.md
rozlacznosc OK
brak wpisow do G16 OK
```

## TWIERDZENIA NIEZWERYFIKOWANE

- Faktyczny znacznik aktualnie wdrożony na stagingu pozostaje niezweryfikowany z powodu `Z28`.

## PYTANIA DO WŁAŚCICIELA I NADZORCY

- Który znacznik naprawdę stoi dziś na stagingu — `fb6547b7d0` z pakietu czy `1c4b5a5635` od nadzorcy — i czy staging ma być zredeployowany przed przelotem?
- Czy naprawy za flagami `default OFF` (`DEC-387`, `DEC-388` i pozostałe) mają zostać włączone przed przelotem, czy właściciel ma je zobaczyć dopiero po akcepcie na zrzutach?

## CZEGO PAKIET NADAL NIE OBEJMUJE

Sekcja zostanie domknięta po przeglądzie R2–R5. Bez połączenia do stagingu nie można potwierdzić widoczności zmian na konkretnym wdrożonym SHA.
