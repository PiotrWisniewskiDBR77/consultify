# CODEX DAY 336 — rozkład bramki G15

Stan dyżuru: `W TOKU`  
Marker pracy: `1c4b5a5635bafd38ef375227824ada9b62be186e`  
Gałąź: `codex/day336-g15-rozklad-20260904`

## R0 — zasady wiążące

Przeczytałem zasadę, że wiersz macierzy może zmienić stan wyłącznie z dowodem załączonym w tym samym commicie. Przeczytałem też zakaz zamiany `PARTIAL_PASS` na `PASS` przez zawężenie kryterium; warstwa serwerowa pozostaje częścią mianownika G15.

## Stan wejściowy

Dosłowny wynik markera i sanity:

```text
MARKER OK
1c4b5a5635bafd38ef375227824ada9b62be186e
```

Warunki zasobowe: 55 GiB wolne po utworzeniu worktree; porty `6372` i `5512` nie miały listenera; licznik kontenerów `cx-day336` wyniósł `0`.

Korekta wobec instrukcji: na markerze pracy `f65c4ff6a0` jest przodkiem odległym o `661` commitów, a `35afcb15fd` o `598`, nie odpowiednio 662 i 599. Tip gałęzi bazowej jest o 7 commitów przed markerem pracy; lista rozbieżnych plików obejmuje dokumenty instrukcji 334–342 i rejestr znalezisk, bez zmian produktu objętego pomiarem.

Warunki wspólne PRZED pierwszym commitem: liście `pl=35198`, `en=33065`; `focus-canon=0`, `list-canon=0`, `artefakt=0`.

## R1 — dekodowanie podtypów

Pole statusu ma siedem dosłownych etykiet niezielonych, ale instrukcja grupuje dwa warianty `*_CONFIRMED` w jeden z sześciu typów semantycznych. Liczby zmierzono przez odczyt wiersza `G15` wszystkich 16 plików `MODULE_ACCEPTANCE.md`, normalizację czwartej kolumny i `sort | uniq -c`.

| Typ semantyczny | Liczba wierszy | Dosłowny cytat źródłowy | Kategoria | Warunek usunięcia etykiety |
| --- | ---: | --- | --- | --- |
| `RED_LEGACY_1` | 2 | „ta sama pełna nazwa czerwieni ToolCanvas na bazie i markerze (ZASTANA)” | DŁUG ZASTANY | Naprawić wskazaną czerwień produktu w osobnym, licencjonowanym dyżurze i ponowić pełny mianownik. |
| `RED_LEGACY_2` | 1 | „te same 2 pełne nazwy czerwone na bazie i markerze (ZASTANE)” | DŁUG ZASTANY | Naprawić oba nazwane przypadki w osobnym dyżurze i ponowić mianownik. |
| `RED_LEGACY_7` | 2 | „7 czerwieni ma parę i klasę ZASTANA” | DŁUG ZASTANY | Naprawić siedem nazwanych przypadków na moduł i ponowić odpowiednie warstwy. |
| `RED_LEGACY_2_PLUS_RED_NEW_1` | 1 | „2 ZASTANE i 1 NOWA (MYW-IDEAS-010) mają parę bazową” | MIESZANY: dług oraz stan nowej czerwieni do ponownego pomiaru | Zweryfikować `MYW-IDEAS-010`; dług zastany pozostaje do osobnego zlecenia. |
| `SERVER_NOT_MEASURED` | 5 | „front 418/418 zielone, zero czerwieni; […] serwer niezmierzony” | BRAK POMIARU | Uruchomić komplet serwerowych katalogów modułu z właściwym configiem, realnym PG i `--retry=0`; zero wykonanych testów nie zamyka braku. |
| `RED_LEGACY_N_CONFIRMED` (`N=1`: 3; `N=2`: 1) | 4 | „plików bazy nie skompilowało się […] co najmniej część […] jest ZASTANA” | BRAK POMIARU klasy; zawiera częściowo potwierdzony dług | Uruchomić te same pełne nazwy na kompilowalnej bazie i HEAD oraz nadać każdej klasę `ZASTANA`, `NOWA` albo `NIEORZECZONA`. |

Wniosek R1: podział autora jest zasadniczo potwierdzony, z doprecyzowaniem, że `RED_LEGACY_2_PLUS_RED_NEW_1` jest typem mieszanym, a `*_CONFIRMED` nie oznacza samego braku pomiaru — zawiera już potwierdzone czerwienie zastane, lecz nie pozwala sklasyfikować całego zbioru.

## TWIERDZENIA NIEZWERYFIKOWANE

- Wyniki bieżących pakietów serwerowych dla 16 modułów są jeszcze niezmierzone.
- Klasy czerwieni czterech modułów na naprawionej bazie są jeszcze nieorzeczone.
- Aktualny wynik `MYW-IDEAS-010` na HEAD jest jeszcze niezmierzony.

