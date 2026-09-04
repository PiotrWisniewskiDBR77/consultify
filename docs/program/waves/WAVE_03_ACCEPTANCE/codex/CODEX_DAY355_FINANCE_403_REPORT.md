# CODEX DAY355 — FINANCE 403

Stan: **R1 zakończone; R2–R5 w toku**.

## Baza i warunki wejściowe

- Marker: `c0f690bae36a386de27f1a349fbb9674ec03c693`; wynik: `MARKER OK`.
- `rev-parse HEAD`: `c0f690bae36a386de27f1a349fbb9674ec03c693`.
- `status --short | head -3`: pusty.
- Przy starcie: 36 GiB wolnego; porty `6414` i `5554` wolne; brak kontenera `cx-day355-pg`.
- Tip `github-backup/grafika/m03-20260902` uciekł do przodu; zgodnie z DEC-2026-08-26-95 pracuję dokładnie z markera. Lista commitów i plików rozjazdu została zmierzona w logu startowym.

## R0 — zasady twarde

Przeczytałem zasadę pary dowodów: obcy bez aktywnego członkostwa ma dostać `403 ORG_MEMBERSHIP_REVOKED`, a właściciel z `ACTIVE` ma dostać `200`/`201`.

Przeczytałem zasadę jednej przyczyny: nie będę naprawiał 114 przypadków pojedynczo; jeśli pomiar pokaże wiele rodzin, zapiszę je jako wynik.

Przeczytałem zasadę porównań po pełnych nazwach: liczby są mianownikiem, a dowodem różnicy jest lista `fullName` i jej diff.

## R1 — odtworzenie czerwieni po nazwach

Własny odczyt obu artefaktów daje po 277 testów ogółem, 143 zaliczone i 114 czerwonych. Pliki `evidence/g15/day355/przed-nazwy.txt` i `po347-nazwy.txt` zawierają po 114 pełnych nazw z prefiksem pliku. `diff -u` jest pusty (`rc=0`), więc dyżur 347 nie zmienił zbioru czerwieni Finansów.

| Kubełek po treści komunikatu | Liczba |
| --- | ---: |
| `expected 403 to be X` | 59 |
| `createArtifactViaHttp failed: 403 ... ORG_MEMBERSHIP_REVOKED` | 20 |
| `TypeError` / `undefined` | 31 |
| reszta | 4 |
| **Suma** | **114** |

Kaskada 51 przypadków jest potwierdzona na poziomie komunikatów: 20 razy przygotowanie danych kończy się `createArtifactViaHttp failed: 403 ... ORG_MEMBERSHIP_REVOKED`, po czym 31 przypadków kończy się `TypeError: Cannot read properties of undefined`. To skutki wcześniejszej odmowy przygotowania danych, nie 51 niezależnych defektów produktu.

### Świadkowie różnicy — korekta tezy instrukcji

Artefakt JSON nie pokazuje 10 przechodzących przypadków `compare` ani 6 przechodzących `comments`. Pokazuje odpowiednio 7 `failed` + 10 `skipped` oraz 18 `failed` + 6 `skipped`. Wszystkie rzekomo „przechodzące” nazwy są zagnieżdżone w blokach: `the other five Compare axes — versions / entities / scenarios / valuation-methods / actual-vs-forecast` oraz `search-by-cell + changed-cells`. Na podstawie artefaktu nie wolno nazwać ich PASS; są pominięte po awarii fazy przygotowania. To obala opis autora `10/17 PASS` i `6/24 PASS`; przyczyna skipów będzie zweryfikowana w żywym przebiegu R2.

## Korekty wobec instrukcji

- `evidence/g15/day347/*.json`: własny pomiar **26**, instrukcja: 20.
- Raport 347 zawiera **2** trafienia `ORG_MEMBERSHIP_REVOKED` (wiersze 43 i 87), instrukcja: jedno.
- Liście słowników na markerze: **pl 35199, en 33066**, instrukcja: 35198 / 33065.
- Świadkowie częściowi w artefakcie: `compare` 7 failed + 10 skipped, `comments` 18 failed + 6 skipped; nie 10 i 6 PASS.
- Pozostałe bezpieczniki wejściowe: focus=0, list=0, artefakt=0, reach=0.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano jeszcze żywych przebiegów RealPG z R2, więc hipoteza członkostwa nie jest jeszcze potwierdzona.
- Nie rozstrzygnięto jeszcze 12 plików na artefakt pomiaru / realny defekt produktu.
- Nie wykonano jeszcze pary obcy `403` / właściciel `200` ani mutacji zabezpieczenia.

## CO NADAL WYMAGA OSOBNEGO ZLECENIA

Nieorzeczone do czasu pomiaru R2.

## PYTANIA DO WŁAŚCICIELA

Na etapie R1 nie mam zastrzeżeń.
