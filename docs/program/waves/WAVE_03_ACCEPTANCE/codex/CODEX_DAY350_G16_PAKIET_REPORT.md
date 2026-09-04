# CODEX DAY 350 — G16 PAKIET — RAPORT

Stan roboczy: R0 i R1 wykonane; R2–R6 w toku.

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
