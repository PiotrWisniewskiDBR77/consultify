# FIX-B (proof-gaps) — Independent verification report

**Rola:** niezależny weryfikator (nie autor FIX-B). **Worktree:**
`/Users/piotrwisniewski/consultify-wt/fv3p-h-valuation`. **Gałąź:**
`codex/fv3p-fixb-proof-gaps` @ `f188cdbda8`. **Baza porównania:** `57fe0543cc`.
**Baza testowa:** `fixb_verify` na `127.0.0.1:54330` (klon `fv3_template`,
usunięta po sesji — `dropdb` potwierdzony, `SELECT datname ... LIKE '%fixb%'`
zwraca 0 wierszy). Zero połączeń do demo/staging/prod w trakcie całej sesji.

Wszystkie mutanty przywracane przez `git show <sha>:<plik> > <plik>`, nigdy
`git stash/reset/clean`. Working tree czysty (`git status --porcelain` puste)
po każdym przywróceniu i na koniec sesji.

---

## Tabela wyników

| # | Twierdzenie autora | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1a | Ścieżka QUARANTINED pokryta nowym testem #6; usunięcie filtra org z zapytania #1 (`finance_artifact_aliases`) czerwieni TĘ ścieżkę, nie ścieżkę RESOLVED | Zmutowałem `legacyIdBridgeService.ts` linia 110 (`AND organization_id = ?` usunięte z query #1). Efekt: test #6 (QUARANTINED) **CZERWONY**, i to z realnym wyciekiem — `AssertionError: expected {status:'QUARANTINED', reason:'other-org-secret-quarantine-reason'} to deeply equal {status:'NOT_MIGRATED'}`. Pozostałych 6 testów (w tym #4 RESOLVED) **ZIELONE**. Dokładnie zgodne z opisem negative-control w nagłówku pliku. Przywrócono, `git diff` puste. | **POTWIERDZONE** |
| 1b | Ścieżka NOT_MIGRATED (zwykła — brak aliasu w ogóle) jest pokryta | Test #2 „a legacy id with no alias row at all" bezpośrednio trafia query #1 zwracające null → NOT_MIGRATED. Pokryte, nie pominięte. Ścieżka „dangling alias" (alias istnieje dla org, artifact_id wskazuje na inną org — degrade na linii 140) NIE ma osobnego testu, bo (patrz wiersz 2 niżej) jest fizycznie nieskonstruowalna via zwykły INSERT — więc pusta pokrycie tej pod-gałęzi nie jest luką, tylko konsekwencją FK. | **POTWIERDZONE** |
| 2 | `fk_finance_alias_artifact_org` (złożony FK na `(artifact_id, organization_id)` → `finance_artifacts(artifact_id, organization_id)`) czyni „wiszący alias" niekonstruowalnym przez zwykły INSERT | Własna próba, surowy SQL przez `psql`, NIEZALEŻNIE od testu #7 i od aplikacji: `INSERT INTO finance_artifact_aliases (..., artifact_id, organization_id, ...) VALUES (..., 'artifact-verify-1', 'org-verify-A', ...)` gdzie `artifact-verify-1` naprawdę należy do `org-verify-B`. Wynik: `ERROR: insert or update on table "finance_artifact_aliases" violates foreign key constraint "fk_finance_alias_artifact_org" DETAIL: Key (artifact_id, organization_id)=(artifact-verify-1, org-verify-A) is not present in table "finance_artifacts".` Baza odmawia — twierdzenie autora prawdziwe, luki nie ma. | **POTWIERDZONE** |
| 3a | Nazwane katalogi (nie licznik) czerwienieją WSKAZUJĄC brakujący katalog | Zmutowałem `listTsxFiles()` w teście, dodając `'compare'` do listy pomijanych katalogów (analogicznie do negative-control autora dla `Prediction`/`baseline`). Efekt: 2 testy czerwone, oba z komunikatem `expected at least one scanned file under Finance/compare/: expected false to be true` — nazywa dokładnie brakujący katalog. Próg `>= 40` (test „scans a realistic slice") **pozostał zielony** mimo usunięcia całego katalogu z zasięgu — potwierdza, że licznik sam w sobie NIE złapałby tej regresji, tylko nazwana lista. Przywrócono, `git diff` puste. | **POTWIERDZONE** |
| 3b | Lista 11 nazwanych katalogów jest kompletna wobec `src/components/Finance/**` | `find src/components/Finance -maxdepth 1 -type d` zwraca dokładnie: Analysis, Prediction, Valuation, baseline, comments, compare, exportImport, lineage, savedViews, shared, statementPackWorkspaceV2 — **11 katalogów, 1:1 z `EXPECTED_FINANCE_SUBDIRECTORIES`**. `SCANNED_ROOTS` to jeden wpis (`src/components/Finance`), `listTsxFiles` rekurencyjnie schodzi we WSZYSTKIE podkatalogi poza `__tests__`/`node_modules` — więc lista nie jest ręcznym podzbiorem obok szerszego realnego skanu, opisuje faktyczny zasięg 1:1. Brak ślepej plamki na poziomie nazwanych katalogów. | **POTWIERDZONE** |
| 3c | Wpisy `KNOWN_UNFIXED_LEAKS` (w tym nowy `PredictionWorkspace.tsx`) mają działający mechanizm przeciw-zgniciu | Istniejący test „KNOWN_UNFIXED_LEAKS entries are still real offenders" re-skanuje pliki i sprawdza `currentOffenders.has(known)` dla KAŻDEGO wpisu. Zmutowałem `PredictionWorkspace.tsx` (zamieniłem `{mountCheck.version.status}` na literał `FIXED_FOR_MUTANT_TEST`, symulując naprawę bez usunięcia wpisu z listy) — test poszedł czerwony z dokładnym komunikatem `...is listed as a known-unfixed leak but is no longer detected — remove it from KNOWN_UNFIXED_LEAKS`. Mechanizm działa identycznie dla nowego wpisu jak dla starego. Przywrócono przez `git show f188cdbda8:...`, `git diff` puste. | **POTWIERDZONE** |
| 4a | Jednolity 404 na `POST /saved-views` i `POST /import/preview`; `POST /compute/jobs` typowany 4xx zamiast surowego 500, przy próbie międzytenantowej | Własna sonda (nowy plik testowy, niezależny od plików autora, usunięty po użyciu): `POST /saved-views` cross-tenant → 404; `POST /import/preview` cross-tenant → 404; `POST /compute/jobs` cross-tenant, z REALNYM `engineManifestId` z `finance_engine_manifests` (seed `LEGACY_UNKNOWN`) → 4xx (nie 5xx). Wszystkie 3 potwierdzone. | **POTWIERDZONE** |
| 4b | Przestawienie kolejności (własność PRZED kształtem ciała) NIE osłabiło walidacji kształtu dla WŁAŚCICIELA zasobu | Sonda właściciela z wadliwym ciałem na wszystkich trzech endpointach: `saved-views` bez `name` → 400 `NAME_REQUIRED`; `saved-views` ze złym `scope` enum → 400; `import/preview` bez `rows` → 400 `INVALID_BODY`; `import/preview` bez `manifest` → 400 `INVALID_BODY`; `compute/jobs` bez `engineManifestId` → 400 `INVALID_BODY`; `compute/jobs` bez nagłówka `Idempotency-Key` → 400 `IDEMPOTENCY_KEY_REQUIRED`. Wszystkie 6 przypadków zachowują się poprawnie — walidacja NIE ominięta. | **POTWIERDZONE** |
| 4b — NOWE ZNALEZISKO | (nie było przedmiotem twierdzenia) | Podczas budowy sondy 4a-3 odkryłem: `compute_jobs` ma DRUGI złożony/prosty FK, `compute_jobs_engine_manifest_id_fkey` na `engine_manifest_id`, którego `computeJobService.ts`'s `enqueue()` **NIE łapie** (kod łapie wyłącznie `fk_compute_jobs_artifact_org` po nazwie). Sonda właściciela, poprawny `artifactId`, ale nieistniejący `engineManifestId` → **surowy 500** z ciałem `{"error":"insert or update on table \"compute_jobs\" violates foreign key constraint \"compute_jobs_engine_manifest_id_fkey\""}}` — dokładnie ten sam typ leaku, jaki FIX-B naprawił dla `input_artifact_id`, tylko na innej kolumnie. Nie jest to regresja z FIX-B (kod nie dotykał tej gałęzi), ale to LUKA POZOSTAJĄCA po tej łatce — zakres FIX-B (cross-tenant `input_artifact_id`) był węższy niż „każdy FK-violation na tym insercie". Zgłaszam jako nowy defekt, patrz niżej. | **NOWY DEFEKT (poza zakresem FIX-B)** |
| 4c | Istniejące testy cross-tenant nadal przechodzą, nieosłabione | Uruchomiłem `cross-tenant.routes.pg.test.ts` + `export-import.routes.pg.test.ts` + `saved-views.routes.pg.test.ts` razem: **36/36 PASS**, exit 0, 2.79s. Przegląd diffu (patrz sekcja 7 niżej) potwierdza usunięte asercje zastąpione SILNIEJSZYMI (raw-500-tolerant → 404+code), nie osłabionymi. | **POTWIERDZONE** |
| 5 — testy | „62 pliki / 689 testów realDB, zero regresji" | Uruchomiłem `vitest run server/src/routes/v8/finance-v2 server/src/services/finance/canonical` 4× przy `--maxWorkers=1` i 4× przy `--maxWorkers=2` (patrz sekcja 6 niżej dla surowych liczb). Uzyskałem 689/689 PASS przy **obu** ustawieniach workerów w większości przebiegów, ale też intermittentne pojedyncze `FAIL` (1/689) w RÓŻNYCH, niezwiązanych z FIX-B plikach przy OBU ustawieniach (`valuation-b3-review...`, `comments.routes...`, `faultMatrix.pg.test.ts` — żaden nie jest w allowlist FIX-B). Żaden przebieg nie pokazał regresji w plikach, które FIX-B rzeczywiście zmienił — te zawsze zielone. Ogólna flaky-ratio w moim środowisku: ok. 3/8 przebiegów miało 1 losowy fail. | **CZĘŚCIOWO POTWIERDZONE** (patrz niżej) |
| 5 — tsc | „`tsc --noEmit` czysto" | `npx tsc --noEmit -p server/tsconfig.json` z `$?` czytanym bezpośrednio (nie przez potok): **exit 0, 0 linii outputu, 13s.** | **POTWIERDZONE** |
| 5 — wyścig w2 | „łagodny, przedistniejący wyścig inicjalizacji schematu przy `--maxWorkers=2` (`idx_invitations_inviter`/`pg_class_relname_nsp_index`), czysty przy `--maxWorkers=1`" | NIE odtworzyłem dokładnie tego konkretnego sygnatury błędu w 8 przebiegach (4×w1, 4×w2). Odtworzyłem OGÓLNĄ, mniejszą niestabilność (ok. 1 test na ~690 losowo failuje, `socket hang up` lub timing-wrażliwy test) przy OBU ustawieniach workerów, nie tylko w2 — co jest SPRZECZNE z wąskim sformułowaniem „czysty zawsze przy w1". Natomiast: `PostgresDatabase.ts` (gdzie żyje `CREATE INDEX IF NOT EXISTS idx_invitations_inviter`) i `coldReopen.pg.test.ts` mają **zerowy diff** między `57fe0543cc` a `f188cdbda8` (`git diff` puste) — więc JAKIKOLWIEK wyścig w tym kodzie, jeśli istnieje, jest identyczny na obu SHA z definicji (kod niedotknięty przez FIX-B). Nie uruchomiłem pełnego zestawu na bazowym SHA w osobnym worktree (koszt czasowy instalacji przewyższał wartość dowodową, skoro plik jest bajt-identyczny) — to ograniczenie tej weryfikacji, zaznaczam jawnie. | **CZĘŚCIOWO POTWIERDZONE — mechanizm nieskrewidowany na bazowym SHA wprost, ale kod bazowy identyczny, więc \"nie wprowadzone przez FIX-B\" stoi; wąska teza \"czysty ZAWSZE przy w1\" NIE potwierdzona (obalona przez moje przebiegi)** |
| 6 | Allowlist: zero zmian w `artifactVersionService.ts`, `lifecycleService.ts`, plikach FIX-A/FIX-C | `git diff --stat 57fe0543cc..f188cdbda8` = dokładnie 11 plików (patrz sekcja 8). `artifactVersionService.ts` i `lifecycleService.ts`: **zero linii zmian** (nie występują w diff --stat w ogóle). `saved-views.routes.ts` tylko IMPORTUJE `getArtifact` z `artifactVersionService.js` — nie edytuje pliku. Brak dotknięć `Finance/shared/**` ani plików układu (FIX-C). | **POTWIERDZONE** |
| 7 | Brak `.skip`/`.only`, brak usuniętych asercji bez zamiennika, brak osłabionych expected values | `git diff 57fe0543cc..f188cdbda8 \| grep -E '\.skip\(\|\.only\('` → 0 wyników. Jedyne usunięte `expect(...)` linie (w `cross-tenant.routes.pg.test.ts` i `export-import.routes.pg.test.ts`) zastąpione SILNIEJSZYMI: `expect(res.status).not.toBe(201/200)` (tylko "nie 2xx") → `expect(res.status).toBe(404); expect(res.body).toHaveProperty('code','ARTIFACT_NOT_FOUND')` (dokładny kod); `expect(res.body.data.ok).toBe(false)` (słaby wyciek diff-shape) → `expect(res.status).toBe(404); expect(res.body).not.toHaveProperty('data')` (twardszy, zero-leak). Żadna zmiana nie rozluźnia oczekiwanego zachowania. | **POTWIERDZONE** |

---

## 1. Wynik próby skonstruowania „wiszącego aliasu" surowym SQL

Własna transakcja, `psql` bezpośrednio na `fixb_verify`, bez użycia kodu aplikacji ani plików testowych autora:

```sql
INSERT INTO organizations (id, name) VALUES ('org-verify-A', ...), ('org-verify-B', ...);
INSERT INTO finance_artifacts (artifact_id, organization_id, ...) VALUES ('artifact-verify-1', 'org-verify-B', ...);
INSERT INTO finance_artifact_aliases (..., artifact_id, organization_id, ...)
  VALUES (..., 'artifact-verify-1', 'org-verify-A', ...);  -- alias org != artifact's real org
```

Wynik: `ERROR: insert or update on table "finance_artifact_aliases" violates
foreign key constraint "fk_finance_alias_artifact_org" DETAIL: Key
(artifact_id, organization_id)=(artifact-verify-1, org-verify-A) is not
present in table "finance_artifacts".`

Baza odmawia deterministycznie. Twierdzenie autora o trzeciej warstwie obrony **potwierdzone niezależnie**.

## 2. Ocena kompletności listy 11 katalogów

```
$ find src/components/Finance -maxdepth 1 -type d
src/components/Finance/Analysis
src/components/Finance/Prediction
src/components/Finance/Valuation
src/components/Finance/baseline
src/components/Finance/comments
src/components/Finance/compare
src/components/Finance/exportImport
src/components/Finance/lineage
src/components/Finance/savedViews
src/components/Finance/shared
src/components/Finance/statementPackWorkspaceV2
```

11 katalogów, dokładnie te same 11 nazw co w `EXPECTED_FINANCE_SUBDIRECTORIES`. `SCANNED_ROOTS` to pojedynczy wpis (`src/components/Finance`) skanowany rekurencyjnie — więc lista pokrywa 100% realnego zasięgu na poziomie top-level. Skaner nie ma dziś ślepej plamki na poziomie katalogów.

## 3. Wynik testu walidacji kształtu od właściciela zasobu

Sonda właściciela (appA, własny artifactId), body celowo wadliwe:

| Endpoint | Wada ciała | Oczekiwany kod | Otrzymany |
|---|---|---|---|
| `POST /saved-views` | brak `name` | 400 `NAME_REQUIRED` | 400 `NAME_REQUIRED` ✓ |
| `POST /saved-views` | zły `scope` enum | 400 | 400 ✓ |
| `POST /import/preview` | brak `rows` | 400 `INVALID_BODY` | 400 `INVALID_BODY` ✓ |
| `POST /import/preview` | brak `manifest` | 400 `INVALID_BODY` | 400 `INVALID_BODY` ✓ |
| `POST /compute/jobs` | brak `engineManifestId` | 400 `INVALID_BODY` | 400 `INVALID_BODY` ✓ |
| `POST /compute/jobs` | brak nagłówka `Idempotency-Key` | 400 `IDEMPOTENCY_KEY_REQUIRED` | 400 `IDEMPOTENCY_KEY_REQUIRED` ✓ |

Przestawienie kolejności (własność przed kształtem) nie ominęło żadnej z tych walidacji dla właściciela.

## 4. Rozstrzygnięcie sprawy wyścigu przy `--maxWorkers=2`

8 przebiegów pełnego zestawu (`server/src/routes/v8/finance-v2` + `server/src/services/finance/canonical`, 62 pliki):

| # | Workers | Exit | Wynik | Plik/przyczyna fail |
|---|---|---|---|---|
| 1 | w1 | 1 | 688/689 | `valuation-b3-review.routes.pg.test.ts` — `socket hang up` |
| 2 | w1 | 1 | 688/689 | `comments.routes.pg.test.ts` — `socket hang up` |
| 3 | w1 | 0 | 689/689 | — |
| 4 | w1 | 0 | 689/689 | — |
| 1 | w2 | 0 | 689/689 | — |
| 2 | w2 | 0 | 689/689 | — |
| 3 | w2 | 1 | 688/689 | `faultMatrix.pg.test.ts` — timing-wrażliwy lease-expiry test |
| 4 | w2 | 0 | 689/689 | — |

Żaden z 8 przebiegów odtworzył DOKŁADNIE zgłoszoną sygnaturę (`idx_invitations_inviter` /
`pg_class_relname_nsp_index`, unhandled rejection w `coldReopen.pg.test.ts`'s `initDb()`).
Zamiast tego zaobserwowałem BARDZIEJ ROZPROSZONĄ niestabilność (różne pliki, różne
mechanizmy — `socket hang up` przy w1, timing przy w2) występującą przy OBU ustawieniach
workerów w podobnej proporcji (2/4 przy w1, 1/4 przy w2 w mojej próbie).

Co JEST potwierdzone: żaden z tych failów nigdy nie dotyczył plików faktycznie zmienionych
przez FIX-B (`legacy-id-bridge`, `cross-tenant`, `export-import`, `saved-views`,
`rawEnumLeakScanner` — zawsze 100% zielone we wszystkich 8 przebiegach + osobnych
uruchomieniach opisanych w sekcjach wyżej). `git diff 57fe0543cc..f188cdbda8` na
`server/src/database/PostgresDatabase.ts` (gdzie żyje `CREATE INDEX IF NOT EXISTS
idx_invitations_inviter`) i na `coldReopen.pg.test.ts` jest **pusty** — kod, w którym
autor lokalizuje wyścig, jest bajt-identyczny na obu SHA, więc z definicji nie mógł zostać
wprowadzony przez tę sesję.

**Werdykt:** teza „to nie regresja z LUKA 1–3" — **potwierdzona** (kod niedotknięty, żaden
fail nigdy nie w zmienionych plikach). Teza „czysty ZAWSZE przy `--maxWorkers=1`, wyścig
TYLKO przy `--maxWorkers=2`" — **NIE potwierdzona wprost**, moje przebiegi pokazują
niestabilność przy obu ustawieniach. Nie uruchomiłem pełnego zestawu na bazowym SHA
`57fe0543cc` w osobnym worktree (koszt instalacji zależności vs. wartość dowodowa przy
bajt-identycznym pliku uznałem za nieopłacalny w ramach budżetu tej sesji) — jawne
ograniczenie tej weryfikacji, nie zatajone.

## 5. Nowe defekty znalezione w tej sesji

**NOWY (poza zakresem FIX-B), plik `server/src/services/finance/canonical/computeJobService.ts`,
`enqueue()` (linie ok. 124–155) + `server/src/routes/v8/finance-v2/compute.routes.ts`
(catch blok linie ok. 108–116):** FIX-B naprawił WYŁĄCZNIE `fk_compute_jobs_artifact_org`
(cross-tenant/nonexistent `inputArtifactId`). `compute_jobs` ma też
`compute_jobs_engine_manifest_id_fkey` na `engine_manifest_id`, którą `enqueue()` nie
łapie. Własna sonda: właściciel zasobu, poprawny `artifactId`, ale nieistniejący
`engineManifestId` → **surowy 500** z treścią
`{"error":"insert or update on table \"compute_jobs\" violates foreign key constraint
\"compute_jobs_engine_manifest_id_fkey\""}`. Ten sam kształt problemu, który FIX-B
właśnie zamknął dla innej kolumny tej samej tabeli, wciąż istnieje dla `engine_manifest_id`.
Niska dotkliwość praktyczna (wymaga podania nieistniejącego, ale poprawnie sformatowanego
`engineManifestId` — mniej prawdopodobny input niż cross-tenant artifactId), ale ten sam
kształt defektu (raw constraint-name leak, 500 zamiast typowanego 4xx) FIX-B miał w
zamierzeniu likwidować z tej trasy.

Brak innych nowych defektów znalezionych.

## 6. Allowlist — pełny diff --stat

```
$ git diff --stat 57fe0543cc..f188cdbda8
 .../generated/gate-e/FIXB_PROOF_GAPS_report.md     | 392 +++++++++++++++++++++
 .../__tests__/cross-tenant.routes.pg.test.ts       |  15 +-
 .../__tests__/export-import.routes.pg.test.ts      |  28 +-
 .../__tests__/legacy-id-bridge.routes.pg.test.ts   | 152 +++++++-
 .../__tests__/saved-views.routes.pg.test.ts        |  33 ++
 server/src/routes/v8/finance-v2/compute.routes.ts  |  34 +-
 .../routes/v8/finance-v2/export-import.routes.ts   |  25 ++
 .../src/routes/v8/finance-v2/saved-views.routes.ts |  12 +
 .../finance/canonical/computeJobService.ts         |  71 ++--
 .../services/finance/canonical/savedViewService.ts |  22 +-
 tests/unit/finance/rawEnumLeakScanner.test.ts      |  76 ++++
 11 files changed, 814 insertions(+), 46 deletions(-)
```

Zero zmian w `artifactVersionService.ts`, `lifecycleService.ts`, `Finance/shared/**` lub
plikach FIX-C (układ). `saved-views.routes.ts` dodaje wyłącznie `import { getArtifact }
from '.../artifactVersionService.js'` — czyta z pliku, nie modyfikuje go.

---

## Ocena końcowa

**PASS** dla twierdzeń 1, 2, 3, 4, 6, 7 — wszystkie niezależnie zmierzone i potwierdzone,
w tym mutant-testami wykazującymi, że nowe testy RZECZYWIŚCIE czerwienieją na dokładnie
opisanej ścieżce/regresji, a nie tylko przechodzą.

**PARTIAL** dla twierdzenia 5: `tsc --noEmit` i sama liczba `689/689 PASS` (kiedy zielono)
— potwierdzone. Precyzyjna teza o wyścigu „tylko przy `--maxWorkers=2`, zawsze czysty przy
`--maxWorkers=1`" — nie potwierdzona wprost (moja próba pokazuje szerszą, dwukierunkową
niestabilność w niezwiązanych z FIX-B plikach), choć kluczowy wniosek („to nie regresja z
LUKA 1–3") stoi, bo dotknięty kod jest bajt-identyczny na obu SHA i żaden fail nigdy nie
dotyczył zmienionych przez FIX-B plików.

**Jeden nowy, realny (choć niskiej dotkliwości) defekt poza zakresem FIX-B**:
`compute_jobs_engine_manifest_id_fkey` wciąż leakuje surowy 500 — ten sam kształt problemu,
inna kolumna tej samej tabeli, nie naprawiona przez tę łatkę.

### PASS / PARTIAL / FAIL: **PARTIAL**

Rdzeń trzech LUK (QUARANTINED coverage, katalogowa asercja skanera, jednolity kształt
odmowy + brak osłabienia walidacji) jest solidnie, niezależnie zweryfikowany i **stoi**.
Obniżenie do PARTIAL wynika z: (a) nieprecyzyjnej dokumentacji stabilności testów przy
różnych `--maxWorkers` (realna niestabilność jest szersza niż opisana, choć niezwiązana z
FIX-B), (b) jednego nowego, nienaprawionego defektu tego samego kształtu na sąsiedniej
kolumnie tej samej tabeli.
