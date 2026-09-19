# D-49-LIVE — NW-smieci delete-rows (DEC-673), staging na zywo

Zlecenie: KANAL.md [D] Wpis 171 P1. Zakres = DOKLADNIE 3 smieciowe wiersze
Northwind (org `468b234c-66c4-54e1-b626-5e0fb3a92f6a`, sesja wywiadu `13c932b0`):

1. `interview_questions` `233ae4ce-7069-4578-899c-f20fc0fcbb9d` — odpowiedz `asdf asdf qwerty nie wiem 123`
2. `interview_questions` `e563ed82-c572-4829-8206-158f3d2f5a96` — odpowiedz `asdf asdf qwerty nie wiem 123`
3. `execution_report_snapshots` `6099f51a-57a8-40ed-b3d3-966bb1565dd7` — duplikat snapshotu `Execution report — CTO smoke 17.09`

Metoda = delete-rows (NIE fabricate-text, NIE zero-out — DEC-673: fabrykowanie
tresci to falszywy dowod w danych pokazowych, zakaz). Runbook = ten sam co QD3
na zywo: pre-dump, JSONL wierszy PRZED, JEDNA transakcja, checksum 13 realnych
orgow PRZED/PO, 2. przebieg = 0.

## Zabezpieczenie (odwracalnosc)

- Pre-dump calosci stagingu PRZED zapisem: `~/Developer/kopie/staging-pre-nw-smieci-20260918.dump` (251 MB, TOC 13073). Przywracalne `pg_restore -t <tabela>`.
- Before-images (JSONL `row_to_json`) kazdego dotknietego wiersza:
  - `before-interview_questions.jsonl` — 2 wiersze
  - `before-execution_report_snapshots.jsonl` — 1 wiersz
  - `before-interview_evidence-setnull.jsonl` — 2 wiersze (skutek uboczny FK, nizej)

## Dowod PRZED / PO

Checksum chirurgiczny (`checksum.sql`): md5-agregat po wierszach 13 realnych orgow
(`id NOT LIKE 'ateliertoys-demo-session-%'` AND ma wiersz w `organizations`)
z WYKLUCZENIEM 5 dotknietych wierszy; `TOTAL_INCL_TOUCHED` = liczba wierszy razem
z dotknietych — jej spadek dowodzi, ze zniknelo DOKLADNIE N wierszy.

| Metryka                          | PRZED | PO  | Wniosek                       |
|----------------------------------|-------|-----|-------------------------------|
| ORG_COUNT (realne orgi)          | 13    | 13  | bez zmian                     |
| CHECKSUM (realne, excl touched)  | 3c342764ab3d900f12f14e55cca19a67 | 3c342764ab3d900f12f14e55cca19a67 | IDENTYCZNY — zero kolateralu |
| TOTAL_INCL_TOUCHED               | 199   | 196 | roznica = DOKLADNIE 3 wiersze |
| interview_questions real_excl    | 128   | 128 | bez zmian                     |
| execution_report_snapshots excl  | 2     | 2   | bez zmian                     |
| interview_evidence real_excl     | 64    | 64  | bez zmian                     |

Liczniki Northwind (`nw-counts-*.txt`):

| Licznik NW            | PRZED | PO |
|-----------------------|-------|----|
| iq_nw (wszystkie)     | 54    | 52 |
| iq_nw_junk (smieci)   | 2     | 0  |
| ers_nw (wszystkie)    | 3     | 2  |
| ers_nw_smoke (CTO smoke) | 1  | 0  |
| ie_nw (evidence)      | 19    | 19 |

## Skutek uboczny FK (ujawnienie DEC-607 — jedno zdanie, zero naprawy)

Usuniecie 2 smieciowych pytan wywolalo `interview_evidence ON DELETE SET NULL`
na 2 wierszach lustrzanych odpowiedzi (`03e3f1d9-…`, `b140e82d-…`): ich
`question_id` przeszedl z `e563ed82-…`/`233ae4ce-…` na `NULL`
(`evidence-questionid-przed.txt` → `-po.txt`). To MODYFIKACJA, nie usuniecie —
wiersze evidence zostaly (ie_nw 19→19, interview_evidence real_excl 64→64),
dlatego roznica `TOTAL_INCL_TOUCHED` zostaje DOKLADNIE 3. Poza zleceniem, nie
rozszerzam zakresu.

## Idempotencja i asercje w transakcji

- `apply-run.log`: `DELETE 2` + `DELETE 1`, `D49_PROVEN: targets gone, collateral intact (snapshots=2, answers=4)`, COMMIT.
- `pass2-idempotency.log`: 2. przebieg `DELETE 0` + `DELETE 0`, checksum nadal 196 / `3c342764…`. DELETE kotwiczone na wartosciach smieci, wiec ponowny przebieg nie znajduje celow.
- Blok `DO $do$ … $do$` w runbooku (`d49-live-delete.sql`) podnosi `EXCEPTION` (rollback), jesli po usunieciu zostal jakikolwiek cel albo zniknal wiersz kolateralny (2 legitne snapshoty NW, 4 legitne odpowiedzi sesji 13c932b0). Przeszedl = kolateral caly.

## Werdykt

Usunieto DOKLADNIE 3 wiersze (2 smieciowe pytania + 1 duplikat snapshotu CTO-smoke).
Checksum realnych orgow PRZED==PO, roznica licznikowa == 3, 2. przebieg == 0,
asercje w transakcji zielone, pre-dump zabezpieczony. Delta = evidence (zero kodu produktu).
