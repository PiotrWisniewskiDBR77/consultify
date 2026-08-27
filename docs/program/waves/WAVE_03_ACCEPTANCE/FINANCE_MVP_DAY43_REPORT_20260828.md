# Finance MVP — Day 43 — raport dyżuru 2026-08-28

> **Addendum FIX-1..FIX-6 (2026-08-28, gałąź `day43-fixes-20260828`, worktree `/private/tmp/fix-day43`, z `codex/finance-day43-20260828` @ `63e454b304`).**
> Odbiór adwersaryjny dał werdykt ZIELONY Z FIX-AMI (jeden blokujący). Naprawiono: FIX-1 dowody testowe A.1/A.3 były trwale martwe (strażnik przypięty do usuniętego kontenera `127.0.0.1:5810/cx_day43` — 30 przypadków SKIP raportowały się jako sukces; zamienione na `assertRealPostgresTestEnvironment`, zweryfikowane 34/34 PASS na własnym kontenerze `127.0.0.1:5822/cx_fix43`). FIX-2 dopisano tabelę czterech hipotez §A.1, status A.1 obniżony na `CZĘŚCIOWO`. FIX-3 dopisano werdykt A.3 (teza jednoznacznego toru per karta OBALONA). FIX-4 uzupełniono inwentarz A.2 do 7 kolumn + diff + sekcja „jak otworzyć" + opisany (niezastosowany) patch. FIX-5 skorygowano liczby baseline. FIX-6 uzupełniono deklarację Z24. Substancja dyżuru (0 regresji, 0 naruszeń granic) nie zmieniła się — naprawiono wyłącznie sposób, w jaki jest udowodniona. Żadna z pozycji B.1–R.1 nie została otwarta; `MODULE_ACCEPTANCE.md` nietknięty.

## Werdykt

`CZĘŚCIOWO`. Ukończono wejściową bramkę A.1 oraz dostarczono ograniczone dowody A.2 i A.3. Nie ma podstaw do twierdzenia, że cały Finance MVP Day 43 jest zaakceptowany: pełny baseline serwera na realnym PostgreSQL jest czerwony, a pozycje B.1–R.1 nie zostały wykonane. Nie kontaktowano Railway ani środowisk współdzielonych.

## Tożsamość i bezpieczniki Bloku 0

- checkout roboczy: `/private/tmp/consultify-finance-day43`
- gałąź: `codex/finance-day43-20260828`
- marker bazowy: `b151977e4b`
- instrukcja: przeczytana w całości, 2598 linii
- źródłowy checkout `/Users/piotrwisniewski/Developer/Consultify`: zastany z obcym WIP, pozostawiony bez zmian plikowych
- PostgreSQL: własny kontener `cx-day43-pg`, host `127.0.0.1`, port `5810`, baza `cx_day43`
- migracje: 855 zastosowanych bez błędu; drugi przebieg: `Applying migrations: 0`
- `MOCK_DB=false`, `RUN_DB_TESTS=1`, jawny `DATABASE_URL`; testy uruchamiane z `--retry=0`
- marker należy do `codex/m03-admin-20260824`; różnica od końcówki tej gałęzi obejmowała dokumenty/DRD, skrypt seedujący i Assessment, bez Finance
- fetch wszystkich remotes był częściowy: `github-backup` i `origin` pobrane; remote `icloud-source` wskazuje na nieistniejący lokalny katalog `/private/tmp/consultify-staging-deploy-e6ca`
- Z29: nie wykonywano mutacji współdzielonych środowisk ani obcej bazy; własna baza została odtworzona po zanieczyszczającym baseline

Korekta proceduralna: przed dojściem podczas lektury do §Z5 w checkout źródłowym wykonano wyłącznie odczyty (`status`, remote/log) oraz `fetch`; nie zmieniono tam plików. Dalsza praca odbywała się wyłącznie w wymaganym worktree.

## Day 30 — trzy ostatnie commity

Przeczytano pełne diffy:

| SHA | Treść | Sposób użycia |
|---|---|---|
| `4c76310011` | raport Day 30 | kontekst i jawne ograniczenia dowodu |
| `a95411afcb` | STOP C.1 na schemacie ról | ponowna kontrola `organization_members_role_check` |
| `0775dfc293` | kontrakt capabilities pięciu artefaktów | wzorzec danych i wskaźnika bieżącej wersji; nie został cherry-pickowany, bo jego test montuje router zastępczo, a A.1 wymaga prawdziwego `Gateway` |

`github-backup/codex/finance-day30-20260827` obecnie wskazuje na `0775dfc293`. Commit ten nie jest przodkiem markera Day 43 (`NIE SCALONY`).

## Baseline

**Korekta FIX-5:** deklaracja „72 failed / 78 passed" poniżej pochodziła z zanieczyszczonego/nieodtwarzalnego przebiegu i jest NIEODTWARZALNA — nie opisuje różnicy między markerem a HEAD. Odbiór dyżuru zmierzył ponownie, metodą: czysty kontener od zera (855 migracji), `--retry=0`, ten sam `DATABASE_URL` dla obu stanów (marker i HEAD wypożyczone kolejno na tej samej bazie), porównanie NAZW plików testowych między dwoma przebiegami (nie tylko liczników).

| Stan | Pliki | Wynik plików | Testy | Metoda |
|---|---:|---:|---|---|
| marker `b151977e4b` | 151 | 98 PASS / **53 FAIL** | 1737 passed / 134 failed / 121 skipped | czysty kontener, 855 migracji od zera, `--retry=0`, `DATABASE_URL` jawny |
| HEAD `63e454b304` | 151 | 96 PASS / **55 FAIL** | 1736 passed / 135 failed / 121 skipped | jak wyżej, ten sam kontener/URL |
| **WPROWADZONE przez Day 43** | — | **0** | — | patrz niżej |

Różnica między stanami to dokładnie dwa pliki: `server/src/services/finance/canonical/__tests__/idempotentComputeRetry.pg.test.ts` i `server/src/services/finance/canonical/__tests__/valuationLegacySuccessor.pg.test.ts`. Ustalono, że to **flak kolizji DDL w równoległym przebiegu**, nie regresja Day 43:

- uruchomione W IZOLACJI (nie w równoległym przebiegu 151 plików) dają **23/23 PASS na obu stanach** (marker i HEAD) — zweryfikowano ponownie w tym FIX-ie: `RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5822/cx_fix43 npx vitest run server/src/services/finance/canonical/__tests__/valuationLegacySuccessor.pg.test.ts server/src/services/finance/canonical/__tests__/idempotentComputeRetry.pg.test.ts --no-file-parallelism --retry=0` → `2 passed (2 files), 23 passed (23 tests)` na HEAD `63e454b304`;
- `git diff b151977e4b 63e454b304 -- server/src src` zweryfikowano ponownie w tym FIX-ie — zawiera WYŁĄCZNIE linie komentarza (`server/src/middleware/betaGate.middleware.ts` i `src/utils/betaAccess.ts`, oba dokumentacyjne, zero zmian logiki), więc zmiana behawioralna w kodzie produkcyjnym jest fizycznie niemożliwa — te dwa pliki nie mogły zacząć/przestać padać z powodu Day 43.

**Nie zweryfikowano ponownie w tym FIX-ie** (koszt: dwa pełne przebiegi 151 plików na dwóch stanach): dokładnych liczb 98/53 i 96/55 dla całego zestawu 151 plików — przyjęto z pomiaru odbiorcy dyżuru. Jeśli przy ponownym pomiarze wyjdzie inaczej, zgłosić to, nie przepisywać bez sprawdzenia.

| Zakres | Wynik | Interpretacja |
|---|---:|---|
| UI/root OFF: Economics, panele, Finance, middleware V8 | 82 pliki, 714 testów — PASS | dowód ograniczony do wskazanego zestawu |
| server OFF: Finance V8, usługi Finance, allowlista Gateway (151 plików pełnego zestawu) | patrz tabela korekty FIX-5 wyżej (98/53 marker, 96/55 HEAD) | baseline czerwony na obu stanach; 0 wprowadzone przez Day 43; widoczne m.in. kolizje równoległego DDL, timeouty, braki mocków członkostwa i wymagania JWT; nie jest to PASS |
| `roiReadSurfaceInventory.test.ts` | brak pliku na markerze | `EVIDENCE_MISSING`, nie zastąpiono innym testem |
| pełny baseline ON | niewykonany | `NOT_PROVEN` |

Po czerwonym przebiegu własny kontener i baza zostały usunięte, utworzone ponownie, a 855 migracji uruchomiono od zera. Czerwonego baseline nie zaliczono jako regresji Day 43 ani jako akceptacji.

## Pomiar testów (Z24) — braki uzupełnione (FIX-6)

**ZASIĘG: CZĘŚCIOWY.** Ten raport NIE twierdzi pełnego zasięgu §0.4a (cały `server/src` + `src`) — zasięg jest jawnie zawężony do plików dotkniętych/dowodzących Day 43: middleware V8, trasy Finance (kanoniczne i legacy), `useFinanceData`, `betaAccess`/`betaGate`, plus pełny 151-plikowy baseline serwera OFF jako punkt odniesienia (FIX-5). Zawężenie jest jawne, nie ukryte — zgodnie z wymogiem `Z24`, że zawężony wybór musi być zadeklarowany, nie podany milcząco jako pełny.

**Config użyty:** root `vitest.config.ts` (nie `server/vitest.config.ts`). Jego `include` (`vitest.config.ts:221` dalej, w tym linie `278-290` dla `server/src/**/__tests__/**`) obejmuje zarówno frontend (`src/**/__tests__`, `tests/**`), jak i backend (`server/src/services/**/__tests__:278-280`, `server/src/routes/**/__tests__:282-283`, `server/src/**/__tests__:289-290` — katalog kolokowanych testów config/middleware/controllers/database), więc jeden config wystarcza do obu warstw; osobny `server/vitest.config.ts` nie był potrzebny do żadnego pomiaru w tym raporcie.

**Rozbicie per plik — zakres zmierzony bezpośrednio w tym FIX-ie (FIX-1, kontener 5822/`cx_fix43`, 855 migracji od zera):**

| Plik | Testy | Wynik |
|---|---:|---|
| `tests/integration/finance/day43.gateway-reachability.realpg.test.ts` | 20 | 20 PASS |
| `tests/integration/finance/day43.legacy-track.realpg.test.ts` | 10 | 10 PASS |
| `tests/integration/finance/day43.finance-beta-gate.test.ts` | 4 | 4 PASS |
| **Razem** | **34** | **34 PASS / 0 FAIL** |

**Rozbicie per plik — baseline serwera OFF (151 plików, FIX-5):** agregat 98 PASS-plików / 53 FAIL-plików (marker) i 96/55 (HEAD) jest zmierzony i podany w sekcji Baseline wyżej z metodą pomiaru; itemizacja nazwa-pliku-po-nazwie nie została zachowana przez wykonawcę dyżuru w tym raporcie — to jest znana luka tego raportu, a nie twierdzenie o jej domknięciu. Dwa pliki różnicy między stanami (`idempotentComputeRetry.pg.test.ts`, `valuationLegacySuccessor.pg.test.ts`) są itemizowane osobno w sekcji Baseline (23/23 PASS w izolacji, zweryfikowane ponownie w tym FIX-ie).

NIE przepisałem liczb dnia 23, dnia 30 ani z MODULE_ACCEPTANCE.md — zmierzyłem sam.

## Wyniki pozycji

Instrukcja nazywa tabelę „21 pozycji”, ale enumeruje 22 wiersze (A.1–R.2); poniżej zachowano wszystkie wymienione pozycje.

| Pozycja | Status | Dowód / brak |
|---|---|---|
| A.1 | `CZĘŚCIOWO` | realny `ApiGateway.initializeRoutes`, realny PG: 20/20; OFF, brak tokenu, istniejący i brakujący zasób dla pięciu kart; obniżone z `ZROBIONE_WG_DoD` — instrukcja §A.1 wymagała tabeli czterech hipotez a/b/c/d z werdyktem, której pierwotny raport nie zawierał (patrz niżej) |
| A.2 | `CZĘŚCIOWO` | 4/4 przełącznik open/closed × admin/member; mapa bramek i komentarz DEC-177; brak autoryzacji na wpięcie nowej bramki serwerowej |
| A.3 | `CZĘŚCIOWO` | realny Gateway i PG: 10/10 dla pięciu ścieżek legacy (anonim odrzucony, członek 200 przy V8 OFF); pełna macierz wariantów UI nie została zamknięta |
| B.1 | `NIE_ZACZĘTE` | schemat odczytany; CHECK dopuszcza `OWNER, ADMIN, MEMBER, CONSULTANT, USER, GUEST`, ale nie wykonano pełnego DoD |
| B.2 | `NIE_ZACZĘTE` | — |
| B.3 | `NIE_ZACZĘTE` | — |
| C.1 | `NIE_ZACZĘTE` | — |
| C.2 | `NIE_ZACZĘTE` | — |
| D.1 | `NIE_ZACZĘTE` | — |
| E.1 | `NIE_ZACZĘTE` | — |
| E.2 | `NIE_ZACZĘTE` | — |
| G.1 | `NIE_ZACZĘTE` | — |
| G.2 | `NIE_ZACZĘTE` | — |
| G.3 | `NIE_ZACZĘTE` | — |
| G.4 | `NIE_ZACZĘTE` | — |
| H.1 | `NIE_ZACZĘTE` | — |
| I.1 | `NIE_ZACZĘTE` | mechaniczny odczyt znalazł 17 plików `*Panel*.tsx`; nie wykonano wymaganej pełnej tabeli paneli |
| J.1 | `NIE_ZACZĘTE` | — |
| K.1 | `NIE_ZACZĘTE` | — |
| L.1 | `NIE_ZACZĘTE` | — |
| R.1 | `NIE_ZACZĘTE` | brak podstaw do aktualizacji `MODULE_ACCEPTANCE.md` |
| R.2 | `ZROBIONE_WG_DoD` | ten jeden raport; statusy, dowody, ograniczenia i niezweryfikowane twierdzenia są jawne |

## A.1 — prawdziwy Gateway

Plik: `tests/integration/finance/day43.gateway-reachability.realpg.test.ts`.

Wynik: 1 plik, 20 testów PASS. Dla każdej z pięciu kart sprawdzono:

1. `ENABLE_V8_GLOBAL=false` → 404 `V8_DISABLED`;
2. V8 ON bez tokenu → odmowa uwierzytelnienia;
3. V8 ON, realny członek organizacji, istniejący artefakt → 200;
4. V8 ON, realny członek, brakujący artefakt → uczciwe 404 inne niż `V8_DISABLED`.

Test montuje rzeczywisty singleton `ApiGateway`, a nie replikę `express().use(...)`.

### Tabela czterech hipotez (instrukcja §A.1) — uzupełnienie FIX-2

Pierwotny raport nie zawierał tej tabeli mimo wymogu instrukcji; status A.1 obniżony z `ZROBIONE_WG_DoD` na `CZĘŚCIOWO` z tego powodu.

| # | Hipoteza | Werdykt | Dowód |
|---|---|---|---|
| a | Gate globalny V8 OFF → nieznany zasób zwraca `404 V8_DISABLED` niezależnie od tego, czy żądanie jest uwierzytelnione | `POTWIERDZONA` | `day43.gateway-reachability.realpg.test.ts:96-104`, `it.each(unknownReads)('%s: gate OFF returns V8_DISABLED', ...)` — 5/5 PASS |
| b | Gate ON + realny członek organizacji + istniejący artefakt → `200` dowodzi, że kanoniczna ścieżka V8 jest w pełni funkcjonalna dla tej organizacji | `OBALONA` | `200` w teście (`day43.gateway-reachability.realpg.test.ts:113-119`, `it.each([0,1,2,3,4])('gate ON reaches persisted card %s', ...)`) zawdzięcza istnienie **fallbackowi nieprodukcyjnemu**: `server/src/middleware/v8FeatureGate.middleware.ts:7` (`allowImplicitOrgRowsFallback = () => process.env.NODE_ENV !== 'production'`) i `:40-47` — gdy organizacja nie ma jawnych wierszy flag V8, `v8OrgGate` przepuszcza żądanie zamiast blokować, logując `[v8:featureGate] Allowing org without explicit V8 flag rows`. Test tworzy organizację ad-hoc bez wierszy flag, więc `200` dowodzi działania fallbacku, nie działania V8 dla organizacji z jawną konfiguracją. **Na produkcji (`NODE_ENV=production`) ta sama karta dla tej samej organizacji dostałaby `404 V8_ORG_DISABLED`.** To istotne ograniczenie dowodu A.1 |
| c | Gate ON, brak tokenu → serwer dociera do warstwy uwierzytelniania (gate globalny sam w sobie nie blokuje przed `verifyToken`) | `POTWIERDZONA` | `day43.gateway-reachability.realpg.test.ts:106-111`, `it.each(unknownReads)('%s: gate ON reaches authentication', ...)` — 5/5 PASS, `[401,403]`, `code !== 'V8_DISABLED'` |
| d | Gate ON + realny członek + brakujący artefakt → uczciwe `404` z handlera (nie blokada gate) | `POTWIERDZONA` | `day43.gateway-reachability.realpg.test.ts:121-129`, `it.each(unknownReads)('%s: gate ON returns an honest handler 404 for a missing row', ...)` — 5/5 PASS, `code !== 'V8_DISABLED'` |

## A.2 — mapa bramek i odwracalność

### Inwentarz (uzupełnienie FIX-4 — 7 kolumn zamiast 4)

| Powierzchnia | Bramka | Plik:linia | Stan na markerze | Czy działa DZIŚ | Dowód działania DZIŚ | Efekt |
|---|---|---|---|---|---|---|
| `/finance` (klient, SSOT) | `BETA_MENU_STATUS.MODULE_ECONOMICS` | `src/utils/betaAccess.ts:50` | `closed` | TAK — egzekwowane | `hasModuleAccess()` (`betaAccess.ts:96,117`) zwraca `false` dla nie-admina, `AccessBlockedModal`/`BETA_LOCKED` w UI | UI zamknięte dla nie-admina |
| trasy Finance w `AppRoutes` | `ProductionModuleGate` | `src/routes/AppRoutes.tsx:870,1538,1565` | zależny od public-production | TAK, warunkowo | komponent renderuje strażnika wokół tras Finance | dodatkowe ukrycie UI na produkcji |
| Sidebar | wpis `MODULE_ECONOMICS` | `betaAccess.ts` + `menuConfig` | sterowany beta access | TAK | wpis filtrowany przez `filterMenuForRole` (`betaAccess.ts:117`) | pozycja może zniknąć z menu |
| My Work link | `betaModuleId=MODULE_ECONOMICS` | (referencja z markera raportu, nie zweryfikowana ponownie w FIX-4) | closed | NIEZWERYFIKOWANE w FIX-4 | — | link kontrolowany modułem |
| `BETA_ADMINS_EXEMPT` | wyjątek administratora | `betaAccess.ts:32,117` | `true` | TAK | `if (BETA_ADMINS_EXEMPT && isAdminOwnerOrSuperAdminRole(role)) return menu;` | admin/owner/superadmin zachowują dostęp; zwykły `MEMBER` nie |
| `server/Gateway` V8 (kanoniczny `/api/v8/finance-v2/*`) | `v8FeatureGate` + `v8OrgGate` | `server/src/middleware/v8FeatureGate.middleware.ts:14-20,27-56` | zależny od `ENABLE_V8_GLOBAL` | TAK | `404 V8_DISABLED` gdy OFF (A.1 hipoteza a, 5/5 PASS) | kanoniczne API może zwrócić `V8_DISABLED` niezależnie od `MODULE_ECONOMICS` |
| `financeStatementMountedSurface` / mounty legacy | brak — `betaGate` jest pass-through | `server/src/Gateway.ts:1202,1398-1406` | aktywny, NIEEGZEKWOWANY | **NIE** — `betaGate` zawsze woła `next()` | `server/src/middleware/betaGate.middleware.ts:18-19`; `/api/economics` (linia 1202), `/api/finance-statements` (linie 1398-1404, bez `betaGate` w ogóle), `/api/financial-modeling` (linia 1406, z `betaGate`, ale ten jest no-op) | `MODULE_ECONOMICS: 'closed'` NIE jest egzekwowany po stronie serwera — dowód A.3 (10/10 PASS, `200` dla zwykłego członka na wszystkich pięciu trasach legacy) |
| server `betaGate` (middleware) | middleware zgodności | `server/src/middleware/betaGate.middleware.ts:18-19` | pass-through | **NIE** (świadomie, udokumentowane w komentarzu) | `export function betaGate(...) { next(); }` — brak logiki | nie egzekwuje `MODULE_ECONOMICS` na żadnej trasie, na której jest zamontowany |
| owner review | `canonicalOnly` = `isFinanceOwnerReviewModeEnabled()` | `src/components/Economics/hooks/useFinanceData.ts:111` | zależny od flagi | TAK, warunkowo | gdy `true`, `useFinanceData.ts:134,181,219,257,286` rzuca zamiast fallbackować na legacy | blokuje fallback do legacy, wymusza czysty błąd V8 |
| owner sample | `ownerSampleData` = `isFinanceOwnerSampleDataEnabled()` | `src/components/Economics/hooks/useFinanceData.ts:112` | zależny od flagi | TAK, warunkowo | `useFinanceData.ts:123,160,201,239` — `if (ownerSampleData) { ...; return; }` PRZED jakimkolwiek wywołaniem HTTP | może zasilać UI danymi sample bez sieci |

### Diff komentarzowy DEC-177 (wklejony, commit `1fa5743d85`)

```diff
--- a/src/utils/betaAccess.ts
+++ b/src/utils/betaAccess.ts
@@ -38,7 +38,10 @@ export const BETA_MENU_STATUS: Record<string, BetaStatus> = {
   MODULE_BENEFITS: 'open', // Results (M15 — GA per D-A)
   MODULE_CONCLUSIONS: 'closed', // HIDDEN 2026-07-04 (owner decision — added without consent); nav entry removed in menuConfig too
-  // Finance — ZAMKNIĘTE przed klientami (decyzja Piotra, MVP 2026-07-28):
+  // DEC-2026-08-28-177 supersedes the July decision: Finance enters the MVP.
+  // Keep it closed until the owner accepts the visual polish screenshots
+  // (CLAUDE.md rule 7); the supervisor then performs the reversible flip here.
+  // Historical rationale for the still-current closed state:
   // „MVP finansów nie ładowałbym, to jest ogromny projekt… zostawiłbym w wersji
   // beta i klientom bym tego później nie pokazywał, zakluczyłbym to. Nie jesteśmy
   // w stanie do poniedziałku rozwinąć tego modułu."
```

To jedyna zmiana behawioralna A.2b — komentarz, zero logiki. `MODULE_ECONOMICS` pozostał `closed` (`src/utils/betaAccess.ts:50`, niezmienione w tym FIX-ie).

### JAK OTWORZYĆ FINANSE DZIŚ (stan na markerze, bez żadnej zmiany kodu)

1. Zaloguj się jako użytkownik z rolą `ADMIN`, `OWNER` lub `SUPERADMIN`. `BETA_ADMINS_EXEMPT=true` (`betaAccess.ts:32`) daje tym rolom dostęp do klienckiego UI Finance mimo `MODULE_ECONOMICS: 'closed'` — zwykły `MEMBER` zobaczy `AccessBlockedModal`/`BETA_LOCKED`.
2. Wejdź w sidebarze w pozycję Finance/Economics (widoczna dla powyższych ról — `filterMenuForRole`, `betaAccess.ts:117`).
3. Pięć kart (Statements/Models/Analysis/Valuation/Budgets) odpowie danymi z toru **legacy** (`/api/finance-statements/packs`, `/api/financial-modeling/models`, `/api/economics/financial-analyses`, `/api/economics/valuations`, `/api/economics/budgets`) — te trasy serwerowe NIE są zamknięte przez `MODULE_ECONOMICS` (dowód: inwentarz wyżej + A.3 10/10 PASS `200` nawet dla zwykłego `MEMBER`, bo `betaGate` jest pass-through).
4. Żeby zobaczyć kanoniczny tor V8 zamiast legacy, ustaw `ENABLE_V8_GLOBAL=true` w środowisku serwera. Samo to NIE wystarczy dla każdej organizacji na produkcji: bez jawnych wierszy flag V8 dla danej organizacji i przy `NODE_ENV=production`, `v8OrgGate` zwróci `404 V8_ORG_DISABLED` (patrz hipoteza b w A.1) — na non-production `NODE_ENV` fallback przepuszcza.
5. Żeby otworzyć Finance dla zwykłych (nie-admin) użytkowników na produkcji, jedyny wymagany klient-side switch to `BETA_MENU_STATUS.MODULE_ECONOMICS: 'closed' → 'open'` w `src/utils/betaAccess.ts:50`. **Tego przełącznika NIE wykonano w tym FIX-ie** (CLAUDE.md reguła 7: Piotr nie jest pierwszym testerem wizualnym — flaga zostaje OFF do akceptu na czystych zrzutach).
6. Ten sam przełącznik NIE domyka serwerowej strony: nawet po `'open'` po stronie klienta, serwerowe trasy legacy (`/api/finance-statements/*`, `/api/financial-modeling/*`, `/api/economics/*`) pozostają otwarte dla każdego zalogowanego użytkownika już DZIŚ (krok 3) — `MODULE_ECONOMICS` nie jest jeszcze jedną bramką end-to-end, tylko bramką UI.

### Patch montażu `createModuleGate('MODULE_ECONOMICS')` (OPISANY, NIE ZASTOSOWANY)

Minimalna rekomendowana poprawka poza licencją tej pozycji: zamontować jawny, domyślnie zamknięty `createModuleGate('MODULE_ECONOMICS')` (już istnieje w `server/src/middleware/betaGate.middleware.ts:28-46`, wzorzec identyczny do `closedBetaModuleGate`/`MODULE_MEETING` na liniach 56-57) przed serwerowymi powierzchniami Finance, z admin/member objętymi tą samą polityką. Przykład jednolinijkowego patcha dla `/api/economics` (`server/src/Gateway.ts:1202`):

```diff
- app.use('/api/economics', betaGate, economicsRoutes);
+ app.use('/api/economics', gatewayVerifyToken, createModuleGate('MODULE_ECONOMICS'), economicsRoutes);
```

Analogiczny insert byłby potrzebny na mountach `/api/finance-statements` (linia 1398) i `/api/financial-modeling` (linia 1406) dla pełnego domknięcia. **Ten patch NIE został zastosowany** — zgodnie z zakresem tego FIX-u wartość `MODULE_ECONOMICS: 'closed'` i `BETA_ADMINS_EXEMPT` pozostają nietknięte, żeby odwracalność została odwracalnością (flaga OFF do akceptu Piotra na czystych zrzutach, CLAUDE.md reguła 7).

`MODULE_ECONOMICS` pozostał `closed`; dodano jedynie komentarz kontraktowy DEC-177 i test 4/4 dla wstrzykniętego resolvera. Nie ogłoszono rzeczywistego single-switch, bo backendowa bramka modułowa nie jest podłączona.

## A.3 — skąd pięć kart bierze dane

| Karta | Ścieżka legacy potwierdzona przez HTTP | V8 OFF |
|---|---|---|
| Packs | `/api/finance-statements/packs` | 200 dla członka |
| Models | `/api/financial-modeling/models` | 200 dla członka |
| Analyses | `/api/economics/financial-analyses` | 200 dla członka |
| Valuations | `/api/economics/valuations` | 200 dla członka |
| Budgets | `/api/economics/budgets` | 200 dla członka |

Kod UI zawiera `shouldFallbackToLegacyFinance`; `useFinanceData` posiada osobne tryby `canonicalOnly` i `ownerSampleData`. To potwierdza współistnienie torów, ale bez pełnej macierzy UI/runtime nie dowodzi, który tor zasila każdą konfigurację użytkownika.

### Werdykt A.3 (uzupełnienie FIX-3) — teza zlecenia OBALONA

Materiał dowodowy był już zebrany w poprzednim raporcie (tabela wyżej, dowód HTTP 10/10), ale nie wyciągnięto z niego wniosku. Wniosek, z dokładnymi cytatami:

- `src/services/api/v8/finance.ts:53-56`:
  ```ts
  export const shouldFallbackToLegacyFinance = (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  };
  ```
  **`404` JEST na liście kodów, które wywołują fallback.**

- Każde z pięciu wywołań w `src/components/Economics/hooks/useFinanceData.ts` sprawdza dokładnie ten predykat przed fallbackiem na legacy: Packs `:134-136`, Models `:181-184`, Analyses `:219`, Valuations `:257`, Budgets `:286` — wzorzec `if (canonicalOnly || !shouldFallbackToLegacyFinance(error)) throw error;` (inaczej: gdy `canonicalOnly` jest `false` i błąd ma status z listy powyżej, kod NIE rzuca — schodzi na legacy).

**Wniosek:** gdy bramka V8 zwraca `404 V8_DISABLED` (gate globalny OFF — A.1 hipoteza a, potwierdzona 5/5) lub `404 V8_ORG_DISABLED` (organizacja bez wierszy flag na produkcji — A.1 hipoteza b), predykat `shouldFallbackToLegacyFinance` zwraca `true`, i front **cicho schodzi na tor legacy**, który — dowód HTTP w tabeli wyżej, 10/10 PASS — odpowiada `200` dla zwykłego zalogowanego członka na wszystkich pięciu trasach. Użytkownik NIE widzi pustego ekranu ani komunikatu o wyłączonym V8 — widzi dane pochodzące ze starego (legacy) toru, nieodróżnialne w UI od danych kanonicznych V8, chyba że dwa wyłączniki temu zapobiegną:

- `canonicalOnly` (`useFinanceData.ts:111`, `isFinanceOwnerReviewModeEnabled()`) — gdy `true`, powyższy warunek zawsze rzuca błąd zamiast fallbackować, więc łańcuch legacy nigdy się nie uruchamia.
- `ownerSampleData` (`useFinanceData.ts:112`, `isFinanceOwnerSampleDataEnabled()`, sprawdzany na początku każdej z pięciu funkcji `load*`: `:123,160,201,239`) — gdy `true`, przerywa łańcuch **przed jakimkolwiek wywołaniem HTTP** (`if (ownerSampleData) { ...; return; }`), więc pytanie o V8-vs-legacy w ogóle nie powstaje.

Teza pierwotnego zlecenia (że tor jest jednoznacznie ustalony per karta) jest tym samym **OBALONA**: bez `canonicalOnly=true`, tor faktycznie zasilający użytkownika zależy od stanu bramki V8 w danej chwili, a fallback jest cichy i niewidoczny w UI.

## Commity Day 43

- `56af1cacda` — A.1 real Gateway, pięć kart
- `2dc1b9a916` — A.2a inwentarz zachowania middleware
- `1fa5743d85` — A.2b kontrakt odwracalnego przełącznika
- `4a2d59e88e` — A.2c test odwracalności
- `0b36c6a46e` — A.3 real Gateway, legacy track

## STOP-y i licencja

Nie ogłoszono formalnego STOP-u dla pozycji. Pozostałe pozycje mają status `NIE_ZACZĘTE`, a nie sztucznie podniesiony `STOP`. Ramkę licencji przeczytano w całości wraz z instrukcją; nie wykorzystano jej do rozszerzenia zakresu.

## Twierdzenia niezweryfikowane

- Nie zweryfikowano zachowania staging, demo ani produkcji; Railway nie był kontaktowany.
- Nie zweryfikowano przeglądarkowo ani wizualnie pięciu kart i ich stanów empty/loading/error.
- Nie udowodniono pełnej macierzy UI: sample/canonical/legacy dla wszystkich konfiguracji flag i ról.
- Nie wykonano pełnego denominatora tras ani wymaganych testów mutacyjnych Z29 dla wszystkich endpointów Finance.
- Nie wykonano pełnego baseline ON i nie wyizolowano przyczyn 72 czerwonych plików baseline serwera OFF.
- Nie udowodniono B.1–L.1 ani gotowości R.1; brak wykonania nie jest wynikiem pozytywnym.
- Nie uzyskano akceptacji ownera ani decyzji o release.

## Następny bezpieczny krok

Kontynuować od B.1 na tej samej bazie markera dopiero po odtworzeniu czystego własnego PG i uruchamiać zakresy sekwencyjnie, aby oddzielić realne defekty od równoległych kolizji DDL. Nie aktualizować `MODULE_ACCEPTANCE.md` przed domknięciem brakujących pozycji i pełnych baseline OFF/ON.
