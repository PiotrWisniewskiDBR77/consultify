# Dyżur 301 — licznik P0/P1 według E1

Marker: `416432abaf`  
Gałąź: `codex/day301-licznik-p0p1-e1-20260903`

## R1 — pomiar źródeł

| Źródło | Pomiar pozycji | Format wiersza |
|---|---:|---|
| `ROZLICZENIE_P0P1_20260903.md` | 85 unikalnych ID | tabela R2, ID w pierwszej kolumnie |
| `ROZLICZENIE_P0P1_DECYZJE_20260903.md` | 52 ID w tabelach R1; w tym 32 w R1c | ID w pierwszej kolumnie; zbiór owner-feedback ma sufiks `[OF]` |
| `DECYZJE_WLASCICIELA_P0P1_20260904.md` | 56 numerowanych pozycji, 20 rodzin decyzji | wiersze `R-1`…`R-20`, mapowania ID w treści pakietu |
| `FALA_2_PO_STAGINGU.md` | 21 wierszy rejestru | DEC w pierwszej kolumnie, źródłowe ID w trzeciej |
| `OWNER_DECISION_LEDGER_2026-08-24.md` | 385 wierszy DEC | DEC w pierwszej kolumnie |

Wyniki sześciu obowiązkowych pomiarów zgadzają się z liczbami instrukcji: pliki mają odpowiednio 386/240/349/78 linii, pierwsze rozliczenie ma 85 unikalnych ID, a pakiet właściciela 56 numerowanych wierszy. `DEC-2026-09-03-362` leży w linii 414. W pierwszym rozliczeniu występuje 27 numerów `ASM-OWN-0XX`; drugi, odrębny zbiór występuje w R1c drugiego rozliczenia jako 24 identyfikatory `ASM-OWN-001[OF]`…`ASM-OWN-028[OF]` (z lukami 004, 005, 020, 022). Sufiks jest więc częścią tożsamości, nie dekoracją.

Dowód wejścia: `/private/tmp/cx-day301-licznik-p0p1-artefakty/r1-wejscie.txt`.

## Korekty wobec instrukcji

Brak korekt dla sześciu tez wejściowych. Składnia przykładowej komendy testowej w §0.2c zawiera opis zamiast wykonywalnej ścieżki; repozytoryjny wzorzec potwierdził runner `node:test`, dlatego pakiet R4 używa `node --test`.

## R2–R4 — skrypt, rejestr i mutacje

Skrypt parsuje 121 odrębnych obiektów, zachowuje `[OF]`, sprawdza pełne numery DEC w ledgerze oraz sprawdza SHA przez `git cat-file` i `git merge-base --is-ancestor`. Rejestr ma stałą datę migawki, marker i komendę odtworzenia; dwa kolejne uruchomienia dały pliki identyczne bajtowo.

`RUN_DB_TESTS=0 MOCK_DB=true node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`: 5/5 PASS. Każdy test wprowadza osobną mutację: kolizję tożsamości, obcy DEC, obcy SHA, zbyt mały mianownik albo brak werdyktu. Dowód: `/private/tmp/cx-day301-licznik-p0p1-artefakty/r4-tests.txt`.

## R5 — realne źródła

| Werdykt | Liczba |
|---|---:|
| NAPRAWIONE | 26 |
| ZAMKNIETE_DEC | 12 |
| ODLOZONE_DEC | 58 |
| W_BUDOWIE | 0 |
| BLOKUJE | 25 |
| Mianownik | 121 |

Wynik jest o 3 wyższy od ręcznej tezy 22. Różnicę stanowią `ASM-OWN-001`, `ASM-OWN-002` i `ASM-OWN-003` z pierwotnego rozliczenia. Pakiet decyzji R-4 rozstrzyga identycznie ponumerowane pozycje z rejestru owner-feedback, czyli `ASM-OWN-001[OF]` i `ASM-OWN-002[OF]`; `ASM-OWN-003[OF]` rozstrzyga R-1. Bez sufiksu ręczne odejmowanie scaliło te obiekty. Błąd leży zatem w ręcznym zdaniu 22, nie w źródłowym mianowniku ani parserze. Pełna lista 25 pozycji i powody są w generowanym rejestrze.

## R6 — werdykt i granice dowodu

Stan dyżuru: **GOTOWE**. Odtwarzalny wynik reguły E1 to **25 pozycji BLOKUJE**, nie 22.

Pozycje wymagające dowodu wzrokowego lub runtime, które pozostają blokujące: `INT-INIT-AI-OBS-001` (Interview → kreator inicjatywy, żywy provider; brak wskazanego dyżuru), `INI-OWN-001` (Initiatives → przegląd danych 11 kart; brak wskazanego dyżuru), `MYW-PHOTO-003` (My Work → oba poziomy paska nawigacji; brak wskazanego dyżuru), `MYW-PHOTO-005` (My Work → wspólny scroll; brak wskazanego dyżuru), `MYW-PHOTO-010` (My Work → konflikt CAS 409; brak wskazanego dyżuru) i `MYW-PHOTO-011` (My Work → Idee PL/EN, jasny/ciemny, tablet, klawiatura; brak wskazanego dyżuru). Skrypt nie dopisuje im numeru dyżuru z domysłu.

### Twierdzenia niezweryfikowane

- Nie zweryfikowano żadnego ekranu, przeglądarki, bazy ani trasy HTTP; nie były potrzebne do deterministycznego licznika dokumentów.
- Nie dowiedziono, że 25 pozycji jest kompletną listą wszystkich usterek produktu; to kompletny wynik mianownika pięciu wskazanych źródeł.
- `W_BUDOWIE=0` znaczy wyłącznie, że korpus nie dostarczył pozycji z jednoznacznym numerem dyżuru w wymaganym formacie.
- Pozycje oznaczone decyzją nie blokują wyłącznie według przyjętej reguły E1; nie jest to dowód implementacji.

### Bezpieczeństwo

Nie tworzono kontenera ani bazy, nie uruchamiano serwera, przeglądarki ani portów. Dowód środowiska i braku drenów: `/private/tmp/cx-day301-licznik-p0p1-artefakty/safety.txt` (`sha256 05443e31aa003b599ecb25ba1cc14258748bdcfca0fb994274a7e3b83fdce059`).

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Pierwsze zdanie o bazie oznacza w tym czysto jednostkowym dyżurze brak utworzonej bazy, a zatem brak możliwego źródła wierszy `smtp%`; nie przedstawiam fikcyjnego wyniku zapytania SQL.
