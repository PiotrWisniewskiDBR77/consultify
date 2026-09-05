# Most legacy → kanoniczny w Finansach: przyczyna, naprawa, co zostaje

Gałąź: `agent/finance-bridge-gate-20260905` (baza: `m03` @ `2398ebbead`).
Data: 2026-09-05. Wykonawca: robotnik (Opus). Dowody: `evidence/finance-gate-20260905/`.

---

## 1. Przyczyna — zmierzona, nie wywnioskowana

### 1.1 Co dokładnie sprawdza bramka

`src/components/Finance/shared/FinanceLegacyBridgeGate.tsx` → hook
`useFinanceLegacyBridge` → `GET /api/v8/finance-v2/artifacts/resolve-legacy/:legacyTable/:legacyId`
→ `server/src/services/finance/canonical/legacyIdBridgeService.ts`.

Serwis czyta **jedną tabelę**: `finance_artifact_aliases` (most legacy → kanoniczny,
migracja `20260809_finance_v3_b01_core_artifacts.sql`), z jednym wyjątkiem —
gdy `legacyId` sam jest kanonicznym `finance_artifacts.artifact_id` tej organizacji.
Brak wiersza aliasu = `NOT_MIGRATED` = bramka renderuje `unresolvedFallback`
(stary widok klasyczny z żółtą wstążką „Otwierasz sprawdzony widok klasyczny”).

### 1.2 Dlaczego alias nigdy nie istnieje

`finance_artifact_aliases` zapisują dziś **dwa** miejsca:

1. `server/scripts/finance-v3-backfill-dry-run.ts` (WP-C03) — skrypt, który z własnego
   nagłówka **nigdy nie może działać na żywym środowisku** („NEVER touches a shared/live
   database”, wymaga jednorazowego, wyrzucanego klastra). Nie uruchomiono go nigdy na
   demo/stagingu.
2. serwisy rejestrujące NOWE rekordy (`valuationRegistrationService`,
   `statementPackRegistrationService`, …) — piszą alias atomowo przy tworzeniu.

Więc alias ma **tylko** rekord utworzony przez serwis rejestrujący. Każdy rekord zastany —
i, jak się okazało, także każdy nowy rekord tworzony starą trasą Finansów — aliasu nie ma.

**Dowód 1 (lokalny PG, odtworzony przypadek).** Organizacja z realnym wierszem legacy,
zero wierszy mostu:

```
resolve(financial_models, repro-model-1) = {"status":"NOT_MIGRATED"}
alias rows for org = 0
legacy financial_models rows for org = 1
```

**Dowód 2 (mocniejszy, na realnej trasie produktu).** Model utworzony DZIŚ przez
`POST /api/v8/finance/models` (prawdziwy kontroler, prawdziwa baza):

```
select ... from finance_artifact_aliases where organization_id='465cffec-…'
(0 rows)
```

To znaczy: defekt nie dotyczy tylko „starych” rekordów. Stara trasa tworzenia modeli
i analiz **do dziś** produkuje rekordy bez tożsamości kanonicznej.

**Dowód 3 (regresyjny w drugą stronę).** `tests/integration/finance-legacy-bridge-materialization.realdb.test.ts`
test 0 zapisuje stan sprzed naprawy jako test: realny rekord + zero aliasów = `NOT_MIGRATED`.

### 1.3 Druga, niezależna przyczyna — Wycena 409

`finance_artifacts.current_business_version_id` **nigdy nie było ustawiane przez kod
produkcyjny**. Jedyne `UPDATE … current_business_version_id = …` w repo były w testach
(`valuationLegacySuccessor.pg.test.ts`) i w resecie testowym (`testSupport.routes.ts`
ustawia NULL). `createArtifact` zostawiał kolumnę pustą, co potwierdza komentarz przy
`GET /artifacts/:artifactId` („only ever back-filled by future work”).

`valuationLegacySuccessorService.pinnedIdentity` **wymaga**
`a.current_business_version_id = aa.business_version_id`. Skutkiem była odpowiedź
409 `LEGACY_IDENTITY_UNMAPPED` („Legacy valuation is not mapped”) — nawet dla wyceny
poprawnie zarejestrowanej, z aliasem. To jest ta druga połowa defektu Wyceny; sam most
by jej nie naprawił.

### 1.4 Sprostowanie pomiaru z 05.09 (dwie tezy raportu odbiorowego są nieprawdziwe)

- **„Pasek tożsamości nie jest wpięty do żadnego z 5 warsztatów”** — NIEPRAWDA.
  `FinanceWorkspaceBar` jest renderowany we wszystkich pięciu: `BaselineWorkspace.tsx:526`,
  `Prediction/PredictionWorkspace.tsx:489`, `Analysis/AnalysisWorkspace.tsx:463`,
  `statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx:593`,
  `Valuation/ValuationWorkspace.tsx:455`. Nie było go widać **wyłącznie** dlatego, że
  bramka nigdy nie montowała warsztatu. Po naprawie pasek jest na zrzutach
  `21-po-analiza.png`, `22-po-wycena.png`, `23-po-predykcja.png`. **Punkt 3 zlecenia nie
  wymagał żadnej zmiany kodu — wymagał pomiaru, który to wykazał.**
- **„Wszystkie 5 warsztatów blokuje bramka”** — NIEPEŁNE. Warsztaty Analizy i Predykcji
  mają w kodzie flagi `defaultValue: false`
  (`useFinanceAnalysisWorkspaceFlag.ts:30`, `useFinancePredictionWorkspaceFlag.ts:28`);
  5 mini-narzędzi wisi dodatkowo na `financeWorkspacePlatformV1`
  (`useFinanceWorkspacePlatformFlag.ts:34`, `defaultValue: false`). Na stagingu te flagi są
  włączone wpisem w bazie dla organizacji właściciela — dlatego u niego bramka była
  jedynym blokerem. Lokalnie trzeba je włączyć jawnie (zrobiłem to lokalnym override'em
  dokładnie trzech flag, tylko w przeglądarce robiącej zrzuty; **żadnej flagi w kodzie nie
  przełączyłem**).

---

## 2. Naprawa

### 2.1 Most rozwiązuje się sam (kierunek preferowany w zleceniu)

Nowy serwis `server/src/services/finance/canonical/legacyIdentityMaterializationService.ts`
+ trasa `POST /api/v8/finance-v2/artifacts/resolve-legacy/:legacyTable/:legacyId/ensure`.
Hook `useFinanceLegacyBridge` po definitywnym `NOT_MIGRATED` woła ją **raz** i dopiero jej
wynik rozstrzyga stan ekranu.

Co robi materializacja: dla wiersza legacy, który **naprawdę istnieje w tej organizacji**,
zakłada `finance_artifacts` + `finance_business_versions` + `finance_working_revisions`
(przez `createArtifact` — tę samą funkcję, której używają serwisy rejestrujące) i wiąże je
aliasem `AUTO_MIGRATE` / `mapping_reason = materialized_on_open:<TYP>`.

Czego **nie** robi: nie kopiuje i nie zgaduje żadnych danych finansowych. Materializuje
wyłącznie TOŻSAMOŚĆ. Zero atrap, zero „sample data”.

Blokady, które zostały nienaruszone (każda z własnym testem i dowodem mutacyjnym):
- nieistniejące `legacyId` → dalej `NOT_MIGRATED`, zero wierszy;
- `legacyId` z innej organizacji → dalej `NOT_MIGRATED`, zero wierszy;
- alias w kwarantannie (`QUARANTINE`/`EXCLUDE_WITH_REASON`) → dalej `QUARANTINED`,
  materializacja **nie tworzy obejścia**;
- awaria materializacji (403/5xx) → ekran wraca do **uczciwego widoku klasycznego**, nie do
  komunikatu o błędzie.

Idempotencja w trzech warstwach: `pg_advisory_xact_lock` na (org, tabela, id) ·
`uq_finance_artifacts_org_natural_key` · `uq_finance_alias_legacy` + `ON CONFLICT DO NOTHING`.

### 2.2 Jeden wiersz `financial_models` karmi DWA warsztaty

Baseline i Predykcja to dwa różne typy kanoniczne z tej samej tabeli legacy. Bramka
przekazuje teraz `expectedArtifactType` (5 miejsc w `FinanceHub.tsx`), a
`resolveLegacyFinanceArtifact` zawęża alias do żądanego typu. Bez tego Predykcja dostawałaby
artefakt Baseline'u i ekran padałby na `IDENTITY_MISMATCH`.

### 2.3 Wskaźnik bieżącej wersji (przyczyna 409 Wyceny)

`createArtifact` ustawia teraz `finance_artifacts.current_business_version_id` na wersję,
którą właśnie utworzył; `reopenVersion` przesuwa wskaźnik na vN+1 (inaczej ustawienie go
przy tworzeniu zamroziłoby `GET /artifacts/:id` na v1). Materializacja uzupełnia kolumnę
dla artefaktów zastanych, ale **tylko gdy jest pusta**.

### 2.4 Nazwa artefaktu = nazwa rekordu

`natural_key` pełni w tym kodzie rolę NAZWY (pasek tożsamości zapisuje właśnie ją przy
zmianie nazwy, `AnalysisWorkspace` wyświetla `artifact.naturalKey` jako tytuł). Pierwsza
wersja materializacji wstawiała `financial_analyses:<uuid>` i właściciel zobaczyłby w
nagłówku surowy ciąg maszynowy — złapane na własnym zrzucie, poprawione: nazwą jest tytuł
rekordu legacy (dla Predykcji z sufiksem `(predykcja)`, żeby odróżnić dwa artefakty z
jednego wiersza). Kolizja nazw w organizacji rozstrzygana krótkim sufiksem id.

---

## 3. Co wymaga kroku na stagingu

**Nic obowiązkowego.** Most rozwiązuje się sam przy pierwszym otwarciu rekordu. Skrypt
poniżej jest opcjonalnym przyspieszeniem (tożsamość gotowa zanim ktokolwiek otworzy ekran,
plus policzalne pokrycie przed odbiorem). **Nie uruchamiałem go na stagingu.**

```bash
# 1) DRY-RUN (nic nie zapisuje) — policz kandydatów w organizacji właściciela
DOTENV_IGNORE_LOCAL=1 ENV_FILE=.env.staging.local DB_TYPE=postgres \
  npx tsx server/scripts/finance-bridge-backfill.ts --org=<ORG_ID>

# 2) ZAPIS — dopiero po obejrzeniu liczb z kroku 1
DOTENV_IGNORE_LOCAL=1 ENV_FILE=.env.staging.local DB_TYPE=postgres \
  npx tsx server/scripts/finance-bridge-backfill.ts --org=<ORG_ID> --write

# opcjonalnie: --limit=<n> na przebieg próbny; bez --org obejmuje wszystkie organizacje
```

Dowód idempotencji z lokalnej bazy (`evidence/finance-gate-20260905/backfill-write-idempotencja.txt`):

```
przebieg 1: financial_models: kandydaci=1 utworzone=2 już-istniało=0 … błędy=0
przebieg 2: financial_models: kandydaci=0 utworzone=0 już-istniało=0 … błędy=0
```

Migracji bazy **nie ma** — schemat (`finance_artifact_aliases`) istnieje od
`20260809_finance_v3_b01_core_artifacts.sql`.

---

## 4. Tabela 13 ekranów — przed / po

Stan „przed” = pomiar 05.09 (`evidence/odbior-zywo-20260905/09-finanse/`).
Stan „po” = zmierzony na lokalnym backendzie + realnej bazie tej gałęzi.

| # | Ekran | Przed | Po | Dowód |
|---|-------|-------|-----|-------|
| 1 | finance-hub | ZGODNY | bez zmian | `01-finance-hub.png`, `02-lista-modeli.png` |
| 2 | finance-model-workspace | ZGODNY (zatwierdzony obraz = widok klasyczny) | bez zmian | — |
| 3 | finance-analysis-workspace | ROZNI_SIE (ciemna karta legacy, „brak wartości KPI”) | **zatwierdzony warsztat v3** z paskiem tożsamości, tabelą wskaźników i uczciwym stanem pustym + CTA | `11-przed-analiza.png` → `21-po-analiza.png` |
| 4 | finance-statement-pack-workspace-v2 | ROZNI_SIE | **niezweryfikowane** — pakiet sprawozdań powstaje przez upload pliku, nie zbudowałem fikstury; mechanizm ten sam co w 3/5/6 | — |
| 5 | finance-prediction-workspace | ROZNI_SIE (proste karty wejściowe, brak trybów A/B/C) | **zatwierdzony warsztat v3**: tryby A·Standardowy / B·Wskaźnikowy / C·Fundamentalny, Base/Bull/Bear, pasek tożsamości | `23-po-predykcja.png` |
| 6 | finance-valuation-workspace | ROZNI_SIE — pusty ekran + 409 „Legacy valuation is not mapped” | **zatwierdzony warsztat v3**, 7 kroków, pasek tożsamości, **zero błędów konsoli** | `12-przed-wycena.png` → `22-po-wycena.png` |
| 7 | finance-baseline-workspace | ROZNI_SIE (widok klasyczny z żółtą wstążką) | v3 **montuje się**, ale pokazuje 409 `BASELINE_CONTEXT_NOT_CONFIGURED` — **patrz §5, to jest regresja użyteczności** | `10-przed-baseline.png` → `20-po-baseline.png` |
| 8 | finance-comments-panel | NIE_DOTARLEM | **osiągalny i działa** (Komentarze (0), dodawanie, wzmianki, flaga blokująca, lista kontrolna) | `25-po-mini-narzedzia.png` |
| 9 | finance-lineage-navigator | NIE_DOTARLEM | osiągalny (pastylka „Powiązania” w pasku narzędzi) | `25-po-mini-narzedzia.png` |
| 10 | finance-saved-views-panel | NIE_DOTARLEM | osiągalny („Widoki”) | `25-po-mini-narzedzia.png` |
| 11 | finance-export-import-panel | NIE_DOTARLEM | osiągalny („Excel”) | `25-po-mini-narzedzia.png` |
| 12 | finance-compare-panel | NIE_DOTARLEM | osiągalny („Porównaj”); treść wymaga ≥2 wersji biznesowych — niezweryfikowana | `25-po-mini-narzedzia.png` |
| 13 | finance-workspace-bar | NIE_DOTARLEM („nie wpięty”) | **widoczny w każdym zamontowanym warsztacie**; teza o braku wpięcia była nieprawdziwa (§1.4) | `21`, `22`, `23` |

Mini-narzędzia (8–12) wymagają dodatkowo flagi `financeWorkspacePlatformV1` — patrz §1.4.

---

## 5. Czego ta naprawa NIE załatwia (uczciwie)

**Tożsamość ≠ treść.** Materializacja daje rekordowi legacy tożsamość kanoniczną, ale
kanoniczne TREŚCI (linie sprawozdań, wartości KPI, kontekst bazowy, krawędzie lineage)
pozostają puste, dopóki nikt ich nie wprowadzi albo nie powstanie osobna migracja treści.
Warsztaty v3 pokazują wtedy własne, uczciwe stany puste.

Dla trzech z pięciu warsztatów to jest poprawa (Analiza i Predykcja: zatwierdzony układ +
CTA zamiast ciemnej karty legacy; Wycena: pełny ekran zamiast 409). **Dla Baseline to jest
regresja użyteczności** i wymaga decyzji właściciela:

- **przed**: widok klasyczny — działający (Dane wejściowe i założenia, Oś czasu zdarzeń,
  Wyniki RZiS/Bilans/CF, Walidacja, Oblicz, Zatwierdź);
- **po**: `BaselineWorkspace` v3 wymaga łańcucha *zatwierdzone Sprawozdanie → zatwierdzona
  Analiza → Model* z krawędziami lineage i skonfigurowanym `finance_baseline_workspace_contexts`
  (`baselineContextService.ts:99`). Model utworzony ręcznie (bez sprawozdania źródłowego)
  tego łańcucha nie ma, więc ekran pokazuje wyłącznie komunikat 409 i „Spróbuj ponownie”.

Dźwignia cofania jest jednoprzełącznikowa i nie wymaga zmiany kodu:
`financeBaselineWorkspaceV1` = OFF przywraca dla Modeli widok klasyczny, nie ruszając
Analizy, Predykcji, Wyceny ani mini-narzędzi. **Nie podjąłem tej decyzji sam — zgłaszam ją.**

Niezweryfikowane: pakiet sprawozdań (ekran 4) i panel porównania (12, wymaga ≥2 wersji).

---

## 6. Testy i dowód mutacyjny

`tests/integration/finance-legacy-bridge-materialization.realdb.test.ts` — 10 testów na
realnym PostgreSQL (`RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=postgres://…`),
strażnik `assertRealPostgresTestEnvironment` (brak warunków = FAIL, nigdy SKIP).

| Mutacja (cofnięcie naprawy) | Wynik |
|---|---|
| usunięcie `readLegacyRow` (fail-closed) | testy **4 i 5 CZERWONE** — tożsamość powstawała dla zmyślonego id i dla cudzej organizacji |
| usunięcie `UPDATE … current_business_version_id` w materializacji | test **6 CZERWONY** |
| usunięcie tego samego `UPDATE` w `createArtifact` | test **9 CZERWONY** |
| usunięcie zawężenia do typu w `resolveLegacyFinanceArtifact` | test **7 CZERWONY** |
| usunięcie wczesnego zwrotu na istniejącym aliasie | test **7 CZERWONY** |
| dodatkowo usunięcie `ON CONFLICT DO NOTHING` | testy **2, 7, 8 CZERWONE** |
| przywrócenie naprawy | **10/10 zielone** |

Front-end: `src/components/Finance/shared/__tests__/FinanceLegacyBridgeGate.test.tsx` —
10/10, w tym 3 nowe scenariusze (samorozwiązanie, odmowa materializacji → uczciwy widok
klasyczny, kwarantanna nieobchodzona).

Regresja: `legacy-id-bridge.routes.pg.test.ts` 9/9, `canonicalServices.pg.test.ts` +
`coldReopen` + `artifactVersionSupersededImmutability` + `artifactVersionTerminalTransitions`
+ `valuationLegacySuccessor` — razem 46/46 zielone.

9 czerwonych w `FinanceWorkspaceBar.test.tsx` / `PredictionWorkspace.test.tsx` /
`ValuationWorkspace.test.tsx` to **dług zastany** — te same 9 pada na nietkniętym `m03`
(sprawdzone bezpośrednio, nie przepisane: „Outdated” zamiast „Nieaktualne”, defekt i18n).

---

## 7. Pliki

Kod:
- `server/src/services/finance/canonical/legacyIdentityMaterializationService.ts` (nowy)
- `server/src/services/finance/canonical/legacyIdBridgeService.ts` (zawężenie do typu, eksporty)
- `server/src/services/finance/canonical/artifactVersionService.ts` (wskaźnik bieżącej wersji)
- `server/src/routes/v8/finance-v2/artifacts.routes.ts` (trasa `…/ensure`, `?artifactType=`)
- `server/scripts/finance-bridge-backfill.ts` (nowy, idempotentny)
- `src/services/api/financeV2.api.ts`, `src/components/Finance/shared/useFinanceLegacyBridge.ts`,
  `src/components/Finance/shared/FinanceLegacyBridgeGate.tsx`, `src/components/Economics/FinanceHub.tsx`

Testy: `tests/integration/finance-legacy-bridge-materialization.realdb.test.ts`,
`src/components/Finance/shared/__tests__/FinanceLegacyBridgeGate.test.tsx`

Dowody: `evidence/finance-gate-20260905/` · narzędzie zrzutów:
`scripts/dev/finance-gate-20260905/zrzut3112.mjs` (kopia kanonicznego `zrzut.mjs` z innym portem).
