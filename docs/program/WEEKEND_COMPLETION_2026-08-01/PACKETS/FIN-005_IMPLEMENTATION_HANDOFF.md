---
doc_id: FIN-005-implementation-handoff
truth_type: operations
status: READY_FOR_CODEX_REVIEW
owner: claude
process_owner: codex
product_owner: piotr
packet: FIN-005
branch: fix/fin-005-atelier-coherence
base_commit: c522a861839f54d0f26baa918566589aab3f6f6b
last_reviewed: 2026-08-01
---

# FIN-005 — implementation handoff

Produkt: Consultify. Target odbioru: Railway project `consultify`, environment
`demo`, `https://demo.consultify.ai`, PostgreSQL `demo`. **Localhost nie jest
evidence odbiorowym.** Nie wykonano deployu, migracji ani żadnej mutacji
stagingu. Gałąź nie została scalona ani wypchnięta.

## 1. Rezultat

Finance opowiada jedno golden flow Atelier Toys:
`statement (FY2014 pack) → analysis (APPROVED) → model (Transformation 2015 ROI)`,
jedna waluta, jeden okres, realne klucze obce między ogniwami.

| Problem z próby stagingowej | Stan |
| --- | --- |
| surowa data `Thu Dec 31 2026 …` w kolumnie PERIOD | naprawione u źródła + repair legacy przy odczycie |
| jedyny approved statement = `DBR77 Manufacturing` | zmaterializowany kanoniczny statement Atelier FY2014 (P&L+BS+CF) |
| analiza = `DBR77 Staging Financial Analysis` | zmaterializowana zatwierdzona analiza Atelier, wysiana z tego samego pakietu |
| model bez źródła | `source_statement_pack_id` → pakiet FY2014 |
| 4 duplikaty `(kopia)` | zamknięta przyczyna w UI + test |
| `Value engine temporarily unavailable` | przyczyna udowodniona; **BLOKER poza granicą pakietu** + jawny stan w UI |
| obce rekordy DBR77/Apator w tenancie demo | polityka + skrypt dry-run/rollback, **nie uruchomiony** |
| demo read-only guard | bez regresji (potwierdzone testem, nie dotknięty) |

## 2. Root cause per problem

### 2.1 Surowa data w kolumnie PERIOD

`financial_statements.period_end` / `financial_statement_packs.period_end` to
kolumny Postgres `DATE`. W repo **nie ma zarejestrowanego type parsera**
(`grep setTypeParser server/src` → zero trafień), więc node-pg zwraca obiekt JS
`Date`. `packPeriodLabel()` w `financialStatementPackService.ts` robiło:

```
normalizeText(period_label) || normalizeText(period_end)   // = String(Date)
```

Na Railway (`TZ=UTC`) `String(date)` to dokładnie
`Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time)`. Wartość była
**zapisywana** do `period_label`, a potem wyświetlana. Istniejący od 07-27
frontendowy `sanitizeStatementTitle` był plastrem na wyświetlaniu — nie mógł
zatrzymać zapisu i nie pokrywał wszystkich powierzchni.

**Druga pułapka, wykryta dopiero na realnym Postgresie:** node-pg parsuje `DATE`
na **lokalną** północ. Pierwsza wersja serializera czytała każdą datę getterami
UTC — pakiet zasiany jako `2014-12-31` odczytywał się jako `2014-12-30` na
hoście `Europe/Warsaw`. Serializer rozróżnia teraz dokładną lokalną północ
(kolumna `DATE`) od instantu (czytany jako UTC).

### 2.2 Brak statementu i analizy Atelier

`demoSeedService` seedował model ROI, ale **żadnego** sprawozdania i żadnej
analizy — mimo że run-sheet obiecuje model „grounded on a confirmed FY2014 P&L”.
Finance pokazywał więc jedyne rekordy, jakie w tenancie były: cudze.

### 2.3 Cztery duplikaty `(kopia)`

Nie defekt bazy. `useFinanceRowActions.handleDuplicate` budowało tytuł jako
``${row.title} (${copySuffix})`` **z tego samego wiersza źródłowego**, a
`finance.preview.copySuffix` w PL = `kopia`. Cztery kliknięcia „Duplikuj” dały
cztery bajtowo identyczne nazwy. Test odtwarza te cztery kliknięcia.

### 2.4 `Value engine temporarily unavailable`

`ValueOfficePanel` woła `POST /api/v8/finance/value/value-bridge` i
`POST /api/v8/finance/value/portfolio/prioritize`. Obie trasy są **czystym
obliczeniem** (`financeValueRoutes.ts` deklaruje to w nagłówku, handlery nie
dotykają bazy). Ale są POST-ami, a `demoWriteProtection` (Gateway.ts:423,
allowlist `['/api/demo/', '/api/auth/']`) odrzuca w trybie demo każde żądanie
spoza GET/HEAD/OPTIONS z `403 DEMO_READ_ONLY`.

**Silnik jest zdrowy — bramka read-only klasyfikuje kalkulację jako zapis.**
Dowód wykonywalny: `server/src/routes/v8/__tests__/financeValueRoutes.demoGuard.test.ts`
(te same wywołania poza trybem demo zwracają 200 z realnym wynikiem).

### 2.5 Obce rekordy DBR77 / Apator / techniczne seedy

**Nie da się ich odtworzyć z kodu na `c522a861`.** `seed-finance-surface.ts` ma
zaszyte `ORG_ID = 'dbr77'`, `reset-and-seed-finance-demo.ts` seeduje
`Fabryka Alfa` / `Nova Energia`, a stringa `DBR77 Staging` nie emituje żaden
plik w repo. Sufiks `(kopia)` pochodzi z akcji „Duplikuj” w UI. Wniosek: rekordy
utworzył operator (UI albo skrypt spoza repo) wprost w tenancie demo podczas
wcześniejszych prób Finance. Dlatego skrypt czyszczący **niczego nie zakłada** —
raportuje stan faktyczny do akceptacji człowieka.

## 3. Mapa route → service → table

| Powierzchnia UI | Route | Service | Tabela |
| --- | --- | --- | --- |
| Statements (lista) | `GET /api/v8/finance/statement-packs`, `GET /api/finance-statements/packs` | `listStatementPacks` | `financial_statement_packs` (+ `financial_statements`) |
| Statements (detal) | `GET /api/v8/finance/statement-packs/:id`, `GET /api/finance-statements/:id` | `getStatementPackDetail`, route inline | `financial_statements`, `financial_statement_values` |
| Analysis | `GET /api/v8/finance/analyses` | `listAnalyses` | `financial_analyses` |
| Models (lista) | `GET /api/v8/finance/models`, `GET /api/financial-modeling/models` | `listModels` | `financial_models` |
| Models (detal) | `GET /api/v8/finance/models/:id` | `getModel` + inline | `financial_models`, `financial_model_events`, `financial_statements`, `financial_statement_packs` |
| Value engine | `POST /api/v8/finance/value/*` | `valueBridgeService`, `portfolioPrioritizationService` | brak (czyste obliczenie) |
| Spine ROI (Initiatives/Results) | — | `upsertAtelierRoiFinancialModel` | `digitization_analyses`, `analysis_financials` |

Uwaga: `financial_analyses` (v8, czytana przez zakładkę Analysis) i
`digitization_analyses` (legacy, handoff NPV do spine) to **dwa równoległe
rejestry**. Oba zostały zachowane i oba wskazują teraz tę samą historię.

## 4. Commity (gałąź `fix/fin-005-atelier-coherence`)

| SHA | Zakres |
| --- | --- |
| `c86a2682e3` | serializer okresu Finance + granice odczytu + tenant guard w `getStatementPackDetail` |
| `72d4a2e214` | kanoniczny seed Atelier FY2014 (pakiet + 3 sprawozdania + analiza), model związany z pakietem, PLN→EUR |
| `577d28eb5a` | zamknięcie przyczyny duplikatów + trzy zaszyte PLN na ścieżce investment case |
| `001ced2744` | diagnoza value engine + jawny stan w UI + i18n |
| `9e96fc1fb9` | polityka spójności + skrypt dry-run/rollback |
| `061f079a15` | dokładny kontrakt kanonicznych ID (wspólny dla seeda i kwarantanny) |
| `b0f10179f0` | READY zdobywane dwufazowo: zapis → read-back → promocja |
| `80f2a2d1a0` | jawny `INCOMPLETE` zamiast cichej degradacji |
| `1c7762e219` | testy: zero fałszywego READY, odmowa promocji, no-op drugiego przebiegu |
| `7645d1cd65` | hardening kwarantanny + trwały rollback |
| `d73bfc58d5` | stale closure waluty w `CreateValuationModal` |
| `cbe5cad1e3` | audytowana propozycja allowlisty dla bezstanowego value engine |
| `74995e8159` | `FIN-006` — packet-bloker (waluta międzymodułowa + bramka value engine) |

## 5. Testy — wykonane i wyniki

| Zestaw | Wynik |
| --- | --- |
| `server/src/services/__tests__/financePeriodFormat.test.ts` | **23/23 PASS** (ISO string, rok, null, legacy date string, `DATE` z node-pg) |
| `server/src/services/demo/__tests__/atelierFinanceCoherence.test.ts` | **20/20 PASS** |
| `server/src/services/demo/__tests__/atelierSeedIdempotency.test.ts` | **3/3 PASS** |
| `server/src/services/demo/__tests__/atelierSpineCoherence.test.ts` | **13/13 PASS** |
| `server/src/services/demo/__tests__/financeDemoCoherencePolicy.test.ts` | **13/13 PASS** |
| `server/src/routes/v8/__tests__/financeValueRoutes.demoGuard.test.ts` | **5 PASS / 1 skipped** (skip = asercja po-naprawie bramki) |
| `src/components/Economics/__tests__/uniqueCopyTitle.test.ts` | **7/7 PASS** |
| `tests/components/ValueOfficePanel.test.tsx` + `Finance/ValueOfficePanelM16` | **8/8 PASS** |
| Backend celowany (Finance routes/services, 11 plików) | **157 PASS / 1 skipped** |
| Frontend celowany (20 plików) | **103 PASS**, 6 fail w `FinanceHub.v8-runtime-strip` — **pre-existing** |
| Sweep regresyjny (73 pliki) | **649 PASS / 47 FAIL**, wszystkie 47 w 7 plikach reprodukują się **bajtowo identycznie na `c522a861`** |

**Zero testów zepsutych przez tę zmianę.**

Pliki czerwone przed zmianą i po zmianie tak samo: `cross-org-idor`,
`v8/finance.routes`, `FinanceHub.v8-runtime-strip`, `DriverPlannerPanelM16`,
`ValuationVisualsPanelM16`, `hubs.smoke`, `helpTranslations`.

### 5.1 Real SQL round-trip — evidence deweloperskie, NIE odbiorowe

Uruchomione na **lokalnym** PostgreSQL z pełnym zestawem migracji z repo
(`server/scripts/migrate.postgres.ts`), przez realne funkcje produkcyjne
(`seedAtelierToysDemoDataset`, `listStatementPacks`, `getStatementPackDetail`):

```
PASS  seed uruchomiony dwa razy nie zwiększa żadnego licznika Finance
PASS  kształt fixture: 1 pakiet / 3 sprawozdania / 1 analiza / 1 model
PASS  round-trip statement -> analysis -> model, jedna waluta (EUR)
PASS  27 wartości, zero unmapped, FK do rejestru kanonicznego rozwiązane
PASS  granica odczytu: FY2014 / 2014-01-01 / 2014-12-31 — zero obiektów Date
PASS  wszystkie trzy sprawozdania odczytują się READY, zero unmapped
```

Zgodnie z `ENVIRONMENT_AND_NAMING_AUTHORITY.md` **to nie jest evidence
odbiorowe** — `GO` wymaga wykonania na `demo.consultify.ai` i read-backu z
PostgreSQL environment `demo`. Ten przebieg wykrył dwa realne defekty (patrz
§2.1 i §7), których mock by nie pokazał.

### 5.2 Testy niewykonane

- staging E2E na `demo.consultify.ai` — wymaga polecenia Codex (§9);
- `tests/acceptance/*` — wymagają zasianej bazy `consultinity_test`;
- Playwright `tests/e2e/**` — wymaga żywego serwera;
- pełny `npm run test:all` — nie uruchamiany, sweep celowany opisany wyżej.

## 6. Bramki

| Bramka | Wynik |
| --- | --- |
| targeted unit/integration tests | **PASS** (§5) |
| real SQL round-trip statement→analysis→model | **PASS lokalnie** (§5.1), do powtórzenia na `demo` |
| seed 2× nie zwiększa liczby rekordów | **PASS** (SQL + test idempotencji) |
| brak obcych aktywnych rekordów w kanonicznym fixture | **PASS** (test spójności) |
| date serialization tests | **PASS** 23/23 |
| `tsc --noEmit` backend | **216 błędów przed = 216 po, diff pusty** — zero nowych |
| `tsc --noEmit` frontend | **0 błędów** |
| `npm run build:backend` | **PASS** |
| `git diff --check` | **PASS** |
| demo read-only guard bez regresji | **PASS** — `demoGuard.middleware.ts` i `Gateway.ts` nietknięte, test przypina 403 |

`server/package.json` `build` = `tsc --noCheck`, więc build nie sprawdza typów —
stąd osobny pomiar `tsc --noEmit` z porównaniem do baseline.

## 7. Znane ryzyka i dług

1. **★ Waluta w Initiatives/Execution — osobny pakiet: `FIN-006`.**
   **KOREKTA wcześniejszego zapisu w tym dokumencie:** napisałem, że inicjatywy
   Atelier nie mają `budget_currency`. To było nieprawdziwe. Migracja
   `564_execution_delay_budget_t041_t042.sql:139` zakłada kolumnę z
   `DEFAULT 'PLN'`, a seed jej nie zapisuje — więc **PLN jest utrwalone w bazie**,
   nie „brakujące". Zmienia to naprawę: zasiane wiersze wymagają `UPDATE`, nie
   tylko poprawki seeda. Sprawdzone bezpośrednio w migracji i w seedzie.
   Powierzchnie renderujące twarde `PLN`: `InitiativeCompactPanel.tsx:901` (żywa;
   `:1335`/`:1341` są martwe dla realnych rekordów), `ExecutionHub.tsx:5496`,
   `ExecutionSummaryOneLook.tsx:211` oraz `ResourcesSection.tsx` — w tym `:519`,
   gdzie PLN jest instrukcją w prompcie do LLM. Po tej zmianie **ten sam program
   czyta EUR w Finance i PLN w Initiatives/Execution**. Szczegóły i opcje
   naprawy: `FIN-006_CROSS_MODULE_CURRENCY_AND_VALUE_ENGINE.md`.
2. **Domyślna waluta org.** `valuationService.ts:207` zwraca `PLN`, gdy brak
   `organization_settings.finance`, a seed demo tego wiersza nie pisze. Zapis
   należy do globalnej orkiestracji demo — poza granicą pakietu.
3. **Narracja w module seeda.** Nazwy i opisy Atelier siedzą w
   `atelierFinanceSeed.ts`; reguła 4.1 mapy rollout mówi, że kanoniczna narracja
   mieszka w `atelierToysDemoTemplate.ts`. Liczby i persystencja są na miejscu —
   przeniesienie samych stringów proponuję jako osobny, mechaniczny krok.
4. **Skrypt czyszczący tworzy wiersz `organizations`.** Kwarantanna wymaga celu
   FK. Wiersz jest nieaktywny, typu `DEMO`, bez użytkowników i bez członkostw —
   nikomu nie daje dostępu — ale pojawi się w listach super-admina do czasu
   usunięcia. Skrypt mówi to wprost przed zapisem.
5. **Duplikaty na stagingu nadal istnieją.** Naprawa zamyka przyczynę; cztery
   istniejące wiersze usuwa dopiero kwarantanna z §8.

## 8. Dry-run cleanup, walidacja, rollback

**Nic z tego nie zostało uruchomione.** Kolejność jest obowiązkowa: seed
kanoniczny MUSI wejść przed kwarantanną, inaczej Finance zostanie puste.

```bash
DATABASE_URL="<demo>" npx tsx server/scripts/finance-demo-coherence-cleanup.ts --demo-org-id "<DEMO_ORG_ID>"
```

Dry-run jest domyślny i wyłącznie czytający. Produkuje raport
`server/exports/fin005-finance-demo-dry-run-*.md` z podziałem na wiersze
kanoniczne (zostają) i obce (kandydaci), z flagami nazw.

Zapis po akceptacji listy:

```bash
DATABASE_URL="<demo>" FINANCE_DEMO_CLEANUP_CONFIRM=QUARANTINE_FOREIGN_FINANCE npx tsx server/scripts/finance-demo-coherence-cleanup.ts --demo-org-id "<DEMO_ORG_ID>" --write
```

Rollback z manifestu zapisanego przez `--write`:

```bash
DATABASE_URL="<demo>" FINANCE_DEMO_CLEANUP_CONFIRM=QUARANTINE_FOREIGN_FINANCE npx tsx server/scripts/finance-demo-coherence-cleanup.ts --rollback server/exports/fin005-finance-demo-manifest-<stamp>.json
```

Zapytania walidacyjne (przed i po):

```sql
SELECT 'financial_statement_packs' AS t, COUNT(*) AS rows_in_demo,
       COUNT(*) FILTER (WHERE id LIKE '<DEMO_ORG_ID>--%') AS canonical
  FROM financial_statement_packs WHERE organization_id = '<DEMO_ORG_ID>'
UNION ALL SELECT 'financial_statements', COUNT(*), COUNT(*) FILTER (WHERE id LIKE '<DEMO_ORG_ID>--%')
  FROM financial_statements WHERE organization_id = '<DEMO_ORG_ID>'
UNION ALL SELECT 'financial_analyses', COUNT(*), COUNT(*) FILTER (WHERE id LIKE '<DEMO_ORG_ID>--%')
  FROM financial_analyses WHERE organization_id = '<DEMO_ORG_ID>'
UNION ALL SELECT 'financial_models', COUNT(*), COUNT(*) FILTER (WHERE id LIKE '<DEMO_ORG_ID>--%')
  FROM financial_models WHERE organization_id = '<DEMO_ORG_ID>';

-- golden flow musi zwrócić DOKŁADNIE jeden wiersz
SELECT p.entity_name, p.period_label, p.currency, p.pack_readiness_status,
       a.title, a.status, m.name, m.currency, m.status
  FROM financial_statement_packs p
  JOIN financial_analyses a ON a.source_statement_pack_id = p.id
  JOIN financial_models   m ON m.source_statement_pack_id = p.id
 WHERE p.organization_id = '<DEMO_ORG_ID>';

-- zero surowych dat w utrwalonych etykietach
SELECT id, period_label FROM financial_statement_packs
 WHERE organization_id = '<DEMO_ORG_ID>' AND period_label ~ '^[A-Z][a-z]{2} [A-Z][a-z]{2} ';
```

Rollback kodu: `git revert` commitów z §4 w odwrotnej kolejności. Brak migracji,
brak flag, brak zmian konfiguracji — nie ma nic poza kodem do cofnięcia.

## 9. Instrukcja materializacji i staging acceptance dla Codex

1. **Deploy gałęzi na `demo`** (decyzja Codex; ja nie wykonuję deployu).
2. **Materializacja seeda** — kanoniczny seed jest idempotentny i addytywny;
   uruchomienie go na tenancie demo tworzy pakiet FY2014, trzy sprawozdania,
   analizę i wiąże model. Wejście: `seedAtelierToysDemoDataset({ organizationId: <DEMO_ORG_ID> })`
   przez istniejącą ścieżkę demo. Drugi przebieg nie zwiększa liczników.
3. **Read-back SQL** — zapytania z §8. Golden flow: dokładnie 1 wiersz, waluta
   `EUR`, `pack_readiness_status='ready'`, `a.status='APPROVED'`,
   `m.status='approved'`.
4. **Dry-run kwarantanny** — §8. Przejrzeć listę obcych rekordów. Dopiero po
   akceptacji `--write`.
5. **Odbiór wzrokiem w UI** (Finance → Statements / Analysis / Models):
   - PERIOD pokazuje `FY2014`, nigdzie `Thu Dec 31 …`;
   - Statements: jeden pakiet `Atelier Toys`, READY, P&L/BS/CF komplet;
   - Analysis: `Atelier Toys — FY2014 Baseline Financial Analysis`, APPROVED;
   - Models: `Atelier Toys — Transformation 2015 ROI`, źródło = pakiet FY2014,
     zero `(kopia)`, zero DBR77/Apator;
   - Value Office: jawny komunikat „not available in demo mode”, bez sugestii
     wykonanej kalkulacji;
   - próba zapisu nadal daje `Demo mode is read-only`.
6. **Werdykt** `GO / FIX / NO-GO`.

## 10. Do decyzji Piotra

**NEEDS_PRODUCT_DECISION — waluta golden flow Atelier: PLN → EUR.**

Przyjąłem EUR i zaznaczam to jawnie, bo to zmiana liczby biznesowej na ekranie.

- Cała reszta narracji Atelier jest w euro: `Digital ARR EUR 6.2M → 8M` w
  faktach z wywiadów, jednostka KPI `EUR M`, budżety inicjatyw w tym samym
  rzędzie wielkości. Run-sheet demo używa `€`.
- `PLN` w modelu ROI było domyślną walutą aplikacji, a nie decyzją — francuski
  producent zabawek raportujący w złotych obok KPI w euro to dokładnie ta
  niespójność, którą FIN-005 każe usunąć.
- **Ekonomia modelu bez zmian**: 2,4 mln wzrostu przychodu rocznie, 0,8 mln
  capex, 0,4 mln redukcji OpEx, NPV 1,82 mln, ROI 218%, zwrot 14 miesięcy.
  Zmienia się wyłącznie etykieta waluty.
- Jeśli Piotr chce PLN, zmiana to jedna stała
  (`ATELIER_FINANCE_CURRENCY` w `atelierFinanceSeed.ts`) — ale wtedy trzeba
  przewalutować warstwę KPI/narracji, co jest poza tym pakietem.

**Powiązana decyzja (ryzyko §7.1):** Initiatives/Execution nadal renderują
twarde `PLN`. Bez osobnego pakietu ten sam program pokaże klientowi dwie waluty.

## 11. Runda druga — po review kodu i data-ops (2026-08-01)

Recenzja zwróciła osiem punktów P1/P2. Wszystkie wykonane. Kluczowe: **dwa
defekty w moim własnym kodzie były reprodukowalne na realnym PostgreSQL i miały
zieloną bramkę testów z mockiem**. Zbudowałem dwie lokalne bazy z pełnym
zestawem migracji — jedną kompletną, drugą z usuniętymi kolumnami
`readiness_status`/`readiness_score` (dokładnie ten drift, dla którego istnieje
migracja `20260628_finance_seed_readiness_fix.sql`) — i zmierzyłem przed/po.

| Bramka | Przed (`061f079a15`) | Po |
| --- | --- | --- |
| B — drugi przebieg byte-identical | **RED**: `updated_at` zmieniało się w `financial_statement_packs`, `financial_statements`, `financial_analyses`, `financial_statement_values` | **GREEN**: wszystkie 5 tabel bez zmian bajt w bajt |
| C — zero fałszywego READY przy drifcie | **RED**: seed zgłaszał SUKCES, 1 pakiet `pack_readiness_status='ready'`, 3 sprawozdania `confirmed/pass` | **GREEN**: seed zwraca `INCOMPLETE`, **zero wierszy zapisanych** |
| A — round-trip na pełnym schemacie | GREEN | GREEN |

### 11.1 READY zdobywane, nie deklarowane (P1)

Seed pisze w **dwóch fazach**. Faza 1: pakiet `draft`/`pending`, sprawozdania
`imported`/`pending`/`readiness_score=0`, analiza `DRAFT`, plus wartości.
Faza 2: **odczyt wierszy z bazy** i dopiero wtedy promocja — per sprawozdanie
sprawdzana jest dokładna oczekiwana liczba wartości kanonicznych, 100% niepustych
`canonical_line_id`, jedna waluta i lineage (`statement_pack_id` = kanoniczny
pakiet, `organization_id` = tenant wywołujący). Werdykt jest **przeliczany
funkcjami produkcyjnymi** `validateStatement` / `evaluateStatementReadiness` na
odczytanych wierszach; bez zgody produkcji nie ma promocji. Pakiet awansuje
dopiero, gdy wszystkie trzy sprawozdania awansowały i analiza wskazuje na pakiet.
Kolumny promocyjne są wyłączone z `DO UPDATE` fazy 1, więc re-run nie degraduje
zdrowego fixture'u.

### 11.2 Brak tabeli/kolumny = jawny INCOMPLETE (P1)

`REQUIRED_SCHEMA` jest sondowany na wejściu. Brak czegokolwiek → zwrot
`{ status: 'incomplete', missing: [...] }` z `logger.warn` i **zerem zapisów**;
`demoSeedService` wystawia to w wyniku seeda. Ścieżki `continue`/pusty wynik
zniknęły. Decyzja udokumentowana w kodzie: INCOMPLETE zamiast wyjątku, bo seed
działa wewnątrz `seedAtelierToysDemoDataset` i wyjątek wywaliłby wszystkie
pozostałe moduły datasetu demo.

### 11.3 Prawdziwa idempotencja (P2)

Każdy upsert emituje `ON CONFLICT(id) DO UPDATE SET … WHERE <tabela>.kol IS
DISTINCT FROM excluded.kol OR …`. Przebieg bez zmiany wejścia nie aktualizuje
żadnego wiersza — potwierdzone porównaniem pełnych snapshotów wierszy
(z `updated_at`) na realnej bazie.

### 11.4 Kanoniczna własność przez dokładną whitelistę (P1)

`startsWith('<org>--')` usunięte. `getAtelierFinanceCanonicalIds(orgId)` zwraca
dokładny zbiór ID per tabela (pakiet, 3 sprawozdania, 3 ingest runy, 27 wartości,
analiza, model); czyta go zarówno seed, jak i skrypt czyszczący, więc nie mogą się
rozjechać. Testy dowodzą, że stare fixture'y techniczne **z kanonicznym
prefiksem** (`--financial-model--m16-seed`, `--statement--staging-probe`,
`--analysis--fixture-01`) są klasyfikowane jako OBCE. Prefiks trafia do raportu
jako `legacy_prefixed`, nigdy jako ochrona.

### 11.5 Bramka środowiska (P1)

Twarda allowlista fingerprintu (`project/environment/service/host/port/database/org`).
Każde pole musi być zadeklarowane jawnie — brak defaultów. Denylista produkcji
działa **przed** allowlistą i odmawia niezależnie od tego, jakie organizacje tam
istnieją. `--force-org` **usunięty**; jego użycie to twardy błąd z uzasadnieniem.

Zweryfikowane przeze mnie z linii poleceń, nie na słowo agenta:

| Próba | Wynik |
| --- | --- |
| `--force-org` | odmowa: flaga usunięta, sprawa out-of-band ma własny pakiet |
| cel niezadeklarowany | odmowa przed utworzeniem połączenia |
| pełna deklaracja produkcji (`centerbeam`, env `production`) | odmowa: „never runs against production, regardless of which organizations exist there” |
| host demo, ale zadeklarowane `staging` | odmowa: cel spoza allowlisty |

⚠ Nazwa serwisu Railway i nazwa bazy w allowliście są przepisane z dokumentacji,
**niepotwierdzone na żywym połączeniu** (ta gałąź nie może dotykać Railway).
Tryb awarii jest bezpieczny w obie strony: zła wartość powoduje ODMOWĘ, nigdy
uruchomienie w niezatwierdzonym miejscu. Codex musi potwierdzić dokładne wartości
przed pierwszym żywym uruchomieniem.

### 11.6 Kwarantanna i trwały rollback (P1/P2)

Organizacja kwarantanny jest **per-run**. Reuse istniejącej wymaga dokładnie:
nieaktywna, `organization_type='DEMO'`, marker runu w nazwie, **zero users i zero
`organization_members`** — inaczej fail closed. Przeniesienie do dowolnego tenanta
klienta jest niemożliwe (osobny test).

`--write` najpierw czyta z bazy dokładny kanoniczny fixture (1 pakiet /
3 sprawozdania / pełny zbiór wartości / 1 analiza / 1 model) wraz z lineage
i odmawia, gdy czegokolwiek brakuje — kwarantanna przed seedem zostawiłaby
Finance puste.

Trwałość: pełny prior state pobierany `SELECT … FOR UPDATE`, podpisany manifest
zapisywany do pliku tymczasowego, `fsync`, atomowy `rename` — **przed `COMMIT`**.
Fault injection zabija proces po `COMMIT`, przed finalnym zapisem manifestu;
osobny test odtwarza bazę z manifestu `PREPARED`. Rollback weryfikuje sumę
kontrolną, fingerprint każdego wiersza i własność pakietu, i odmawia, gdy rekord
zmienił się po kwarantannie. Postconditions cross-org (`statement→pack`,
`value→statement`, `ingest→statement`, `analysis→pack/statements`,
`model→pack/analysis`) biegną przed `COMMIT` i po rollbacku; niespójność =
`ROLLBACK`.

**Nie zrobione świadomie:** brak trwałej tabeli audit/outbox w bazie — wymagałaby
migracji, która jest poza granicą pakietu. Proponowany DDL jest zapisany w
skrypcie jako `DURABLE_AUDIT_TABLE_PROPOSAL` z adnotacją „NEEDS MIGRATION”.
Dziś trwałość opiera się wyłącznie na zfsyncowanym manifeście.

### 11.7 Waluta — stale closure (P2)

EUR dla całego Atelier Toys jest zatwierdzone, więc to już nie jest decyzja.
Realny defekt: `CreateValuationModal` czytał walutę źródła wewnątrz
`useCallback`, którego lista zależności pomijała `sources`. Ścieżka, która
naprawdę pękała, to modal otwarty **z góry zaseedowany**
(`FinanceHub.tsx:3611`, „zrób wycenę z TEGO modelu”): nic w liście zależności nie
zmienia się między montowaniem a wysłaniem, więc przeżywał callback z pierwszego
renderu, `find()` działał na pustych tablicach i payload cicho wracał do `PLN`.
Lookup przeniesiony do zakresu renderu (`useMemo`). Test dla tej ścieżki był
czerwony przed poprawką.

Uwaga metodyczna warta zapamiętania: mock `react-i18next` zwracający nowy `t` przy
każdym renderze unieważnia każdy `useCallback` i czyni defekty typu stale closure
**strukturalnie niewykrywalnymi**. Testy używają stabilnej tożsamości `t`.

`CreateAnalysisModal` nie miał tego defektu (derywuje w zakresie renderu) —
dodane testy regresyjne mają zęby: usunięcie zależności czerwieni pierwszy z nich.

### 11.8 Value engine — propozycja, nie zmiana

`Gateway.ts` i `demoGuard.middleware.ts` **nietknięte**. Powstał osobny,
audytowany moduł z dokładną listą ścieżek. Wszystkie sześć tras value layer jest
bezstanowych — zweryfikowałem niezależnie, że sześć serwisów ma **zero importów**
(`grep -cE '^import'` = 0), więc nie mają jak dotknąć bazy. Do zwolnienia
zaproponowane są **cztery** — tylko te z realnym callerem produkcyjnym;
`capital/ration` i `value-assurance` zostają zablokowane mimo bycia DB-free.
Zwolniony jest wyłącznie kanoniczny mount `/api/v8/finance/value/*`, nie alias
`/finance-value`. Dopasowanie jest **exact-match**, nie `startsWith`, żeby
przyszłe `appraise-and-save` nie odziedziczyło zwolnienia.

Testy montują **prawdziwy** middleware i prawdziwe routery w kolejności z
Gateway i dowodzą obu połówek: cztery trasy compute zwracają 200 z realnym
wynikiem w trybie demo, a trasy zapisujące (`POST /api/v8/finance/models`,
`/analyses`, zapisy `/api/finance-statements/*`) **nadal zwracają 403
`DEMO_READ_ONLY`** pod tą samą allowlistą.

Gotowy jednokrokowy diff dla `Gateway.ts` leży w `FIN-006` §B.3.

### 11.9 Bramki po rundzie drugiej

| Bramka | Wynik |
| --- | --- |
| targeted FIN-005 backend (16 plików) | **280 PASS** |
| targeted frontend (22 pliki) | **111 PASS / 6 FAIL** — 6 pre-existing, potwierdzone przeze mnie 6/6 czerwone na `c522a861` w świeżym worktree, identyczne komunikaty |
| real PostgreSQL round-trip (A) | **PASS** |
| second-run byte-identical (B) | **PASS** (było RED) |
| schema-drift negative (C) | **PASS** (było RED) |
| cleanup fault-injection + cross-tenant | **81 PASS** (policy 58 + skrypt 23) |
| `tsc --noEmit` backend | **216 przed = 216 po**, diff pusty |
| `tsc --noEmit` frontend | **0 błędów** |
| `tsc` na `scripts/` (poza projektowym tsconfig) | **0 błędów** |
| `npm run build:backend` | **PASS** |
| `git diff --check` | **PASS** |
| demo read-only guard | bez regresji — `Gateway.ts` i `demoGuard.middleware.ts` nietknięte |

Nadal bez deployu, bez migracji, bez `--write`, bez mutacji stagingu.
