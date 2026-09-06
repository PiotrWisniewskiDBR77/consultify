# HIGIENA-2-FILTRY — naprawa klasyfikatora + filtry CLI

Data: 2026-09-06. Baza pomiaru: wyłącznie `postgresql://postgres:noc@127.0.0.1:54400/consultify_noc`,
`NODE_ENV=development`, `CI=true`. Worktree: `/private/tmp/wt-higiena-filtry`, gałąź
`mvp/higiena-2-filtry` z bazy `codex/m03-admin-20260824` (`cec9fc2353`). Bez połączenia ze
stagingiem/demo/produkcją.

## (1) Przyczyna błędnej klasyfikacji — plik:linia

`server/scripts/higiena-wlasciciela/niepasujace.ts`, dawna linia 77 (przed naprawą):

```
await addRows(c,out,{table:'assessments',id:'id',
  where:`lower(coalesce(status,''))<>'archived' AND CASE WHEN answers_json IS NULL OR trim(answers_json)=''
  THEN true ELSE coalesce(answers_json::jsonb->'drd'->'areas',answers_json::jsonb->'siri'->'dimensions',
  answers_json::jsonb->'adma'->'dimensions','{}'::jsonb)='{}'::jsonb END`,
  ...archiveSql:`status='ARCHIVED',updated_at=now()`});
```

Reguła sprawdzała WYŁĄCZNIE trzy sztywne ścieżki jsonb wprost w SQL. Zmierzone na lokalnej bazie
(fixture `assess-drd-manufacturing-01`, 39 obszarów, kształt `{"drd":{"areas":{...}}}`): dla
DOKŁADNIE tego kształtu `coalesce(...)` poprawnie zwraca `false` (nie jest pusta) —
`server/tests/higiena-wlasciciela/niepasujace.klasyfikacja.test.ts` to potwierdza. Ryzyko, które
uderzyło w `assessments b901d4a3…` „DRD Assessment - Jul 12, 2026” (opisane przez właściciela jako
wypełnione w 100%, ale sklasyfikowane jako „zero obszarów widocznych”), to zależność od JEDNEGO
konkretnego kształtu JSON-a: każdy inny wariant zapisu (starszy import, brak owijki `drd`, inny
klucz metody) daje same `NULL`, `coalesce` spada do `'{}'::jsonb`, porównanie wychodzi `true` —
ocena zostaje uznana za pustą mimo `completion_percent=100`. Nie mamy dostępu do stagingu (zakaz
zlecenia), więc nie zmierzyliśmy bajt-po-bajcie oryginalnego `answers_json` tego rekordu — to
uczciwie NIE zmierzone. Naprawa nie zakłada jednego wariantu: liczy emptiness w JS
(`isAssessmentEmptyForScreen`, `niepasujace.ts` — nowa funkcja tuż nad `addRows`), z
`completion_percent` (kolumna niezależna od kształtu JSON-a, ta sama, której już używa
`oceny.ts`) jako sygnałem nadrzędnym, plus fallback na dowolny klucz `method_*` niepusty, obok
trzech dotychczasowych ścieżek. Mutacja PG odtwarzająca dokładnie tę klasę błędu (rekord
`completion_percent=100`, ale bez owijki `drd`) w
`server/src/services/__tests__/niepasujace.higiena.pg.test.ts` potwierdza: stara reguła SQL
kwalifikuje taki wiersz do usunięcia (RED), naprawiona `planNiepasujace` — nie.

## (2) Flagi CLI (addytywne, `server/scripts/higiena-wlasciciela/wspolne.ts`)

- `--tylko-tabele=<lista>` — ogranicza plan do wskazanych tabel.
- `--tylko-powod=<fragment>` — filtr po treści `reason` (case-insensitive).
- `--bez-tytul=<regex>` — wyklucza rekordy, których tytuł pasuje (case-insensitive).
- `--z-zaleznosciami` — pozycje „DO DECYZJI” usuwane wraz z zależnościami zamiast pomijane (`--apply`).
- `--plan-csv=<ścieżka>` — eksport planu (tabela, id, tytuł, data, powód, decyzja) do CSV, działa też w `--dry-run`.

`describeFilters()` wypisuje aktywne filtry w linii `FILTRY: ...` zaraz pod nagłówkiem `PLAN`.
Filtry są czysto client-side (post-filter na `Candidate[]`) — nie dotykają WHERE po
`organization_id`, więc izolacja organizacyjna jest niezmieniona.

## (3) Liczby fixture — dowód end-to-end (lokalna baza, org jednorazowa `11111111-2222-4333-8444-555555555001`)

Fixture: 1 pusty wątek czatu (`conversations`, bez wiadomości) + 1 artefakt „Structured sheet
draft” (`v8_output_artifacts`, `output_type='sheet'` — poza zbiorem obsługiwanym) + 1 artefakt
nazwany „FizzUp — Financial Model — AI” (ten sam powód, ale tytuł ma zostać wykluczony) + 1 ocena
DRD wypełniona w 100% (`answers_json.drd.areas`, 39 obszarów, `completion_percent='100'`).

Komenda (identyczna jak w README, sekcja „Komenda dla nadzorcy”), z `--tylko-tabele=conversations,tasks,v8_output_artifacts`
(bez `assessments` — zgodnie ze zleceniem), `--bez-tytul='FINAL|Financial Model|Portfolio|pustego excela'`, `--z-zaleznosciami`:

| krok | wynik |
|---|---|
| dry-run #1 | `ZNALEZIONE: C=0; D=3` (2× conversations — w tym 1 dopisany przez lokalny proces stanowiska, jak w poprzednim raporcie rundy 2 — + 1× „Structured sheet draft”); `PLAN-CSV` zapisany, artefakt nazwany i ocena 100% NIE widoczne w planie |
| dry-run #2 | identyczne `D=3` — brak dryfu liczników |
| apply #1 | `ZMIENIONE: 3`; po zapisie: obie konwersacje `archived=true`, „Structured sheet draft” `delivery_state='archived'`; artefakt nazwany dalej `draft`; ocena dalej `APPROVED` (nietknięta) |
| apply #2 | `ZMIENIONE: 0` (idempotentne) |
| rollback (manifest z apply #1) | `PRZYWRÓCONE: 3`; obie konwersacje `archived=false`, „Structured sheet draft” z powrotem `draft` |

Fixture i wszystkie CSV/manifesty z próby usunięte po pomiarze (org, konwersacje, artefakty,
ocena) — zero rekordów testowych pozostawionych w `consultify_noc`.

## Testy

- `server/tests/higiena-wlasciciela/niepasujace.klasyfikacja.test.ts` — 6/6 PASS (bez bazy, czysta funkcja + mutacja starej reguły → RED).
- `server/src/services/__tests__/niepasujace.higiena.pg.test.ts` — 4/4 PASS (RealPG: izolacja org, mutacja izolacji → RED, ocena 100% DRD zostaje, mutacja starej reguły na realnym wierszu → RED).
- `server/tests/higiena-wlasciciela/niepasujace.filtry.pg.test.ts` — 2/2 PASS (RealPG: `--bez-tytul` chroni pasujący rekord i nie psuje izolacji org; mutacja bez filtra → RED).
- `server/tests/higiena-wlasciciela/smieci.pg.test.ts` — bez zmian, nadal 2/2 PASS (nie dotknięty tym dyżurem).
- `cd server && npx tsc --noEmit --project tsconfig.build.json` — exit 0.
- `git diff -- server/migrations` — 0 zmian (nie edytowano migracji).

## SHA

Baza worktree: `cec9fc2353` (`codex/m03-admin-20260824`). Commity tego dyżuru: patrz `git log
mvp/higiena-2-filtry` w worktree `/private/tmp/wt-higiena-filtry` (commit per krok, bez push).

## Nie zmierzono

- Nie łączono się ze stagingiem/demo/produkcją — dokładny bajt-po-bajcie kształt `answers_json`
  rekordu `b901d4a3…` pozostaje nieznany; naprawa jest odporna na wariant, nie dopasowana do
  jednego zmierzonego przypadku.
- Nie uruchomiono realnej rundy na stagingu (233 wątki / ~100 „Structured sheet draft” / 2 BUG-i) —
  to zadanie nadzorcy po akcepcie właściciela na `--plan-csv`, komenda gotowa w README.
