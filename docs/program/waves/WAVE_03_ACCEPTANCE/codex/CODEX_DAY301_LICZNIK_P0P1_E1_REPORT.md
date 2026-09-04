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
