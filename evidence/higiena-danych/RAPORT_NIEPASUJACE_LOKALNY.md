# Runda 2 — dowód lokalny `niepasujace.ts`

Data: 2026-09-06. Baza: wyłącznie `postgresql://postgres:***@127.0.0.1:54400/consultify_noc`, `NODE_ENV=development`, `CI=true`. Organizacja: DBR77 `cc9db573-260f-4a19-927f-f3cc1fbaea38`.

## Pomiar i zachowanie

- `information_schema`: 1 276 tabel z `organization_id`; 105 niepustych dla DBR77; 5 185 wierszy w niepustym mianowniku.
- Mapa: A=3 857 wierszy, B=1 313, C-niepewne=15; D jest podzbiorem A i w dry-run wyniósł 6.
- Klasa C wykonywalna: 0. Jedyny brak jednoznacznego literalnego konsumenta (`initiative_budgets`) oznaczono „niepewne, zostaje”; `ORPHAN_TABLES` pozostaje puste.
- Dry-run: C=0, D=6 (puste wątki `conversations`). Liczniki przed i po: `total=15`, `archived=0` — bez zmiany.
- Pierwszy apply: plan D=6, `ZMIENIONE: 6`; `archived` 0→6. Drugi apply: plan D=0, `ZMIENIONE: 0`. Rollback: `PRZYWRÓCONE: 6`; `archived` 6→0.
- W trakcie próby lokalny proces aplikacji dopisał jeden nowy, niekwalifikujący się wątek (`total` 14→15). Nie był skutkiem skryptu: licznik archiwalny i identyfikatory planu zmieniły się dokładnie o 6, a rollback przywrócił dokładnie te 6.
- Kopia CSV pierwszego apply: `evidence/higiena-danych/conversations-2026-09-06T06-46-35-056Z.csv`; manifest był zapisany w tym samym katalogu. DELETE nie wystąpił.

## Izolacja i kompilacja

- RealPG: `server/src/services/__tests__/niepasujace.higiena.pg.test.ts` — 2/2 PASS.
- Para własna/obca: plan zawiera 1 rekord własny i 0 obcych.
- Mutacja bez filtra `organization_id`: zapytanie zobaczyło rekord obcej organizacji, czyli zabezpieczenie ma obserwowalne RED.
- `cd server && npx tsc --build tsconfig.build.json`: exit 0.
- `git diff -- server/migrations`: 0 zmian.

## Dwa BUG-i z rundy 1

Lokalna baza nie zawiera UUID-ów o prefiksach `db9c4193` i `5a8b614b`, więc lokalnie nie da się zmierzyć ich zależnych rekordów. Skrypt wyszukuje oba jednoznaczne prefiksy wyłącznie we wskazanej organizacji. Jeśli zależność jest w `decisions` (zmierzony w rundzie 1 przypadek jednej zależności), zapisuje osobne CSV, usuwa najpierw zależny wiersz, potem zadanie, a manifest rollbacku odtwarza w odwrotnej kolejności. Inny typ zależności daje `DO DECYZJI` i zero zmian.

## Nie zmierzono

- Nie łączono się ze stagingiem, demo ani produkcją.
- Nie wykonano stagingowego dry-run/apply/rollback; komenda dla nadzorcy jest w README i wymaga UUID, nie nazwy DBR77.
- Pełne UUID-y dwóch BUG-ów nie występują w repo ani lokalnej bazie; dlatego skrypt używa dostarczonych jednoznacznych prefiksów.
