# CODEX — DYŻUR 234 — WYNIKI

Data: 2026-09-01  
Gałąź: `codex/day234-wyniki-20260901`  
Baza wykonania: `e99e81301ac8c9cc9b945eb44b7365fa7ff055d6`  
Zakres: pomiar i ekran dowodowy; bez zmiany produktu, flag, backendu i tras crosswalk.

## Werdykt

Rdzeń wizualny został dostarczony na ręcznych fixture harnessu: trzy realne rejestry i po dwa reprezentatywne widoki pełnego narzędzia na domenę, każdy w light/dark. Wszystkie dziewięć par przekracza wymagane `150` punktów różnicy `mean_luma` (minimum `220.6`). To nie jest dowód danych z realnego HTTP/PG — screeny montują produkcyjne komponenty, ale z deterministycznymi ręcznymi fixture istniejących harnessów.

Mianownik `135` został obalony. Na markerze użytkownika trzy reprodukowalne metody dają `130`, `146` i `152`; żadna nie daje `135`. Najmocniejszy pomiar runtime daje `152` unikalne pary metoda+pełna ścieżka i zero duplikatów.

Crosswalk/backfill pozostaje biblioteką bez wołacza produktowego. Nie zamontowałem trasy i nie zmieniłem decyzji produktowej.

## Stan wejściowy — wynik dosłowny

```text
USER MARKER OK
DOC MARKER OK
e99e81301ac8c9cc9b945eb44b7365fa7ff055d6
git status --short: <pusto>
```

Wolne miejsce przed pracą: `22 GiB`; porty `6182`, `5152`, `5153`: brak listenerów. Kontener: `cx-day234-pg`, obraz `pgvector/pgvector:pg16`, wyłącznie `127.0.0.1:6182`. Pierwsze migracje zakończone `Postgres migrations complete`; replay: `Applying migrations: 0`.

## Korekty wobec instrukcji

1. Wiadomość właściciela: `Marker: e99e81301a`; ramka `§0.1` wydanej instrukcji: `SHA markera: 142686b772`. Oba są przodkami tipa, lecz przyjąłem jawne, nowsze polecenie właściciela i wykonałem pracę na `e99e81301a`. To rozstrzygnięcie zmienia wynik pomiaru mianownika na aktualnym markerze i nie dotyka cudzej gałęzi.
2. Instrukcja wskazuje `src/utils/resultsVNextFeatureFlags.ts`; realna ścieżka to `src/components/ResultsVNext/resultsVNextFeatureFlags.ts:135-174`.
3. Instrukcja wymaga struktury raportu z `§R.2`, ale dokument nie zawiera sekcji `§R.2`. Zachowałem wszystkie nazwane obowiązki: wynik, korekty, pełne nazwy testów, pułapki, artefakty, nieweryfikowane twierdzenia i deklaracje bezpieczeństwa.
4. Marker `e99e81301a` miał zastany, składniowo czerwony `dev-render/main.tsx`: brakowało domknięć wpisów dni 220 i 230. W licencjonowanym pliku dopisałem wyłącznie dwa `},`; po tym bundlowanie przechodzi. Zastane ostrzeżenie o zdublowanym kluczu `document-studio-blocks-i18n` pozostało bez naprawy poza zakresem.
5. Instrukcja zapisuje query jako `?ff_resultsVNextRoi=1&?ff_resultsVNextOkr=1`; drugi znak `?` nie tworzy drugiego parametru URL. Harness używa osobnych, poprawnych parametrów oraz master override `ff_wave3ResultsOwnerReview=1`.

## T1–T8

| Teza | Wynik | Dowód |
|---|---|---|
| T1: 8/6/16 | POTWIERDZONA | tabela kontraktu ma 30 wierszy; komendy identyfikatorów dają KPI 8, OKR 6, ROI 16 |
| T2: crosswalk zero wołaczy | POTWIERDZONA STATYCZNIE | definicje `kpiCrosswalkService.ts:36,74`, `kpiShadowReadService.ts:56`; grep bez testów zwraca tylko definicje, Gateway bez trafień |
| T3: brak reprodukcji 135 | POTWIERDZONA | `130`, `146`, `152`; komendy poniżej |
| T4: 4 przypadki mają kształt ApiGateway+JWT+PG readback | POTWIERDZONA STRUKTURALNIE, WYKONANIE NIEZWERYFIKOWANE | `day46.mutator-tenant-isolation.realpg.test.ts:88-210`; oba przebiegi własne oznaczyły 4 nazwy jako skipped |
| T5: KPI ON poza public prod, OKR/ROI OFF | POTWIERDZONA | `resultsVNextFeatureFlags.ts:135-174`; unit `13/13 PASS`; para screenshot OFF/owner |
| T6: pierwszy 170 odrzucony | POTWIERDZONA | historia zawiera `645e5b9fc0 odbior 170: NIE SCALAC`; po FIX backend A, UI C (`ODBIOR_170_OKNA_CHECKIN.md:10-16`) |
| T7: testowy escape-hatch | POTWIERDZONA STATYCZNIE | `resultsInternalBetaVisibility.middleware.ts:20-33`; poza testem nie ma bypassu |
| T8: wspólny łańcuch bramek | POTWIERDZONA STATYCZNIE | trzynaście wpisów `ROUTES.RESULTS*` w `AppRoutes.tsx:2865-3188`, każdy z BetaGate/ProductionModuleGate/RouteErrorBoundary |

## Mianownik F.2 — trzy metody

### 130 — literalne rejestracje

```bash
grep -hE '^router\.(post|put|patch|delete)\(' server/src/routes/resultsVnext/*.routes.ts | wc -l
# 130
```

Ta metoda liczy również pojedyncze linie w definicjach helperów, lecz nie rozwija ich wywołań.

### 146 — literalne minus definicje helperów plus ich wywołania

```bash
direct=$(grep -hEc '^router\.(post|put|patch|delete)\(' server/src/routes/resultsVnext/*.routes.ts | awk '{s+=$1} END{print s}')
defs=$(grep -hEc '^function mount(Lifecycle|Escalation|Transition|SetTransition)Route' server/src/routes/resultsVnext/*.routes.ts | awk '{s+=$1} END{print s}')
calls=$(grep -hE '^mount(Lifecycle|Escalation|Transition|SetTransition)Route\(' server/src/routes/resultsVnext/*.routes.ts | wc -l | tr -d ' ')
echo "direct=$direct defs=$defs calls=$calls result=$((direct-defs+calls))"
# direct=130 defs=6 calls=22 result=146
```

Ta metoda nadal widzi tylko rejestracje o rozpoznanym kształcie tekstowym.

### 152 — moja metoda: introspekcja zbudowanych stosów Express

```bash
NODE_ENV=test RUN_DB_TESTS=0 MOCK_DB=true npx tsx -e "Promise.all([import('./server/src/routes/resultsVnext/search.routes.ts'),import('./server/src/routes/resultsVnext/kpiDeviation.routes.ts'),import('./server/src/routes/resultsVnext/kpiRecoveryChildren.routes.ts'),import('./server/src/routes/resultsVnext/kpiScorecard.routes.ts'),import('./server/src/routes/resultsVnext/kpiLegacyArchive.routes.ts'),import('./server/src/routes/resultsVnext/kpiPerspectives.routes.ts'),import('./server/src/routes/resultsVnext/kpi.routes.ts'),import('./server/src/routes/resultsVnext/roiPerspectives.routes.ts'),import('./server/src/routes/resultsVnext/roiLegacyArchive.routes.ts'),import('./server/src/routes/resultsVnext/roi.routes.ts'),import('./server/src/routes/resultsVnext/okrLegacyArchive.routes.ts'),import('./server/src/routes/resultsVnext/okr.routes.ts')]).then(m=>{const x=[['/api/vnext/results/search',m[0].default],['/api/vnext/results/kpi/deviation-cases',m[1].default],['/api/vnext/results/kpi/recovery-cards',m[2].default],['/api/vnext/results/kpi/scorecards',m[3].default],['/api/vnext/results/kpi/legacy',m[4].default],['/api/vnext/results/kpi',m[5].default],['/api/vnext/results/kpi',m[6].default],['/api/vnext/results/initiatives',m[5].initiativesKpiImpactsRouter],['/api/vnext/results/roi',m[7].default],['/api/vnext/results/roi/legacy',m[8].default],['/api/vnext/results/roi',m[9].default],['/api/vnext/results/okr/legacy',m[10].default],['/api/vnext/results/okr',m[11].default]],r=[];for(const[p,q]of x)for(const l of q.stack??[])if(l.route)for(const v of Object.keys(l.route.methods))if(['post','put','patch','delete'].includes(v))r.push(v.toUpperCase()+' '+p+l.route.path);const u=[...new Set(r)];console.log('RUNTIME_MUTATOR_REGISTRATIONS='+r.length,'UNIQUE_GATEWAY_METHOD_PATHS='+u.length,'DUPLICATES='+(r.length-u.length))})"
# RUNTIME_MUTATOR_REGISTRATIONS=152 UNIQUE_GATEWAY_METHOD_PATHS=152 DUPLICATES=0
```

Wniosek: `135` nie jest odtwarzalnym mianownikiem. `152` najlepiej odpowiada pytaniu „ile unikalnych mutujących metoda+pełna ścieżka faktycznie zarejestrowały routery montowane przez Gateway”, ale decyzja o kanonicznej definicji mianownika należy do nadzorcy.

## R1 — harness i dowód wizualny

Dodane: `dev-render/screens/day234-wyniki-rejestry.tsx`, `dev-render/screens/day234-wyniki-narzedzia.tsx` oraz dwa wpisy w `dev-render/main.tsx`. Switchboardy kompozycyjnie używają istniejących hostów domenowych, które montują realne komponenty produktu. Nie kopiują logiki produktu.

Dane na wszystkich zrzutach pochodzą z ręcznych, deterministycznych fixture dev-render, nie z realnego przebiegu HTTP/PG. Realna jest warstwa komponentów, routingu wewnętrznego i interakcji w harnessie.

| Para | Light | Dark | Różnica |
|---|---:|---:|---:|
| Rejestr KPI | 249.0 | 22.8 | 226.2 |
| Rejestr ROI | 246.2 | 15.6 | 230.6 |
| Rejestr OKR | 246.7 | 26.2 | 220.5 |
| KPI — narzędzie | 245.5 | 24.9 | 220.6 |
| KPI — sprawa odchylenia | 243.8 | 29.0 | 214.8 |
| OKR — przegląd | 249.4 | 15.5 | 233.9 |
| OKR — cele i KR | 249.1 | 20.5 | 228.6 |
| ROI — baseline | 249.4 | 15.4 | 234.0 |
| ROI — koszty | 248.4 | 16.4 | 232.0 |

Artefakty leżą wyłącznie w `/private/tmp/cx-day234-wyniki-artefakty`. Główne zrzuty: `day234-rejestr-{kpi,roi,okr}-{light,dark}.png`, `day234-narzedzie-kpi-{tool,case}-{light,dark}.png`, `day234-narzedzie-okr-{overview,objectives}-{light,dark}.png`, `day234-narzedzie-roi-{baseline,costs}-{light,dark}.png`. Para bramek: `day234-bramka-{roi,okr}-{off,owner}.png`. Hash każdego pliku jest odtwarzalny komendą `shasum -a 256 /private/tmp/cx-day234-wyniki-artefakty/day234-*.png`.

Para bramkowa wykazała: jawny OFF daje „Rejestr ROI/OKR — jeszcze nie włączone”; ten sam nośnik domenowy z `ff_wave3ResultsOwnerReview=1` pokazuje realny rejestr. KPI bez override renderuje rejestr na localhost. Wartości domyślne flag nie zostały zmienione.

Check-in OKR w fixture pokazuje `5 sie 2026` i `19 sie 2026` dla wartości z godziną `09:00Z`; nie jest to przypadek graniczny północy. Regresja date-only z dyżuru 170 nie została tym zrzutem ponownie udowodniona.

## Pomiar nazw testów

Artefakty: `przed-nazwy.txt`, `po-nazwy.txt`; `diff -u` jest pusty — zero nazw dodanych i zero znikniętych.

- Flagi: przed `13/13 PASS`, po `13/13 PASS`, `--retry=0`.
- RealPG F.2: przed i po `4 pending/skipped`, `0 passed`, `success:false`, mimo jawnego kompletu env, lokalnego `DATABASE_URL`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `ENABLE_TEST_AUTH_BYPASS=false` i `--retry=0`. Nie raportuję tego jako PASS ani dowód wykonania.
- Bundlowanie trzech zmienionych plików: PASS; bundlowanie `main.tsx`: PASS z jednym zastanym ostrzeżeniem o duplikacie klucza.

Pułapki: pakiet flag jest czysto jednostkowy i nie dowodzi DB/Gateway. Pakiet F.2 miał wyłączone bypassy (a)–(d) w komendzie, ale sam pozostał skipped, więc nie dowodzi żadnej mutacji. Zrzuty dotyczą pułapki (e): domeny OFF włączono tylko parametrem/master override, bez zmiany defaultów.

## R2 — aktualizacja MODULE_ACCEPTANCE

Na końcu `modules/09_RESULTS/MODULE_ACCEPTANCE.md` dopisano stan pomiarowy: `130/146/152`, pięć niepokrytych rodzin, rozdzielony stan 170 oraz crosswalk bez wołacza. Nie skasowano ani nie podniesiono istniejących statusów.

## R3 — brief crosswalk/backfill

Najmniejszy bezpieczny wariant wymaga osobnej decyzji produktowej: ręczna akcja OWNER/ADMIN na karcie inicjatywy „Potwierdź mapowanie KPI”. Żądanie powinno przyjmować wyłącznie jawne pary `sourceId` + `canonicalKpiId` wybrane przez człowieka, nigdy dopasowanie po nazwie/kodzie. Backend powinien przejść przez istniejące auth, membership i Results visibility gates, zapisać mapowanie tenant-scoped, zwrócić liczby requested/inserted/rejected, a UI odczytać wynik i shadow comparison. Operacja wymaga idempotency key, audytu aktora i niezależnego odczytu. Alternatywa — ręczny job administracyjny OWNER — ma mniejszy promień UI, ale gorszą widoczność kontekstu. Nie montuję żadnej z opcji bez decyzji właściciela „kiedy i gdzie uruchamiać”.

## Deklaracja Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano wykonawczo 4/4 izolacji F.2: własne przebiegi były skipped, nie PASS.
- Nie zweryfikowano pełnej ścieżki screenshotów przez `server/src/index.ts`/runtime `5153`; zrzuty są z dev-render na `5152` i ręcznych fixture.
- Nie zweryfikowano regresji daty OKR na granicy północy w `Europe/Warsaw`.
- Nie wykonano kompletnej 43-punktowej interaktywnej listy TRIADY dla każdego z dziewięciu kadrów; wzrokowo zweryfikowano render, brak error state i pary light/dark. Właścicielskie rozstrzygnięcie UI pozostaje otwarte.
- Nie rozstrzygnięto, czy kanonicznym mianownikiem F.2 ma być 146 czy 152; `135` jest obalone.
- Nie dowiedziono działania crosswalk w produkcyjnym przepływie, ponieważ przepływ i caller nie istnieją.

## Lista dotkniętych plików

```bash
git diff --name-only e99e81301a..HEAD
```

Oczekiwany zakres: dwa ekrany dev-render, `dev-render/main.tsx`, `MODULE_ACCEPTANCE.md`, ten raport. Zero zmian backendu, flag, test infrastructure i produktu.
