# P12 — raport wykonania DEC-424

Stan: W TOKU.

## 1. Pomiar wejściowy

- Marker pracy: `8d1600d530e19888fd9ae9d2a979017ce4eacc83`.
- `github-backup/codex/m03-admin-20260824` po fetchu: `bfbada085e07af513b8ea79d8a216f042540f9ce`.
- Kontrola markera: `MARKER OK`.
- Sanity worktree: HEAD `8d1600d530e19888fd9ae9d2a979017ce4eacc83`, status czysty.
- Zdrowie stanowiska: HTTP 200, `status=ok`, `database=connected`.
- Pełny pomiar bazy i testów: `evidence/p12-statusy/testy-baza.txt`.

Definicja CHECK przed zmianą jest wariantem ścisłym, bez `UPPER(status)`:

```sql
CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PENDING_REVIEW'::text, 'REVIEW'::text,
'PROMOTED'::text, 'PLANNING'::text, 'APPROVED'::text, 'SCHEDULED'::text,
'EXECUTING'::text, 'BLOCKED'::text, 'DONE'::text, 'TRACKING'::text,
'CANCELLED'::text, 'ARCHIVED'::text])))
```

Przed migracją: 82 inicjatywy, 13 statusów, zero wartości małą literą.
`ie_aggregate_state` dla inicjatyw: 5 rekordów, wszystkie `APPROVED_BACKLOG`.

Rozjazd wejściowy względem paczki: literalna komenda §7 daje 50 trafień w 12 plikach,
nie 52 w 14. Mianownik 50/12 zostaje zachowany do pomiaru po zmianie.

## 2. Progi przed → po

Do uzupełnienia po krokach 1–12.

## 3. Migracja danych

Pierwsza próba została w całości wycofana: zastany ścisły CHECK odrzucił pierwszy
nowy kod `IN_EXECUTION`. Polecenie „zdejmij stary CHECK dopiero po backfillu” jest
technicznie niewykonalne dla CHECK-a zmierzonego w kroku 0. Migracja utrzymuje więc
ochronę bez przerwy: dodaje przejściowy CHECK na sumę słowników, zdejmuje stary,
wykonuje backfill, dodaje docelowy CHECK i zdejmuje przejściowy — wszystko w jednej
transakcji.

Skuteczny przebieg pierwszy: `UPDATE 58`. Przebieg drugi: `UPDATE 0`.

| Status zastany | Status docelowy | Wiersze |
|---|---|---:|
| DRAFT | DRAFT | 19 |
| PENDING_REVIEW, REVIEW, PROMOTED, PLANNING | PENDING_APPROVAL | 16 |
| APPROVED, SCHEDULED | APPROVED | 12 |
| EXECUTING, BLOCKED | IN_EXECUTION | 23 |
| DONE, TRACKING, ARCHIVED | CLOSED | 9 |
| CANCELLED | REJECTED | 3 |

Po migracji: 0 wartości spoza siedmiu kodów, `on_hold=true` dla 6 wierszy,
`archived=true` dla 1 wiersza. Brak `PROPOSED` w danych jest wynikiem pomiaru,
nie brakującym mapowaniem.

`20262103_p12_initiative_status_slownik.sql` jest ostatni w fazie datowanej.
Nie jest ostatni globalnie: runner ma późniejsze fazy late/unordered. Instrukcja
pomija te fazy; nowe pytanie zapisano w `99_DECYZJE_WLASCICIELA.md`.

## 4. Procedura dla stagingu

Do uzupełnienia po lokalnym dowodzie migracji. Codex nie łączy się ze stagingiem.

## 5. Mutacje RED → GREEN

Do uzupełnienia po sześciu wymaganych próbach.

## 6. Zrzuty

Do uzupełnienia po dowodzie z realnych tras.

## 7. Commity, znaleziska i STOP-y

Do uzupełnienia w toku pracy.

## 8. Czego nie zmierzono

Do uzupełnienia na końcu.
