# WP-A03 — Legacy classification (statyczna analiza kodu)

Data: 2026-08-09
Zakres: Gate A / WP-A03 z `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
Metoda: **wyłącznie statyczna** — kod, migracje, testy. Zero połączeń z bazą (live lub efemeryczną).
Branch: `codex/finance-v3-gate-a-20260809`, worktree `/private/tmp/finance-v3-gate-a-20260809` (świeży z `origin/demo`).

## 0. Streszczenie

Dwa różne, niepowiązane ze sobą mechanizmy zostały zbadane. Żaden z nich nie jest
implementacją "legacy classification" / "quarantine ledger" / "candidate handoff"
w rozumieniu programu finance-v3 (sekcja 2.1 master planu — `artifact_id` /
`business_version_id` / `working_revision_id` / lifecycle DAG). Oba są realnym,
działającym kodem na `origin/demo`, ale odpowiadają na zupełnie inne pytania:

1. **`financeDemoCoherencePolicy.ts` + `financeDemoManifestSignature.ts` (FIN-005)**
   — polityka **higieny danych demo-tenanta**: co wolno przenieść z organizacji
   `demo-org` do organizacji-kwarantanny, żeby demo pokazywane klientowi było
   czyste od śmieci technicznych (fixture'y, `(kopia)`, `staging`, m16-seed itd.).
   To NIE jest klasyfikacja legacy rekordów produkcyjnych pod migrację do nowego
   modelu wersji — to jednorazowy skrypt operacyjny do sprzątania jednej,
   konkretnej organizacji demo.

2. **`financeCandidateHandoffCore.ts` + trzy adaptery (FIN-06)**
   — jednokierunkowy, idempotentny **eksport migawki** z zatwierdzonego
   (Approved/ready) obiektu Finance (Investment Case / Statement Pack /
   Valuation Recommendation) do `initiative_candidates` (skrzynka kandydatów
   inicjatyw, moduł Ideas). To NIE jest wersjonowanie artefaktów Finance ani
   ich lifecycle — to most do INNEGO modułu, z jednym stanem "handed off /
   not handed off", bez `business_version_id`/`working_revision_id`/DAG lineage.

Żaden z dwóch mechanizmów nie zawiera reguł `AUTO_MIGRATE / MIGRATE_WITH_WARNING /
QUARANTINE / EXCLUDE_WITH_REASON` opisanych w WP-A03. Poniżej: co realnie robią,
oraz — na podstawie migracji, nie danych — które z 12 patologii z handoffu programu
strukturalnie MOGĄ dziś wystąpić w schemacie na `origin/demo`.

---

## 1. `financeDemoCoherencePolicy.ts` (FIN-005) — co to naprawdę jest

Plik: `server/src/services/demo/financeDemoCoherencePolicy.ts` (1362 linie)
Towarzyszy: `server/src/services/demo/financeDemoManifestSignature.ts` (190 linii)
Testy: `server/src/services/demo/__tests__/financeDemoCoherencePolicy.test.ts` (1248 linii)
Jedyny wołający: `server/scripts/finance-demo-coherence-cleanup.ts` (operacyjny skrypt CLI,
nie route API, nie serwis produkcyjny).

Nagłówek pliku wprost mówi, po co powstał: "policy for deciding what may exist in,
and what may be moved out of, **the demo Finance tenant**". Geneza — test opisuje
to jako reakcję na "the 2026-08-01 staging probe" (memory: `elkomtech-utrata-lejka`,
`Bazy prod vs demo vs dev`), czyli wcześniejszy incydent z sesji 2026-08-01, nie
element programu finance-v3 (który zaczął się 2026-08-09).

Siedem pytań, na które moduł odpowiada (dosłownie z komentarza w kodzie):

1. **Do której bazy wolno się podłączyć?** — `assertApprovedDemoTarget` — twardy
   allowlist DOKŁADNIE jednego celu Railway (`consultify`/`demo`, host
   `trolley.proxy.rlwy.net:28146`, baza `railway`), z denylistą wzorców
   produkcyjnych (`centerbeam`, `prod`, `live`) sprawdzaną PRZED allowlistą.
2. **Czy ten tenant jest oznaczony jako demo?** — `assertDemoOrganizationMarker`
   — `organizations.organization_type` musi być DOKŁADNIE `'DEMO'` (case-sensitive,
   bez trim).
3. **Które wiersze są kanoniczne (nigdy nieprzenoszalne)?** — `isCanonicalDemoRowId`
   — EXACT whitelist z `getAtelierFinanceCanonicalIds`, nie prefix-match (bo stare
   fixture'y typu `<org>--financial-model--m16-seed` też mają poprawny prefiks,
   ale nie są kanoniczne).
4. **Czy seed jest zmaterializowany i READY zanim cokolwiek ruszy?** —
   `assertCanonicalFixtureMaterialized` / `assertCanonicalFixtureUnchanged` —
   sprawdza dokładne stany `pack_status='confirmed'`, `pack_readiness_status='ready'`,
   `financial_analyses.status='APPROVED'` itd., plus SHA-256 digest porównujący
   stan przed transakcją ze stanem wewnątrz transakcji (obrona przed edycją
   fixture'u w locie).
5. **Czy organizacja-kwarantanna jest bezpieczna do zapisu?** —
   `assertQuarantineOrganizationReusable` — odmawia, jeśli ma choć jednego
   użytkownika lub członka.
6. **Czy graf referencji przetrwał bez złamania?** —
   `findCrossOrgDependencyViolations` — wykrywa `cross-org` i `dangling` FK między
   pack/statement/value/ingest-run/analysis/model.
7. **Czy manifest rollbacku jest autentyczny?** — `assertManifestIntegrity` (HMAC-
   SHA256, nie plain SHA-256 — moduł explicite odrzuca stare "podpisy" v1/v2 jako
   niewiarygodne) + `assertRecordUnchangedSinceQuarantine` (fingerprint wiersza od
   momentu kwarantanny).

**Ocena dopasowania do WP-A03**: brak. WP-A03 dotyczy klasyfikacji WSZYSTKICH
historycznych/aktywnych rekordów Finance pod kątem bezpiecznej migracji do nowego
modelu wersji (`artifact_id`/`business_version_id`/lineage), per organizacja,
per typ artefaktu, ze statusami `AUTO_MIGRATE/MIGRATE_WITH_WARNING/QUARANTINE/
EXCLUDE_WITH_REASON`. FIN-005 operuje na JEDNEJ organizacji (`demo-org`), rozróżnia
tylko "kanoniczny seed" vs "obcy wiersz" (bez pojęcia wersji artefaktu), a jego cel
to higiena wizualna demo, nie inwentaryzacja pod migrację schematu. Jedyny
koncepcyjny most: oba mechanizmy uczą tego samego stylu inżynierskiego (fail-closed,
brak wnioskowania brakujących danych, HMAC zamiast plain checksum, digest przed/po
transakcji) — to wzorzec do skopiowania w WP-B/WP-C, nie gotowy kod do reużycia
wprost w WP-A03.

---

## 2. `financeCandidateHandoffCore.ts` + adaptery (FIN-06) — co to naprawdę jest

Rdzeń: `server/src/services/finance/financeCandidateHandoffCore.ts` (476 linii)
Adaptery: `financeStatementPackCandidateHandoff.ts` (288), `financeInvestmentCaseCandidateHandoff.ts`
(315), `financeValuationRecommendationCandidateHandoff.ts` (424)
Routes: `server/src/routes/financeCandidateHandoffStatementPack.routes.ts`,
`financeCandidateHandoffInvestmentCase.routes.ts`, `financeCandidateHandoffValuationRecommendation.routes.ts`
(UWAGA: nagłówki tych plików mówią "NOT mounted here" — to jest STARY komentarz.
Realnie są zamontowane w `server/src/Gateway.ts:1201-1211` pod
`/api/finance/candidate-handoff/{investment-case,statement-pack,valuation-recommendation}`.
Zgodnie ze złotą regułą repo — nie ufaj komentarzowi, sprawdź callera).

Migracja: `server/migrations/20260802_fin006_candidate_handoff.sql` (tabela-receipt
`finance_candidate_handoffs`) + `20260802_fin006_candidate_handoff_source_snapshot.sql`
(dołożona kolumna `source_snapshot jsonb NOT NULL DEFAULT '{}'`).

### 2.1 Co robi

Jednokierunkowy, idempotentny eksport: bierze JUŻ zatwierdzony/gotowy obiekt Finance
i tworzy z niego wiersz w `initiative_candidates` (skrzynka kandydatów inicjatyw —
inny moduł, "F2 Skrzynka Kandydatów"). Trzy źródła, trzy cienkie adaptery nad
wspólnym rdzeniem:

| Adapter | Źródłowa tabela | Brama eligibility |
|---|---|---|
| Statement Pack | `financial_statement_packs` | `pack_readiness_status === 'ready'` |
| Investment Case | `financial_models` | `status === 'approved'` (BEZ sprawdzenia `approved_snapshot IS NOT NULL`) |
| Valuation Recommendation | `valuations` | (patrz plik — status/advisory) |

Wzorzec (identyczny z ASM-08/INT-08/TLS-07):
- **preview** — czysty odczyt, bez locka, bez transakcji;
- **confirm** — jedna transakcja PostgreSQL, `SELECT … FOR UPDATE` na wierszu
  źródłowym, sprawdzenie idempotency-key PRZED ponownym rozwiązywaniem eligibility
  (retry zwraca ten sam `candidateId`, zero nowego candidate'a), TOCTOU re-check
  eligibility WEWNĄTRZ locka dla świeżego handoffu.
- Idempotency key: `UNIQUE (organization_id, source_type, source_id)` — jeden
  handoff na obiekt źródłowy, na zawsze, per organizacja.
- `sourceSnapshot`: struktura, w której KAŻDE pole jest albo realną wartością
  przeczytaną wprost ze źródła, albo literałem `'unknown'` — moduł deklaruje
  wprost zakaz dosuwania/wymyślania liczb (np. Investment Case: `financial_models`
  nie ma kolumny NPV/IRR/ROI/payback, więc te pola są uczciwie `'unknown'`, a nie
  `0`).

### 2.2 Lifecycle / wersjonowanie / scoping — porównanie z sekcją 2.1 master planu

| Wymóg programu (2.1) | FIN-06 candidate handoff |
|---|---|
| `artifact_id` | Brak. Identyfikatorem jest `(source_type, source_id)` — pojedynczy wiersz źródłowy, nie artefakt z historią wersji. |
| immutable `business_version_id` | Brak. Nie ma pojęcia wersji biznesowej Finance — handoff działa na "aktualnym" stanie wiersza w momencie confirm. |
| mutable Draft `working_revision_id` | Brak. |
| immutable `compute_snapshot_id` / `compute_run_id` | Częściowo analogiczne: `approved_snapshot` na `financial_models` (string, zapisywany atomowo przy `approveModel()`) pełni podobną rolę dla JEDNEGO źródła, ale nie jest generycznym mechanizmem compute-job. |
| `engine_manifest_id` | Brak. |
| `content_semantic_hash` | Częściowy odpowiednik: `computeSourceFingerprint()` — SHA-256 (16 hex) nad już-rozwiązanymi danymi źródła, używany do integralności snapshotu handoffu, NIE do wykrywania duplikatów/lineage w skali programu. |
| `organization_id` | TAK — każdy adapter i rdzeń jest organization-scoped (`WHERE organization_id = ?` w każdym zapytaniu, testy e2e explicite sprawdzają cross-tenant izolację — patrz `tests/acceptance/fin-006-statement-pack-candidate-handoff.e2e.test.ts`, przypadek 4). |
| Business lifecycle `DRAFT→…→APPROVED→SUPERSEDED/…` | Brak stanu handoffu poza binarnym "receipt istnieje / nie istnieje". Handoff nie ma własnego stanu — konsumuje CUDZY stan (`pack_readiness_status`/`financial_models.status`) jako bramkę wejścia, ale sam siebie nie modeluje jako wersjonowany artefakt. |
| Lineage DAG (Statement→Analysis→Model→…) | Brak. To jest pojedyncza krawędź w INNYM kierunku: Finance-źródło → Initiative Candidate (poza DAG-iem opisanym w 2.2 master planu, który jest wewnątrz-Finance). |

**Wniosek**: FIN-06 candidate handoff pasuje do modelu programu WYŁĄCZNIE w jednym
punkcie — organization scoping i idempotency-przez-unique-index to ten sam
instynkt inżynierski, który WP-B01/B02 będzie chciał uogólnić. Poza tym to
zupełnie inny problem (jednorazowy eksport do innego modułu, nie wersjonowany
artefakt Finance) i nie jest częściową implementacją `artifact_id`/
`business_version_id`/`working_revision_id`.

---

## 3. Reguły klasyfikacji legacy — czego W KODZIE NIE MA

Żaden z dwóch zbadanych mechanizmów nie implementuje reguł
`AUTO_MIGRATE / MIGRATE_WITH_WARNING / QUARANTINE / EXCLUDE_WITH_REASON` z WP-A03.
FIN-005 ma własną, wąską klasyfikację dwuwartościową (`canonical` / `foreign` w
`classifyFinanceDemoRows`) ograniczoną do JEDNEJ organizacji demo i pięciu tabel
Finance (packs/statements/values/analyses/models) — to nie jest ogólny inwentarz
legacy pod migrację schematu.

WP-A03 wciąż wymaga napisania od zera:
- inwentarza WSZYSTKICH organizacji (nie tylko demo),
- reguł jednoznaczności tenant/status/source/payload dla AUTO_MIGRATE,
- reason code + severity + owner queue dla QUARANTINE/EXCLUDE,
- równania `input = candidate + quarantine + excluded`.

## 4. Które z patologii WP-A03 MOGĄ dziś wystąpić w schemacie (dowód z migracji, nie z danych)

| Patologia (WP-A03 / handoff pkt 3) | Dowód strukturalny na `origin/demo` |
|---|---|
| **Approved bez snapshotu** | `server/migrations/571_financial_modeling_t054.sql:26` — `approved_snapshot TEXT` (nullable, BEZ `NOT NULL`, BEZ `CHECK` wiążącego z `status`). `financeInvestmentCaseCandidateHandoff.ts:145` sprawdza tylko `model.status !== 'approved'` — NIE sprawdza `approved_snapshot IS NOT NULL`. Aplikacyjny writer (`approveModel()`) rzekomo zapisuje snapshot atomowo, ale **baza dopuszcza dowolny wiersz `status='approved', approved_snapshot=NULL`** — nic w schemacie tego nie blokuje. Legacy/direct-write/awaryjny UPDATE mógłby to wytworzyć. **Możliwe strukturalnie: TAK.** |
| **NULL period/unit** | `financial_statements.period_start`/`period_end` mają `NOT NULL` (`20260316_financial_statement_packs.sql:47-48`) — period na poziomie statement jest chroniony. Ale `currency` na `financial_statements`/`financial_statement_packs` jest `TEXT DEFAULT 'PLN'` BEZ `NOT NULL` — jawny `NULL` jest możliwy. `financial_statement_values.value REAL` (linia 78) jest w pełni nullable, bez ograniczenia na jednostkę/walutę per-wartość (unit żyje tylko na poziomie statement, nie value). **Period na statement: chronione. Unit/currency: NIE chronione — możliwe strukturalnie.** |
| **Event-only model** | `financial_model_events` (`571_financial_modeling_t054.sql:38-65`) — model finansowy (`financial_models`) jest budowany z listy zdarzeń ekonomicznych (`revenue/cogs/opex/capex_purchase/debt_drawdown/…`), nie z okresowych schedules. `financialModelingService.ts` iteruje po `financial_model_events` (linie 786, 914, 1980+) żeby obliczyć periods. **To NIE jest hipotetyczna patologia — to JEST bieżąca architektura Baseline Models na `origin/demo`.** Program finance-v3 (WP-D03) wymaga pełnych schedules (revenue/headcount/COGS/DSO-DIO-DPO/CAPEX/leases/dług/podatki) — obecny event-model jest strukturalnie uboższy i dokładnie to, co WP-A03 chce oznaczyć do kwarantanny/warunkowej migracji. |
| **Duplicate valuation version** | `valuation_snapshots` (`571_valuation_t055_t056_t057.sql:37-46`) ma `version INTEGER NOT NULL` i tylko zwykły (nie-UNIQUE) indeks `idx_valuation_snapshots_val ON (valuation_id, version)`. `financial_model_versions` (`20260228_financial_model_versions.sql:53-63`) analogicznie: `version INTEGER NOT NULL`, brak UNIQUE na `(model_id, version)`. **Możliwe strukturalnie: TAK** — nic w bazie nie zabrania dwóch wierszy o tym samym `(model_id/valuation_id, version)`. |

Wszystkie cztery kolumny/tabele istnieją dziś na `origin/demo` (świeży worktree),
nie na jakiejś martwej gałęzi. To nie dowodzi, że dane w PRODUKCYJNEJ/demo bazie
faktycznie zawierają te patologie (tego statyczna analiza nie może pokazać — wymaga
WP-A01 live inwentarza), ale dowodzi, że **schemat ich nie blokuje**, więc
WP-A03 musi je aktywnie sprawdzać zapytaniami, nie może założyć że są niemożliwe.

## 5. Odniesienie do "12 problemów" handoffu (sekcja 3) — co adresuje istniejący kod

- **Event timeline w Models (pkt 6)** — POTWIERDZONE jako istniejący, żywy
  mechanizm (`financial_model_events`), nie hipoteza. Nic w zbadanym kodzie
  FIN-005/FIN-06 go migruje ani anotuje pod klasyfikację.
- **Approved bez snapshotu** — schemat go dopuszcza; FIN-06 investment-case
  adapter go NIE wykrywa (eligibility check nie waliduje `approved_snapshot`).
  To otwarta luka, nie zamknięta przez istniejący kod.
- **Duplicate valuation version** — schemat go dopuszcza (brak UNIQUE).
- **NULL unit/currency** — częściowo dopuszczone (currency nullable, value
  nullable na `financial_statement_values`), period na statement jest chronione
  przez `NOT NULL`.
- **Organization scoping jako wzorzec** — FIN-005 i FIN-06 oba pokazują DOBRY,
  gotowy do skopiowania wzorzec org-scoped queries + testy cross-tenant
  (`tests/acceptance/fin-006-statement-pack-candidate-handoff.e2e.test.ts`, przypadek
  4) — to jest coś, co WP-B02 (SoD/role) może wziąć jako wzór stylu, nie jako
  gotowy kod.
- **HMAC nad plain checksum, fail-closed refusal zamiast domyślnego "przejdź"** —
  wzorzec z FIN-005 (`financeDemoManifestSignature.ts`) wart powtórzenia w
  WP-B06 (reproducibility/manifest podpisywany) — semantycznie to ten sam
  problem (manifest jest untrusted input, plain digest nie chroni przed
  edycją), ale FIN-005 rozwiązuje go dla JEDNEGO operacyjnego skryptu demo,
  nie dla generycznego eksportu programu.

## 6. Czy to zmienia ocenę zakresu programu?

Nie zmniejsza zakresu WP-A03 — żaden z dwóch mechanizmów nie jest częściową
implementacją inwentarza/klasyfikacji legacy. Zmienia natomiast dwie rzeczy
praktycznie:

1. **WP-A01/A03 muszą aktywnie zapytać o cztery konkretne pola** wskazane w
   sekcji 4 (`financial_models.approved_snapshot IS NULL AND status='approved'`,
   duplikaty `(model_id/valuation_id, version)`, `currency IS NULL`,
   `financial_statement_values.value IS NULL`) — to gotowa, konkretna lista
   zapytań do query pack z WP-A01, nie hipoteza.
2. **Event-only Models nie jest krawędzią, tylko rdzeniem obecnej architektury**
   Baseline Models na `origin/demo` — WP-D03 (pełne schedules) jest więc
   zamianą fundamentu, nie rozszerzeniem, co ma konsekwencje dla wielkości
   backfillu w WP-C03 (każdy istniejący `financial_models` wiersz prawdopodobnie
   kwalifikuje się do `MIGRATE_WITH_WARNING` lub `QUARANTINE`, nie
   `AUTO_MIGRATE`, bo "event-only model" jest explicite wymieniony w WP-A03
   jako powód kwarantanny/warunkowości).

Oba zbadane mechanizmy (FIN-005, FIN-06) mogą zostać NIETKNIĘTE przez program
finance-v3 — działają na innych warstwach (higiena demo-tenanta; eksport do
modułu Ideas) i nic w master planie ich nie zastępuje ani nie wymaga ich migracji.
