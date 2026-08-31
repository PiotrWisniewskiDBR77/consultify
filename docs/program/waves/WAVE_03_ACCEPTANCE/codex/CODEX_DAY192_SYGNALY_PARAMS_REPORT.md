# CODEX DAY 192 — sygnały deterministyczne: `bodyParams`

Data wykonania: 2026-08-30  
Marker: `b4651675f6`  
Gałąź: `codex/day192-sygnaly-params-20260831`  
Werdykt: **R1 ZROBIONE, R2 ZROBIONE, R3 ZROBIONE; pełna suita ma 1 zastany czerwony test poza zakresem.**

## 0. Baza, marker i zasoby

`df -h /` wykazał `12Gi` wolnego miejsca. Porty `6112`, `5056`, `5057` były wolne. Utworzyłem worktree wyłącznie z bare-vaulta pod `/private/tmp/cx-day192-sygnaly-params`. Nie czytałem ani nie modyfikowałem checkoutu właściciela; jedynym kontaktem jest dozwolony symlink `node_modules`.

Wynik komend (2), dosłownie:

```text
ce127952b5 partia 3 wydana (188-193: partner backend+i18n, drugi kasownik z LLM, stopka PDF, sygnaly params, piny Z31 — sweep znalazl 7 nie 3) + D-9 zaakceptowana + odbior 183 SCALONO
e758db0c44 merge: dyzur 183 + FIX-183 (kalendarz V2 domyslnie ON — D-6; wlasne wydarzenia przezywaja reload, zrzuty x4 potwierdzone wzrokiem)
cd9c545dc1 fix(day183): dedupe calendar sources so own events survive reload; full screenshot set
9e86cf531c odbior 180: SCALONO po FIX-180 — mechanika K6 DOMKNIETA; do wlaczenia agenta zostala decyzja wlasciciela o fail-open polityk + env przy deployu
d998ff21ae merge: dyzur 180 + FIX-180 (plany z czatu pod limitami; odmowa nie-trwala opt-in, klucz per proba z dedupem redelivery, krok terminalny po cancel, NaN-guard, happy-path, licznik odmow)
a3a70b2878 docs(day180): errata FIX-180 — cztery wady z sond, mutacje, stan sasiadow
84cadd53fc fix(agent/F1+F2): a refusal must not outlive its peak, a retry must retry
96e2714d36 odbior 181: SCALONO po FIX-181 (D-1 end-to-end, errata karty); strona obiektu -> dyzur 194
707ee1334d merge: dyzur 181 + FIX-181 (beta Spotkan otwarta D-1, /meetings w prefiksach pilota — MEMBER wchodzi, mutacja routera; errata karty uczciwa) — strona obiektu do 181-bis
4a6f6487b8 fix(day181): allow /meetings for pilot roles, honest card errata, object-page 403 surfaced
77fef4f11e test(agent/180): governed chat-plan happy path + one greppable denial counter
ed2e6fc17f fix(agent/F4): malformed timing envs fall back to the default, not to NaN
fa38aaf298 fix(agent/F3): close the in-flight step terminally when a plan is cancelled
b4651675f6 odbior 186: SCALONO (B+/A-) — plik dowodowy REALNY odtworzony niezaleznie; strop PARTIAL uczciwy (zadne wejscie UI nie niesie briefu -> decyzja produktowa); dyzur 193 zbiorcze piny Z31
fc9d7410bc merge: dyzur 186 (brief -> tresc slajdow w trasie szablonowej PPT; plik dowodowy REALNY — odtworzony niezaleznie bit-w-bit) — odbior B+/A-
846f9eaf34 odbior 180: NIE SCALAC — F1 trwala odmowa wspolbieznosci (krok martwy na zawsze), F2 retry polyka blad, F3 'W toku' po cancel, F4 NaN na env; FIX-180 Opus wydany
14ce6dc6bf odbior 187: FIX-187 wykonany — przycisk PDF w obu miejscach UI, D-3 zamkniete klientowo
1548ef5c7b Merge branch 'codex/m03-admin-20260824' of https://github.com/PiotrWisniewskiDBR77/consultify-recovery-private-20260820 into HEAD
53ebbf2088 fix(day187): PDF download button beside DOCX in audit report UI
67c819d9f8 odbior 183: flip wstrzymany do FIX-183 — includeOwnEvents gubi wlasne wydarzenia (diagnoza linia po linii); R1 klasa A; sprostowanie: ideaInspector ON od 26.08
809c5b8aff odbior 184: SCALONY po FIX-184 — plan migracji kompletny, gotowy do decyzji wlasciciela o wykonaniu D-7
e15eefec56 merge: dyzur 184 + FIX-184 (plan migracji legacy->kanon z rozdzialem A4.0 o budowie domu kanonicznego, tabele A1/A2, warianty personal-tasks) — do decyzji wlasciciela
48e034c207 marzenie wlasciciela: prezentacje jakosci Gammy — sciezka G-0..G-5 (rekonesans -> prototyp-plik do akceptu -> budowa za flaga), start po rundzie 30
4913eb6404 odbiory: 185 SCALONO po FIX; 182 SCALONO (A) — znalezisko {{value}} w 5/8 regulach -> dyzur 192; env staging przy deployu kandydata
503d259f75 merge: dyzur 182 (producent sygnalow: realny zapis do PG, mutacja niezalezna, inwentarz 8/8) — odbior A
MARKER OK
```

Wynik komend (7), dosłownie:

```text
b4651675f6ba0cc880c07fee94d2667a952d92f4
```

`status --short | head -3` nie zwrócił żadnej linii.

Tip uciekł do przodu. Zgodnie z `DEC-2026-08-26-95` praca pozostała dokładnie na markerze. Pełny log i lista plików rozjazdu są w `day192-base-divergence-log.txt` i `day192-base-divergence-files.txt`.

## 1. R1 — inwentarz pięciu reguł

| `ruleId` | plik | placeholder klienta | wartość potwierdzona w kodzie |
|---|---|---|---|
| `exec.task.overdue` | `rules/execution/taskOverdue.ts` | body `{{value}}`; title bez placeholdera | dni po terminie: `Math.max(1, Math.floor((now - due_date) / 86_400_000))` |
| `exec.task.due_soon_not_started` | `rules/execution/taskDueSoonNotStarted.ts` | body `{{value}}`; title bez placeholdera | dni do terminu: `Math.ceil((due_date - now) / 86_400_000)` |
| `exec.task.blocked_stale` | `rules/execution/taskBlockedStale.ts` | body `{{value}}`; title bez placeholdera | dni bez aktualizacji: `Math.floor((now - updated_at) / 86_400_000)` |
| `dec.pending_stale` | `rules/decision/pendingStale.ts` | body `{{value}}`; title bez placeholdera | dni oczekiwania: `Math.floor((now - created_at) / 86_400_000)` |
| `dec.blocking_dependents` | `rules/decision/blockingDependents.ts` | body `{{value}}`; title bez placeholdera | liczba obiektów: `dependents.length` |

Osiem reguł jest zarejestrowanych. Pozostałe trzy mają statyczne body i nie zostały zmienione. Serwerowy słownik używa `{value}`, klient i18next używa `{{value}}`.

## 2. R2 — implementacja

Każda z pięciu reguł zwraca `bodyParams: { value: observedValue }` albo, dla blokujących zależności, `{ value: dependents.length }`. W czterech regułach datowych wydzieliłem niezmienione wyrażenie do lokalnej stałej, aby `observedValue` i `bodyParams.value` były dokładnie tą samą wartością bez podwójnego liczenia.

Nie zmieniono SQL, progów, severity, limitów ani kluczy i18n. Diff dla `signalEvaluator.ts`, `signalReadModel.ts` i `workSignals.ts` jest pusty.

Pierwszy commit: `e505c5455a` (`fix(signals): persist deterministic body params`). Push wykonany natychmiast po commicie wyłącznie na `github-backup/codex/day192-sygnaly-params-20260831`.

## 3. R3 — dowody

### 3.1 Reguły i realny PostgreSQL

Kontener: `cx-day192-pg`, obraz `pgvector/pgvector:pg16`, port hosta `127.0.0.1:6112`, baza `cx192`. Pierwszy pełny przebieg migracji: sukces. Drugi przebieg: `Applying migrations: 0`, sukces.

Pakiet dwóch plików PG po finalnym czyszczeniu wyłącznie własnej tabeli testowej: **24/24 PASS, 0 FAIL**, JSON `day192-rules-green.json`. Wartości fixture potwierdzone niezależnie: overdue `6`, due soon `2`, blocked stale `7`, pending stale `8`, blocking dependents `1`.

Dosłowny końcowy readback:

```text
            rule_id             | body_params
--------------------------------+--------------
 dec.blocking_dependents        | {"value": 1}
 dec.pending_stale              | {"value": 8}
 exec.task.blocked_stale        | {"value": 7}
 exec.task.due_soon_not_started | {"value": 2}
 exec.task.overdue              | {"value": 6}
(5 rows)
```

Pułapki (a)–(e): testy nie przechodzą przez HTTP ani strażniki V8/auth, ale komplet env nadal jawnie ustawił `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `MOCK_DB=false`, `DB_TYPE=postgres`, `RUN_DB_TESTS=1`, `DATABASE_URL` do `127.0.0.1:6112`, `JWT_SECRET` oraz `--retry=0`. `numTotalTests=24` dowodzi, że nie był to `No test files found` ani skip całego pakietu. Pułapkę (e) wyłączają asercje `hit.bodyParams`, readback kolumny i osobny test klienta.

### 3.2 Klient, PL i EN

Nowy test `day192.signalPresentation.test.ts` ładuje rzeczywiste katalogi `public/locales/pl|en/translation.json` i wywołuje rzeczywistą funkcję `signalBody`. Wynik: **2/2 PASS**:

- PL: `Zadanie jest po terminie o 3 dni.`
- EN: `The task is 3 days overdue.`
- oba wyniki nie zawierają `{{`.

To pakiet czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`); strażniki (a)–(d) nie leżą na jego ścieżce, a (e) jest bezpośrednim przedmiotem obu asercji.

### 3.3 Mutacja w obie strony

Mutacja: usunięcie `bodyParams` tylko z `taskOverdueRule`.

- RED: exit `1`; dokładny test `four EXECUTION rules on real tenant data exec.task.overdue produces one evidence-backed hit with a destination` padł: `expected undefined to deeply equal { value: 6 }` (`day192-mutation-red.json`).
- GREEN po przywróceniu: ten sam pełny test PASS, `numFailedTests=0` (`day192-mutation-green.json`).
- `git diff --check` po przywróceniu: bez wyjścia.

Oba przebiegi miały pełny real-PG env i `--retry=0`.

### 3.4 Zrzut feedu

Zrzut `day192-feed-bodyparams-pl.png` wykonano na porcie `5056` z realnym komponentem `ChatSignalsFeed` i rzeczywistym `signalPresentation.ts`/i18next. Testowy DTO odtwarza finalny readback `exec.task.overdue = {"value":6}` z lokalnego PG. DOM i oględziny zrzutu potwierdziły dwukrotnie tekst `Zadanie jest po terminie o 6 dni.` oraz brak `{{value}}`.

Harness był wyłącznie w `/private/tmp/cx-day192-sygnaly-params-scratch`; nie zmieniono żadnego pliku `dev-render/**`, `src/**` ani pliku UI poza licencją.

### 3.5 Pełna suita sygnałów — residual

Pełny przebieg `src/services/signals/__tests__`: **66 PASS, 1 FAIL z 67**. Czerwony przypadek:

`execution signal compatibility adapter does not adapt non-execution rules or rules without a frozen mapping`

Ten sam przypadek pada również w izolacji w niezmienionym `executionSignalAdapter.test.ts`: mock zachowuje wywołanie z poprzedniego testu. Plik i adapter są poza licencją dyżuru; nie osłabiłem asercji i nie naprawiałem obcego problemu. Dowód: `day192-signals-full.json`, `day192-adapter-isolated.json`.

## 4. Pomiar zasięgu i lista dotkniętych plików

Instrukcja odwołuje się do `§0.4a`, lecz sekcja `0.4a` nie istnieje w wydanym pliku. Wykonałem bezpieczny odpowiednik: `git diff --name-only b4651675f6..HEAD` i pełny pakiet `server/src/services/signals/__tests__`.

Pliki produkcyjne: dokładnie pięć licencjonowanych reguł. Pliki testowe: dwa istniejące testy PG i jeden nowy `day192.*`. Jedynym dokumentem jest ten raport. Żaden plik globalnej infrastruktury testowej nie został zmieniony.

## 5. Z30 — zero wysyłki

Przed migracjami: `BRAK ZMIENNYCH POCZTY`. Po migracjach zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło `0 rows`. Grep drenów w `server/src/Gateway.ts` zwrócił zero trafień.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

Lokalny Vite służył wyłącznie do renderu statycznego DTO; nie uruchamiał backendu ani drenaży.

## 6. Korekty wobec instrukcji

1. `§3 R2`: „dosłownie jedno nowe pole na regułę” koliduje z `§2 T1`: „nie ponowne liczenie” i z ramką `§0.2d(e)`: „nie licz jej drugi raz”. Na markerze cztery obliczenia były wpisane bezpośrednio w obiekt literalny, bez zmiennej, do której nowe pole mogłoby się odwołać. Wybrałem bezpieczniejszą interpretację: niezmienione wyrażenie wydzielone do lokalnego `const observedValue`; oba pola korzystają z tej jednej wartości. SQL/progi/semantyka nie zmieniły się.
2. `Z24` i kilka dalszych miejsc odwołują się do `§0.4a`, ale wydany dokument przechodzi z `§0.2d` bezpośrednio do `§0.5`. Zamiast zgadywać treść brakującej sekcji, podałem własny pomiar nazw testów, liczby przypadków i pełną listę diffu.
3. Pełna suita nie jest w pełni zielona: 1/67 to zastany, powtarzalny w izolacji błąd adaptera poza licencją. Nie przedstawiam wyniku 66/67 jako PASS.

## 7. Artefakty i SHA-256

Katalog: `/private/tmp/cx-day192-sygnaly-params-artefakty`.

```text
12f9754ad7dab25bf20eac67a94daae657c5662dc769345703ef43f58818fb9f  day192-adapter-isolated.json
801b07106992318a24046fba475bc3f41e80f8f0e686dc248e2852fea36be176  day192-base-divergence-files.txt
9211866c1c64a9d95f98aea664a73974931b82b812a76d120b8d2bdcfed9b38f  day192-base-divergence-log.txt
1be6fc4f5682eaa888ad2c191257fcfb45805b1c1168d0503a98f27e45ab007f  day192-body-params-select.txt
fec0dfe56f3ef1cf9bf1b58c984955f9cc3c289e121bfd669fe0038a1ea5e73f  day192-client-green.json
be97dea27908a079fc1e1d70a3e64fce7cc2cabd0a8be96992eed2060b19bf93  day192-feed-bodyparams-pl.png
0f50c2b86b65b8364753450ccb2bf1afb687349db669a16a6ad396049023c94c  day192-migrate-first.log
f6dc048ec6c3fb7f511ba9113aa9e94d7f524b349fa44b91a9167cc5db0cf086  day192-migrate-second.log
9fd28bb24adcaaa312d496d4e0275fd9e8771a6ecd84d67fa91485952e2aab00  day192-mutation-green.json
18fc78e7c2301717c2c8aa5742aa22d996745e0cb58e1d6ce55251261e0e5f34  day192-mutation-red.json
3f4e1cb8e4e888e68f569746bda2631e8f26d1bf80cda2757b3f704ffa1976aa  day192-rules-green.json
5b6ad19a552116397450faf4aa4dfce27754188608b6b16a64aef182787f9ab3  day192-signals-full.json
```

## 8. TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano pełnego requestu HTTP przez `ApiGateway`; R3 z instrukcji wymagał reguły → evaluator/kolumna PG → klient, nie trasy HTTP. Nie rozszerzam tego na twierdzenie o produkcyjnym HTTP.
- Zrzut używa realnego komponentu i DTO odtworzonego z końcowego readbacku lokalnej bazy, ale nie pobiera DTO przez runtime API. Ten fakt jest jawny i nie nazywam zrzutu dowodem HTTP.
- Nie rozstrzygnięto przyczyny zastanego błędu adaptera poza stwierdzeniem, że reprodukuje się w izolacji; naprawa jest poza tabelą licencji.

Wszystkie pięć wartości R1 oraz oba języki klienta zostały zweryfikowane.
