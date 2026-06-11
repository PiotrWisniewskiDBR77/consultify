# M22 — AI OS / Internal Tools — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `f8fec595`) · **Audytor:** Claude (subagent autonomiczny)
**Wejścia:** `Harvard/podzial/inventory/INV_F_ai-os_organizacja.md` (sekcja M22) · poprzednia karta: brak
**Evidence:** `Harvard/modules/M22-ai-os/evidence/` (Fazy 3/4 deferred — brak plików runtime)

---

## OCENA: 51/100 — Tier: Alpha · status 🟦 NIEPEŁNY (bez Fazy 3 i Fazy 4)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 19 | 23 z 26 funkcji REALNE; Artifacts za podwójną flagą (INTERNAL_TOOLS + ENABLE_V8_GLOBAL); OAuth-session symulowane; Build Milestones statyczne |
| B. Wiring i dane | 15 | 11 | 6 wave-service'ów z tabelami + migracjami; `_actionDecisionRoutes` importowany lecz nigdy mountowany (martwy import + 1188 linii nieosiągalnych) |
| C. Testy automatyczne | 15 | 10 | Wave7/8/9 unit tests (612+538+801 linii); actionDecision+research unit; e2e smoke w CI nightly; brak route-integration tests dla wave backendu; Wave 6 bez unit testu |
| D. Żywa użyteczność | 15 | 0 | Faza 4 deferred — brak screenshotów |
| E. Kanony/UI | 10 | 4 | Brak ModuleHub/MELS; brak TableCanon §27 we wszystkich listach; zero i18n (hardcoded EN) we wszystkich Wave panelach |
| F. Bezpieczeństwo/dostęp | 10 | 7 | Trzy warstwy spójne (betaAccess.ts + InternalToolsGate FE + internalTools.middleware.ts BE); org-scope na wszystkich serwisach; brak cross-org IDOR; brak x-*-role header abuse |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 deferred — brak smoke curl |
| **Hard cap zastosowany?** | — | — | Faza 4 deferred → max 70; zero route-integration tests → max 70; wynik 51 < 70 — hard cap nie zmienia oceny |

**Werdykt jednym akapitem:** AI OS jest najlepiej zabezpieczonym modułem w aplikacji — podwójny gating (FE + BE) z domain/role/orgId check działa prawidłowo, org-scope jest egzekwowany we wszystkich serwisach i nie ma wzorców cross-org IDOR ani x-\*-role header abuse. Sześć wave-service'ów (5–9 + research) ma pełne wiring FE↔BE↔DB z migracjami i service-unit testami. Główne blokady wyższego tiera: (1) `_actionDecisionRoutes` — 1188 linii governance kodu (PolicyEngine, AsyncJob, audit export) zaimportowanych ale nigdy mountowanych; (2) Artifacts panel zawsze widoczny mimo 404 API gdy ENABLE\_V8\_GLOBAL off — UX deception P1; (3) brak route-level integration testów dla wave backendu; (4) zero i18n we wszystkich panelach Wave; (5) UI nie stosuje TABLE\_AND\_PREVIEW\_CANON §27.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)

### Pozycje inwentarza — checklista

| # | Funkcja | Status z inwentarza | Werdykt audytu | Dowód |
|---|---|---|---|---|
| 1.1 | AIOSHub — hub nawigacyjny | DZIAŁA | REALNE | `AIOSHub.tsx:1-172` |
| 1.2 | AIOSHub — Build Milestones (tabela 10 fal) | STUB — statyczne | STUB/statyczne | `AIOSHub.tsx` — hardcoded markup, brak endpointu |
| 1.3 | AIOSHub — V10 voice config live | DZIAŁA | REALNE | `/api/v10/teresa/voice-config` live call |
| 2.1 | ActionCenter — lista propozycji (scope mine→org) | DZIAŁA | REALNE | `ai.routes.ts:6001` → `aiRunLedgerService` |
| 2.2 | ActionCenter — Approve/Reject/Execute | DZIAŁA | REALNE | `ai.routes.ts:5942,5962,5982` |
| 2.3 | ActionCenter — Run Ledger read-only | DZIAŁA | REALNE | `ai.routes.ts:6054` |
| 2.4 | ActionCenter — Audit Viewer + rollback + eventy | DZIAŁA | REALNE | `ai.routes.ts:6098,6151` |
| 2.5 | ActionCenter — deep-link `?actionId=` | DZIAŁA | REALNE | `ActionCenter.tsx:49` |
| 3.1 | Research — tworzenie sesji | DZIAŁA | REALNE | `research.routes.ts:87-116` → `researchSessionService` |
| 3.2 | Research — lifecycle Approve→Start→Pause→Resume→Retry | DZIAŁA | REALNE | `research.routes.ts:127-244` |
| 3.3 | Research — auto-refresh 5s | DZIAŁA | REALNE | `ResearchSessionsDock.tsx` polling |
| 3.4 | Research — Evidence Graph (confidence, source, sprzeczności) | DZIAŁA | REALNE | `research.routes.ts:246-293` |
| 3.5 | Research — Final Artifact (raport markdown) | DZIAŁA | REALNE | `researchSessionService.ts` |
| 3.6 | Research — tryb compact (osadzany) | DZIAŁA | REALNE | `ResearchSessionsDock.tsx` prop |
| 4.1 | Artifacts — Generate Output | ZA FLAGĄ | REALNE (za INTERNAL_TOOLS + ENABLE_V8_GLOBAL) | `artifacts.routes.ts:38-40` → `v8OutputsGate` |
| 4.2 | Artifacts — Create Artifact (11 typów) | ZA FLAGĄ | REALNE (za flagami) | `wave5ArtifactRuntimeService.ts` |
| 4.3 | Artifacts — Document Filling (`{{pola}}`) | ZA FLAGĄ | REALNE (za flagami) | `wave5ArtifactRuntimeService.ts` |
| 4.4 | Artifacts — Mutation proposals (diff→approve→commit) | ZA FLAGĄ | REALNE (za flagami) | `wave5ArtifactRuntimeService.ts` |
| 4.5 | Artifacts — Version lineage v1..vN | ZA FLAGĄ | REALNE (za flagami) | `wave5ArtifactRuntimeService.ts` |
| 4.6 | Artifacts — Provenance footer + Export manifest | ZA FLAGĄ | REALNE (za flagami) | `wave5ArtifactRuntimeService.ts` |
| 5.1–5.5 | Memory & Scope (Wave 6) — wszystkie funkcje | DZIAŁA | REALNE | `wave6-context.routes.ts` → `wave6ContextLearningService` |
| 6.1–6.3, 6.5, 6.6 | Connectors (Wave 7) — katalog/register/execute/health/runs | DZIAŁA | REALNE | `wave7-connectors.routes.ts` |
| 6.4 | Connectors — OAuth Session Lifecycle | DZIAŁA-ALE-SYMULOWANE | STUB (manual state toggle, nie real OAuth flow) | `wave7-connectors.routes.ts:80-113` |
| 7.1–7.6 | Agents (Wave 8) — katalog/launch/tool/schedules/history | DZIAŁA | REALNE | `wave8-agents.routes.ts` |
| 8.1–8.6 | KPI/ROI & AI Ops (Wave 9) — wszystkie | DZIAŁA | REALNE | `wave9-outcomes.routes.ts` |

### Kanony obowiązujące
- **TABLE\_AND\_PREVIEW\_CANON §27**: dotyczy list w ActionCenter, ResearchSessions, Artifacts — NIE zastosowany
- **betaAccess.ts**: `INTERNAL_TOOLS: 'open'` — badge beta, nie lock; dostęp przez `canUseInternalTools()` ✓
- **Beta-gating**: własny mechanizm (FE gate + BE middleware), nie wchodzi w `lockClosedBetaModules`
- **CARD\_CONTENT\_FORMULA**: nie dotyczy (moduł nie produkuje kart Insight/Initiative)

### Scenariusze krytyczne (Faza 4 target)

| SC | Scenariusz | Priorytet |
|---|---|---|
| SC1 | Tworzenie + zatwierdzanie + uruchomienie Research Session (E2E) + przeładuj → status zachowany | P0 |
| SC2 | Approve/Execute AI action z Action Center + weryfikacja w Run Ledger | P0 |
| SC3 | Zapis Wave 6 Memory Candidate → Approve → weryfikacja persist po reloadzie | P1 |
| SC4 | Rejestracja Wave 7 Connector + execute tool | P1 |
| SC5 | Launch Wave 8 Agent + przegląd run history | P1 |
| SC6 | Dostęp na koncie bez dbr77.com → oczekiwany redirect/404 (security) | P0 |
| SC7 | Artifacts panel przy ENABLE\_V8\_GLOBAL=false → czy pojawia się czytelny error | P1 |

---

## 1. Prawda kodu (FAZA 1)

### 1a. REALNE (DB-backed, prawdziwe endpointy)

- **ActionCenter** (`ActionCenter.tsx`): `GET /api/ai/actions/center` → `ai.routes.ts:6001` → `listActionCenter()` + `repairTeresaAIRunMirrorsForActionCenter()`. Org-scoped przez `req.organizationId`.
- **Research Sessions** (`ResearchSessionsDock.tsx`): `POST /api/research/sessions` → `research.routes.ts:87` → `planResearchSession()`; lifecycle transitions przez `transitionResearchSession()`; background start przez `beginResearchSessionInBackground()`. Tabela `research_evidence` (migracja `607_research_evidence_v3.sql`). Connectors EDGAR/GDELT/OpenAlex/Crossref/Wappalyzer — realne HTTP calls do zewnętrznych API.
- **Wave 6 Context** (`Wave6ContextLearningPanel.tsx`): `GET/POST /api/ai-context/*` → `wave6-context.routes.ts` → `wave6ContextLearningService`. Tabele: `wave6_context_snapshots`, `wave6_context_ledger`, `wave6_memory_candidates`, `wave6_memory_stewardship_decisions` (migracja `20260425_wave6_context_learning.sql`).
- **Wave 7 Connectors** (`Wave7ConnectorAdminPanel.tsx`): `GET/POST/PATCH /api/ai-connectors/*` → `wave7-connectors.routes.ts` → `wave7ConnectorRuntimeService`. Tabele: `wave7_connectors`, `wave7_connector_runs` (migracja `20260425_wave7_connector_runtime.sql`).
- **Wave 8 Agents** (`Wave8AgentCatalogPanel.tsx`): `GET/POST /api/ai-agents/*` → `wave8-agents.routes.ts` → `wave8AgentRuntimeService`. Tabele: `wave8_agent_definitions`, `wave8_agent_runs`, `wave8_agent_schedules`, `wave8_agent_notifications` (migracja `20260425_wave8_agent_runtime.sql`).
- **Wave 9 Outcomes** (`Wave9OutcomeAIOpsPanel.tsx`): `GET/POST /api/ai-outcomes/*` → `wave9-outcomes.routes.ts` → `wave9OutcomeRuntimeService`. Tabele: `wave9_outcomes`, `wave9_evidence_registry`, `wave9_provider_health`, `wave9_eval_runs`, `wave9_acceptance_runs`, `wave9_incidents`, `wave9_acceptance_decisions` (migracja `20260425_wave9_outcome_runtime.sql`).
- **Wave 5 Artifacts** (`Wave5ArtifactRuntimePanel.tsx`): `GET/POST /api/artifacts/*` → `artifacts.routes.ts` → `wave5ArtifactRuntimeService`. Tabele: `wave5_artifacts`, `wave5_artifact_versions`, `wave5_mutation_proposals` (migracja `20260425_wave5_artifact_runtime.sql`). Działa tylko gdy `ENABLE_V8_GLOBAL=true`.

### 1b. MOCK / STUB / fabrykowane klientem

- **AIOSHub Build Milestones** (`AIOSHub.tsx`): tabela 10 fal — statyczny HTML/JSX, brak endpointu, nie jest live health check. Status: UI dekoracja.
- **OAuth Session Lifecycle** (Wave 7, `wave7-connectors.routes.ts:80-113`): `PATCH /:connectorId` akceptuje `status`, `tokenExpiresAt`, `accessRevokedAt`, `revokedReason` z body — manualny zapis stanów OAuth do bazy; brak realnego OAuth provider flow (redirect/callback/token exchange). Stan symulowany przez operatora.

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE

- **Artifacts panel widoczny przy 404 API** (`artifacts.routes.ts:38-40`, `Gateway.ts:380,746-747`): `Wave5ArtifactRuntimePanel.tsx` zawsze renderowany (za `internalToolsGuard`), ale `router.use(v8OutputsGate)` wewnątrz artifacts.routes.ts zwraca 404 gdy `ENABLE_V8_GLOBAL != 'true'`. Podwójny mount (`Gateway.ts:380` guard-only + `Gateway.ts:747` v8FeatureGate+router) — gdy INTERNAL_TOOLS on ale V8 off: panel widoczny, kliknięcie = 404 bez czytelnego komunikatu. **P1 UX breaking.**

### 1d. MARTWY KOD

- **`_actionDecisionRoutes`** (`Gateway.ts:16`): `import _actionDecisionRoutes from './routes/actionDecisions.routes.js'` — prefiks `_` = nieużywany, nigdy nie mountowany przez `app.use(...)`. Plik `actionDecisions.routes.ts` (1188 linii) z endpointami `/decide`, `/audit/export`, `/execute-async`, `/jobs/*`, PolicyEngine, AsyncJobService — kompletnie nieosiągalny przez HTTP. Akcje Approve/Reject obsługuje `ai.routes.ts:5942+`, nie ten plik. **Rekomendacja: wepnij lub usuń — zdecyduj.**

- **Guardy bez routerów** (`Gateway.ts:388-394`): 7 wpisów `app.use('/api/ai-training', ...internalToolsGuard)`, `/api/ai-infrastructure`, `/api/ai-development`, `/api/ai-budgets`, `/api/ai-prompts` (duplikat linii 374), `/api/ai-analytics`, `/api/ai-operations` — guard zarejestrowany, brak mountowanego routera dla tych ścieżek. Requesty przechodzą guard → 404. **Rekomendacja: wytnij lub zamontuj brakujące routery.**

### 1e. Wiring FE↔BE↔DB

| Funkcja | Endpoint FE → BE | Tabela(e) | Migracja | Status |
|---|---|---|---|---|
| Research Sessions | `POST/GET /api/research/sessions` | `research_evidence`, `research_sessions` | `607_research_evidence_v3.sql` | REALNE |
| Wave 6 Context | `GET/POST /api/ai-context/*` | `wave6_context_snapshots`, `wave6_context_ledger`, `wave6_memory_candidates`, `wave6_memory_stewardship_decisions` | `20260425_wave6_context_learning.sql` | REALNE |
| Wave 7 Connectors | `GET/POST/PATCH /api/ai-connectors/*` | `wave7_connectors`, `wave7_connector_runs` | `20260425_wave7_connector_runtime.sql` | REALNE |
| Wave 8 Agents | `GET/POST /api/ai-agents/*` | `wave8_agent_definitions`, `wave8_agent_runs`, `wave8_agent_schedules`, `wave8_agent_notifications` | `20260425_wave8_agent_runtime.sql` | REALNE |
| Wave 9 Outcomes | `GET/POST /api/ai-outcomes/*` | `wave9_outcomes`, `wave9_evidence_registry`, `wave9_provider_health`, `wave9_eval_runs`, `wave9_acceptance_runs`, `wave9_incidents`, `wave9_acceptance_decisions` | `20260425_wave9_outcome_runtime.sql` | REALNE |
| Artifacts (Wave 5) | `GET/POST /api/artifacts/*` | `wave5_artifacts`, `wave5_artifact_versions`, `wave5_mutation_proposals` | `20260425_wave5_artifact_runtime.sql` | REALNE (za flagą) |
| AI Memory | `GET/POST/DELETE /api/ai-memory/*` | `ai_user_memory` | `075_ai_user_memory.sql` | REALNE |
| Action Center | `GET /api/ai/actions/center` | `ai_runs` (via `aiRunLedgerService`) | istniejące migracje M01 | REALNE |
| actionDecisions governance | (nie zamountowany) | `action_decisions`, `action_proposals`, `policy_rules`, async_jobs... | brak dedykowanej widocznej migracji | MARTWY KOD |

### 1f. Flagi

| Flaga | Default BE | Default FE | Kto włącza | Wpływ na moduł |
|---|---|---|---|---|
| `NODE_ENV=development/test` | — | — | infrastruktura | Bypass całego `internalTools.middleware.ts` (domain/role check pomijany) |
| `INTERNAL_TOOLS_ENABLED` | `false` (`.env.example:177`) | `VITE_INTERNAL_TOOLS_ENABLED=false` (`.env.example:185`) | operator (Railway Variables) | Cały moduł 404 gdy false |
| `ENABLE_V8_GLOBAL` | `true` (`.env:32`), `true` (`.env.staging.local:14`) | — | operator | Artifacts/ArtifactRuns 404 gdy false |
| `INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS` | `dbr77.com` | `VITE_*` analogicznie | operator | Whitelist domen |
| `INTERNAL_TOOLS_ALLOWED_ROLES` | `SUPERADMIN,ADMIN,OWNER` | analogicznie | operator | Whitelist ról |
| `INTERNAL_TOOLS_ALLOWED_ORG_IDS` | puste (all orgs) | analogicznie | operator | Opcjonalna whitelist org ID |

**Uwaga krytyczna:** `INTERNAL_TOOLS_ENABLED=false` w `.env.example` — na staging/prod Railway musi być explicite ustawione na `true`, inaczej cały moduł jest 404 niezależnie od ENABLE_V8_GLOBAL.

### 1g. Połączenia międzymodułowe

| Kierunek | Moduł | Mechanizm | Plik:linia | Status |
|---|---|---|---|---|
| WEJŚCIE ← | M01 Czat (Teresa) | `ai_runs`/`ai_run_ledger` mirror — ActionCenter czyta run history Teresy | `ai.routes.ts:6013-6024` | DZIAŁA |
| WEJŚCIE ← | M20 Tabele | `tp_connectors` — Wave 7 linkuje do source bindingów (`link` endpoint) | `wave7-connectors.routes.ts:117-128` | DZIAŁA |
| WEJŚCIE ← | M13 Inicjatywy | `initiative_id` FK w `wave9_outcomes` | `wave9OutcomeRuntimeService.ts:554+` | DZIAŁA |
| WYJŚCIE → | M02 Canvas | Research Sessions — tryb compact osadzany w Canvas | `ResearchSessionsDock.tsx` prop `compact` | DZIAŁA |
| WYJŚCIE → | M01 Czat | Deep-link `?actionId=` z notyfikacji chat handoff | `ActionCenter.tsx:49` | DZIAŁA |
| WYJŚCIE → | M17 Outputs Hub | Wave 5 Artifacts — `/api/public/artifacts` share token (public view) | `Gateway.ts:450`, `public-artifacts.routes.ts` | DZIAŁA |
| WYJŚCIE → | M01 Teresa-chat | Wave 6 memory candidates zasilają kontekst Teresy | `wave6ContextLearningService.ts` | DZIAŁA |

---

## 2. Testy automatyczne (FAZA 2)

### Inwentarz testów

| Plik | Typ | Zakres | Linii | W CI? |
|---|---|---|---|---|
| `tests/unit/backend/actionDecision.service.test.js` | unit | `actionDecisionService.js` — recordDecision, walidacje | 199 | tak (test-suite.yml) |
| `tests/unit/backend/researchSessionService.wave4-runtime.test.ts` | unit | `researchSessionService` — lifecycle transitions | 733 | tak |
| `tests/unit/backend/wave7ConnectorRuntimeService.test.ts` | unit | Wave 7 — CRUD, ACL, health, execute | 612 | tak |
| `tests/unit/backend/wave8AgentRuntimeService.test.ts` | unit | Wave 8 — definitions, launch, schedules | 538 | tak |
| `tests/unit/backend/wave9OutcomeRuntimeService.test.ts` | unit | Wave 9 — outcomes, evidence, acceptance gate | 801 | tak |
| `tests/integration/actionDecision.test.ts` | integration | actionDecisionService (mock-db) | ~80 | tak |
| `tests/e2e/smoke/ai-os-route-matrix.spec.ts` | E2E smoke | AI OS route rendering (7 tras, nie-chat redirect) | 85 | tak (e2e-nightly.yml) |

**Uwaga:** Testy nie zostały uruchomione w tej sesji (brak środowiska runtime). Ocena oparta na statycznej analizie kodu.

### Mapa pokrycia scenariuszy krytycznych

| Scenariusz | Test FE | Test BE unit | Test E2E | W CI | Luka |
|---|---|---|---|---|---|
| SC1 — Research Session E2E | brak | `researchSessionService.wave4-runtime.test.ts` ✓ | brak dedykowanego (route smoke only) | tak | brak route-integration test |
| SC2 — Approve/Execute Action | brak | `actionDecision.service.test.js` ✓ | brak | tak | brak route-integration |
| SC3 — Wave 6 Memory persist | brak | **brak** wave6 unit testu | brak | nie | BRAK CAŁKOWITY |
| SC4 — Wave 7 Connector execute | brak | `wave7ConnectorRuntimeService.test.ts` ✓ | brak | nie | brak route-integration |
| SC5 — Wave 8 Agent launch | brak | `wave8AgentRuntimeService.test.ts` ✓ | brak | nie | brak route-integration |
| SC6 — Security / non-dbr77 domain | brak | **brak** middleware test | brak | nie | BRAK CAŁKOWITY |
| SC7 — Artifacts 404 przy V8 off | brak | brak | brak | nie | BRAK CAŁKOWITY |

### Komenda uruchomienia (do wykonania przy Fazie 4)
```bash
npx vitest run \
  tests/unit/backend/wave7ConnectorRuntimeService.test.ts \
  tests/unit/backend/wave8AgentRuntimeService.test.ts \
  tests/unit/backend/wave9OutcomeRuntimeService.test.ts \
  tests/unit/backend/researchSessionService.wave4-runtime.test.ts \
  tests/unit/backend/actionDecision.service.test.js \
  tests/integration/actionDecision.test.ts
```

### Backlog testowy

| # | Typ | Plik docelowy | Scenariusz | Priorytet |
|---|---|---|---|---|
| T1 | security integration | `tests/integration/routes/internalTools.middleware.test.ts` | 404 dla domeny spoza whitelist (non-dbr77.com) | P0 |
| T2 | integration route | `tests/integration/routes/wave6-context.routes.test.ts` | Wave 6: capture snapshot → list → approve candidate | P1 |
| T3 | integration route | `tests/integration/routes/wave7-connectors.routes.test.ts` | Wave 7: register → execute tool → runs list | P1 |
| T4 | integration route | `tests/integration/routes/wave8-agents.routes.test.ts` | Wave 8: launch agent → get runs | P1 |
| T5 | integration route | `tests/integration/routes/wave9-outcomes.routes.test.ts` | Wave 9: create outcome → final acceptance gate | P1 |
| T6 | unit | `tests/unit/backend/wave6ContextLearningService.test.ts` | Memory stewardship: approve/reject/expire | P2 |
| T7 | E2E smoke | `tests/e2e/smoke/ai-os-artifacts-gate.spec.ts` | Artifacts panel przy ENABLE_V8_GLOBAL=false — czytelny error | P1 |

---

## 3. Środowiska / Railway (FAZA 3) — PENDING

**Status:** DEFERRED. Wymaga dostępu do Railway dashboard i curl z tokenem.

| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit | — | — | PENDING |
| `INTERNAL_TOOLS_ENABLED` | — | — | PENDING (`.env.example:177` default false) |
| `ENABLE_V8_GLOBAL` | true (`.env.staging.local:14`) | — | staging OK, prod PENDING |
| Migracje wave5-9 zastosowane | — | — | PENDING |
| Smoke `/api/research/sessions` | — | — | PENDING |
| Smoke `/api/ai-connectors/` | — | — | PENDING |
| Błędy w logach 24-48h | — | — | PENDING |

**Dowody:** brak (evidence/ pusta)

---

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście) — PENDING

**Status:** DEFERRED. Wymaga sesji z przeglądarką (preview_start).

| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| SC1 | Research Session: create → approve → start → reload | PENDING | evidence/f4_sc1_*.png |
| SC2 | Action Center: approve action → execute → run ledger | PENDING | evidence/f4_sc2_*.png |
| SC3 | Wave 6 Memory: save candidate → approve → reload verify | PENDING | evidence/f4_sc3_*.png |
| SC4 | Wave 7 Connector: register → execute tool | PENDING | evidence/f4_sc4_*.png |
| SC5 | Wave 8 Agent: launch → run history | PENDING | evidence/f4_sc5_*.png |
| SC6 | Security: non-dbr77 account → redirect/404 | PENDING | evidence/f4_sc6_*.png |
| SC7 | Artifacts V8 off: czytelny error | PENDING | evidence/f4_sc7_*.png |

**Skrypt Fazy 4:** zaloguj piotr.wisniewski@dbr77.com → każdy SC → console+network check → role member (jeśli aplikuje).

---

## 5. Kanony i standardy (FAZA 5)

### TABLE\_AND\_PREVIEW\_CANON §27 — ocena powierzchni

| Powierzchnia | A (kolumny) | E (empty state) | F (loading) | G (error) | H (preview panel) | I (menu §27) | Odstępstwa |
|---|---|---|---|---|---|---|---|
| ActionCenter — lista akcji | własne divs, nie DataTable | częściowy | spinner | podstawowy | brak | approve/reject inline | ❌ niezgodny |
| ResearchSessions — lista sesji | własne divs | „No sessions" tekst | spinner | podstawowy | brak panel | status badge | ❌ niezgodny |
| Wave 7 Connectors — katalog | własne divs | brak | spinner | podstawowy | brak | inline buttons | ❌ niezgodny |
| Wave 8 Agents — katalog | własne divs | brak | spinner | podstawowy | brak | inline launch | ❌ niezgodny |
| Wave 9 — lista outcomes | własne divs | brak | spinner | podstawowy | brak | — | ❌ niezgodny |

**Wniosek §27:** Moduł nie stosuje `TABLE_AND_PREVIEW_CANON`. Wszystkie panele mają własne listy inline (divs). Brak DataTable, brak Menu 1/2/3, brak sortowania kolumnowego, brak paginacji, brak preview-panel. Moduł DBR77-only — celowe odstępstwo lub zaległość.

### Wzorzec hubowy (ModuleHub / MELS)
- `AIOSHub.tsx` (172 linii): własna karta-grid implementacja, nie ModuleHub ani MELS. Brak tab-nawigacji zgodnej ze wzorcem.
- Wave panele: samodzielne komponenty bez MELS header, bez standardowych breadcrumbs.

### i18n
- `ActionCenter.tsx`, `ResearchSessionsDock.tsx`, `AIOSHub.tsx`, `Wave5-9*.tsx`: **brak `useTranslation`**. Wszystkie stringi hardcoded EN. Moduł DBR77-only (team PL), ale precedens złej praktyki.

### Beta gating
- `betaAccess.ts:50`: `INTERNAL_TOOLS: 'open'` — badge beta, brak lock. Dostęp przez `canUseInternalTools()` + BE middleware. Zgodne ze SSOT betaAccess.ts. ✅

---

## 6. Bezpieczeństwo i dostęp (FAZA 6)

### Trzy warstwy gatingu

| Warstwa | Implementacja | Status |
|---|---|---|
| 1. Nawigacja (sidebar) | `Sidebar.tsx:164`: `showInternalToolsMenu = canUseInternalTools(currentUser)` | ✅ działa |
| 2. Route guard (FE) | `RouterSync.tsx:275`: redirect gdy `!canUseInternalTools()`; `AppRoutes.tsx:578-581`: `InternalToolsGate` → `<Navigate to="/chat">` | ✅ działa |
| 3. API middleware (BE) | `Gateway.ts:372-394`: `internalToolsGuard = [gatewayVerifyToken, requireInternalToolsAccess]` przed routerami | ✅ działa |

**Spójność:** Wszystkie trzy warstwy zgodne — brak wzorca „beta-lock tylko nawigacyjny". BE middleware weryfikuje domain + role + orgId niezależnie od FE.

### Org-scope na endpointach

| Serwis | Query pattern | Org-scope |
|---|---|---|
| `wave5ArtifactRuntimeService.ts:579` | `WHERE artifact_id = ? AND organization_id = ?` | ✅ |
| `wave7ConnectorRuntimeService.ts` | `organization_id` w każdym INSERT+SELECT | ✅ |
| `wave8AgentRuntimeService.ts:452` | katalog: `WHERE organization_id IS NULL OR organization_id = ?` | ✅ (shared catalog design) |
| `wave9OutcomeRuntimeService.ts` | `WHERE organization_id = ?` wszędzie | ✅ |
| `research.routes.ts:67-83` | `listResearchSessions({ organizationId })` | ✅ |
| `aiMemory.routes.ts:44` | `WHERE user_id = ?` (user-scoped, nie org) | ✅ (personal memory) |

**Wynik:** Brak cross-org IDOR w analizowanych serwisach.

### Wzorzec x-\*-role (M15)
Przeszukano `wave7-connectors.routes.ts`, `wave8-agents.routes.ts`, `wave9-outcomes.routes.ts`, `research.routes.ts` — **brak `req.headers[...]` do odczytu roli**. Role z `req.user.role` (JWT). ✅

### Findingi bezpieczeństwa

**[P1] — Artifacts panel widoczny przy API 404 (UX deception)**
- Plik: `Gateway.ts:380` (internalToolsGuard na `/api/artifacts`) + `artifacts.routes.ts:40` (`v8OutputsGate` wewnątrz routera) + `Gateway.ts:747` (v8FeatureGate + router mount)
- Gdy `INTERNAL_TOOLS_ENABLED=true` ale `ENABLE_V8_GLOBAL=false`: panel `Wave5ArtifactRuntimePanel.tsx` renderuje się w pełni, kliknięcie dowolnego przycisku → 404 bez komunikatu użytkownikowi
- Efekt: użytkownik widzi w pełni działający interfejs Artifacts ale każda akcja kończy się błędem

**[P2] — `_actionDecisionRoutes` — dead import (Gateway.ts:16)**
- 1188 linii governance kodu (PolicyEngine, AsyncJobService, audit export CSV) zaimportowanych ale nieosiągalnych
- Brak security impact (nigdy nie jest HTTP-dostępny), ale potencjalne przeoczenie przez dewelopera
- Rekomendacja: zdecydować mount vs usunięcie

**[P2] — DEV bypass w `internalTools.middleware.ts:39`**
- `if (NODE_ENV === 'development' || NODE_ENV === 'test') return true` — każdy auth user w DEV pomija domain/role check
- Świadomy design dla DX, ale ryzyko jeśli staging ma NODE_ENV=development
- Rekomendacja: udokumentować + sprawdzić NODE_ENV na staging

**[P3] — Guardy bez routerów (Gateway.ts:388-394)**
- 7 internalToolsGuard mountów dla ścieżek bez istniejącego routera (ai-training, ai-infrastructure, ai-development, ai-budgets, ai-analytics, ai-operations + duplikat ai-prompts)
- Brak security impact (guard+404), ale zaśmiecenie konfiguracji

---

## 7. PLAN DOKOŃCZENIA (FAZA 8)

### Fala 1 — Integralność (P0)

| Co | Dlaczego (1 zdanie z dowodem) | Jak zweryfikować |
|---|---|---|
| Napraw UX dla Artifacts przy ENABLE_V8_GLOBAL=false | `Wave5ArtifactRuntimePanel.tsx` renderuje się zawsze mimo 404 API (`artifacts.routes.ts:40`) — użytkownik widzi aktywne przyciski które zawsze kończą się błędem | Screenshot SC7: po kliknięciu "Create Artifact" pojawia się czytelny komunikat "V8 not enabled"; lub panel schowany gdy V8 off |
| Dodaj test middleware security (T1 backlogu) | Brak testu weryfikującego 404 dla non-dbr77.com domain — `internalTools.middleware.ts:72-76` nie jest testowany jako HTTP gate | `tests/integration/routes/internalTools.middleware.test.ts` green w CI (test-suite.yml) |

### Fala 2 — Domknięcie wartości (P1)

| Co | Dlaczego | Jak zweryfikować |
|---|---|---|
| Zdecyduj o `_actionDecisionRoutes`: montuj lub usuń (`Gateway.ts:16`, `actionDecisions.routes.ts`) | 1188 linii PolicyEngine/AsyncJob/audit-export niedostępne przez HTTP — wartościowe governance features są dead code | Jeśli mount: `POST /api/ai/actions/decide` zwraca 200; jeśli usunięcie: Gateway.ts bez tego importu, tsc clean |
| Usuń guardy bez routerów (`Gateway.ts:388-394`) | 7 `internalToolsGuard` dla ścieżek bez routerów — potencjalny konfuzja + zaśmiecenie konfiguracji | Gateway.ts bez tych 7 linii; tsc + smoke test bez regresji |
| Dodaj route-integration tests Wave 6/7/8/9 (T2-T5 backlogu) | Brak route-level integration testów — service-unit testy nie pokrywają HTTP contract ani middleware stacku | 4 nowe test pliki green w CI |
| Realny OAuth flow dla Wave 7 Connectors (lub wyraźny UX label) | `wave7-connectors.routes.ts:80-113` — manualny stan OAuth mylący dla użytkownika | Connector OAuth section pokazuje label „Manual / Simulated" LUB realny OAuth redirect działa |

### Fala 3 — Jakość i kanony (P2)

| Co | Dlaczego | Jak zweryfikować |
|---|---|---|
| TABLE\_AND\_PREVIEW\_CANON §27 dla ActionCenter + ResearchSessions | Własne divs — brak sortowania/paginacji/preview-panel we wszystkich listach | §27 checklist A-H green dla ActionCenter i ResearchSessions |
| i18n dla Wave 5–9 paneli + ActionCenter + ResearchSessions | Zero `useTranslation` — hardcoded EN strings w całym module | `i18n-check.yml` CI green po dodaniu kluczy EN+PL |
| Unit test Wave 6 (T6 backlogu) | Wave 6 nie ma service-unit testu (jedyna wave bez unit test) | `tests/unit/backend/wave6ContextLearningService.test.ts` green |
| Cleanup: remove `_actionDecisionRoutes` import lub mount | `Gateway.ts:16` — martwy import z prefixem `_` | tsc `--noUnusedLocals` clean |

---

## Definition of Done (odhaczane przy realizacji)

- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (SC1-SC7) zielone w CI (test-suite.yml + e2e-nightly.yml)
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami w `Harvard/modules/M22-ai-os/evidence/`
- [ ] 3. Railway: `INTERNAL_TOOLS_ENABLED=true` na staging, migracje wave5-9 zastosowane, smoke `/api/research/sessions` + `/api/ai-connectors/` → 200, czyste logi
- [ ] 4. Kanony graficzne: Artifacts pokazuje czytelny error przy V8_off; ActionCenter + ResearchSessions §27 A-H spełnione
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE: Artifacts panel ukryty lub komunikat przy V8_off
- [ ] 6. Zero cichych degradacji: każdy 404/503 wyświetla user-friendly error w UI
