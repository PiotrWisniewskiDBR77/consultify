# RAPORT — CODEX1 — Inicjatywy: jeden magazyn danych

## 0. Metryka

Marker: `4630b1ee4c` · gałąź: `codex/inicjatywy-jeden-magazyn-20260910`.

SHA po każdym etapie: E1 `ed839277a5` · E2 `f370173d69` · E3 NIEZROBIONY · E4 bez zmiany kodu (werdykt pomiarowy) · E5 NIEZROBIONY jako pełny E2E · E6 commit zawierający ten raport (bieżący `HEAD` po commicie E6).

Wynik `git merge-base --is-ancestor 4630b1ee4c HEAD`: `BAZA OK — marker jest przodkiem HEAD`.

Wynik kroku (7) przed zmianami:

```text
4630b1ee4c05fdf70408da981489c40d22833148
<git status --short: pusty>
```

Kontener/baza/porty: `cx-codex1-inicjatywy-pg` / `cx_codex1_inicjatywy` / `6451`, `5591`. Porty przed startem: `PORTY WOLNE`; kontenery o tej nazwie: `0`; zajęte migracje `20262130–20262139`: `0`.

Migracje: pierwszy przebieg `913`, drugi `0`; oba zakończone `Postgres migrations complete`. Baza jest świeża i lokalna, a nie kopią stagingu.

`origin/staging` uciekł przed startem o dwa commity: `ccbd85ad8c`, `b85398b174`; zgodnie z instrukcją praca pozostała na markerze.

## 1. K-PUNKTY — PRZED i PO

| K   | Co mierzę                                       | PRZED (mój pomiar)                                                          | PO (mój pomiar)                                                                                               | Komenda                                                                                   |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| K1  | bramki istnienia pytające tylko magazyn zastany | 50 (autor: 50)                                                              | 50; rozbieżności brak, cel E2 nieukończony                                                                    | `grep -rn "SELECT id FROM initiatives WHERE id" server/src \| grep -v __tests__ \| wc -l` |
| K2  | pliki z tymi bramkami                           | 19 (autor: 19)                                                              | 19; rozbieżności brak                                                                                         | ten grep + `cut -d: -f1 \| sort -u \| wc -l`                                              |
| K3  | agregaty bez wiersza zastanego                  | 0 na świeżej bazie (autor na kopii: 15)                                     | 0 po sprzątaniu testu                                                                                         | zapytanie `NOT EXISTS` z instrukcji                                                       |
| K4  | wiersze zastane bez agregatu                    | 0 na świeżej bazie (autor na kopii: 699)                                    | 0                                                                                                             | zapytanie `NOT EXISTS` z instrukcji                                                       |
| K5  | organizacje w kanonie / zastanym                | 0 / 0 (autor: 2 / 29)                                                       | 0 / 0                                                                                                         | dwa `count(DISTINCT organization_id)`                                                     |
| K6  | powierzchnie widzące nowy rekord                | PRZED: 2/7: runtime lista oraz milestones poza mianownikiem 7               | PO: 4/7 zmierzone: runtime lista, `GET /api/initiatives`, karta, KPI; nie zmierzono Execution/My Work/Reports | `e1.json`, `e2-on-10.json`                                                                |
| K7  | ścieżki zapisu zastane                          | 4 wzorce wycofane; 6 badanych przywróconych                                 | 0 z 6 wycofanych / 6 zostaje / 6 bez równoważnego następcy                                                    | `e4-szesc-sciezek.txt`                                                                    |
| K8  | wiersze pominięte przez migrację                | NIEZMIERZONE na danych stagingu (autor przewiduje co najmniej braki 78/104) | NIEZMIERZONE                                                                                                  | lokalna baza: `SELECT ... IS NULL` → `0                                                   | 0`; to nie jest mianownik 699 |

## 2. Stan wejściowy — 9 komend z §0.1a

1. `wc -l` bramek: `50` (autor: 50).
2. Rozkład: results 11, InitiativeController 10, execution-control 5, governance 4, initiatives.routes 3, benefits 3, execution 2, pozostałe po 1; 19 plików (autor: to samo).
3. `initiativeWriteTruth.ts`: `submitSourceProposal` linia 219, `registerSourceProposal` linia 246, zero `INSERT INTO initiatives` (autor: 218/246; przesunięcie jednej linii jest wynikiem markera).
4. Most kliencki: definicja `initiativeRegisterProjection.ts:482`, wywołanie `InitiativesHub.tsx:605`, legacy API `runtimeApi.ts:1274` (autor: to samo).
5. Pliki dotykające legacy: `161`; po prawidłowym wyłączeniu `_backup` wg Z4: `159` (autor podał 161 i równocześnie nakazał odjąć `_backup`).
6. Middleware: 4 wzorce, linie 82–87 (autor: 4).
7. Kanoniczna lista: `initiativesExecutionRuntime.routes.ts:2113` (autor: 2112–2113).
8. Realne `.catch(() => {})`: `0`; grep zwrócił jeden komentarz w `ExecutionControlSurface.tsx:2929` (autor: 0 realnych).
9. `PORTY WOLNE`; kontener `0`; migracje w przedziale `0` (autor: to samo).

Dodatkowe mianowniki: najwyższa migracja `20262107` (zgodne); cztery odrębne powierzchnie wołają `createInitiativeWriteTruth`, choć literalna komenda autora liczy 7 linii (3 importy + 4 wywołania); świeża baza ma `0` braków project/owner i `0` milestones, więc nie zastępuje kopii danych autora.

## 3. Etapy — po jednej sekcji na etap

### E1

Zbudowano inwentarz poza repo i 8-przypadkowy test real-PG przez `ApiGateway.initializeRoutes`, podpisany JWT oraz PostgreSQL. Wynik: 8/8. Test potwierdził zapis runtime-v1, brak rekordu w legacy liście/karcie/KPI i działający wyjątek milestones. Pułapki §0.2e: (a) wyłączona `ENABLE_V8_GLOBAL=true`; (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) jawne `DB_TYPE=postgres`, potwierdzone asercją; (d) `ENABLE_TEST_AUTH_BYPASS=false`; (e) nie dotyczy — brak testu 409. SHA `ed839277a5`.

### E2

Dodano `initiativeUnifiedReader.ts`: tenant-scoped odczyt obu magazynów, deduplikacja z priorytetem kanonu, jawne `source`, logowanie braków mapowania i serwerowy egzemplarz mapowania statusów. Flaga `ENABLE_INITIATIVE_UNIFIED_READ` jest default OFF. Podłączono listę, kartę i KPI (łącznie z wewnętrzną bramką KPI). ON: 10/10; OFF: 10/10; `tsc --noEmit -p server/tsconfig.json`: bez błędów. Nie podmieniono pozostałych bramek, dlatego E2 jest PARTIAL. Pułapki (a)–(d) wyłączono pełnym env; (e) nie dotyczy. SHA `f370173d69`.

### E3

NIEZROBIONY. Świeża baza po migracjach ma 0/0 rekordów, a instrukcja nie podaje lokalnej ścieżki kopii stagingu. Z28 zabrania pobrania jej ze środowiska. Nie utworzono skryptu, migracji ani manifestu, aby nie produkować dowodu na syntetycznym mianowniku.

### E4

Decyzja CTO z 2026-09-10 18:05 uznała STOP i zamknęła zakres tego etapu: sześć pisarzy legacy (`milestones`, `resources`, `staffing-plans`, `budget-items`, `gate-roles`, `move`) **zostaje bez zmian**. Nie projektowano następców. Tabela dowodowa z `e4-szesc-sciezek.txt` pozostaje wejściem do osobnego bloku domenowego; żadnej ścieżki nie wycofano i nie dodano asercji `409`.

### E5

NIEZROBIONY jako wymagany Playwright 7-surface. Test HTTP+SQL z E1/E2 mierzy 4/7 powierzchni i wynik SQL podczas przebiegu `kanon=1`, `zastany=0`, ale nie mierzy widoku UI, Execution, My Work ani Reports. Nie uruchomiono harnessu na 5591. Pułapki (a)–(d) wyłączone env; (e) nie dotyczy.

### E6

Raport ma 14 sekcji, sekcje 10 i 11 są niepuste. Liczby bez lokalnego mianownika są jawnie oznaczone NIEZWERYFIKOWANE zamiast przepisane.

## 4. Dowody mutacyjne (Z32)

Mutacja E2: po `cp` pliku do `codex1-scratch` zmieniono warunek gałęzi kanonicznej na `canonical && false`. Komenda ON z pełnym env i `--retry=0` dała 8/10, czerwone: karta oraz priorytet kanonu (`e2-mutacja-clean-red.json`). Przywrócenie: `cp .../initiativeUnifiedReader.ts.e2-committed server/src/domain/initiatives-execution/initiativeUnifiedReader.ts`; wynik 10/10 (`e2-mutacja-clean-green.json`); `git diff PUSTY`.

Nie wykonano mutacji `organization_id` ani middleware E4. Zakaz wpisu FIXED/VERIFIED pozostaje zachowany; blok nie spełnia progu trzech mutacji.

## 5. Pomiar zasięgu testów (§0.4a, Z24)

PRZED: 8 pełnych nazw. PO: 10 pełnych nazw. Dodane:

```text
CODEX1 — charakterystyka rozjazdu dwoch magazynow inicjatyw E2 — projekcja nie przekracza granicy organizacji
CODEX1 — charakterystyka rozjazdu dwoch magazynow inicjatyw E2 — przy kolizji zrodlem rozstrzygajacym jest kanon
```

Zniknięte: brak. Pełny diff: `codex1-artefakty/diff-nazwy.txt`.

## 6. Deklaracja Z30

**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego bloku nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. `ie_outbox_delivery_receipts` po migracji ma 0 wierszy. Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie nie zostało wysłane.”**

Dowody: `BRAK ZMIENNYCH POCZTY`; tabela `settings` dla `smtp%`: 0 wierszy; Gateway: `BRAK DRENAZY W GATEWAY`; `ie_outbox_delivery_receipts=0`.

## 7. Migracja danych — manifest

Manifest: NIE POWSTAŁ. E3 nie został uruchomiony bez kopii danych. Nie ma `--apply`, `--rollback`, `--verify` ani miarodajnego md5 dla 713 wierszy. Na pustej bazie md5 `initiatives` jest `NULL`; nie przedstawiam go jako dowodu danych stagingu.

## 8. Korekty wobec instrukcji

- Komenda E1 z `--config server/vitest.config.ts` uruchomiona z roota zebrała 0 testów (`success:false`). Próba z rootem `server` trafiła na błąd resolution `server/stream`. Pomiar wykonał root config, który jawnie obejmuje `server/src/**/__tests__`; 8/8, następnie 10/10. Nie zmieniono konfiguracji (Z18).
- Autor: „161 plików” oraz Z4: `_backup` „NIE liczysz”. Literalny wynik to 161, wynik zgodny z Z4 po odjęciu `_backup` to 159. Raport zachowuje oba mianowniki.
- Autor: „4 powierzchnie”, ale podana komenda `grep -c "await\|import"` zwraca 7 linii. Lista pokazuje 3 importy i 4 wywołania, więc interpretacja bezpieczna to 4 powierzchnie.
- Autor: kopia stagingu 713/29/699/15; mój dozwolony zasób to świeża baza 0/0. To rozbieżność źródła danych, nie obalenie pomiaru autora.
- „Podmiana bramek” kontra flaga OFF: pozostawienie literalnego fallbacku oznacza K1=50. E2 nie spełnia DoD i jest PARTIAL.

## 9. STOP-y

### STOP — E3

- Rodzaj: MERYTORYCZNY
- Powód: brak lokalnej kopii 699 rekordów, a Z28 zabrania pobrania danych zdalnych.
- Licencja, którą sprawdziłem: skrypt E3 ma pełną licencję, ale Z9/Z28 zezwalają wyłącznie na lokalny kontener.
- Dowód: lokalne SQL `0|0|0|0`; migracje 913/0.
- Co dostarczyłem ZAMIAST zmiany: pomiar pustego mianownika i niewykonanie ryzykownego apply.
- Co zrobiłbym po decyzji X: po wskazaniu lokalnego dumpa zaimportowałbym go do tego kontenera, wykonał dry-run, apply×2, rollback i verify.
- Rekomendacja dla nadzorcy: dostarczyć ścieżkę lokalnego, zanonimizowanego dumpa oraz jego SHA-256.
- Stan: NIE ZACOMMITOWANO E3.
- Czy kontynuowałem pozostałe etapy: TAK.

### ROZSTRZYGNIĘTY STOP — E4

- Rodzaj: MERYTORYCZNY
- Powód: sześć żywych ścieżek nie ma równoważnego następcy runtime-v1 zapisującego ten sam read model.
- Licencja, którą sprawdziłem: wąska licencja na dodanie komend w `initiativesExecutionRuntime.routes.ts` i nadrzędna reguła „nie wycofuj bez tego samego modelu odczytu”.
- Dowód: `e4-szesc-sciezek.txt`; callers TAK, równoważni następcy NIE.
- Co dostarczyłem ZAMIAST zmiany: tabela dowodowa sześciu ścieżek i werdykt „zostają”.
- Decyzja X: sześć pisarzy zostaje bez zmian; nie projektować następców w tym bloku.
- Rekomendacja dla nadzorcy: użyć tabeli dowodowej jako wejścia do osobnego bloku domenowego.
- Stan: brak zmiany kodu zgodnie z decyzją; rozstrzygnięcie zacommitowane wyłącznie w raporcie.
- Czy kontynuowałem pozostałe etapy: TAK.

## 10. TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano liczb 713/29/699/15 ani braków 78/104 na kopii stagingu.
- Nie zweryfikowano wydajności projekcji na 713 rekordach ani progu 300 ms.
- Nie zweryfikowano Execution, My Work, Reports i pełnego Playwright UI.
- Nie zweryfikowano rollbacku migracji, bo migracja nie powstała.
- Nie zweryfikowano wszystkich 50 bramek; trzy powierzchnie zostały podłączone, literalny mianownik pozostał 50.

## 11. DO DECYZJI WŁAŚCICIELA

- Wiersze bez `project_id` (autor: 78): zabrakło lokalnej kopii rekordów oraz decyzji, czy pominąć je trwale, czy przypisać projekt; wartości nie wolno zgadywać.
- Wiersze bez `owner_business_id` (autor: 104): zabrakło lokalnej kopii i reguły wyboru właściciela; wartości nie wolno zgadywać.
- Sześć legacy writerów: zabrakło decyzji domenowej o kształcie kanonicznych agregatów/read modeli dla milestones, resources, staffing, budget, gate roles i move.
- Zakres rollout: zabrakło decyzji, czy przełączać kolejne 47 bramek w tym samym bloku po dostarczeniu testów per powierzchnia.

## 12. ZNALEZISKA POBOCZNE

- `pmoValidation.middleware.ts:206`: bramka bez `organization_id`; plik tylko do odczytu, nie zmieniono.
- `initiative.validators.ts:70`: `status .default('DRAFT')`; przyczyna pętli autozapisu nadal w kodzie, plik nietknięty.
- Powstał drugi egzemplarz słownika statusów po stronie serwera w `initiativeUnifiedReader.ts`. Docelowo słownik powinien być kontraktem współdzielonym, ale obecna licencja zabraniała zmiany klientowego SSOT.
- Serwerowy config Vitest z obecnym runnerem nie wykonał wskazanej ścieżki zgodnie z paste-ready komendą; konfiguracji nie zmieniono.

## 13. Artefakty

Katalog: `/Users/piotrwisniewski/Developer/codex-wt/codex1-artefakty`.

- `bramki-legacy.txt` — `c691125a9b08a5a3ce168b3bd67275435a54514f7a5782e56eb99443c67a16ee`
- `pisarze-legacy.txt` — `a71a0faa95b9a4bccf69dca5579fbd05d3a2881ba238218ba8611107433dafef`
- `wolacze-src.txt` — `53e1d2c60cdaeeb6a9b5aea0e05663e049f815e97114eda427c11ffb648bb6b3`
- `e1.json` — `ca529bd14bd4b1f4c9c12db8dad831b10270c2c17e152613f915d5a783f69a93`
- `e2-off-10.json` — `8a89efa0cb7988225866130a5becc71cd9a37f08d240e9af4c191221a12292ac`
- `e2-on-10.json` — `9cbfe844c70020b28e330d1c4de65d8080553e3bea8004ef805f3cd9f4346bbf`
- `e2-mutacja-clean-red.json` — `75744dade5c633848981ac6fd557248aa67398d49d1e7f147f34388d274e8ff0`
- `e2-mutacja-clean-green.json` — `230e8681a8479a026b465e73959774d5e65a51a7d723f079a4e725152f6aa102`
- `przed-nazwy.txt` — `c4e6baa203a87a4d9321e8daceca65f5aa2cdc6d140e44cd222291be34248642`
- `po-nazwy.txt` — `a5a879c97bdf2e01f833e371aca16b06068770408be6472730bcffa7923db8c4`
- `diff-nazwy.txt` — `c6c0c53d7b115a426036eb2385754502816e4fa2b8aa273af71bd6720e38b762`
- `e4-szesc-sciezek.txt` — `283b6100b6577bffd8dce01961c670b06dc107a2a6dcb3b52c53c7f861f221dc`
- `migracje-przebieg-1.log` — `87df94b3b7fa1cf5bc3a41d24556e16926349bba9f90b0871c0d1c6c56ceed45`
- `migracje-przebieg-2.log` — `dff1dc1996fe1199865293c6659d62107052bd770bca7113b284a8f7d888ff79`
