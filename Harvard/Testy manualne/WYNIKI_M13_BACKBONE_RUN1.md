# WYNIKI TESTÓW M13 — KRĘGOSŁUP INICJATYW (BACKBONE) · RUN1 (DRAFT)

**Data wykonania:** 2026-06-28
**Tester:** Claude (CTO — agent kręgosłupa inicjatyw)
**Branch:** feat/deliverables-w1
**Backend:** localhost:3001 (staging, caboose) — L3 jeszcze NIE uruchomiony
**Frontend:** localhost:3000 (Vite staging) — preview FE PENDING
**Zakres:** nowe zdolności kręgosłupa F0–F6 (poza GOTOWYM procesem statusów 92/92)
**SSOT:** `docs/initiatives/INITIATIVE_BACKBONE_HANDOFF.md` + `INITIATIVE_SYSTEM_SSOT.md`

> **DRAFT** — wiersze L1/L2 zweryfikowane testami (zielone). Wiersz **L3 (E2E)** czeka
> na żywy przebieg Playwright (komenda w §1 handoffu) i zostanie uzupełniony po nim.
> Klasyfikacja: jedna zdolność = jeden wiersz, status z realnych testów (nie deklaracji).

---

## Legenda

| Symbol | Znaczenie |
|---|---|
| ✅ PASS | Pokryte zielonymi testami (L1/L2/component) |
| 🟡 PARTIAL | Logika zielona, ale brak warstwy (FE preview / L3 E2E / mózg) |
| ⏳ PENDING | Zaplanowane, jeszcze nie wykonane (np. L3 E2E na żywym backendzie) |
| ❌ FAIL | Realna luka / regresja |

---

## Podsumowanie ogólne

| Faza | Zdolność | Testy (zielone) | Status |
|---|---|---|---|
| **F0** | Grunt generacji (org + portfolio + financials) | 12 (grounding 5 + financialsGrounding 7) | ✅ PASS |
| **F0** | Audyt → inicjatywa (`createInitiativeFromAudit`, source_type=audit) | 9 (auditInitiativeService) | ✅ PASS (kod) · 🟡 wymaga tabeli `audits` — **dodana w tym RUN** |
| **F2** | Skrzynka kandydatów (scan / list / accept / dismiss) | 24 (candidateService) | ✅ PASS |
| **F2** | Propozycja kart kandydata (`propose-cards`) | 3 (proposeCandidates) | ✅ PASS |
| **F2** | **Badge „AI sugeruje inicjatywę"** (insight/assessment/audyt) | **8 (InitiativeSuggestionBadge) — NOWE** | ✅ PASS · 🟡 insertion FE pending |
| **F3** | Silnik bloków kart (schema + critic) | 16 (cardBlockSchema) | ✅ PASS |
| **F3** | Renderer bloków (`CardBlockRenderer`) | 16 (component) | ✅ PASS |
| **F3** | Kontrakt walidacji karty (route) | 6 (validate-card) | ✅ PASS |
| **F4** | Zdrowie portfela — dedup Jaccard + balans | 21 (portfolioAnalysisService) | ✅ PASS |
| **F4** | Pokrycie MECE | 6 (portfolioMeceService) | ✅ PASS |
| **F5** | Materializacja (inicjatywa/portfel → deck/raport/tabela via M17) | 14 (initiativeMaterializeService) | ✅ PASS · 🟡 FE „Zrób materiał" pending |
| **F1** | Mózg generatora (orkiestracja brief→6 kart→auto-heal) | 20 (initiativeGeneratorBrain) | 🟡 PARTIAL — logika zielona, pełny tor jeszcze nie spięty E2E |
| **F6** | Handoff stage'ów (DONE→TRACKING, evaluateHandoff) | 24 (stageHandoffService) | ✅ PASS |
| **F6** | **Kontrakt rezultatów (DONE→TRACKING → benefits/KPI)** | **8 (resultsHandoff) — NOWE** | ✅ PASS |
| **L3** | E2E (audyt→inicjatywa, kandydaci, materiał, badge) | — | ⏳ **PENDING — do uzupełnienia po żywym przebiegu** |

**Suma testów zielonych (L1/L2/component):** **187**
(prior batch 171 z 13 plików + 16 nowych z 2 plików tego RUN).
**Pass rate weryfikowalnych:** 187/187 = **100%** (bez L3, który jeszcze nie wykonany).

---

## §A — Co dodał ten RUN (2026-06-28)

### A.1 ✅ Migracja `audits` (KLUCZOWE — odblokowuje F0 + F2)
**Plik:** `server/migrations/20260627_audits.sql`
Ustalenie: tabela `audits` **już istnieje** (`PostgresDatabase.ts:1599`, „Compliance Audits")
z kolumnami `id, organization_id, name, type, status, score, auditor, scheduled_date,
completed_date, findings, created_at` — ale **brakuje** kolumn, których wymagają żywe ścieżki:
- `auditInitiativeService` czyta `project_id` (cały `SELECT` padał bez niej),
- `initiativeCandidateService` czyta `title`, `summary`, `description` (skan audytów
  cicho zwracał `[]` przez błąd parsowania).

Migracja jest **ADDYTYWNA** (`ALTER TABLE audits ADD COLUMN IF NOT EXISTS …`) — dokłada
`project_id, title, summary, description, created_by` do istniejącej tabeli + indeks
`idx_audits_org`. `CREATE TABLE IF NOT EXISTS` byłby no-opem i NIE dodałby kolumn — stąd ALTER.
Opcjonalna tabela `audit_findings` (normalizacja na przyszłość, brak żywego odczytu dziś).
**Status:** zaaplikowanie na staging → odblokowuje audit→inicjatywa E2E (był no-op bez tabeli).

### A.2 ✅ Badge „AI sugeruje inicjatywę" — 8/8
**Plik:** `src/components/Initiatives/InitiativeSuggestionBadge.tsx`
Props `{ sourceType, sourceId, onCreate? }`. Czyta pending-kandydatów
(`GET /api/initiatives/candidates?status=pending`), renderuje się TYLKO gdy kandydat
pasuje do `(sourceType, sourceId)`. Klik → `onCreate(candidate)` jeśli podany, inaczej
`POST /candidates/:id/accept`. i18n PL fallbacki, dark-mode-aware, fail-soft (błąd = ukryty).
**Test:** `tests/components/Initiatives/InitiativeSuggestionBadge.test.tsx` — render-on-match,
ukryty bez dopasowania / pusta lista / inny typ, klik onCreate, fallback POST, fail-soft.

### A.3 ✅ Kontrakt rezultatów F6 (DONE→TRACKING) — 8/8
**Plik:** `tests/integration/initiatives/resultsHandoff.test.ts`
Weryfikuje, że handoff wykonanie→rezultaty WYMUSZA materiał korzyści:
- `GATE_TRANSITIONS.START_TRACKING` mapuje DONE→TRACKING; RBAC = Business Owner;
- `evaluateHandoff(DONE, TRACKING)` blokuje bez `gateApproved` (closure), przepuszcza z nim;
- boundary = `execution_to_results`; TRACKING idzie tylko do ARCHIVED.

**Ustalenie (uczciwe):** kontrakt rezultatów jest KOMPLETNY na poziomie interfejsu i RBAC.
Egzekucja wymogów benefits/KPI jest realna i dwupoziomowa:
- **konstytucyjny** (testowany tutaj): `evaluateHandoff` „closure" + `GATE_PERMISSIONS`,
- **runtime** (controller `InitiativeController.ts:1788`): twarda walidacja
  `BENEFITS_OWNER_REQUIRED` + `BENEFITS_KPI_REQUIRED` + `BENEFITS_KPI_TARGET_REQUIRED`
  (Business Owner + ≥1 KPI z target+unit) przy DONE→TRACKING.
Handoff NIE jest niekompletny — wymogi benefits/KPI są wpięte. Nie znaleziono luki.

---

## §B — Znane luki (do domknięcia)

| # | Luka | Faza | Charakter |
|---|---|---|---|
| B1 | **FE preview niezweryfikowane** — taby „Kandydaci"/„Zdrowie portfela" w Hubie, przyciski „Zrób materiał", insertion badge'a — wymaga `verify before claiming` w przeglądarce | F2/F4/F5 | wiring FE (kontendowane pliki) |
| B2 | **F1 Mózg generatora** — pełny tor brief→6 kart→auto-heal→DRAFT spięty E2E (logika zielona, orkiestracja nie udowodniona żywo) | F1 | orkiestracja |
| B3 | **Tabela `audits`** — przed tym RUN scan z audytów = no-op; **DODANA w A.1**, wymaga aplikacji na staging | F0/F2 | migracja (zrobiona) |
| B4 | **L3 E2E** — audyt→inicjatywa, accept kandydata→DRAFT, badge widoczny, materiał 1-klik — komenda w §1 handoffu | F0/F2/F5 | E2E pending |
| B5 | F3 migracja 6 kart rdzenia na `CardBlockRenderer` (kontrakt AI→CardSpec gotowy, adopcja pending) | F3 | adopcja |

---

## §C — Następna akcja (dla przebiegu L3)

1. Zaaplikuj `server/migrations/20260627_audits.sql` na staging (caboose).
2. Zaseeduj 1 audyt z `findings` (JSON array) w org testowej → uruchom
   `POST /api/initiatives/candidates/scan` → potwierdź kandydata `source_type=audit`.
3. Uruchom L3 (Playwright, komenda §1 handoffu) dla: audyt→inicjatywa, accept→DRAFT,
   badge render na widoku audytu/insightu/assessmentu, materiał 1-klik.
4. Uzupełnij wiersz **L3** w tabeli §Podsumowanie + dopisz wynik tutaj.

---

*Raport DRAFT — RUN1. Po L3 → RUN2 z pełną klasyfikacją E2E.*
