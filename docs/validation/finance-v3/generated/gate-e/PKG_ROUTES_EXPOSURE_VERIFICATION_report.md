# Pakiet ROUTES_EXPOSURE — NIEZALEŻNA WERYFIKACJA (kontr-audyt)

**Data:** 2026-08-12
**Weryfikator:** niezależna sesja, NIE autor paczki
**Worktree:** `/Users/piotrwisniewski/consultify-wt/fv3p-m-inventory`
**Gałąź weryfikowana:** `codex/fv3p-routes-exposure` @ `ccb4589a0d56e47a820e803f9ccd4567cbf79ccb` (drzewo czyste przed startem)
**Baza porównawcza:** `aa4948b1d1`
**Baza testowa własna:** `routes_verify` na klastrze `127.0.0.1:54330` (utworzona z `fv3_template` przez `newdb.sh`, **usunięta po sesji** — `dropdb` potwierdzony). Zero połączeń do bazy autora (`routes_exp`), zero połączeń demo/staging/prod.
**Mechanizm własny (inny niż autor):** realny `http.Server` (`app.listen`) + `fetch` (nie `supertest`), oraz surowy `pg.Client` na osobnym połączeniu (nie `withPinnedPostgresTransaction`/`DbPromise` aplikacji) do niezależnego odczytu. Skrypt sondy uruchamiany tymczasowo w `server/src/routes/v8/finance-v2/__verifier_tmp__/probe.ts`, usunięty po użyciu (nigdy niezacommitowany — `git status` czysty przez cały czas trwania sesji poza dwiema chirurgicznymi, przywróconymi edycjami do kontroli negatywnej).

Założenie wejściowe: zakładam zawyżenie, dopóki sam nie zmierzę. Każdy wynik poniżej to mój własny pomiar, nie przepisanie liczby autora.

---

## Tabela główna — twierdzenie vs pomiar

| # | Twierdzenie autora | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1 | 53 endpointów przed, 88 po, 35 nowych | `grep -c "router\.(get\|post\|put\|patch\|delete)("` na KAŻDYM pliku tras, na OBU commitach (`aa4948b1d1` i `ccb4589a0d`) osobno. Baza: 3+5+4+4+4+2+2+5+21+3 = **53**. Po: te same 53 + comments(17)+compare(6)+export-import(4)+lineage-navigator(2)+saved-views(6) = **88**. Brak `.route(` chained, brak zakomentowanych linii, brak duplikatów. | **POTWIERDZONE** dokładnie |
| 2 | 150/150 testów zielono, exit 0, brak regresji w 13 przedistniejących plikach | Uruchomione samodzielnie: `cd server && RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=... npx vitest run src/routes/v8/finance-v2/__tests__/ --maxWorkers=2 --testTimeout=90000` → **18 plików, 150 testów, exit 0** (uruchomione 2×, powtarzalne). `git diff --name-only aa4948b1d1..HEAD` potwierdza, że ŻADEN z 13 przedistniejących plików testowych nie został zmieniony (0 linii diff) — regresja niemożliwa do ukrycia edycją testu, tylko realna. | **POTWIERDZONE** |
| 3 | tsc nie podany przez autora | `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit -p server/tsconfig.json` → **exit 0, zero linii output**, ~12s realnego czasu (nie OOM — OOM byłby exit 134 i inny czas). Zastrzeżenie odziedziczone (nie moje odkrycie, ale potwierdzone): `server/tsconfig.json` wyklucza `**/*.test.ts`, więc to NIE weryfikuje typów w 5 nowych plikach testowych. | **POTWIERDZONE** (exit 0, z odnotowanym ograniczeniem zakresu) |
| 4 | Dowód montażu dla WSZYSTKICH 35 nowych endpointów (404-z-code vs 404-bez-code) | **NIE dla wszystkich.** Policzone per-plik wywołania HTTP w każdym `__tests__/*.pg.test.ts` (metoda: `perl` regex na `.get/.post/.patch/.delete('...')` z template literalami). `compare.routes.ts`: **tylko `/compare/periods` (1 z 6) ma jakikolwiek test** — `/compare/versions`, `/compare/entities`, `/compare/scenarios`, `/compare/valuation-methods`, `/compare/actual-vs-forecast` mają **ZERO wywołań** w całym pliku testowym. `comments.routes.ts`: `/comments/search-by-cell` i `/review-checklist/:id/changed-cells` mają **ZERO wywołań**. Razem: **7 z 35 (20%) nowych endpointów nigdy nie zostały wykonane przez ani jeden test autora** — mimo że raport autora (§3, §16) sugeruje pełne pokrycie per plik ("6 ✅", "17 ✅"). Uzupełniłem WŁASNĄ sondą (patrz sekcja Cross-tenant poniżej) — wszystkie 7 są prawidłowo zamontowane i poprawnie izolowane tenantowo. | **CZĘŚCIOWO OBALONE** — luka w pokryciu realna (nie fikcyjna), ale NIE ukrywa defektu; domknięta przeze mnie z wynikiem czystym |
| 5 | Macierz cross-tenant — NIE ufaj testom autora | Patrz sekcja osobna niżej. 25 własnych testów (fetch+realny HTTP server+niezależny `pg.Client`), pokrywających 7 luk z p.4 plus spot-check `lineage-edges`, `saved-views` PATCH/DELETE, `export/statement-pack`. **25/25 PASS**, w tym 3 niezależne kontrole SQL (org B ma 0 wierszy niezależnie od odpowiedzi HTTP). | **POTWIERDZONE** (własnym mechanizmem) |
| 6 | Compare brał `organizationId` z ciała żądania — realny wyciek, naprawiony, złapany przez test | (a) Odtworzyłem defekt chirurgicznie w `compare.routes.ts` (`organizationId = parsedRef.ref.organizationId` zamiast `getV8Context(req)`), bez commitowania. (b) Uruchomiłem `compare.routes.pg.test.ts` → **1/7 CZERWONY**: `CROSS-TENANT (a)` dostał **`200` z REALNYMI danymi org A** zamiast `403` — potwierdzony faktyczny wyciek międzytenantowy, nie tylko zły kod błędu. (c) Przywróciłem plik dokładnie do stanu z HEAD, potwierdziłem `git diff --exit-code` = czysto, ponownie uruchomiłem → **7/7 ZIELONE**. Defekt REALNY, NAPRAWIONY w finalnym kodzie, test GO ŁAPIE. | **POTWIERDZONE** w pełni (a)(b)(c) |
| 6★ | Grep całej paczki pod kątem tego samego wzorca (tenant id z body/params/query) | `grep -nE "body\.organizationId\|req\.body\.organizationId\|params\.organizationId\|query\.organizationId"` na wszystkich 5 nowych plikach tras → **0 trafień**. Każdy z 35 nowych endpointów bierze `organizationId` WYŁĄCZNIE z `getV8Context(req)` (35/35 potwierdzone przez grep). Jedyne miejsce, gdzie klient dostarcza `organizationId` w ciele, to `artifactRef.organizationId` (compare/comments) — używane wyłącznie jako WEJŚCIE do niezależnego porównania w serwisie (`ORGANIZATION_MISMATCH`), nigdy jako źródło zapytania do bazy. | **POTWIERDZONE** — wzorzec nie powielony nigdzie indziej |
| 7 | Lineage edge: cykle, cross-tenant, source artifact+version ID, typ transformacji, autor, timestamp, append-only, odporność na archiwizację | (a) Cykl: schemat ma trigger walidujący `stage_rank`, autor testuje `BASELINE_MODEL→STATEMENT_PACK`→`409 LINEAGE_CYCLE_REJECTED`; potwierdzone w moim własnym przebiegu testów (150/150 zielono obejmuje to). (b) Cross-tenant: potwierdzone WŁASNĄ sondą (org B nie może połączyć własnych-wyglądających ale cudzych `business_version_id`; niezależny SQL: `finance_lineage_edges WHERE organization_id=orgB` → **n=0**). (c) Schemat (`20260809_finance_v3_b03_lineage_freshness.sql`, DZIEDZICZONY z WP-B03, NIEZMIENIONY przez tę paczkę) przechowuje `source_version_id` + `source_artifact_type` + `transformation_kind` + `author_id` + `created_at` (default `now()`) — **wszystkie potwierdzone kolumnami w `CREATE TABLE`**. ★ NIUANS: nie ma osobnej kolumny `source_artifact_id` — `artifact_id` jest wyprowadzalny przez FK-join do `finance_business_versions` (1 wersja = dokładnie 1 artefakt, immutable, zgodnie z zasadą ADR "krawędź wskazuje na wersję, nigdy na artefakt+status"). To decyzja WP-B03 (poza allowlistą tej paczki), nie defekt ROUTES_EXPOSURE. (d) Append-only: potwierdzone **surowym SQL, NIEZALEŻNIE od aplikacji** — `UPDATE`/`DELETE` na `finance_lineage_edges` odrzucone przez trigger `finance_lineage_edges_deny_mutation()` nawet dla dowolnego wiersza. Odporność na archiwizację: brak `ON DELETE CASCADE` na FK (domyślne `RESTRICT`), a `finance_business_versions` nigdy nie usuwa wierszy (tylko zmienia `status`) — krawędzie przeżywają archiwizację strukturalnie. | **POTWIERDZONE** (a)(b)(d) w pełni; (c) potwierdzone z niuansem — brak osobnej kolumny artifact_id, ale wyprowadzalna, nie defekt tej paczki |
| 8 | Priorytet 6: Grid/Keyboard = czysto klienckie; Kolaboracja podzielona trafnie | Grep na REALNYCH `^import` (nie na komentarzach — pierwsza próba dała fałszywy alarm na `operationStack.ts`, bo komentarz w nagłówku SAM zawiera tekst "DbPromise"/"Express" jako opis, poprawiona metoda liczy tylko faktyczne linie `import`). Wynik: `finance/grid/**` (8 plików) i `finance/keyboard/**` (6 plików) — **ZERO importów DB/Express/req/res w KTÓRYMKOLWIEK pliku**, wyłącznie typy/schematy. `autosaveScheduler.ts` — **ZERO importów w ogóle**. `operationStack.ts` — importuje tylko typy (`lifecycleService` typ, `financeValueSemantics` typ, `Operation` typ) — **ZERO DB/Express**. Kontrastowo: `autosaveService.ts`, `computePinning.ts`, `conflictResolver.ts`, `crashRecoveryService.ts` — **wszystkie 4 faktycznie importują `withPinnedPostgresTransaction`/`DbPromise`**. | **POTWIERDZONE** — ocena merytorycznie trafna, nie wygodne uzasadnienie |
| 9 | Export/Import: zawężenie do .xlsx udokumentowane, nie ciche | Nagłówek `export-import.routes.ts` linia 13-24: sekcja "SCOPE NARROWING (documented, not silent)" z pełnym uzasadnieniem. Kod: `multer({fileFilter: ...})` faktycznie odrzuca pliki, których `mimetype`/`.xlsx` rozszerzenie się nie zgadza (nie tylko deklaracja w komentarzu). | **POTWIERDZONE** |
| 10 | Autor NIE powielił wzorca snake_case/camelCase z pakietu B3 | **CZĘŚCIOWO OBALONE.** `comments.routes.ts` (17 endpointów) zwraca `FinanceCommentRow`/`FinanceCommentAssignmentRow`/`FinanceReviewChecklistItemRow` — typy z polami dosłownie `organization_id`, `artifact_id`, `is_blocking`, `resolved_by`, `resolved_at`, `created_by` itd. — BEZ mapowania na camelCase, `res.json({data: result.comment})` bezpośrednio. `saved-views.routes.ts` (6 endpointów) zwraca `FinanceSavedViewRow` — `organization_id`, `artifact_id`, `owner_user_id`, `view_state`, `share_token` — TA SAMA sytuacja. Razem **23 z 35 (66%) nowych endpointów zwracają surowe snake_case**, podczas gdy `compare.routes.ts` (6), `export-import.routes.ts` (4) i `lineage-navigator.routes.ts` (2) = 12 endpointów poprawnie mapują na DTO camelCase (potwierdzone: `data.comparisonType`, `data.summary.bothPresent`, `row.diffKind`, `edge.sourceVersionId` itd. w moich własnych odpowiedziach HTTP). Raport autora (§15) TO ujawnia, ale rozmija się sam ze sobą: pierwsze zdanie mówi "NIE powieliłem tego wzorca w żadnej z moich 5 nowych tras", drugie zdanie w tym samym akapicie opisuje właśnie ten wzorzec w `comments.routes.ts` i wspomina `saved-views` mimochodem przy `owner_user_id` — **zakres (2 pliki / 23 endpointy) jest w raporcie niedoszacowany**, nazwany "jeden świadomy wyjątek" (liczba pojedyncza) zamiast dwóch plików. | **CZĘŚCIOWO OBALONE** — problem realny i ujawniony, ale zakres zaniżony w narracji raportu |
| 11 | Wartości: MISSING/NA/NOT_APPLICABLE/PRESENT_ZERO/PRESENT_NONZERO zachowane, nigdy 0 zamiast braku | Grep na 5 nowych plikach tras pod kątem `valueStatus`/`value_status`/fallbacków `?? 0`/`\|\| 0` → **0 trafień** — routery w ogóle nie dotykają tej logiki (poprawnie, zostaje w niezmienionym `financeCompareService.ts`/`financeImportService.ts`/`financeExportService.ts`). Własna sonda: fixture z `value_status='PRESENT_NONZERO'`, `POST /compare/periods` poprawnie zwrócił `diffKind:'BOTH_PRESENT'`, `summary.missingInA/B:0` — dyscyplina zachowana end-to-end. | **POTWIERDZONE** (przez brak ingerencji + własny przebieg) |
| 12 | Allowlista: tylko `server/src/routes/v8/finance-v2/**`, zero dotknięcia frontendu/`financeV2.api.ts`/compute services | `git diff --stat aa4948b1d1..HEAD` → dokładnie 12 plików, wszystkie w `server/src/routes/v8/finance-v2/**` + 1 raport w `docs/`. Zero plików frontendowych, zero `financeV2.api.ts`/`.types.ts`, zero `{valuation,baseline,kpi,prediction}ComputeService.ts`. | **POTWIERDZONE** dokładnie |
| 13 | Brak osłabienia testów (skip/only/usunięte asercje) | `grep -nE "\.only\(\|it\.skip\(\|describe\.skip\(\|xit\(\|xdescribe\("` na 5 nowych plikach → **0 trafień** (poza zamierzoną bramką `describe.skipIf(!REAL_PG)`, identyczną we wszystkich 18 plikach, w tym 13 przedistniejących). Zero zmian w 13 przedistniejących plikach testowych (diff pusty) — nie ma czego osłabić, bo nic nie dotknięte. | **POTWIERDZONE** |

---

## Własna liczba endpointów — szczegóły metody

```
BAZA (aa4948b1d1): analysis=3 artifacts=5 baseline=4 compute=4 crosscutting=4
                    models=2 prediction=2 statements=5 valuation=21 versions=3
                    RAZEM = 53

PO (ccb4589a0d):    [+ te same 53] comments=17 compare=6 export-import=4
                    lineage-navigator=2 saved-views=6
                    RAZEM NOWE = 35, RAZEM PO = 88
```
Metoda: `grep -cE "router\.(get|post|put|patch|delete)\("` per plik, na obu commitach z `git show <sha>:<plik>`. Zweryfikowano brak `.route()` chained-style i brak zakomentowanych definicji tras (`grep` osobno, 0 trafień).

---

## Macierz cross-tenant — własna sonda (25 testów, real HTTP + fetch + surowy pg.Client)

Mechanizm: `express()` z minimalnym middleware wstrzykującym `req.v8Context` z nagłówków `x-test-org`/`x-test-user`, `app.listen(0)` na realnym porcie, `fetch()` (nie supertest). Fixture: dwie realne organizacje, artefakty tworzone przez `artifactVersionService.createArtifact` (kod produkcyjny), reszta danych przez surowe `INSERT`. Weryfikacja niezależna: osobny `new pg.Client()`.

| Endpoint | Atak | Wynik HTTP | Niezależny SQL | Wynik |
|---|---|---|---|---|
| `POST /compare/versions` | org B, artifactType+artifactId+oba bvId org A | `404 ARTIFACT_NOT_FOUND` | — | PASS |
| `POST /compare/entities` | (a) forge `artifactRef.organizationId=orgA` jako org B | `403 ORGANIZATION_MISMATCH` | — | PASS |
| `POST /compare/entities` | (b) własny orgId org B + realne id org A | `404 ARTIFACT_NOT_FOUND` | — | PASS |
| `POST /compare/scenarios` | org B, businessVersionIdBase/Other = org A | `404 ARTIFACT_NOT_FOUND` | — | PASS |
| `POST /compare/valuation-methods` | org B, businessVersionId = org A | `404 ARTIFACT_NOT_FOUND` | — | PASS |
| `POST /compare/actual-vs-forecast` | org B forge oba artifactRef jako org A | `404` (walidacja entity_code, nigdy nie dotarło do danych) | — | PASS |
| `POST /comments/search-by-cell` | org B, businessVersionId = org A, cellRef sfałszowany | `200`, `data:[]` (brak leaku) | `SELECT count(*) FROM finance_comments WHERE organization_id=orgB` → **0** | PASS |
| `GET /review-checklist/:bvId/changed-cells` | org B czyta bvId org A | `404 NOT_FOUND` | — | PASS |
| `POST /versions/lineage-edges` | org B łączy dwie realne wersje org A | `400` (walidacja przed zapisem; brak sukcesu) | `SELECT count(*) FROM finance_lineage_edges WHERE organization_id=orgB` → **0** | PASS |
| `PATCH /saved-views/:id` | org B edytuje TEAM view org A | `404 NOT_FOUND` | `SELECT name, organization_id FROM finance_saved_views WHERE id=?` → nazwa niezmieniona, `organization_id=orgA` | PASS |
| `DELETE /saved-views/:id` | org B kasuje TEAM view org A | `404 NOT_FOUND` | wiersz nadal istnieje po obu próbach | PASS |
| `GET /export/statement-pack/:artifactId/:bvId` | org B eksportuje pack org A | `404 NOT_FOUND` | — | PASS |

Razem 25 asercji (włączając dowody montażu/sukcesu jako właściciel) w tym gałęzi wyżej — **25/25 PASS**, żadnego wycieku, żadnego 500 zamiast 404.

---

## Nowe defekty / obserwacje spoza pytań w briefie

1. **Luka w pokryciu testowym autora, teraz domknięta (nie blokująca).** 7/35 (20%) nowych endpointów nigdy nie zostało wywołanych przez żaden test autora: `/compare/versions`, `/compare/entities`, `/compare/scenarios`, `/compare/valuation-methods`, `/compare/actual-vs-forecast`, `/comments/search-by-cell`, `/review-checklist/:id/changed-cells`. Raport autora (§3, §16) formatuje to jako pełne pokrycie per plik ("6 ✅", "17 ✅"), co przy pobieżnej lekturze sugeruje pokrycie per endpoint — nie jest. Po własnej weryfikacji: wszystkie 7 są poprawnie zamontowane i tenant-izolowane, więc **nie jest to defekt bezpieczeństwa**, ale jest to realna luka metodologiczna warta odnotowania dla przyszłych pakietów.
2. **Niespójność camelCase/snake_case w 2 z 5 nowych plików (23/35 endpointów).** Patrz wiersz #10 tabeli głównej. Ujawnione przez autora, ale zakres zaniżony w narracji. Rekomendacja: osobna, mała paczka mapująca `FinanceCommentRow`/`FinanceCommentAssignmentRow`/`FinanceReviewChecklistItemRow`/`FinanceSavedViewRow` na DTO camelCase — analogicznie do wzorca już zastosowanego w `compare.routes.ts`/`lineage-navigator.routes.ts`.
3. **Poza allowlistą tej paczki, tylko do wiadomości:** `commentService.assignComment()` (niezmieniony, AP-06, sprzed tej paczki) nie waliduje, że `assigneeId` faktycznie należy do organizacji wołającego — przyjmuje dowolny string. Nie jest to defekt ROUTES_EXPOSURE (serwis niezmieniony, poza allowlistą), nie stwarza wycieku danych (przypisanie nie odsłania niczyich danych), ale warto zgłosić właścicielowi `commentService.ts` do rozważenia w kolejnej fali.

---

## Werdykt końcowy: **PASS**

Rdzeń twierdzeń (liczba endpointów, wyniki testów, tsc, allowlista, brak osłabienia testów, mechanizm cross-tenant, defekt/naprawa/test w Compare, ocena Priorytetu 6, zakres Export/Import, dyscyplina wartości) — **wszystkie POTWIERDZONE niezależnym pomiarem**, żaden wyciek międzytenantowy nie przeszedł przez moją własną sondę (25/25) ani przez ponowne uruchomienie 150 testów autora. Największa ilościowa paczka fali (35 nowych endpointów) nie wniosła nowego defektu P0/P1.

Dwie rzeczy obniżające ocenę z "pełne zaufanie" do "PASS z zastrzeżeniami", żadna nie blokująca:
- Luka w pokryciu testowym (7/35 endpointów nigdy niewykonanych) — **domknięta przeze mnie, wynik czysty**, ale metodologicznie nie powinna była się zdarzyć przy twierdzeniu "6/6, 17/17 zielono".
- Niespójność camelCase/snake_case w 23/35 nowych endpointów — **ujawniona przez autora, ale zakres zaniżony** ("jeden świadomy wyjątek" opisuje w rzeczywistości 2 pliki / 23 endpointy) — do naprawy w kolejnej, małej paczce, nie blokuje promocji tej paczki.

**Rekomendacja dla orkiestratora:** paczka nadaje się do zaakceptowania jako dostarczająca bezpieczny, poprawnie izolowany tenantowo HTTP surface dla 7 martwych serwisów. Otworzyć osobny, mały follow-up ticket na normalizację DTO w `comments.routes.ts`/`saved-views.routes.ts` (nie pilne, nie bezpieczeństwo — czysto kształt kontraktu).
