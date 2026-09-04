## Po co ten dyżur istnieje

Odbiór adwersaryjny 04.09 nie czytał kodu — wysłał **realne żądania HTTP** przez realny
`ApiGateway`, z podpisanym JWT, przy `NODE_ENV=production`, i przeczytał, co dostaje użytkownik:

| Trasa | Nagłówek | Co dostaje użytkownik |
| --- | --- | --- |
| `/okr-capability` | `Accept-Language: pl` | `"You are not authorized to perform this action."` — **angielski** |
| `/okr-program` | `Accept-Language: pl` | **angielski** |
| `/template` | `Accept-Language: pl` | `"Nie znaleziono szablonu."` — **działa** |

Przyczyna jest strukturalna, nie językowa. `server/src/routes/resultsVnext/okr.routes.ts` (ok. 369)
i `server/src/routes/resultsVnext/kpiScorecard.routes.ts` (ok. 213 i cztery dalsze) wołają:

```ts
mapAppErrorResponse(err, undefined, 'error')
```

**Bez `req` nie ma `Accept-Language`.** Mapper liczy język jako
`/^pl(?:-|,|$)/i.test(req?.get?.('Accept-Language') ?? '') ? 'pl' : 'en'`, więc przy `undefined`
zawsze wychodzi `en`. **Dwa z czterech kodów zlokalizowanych przez dyżur 321 są w ten sposób
strukturalnie nieosiągalne** — tłumaczenie istnieje i nigdy się nie odpala.

Skala: **378** wywołań `mapAppErrorResponse(` w `server/src`, z czego **106** z `undefined`
(moje liczby — zmierz swoje; zlecenie mówiło 115 z 370).

### Trzy warunki, przez które łatanie „per kod" nie zadziała

**(1) `isOperational = true` ZAWSZE.** Konstruktor `AppError`
(`server/src/utils/ErrorHandler.ts` ok. 34) ustawia tę flagę bezwarunkowo. Mapper liczy:

```ts
const operational = error instanceof AppError && error.isOperational;
const publicCode  = operational && codeOf(error) ? codeOf(error) : mappedCode;
const message     = operational
  ? OPERATIONAL_MESSAGES[language][publicCode] ?? raw
  : MESSAGES[language][mappedCode];
```

`OPERATIONAL_MESSAGES` ma **cztery** kody (`PROGRAM_NOT_ACTIVE`, `FINANCE_SETTINGS_INVALID`,
`NOT_FOUND`, `COMMAND_CAPABILITY_DENIED`). Dla każdego `new AppError(...)` z kodem spoza tej
czwórki gałąź `?? raw` zwraca **surowy komunikat z kodu, po angielsku** — a siedmioelementowy
słownik `MESSAGES` nigdy się nie odpala, bo `operational` jest prawdą. Wywołań `new AppError(`
w `server/src` poza testami: **203** (moja liczba).

> **Sprostowanie wobec treści zlecenia.** Zlecenie opisało mapper jako
> `operational ? raw : MESSAGES[language][code]`. Realny kod ma pośredni krok
> `OPERATIONAL_MESSAGES[language][publicCode] ?? raw`, więc cztery kody DZIAŁAJĄ, a `raw` jest
> dopiero fallbackiem. Wniosek zlecenia zostaje w mocy, mechanizm jest o jeden krok bogatszy.
> **Zweryfikuj to sam** — komenda (1) i (4) w `§0.1`.

**(2) `Accept-Language` jest w przeglądarce nagłówkiem ZABRONIONYM.** Front to wie i już to
obsłużył — `src/services/api.ts` ok. 792-795:

```ts
// NOTE: Browsers treat `Accept-Language` as a forbidden header, so setting it here is best-effort.
// Use `X-App-Language` as the reliable signal for backend localization.
'Accept-Language': userLanguage,
'X-App-Language': userLanguage,
```

`X-App-Language` jest w liście dozwolonych nagłówków CORS (`server/src/index.ts` ok. 1135-1136),
a **wzorzec poprawnego odczytu już istnieje w repo**:
`req.get('X-App-Language') || req.get('Accept-Language')` — `server/src/routes/demo.routes.ts`
ok. 52 oraz `server/src/routes/auth.routes.ts` ok. 1352.

**Rozwiązanie oparte wyłącznie na `Accept-Language` przejdzie w `supertest` i padnie w
przeglądarce.** To jest dokładnie kształt „test scenariusza nie broni zabezpieczenia".

**(3) Front kasuje pracę serwera.** `readAppErrorCode`
(`src/services/errors/appErrorCopy.ts` ok. 92-97) kończy się:

```ts
return CODES.has(raw as AppErrorCode) ? (raw as AppErrorCode) : 'INTERNAL';
```

Każdy kod spoza siedmiu kanonicznych staje się `INTERNAL`, a `getAppErrorCopy` bierze wtedy tekst
z `errors.app.internal.*` i **ignoruje `message` z serwera**. Zmierzone na realnym pliku:
`COMMAND_CAPABILITY_DENIED`, `PROGRAM_NOT_ACTIVE`, `FINANCE_SETTINGS_INVALID` → wszystkie
**„Coś poszło nie tak po naszej stronie…"**.

> **★ To jest najgorszy pojedynczy skutek w tym dyżurze: `403 „brak uprawnień"` pokazuje się
> użytkownikowi jako AWARIA SYSTEMU.** Użytkownik nie dowiaduje się, że czegoś mu nie wolno —
> dowiaduje się, że produkt jest zepsuty.

Do tego `src/services/api.ts` ok. 1128 (`createApiError(data, defaultError, res.status)`) podstawia
twardy angielski `defaultError` w ogonie wywołań. Moja liczba miejsc wołających
`handleResponse(res, <angielski literał>)`: **1003**. Zlecenie mówiło o 308 i samo oznaczyło tę
liczbę jako **NIEUDOWODNIONĄ**. Mechanizm jest dowiedziony, **wolumen mierzysz Ty** — i podajesz
razem z definicją tego, co liczysz.

### Dlatego rdzeniem tego dyżuru jest R1, a nie R2

Gdybyś dopisał polski tekst po stronie serwera **i** po stronie frontu, powstanie **trzecie**
źródło prawdy i za osiem tygodni wróci ten sam defekt w dwunastu plikach (udokumentowany kształt
„naprawa per-wywołanie odrasta"). **Najpierw rozstrzygasz, kto jest źródłem prawdy komunikatu —
serwer czy front — potem wykonujesz JEDNO.**

## ★ Zmierz moje liczby sam

Twierdzę: 378 wywołań mappera, 106 z `undefined`; `MESSAGES` ma 7 kodów, `OPERATIONAL_MESSAGES` 4;
`isOperational = true` bezwarunkowo; 203 wywołania `new AppError(`; `readAppErrorCode` sprowadza
resztę do `INTERNAL`; 1003 miejsca z `handleResponse(res, <literał>)`; liście
`translation.json` = pl 35198 / en 33065.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **walidator** | `server/src/validators/**` | **TYLKO ODCZYT** — ten dyżur nie zmienia walidacji wejścia, tylko tekst wyjścia | Opis w raporcie z dowodem plik:linia |
| **trasa (tył)** | `server/src/routes/resultsVnext/okr.routes.ts`, `server/src/routes/resultsVnext/kpiScorecard.routes.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zamiana `undefined` na `req` w wywołaniach `mapAppErrorResponse(...)`.** Zakaz zmiany kodów statusu, zakaz zmiany `err.code`, zakaz zmiany kolejności gałęzi `if (err instanceof …)`, zakaz dotykania logiki biznesowej | Gotowy diff w bloku kodu + brief |
| **trasa (tył)** | Pozostałe `server/src/routes/**` z wywołaniem `mapAppErrorResponse(..., undefined, ...)` | **★ WĄSKA LICENCJA — ta sama, co wyżej**, ale **wyłącznie dla tras, dla których dostarczysz PARĘ DOWODOWĄ** (żądanie z językiem polskim → polski; bez nagłówka → angielski). Trasa bez pary dowodowej **zostaje niezmieniona** i idzie do rejestru jako dług policzony | Wpis do rejestru: trasa · plik:linia · dlaczego nie zmierzona |
| **trasa (tył) — WZORZEC** | `server/src/routes/demo.routes.ts` ok. 52, `server/src/routes/auth.routes.ts` ok. 1352 | **TYLKO ODCZYT — to jest wzorzec, nie cel.** Pokazują poprawny odczyt: `req.get('X-App-Language') \|\| req.get('Accept-Language')` | — |
| **kontroler / mapper (tył)** | `server/src/middleware/appErrorMapper.ts` | **★ PEŁNA LICENCJA** w zakresie `R2` i `R4`: odczyt języka (`X-App-Language` z fallbackiem), rozszerzenie `OPERATIONAL_MESSAGES`, kolejność wyboru komunikatu. **ZAKAZ zmiany kształtu koperty** — pola `errorCode` i `correlationId` muszą zostać w każdej odpowiedzi błędu, z tymi samymi nazwami | — |
| **serwis / utils (tył)** | `server/src/utils/ErrorHandler.ts` | **TYLKO ODCZYT — PLIK PRZEKROJOWY.** `AppError` jest bazą 203 wywołań i globalnego handlera (ok. 246); zmiana `isOperational` przestawia zachowanie całego serwera | **CZERWONY KONTRAKT TESTOWY** (`it('KONTRAKT DLA DYŻURU 325 — …')`, nagłówek `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`) + brief: plik:linia · promień rażenia (ile wywołań, ile tras) · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **repozytorium (tył)** | `server/src/services/**`, `server/src/repositories/**` | **TYLKO ODCZYT** — komunikaty rodzą się tu, ale ten dyżur naprawia je w jednym miejscu, nie w 203 | Wpis do rejestru + gotowy diff nienałożony dla najbardziej reprezentatywnego przypadku |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział nieprzydzielony | Uznanie, że migracja jest potrzebna = STOP MERYTORYCZNY z briefem, idziesz dalej |
| **serwer — montaż** | `server/src/index.ts`, `server/src/Gateway.ts` | **TYLKO ODCZYT** (`Z19`) — lista CORS już zawiera `X-App-Language`, nie musisz jej ruszać | Brief + gotowy diff nienałożony |
| **front — rdzeń** | `src/services/errors/appErrorCopy.ts` | **★ PEŁNA LICENCJA** w zakresie `R3`: przestań sprowadzać kod spoza siedmiu do `INTERNAL` w sposób, który gubi `message` z serwera. **ZAKAZ usuwania fallbacku angielskiego** — ma zostać jako ostatnia deska ratunku, gdy serwer nie przyśle nic | — |
| **front — ogon** | `src/services/api.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE funkcja `handleResponse` i `createApiError` w zakresie „nie nadpisuj `message` z serwera twardym `defaultError`"**. Zakaz zmiany 1003 wywołań po kolei, zakaz zmiany nagłówków, zakaz zmiany logiki `429`/`403 access-blocked`/odświeżania tokenu | Gotowy diff + brief z promieniem rażenia |
| **front — testy** | `src/services/errors/__tests__/appErrorCopy.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie NOWYCH przypadków `it(...)`.** Zakaz zmiany i osłabiania istniejących | Nowy plik testowy obok |
| **testy (NOWE)** | `server/src/routes/**/__tests__/**` (NOWE pliki), `tests/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`, `Z29` (`--retry=0`) i `Z31`. **Nowe pliki w `tests/` wymagają `git add -f`** | — |
| **i18n** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości. **Liczba liści nie może zmaleć** (baza: pl 35198 / en 33065 — komenda w `B.3`) | — |
| **rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMUNIKATOW_PL_20260904.md` (**NOWY**) | **★ PEŁNA LICENCJA** | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY325_KOMUNIKATY_PL_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **bramki** | `server/src/middleware/auth.middleware.ts`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/middleware/resultsInternalBetaVisibility.middleware.ts`, `server/src/services/resultsVnext/platform/commandCapabilityGuard.ts`, `server/src/middleware/admin.middleware.ts`, `server/src/middleware/requireAudit.middleware.ts` | **TYLKO ODCZYT — `Z12`, BEZWZGLĘDNIE** | **CZERWONY KONTRAKT TESTOWY** + brief. Pozycja jest wtedy **ZROBIONA**, nie STOP |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar (patrz pułapka 4 o atrapie `react-i18next`), jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest zrobiona z takim opisem |
| **decyzje** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **cudzy teren** | `tests/unit/backend/security/noRawErrorMessage.test.ts`, `server/src/routes/admin/service-accounts.routes.ts`, `server/src/services/tablePlatform/**` — **teren dyżuru 326**; `src/components/Initiatives/InitiativeDocumentView.tsx`, `src/components/**/**CardContract*.ts`, `src/components/standard/cardContract.types.ts` — **teren dyżuru 324** | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, gotowa rekomendacja jako diff w bloku kodu, **nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit po KAŻDEJ pozycji, push na
`github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | **Rozstrzygnięcie JEDNEGO źródła prawdy komunikatu** | TAK | NIE — dowód: rozstrzygnięcie jest zapisem w raporcie, nie zmianą pliku | bazowe | Wpis w raporcie: **serwer albo front**, z uzasadnieniem opartym na trzech zmierzonych warunkach (`isOperational`, nagłówek zabroniony, `readAppErrorCode`), z jawnym zdaniem, co w związku z tym **przestaje** być robione po drugiej stronie. Bez tego wpisu R2 i R3 są zabronione | 7 komend `§0.1` + tabela mianowników | `docs(day325): rozstrzygniecie zrodla prawdy komunikatu (325 R1)` |
| R2 | Przekazanie języka: `req` do mappera + `X-App-Language` | TAK | NIE — dowód: `B.1` daje wąską licencję na obie trasy i pełną na mapper | +2 nowe testy realnych żądań | Dla KAŻDEJ zmienionej trasy **para żądań**: z językiem polskim → polski tekst; bez nagłówka → angielski; **`errorCode` niezmieniony w obu**. Kody odpowiedzi zapisane dosłownie | `npx vitest run <Twoje nowe testy> --config server/vitest.config.ts --retry=0` | `fix(errors): mapper dostaje req i czyta X-App-Language (325 R2)` |
| R3 | Front przestaje robić z 403 awarię systemu | TAK | NIE — dowód: `appErrorCopy.ts` ma pełną licencję w `B.1` | +2 testy | `COMMAND_CAPABILITY_DENIED` → tekst o braku uprawnień, nie „Coś poszło nie tak po naszej stronie…"; fallback angielski zachowany; **`errorCode` nadal odczytywalny z koperty** | `npx vitest run src/services/errors/__tests__ --retry=0` | `fix(errors): kod spoza siedmiu nie udaje awarii systemu (325 R3)` |
| R4 | Rozliczenie 203 `new AppError` z angielskim tekstem | NIE | NIE | +1 test | Rejestr: ile wywołań ma kod obecny w `OPERATIONAL_MESSAGES`, ile nie; werdykt dla najliczniejszej rodziny; gotowy diff **nienałożony** dla reprezentanta | `grep -rn "new AppError(" server/src \| grep -v __tests__ \| wc -l` (w `bash`) | `docs(day325): rejestr AppError bez polskiego slownika (325 R4)` |
| R5 | Wolumen ogona frontu | NIE | NIE | n/d | **Twoja** liczba miejsc, w których `defaultError` zastępuje `message` z serwera, z podaną definicją tego, co liczysz; werdykt: czy `R3` je pokrywa, czy zostaje dług | `grep -c "handleResponse(res, " src/services/api.ts` | `docs(day325): wolumen ogona defaultError (325 R5)` |
| R6 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" **niepusta** | — | `docs(day325): raport` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Żadna pozycja nie wymaga zmiany `ErrorHandler.ts` ani żadnej bramki z `Z12`:
> jeśli uznasz, że musi, produktem jest czerwony kontrakt + brief, a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą liczbę mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz w `bash`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Wywołania `mapAppErrorResponse(` w `server/src` | 378 | `grep -rn "mapAppErrorResponse(" server/src --include="*.ts" \| wc -l` | TAK — uruchomione na markerze |
| 2 | Wywołania z `undefined` zamiast `req` | 106 | `grep -rnE "mapAppErrorResponse\([^,)]*, *undefined" server/src --include="*.ts" \| wc -l` | TAK — **zlecenie mówiło 115 z 370; zmierz i zapisz swoją** |
| 3 | Kody w `MESSAGES` / `OPERATIONAL_MESSAGES` | 7 / 4 | `sed -n '25,60p' server/src/middleware/appErrorMapper.ts` | TAK |
| 4 | Wywołania `new AppError(` poza testami | 203 | `grep -rn "new AppError(" server/src --include="*.ts" \| grep -v "__tests__" \| wc -l` | TAK |
| 5 | Miejsca `handleResponse(res, <literał>)` w `api.ts` | 1003 | `grep -c "handleResponse(res, " src/services/api.ts` | TAK — **zlecenie mówiło 308 i samo oznaczyło to `NOT_PROVEN`** |
| 6 | Kody kanoniczne frontu | 7 | `sed -n '84,92p' src/services/errors/appErrorCopy.ts` | TAK |
| 7 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć**; tablice liczone element po elemencie |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `server/src/middleware/appErrorMapper.ts` | istniejący | R2 | ZEROWE — 324 i 326 mają go jawnie jako cudzy teren |
| 2 | `src/services/errors/appErrorCopy.ts` | istniejący | R3 | ZEROWE |
| 3 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMUNIKATOW_PL_20260904.md` | NOWY | R2/R4/R5 | ZEROWE |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY325_KOMUNIKATY_PL_REPORT.md` | NOWY | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/routes/resultsVnext/okr.routes.ts`, `kpiScorecard.routes.ts` | R2 | Tylko zamiana `undefined` → `req`, i tylko dla wywołań, dla których masz **parę dowodową** |
| Pozostałe `server/src/routes/**` z `undefined` | R2 | Jak wyżej — trasa bez pary dowodowej zostaje niezmieniona i idzie do rejestru |
| `src/services/api.ts` | R3/R5 | Tylko `handleResponse`/`createApiError`, tylko jeśli `R1` rozstrzygnął, że front nie ma nadpisywać `message` z serwera |
| `src/services/errors/__tests__/appErrorCopy.test.ts` | R3 | Tylko dopisanie nowych `it(...)` |
| `public/locales/{pl,en}/translation.json` | R3 | Tylko dopisanie kluczy, parytet w tym samym commicie, liczba liści nie maleje |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/utils/ErrorHandler.ts                        — przekrojowy (203 wywołania + globalny handler)
server/src/middleware/auth.middleware.ts                — Z12
server/src/services/resultsVnext/platform/commandCapabilityGuard.ts — Z12
server/src/middleware/v8FeatureGate.middleware.ts       — Z12
server/src/middleware/resultsInternalBetaVisibility.middleware.ts — Z12
server/src/index.ts, server/src/Gateway.ts              — Z19 (lista CORS już ma X-App-Language)
tests/unit/backend/security/noRawErrorMessage.test.ts   — teren dyżuru 326
server/src/routes/admin/service-accounts.routes.ts      — teren dyżuru 326
server/src/services/tablePlatform/**                    — teren dyżuru 326
src/components/Initiatives/**, src/components/**/*ardContract*.ts — teren dyżuru 324
server/migrations/**                                    — przedział nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6351 | `lsof -nP -iTCP:6351 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji) |
| Port harnessu | 5491 | `lsof -nP -iTCP:5491 -sTCP:LISTEN` → puste |
| Kontener | `cx-day325-pg` | `docker ps --format '{{.Names}}' \| grep cx-day325` → brak |
| Baza | `cx325` | n/d |
| Gałąź | `codex/day325-komunikaty-pl-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day325-komunikaty-pl` | nie istnieje |
| Przedział migracji | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Flagi | **żadnych nowych, żadnych zmian domyślnych** | `git diff <marker>..HEAD -- '.env*' 'docker-compose*' 'railway*'` → pusto |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day325-komunikaty-pl
git diff --name-only --cached | tee /private/tmp/cx-day325-komunikaty-pl-artefakty/staged.txt
grep -iE 'utils/ErrorHandler\.ts|auth\.middleware|commandCapabilityGuard|v8FeatureGate|resultsInternalBetaVisibility|server/src/index\.ts|Gateway\.ts|noRawErrorMessage|service-accounts\.routes|tablePlatform/|components/Initiatives/|ardContract|server/migrations/' \
  /private/tmp/cx-day325-komunikaty-pl-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"
```

---

## R1 — JEDNO ŹRÓDŁO PRAWDY KOMUNIKATU (rdzeń, wykonaj PIERWSZE)

**Nie zaczynasz kodować, dopóki tego nie zapiszesz.** Wpis w raporcie ma odpowiedzieć na jedno
pytanie: **kto jest źródłem prawdy tekstu, który czyta użytkownik — serwer czy front?** — i
uzasadnić to trzema zmierzonymi warunkami:

| Warunek | Za serwerem | Za frontem |
| --- | --- | --- |
| `isOperational = true` zawsze, `OPERATIONAL_MESSAGES` ma 4 kody, 203 wywołania `new AppError` | serwer musi urosnąć o słownik | front i tak zignoruje `message` przy kodzie spoza siedmiu |
| `Accept-Language` zabroniony w przeglądarce; `X-App-Language` już wysyłany i w CORS | serwer da radę, jeśli czyta oba | front zna język bez żadnego nagłówka |
| `readAppErrorCode` sprowadza kod spoza siedmiu do `INTERNAL` | serwer nie ma nad tym władzy | front ma pełną kontrolę i katalog `errors.app.*` |

Wpis musi zawierać jawne zdanie: **„W związku z tym po drugiej stronie PRZESTAJEMY robić X"** —
bez niego rozstrzygnięcie nie jest rozstrzygnięciem, tylko dopisaniem trzeciego źródła prawdy.

Prawo zatrzymania po tej pozycji. **R1 zrobione, R2-R6 nietknięte jest pełnowartościowym wynikiem.**

## R2 — PRZEKAZANIE JĘZYKA

Wykonujesz **wyłącznie stronę wskazaną przez `R1`**. Jeżeli `R1` wskazał serwer:

1. Mapper czyta język wzorcem, który już jest w repo:
   `req.get('X-App-Language') || req.get('Accept-Language')` (`demo.routes.ts` ok. 52).
2. `undefined` → `req` w wywołaniach — **tylko tam, gdzie dostarczysz parę dowodową**.

**Para dowodowa dla każdego naprawionego kodu** — realne żądanie HTTP przez realny
`ApiGateway.getInstance().initializeRoutes(app)` (`Z22`), z podpisanym JWT, z zapisanym **kodem
odpowiedzi** (`Z34`):

```
(a) z językiem polskim  → tekst POLSKI,  errorCode = <X>
(b) bez nagłówka języka → tekst ANGIELSKI, errorCode = <X>   ← ten sam X
```

**`errorCode` musi być identyczny w obu.** Para, w której kod się zmienił, jest dowodem cichej
zmiany API, nie dowodem lokalizacji.

**Dowód mutacyjny obowiązkowy, wycelowany w ZABEZPIECZENIE, nie w mechanizm** (`Z32`): usuń odczyt
`X-App-Language` z mappera → **para (a) staje się angielska, test CZERWONY**; przywróć przez `cp`
z kopii w `SCRATCH` (`Z27`, nigdy `git stash`) → **ZIELONY**; `git diff` po cofnięciu **pusty**.
Obie komendy i oba wyniki dosłownie w raporcie.

★ **Pułapka do udowodnienia, że ją obszedłeś:** test w `supertest` może ustawić `Accept-Language`
bez przeszkód. Przeglądarka nie może. Dlatego para dowodowa musi być wykonana **także dla
`X-App-Language`** — inaczej udowodniłeś działanie ścieżki, której realny użytkownik nie ma.

Prawo zatrzymania po tej pozycji.

## R3 — 403 PRZESTAJE WYGLĄDAĆ JAK AWARIA

`readAppErrorCode` ma nadal zwracać `INTERNAL` jako **ostateczny** fallback, ale `getAppErrorCopy`
nie może z tego powodu **wyrzucać `message` przysłanego przez serwer**. Dowód wprost:

```
Kod COMMAND_CAPABILITY_DENIED + message z serwera
  → PRZED: „Coś poszło nie tak po naszej stronie…"
  → PO:    tekst o braku uprawnień
  → errorCode w kopercie: NIEZMIENIONY
```

Fallback angielski zostaje na wypadek, gdy serwer nie przyśle nic — **nie usuwasz go** (`Z16`:
uczciwy stan „nie wiem" jest wzorcem poprawnym, nie defektem).

★ **Pułapka 4 obowiązkowo rozliczona w raporcie:** `tests/setup.ts` podmienia cały `react-i18next`
atrapą, w której `t(klucz, 'domyślne')` zwraca wartość **z kodu**. Test „polskich napisów" bez
`vi.mock('react-i18next', importActual)` przechodzi przy **pustym** `pl/translation.json`. Napisz,
jak to obszedłeś i **czym to udowodniłeś**. Pomiar bez tego akapitu nie liczy się jako dowód.

Prawo zatrzymania po tej pozycji.

## R4 — ROZLICZENIE 203 WYWOŁAŃ `new AppError`

Rejestr: ile wywołań niesie kod obecny w `OPERATIONAL_MESSAGES`, ile nie. Dla najliczniejszej
rodziny — werdykt i **gotowy diff nienałożony** dla jednego reprezentanta. Nie naprawiasz 203
miejsc; pokazujesz, że naprawa w jednym miejscu (mapper) je pokrywa, albo że nie pokrywa i
dlaczego.

Prawo zatrzymania po tej pozycji.

## R5 — WOLUMEN OGONA FRONTU

**Twoja** liczba, z podaną definicją tego, co liczysz („miejsca wołające `handleResponse(res, X)`,
gdzie `X` jest literałem angielskim" to inna liczba niż „miejsca, w których użytkownik realnie
zobaczy `X`"). Werdykt: czy `R3` je pokrywa, czy zostaje dług policzony.

Prawo zatrzymania po tej pozycji.

## R6 — RAPORT

Struktura `§R.2`. Obowiązkowo: rozstrzygnięcie `R1` ze zdaniem „przestajemy robić X", tabela par
dowodowych (kod · trasa · z pl → tekst+status · bez nagłówka → tekst+status · `errorCode`
przed/po), dowód mutacyjny w obie strony, akapit o pułapce atrapy `react-i18next`, akapit
`§0.2e` dla każdego uruchomionego pakietu, sekcja **TWIERDZENIA NIEZWERYFIKOWANE** niepusta.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 rozstrzygnięte, R2 zrobione dla dwóch tras z parami
dowodowymi, R3-R6 nietknięte" jest pełnowartościowym wynikiem — o ile każda zmieniona trasa ma
parę dowodową i o ile `errorCode` nigdzie się nie zmienił.

**Odwrotna kolejność — rejestry (R4/R5) zrobione, rdzeń (R1/R2/R3) „częściowo" — jest podstawą
odrzucenia.** Tak samo: naprawa obu stron naraz bez rozstrzygnięcia `R1`.

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone pętlą `[ -e "$p" ]` na worktree z markera; zero `BRAK` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, siedem wierszy; dwie liczby ze zlecenia **skorygowane własnym pomiarem** i oznaczone wprost |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4 |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (324, 326) | TAK — `B.4.4`; porty 5491/6351 zmierzone jako wolne |
| 7 | Komendy paste-ready, z `#   oczekiwane: …` | TAK |
| 8 | Pułapki środowiska w całości + sześć pułapek modułu | TAK |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru" bez ścieżki | TAK |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu w dokumencie: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| „Napraw komunikat po polsku" **vs** `Z12` zakaz zmian bramek platformowych | `B.1` — bramki tylko do odczytu; naprawa idzie przez mapper i front, obydwa z licencją |
| „Napraw serwer" **vs** „napraw front" | `R1` — rdzeniem jest ROZSTRZYGNIĘCIE jednego źródła prawdy; wykonujesz **jedno**, drugie strony jawnie **przestaje** to robić |
| Zakaz `Z16` „nie usuwasz uczciwych stanów pustych" **vs** `R3` zmienia tekst fallbacku | `R3` — fallback angielski **zostaje**, zmienia się tylko to, że `message` z serwera przestaje być wyrzucany |
| Zakaz `Z18` „infra testowa nietykalna" **vs** atrapa `react-i18next` fałszuje test napisów | `B.1` (wiersz infry) + pułapka (4) + `R3` — obchodzisz w SWOIM teście przez `importActual`, `tests/setup.ts` zostaje nietknięty; pozycja jest zrobiona z opisem |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument" **vs** `R2`/`R4`/`R5` piszą do rejestru | `Z13` (pole „jedyny inny dokument") — raport + jeden imiennie wskazany rejestr |
| „Napraw 106 wywołań z `undefined`" **vs** „każda zmiana ma parę dowodową" | `B.1` (wiersz „pozostałe trasy") — trasa bez pary dowodowej **zostaje niezmieniona** i idzie do rejestru jako dług policzony |
| Zakaz `Z30` „zero wysyłki" **vs** testy uderzają w realne trasy | `§0.2b` — montujesz `ApiGateway`, nie `server/src/index.ts`; drenaże outboxu nie startują; deklaracja dosłowna w raporcie |
