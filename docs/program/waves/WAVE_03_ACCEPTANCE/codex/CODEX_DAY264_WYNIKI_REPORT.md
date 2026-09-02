# CODEX DAY 264 — WYNIKI

Data: 2026-09-01  
Baza: `df7f13056fa24995be07f64b0e8c877b3faeab45`  
Gałąź: `codex/day264-wyniki-mianownik-20260901`

## Streszczenie

R1–R4 wykonano w pełnym zakresie dokumentacyjnym. Obie metody mianownika odtworzyły wyniki `146` i `152`; `135` pozostaje nieodtwarzalne, a `130` jest supersedowanym pomiarem literalnym. Rekomenduję `152`, lecz nie podjąłem decyzji kanonicznej. Crosswalk/shadow read nadal mają zero wołaczy produktowych; opisałem A1, A2 i B z kosztami bez montowania. Karta modułu dostała wyłącznie nową sekcję na końcu. Demo, flagi, kod produktu, Railway i LLM pozostały nietknięte.

## Wejście i marker

Polecenie `merge-base --is-ancestor df7f13056f github-backup/codex/m03-admin-20260824`:

```text
MARKER OK
```

Sanity worktree:

```text
df7f13056fa24995be07f64b0e8c877b3faeab45
```

`git status --short | head -3` nie zwrócił żadnej linii. Tip gałęzi instrukcji był przed bazą; zgodnie z regułą rozejścia wystartowałem dokładnie z markera. Po utworzeniu worktree `df -h /` pokazało `9.5Gi` wolnego. Porty `6268`, `5248`, `5249` nie miały listenerów; `docker ps` nie wykazał konfliktu.

## Bezpieczeństwo bazy i poczty

Uruchomiono wyłącznie `cx-day264-pg`, obraz `pgvector/pgvector:pg16`, baza `cx264`, bind `127.0.0.1:6268`. Pierwszy przebieg pełnych migracji: `Applying migrations: 880`, `✅ Postgres migrations complete`; drugi: `Applying migrations: 0`, `✅ Postgres migrations complete`.

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
```

Grep drenaży w `server/src/Gateway.ts` był pusty. **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## R1 — osiem pomiarów wejściowych

1. Statyczny mianownik:

```text
direct=130 defs=6 calls=22 result=146
```

2. Pełna komenda runtime została przepisana z `CODEX_DAY234_WYNIKI_REPORT.md:73-75` i uruchomiona z `NODE_ENV=test RUN_DB_TESTS=0 MOCK_DB=true npx tsx -e ...`; wynik:

```text
RUNTIME_MUTATOR_REGISTRATIONS=152 UNIQUE_GATEWAY_METHOD_PATHS=152 DUPLICATES=0
```

Komenda importowała 12 plików routerów, budowała 13 par prefiks + router zgodnie z montażem Gateway, iterowała `router.stack`, rozwijała `layer.route.methods` i liczyła `new Set(method + fullPath)`.

3. `tests/integration/results/day46.mutator-tenant-isolation.realpg.test.ts:10-18` zawiera wyłącznie opis wcześniejszego `135`, bez komendy odtwarzającej; `135` pozostaje wycofane.
4. `grep -rn "kpiCrosswalkService\|kpiShadowReadService" server/src/ src/ | grep -v '__tests__\|kpiCrosswalkService.ts\|kpiShadowReadService.ts'` był pusty: zero wołaczy produktowych.
5. Grep `VITE_DEMO_ACCEPTANCE` w karcie modułu przed zmianą był pusty.
6. `git merge-base --is-ancestor 3c3a51406f df7f13056f` dał `ANCESTOR OK`; licencjonowany pakiet przeszedł z `--retry=0` i zawiera pełny przypadek `DEMO_ACCEPTANCE profile centrally enables all Results VNext domains`.
7. `resultsVNextFeatureFlags.test.ts` ma `13` przypadków, a grep `VITE_DEMO_ACCEPTANCE|isDemoAcceptanceProfileEnabled` był pusty.
8. Ponowny `df -h /` pokazał `9.5Gi` wolnego.

Wniosek rozbieżności: **pokrycie już istnieje w `demoAcceptanceFlags.test.ts`, zadanie 2 z `SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md` jest zrobione i nieopisane**. Przypadek ustawia źródło `{ env: { VITE_DEMO_ACCEPTANCE: 'true' }, hostname: 'demo.consultify.ai' }` i asertuje `true` dla `kpiRegistry`, `roiRegistry`, `okrRegistry`. Nie utworzyłem duplikatu testu.

## R2a — rekomendacja mianownika

`146` tanio liczy rozpoznane tekstowo rejestracje po odjęciu sześciu definicji helperów i dodaniu 22 wywołań, ale pozostaje analizą statyczną. `152` uruchamia moduły i liczy unikalne mutujące pary metoda + pełna ścieżka z faktycznie zbudowanych stosów routerów wraz z prefiksami Gateway. **Rekomendacja audytora: `152`, uzasadnienie: najlepiej odpowiada pytaniu, ile unikalnych mutujących par metoda + pełna ścieżka faktycznie zarejestrowały routery montowane przez Gateway. Decyzja kanoniczna należy do nadzorcy.**

## R2b — warianty crosswalk/backfill

| Wariant | Zakres | Koszt / ryzyko | Rekomendacja — NIE decyzja |
|---|---|---|---|
| A1 | Akcja `OWNER`/`ADMIN` na karcie inicjatywy; tylko jawne pary `sourceId` + `canonicalKpiId`, istniejące gates, tenant scope, idempotency key, audyt aktora, requested/inserted/rejected, niezależny readback i shadow comparison. | Średni: endpoint + UI, usługi już istnieją. | Preferowany przy decyzji o montażu. |
| A2 | Ręczny job `OWNER` z tym samym kontraktem bezpieczeństwa. | Niższy; gorsza widoczność kontekstu. | Etap przejściowy, jeśli UI blokuje A1. |
| B | Nie montować; oznaczyć `KNOWN_DECISION / NOT_MOUNTED_BY_DESIGN` z datą i uzasadnieniem. | Zero; bez oznaczenia wróci jako sierota. | Poprawny wyłącznie po jawnej decyzji właściciela. |

Nie zamontowałem żadnego wariantu i nie wybrałem za właściciela.

## R3 — karta modułu

Do `MODULE_ACCEPTANCE.md` dopisano wyłącznie sekcję `Dzień 264`: rekomendację `152`, warianty A1/A2/B, kontekst demo oraz rozstrzygnięcie pokrycia. Istniejącej sekcji dnia 234 nie zmieniono. Karta podaje oba wymagane konteksty razem: goły kod bez zmiennej — `24/33` nieosiągalne; realne demo — `0/33` nieosiągalne. `VITE_DEMO_ACCEPTANCE` i demo pozostały nietknięte (`DEC-2026-08-28-227`).

## Zasięg testów po pełnych nazwach

Pakiet przed i po zmianie dokumentacji:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/utils/__tests__/demoAcceptanceFlags.test.ts src/components/ResultsVNext/__tests__/resultsVNextFeatureFlags.test.ts --retry=0 --reporter=json --outputFile=<artefakt>
```

Reporter JSON zawiera 17 pełnych `fullName`; wszystkie przeszły. `diff przed-nazwy.txt po-nazwy.txt` był pusty (`exit 0`): zero nazw dodanych i zero znikniętych. Pełne nazwy są w artefaktach, nie w repo.

Pułapki Z33: (a) V8, (b) Results beta visibility, (c) DB type i (d) auth bypass nie leżą na ścieżce tych czystych testów jednostkowych flag; komenda biegła jawnie z `RUN_DB_TESTS=0 MOCK_DB=true` i nie stanowi dowodu egzekucji DB/HTTP. Pułapka (e) dotyczy bezpośrednio: test podaje `VITE_DEMO_ACCEPTANCE=true`, sprawdza wszystkie trzy domeny Results, a raport i karta zawsze rozdzielają goły kod od realnego demo. Nie formułuję twierdzenia o ścieżce HTTP.

## Artefakty i SHA-256

```text
822ce78288f57c6194af365e43e6073d3f48b8e2ce898b786995b8073c69010e  /private/tmp/cx-day264-wyniki-mianownik-artefakty/przed-nazwy.txt
054fa361446c6a50a63b4ccee6c943ea51d9fe73b7c3c77be97d1f452b3b8a53  /private/tmp/cx-day264-wyniki-mianownik-artefakty/przed.json
822ce78288f57c6194af365e43e6073d3f48b8e2ce898b786995b8073c69010e  /private/tmp/cx-day264-wyniki-mianownik-artefakty/po-nazwy.txt
2dabc889577e79d6712144223dfc87a301ec46c05ea352495ca6c9d1626c75e6  /private/tmp/cx-day264-wyniki-mianownik-artefakty/po.json
```

## Korekty wobec instrukcji

- Oczekiwane wyniki autora potwierdzono. Zdanie ze `SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md` o zerowym pokryciu było niedoprecyzowane: w wąskim pliku 13 testów pokrycia nie ma, ale istnieje i przechodzi ono w `demoAcceptanceFlags.test.ts`. To wynik pomiaru, nie powód STOP.
- Komenda runtime po wypisaniu prawidłowego `152/152/0` załadowała moduł emitujący log `DATABASE_URL: NOT SET`; biegła jednak jawnie z `RUN_DB_TESTS=0 MOCK_DB=true`, nie wykonała połączenia ani mutacji i służyła wyłącznie introspekcji stosów routerów.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie weryfikowałem bieżącego stanu realnego demo, Railway ani konfiguracji produkcyjnej; są kontekstem decyzji właściciela z instrukcji i zostały celowo nietknięte zgodnie z `Z8`/`Z28`.
- Nie dowodziłem ścieżki ApiGateway/JWT/Postgres dla crosswalk, ponieważ instrukcja wymagała wyłącznie potwierdzenia braku wołaczy i materiału decyzyjnego, a montaż był zakazany.

## Zakres zmian

Wyłącznie:

- `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md`
- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY264_WYNIKI_REPORT.md`

Nie zmieniono kodu produktu, testów, konfiguracji, flag, bramek ani infrastruktury.
