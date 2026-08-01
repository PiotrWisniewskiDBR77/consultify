---
doc_id: FIN-005-implementation-handoff
truth_type: operations
status: AWAITING_CODEX_REVIEW
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
osobny test odtwarza bazę z manifestu `PREPARED`. Rollback weryfikuje podpis
(HMAC — patrz §12.3), fingerprint każdego wiersza i własność pakietu, i odmawia,
gdy rekord zmienił się po kwarantannie. Postconditions cross-org (`statement→pack`,
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

## 12. Runda trzecia — final review (2026-08-01)

Pięć punktów. Wszystkie wykonane i zweryfikowane niezależnie od testów agentów.
Commity: `ed25af6f11` (atomowa promocja), `01a4e1d106` (cztery defekty P1
w skrypcie czyszczącym).

### 12.1 Atomowa promocja — defekt odtworzony i zamknięty na realnym Postgresie

Awarie wstrzykiwane **w bazie** (`CHECK` constraint i trigger `plpgsql`), nie
łatką w kodzie — więc dowód nie zależy od atrap in-memory.

| Punkt awarii | Przed (`fd11233784`) | Po (`ed25af6f11`) |
| --- | --- | --- |
| promocja sprawozdania #1 | — | zero promocji |
| promocja sprawozdania #2 | **2/3 promowane** (PL + CF, BS pending) | zero promocji |
| promocja sprawozdania #3 | — | zero promocji |
| promocja analizy | **3/3 sprawozdania READY** | zero promocji, analiza nie-APPROVED |
| promocja pakietu | **3/3 READY + analiza APPROVED** | zero promocji, pakiet nie-READY |

We wszystkich trzech przypadkach „przed" seed dodatkowo **zgłaszał SUKCES** —
w wyniku nie było nawet `incomplete`. Defekt był podwójny: brak atomowości
i nieprawdziwy status.

Rozwiązanie: **sprawdź wszystko, potem promuj**. Wszystkie read-backi i werdykty
produkcyjne dla trzech sprawozdań, analizy i pakietu wykonują się przed
pierwszym zapisem promocyjnym; awaria w trakcie samych zapisów uruchamia
kompensujący rollback (demote w odwrotnej kolejności), który **nie zakłada, że
zadziałał** — ponownie czyta wszystkie pięć wierszy i raportuje
`rowsStillClaimingReady`, gdyby kompensacja sama padła.

Świadomie NIE użyto transakcji: `DbPromise.transaction()` przyjmuje tylko listę
gotowych stringów SQL i nie oddaje uchwytu połączenia, a każde `run()` idzie
przez `pool.query()`, więc `BEGIN`/`COMMIT` nie muszą trafić na to samo
połączenie z puli. Transakcja zbudowana z tego API byłaby fikcją. Powód jest
zapisany w kodzie.

Logger mówi teraz dokładnie, co się stało:
`INCOMPLETE — issued 3/3 statement promotion(s), analysis=not promoted,
pack=not promoted; every issued promotion was rolled back and re-read as
not-ready; reason: …`.

**Test, który akceptował stan częściowy:** `atelierFinanceSchemaGate` →
„fewer values on disk → that statement stays pending". Asercjonował
`statementIds` długości 2 i jeden nieporomowany, sprawdzając tylko odrzucony
wiersz — więc BS i CF na `ready` wewnątrz fixture'u zgłoszonego jako
`incomplete` były akceptowanym wynikiem. Teraz wymaga zera promocji.

**Ryzyko rezydualne:** proces zabity MIĘDZY dwoma zapisami promocyjnymi (bez
wyjątku, więc bez kompensacji) może zostawić stan częściowy. Bez prawdziwej
transakcji nie da się tego domknąć w kodzie seeda. Ponowne uruchomienie seeda
naprawia stan (promocje są idempotentne i strzeżone `IS DISTINCT FROM`).

### 12.2 Exact port

`ObservedTarget.port` jest wymagany. Sprawdzone przeze mnie bezpośrednio:

| Wejście | Wynik |
| --- | --- |
| dokładny port | akceptacja |
| brak portu w URL (`null`) | odmowa |
| `undefined` | odmowa |
| `NaN` | odmowa |
| `0` | odmowa |
| inny port (`5432`) | odmowa |
| poza zakresem (`99999`) | odmowa |
| śmieć (`"28146abc"`) | odmowa |

Nit: numeryczny string poprawnego portu (`"28146"`, `" 28146 "`) jest
akceptowany — porównanie jest liczbowe. Realna ścieżka
(`parseConnectionFingerprint`) zwraca `number`, więc string nie może stamtąd
przyjść; nie jest to luka, tylko luźniejszy kontrakt typu.

### 12.3 Strict demo marker

`organization_type` musi ISTNIEĆ i równać się dokładnie `DEMO`, porównanie
case-sensitive (decyzja i uzasadnienie w komentarzu). Sprawdzone przeze mnie:
brak kolumny, `NULL`, `''`, `demo`, `' DEMO '`, `TRIAL`, `PAID`,
`DEMO_ARCHIVED`, wartość nietekstowa — **wszystkie odmówione**, każde z
własnym komunikatem. Stosowane w obu miejscach: organizacja docelowa i reuse
organizacji kwarantanny.

### 12.4 Manifest HMAC

Niekluczowany SHA-256 usunięty (`computeManifestChecksum` skasowany).
HMAC-SHA256, sekret z `FIN005_MANIFEST_HMAC_KEY` (min. 32 znaki), key id
z `FIN005_MANIFEST_HMAC_KEY_ID`, oba **wymagane** dla `--write` i `--rollback`.
Porównanie `crypto.timingSafeEqual` za `constantTimeEquals`, który przy różnej
długości zwraca `false` zamiast rzucać. `MANIFEST_VERSION` 2 → 3; manifesty v2
są odrzucane.

Zaatakowałem to niezależnie od testów agenta:

| Atak | Wynik |
| --- | --- |
| poprawnie podpisany manifest | akceptacja |
| zły klucz | odmowa |
| podmieniony wpis | odmowa |
| usunięty podpis | odmowa |
| **stary v2, przeliczony zwykłym SHA-256** | odmowa |
| `plannedEntries` podłożone po podpisaniu | odmowa |
| podmieniony `keyId` | odmowa |
| skrócony HMAC (test na `timingSafeEqual`) | odmowa, bez `TypeError` |
| downgrade algorytmu na `SHA-256` | odmowa |
| sekret obecny w JSON manifestu? | **nie** |

`grep` po całym repo: sekret nie trafia do żadnego `console`, `logger`, raportu
ani manifestu.

### 12.5 Transakcyjna bramka fixture'u

`lockCanonicalFixture()` wykonuje te same zapytania po kanonicznych ID z
`FOR UPDATE` na kliencie transakcji. Wewnątrz transakcji fixture jest
weryfikowany dwa razy: przed zablokowaniem wierszy i tuż przed `COMMIT`, za
każdym razem porównywany z odciskiem z prekondycji
(`computeCanonicalFixtureDigest` / `assertCanonicalFixtureUnchanged`) — więc
łapane są też zmiany, które nadal przechodzą reguły kompletności (np. wartość
przepięta na inne kanoniczne sprawozdanie). Różnica ⇒ `ROLLBACK`, nic się nie
rusza.

### 12.6 Bramki po rundzie trzeciej

| Bramka | Wynik |
| --- | --- |
| targeted FIN-005 backend (16 plików) | **320 PASS** |
| FIN-005 demo + scripts (9 plików) | **195 PASS** |
| real PostgreSQL — round-trip | **PASS** |
| real PostgreSQL — drift (zero fałszywego READY) | **PASS** |
| real PostgreSQL — byte-identical drugi przebieg | **PASS** |
| real PostgreSQL — fault injection ×5 punktów promocji | **PASS** (było RED na 3 z 3 zmierzonych) |
| crash-after-commit recovery | **PASS** (test skryptu) |
| HMAC tampering ×9 wektorów | **PASS** |
| environment negatives — port ×8, marker ×10 | **PASS** |
| `tsc --noEmit` backend | **216 przed = 216 po**, identyczny zbiór `file:line:code` |
| `tsc --noEmit` frontend | **0 błędów** |
| `npm run build:backend` | **PASS** |
| `git diff --check` | **PASS** |

Nadal bez deployu, bez migracji, bez `--write`, bez rollbacku, bez mutacji
stagingu.

### 12.7 Otwarte, świadomie niezrobione

1. **Brak trwałej tabeli audit/outbox** — wymagałaby migracji, poza granicą
   pakietu. Proponowany DDL w skrypcie jako `DURABLE_AUDIT_TABLE_PROPOSAL`.
2. **Zarządzanie kluczem HMAC out of band** — brak procedury rotacji i
   przechowywania. Utrata klucza czyni istniejący manifest nieużywalnym przez
   skrypt (wiersze trzeba by przywrócić ręcznie z zapisanego prior state).
   Do rozstrzygnięcia przez Codex przed pierwszym `--write`.
3. **Semantyka `FOR UPDATE`** sprawdzona tylko na atrapie — realne blokowanie
   współbieżnego pisarza wymaga żywego round-tripu.
4. **Wartości allowlisty Railway** (nazwa serwisu, nazwa bazy, port) nadal
   przepisane z dokumentacji, niepotwierdzone na żywym połączeniu. Fail-closed.
5. **Ryzyko rezydualne atomowości** z §12.1 (kill -9 między zapisami).

## 13. Runda czwarta — po przeglądzie adwersaryjnym (2026-08-01)

Po rundzie trzeciej uruchomiłem osobny przegląd adwersaryjny, którego zadaniem
było OBALIĆ twierdzenia §12, nie potwierdzić je. Znalazł **realny bloker**,
którego moje własne testy fault-injection nie mogły złapać.

Commity: `ec0e597487` (bloker + samo-naprawa), `12cecf0e67` (odcisk fixture'u +
nity skryptu).

### 13.1 BLOKER — `INCOMPLETE` mogło współistnieć z promowanym sprawozdaniem

Dwa defekty się składały:

1. Bramka `anythingIssued` **pomijała kompensujący rollback i jego weryfikacyjny
   ponowny odczyt**, gdy błąd wystąpił przy *pierwszym* zapisie promocyjnym.
2. Rollback demotował i ponownie czytał wyłącznie ID, których promise się
   **rozwiązał**. Zapis, którego promise **odrzuca po zaaplikowaniu wiersza**,
   nie był ani demotowany, ani ponownie czytany.

Kod twierdził, że przypadek 2 jest niemożliwy — „pojedynczy UPDATE nie może
zaaplikować się połowicznie, więc ten wiersz nigdy nie został promowany".
**Twierdzenie było fałszywe**: myliło atomowość instrukcji w Postgresie z
dostarczeniem wyniku do klienta. `promoteRow` → `DbPromise.run` →
`PostgresDatabase.run` → `pool.query`; zerwane połączenie albo
`pg_terminate_backend` PO zaaplikowaniu UPDATE-u dociera jako odrzucony promise.
Wiersz jest wtedy `confirmed`/`pass`/`ready` w bazie, a kod wierzy, że nie
został promowany — i loguje na poziomie `warn` „issued 0/3 statement
promotion(s) … no promotion needed rolling back".

Asymetria, która to ukrywała: pakiet i analiza były czytane ponownie
bezwarunkowo, więc dla nich detekcja działała. Tylko sprawozdania były bramkowane
listą `promoted`.

**Naprawa:** zwarcie `anythingIssued` usunięte; rollback demotuje i ponownie
czyta **wszystkie zaplanowane** wiersze (strażnik `IS DISTINCT FROM` czyni
democję niepromowanego wiersza zerowierszowym no-opem, więc jest to darmowe);
fałszywy komentarz zastąpiony prawdziwym powodem.
`statementPromotionsIssued` jest teraz udokumentowany jako **dolne ograniczenie**.

### 13.2 ★ Dlaczego moje testy tego nie złapały — lekcja metodyczna

Wstrzykiwałem awarie w bazie (`CHECK` + trigger). Postgres gwarantuje atomowość
instrukcji, więc modelowałem **wyłącznie „odrzucone bez zaaplikowania"**.
Atrapa in-memory miała dokładnie ten sam ślepy punkt — `maybeFail` odpalał się
PRZED dotknięciem magazynu. Co gorsza, dwie asercje w suicie atomowości
**kodyfikowały zwarcie `anythingIssued` jako zamierzone zachowanie**, więc
naprawa wymagała ich odwrócenia.

Klasa błędu, której nie da się złapać uruchamianiem: obie warstwy testowe
dzieliły to samo założenie, co kod pod testem. Znalazł to przegląd **czytający**
kod, nie wykonujący go.

Atrapa ma teraz hook `onWriteAfterApply` (zapisuje do magazynu, POTEM rzuca) i
sześć scenariuszy tej klasy.

### 13.3 Samo-naprawa zamiast samej dokumentacji (S1)

Ryzyko rezydualne z §12.7 — proces zabity MIĘDZY dwoma zapisami promocyjnymi —
nie rzuca wyjątku, więc żadna kompensacja w procesie się nie uruchomi. Zamiast
tylko to opisać, doszła **faza 0**: przy starcie, gdy stan jest MIESZANY (1–4 z 5
wierszy promocyjnych twierdzi READY), wszystkie są demotowane przed fazą 1.
Pełne 5 = zdrowy fixture, 0 = świeży — oba nietknięte, więc drugi przebieg
byte-identical zostaje nienaruszony.

Zweryfikowane przeze mnie na realnym PostgreSQL osobnym trybem harnessu:
instaluję dokładnie ślad po `kill -9` w środku promocji (2/3 sprawozdań na
`ready`, reszta zdemotowana), uruchamiam seed:

```text
crash residue installed: 2/3 statements claim READY
PASS  seed recovered the fixture to complete
PASS  all three statements consistently READY after the heal
PASS  pack READY
```

**Ryzyko rezydualne pozostaje i jest nazwane w kodzie:** między awarią a
następnym uruchomieniem fixture JEST niespójny, i bez prawdziwej transakcji nic
w procesie tego nie zmieni.

### 13.4 Odcisk fixture'u widzi teraz stan, nie tylko graf ID (S2)

`computeCanonicalFixtureDigest` liczył odcisk **grafu ID** — readback nie
pobierał kolumn statusu. Współbieżna democja pakietu z `ready` na `pending`
dawała **identyczny odcisk** i przechodziła obie bramki. To dokładnie stan, jaki
zostawia przerwany seed: kwarantanna posprzątałaby wokół fixture'u, który nie
jest gotowy.

Readback i materiał odcisku obejmują teraz `pack_status`,
`pack_readiness_status`, `status` i `readiness_status` sprawozdań oraz `status`
analizy. Kolumna nieobecna w schemacie jest kodowana jako `<column-absent>`,
osobno od `NULL` — bez tego znikająca kolumna hashowałaby się identycznie jak
kolumna ustawiona na NULL.

Dodatkowo **`--write` wymaga teraz fixture'u READY**, nie tylko kompletnego:
„kompletny, ale pending" to sygnatura przerwanego seeda, a kontrakt pakietu mówi
„najpierw seed, potem kwarantanna". Tryb dry-run bez zmian — raportowanie
półzasianego tenanta jest właśnie tym, do czego dry-run służy.

### 13.5 Nity zamknięte

Branded refusal z `new URL()` i z `readManifest` (bez echa connection stringa —
niesie hasło) · deklarowany port przez `/^\d+$/` zamiast `Number()` (odrzuca
`0x6DA2`, `2.8146e4`, `28146.0`) · status reuse kwarantanny dokładny i
case-sensitive · `promoteRow` rzuca zamiast po cichu wracać, gdy żadna kolumna
przypisania nie przetrwa filtra schematu · martwy `SELECT readiness_status`
usunięty · mylące komunikaty „expected exactly 1 … found" przeredagowane.

### 13.6 Bramki po rundzie czwartej

| Bramka | Wynik |
| --- | --- |
| targeted FIN-005 backend (16 plików) | **342 PASS** |
| FIN-005 demo + scripts (9 plików) | **217 PASS** |
| real PostgreSQL — round-trip | **PASS** |
| real PostgreSQL — drift | **PASS** |
| real PostgreSQL — byte-identical drugi przebieg | **PASS** |
| real PostgreSQL — fault injection ×5 punktów promocji | **PASS** |
| real PostgreSQL — samo-naprawa śladu po awarii | **PASS** |
| crash-after-commit recovery | **PASS** |
| HMAC tampering ×9 wektorów | **PASS** |
| environment negatives (CLI, po wszystkich edycjach) | **PASS** |
| frontend targeted (21 plików) | **109 PASS / 6 pre-existing** |
| `tsc --noEmit` backend | **216 przed = 216 po**, identyczny zbiór `file:line:code` |
| `tsc --noEmit` frontend | **0 błędów** |
| `npm run build:backend` | **PASS** |
| `git diff --check` | **PASS** |

Kontrola anty-pusta: ponowne wprowadzenie zwarcia `anythingIssued` i zakresu
„tylko zarejestrowane" czerwieni 5 z nowych testów; wyłączenie fazy 0 czerwieni
test samo-naprawy. Test bez zębów wygląda identycznie jak dobry — dlatego to
sprawdzenie jest w raporcie.

### 13.7 ★ BLOKER `DbPromise.run()` — ZAMKNIĘTY w rundzie piątej (§14.1)

`server/src/utils/DbPromise.ts` — gałąź timeoutu w `run()`:

```ts
if (fallback) {
  resolve({ success: false, error: 'timeout' });
}
// brak else reject
```

`all()` i `get()` mają obie gałęzie. `run()` nie ma. Przy `{ fallback: false }`
timeout jest **martwy**: promise czeka bez końca na prawdziwy callback.
Zablokowany zapis zawiesza cały seed demo zamiast go zerwać.

Zweryfikowane przeze mnie: defekt pochodzi z commita `0b5eff2f9f` (2026-04-12),
**ta gałąź tego pliku nie dotyka** (`git diff c522a861..HEAD -- server/src/utils/DbPromise.ts`
jest pusty). To współdzielone narzędzie całego backendu, więc naprawa nie mieści
się w granicy FIN-005 — **wymaga własnego pakietu**.

Dlaczego to materialne dla FIN-005: argument atomowości seeda opiera się na tym,
że `run()` odrzuca przy błędzie. Odrzuca przy błędzie sterownika, ale NIE przy
timeout z `fallback: false`. Kompensujący rollback nigdy się wtedy nie uruchomi,
bo nie ma wyjątku — dokładnie ten sam kształt co ryzyko rezydualne z §13.3, i
tak samo naprawiany przez fazę 0 przy następnym uruchomieniu.

### 13.8 Otwarte, świadomie niezrobione

1. ~~`DbPromise.run()` timeout~~ — **naprawione**, §14.1.
2. Brak trwałej tabeli audit/outbox — wymaga migracji.
3. Zarządzanie kluczem HMAC out of band — brak procedury rotacji;
   utrata klucza czyni istniejący manifest nieużywalnym przez skrypt.
4. Semantyka `FOR UPDATE` sprawdzona tylko na atrapie.
5. Wartości allowlisty Railway niepotwierdzone na żywym połączeniu (fail-closed).
6. Ryzyko rezydualne atomowości między zapisami (§13.3) — mitygowane fazą 0.

## 14. Runda piąta — DB runtime (2026-08-01)

Trzy punkty: naprawa `DbPromise.run()`, prawdziwa przypięta transakcja dla
promocji i runbook operatora. Commity: `057a714f69`, `b0e1ea5fe0`,
`72331187a7`, `a45f456052`.

### 14.1 `DbPromise.run()` — timeout rozstrzyga zamiast wisieć

Diff jest **czysto addytywny**: 49 wstawień, **zero usunięć**. Dodane brakujące
`else reject(...)` (komunikat bajtowo identyczny z `all()`/`get()`, linie
222/339/427) oraz wspólny settle-guard.

**Audyt spóźnionego callbacku wykrył, że `all()` i `get()` miały ten sam hazard**
— cichszy, ale realny: promise połykał drugie rozstrzygnięcie, ale kod NAD nim
wykonywał się ponownie, więc `recordQueryPerformance` odpalał drugi raz
(zawyżając telemetrię), a `get()` dublował `warn` i `error`. Guard tłumi
duplikat metryki i logu; **semantyka rozstrzygnięcia bez zmian** — zwycięzcą i
tak był pierwszy settler.

**Analiza promienia rażenia** (sedno tej zmiany — zamienia zawieszenie w błąd):
82 miejsca wywołania `run()` z `{ fallback: false }`, **wszystkie oczekiwane
(`await` lub zwrot do oczekującego), zero fire-and-forget, zero w `finally`**.
To istotne, bo `src/index.ts` instaluje `unhandledRejection`, który loguje i woła
`fireCrashAlert` — jedno `void run(…, {fallback:false})` zaczęłoby po tej
zmianie budzić kogoś alertem. Nie ma takiego. Zweryfikowane przeze mnie:
jedyne trafienia na „nieoczekiwane `run(`" to deklaracje typów w interfejsach.

Realna zmiana: handler czekający na zablokowany zapis dotąd trzymał request
otwarty do timeoutu klienta/proxy, trzymając połączenie do bazy; teraz zwróci
błąd. Nowy błąd, ale alternatywą był wyciekający request — czyli sam defekt.
Jeden konsument wychodzi na tym jednoznacznie lepiej: `transaction()` wykonuje
`BEGIN`/`COMMIT`/`ROLLBACK` z `fallback:false`; timeout dotąd zawieszał całą
transakcję z otwartą instrukcją, teraz odrzuca do własnego `catch`.

Regresja: **cała suita serwera, 519 plików, na HEAD i na bazie `c522a861`** —
63 fail / 8266 pass (HEAD) vs 65 fail / 8005 pass (baza), **zero nowych
awarii**, każda z 19 czerwonych suit ma identyczną liczbę porażek na bazie; dwie
są czerwone na bazie i zielone na HEAD. Nowa suita timeoutów: **13/13**.

Uczciwa uwaga: **żadna istniejąca suita nie mogła tego wykryć** — nowa gałąź
wykonuje się dopiero, gdy zapytanie przekroczy `DB_QUERY_TIMEOUT` (domyślnie
15 s), a atrapy odpowiadają synchronicznie. Dlatego defekt przeżył od kwietnia.

### 14.2 Przypięta transakcja dla promocji

`atelierFinancePromotionTransaction.ts`: jeden `pg` `PoolClient` na `BEGIN` →
`SELECT … FOR UPDATE` na pakiecie, 3 sprawozdaniach i analizie → ponowny werdykt
produkcyjny na zablokowanych wierszach → 5 promocji → read-back przed `COMMIT` →
`COMMIT`; każdy błąd rolluje na tym samym kliencie, release raz, w `finally`.
`statement_timeout` i `idle_in_transaction_session_timeout` ograniczają wywołanie.

`PostgresDatabase.ts` dostał **jeden** wąsko nazwany eksport
`getPoolClientForPinnedTransaction()` z jawnym kontraktem (wołający jest
właścicielem klienta i musi go zwolnić; funkcja nie robi `BEGIN`).

**Brak cichego fallbacku** — sprawdziłem w logu realnego przebiegu:

```text
pinned promotion transaction COMMITTED — 5 promotion(s) on one connection
  applied: [3 sprawozdania, analiza, pakiet]   backendPid: 33602
Finance golden flow COMPLETE via the PINNED transaction path (backend pid 33602)
```

Wykrywanie atrapy pyta moduł, przez który seed pisze, o wyrażenie wyłącznie
postgresowe (`current_database()`/`pg_backend_pid()`) — atrapa nie umie
odpowiedzieć, więc mockowany test nigdy nie otwiera puli. Fallback jest logowany
na poziomie **error** w produkcji. Faza 0 i kompensacja zostają jako
defense-in-depth.

Czego adapter jawnie NIE gwarantuje (zapisane w docblocku): nie blokuje
`financial_statement_values`, nie ponawia, zapisy fazy 1 nie są transakcyjne,
a `COMMIT` w stanie in-doubt jest raportowany jako wycofany — zaniża sukces,
nigdy go nie zawyża.

### 14.3 Matryca awarii na realnym PostgreSQL

| Awaria | Sposób wstrzyknięcia | Wynik |
| --- | --- | --- |
| przed pierwszym UPDATE | trigger plpgsql | rollback, 0 częściowego READY |
| po promocji sprawozdania 1 / 2 / 3 | trigger plpgsql | rollback, 0 częściowego READY |
| po promocji analizy | trigger plpgsql | rollback, 0 częściowego READY |
| po promocji pakietu, przed `COMMIT` | odmowa read-backu | 5 zapisów zaaplikowanych, **wszystkie cofnięte** |
| zerwane połączenie | `pg_terminate_backend` z 2. połączenia | rollback, 0 częściowego READY |
| timeout | `statement_timeout` | rollback, 0 częściowego READY |
| ekwiwalent SIGTERM | backend zabity po 5 zapisach, bez czystego ROLLBACK | 3 sprawozdania READY *wewnątrz* tx, **0 na dysku po** |

Każda pozycja sprawdza dodatkowo: zakończenie w ograniczonym czasie, kolejny
przebieg kończy się sukcesem, fixture spójny po odzyskaniu. Doszedł też test
blokady `FOR UPDATE` z konkurencyjnym pisarzem — **zamyka pozycję 3 z §13.8**,
która dotąd była sprawdzona tylko na atrapie.

**Dwa realne defekty wyszły przy budowie tej matrycy**, oba naprawione: zabity
backend emitował nieobsłużone zdarzenie `error` na kliencie pg, co zabiłoby
proces (seed ginący od awarii, którą ma przetrwać), oraz współdzielona funkcja
triggera podnosiła `record "new" has no field readiness_status`, udając
wstrzykniętą awarię.

### 14.4 ★ Suita PG była niedeterministyczna — odesłana i naprawiona

Pierwsza wersja suity dała **7 porażek, a przy powtórzeniu tej samej komendy 9**.
Nie zaraportowałem jej jako zielonej. Objawy: fault z jednego testu aktywny w
teście, który żadnego nie wstrzykuje; `violates foreign key constraint
financial_statement_values_statement_id_fkey`; „fault się nie zaaplikował".
Przyczyna: wszystkie 14 testów dzieliło JEDNĄ organizację, reset fixture'u
biegł w `beforeEach` (przerwany hook zostawia zapytania w locie i kasuje wiersze
spod seeda innego testu), a faulty były globalnymi obiektami na wspólnych
tabelach.

Naprawione: organizacja per test, reset w ciele testu, faulty jako zbiór
identyfikatorów per organizacja, arm/disarm w `try/finally` plus czyszczenie w
`beforeEach` i `afterEach`, `describe.sequential`.

**Zweryfikowane przeze mnie: cztery kolejne przebiegi tej samej komendy —
13 passed / 1 skipped za każdym razem.** Pominięty jest test driftu, który
poprawnie uruchamia się dopiero na bazie zdryfowanej (tam: 1 passed /
13 skipped). Bez zmiennych bazy: 14 skipped, czysto, bez porażki.

Niezależnie od suity agenta przepuściłem produkt przez własny harness z
izolowaną organizacją i deterministycznym faultem: full, heal, drift oraz
5 punktów awarii — wszystko zielone.

Kontrola anty-pusta: wyłączenie ścieżki przypiętej czerwieni 12 z 14 testów
(test byte-identical słusznie zostaje zielony — trzyma na obu ścieżkach).

### 14.5 Bramki po rundzie piątej

| Bramka | Wynik |
| --- | --- |
| targeted FIN-005 backend, mockowane (19 plików) | **359 PASS / 14 skipped** |
| real PostgreSQL — matryca przypiętej transakcji ×4 przebiegi | **13 PASS / 1 skipped**, identycznie |
| real PostgreSQL — drift | **1 PASS / 13 skipped** |
| bez bazy — czysty skip | **14 skipped**, zero porażek |
| własny harness: full / heal / drift / fault ×5 | **PASS** |
| `DbPromise` timeout | **13 PASS** |
| pełna suita serwera vs baza (519 plików) | **zero nowych awarii** |
| `tsc --noEmit` backend | **216 przed = 216 po**, identyczny zbiór `file:line:code` |
| `tsc --noEmit` frontend | **0 błędów** |
| `npm run build:backend` | **PASS** |
| `git diff --check` | **PASS** |

### 14.6 Otwarte po rundzie piątej

1. Brak trwałej tabeli audit/outbox — wymaga migracji (`DURABLE_AUDIT_TABLE_PROPOSAL`).
2. Zarządzanie kluczem HMAC out of band — brak procedury rotacji; utrata klucza
   czyni manifest nieużywalnym przez skrypt. Runbook operatora
   (`FIN-005_OPERATOR_PRE_RUN.md` §4) wymaga ustalenia tego przed pierwszym
   `--write`.
3. Wartości allowlisty Railway niepotwierdzone na żywym połączeniu — fail-closed;
   runbook §1 wymaga potwierdzenia.
4. Ścieżka fallback (bez pg) zachowuje udokumentowane ryzyko rezydualne — proces
   zabity między dwoma UPDATE-ami; faza 0 naprawia przy następnym uruchomieniu.
   Ta ścieżka biegnie już tylko tam, gdzie połączenie pg nie może istnieć.

## 15. Runda szósta — finalna korekta linii B (2026-08-01)

Cztery P1 zlecone, dwa dodatkowe blokery znalezione przez przegląd adwersaryjny
i **potwierdzone przeze mnie osobno**, oba naprawione i ponownie zweryfikowane
tymi samymi atakami. Diff względem `fa3b649fd6`: `8e1da202b3`, `8064d83ab7`,
`ffc729a23b`, `0ea8f0a896`.

### 15.1 Fail-closed na PostgreSQL

Wcześniej: `mode:'unavailable'` przechodziło do nieatomowej ścieżki, a komentarz
w kodzie sam wymieniał wśród wyzwalaczy „**a pool that refused a checkout**" —
warunek realnej bazy, nie atrapy.

Teraz: pięć kształtów wyniku zamiast trzech. Wszystko poza pozytywnie
rozpoznanym seamem to `refused` → seed `incomplete`, **zero UPDATE-ów
promocyjnych**. Wejście do ścieżki nieatomowej jest jedno i napisane jawnie, nie
przez przelot — nowy wariant unii w przyszłości wpada w `incomplete`.

**Zweryfikowane przeze mnie** wstrzyknięciem awarii w miejscu checkoutu, na
realnym PostgreSQL:

```text
ERROR  pinned promotion transaction REFUSED — could not check out a pinned
       connection; failing closed with ZERO promotion UPDATEs issued
       (no compensating fallback on PostgreSQL).
STATUS = incomplete · statements promoted = 0/3 · pack ready = 0 · analysis APPROVED = 0
```

### 15.2 ★ BLOKER znaleziony przez przegląd: `MOCK_DB=true` otwierało ścieżkę nieatomową

Predykat seamu zwracał `recognised:true` na goły string `MOCK_DB === 'true'`,
**zanim** zapytał, czym baza jest. Komentarz twierdził, że `Database.ts` traktuje
to jako główny przełącznik atrapy — prawda tylko wewnątrz `createDatabase()`,
którego `DbPromise` nigdy nie woła.

Zmierzone przeze mnie na `fa3b649fd6`:

```text
MOCK_DB=true, DATABASE_URL=…/fin005_b
→ instanceIsMock: false, dbPromiseWritesTo: "fin005_b", backendPid: 28330
```

Seam mówił „atrapa", zapisy szły do realnego PostgreSQL. Wystarczyło zabłąkane
`MOCK_DB=true` w zmiennych Railway albo w powłoce operatora; `NODE_ENV=production`
nie chronił. **Własny test repo wykorzystywał to jako drogę do fallbacku.**

Naprawa: o seamie decyduje sonda **żywej bazy przez ten sam moduł, przez który
idą zapisy**. Jeśli PostgreSQL odpowiada — wynik to `postgres`, koniec;
`unavailable` jest stamtąd nieosiągalne. Deklaracje (`isMock`, sterownik) są
strukturalnie *za* sondą. `MOCK_DB` usunięty jako sygnał; został wyłącznie jako
tekst dowodowy:

> `MOCK_DB=true (IGNORED — an env var is a statement of intent, never evidence about the live database)`

**Zweryfikowane przeze mnie tym samym atakiem**: `MOCK_DB=true` na realnej bazie
→ decyzja `postgres`; end-to-end z awarią checkoutu → `incomplete`, zero promocji.

### 15.3 ★ BLOKER znaleziony przez przegląd: połączenie zapisujące nigdy nie było autoryzowane

Wszystkie bramki komendy seeda biegły na puli z `--database-url || DATABASE_URL`,
a `upsertAtelierFinanceGoldenFlow` pisał przez `DbPromise`, które rozwiązuje
`process.env.DATABASE_URL` **niezależnie**. Jedynym mostkiem było porównanie
**nazwy bazy** — a każda baza Railway nazywa się `railway` (demo
`trolley:28146/railway`, produkcja `centerbeam:37823/railway`, oba w fixture'ach
tego pakietu).

Czyli `--database-url <demo>` + `DATABASE_URL=<produkcja>` przechodziło denylist
produkcji, allowlistę, marker DEMO i odczyt kontrolny — wszystko na demo — a
33 wiersze lądowały w produkcji.

Naprawa: `--database-url` **usunięty** (jego użycie to twardy błąd, żeby stary
alias się zatrzymał), a tożsamość porównywana przez
`pg_control_system().system_identifier` + OID bazy + adres/port + start
postmastera, na **obu** ścieżkach. Przy okazji wyszła druga dziura:
`DbPromise.all`/`get` idą przez `getReadPool()`, więc stary check po nazwie
czytał **replikę**, nie pulę zapisu.

**Zweryfikowane przeze mnie na dwóch klastrach o identycznej nazwie bazy:**

```text
cluster A: system_identifier 7610146894575327780, database "fin005_b", oid 533481
cluster B: system_identifier 7669010021664630220, database "fin005_b", oid 16384
database NAME identical? true
REFUSED -> systemIdentifier + databaseOid differ
SAME cluster accepted (control) — correct
```

### 15.4 Spóźniony UPDATE po timeoucie JS

Fallback promocyjny na PostgreSQL **nie istnieje** — timeout JS nie jest granicą
transakcyjną, więc wszystkie promocje idą wyłącznie przez przypiętą transakcję.
Test RED (fallback przez jedyny pozostały legalny seam: hurtowo zamockowany
`DbPromise`) pokazuje wskrzeszenie READY po zwróceniu `incomplete`; test GREEN
na zwykłym PG pokazuje, że sesyjny `SET LOCAL statement_timeout` anuluje
zapytanie po stronie serwera **wewnątrz** transakcji. Falsyfikacja: gdy zapis
ląduje na czas zamiast z opóźnieniem, RED pada na `rowsStillClaimingReady` —
asercje dotyczą spóźnienia, nie samej awarii.

### 15.5 `commit-indeterminate`

Pięć statusów. `lost-then-confirmed` wymaga, by świeże połączenie odczytało
wszystkie pięć wierszy **dokładnie** w stanie docelowym (pełne porównanie
kolumn, nie flaga READY) i by werdykt produkcyjny się zgodził; `not-committed`
wymaga dokładnej zgodności ze snapshotem pre-state pobranym pod blokadą
`FOR UPDATE`; wszystko inne to `indeterminate` + `NEEDS_OPERATOR`.

Przegląd wykazał, że `NEEDS_OPERATOR` **kasował się sam** przy następnym
przebiegu (faza 0 leczyła residuum), a runbook wręcz kazał operatorowi ponowić.
Teraz werdykt zapisuje się jako **operator hold** (plik JSON per tenant),
bramka stoi nad sondą schematu i nad fazą 0, seed zwraca `incomplete` i wydaje
**zero instrukcji**, dopóki hold nie zostanie usunięty. Skasowanie pliku JEST
potwierdzeniem.

⚠ Precondition operacyjny: bez `STORAGE_DIR` na zamontowanym wolumenie hold
ląduje pod `process.cwd()` i nie przeżyje redeployu Railway. Seed loguje to na
poziomie `error` w momencie zapisu.

### 15.6 Ekonomika modelu ROI

Wąska komenda seeda zasiewa teraz trzy kanoniczne `financial_model_events`
(2 400 000 / 800 000 / −400 000 EUR), przepisane pole po polu z
`upsertAtelierRoiFinancialModel`, z testem czytającym źródło tamtej funkcji.

Świadomie **nie** zasiewane, z powodami: `assumptions_json` — pełny dataset też
go nie pisze, więc dopisanie byłoby wymyśleniem ekonomiki (mój brief był tu
błędny, agent słusznie odmówił i postawił test na tej przesłance);
`financial_model_outputs` — jedyny pisarz zaczyna od `DELETE FROM`, a ta komenda
ma kontrakt „zero instrukcji destrukcyjnych".

**Konsekwencja jest otwarta i jest w runbooku jako decyzja operatora:**
NPV/ROI/okres zwrotu pozostaną puste, bo `POST /models/:id/compute` blokuje
bramka read-only demo, a `reseedModelFromSource` odmawia modelowi `approved`.

### 15.7 Bramki

| Bramka | Wynik |
| --- | --- |
| mockowane FIN-005 (18 plików) | **309 PASS / 47 skipped** |
| real PG, 3 pliki `*.pg.test.ts`, ×3 przebiegi | **36 PASS / 1 skipped**, identycznie |
| real PG, drift | **1 PASS / 19 skipped** |
| komenda seeda (real PG + bliźniaczy klaster) | **36 PASS / 1 skipped** |
| `tsc --noEmit` backend | **216 przed = 216 po**, identyczny zbiór `file:line:code` |
| `tsc --noEmit` frontend | **0 błędów** |
| `npm run build:backend` | **PASS** |
| `git diff --check` | **PASS** |

Wszystkie testy z `--retry=0`. **Pliki `*.pg.test.ts` MUSZĄ iść z
`--fileParallelism=false`** — dzielą jedną bazę i instalują globalne triggery;
równolegle dają fałszywe porażki wyglądające jak błędy adaptera.

### 15.8 Otwarte

1. `STORAGE_DIR` na wolumenie — precondition dla operator holdu (§15.5).
2. NPV/ROI/zwrot puste — decyzja operatora (§15.6).
3. Brak trwałej tabeli audit/outbox — wymaga migracji.
4. Rotacja klucza HMAC bez procedury.
5. Wartości allowlisty Railway niepotwierdzone na żywym połączeniu (fail-closed);
   bramka tożsamości dowodzi, że pisze autoryzowane połączenie, ale nie że
   deklarowany fingerprint nazywa właściwe środowisko — to zostaje §1 runbooku.
6. Kosmetyka: komunikat odmowy tożsamości ma zdublowany rodzajnik
   („the the write pool").
7. `getPoolClientForPinnedTransaction()` ma teraz dwóch wołających, a jego
   docblock nadal mówi o jednym.
