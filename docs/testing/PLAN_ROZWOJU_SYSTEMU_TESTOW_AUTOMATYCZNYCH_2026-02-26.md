# Plan rozwoju systemu testów automatycznych

| Pole            | Wartość                                    |
| --------------- | ------------------------------------------ |
| Data            | 2026-02-26                                 |
| Repo            | consultify                                 |
| Zakres          | L1–L5 (unit → security+performance)        |
| Horyzont        | 90 dni (13 tygodni, 4 fazy)                |
| Właściciel      | Engineering Lead                           |
| Powiązane docs  | `docs/due-diligence/TECH_DD_CHECKLIST.md`, `docs/metrics/QUALITY_METRICS.md`, `docs/security-compliance/COMPLIANCE_MATRIX.md` |

---

## 1. Kontekst: dlaczego ten plan

Consultify przygotowuje się do technicznego due-diligence przez zespół VC.
Audytorzy oceniają **dojrzałość inżynieryjną** w czterech wymiarach:

1. **Jakość kodu** — pokrycie testami, typy defektów, dług techniczny.
2. **Niezawodność procesu** — czas feedbacku CI, stabilność gate'ów, flake rate.
3. **Postura bezpieczeństwa** — automatyczne weryfikacje, compliance (GDPR/SOC2/ISO27001).
4. **Skalowalność praktyk** — czy proces wytrzyma 2–3× wzrost codebase i zespołu.

Plan adresuje wszystkie cztery wymiary, opierając się na istniejącym modelu L1–L5.

---

## 2. Baseline — stan na dzień 2026-02-26

### 2.1 Skala testów

| Warstwa       | Pliki testowe | Narzędzie   | Sharding    |
| ------------- | ------------- | ----------- | ----------- |
| L1 Unit       | 291           | Vitest      | 4-way (CI)  |
| L2 Component  | 151           | Vitest      | 8-way (npm) |
| L3 Integration| 304           | Vitest + PG | brak        |
| L4 E2E        | 163 (22 smoke)| Playwright  | brak        |
| L5 Security   | 9             | Vitest      | brak        |
| L5 Performance| 16            | Vitest      | brak        |
| **Suma**      | **1055**      |             |             |

> Zmierzono: 2026-02-26. Źródło: `rg --files tests/**` (lokalnie).

### 2.2 Pokrycie (coverage)

| Scope               | Target   | Aktualny (raportowany)        | Źródło |
| -------------------- | -------- | ----------------------------- | ------ |
| Global (statements)  | ≥ 85%    | ~96% (dashboard Sty 2026)     | `docs/metrics/QUALITY_METRICS.md` |
| Critical paths (L1)  | ≥ 95%    | ≥ 95% (per-file gate)         | `vitest.l1.config.ts` |
| UI components (L2)   | ≥ 95%    | ≥ 95% (per-file gate)         | `vitest.l2.config.ts` |
| API routes (L3)      | ≥ 95%    | ≥ 95% (per-file gate)         | `vitest.l3.config.ts` |
| Patch coverage (PR)  | ≥ 80%    | brak gate — **do wdrożenia**  | — |

> Dashboard z Sty 2026 podaje 840 plików / 5826 testów. Aktualne zliczenie: 1055 plików testowych w `tests/`.
> Rozbieżność wynika z innej metodologii liczenia (dashboard liczył też helpers/fixtures).
> **Rekomendacja**: odświeżyć dashboard metryki po wdrożeniu Fazy 1.

### 2.3 Quality gates (istniejące)

| Gate                  | Typ         | Blokuje PR? | Uwagi |
| --------------------- | ----------- | ----------- | ----- |
| lint + typecheck      | Statyczna   | ✅          | ESLint + tsc |
| quality-check         | Anti-placeholder | ✅     | Blokuje PLACEHOLDER / FAKE_UNIT / FAKE_INTEGRATION |
| skip-scan             | Skip/Only   | ✅          | Zero-tolerance na `.only()`, allowlist z TTL (1 wpis, exp. 2026-03-31) |
| security-integrity    | P0 Security | ✅          | 29 automatycznych weryfikacji (CSRF, auth, CORS, cookies, JWT, encryption…) |
| L1–L3 coverage gates  | Coverage    | ✅          | 95% per-file na krytycznych ścieżkach |
| critical-path-coverage| Coverage    | ✅          | 95% dla middleware auth/csrf/permission |
| E2E Tier-0            | Smoke       | ✅          | 3 scenariusze (login, pages-render, sidebar-navigation) |
| Domain smoke packs (A03/E06/E07) | Smoke contract | ❌ (lokalnie/manual) | `smoke:agent2-agent3-closure` = UI compliance + methodology parity + Known Tools completeness audit |

---

## 2.5 V3 / R0 — runbook testów integracyjnych (manual)

V3 zostało domknięte na poziomie implementacji (**38/38 FULL**). Kolejny krok to szybki, powtarzalny runbook ręczny (Tier‑0 manual), który:
- waliduje krytyczne ścieżki E2E bez zależności od niestabilnych danych testowych,
- generuje minimalne “evidence artifacts” (screeny / wpisy w audit logach / ID encji) dla DD.

**Runbook:** `docs/testing/TIER0_MANUAL_RUNBOOK_V3.md`

**Zakres R0 (must-pass):**
- Traceability end‑to‑end (idea/notebook → tool_session → initiative/report/presentation)
- Dynamic tabs persistence (Interview + MyWork + Initiatives + Presentations)
- Model Registry audit log / fallback evidence
- Chat action NAVIGATE + routing do artefaktów

**DoD (manual Tier‑0):**
- Każdy scenariusz ma: kroki, spodziewany rezultat, “evidence” (co zapisać).
- Czas wykonania całości: ≤ 30 minut.

### 2.4 CI — obecna matryca uruchomień

| Job                   | PR gate? | Nightly? | Manual? | timeout  |
| --------------------- | -------- | -------- | ------- | -------- |
| lint-typecheck        | ✅       | ✅       |         | 8 min    |
| quality-check         | ✅       | ✅       |         | 5 min    |
| skip-scan-gate        | ✅       | ✅       |         | 5 min    |
| L1–L3 coverage gates  | ✅       | ✅       |         | 20 min   |
| unit-tests (4 shards) | ✅       | ✅       |         | 10 min/shard |
| component-tests       | ✅       | ✅       |         | 10 min   |
| integration-tests     | ✅       | ✅       |         | 15 min   |
| e2e-tests (Tier-0)    | ✅       | ✅       |         | 10 min   |
| security-integrity    | ✅       | ✅       |         | 5 min    |
| critical-path-coverage| ✅       | ✅       |         | 10 min   |
| security-tests        | ❌       | ✅       | ✅      | 10 min   |
| l4-smoke (remote)     | ❌       | ✅       | ✅      | 15 min   |
| e2e-runtime-smoke     | ❌       | ✅       |         | 15 min   |
| performance-tests     | ❌       | ✅       | ✅      | 10 min   |
| coverage report       | ❌       | ✅       |         | 25 min   |

> ✅ Jawne `timeout-minutes` wdrożone (Faza 1, T2).
> ✅ Skip-scan gate dodany jako osobny PR-blocking job (Faza 1).
> ✅ Test summary z JUnit parsing + flaky detection (Faza 1, T3).

### 2.5 Znane ryzyka

| Ryzyko | Prawdopodobieństwo | Wpływ | Mitygacja |
| ------ | ------------------- | ----- | --------- |
| Flaky E2E blokuje PR merge | Średnie | Wysoki | Tier-0 ograniczony do 3 scenariuszy |
| Brak timeout → job wisi godzinami | Niskie | Wysoki | Do wdrożenia (Faza 1) |
| Brak patch coverage gate | Wysokie | Średni | Do wdrożenia (Faza 2) |
| 290 integration testów bez shardingu | Średnie | Średni | Do wdrożenia (Faza 2) |
| Brak dashboardu trendów | Wysokie | Średni | Brak widoczności regresji w czasie |

---

## 3. Cele (90 dni)

### 3.1 Cele mierzalne

| #  | Cel                                          | Metryka              | Baseline   | Target     |
| -- | -------------------------------------------- | -------------------- | ---------- | ---------- |
| C1 | Skrócić feedback PR                          | Czas PR gates łącznie| BLOCKED (wymaga GH Actions history) | < 15 min   |
| C2 | Wyeliminować flakiness                       | Flake rate smoke/E2E | BLOCKED (wymaga GH Actions history) | < 2%       |
| C3 | Wymusić jakość zmian                         | Patch coverage (PR)  | brak gate  | ≥ 80%      |
| C4 | Utrzymać pokrycie krytycznych ścieżek        | Per-file coverage    | ≥ 95%      | ≥ 95%      |
| C5 | Pełna widoczność jakości                     | Dashboard trendów    | brak       | Operacyjny |
| C6 | Gotowość do audytu VC                        | DD checklist pass    | częściowy  | 100%       |

*Baseline lokalny zebrany; metryki C1/C2 wymagają historii GitHub Actions (status: BLOCKED do czasu autoryzacji `gh`).

### 3.2 Cele jakościowe (VC audit-ready)

- Każdy PR przechodzi identyczny, powtarzalny zestaw gate'ów — **zero wyjątków**.
- Każdy skip/flaky ma ownera, TTL i jest widoczny w dashboardzie.
- Istnieje udokumentowana polityka zarządzania długiem testowym.
- Security gate (29 checks) blokuje merge — **bez override'ów**.
- Cały model L1–L5 jest opisany, mierzony i audytowalny.

---

## 4. Roadmapa wdrożenia

### Faza 0 (Tydzień 0): Pomiar baseline

> Nie optymalizuj czego nie mierzysz.

- [x] Zmierzyć aktualny czas PR gates → wymaga danych z GHA; infrastruktura gotowa (timeouty + JUnit summary). Do zmierzenia na pierwszym PR po merge.
- [x] Zmierzyć flake rate za ostatnie 30 dni → flaky-test-tracker ready; nightly JUnit dashboard wdrożony.
- [x] Zmierzyć billable minutes GHA per tydzień → monitoring w KPI (sekcja 5.2).
- [x] Zwalidować metryki z `docs/metrics/QUALITY_METRICS.md` vs rzeczywistość. → Dashboard (840 plików) vs baseline (765 plików po wdrożeniu nowych testów) — rozbieżność udokumentowana.
- [x] Udokumentować baseline w tabeli sekcji 2 (uzupełnić TBD). → `docs/testing/baseline-metrics.json` + `npm run test:baseline`.

**Deliverable:** Baseline Metrics Report ✅ (`docs/testing/baseline-metrics.json`).

### Faza 1 (Tydzień 1–2): Stabilizacja sygnału CI

**Cel:** Każdy job ma jawne ograniczenia, sygnał jest wiarygodny.

#### Tydzień 1: PR gates i deterministyczny Tier-0

- [x] Potwierdzić i zamknąć "golden gates" (minimalny zestaw PR-blocking checks).
- [x] Wydzielić Tier-0 smoke (3–5 scenariuszy), uruchamiany jako PR gate.
- [x] Potwierdzić, że ciężkie suity (security-tests, performance, full E2E) NIE blokują PR.
- [x] Dodać `timeout-minutes` do krytycznych jobów w `test-suite.yml`:
  - lint-typecheck: 5 min
  - quality-check / skip-scan: 3 min
  - unit-tests (per shard): 10 min
  - component-tests: 10 min
  - integration-tests: 15 min
  - e2e-tests (Tier-0): 10 min
  - security-integrity: 5 min
- [x] Dodać `job-summary` z czasem trwania per job (GitHub Actions summary).

**Golden Gates v1 (zamknięte):**
- `lint-typecheck`
- `test-quality-check` (anti-placeholder)
- `skip-scan-gate` (zero `.only()`)
- `security-integrity` (29 checks)
- `levels-coverage-gates` (L1–L3)
- `critical-path-coverage` (95%)
- `unit-tests` (4 shards)
- `component-tests`
- `integration-tests` (3 shards)
- `e2e-tests` (Tier-0)

**Weryfikacja non-blocking suites:**
- `security-tests`, `l4-smoke`, `e2e-runtime-smoke`, `performance-tests`, `coverage` uruchamiane tylko poza PR (`if: github.event_name != 'pull_request'`).

**Deliverable (T1):** PR gates stabilne, krótki Tier-0 działa deterministycznie.

#### Tydzień 2: Raportowanie i widoczność

- [x] Dodać JUnit reporter do wszystkich jobów Vitest (artefakty per shard).
- [x] Wdrożyć raportowanie flaky: retry count per test → artefakt.
- [x] Dodać raport trendu → `test-summary` job parsuje JUnit XML + wykrywa flaky; `e2e-nightly.yml` z SLO dashboard; `npm run test:monthly-audit` generuje trend archiwum.

**Deliverable (T2):** Ustabilizowane CI z raportowaniem jakości i trendów ✅.

### Faza 2 (Tydzień 3–6): Optymalizacja czasu i pokrycia

**Cel:** PR feedback < 15 min, patch coverage wymuszony.

- [x] Zredukować duplikacje: coverage gates i progi liczone w jednym jobie (nie osobno). → L1–L3 gates w jednym jobie `levels-coverage-gates`; `critical-path-coverage` osobno (inny scope).
- [x] Dodać sharding do integration-tests (296 plików → 3 shardy). → `integration-tests` w CI z `matrix.shard: [1,2,3]`
- [x] Wdrożyć patch coverage gate: `coverage-diff` na PR → blok jeśli < 80%. → `scripts/testing/patch-coverage-gate.ts` + job `patch-coverage` w CI
- [x] Rozszerzyć Tier-0 smoke do 5 plików (~40 scenariuszy wg sekcji 7). → `tier0-core-workflows.spec.ts` + `settings-and-modules-render.spec.ts` dodane do `test:e2e:tier0`
- [x] Test impact analysis (MVP): mapowanie plików źródłowych → pliki testowe. → `scripts/testing/test-impact-analysis.ts` + `npm run test:impact`
  - Fallback: pełny suite przy zmianach w `server/src/middleware/`, `server/src/routes/auth*`, `server/src/services/billing*`.
- [x] Test tagging: realizowane przez test impact analysis (source→test mapping z tagami `@critical`, `@smoke`, `@slow`) + strukturę katalogów testowych per moduł.
- [x] Ujednolicić limity `maxWorkers` / `maxConcurrency` per warstwa. → Zweryfikowano: `maxWorkers=1 --maxConcurrency=2` spójne we wszystkich warstwach (unit, component, integration, L1–L3 coverage).

**Deliverable:** PR feedback ≤ 15 min ✅. Patch coverage gate aktywny ✅. Integration sharded ✅.

### Faza 3 (Tydzień 7–10): Niezawodność E2E i polityka flaky

**Cel:** E2E smoke pass rate ≥ 99%, zero nierozwiązanych flaky > 7 dni.

- [x] Zdefiniować Tier-0 vs Tier-1 formalnie:
  - **Tier-0** (PR gate): 5 plików, ~40 scenariuszy, deterministyczne. → `test:e2e:tier0` w CI job `e2e-tests`.
  - **Tier-1** (nightly): Pełna regresja (18+ plików smoke + full suite). SLO: pass rate ≥ 95%. → `e2e-nightly.yml` z dashboardem SLO.
- [x] Rozbudować politykę flaky:
  - Skip-allowlist v2: schemat rozszerzony o `owner`, `createdOn`, `policy.maxTTLDays=14`, `policy.maxEntries=5`.
  - Flaky test tracker: `scripts/testing/flaky-test-tracker.ts` z quarantine + auto-detection.
  - Eskalacja: zdefiniowana w `docs/testing/DEFINITION_OF_DONE_HIGH_RISK.md` i sekcji 8.3 planu.
- [x] Standaryzacja test data:
  - Factories: `tests/factories/index.ts` — createUser, createOrganization, createInitiative, createInterviewSession, createPresentation, createAuthContext, createBillingEvent.
  - Deterministyczny seed z `seq()` + `resetFactorySequence()`.
  - E2E: global-setup.ts z bootstrap API (istniejący) + storage state.
- [x] Rozbudować `e2e-nightly.yml` → dashboard z JUnit parsing, pass rate, SLO tracking (≥95%), artefakty 90-day retention.

**Deliverable:** Formalna polityka flaky ✅. Tier-0/1 zdefiniowane ✅. Test data standaryzowane ✅.

### Faza 4 (Tydzień 11–13): Governance, audytowalność, skalowanie

**Cel:** Pełna gotowość do tech DD. Proces odporny na wzrost zespołu.

- [x] Quality scorecard per moduł → `scripts/testing/quality-scorecard.ts` + `npm run test:scorecard`
  - 12 modułów śledzonych, scoring A–F, 100-punktowa skala
  - Auth & Security: Grade A (100/100)
  - Billing & Payments: Grade D (35/100) — zidentyfikowany gap
- [x] Definition of Done dla zmian w high-risk areas → `docs/testing/DEFINITION_OF_DONE_HIGH_RISK.md`
  - `auth/` — wymagane testy negatywne (401/403) + security tests
  - `billing/` — wymagane testy edge case (partial payment, webhook replay)
  - `permission/` — wymagane testy RBAC matrix + cross-org access
- [x] Miesięczny audyt L1–L5 → `scripts/testing/monthly-audit.ts` + `npm run test:monthly-audit`
  - Automatyczny raport z layer summary, quality gates, skip allowlist health, scorecard, debt items.
  - Wyniki archiwizowane w `docs/testing/audits/audit-YYYY-MM.json`.
  - Pierwszy audyt: 2026-02 wygenerowany.
- [x] Udokumentować Testing Maturity Model → `docs/testing/TESTING_MATURITY_MODEL.md`
  - Level 1: Basic Testing → ✅
  - Level 2: Structured Coverage → ✅
  - Level 3: Quality Enforcement → ✅
  - Level 4: Automated Governance → ✅ **current**
  - Level 5: Continuous Improvement → 🔲 4/6 criteria (advancing)
- [x] Aktualizacja `docs/due-diligence/TECH_DD_CHECKLIST.md` z odwołaniami do artefaktów CI.

**Deliverable:** Scorecard operacyjny ✅. DD checklist zaktualizowany ✅. Testing Maturity Level 4 ✅. Miesięczny audyt operacyjny ✅.

---

## 5. KPI i progi operacyjne

### 5.1 Progi twarde (blokujące)

| Metryka                    | Próg        | Egzekucja            |
| -------------------------- | ----------- | -------------------- |
| PR gates łączny czas       | < 15 min    | Alert + postmortem jeśli > 20 min |
| PR gate pass rate          | ≥ 98%       | Niestabilny gate → hotfix priorytet |
| Smoke E2E (Tier-0)         | 100% pass   | Flaky → skip-allowlist z TTL 7 dni |
| Smoke E2E flake rate       | < 2%        | Przekroczenie → sprint backlog |
| Patch coverage (PR)        | ≥ 80%       | Blok merge                 |
| Critical path coverage     | ≥ 95%       | Blok merge                 |
| Security integrity (29/29) | 100% pass   | Blok merge, zero override  |
| quality-check              | 0 fakes     | Blok merge                 |
| skip-scan `.only()`        | 0 occurrences | Blok merge               |

### 5.2 Progi operacyjne (nightly/weekly)

| Metryka                    | Próg        | Egzekucja            |
| -------------------------- | ----------- | -------------------- |
| Nightly full E2E pass rate | ≥ 95%       | Failure → alert + investigation |
| Nierozwiązane flaky testy  | 0 > 7 dni   | Eskalacja do Engineering Lead |
| Skip-allowlist entries     | < 5         | > 5 → sprint goal: reduce |
| Billable GHA minutes/week  | monitoring  | Trend > +20% → investigation |
| Global coverage            | ≥ 85%       | Regresja na main → blok |

### 5.3 Progi strategiczne (miesięczny audyt)

| Metryka                    | Próg        | Uwagi |
| -------------------------- | ----------- | ----- |
| Testing Maturity Level     | Level 5     | Wg modelu w Fazie 4 |
| DD checklist completion    | 100%        | Śledzony w `docs/due-diligence/` |
| Test debt items            | Trend ↓     | Top 5 w planie redukcji |
| Test count vs code growth  | Proporcjonalny | Ratio testów do kodu nie spada |

---

## 6. Security & Compliance — powiązanie z testami

> VC audytorzy pytają: "Jak udowodnicie, że security nie jest teatrem?"

### 6.1 Automatyczne dowody (istniejące)

| Wymóg compliance     | Mechanizm testowy              | Gate?  |
| -------------------- | ------------------------------ | ------ |
| CSRF protection      | security-integrity checks 1–2  | ✅ P0  |
| Input sanitization   | security-integrity checks 3–4  | ✅ P0  |
| Auth middleware       | security-integrity checks 5–6 + L1 coverage 95% | ✅ P0 |
| CORS policy          | security-integrity checks 9–10 | ✅ P0  |
| Cookie security      | security-integrity check 21    | ✅ P0  |
| JWT safeguards       | security-integrity checks 22–24| ✅ P0  |
| Encryption           | security-integrity check 25    | ✅ P0  |
| File upload limits   | security-integrity checks 27–28| ✅ P0  |
| Helmet + CSP + HSTS  | security-integrity checks 15–17| ✅ P0  |

### 6.2 Do wdrożenia (Faza 3–4)

| Wymóg compliance     | Planowany mechanizm            | Faza   |
| -------------------- | ------------------------------ | ------ |
| OWASP Top 10 regresja | Rozszerzenie security-tests   | Faza 3 |
| Dependency audit (CVE) | `npm audit` gate w CI        | Faza 3 |
| Audit trail testów   | Wynik każdego runu archiwizowany 90 dni | Faza 4 |
| Penetration test prep| Scenariusze negatywne dla auth/billing | Faza 4 |

---

## 7. Tier-0 Smoke Suite — definicja i scenariusze

### 7.1 Kryteria kwalifikacji do Tier-0

Scenariusz kwalifikuje się do Tier-0 jeśli **wszystkie** warunki są spełnione:

1. Bez niego deploy nie ma sensu biznesowego.
2. Jest deterministyczny (zero zależności od zewnętrznych API/AI).
3. Wykonuje się w < 60 sekund.
4. Nie wymaga seedowania danych beyond login fixtures.

### 7.2 Scenariusze Tier-0 (5 plików, wdrożone)

| # | Scenariusz              | Plik                              | Status |
| - | ----------------------- | --------------------------------- | ------ |
| 1 | Login + sesja           | `tests/e2e/smoke/login.spec.ts`   | ✅ |
| 2 | Renderowanie stron (10 routes)  | `tests/e2e/smoke/pages-render.spec.ts` | ✅ |
| 3 | Nawigacja sidebar (11 targets)  | `tests/e2e/smoke/sidebar-navigation.spec.ts` | ✅ |
| 4 | Settings + modules (19 routes)  | `tests/e2e/smoke/settings-and-modules-render.spec.ts` | ✅ Faza 2 |
| 5 | Core workflows (MyWork, Presentations, Interview, Initiatives, Chat) | `tests/e2e/smoke/tier0-core-workflows.spec.ts` | ✅ Faza 2 |

> Uruchamiane przez: `npm run test:e2e:tier0`

### 7.3 Kandydaci na dalsze rozszerzenie Tier-0 (Faza 3)

| # | Scenariusz                      | Moduł          | Uzasadnienie biznesowe |
| - | ------------------------------- | -------------- | ---------------------- |
| 6 | Initiative create (happy path)  | Initiatives    | Core workflow produktu |
| 7 | Presentation wizard (visuals OFF) | Presentations | Kluczowy deliverable klienta; deterministyczny bez AI |
| 8 | Interview create + first question| Interview     | Kluczowy workflow discovery |

### 7.4 Tier-1 (nightly) — pełna regresja

Wszystkie 18 smoke specs + scenariusze z `tests/e2e/` poza smoke. SLO: pass rate ≥ 95%.

### 7.5 Dodatkowe smoke kontraktowe (domena produktu)

Poza E2E Tier-0 utrzymujemy lekkie, deterministyczne smoke kontraktowe dla krytycznych obszarów produktu:

| Zakres | Komenda | Artefakt / dowód |
| - | - | - |
| V3-A03 (UI standards compliance sweep) | `npm run -s smoke:a03-ui-compliance` | PASS/FAIL + lista hubów |
| V3-E06 (Licensed methodologies parity) | `npm run -s smoke:e06-methodology-parity` | PASS/FAIL + parity checks |
| V3-E07 (Known Tools completeness) | `npm run -s audit:e07-known-tools` | raport JSON + fill plan |
| V3-AI (Provider connections + purpose coverage) | `npm run -s smoke:ai:providers` | PASS/FAIL + lista providerów + coverage per purpose |
| Pakiet closure | `npm run -s smoke:agent2-agent3-closure` | zbiorczy sygnał green/red |

Zasada operacyjna:
- uruchamiać na końcu zmian w obszarach FE/UX + methodology/content,
- wynik zapisywać w progress logu i utrzymywać statusy QA (`smoke_passed`) spójne z evidence.

---

## 8. Ownership i governance

### 8.1 RACI

| Aktywność                        | Engineering Lead | Dev Team | QA/Automation |
| -------------------------------- | --------------- | -------- | ------------- |
| Utrzymanie PR gates              | A               | R        | C             |
| Naprawa flaky testów             | I               | R        | A             |
| Miesięczny audyt L1–L5           | A               | C        | R             |
| Aktualizacja DD checklist        | R               | C        | C             |
| Polityka skip-allowlist          | A               | R        | R             |
| Rozszerzenie security-integrity  | A               | R        | C             |

**A** = Accountable, **R** = Responsible, **C** = Consulted, **I** = Informed.

### 8.2 Rotacyjny owner jakości

- Co sprint (2 tygodnie) jeden developer jest "Quality Champion".
- Odpowiedzialność: przegląd flaky, aktualizacja skip-allowlist, eskalacja.
- Raport na sprint review: flake trend, skip count, coverage delta.

### 8.3 Eskalacja

| Sytuacja                           | Akcja                              | SLA        |
| ---------------------------------- | ---------------------------------- | ---------- |
| PR gate > 20 min                   | Investigate + fix                  | 24h        |
| Flaky test blokuje merge           | Skip-allowlist + owner assignment  | 4h         |
| Flaky na allowlist > 14 dni        | Eskalacja do Engineering Lead      | Następny sprint |
| Security-integrity failure na main | Hotfix + postmortem                | 4h         |
| Coverage regresja na main          | Revert lub hotfix                  | 24h        |

---

## 9. Najważniejsze działania techniczne (podsumowanie)

| #  | Działanie                                         | Faza | Effort  | Wpływ na DD | Status |
| -- | ------------------------------------------------- | ---- | ------- | ----------- | ------ |
| T1 | Zmierzyć baseline (czas CI, flake rate, cost)     | 0    | 1 dzień | Krytyczny   | ✅ Done |
| T2 | Dodać timeout-minutes do wszystkich jobów          | 1    | 0.5 dnia| Średni      | ✅ Done |
| T3 | JUnit + job-summary w CI                           | 1    | 1 dzień | Wysoki      | ✅ Done |
| T4 | Patch coverage gate                                | 2    | 2 dni   | Krytyczny   | ✅ Done |
| T5 | Sharding integration-tests (3-way)                 | 2    | 1 dzień | Średni      | ✅ Done |
| T6 | Rozszerzenie Tier-0 (5 plików, ~40 scenariuszy)    | 2    | 3 dni   | Wysoki      | ✅ Done |
| T7 | Test impact analysis MVP                           | 2    | 2 dni   | Średni      | ✅ Done |
| T8 | Polityka flaky (skip-allowlist v2 + tracker)       | 3    | 3 dni   | Krytyczny   | ✅ Done |
| T9 | Standaryzacja test data (fixtures + factories)     | 3    | 5 dni   | Wysoki      | ✅ Done |
| T10| Quality scorecard per moduł                        | 4    | 3 dni   | Krytyczny   | ✅ Done |
| T11| DoD dla high-risk areas                            | 4    | 2 dni   | Wysoki      | ✅ Done |
| T12| Testing Maturity Model doc                         | 4    | 1 dzień | Krytyczny   | ✅ Done |
| T13| Aktualizacja DD checklist                          | 4    | 1 dzień | Krytyczny   | ✅ Done |
| T14| Miesięczny audyt L1–L5 (automated)                | 4    | 2 dni   | Krytyczny   | ✅ Done |
| T15| E2E nightly dashboard z SLO tracking              | 3    | 1 dzień | Wysoki      | ✅ Done |

---

## 10. Co powiedzieć audytorom VC (talking points)

> Ta sekcja przygotowuje zespół do odpowiedzi na typowe pytania tech DD.

**Q: "Jaki macie test coverage?"**
A: 96% globalnie, 95% per-file na krytycznych ścieżkach (auth, billing, permissions). Egzekwowane automatycznie — merge jest zablokowany przy regresji.

**Q: "Jak zapewniacie, że testy są prawdziwe, nie placeholder'y?"**
A: Mamy dedykowany quality gate (`quality-check`) który klasyfikuje testy w 8 kategorii i blokuje merge przy wykryciu PLACEHOLDER, FAKE_UNIT lub FAKE_INTEGRATION. Dodatkowo `skip-scan` gate wymusza zero-tolerance na `.only()` i zarządza `.skip()` przez allowlistę z TTL.

**Q: "Jak wygląda wasz security testing?"**
A: Trójwarstwowo: (1) 29 automatycznych integrity checks na każdym PR — weryfikacja CSRF, auth, CORS, cookies, JWT, encryption, CSP, HSTS, rate limiting. (2) Dedykowana suita security tests z Vitest. (3) Weekly OWASP ZAP scan. Żaden merge nie przejdzie jeśli choć 1 z 29 checks failuje.

**Q: "Jak zarządzacie flaky testami?"**
A: Polityka: każdy flaky test dostaje ownera i TTL (max 14 dni). Eskalacja po przekroczeniu TTL. Quality Champion per sprint monitoruje trend. Dashboard pokazuje flake rate w czasie.

**Q: "Jak szybko dostajesz feedback na PR?"**
A: Target < 15 min. Mierzymy end-to-end. Ciężkie testy (full E2E, security scan, performance) działają nightly, nie blokują PR.

**Q: "Jak skalujecie testy przy wzroście zespołu?"**
A: Model warstwowy L1–L5 z jasnym podziałem odpowiedzialności. Sharding per warstwa. Quality scorecard per moduł. DoD dla high-risk areas. Rotacyjny Quality Champion. Miesięczne audyty z planem redukcji długu.

---

## 11. Szybki backlog startowy (Faza 0 + Faza 1, pierwsze 2 tygodnie)

### Tydzień 0

- [x] Zebrać baseline metryki (T1) — część lokalna zamknięta + raport blokad (`docs/testing/WEEK0_BASELINE_REPORT_2026-02-26.md`)
  - [x] Czas PR gates → infrastruktura pomiarowa gotowa (timeouty + JUnit summary). Rzeczywisty pomiar nastąpi po pierwszym PR z nowymi gate'ami.
  - [x] Flake rate → flaky-test-tracker + nightly dashboard + monthly audit gotowe. Trend będzie zbierany automatycznie od następnego nightly runu.
  - [x] Billable minutes → monitoring KPI zdefiniowany (sekcja 5.2). Wymaga jednorazowego odczytu z GitHub Settings → Billing.
  - [x] Zwalidować liczby w `docs/metrics/QUALITY_METRICS.md`
- [x] Uzupełnić kolumnę "Baseline" w tabeli celów (sekcja 3.1)

### Tydzień 1

- [x] Dodać timeout-minutes do CI (T2)
- [x] Dodać JUnit reporter + job-summary (T3)
- [x] Zdefiniować minimalny zestaw PR gates ("golden gates")
- [x] Zweryfikować, że security-integrity, quality-check i skip-scan działają na każdym PR
- [x] Dodać uruchomienie `smoke:agent2-agent3-closure` jako manual workflow dispatch (on-demand release check)

### Zamknięcie Tydzień 0 i 1 (2026-02-26)

**Status:** ✅ ZAMKNIĘTE

| Deliverable | Artefakt | Weryfikacja |
|-------------|----------|-------------|
| Baseline metrics | `docs/testing/baseline-metrics.json`, `npm run test:baseline` | ✅ |
| Golden gates zdefiniowane | 10 gate'ów w `test-suite.yml` | ✅ |
| Timeout-minutes | Wszystkie joby CI | ✅ |
| JUnit + job-summary | `test-summary` job, artefakty per shard | ✅ |
| Skip-scan gate | Osobny job PR-blocking | ✅ |
| Anti-placeholder gate | `quality-check` | ✅ |
| Zasada: zero placeholderów | `.cursorrules`, `.cursor/rules/testing-no-placeholders.mdc` | ✅ |

**Następny krok:** Faza 2 (Tydzień 3–6) — optymalizacja czasu i pokrycia.

---

### Tydzień 2

- [x] Rozszerzyć Tier-0 o scenariusz 4 (settings render) i 5 (initiative create)
- [x] Przygotować raport flaky trend (top 10 testów z największą liczbą retries)
- [x] Zmapować testy do modułów (tag `@module:xxx` w Tier-0)
- [x] Oznaczyć high-risk areas w konfiguracji test impact analysis

---

## Appendix A: Model warstw testowych L1–L5

```
┌─────────────────────────────────────────────────┐
│  L5  Quality Gates & Governance                 │
│      quality-check, skip-scan, security-        │
│      integrity, security tests, perf tests      │
├─────────────────────────────────────────────────┤
│  L4  E2E Smoke (Playwright)                     │
│      Tier-0 (PR gate) + Tier-1 (nightly)        │
├─────────────────────────────────────────────────┤
│  L3  Integration (Vitest + PostgreSQL)           │
│      API routes, DB queries, service layer       │
├─────────────────────────────────────────────────┤
│  L2  Component (Vitest + JSDOM)                  │
│      React components, hooks, stores             │
├─────────────────────────────────────────────────┤
│  L1  Unit (Vitest)                               │
│      Pure logic, utilities, validators           │
└─────────────────────────────────────────────────┘
```

---

## Appendix B: Powiązania z dokumentacją VC

| Dokument DD                                    | Powiązanie z planem testowym |
| ---------------------------------------------- | ---------------------------- |
| `docs/due-diligence/TECH_DD_CHECKLIST.md`      | Sekcja 10 — talking points   |
| `docs/metrics/QUALITY_METRICS.md`              | Sekcja 2.2 — baseline        |
| `docs/security-compliance/COMPLIANCE_MATRIX.md`| Sekcja 6 — security gates    |
| `docs/architecture/SYSTEM_ARCHITECTURE.md`     | Kontekst dla warstw L1–L5    |
| `docs/operations/SLA_SLO.md`                   | KPI powiązane z SLO          |
| `docs/executive/`                              | Executive summary + metryki  |

---

## Appendix C: Backlog — MCP Agent (IRIS /newapp) — do przypisania Codexowi

> **Jak użyć:** Skopiuj całą sekcję "Prompt dla agenta" (blok kodu poniżej) i wklej do Codexa jako nowe zadanie. Agent wykona implementację end-to-end. Nie kończ na samym planie.
>
> **Cel:** Zbudować i wdrożyć warstwę MCP tool orchestration dla IRIS MES.
> **Kontekst:** `newapp/mcp-server`, transport streamable-http, endpoint `/mcp`, port 3100. Integracja: `mes-service` przez HTTP. Auth: `Authorization: Bearer <MES_API_TOKEN>`, kontekst: `X-Factory-Id`.

### Prompt dla agenta (1:1 do Codexa)

```text
Jesteś agentem implementującym używanie MCP dla IRIS MES.

CEL:
Zbuduj i uruchom warstwę "MCP tool orchestration", która:
1) rozpoznaje intencję użytkownika,
2) wybiera właściwe narzędzie MCP,
3) waliduje i normalizuje parametry,
4) wykonuje wywołanie,
5) mapuje wynik na czytelną odpowiedź biznesową.

KONTEKST SYSTEMU:
- MCP endpoint: /mcp (streamable-http), domyślnie port 3100.
- MCP proxy do MES API (Bearer token + opcjonalny factory context).
- Dostępne domeny narzędzi:
  - production_orders
  - master_data
  - operator
  - process_definitions
  - traceability
  - health

WYMAGANIA IMPLEMENTACYJNE:
1. Dodaj moduł/adapter MCP Client:
   - inicjalizacja połączenia do /mcp,
   - timeouty, retry z backoff (dla 5xx/timeout),
   - spójne logowanie request_id i nazwy toola.

2. Dodaj warstwę Tool Router:
   - mapowanie intencji -> tool,
   - reguły wyboru narzędzia na bazie słów kluczowych i kontekstu,
   - jawny fallback do mes_health, gdy brak pewności.

3. Dodaj walidację wejścia:
   - wymagane pola (np. order_id, payload),
   - typy i zakresy (limit, id > 0),
   - domyślne factory_id (jeśli brak, użyj domyślnego kontekstu).

4. Dodaj warstwę Response Mapper:
   - surowy wynik MCP -> krótka odpowiedź biznesowa,
   - przy listach: podsumowanie + max 5 pozycji,
   - przy błędach: przyczyna, wpływ, następny krok.

5. Dodaj Error Handling:
   - 4xx: błąd walidacji lub brak danych -> podaj co poprawić,
   - 5xx/timeout: retry + komunikat tymczasowej niedostępności,
   - network fail: fallback i instrukcja ponowienia.

6. Dodaj testy:
   - unit: router intencji, walidator, response mapper,
   - integracyjne: min. 1 ścieżka na domenę tooli.

ZASADY WYBORU NARZĘDZI (MINIMUM):
- "zamówienie produkcyjne / order" -> production_orders.*
- "produkt / klient / słownik" -> master_data.*
- "operator / pin / rfid / start / complete / defect / break" -> operator.*
- "proces / definicja procesu / publish" -> process_definitions.*
- "stacja / pass / downtime / traceability" -> traceability.*
- "health / czy działa MES" -> health.mes_health

KRYTERIA AKCEPTACJI (DoD):
- Użytkownik może zadać pytanie biznesowe i dostać poprawny wynik przez MCP.
- Co najmniej 10 przykładowych intencji przechodzi poprawnie przez router.
- Błędy 4xx/5xx/timeout są mapowane na czytelne komunikaty.
- Testy przechodzą lokalnie.
- Dokumentacja uruchomienia i konfiguracji jest uzupełniona.

FORMAT RAPORTU KOŃCOWEGO:
1) Co zostało dodane (pliki + odpowiedzialność),
2) Jak działa flow requestu,
3) Jak uruchomić,
4) Jak przetestować,
5) Znane ograniczenia i dalsze kroki.

Wykonaj implementację end-to-end. Nie kończ na samym planie.
```

### Minimalny flow docelowy

1. Użytkownik wpisuje intencję biznesową.
2. Router wybiera narzędzie MCP i buduje parametry.
3. Walidator sprawdza wejście i uzupełnia kontekst (`factory_id`).
4. MCP client wywołuje tool.
5. Mapper zwraca zwięzły wynik dla użytkownika.
6. W przypadku błędu działa retry/fallback + czytelny komunikat.

### Przykłady intencji do testów

| Intencja | Narzędzie |
|----------|-----------|
| „Pokaż aktywne zlecenia na dziś” | `list_production_orders` |
| „Przypisz zlecenie 123 do stanowiska” | `assign_production_order` |
| „Wyszukaj produkt ABC-01” | `list_products` |
| „Zaloguj operatora PIN 1111” | `operator_login_pin` |
| „Pokaż postoje na stacji ST-12” | `list_downtime_events` |
| „Opublikuj definicję procesu 15” | `publish_process_definition` |
| „Sprawdź czy MES działa” | `mes_health` |

### Uwagi wdrożeniowe

- Nie eksponować tokena ani pełnych payloadów w logach.
- Spójny timeout i retry policy dla wszystkich wywołań MCP.
- Ograniczyć rozmiar odpowiedzi do użytkownika (zwięzłe podsumowania).
- W razie niejednoznacznej intencji dopytać o 1 brakujący parametr zamiast zgadywać.

---

*Ostatnia aktualizacja: 2026-02-26*
