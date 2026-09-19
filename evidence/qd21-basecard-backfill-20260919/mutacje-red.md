# QD21 — dowody mutacyjne migracji 20262306 (test RealPG, kopia dumpu stagingu)

Test: `server/src/routes/v8/__tests__/basecardBackfill20262306.pg.test.ts`
Baza: kontener `qoder-d-pg-9`, port 127.0.0.1:6638, kopia `consultify_qd21`
(dump stagingu 2026-09-19; odcisk PRE: artefakty 1031, linki 956, org 13,
org bez kart = 1 × `ateliertoys-demo`).
Polecenie (hasło lokalne w środowisku, nie w pliku — REGUŁA 10):

    cd server && DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
      DATABASE_URL=postgresql://postgres:<hasło-lokalne>@127.0.0.1:6638/consultify_qd21 \
      npx vitest run src/routes/v8/__tests__/basecardBackfill20262306.pg.test.ts --retry=0

Baza (pliki niezmienione): **6 passed (6)** — T0 PRE, T1 UP, T2 idempotencja,
T3 kontrakt źródła, T4 DOWN, T5 asercja DO.

| # | Mutacja (co cofnięto/uszkodzono) | Wynik | Czerwone testy |
|---|----------------------------------|-------|----------------|
| M1 | usunięty cały INSERT do `v8_artifact_origin_links` (−1582 B z UP) | 3 failed / 3 passed | T1, T2, T3 |
| M2 | usunięty cały INSERT do `v8_output_artifacts` (−2317 B z UP) | 4 failed / 2 passed | T1, T2, T3, T4 |
| M3 | `HAVING count(l.link_id) <> 3` → `<> 99` | 3 failed / 3 passed | T1, T2, T5 |
| M3b | `HAVING count(l.link_id) <> 3` → `< 0` (asercja nieosiągalna, UP przechodzi) | 1 failed / 5 passed | **T5** |
| M4 | `.down.sql` kasuje po prefiksie/rodzinie zamiast po znaczniku `created_by` | 2 failed / 4 passed | T3, T4 |

Po każdej mutacji pliki przywrócone z kopii wzorcowej (`diff` pusty) i test
ponownie **6 passed**.

## Co dokładnie łapie każda mutacja

M1 (bez INSERT linków): T1 `expected +0 to be 3` (kanoniczne linki org bez kart),
T2 (idempotencja liczy 3 artefakty ze znacznikiem), T3
`expected [ 'ON CONFLICT DO NOTHING' ] to have a length of 2 but got 1`.

M2 (bez INSERT artefaktów): T1 `expected +0 to be 3` dla artefaktów ze
znacznikiem, T2, T3 (1 zamiast 2 `ON CONFLICT DO NOTHING`), T4
`expected 3 to be +0` — down nie znajduje nic do cofnięcia, bo UP nic nie wpisał.

M3 (`<> 99`): pętla DO wchodzi dla KAŻDEJ org i rzuca
`20262306 scoped readback failed: org 3935603f-… has 3 canonical base links, expected 3`
— czyli UP w ogóle nie przechodzi (T1, T2) a T5 łapie zmianę kontraktu źródła
(`expected 'DO $$…' to contain 'HAVING count(l.link_id) <> 3'`).

M3b (`< 0`, wariant precyzyjny): UP przechodzi, asercja nigdy nie strzela, więc
sonda T5 (org z 2 kanonicznymi linkami w transakcji) nie dostaje wyjątku —
czerwony dokładnie i tylko T5. To jest dowód, że blok DO jest load-bearing,
a nie dekoracją.

M4 (down po prefiksie `template-1-link-%` / `template-1-%` zamiast po znaczniku):
T3 `expected '…DELETE FROM public…' to contain 'migration:20262306_basecard_backfill'`,
T4 `expected 998 to be 1031`. Zniszczenie zmierzone na kopii: **1031 → 998
artefaktów i 956 → 929 linków**, czyli down zjada 33 artefakty i 27 linków
należących do 20262271 (org, które ta migracja już obsłużyła). Mutacja wykonana
na jednorazowej kopii `CREATE DATABASE consultify_qd21_m4 TEMPLATE consultify_qd21`,
po pomiarze `DROP DATABASE consultify_qd21_m4` — kopia robocza została z odciskiem PRE.

## Stan bazy po każdej mutacji (sprawdzony `psql`)

`znacznik=0 | artefakty=1031 | linki=956` — po M1, M2, M3, M3b (M4 mierzona na
kopii jednorazowej, nie na `consultify_qd21`). Resztki po M2 (3 sierocie linki
`template-1-link-…` bez artefaktu, bo UP nie wstawił artefaktów) usunięte jawnym
DELETE przed kolejnym przebiegiem; po usunięciu odcisk wrócił do 1031/956.
