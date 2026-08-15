# TECZKA M22 — AI OS / Internal Tools (pełna teczka wg wzoru M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (`KARTA_AUDYTU.md` §0–§7 + kod) i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja (PODŁOGA): [`M13-inicjatywy.md`](M13-inicjatywy.md). Decyzje przekrojowe: [`_DECYZJE.md`](_DECYZJE.md).

## 00 · Nagłówek
- **Moduł:** M22 AI OS / Internal Tools · **Pula:** internal (DBR77-only, `dbr77.com` whitelist)
- **Ocena audytu:** 54/100 · **Tier:** Alpha · **Status:** 🟦 NIEPEŁNY · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** brak P0 żywy; P1 UX deception (Artifacts panel przy V8 off). Pula nietestowana na żywo (Fazy 3+4 deferred).
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 (re-audit) · teczka 2026-06-13 (pogłębiona do M13-level)
- **Karta:** `Harvard/modules/M22-ai-os/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/` (Fazy 3/4 deferred — pusta)
- **Kod (FE, 9 plików):** `src/components/AIChat/` — `AIOSHub.tsx`, `AIOSWave0GateReport.tsx`, `ActionCenter.tsx`, `ResearchSessionsDock.tsx`, `Wave5ArtifactRuntimePanel.tsx`, `Wave6ContextLearningPanel.tsx`, `Wave7ConnectorAdminPanel.tsx`, `Wave8AgentCatalogPanel.tsx`, `Wave9OutcomeAIOpsPanel.tsx`
- **Kod (BE):** `server/src/routes/{research,wave6-context,wave7-connectors,wave8-agents,wave9-outcomes,artifacts,ai}.routes.ts` · `server/src/middleware/internalTools.middleware.ts` · `server/src/Gateway.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (26 funkcji) | job-to-be-done + zakres + descope DP-7 (niżej) |
| B UX docelowe | 🟡 | karta §5 (§27 ocena powierzchni) + §1c (Artifacts UX) | stany ekranu + delta Artifacts-gate (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e (wiring) + §1f (flagi) + kod 6 wave-routes | **maszyna flag + Gateway mounts (R3) + panele Wave 5-9** (niżej) |
| D AI/Teresa | 🟢 | karta §1 (Wave 6 memory, Research) | granice (niżej) |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (Fale 1–3) | epiki→stories Gherkin→L-xx (niżej) |
| G DoD/jakość | 🟢 | karta §0 (SC1–7) + §2 (backlog T1–T7) | **liczby grep 2026-06-13 + korekta R3 guardów** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1d/§6 | **Rejestr Wejść + Decyzji + korekta R3** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
Werdykt + checklista 26 funkcji: karta §0/§1.
- **Job-to-be-done:** dać zespołowi DBR77 wewnętrzny „system operacyjny AI" — Research Sessions, Action Center (governance run-ledger), pamięć kontekstu Teresy (Wave 6), konektory/agenty/outcome-ops (Wave 7–9) i artefakty (Wave 5) — z twardym gatingiem domena+rola+org.
- **Persony/role:** wyłącznie superadmin/admin/owner z domeny `dbr77.com` (potrójny gating: `betaAccess.ts` + `InternalToolsGate` FE + `internalTools.middleware.ts` BE). Klient tenantowy NIE ma dostępu.
- **Zakres v1:** ActionCenter (approve/reject/execute + run ledger + audit) · Research Sessions (lifecycle + evidence graph + final artifact) · Wave 6 memory · Wave 7 connectors · Wave 8 agents · Wave 9 outcomes/KPI · Wave 5 artifacts (za `ENABLE_V8_GLOBAL`). **POZA v1:** realny OAuth provider flow (Wave 7 symulowany — D-02); governance `actionDecisions` (**USUNIĘTY `f35aa8d7c8`** — patrz H/03 L-02, DP-7 = wytnij dual-stack, descope chyba że w roadmapie); ModuleHub/MELS hub; i18n internal (DP-10 świadomy dług).
- **Metryka:** moduł wewnętrzny — wartość = zespół DBR77 zarządza AI-runami i pamięcią Teresy bez ręcznego SQL; zero cross-org IDOR (utrzymane — najlepiej zabezpieczony moduł aplikacji).

## B · UX DOCELOWE *(link + delta)*
Ocena powierzchni §27 + stany: karta §5. Wszystkie panele Wave używają własnych `divs` (nie DataTable, brak Menu 1/2/3/preview/sort).
- **Stany ekranu (docelowo):** Artifacts panel MUSI mieć stan „brak-V8" — dziś przy `INTERNAL_TOOLS_ENABLED=true` + `ENABLE_V8_GLOBAL=false` panel renderuje aktywne przyciski, każdy klik → 404 bez komunikatu (karta §1c, P1 UX deception). **Delta:** ukryć panel lub czytelny baner „V8 not enabled" (SC7).
- **i18n/§27:** delta jakościowa, niżej w G (liczby). i18n internal = DP-10 (świadomy dług, NIE tłumaczyć v1).

## C · DANE + API + REGUŁY *(link + maszyna flag + Gateway R3 + panele Wave)*

### C.1 · Panele Wave 5-9 + powierzchnie (FE→BE→tabele)
| Panel FE | Endpoint BE | Tabele | Migracja | Status |
|---|---|---|---|---|
| `ActionCenter.tsx` | `GET /api/ai/actions/center` (`ai.routes.ts:6001`) | `ai_runs` (via `aiRunLedgerService`) | M01 | REALNE (org-scoped) |
| `ResearchSessionsDock.tsx` | `POST/GET /api/research/sessions` | `research_evidence`, `research_sessions` | `607_research_evidence_v3.sql` | REALNE (HTTP do EDGAR/GDELT/OpenAlex/Crossref) |
| `Wave5ArtifactRuntimePanel.tsx` | `/api/artifacts/*` (`v8FeatureGate`) | `wave5_artifacts`, `_versions`, `_mutation_proposals` | `20260425_wave5_*` | REALNE **za `ENABLE_V8_GLOBAL`** → L-01 |
| `Wave6ContextLearningPanel.tsx` | `/api/ai-context/*` | `wave6_context_snapshots`, `_ledger`, `_memory_candidates`, `_stewardship_decisions` | `20260425_wave6_*` | REALNE (Teresa memory) |
| `Wave7ConnectorAdminPanel.tsx` | `/api/ai-connectors/*` | `wave7_connectors`, `_runs` | `20260425_wave7_*` | REALNE; **OAuth symulowany** (status = `req.body.status \|\| 'connected'`, `wave7-connectors.routes.ts:51-60`, brak realnego provider-flow) — L-05/D-02 ZAMKNIĘTA 07-19: Piotr odrzucił label „Manual/Simulated", nie dodawać |
| `Wave8AgentCatalogPanel.tsx` | `/api/ai-agents/*` | `wave8_agent_definitions`, `_runs`, `_schedules`, `_notifications` | `20260425_wave8_*` | REALNE |
| `Wave9OutcomeAIOpsPanel.tsx` | `/api/ai-outcomes/*` | `wave9_outcomes`, `_evidence_registry`, `_provider_health`, `_eval_runs`, `_acceptance_runs`, `_incidents`, `_acceptance_decisions` | `20260425_wave9_*` | REALNE |
| `AIOSHub.tsx` | (V10 voice-config live; Build Milestones = statyczny) | — | — | REALNE + 1 STUB UI |
| `AIOSWave0GateReport.tsx` | (raport) | — | — | zawiera **1 surowy `<table>`** (§27, L-07) |

### C.2 · Maszyna flag + Gateway mounts (kanon, R3)
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f.
- **Maszyna flag (`internalTools.middleware.ts` + Gateway):** `INTERNAL_TOOLS_ENABLED=false` → cały moduł 404; `ENABLE_V8_GLOBAL=false` → tylko Artifacts 404; `NODE_ENV=dev/test` → bypass domain/role (`internalTools.middleware.ts:39`, P2, sprawdzić na staging); whitelista domena/rola/orgId.
- **Gateway mounts (zweryfikowane 2026-06-13):** guardy `internalToolsGuard` na `:376-395` (ai-context/connectors/agents/outcomes/research/artifacts/memory/prompts/training/analytics/budgets/infrastructure/development/operations); **realne routery zamontowane na `:486-552, 749, 771-774`** (research `:552`, artifacts `:749` za `v8FeatureGate`, wave6 `:771`, wave7 `:772`, wave8 `:773`, wave9 `:774`, + ai-analytics/training/memory/prompts/budgets/infrastructure/development/operations `:486-512`).

### C.3 · Auth/RBAC
- Trzy warstwy spójne (karta §6) — org-scope egzekwowany we wszystkich serwisach (`WHERE organization_id=?`), zero cross-org IDOR, zero `x-*-role` abuse. **Najlepiej zabezpieczony moduł aplikacji.**

## D · AI / TERESA *(link)*
- **Co generuje:** Research final artifact (raport markdown z evidence graph — confidence/source/sprzeczności); Wave 6 memory candidates zasilające kontekst Teresy; ActionCenter mirror run-ledger Teresy.
- **Granice:** ActionCenter wymaga approve→execute (governance), nie auto-wykonanie. Run ledger read-only. Wave 6 memory candidates → approve→persist (stewardship).

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **←** M01 Czat (`ai_runs` mirror → ActionCenter), M20 Tabele (`tp_connectors` link Wave 7), M13 Inicjatywy (`initiative_id` FK Wave 9). **→** M02 Canvas (Research compact), M01 Czat (deep-link `?actionId=`), M17 Outputs (Wave 5 Artifacts share). **Kręgosłup:** niezależny od Fazy 0 — równoległy.

## F · EPIKI → STORIES → ZADANIA

**EPIK 1 — Integralność Artifacts-gate (FAZA 1) [karta §7 Fala 1]**
- Story 1.1: jako user DBR77 przy V8 off, gdy otwieram Artifacts, widzę czytelny komunikat zamiast martwych przycisków.
  - Gherkin: dane `INTERNAL_TOOLS_ENABLED=true` + `ENABLE_V8_GLOBAL=false`; gdy klik „Create Artifact"; wtedy baner „V8 not enabled" (lub panel ukryty), ZERO niemego 404.
  - Zadania: [Z-01 → **L-01** `Wave5ArtifactRuntimePanel.tsx` + `artifacts.routes.ts:38-40` + `Gateway.ts:749`]

**EPIK 2 — Czystość Gateway (FAZA 1) [karta §7 Fala 2] — KOREKTA R3**
- Story 2.1: Gateway bez martwego/dezinformującego kodu. Gherkin: dane HEAD `Londyn`; gdy grep `_actionDecisionRoutes`; wtedy **0 wystąpień** (USUNIĘTY).
  - Zadania: [Z-02 → **L-02** `_actionDecisionRoutes` USUNIĘTY `f35aa8d7c8` — **NIC do montażu/usunięcia**, ew. tylko decyzja D-01 odbudować; Z-03 → **L-03 7 guardów: R3 STALE — routery JUŻ zamontowane**, patrz niżej]

**EPIK 3 — Bezpieczeństwo testowane (FAZA 1) [karta §7 Fala 1]**
- Story 3.1: middleware odrzuca non-dbr77. Gherkin: dane konto `@gmail.com`; gdy woła `/api/research/sessions`; wtedy 404. Zadania: [Z-04 → L-04 test T1 `internalTools.middleware.ts:72-76`]

**EPIK 4 — Honest Wave 7 (FAZA 3) [karta §7 Fala 2]**
- Story 4.1: OAuth jawny. Gherkin: dane connector OAuth; gdy user otwiera sekcję; wtedy label „Manual/Simulated" LUB realny redirect. Zadania: [Z-05 → L-05, **D-02** — ZAMKNIĘTA 07-19: Piotr odrzucił label, zostaje manual/simulated bez UI-oznaczenia]

**EPIK 5 — Szlif kanonu (FAZA 4) [karta §7 Fala 3, DP-10]**
- Story 5.1: §27 ActionCenter+ResearchSessions + i18n Wave panels + route-integration Wave 6–9 (T2–T5) + unit Wave 6 (T6). Zadania: [Z-06 → L-06 i18n (DP-10: świadomy dług internal, decyzja D-03), Z-07 → L-07 §27 (1 `<table>` w `AIOSWave0GateReport.tsx` + divs), Z-08 → L-08 route-integration tests]

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M22 (9 plików FE `AIChat/{Wave5-9,AIOS*,ActionCenter,ResearchSessions*}`) |
|---|-----------|-----------|
| 1 | Front↔back | Artifacts działa lub czytelnie zablokowany (SC7); `_actionDecisionRoutes` — **0 wystąpień w Gateway.ts** (USUNIĘTY); **7 „guardów bez routerów" — R3 STALE: routery JUŻ zamontowane** (`Gateway.ts:486-512`) |
| 2 | Bezpieczeństwo | test middleware (non-dbr77 → 404, T1); org-scope szczelny (już — karta §6); 0 żywych P0/P1-sec |
| 3 | i18n | **5/9** plików nadal z `isPolish`/`i18n.language==='pl'` (Wave5/6/7/8/9 panels — grep 2026-06-13); 4/9 (AIOSHub/ActionCenter/ResearchSessions/AIOSWave0) bez `isPolish` → domknąć 5 Wave paneli (lub DP-10 dług internal) |
| 4 | Tokeny | **0** hex w 9 plikach AIOS (czysto) |
| 5 | §27 | **1** surowy `<table>` (`AIOSWave0GateReport.tsx`); ActionCenter + ResearchSessions na własnych `divs` → FilterableTable |
| 6 | E2E w PR-gate | SC1–SC7 + route-integration Wave 6/7/8/9 (T2–T5) zielone na `Londyn` |

**KOREKTA R3 — „7 guardów bez routerów" (L-03):** karta §1c/§6 (P3) twierdzi „7 `internalToolsGuard` mountów dla ścieżek bez istniejącego routera (ai-training/infrastructure/development/budgets/prompts-dup/analytics/operations) → request przechodzi guard → 404". Weryfikacja 2026-06-13 (`grep "app.use('/api/<p>', [router]"`): **wszystkie 7 ścieżek mają realny router zamontowany** — `ai-analytics:486`, `ai-training:488`, `ai-prompts:491`, `ai-budgets:509`, `ai-infrastructure:510`, `ai-development:511`, `ai-operations:512`. Guardy NIE są „dangling" — to standardowy wzór guard-then-mount. → **L-03 zdegradować do STALE-zweryfikowane: NIE dotyczy** (karta nieaktualna; być może routery dodano po audycie). Pozostaje co najwyżej kosmetyczny duplikat `ai-prompts` guard (`:389`) do potwierdzenia.

Scenariusze SC1–SC7 + backlog T1–T7: karta §0/§2. Bezpieczeństwo: karta §6. Wydajność: polling 5s Research (karta §1).

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §0–§7 | 2026-06-11 | 23/26 funkcji realne; Artifacts UX P1; brak route-integration testów; „7 guardów bez routerów" | L-01,03,04,05,06,07,08 |
| W-02 | **Uwagi żywe** | 2026-06-13 | **brak** — pula nietestowana na żywo; dziedziczę z karty (Fazy 3+4 deferred) | — |
| W-03 | Re-audit Sprinty 1–5 | 2026-06-11 | karta: „`_actionDecisionRoutes` zamontowany `f35aa8d7c8`"; i18n Wave `b77fd87ae7` | L-02 (R3 koryguje) |
| W-04 | Kod `Gateway.ts` (R3) | 2026-06-13 | grep: `_actionDecisionRoutes` = **0**, 7 guard-ścieżek = router zamontowany `:486-512` | L-02, L-03 |
| W-05 | **DP-7** (`_DECYZJE.md`) | 2026-06-13 | dual-stack/legacy (M22 actionDecisions) = wytnij/descope chyba że roadmapa | L-02 → D-01 |
| W-06 | **DP-10** (`_DECYZJE.md`) | 2026-06-13 | i18n internal DBR77-only = świadomy dług, NIE tłumaczyć v1 | L-06 → D-03 |
| W-07 | Feedback prod | — | brak — moduł DBR77-only, nie w pętli feedback klienckiego | — |

### 02 · Stan obecny (prawda kodu) — karta §1 + **KOREKTY R3**
REALNE 6 wave-service'ów (5–9 + research) + ActionCenter + AI Memory. STUB: AIOSHub Build Milestones (statyczny), OAuth Wave 7 (manual toggle). ZEPSUTE: Artifacts panel przy V8 off (P1 UX). **Naprawione/usunięte:** i18n Wave panels (`b77fd87ae7`, częściowo — 5/9 wciąż `isPolish`); fake features Sprint 4 (`f35aa8d7c8` — w tym usunięcie `_actionDecisionRoutes`). **KOREKTY R3 (2026-06-13):** (1) `_actionDecisionRoutes` = **0 wystąpień** (USUNIĘTY, nie „zamontowany" ani „martwy import"); (2) **„7 guardów bez routerów" = STALE** — routery zamontowane `Gateway.ts:486-512`.

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | Artifacts panel widoczny przy 404 (V8 off) | W-01 | `Wave5ArtifactRuntimePanel.tsx:252-276` + `v8FeatureGate.middleware.ts:96-100` (404) | P1 UX | 1 | **NIEAKTUALNA** (zweryfikowane 2026-06-17) — guard JUŻ istnieje: V8-off → `v8OutputsGate` 404 → `Api.handleResponse` throw → `catch` setLoadError → early-return banner „Artifacts unavailable / requires ENABLE_V8_GLOBAL=true" + Retry, ZAMIAST martwych przycisków (early-return przed JSX panelu) |
| L-02 | `actionDecisions` governance (PolicyEngine/audit-export) | W-03,W-04,W-05 | `Gateway.ts` — **0 wystąpień** (grep 2026-06-13) | — | — | **NIEAKTUALNA** — `_actionDecisionRoutes` USUNIĘTY `f35aa8d7c8`, DP-7 descope. Zweryfikowane kodem 2026-06-13 + 2026-06-17. |
| L-03 | „7 guardów bez routerów" | W-01,W-04 | `Gateway.ts:388-395` (guard) + **`:486-512` (routery zamontowane)** | — | — | **NIEAKTUALNA** — wszystkie 7 routerów zamontowanych `Gateway.ts:486-512`. Zweryfikowane 2026-06-13 + 2026-06-17. |
| L-04 | brak testu middleware security (T1) | W-01 | `internalTools.middleware.ts:72-76` | P0-test | 1 | **ZAMKNIĘTA 2026-06-17 8ca6d06028** — middleware hardened, 32/32 testów zielonych (`tests/unit/backend/middleware/internalTools.middleware.test.ts`) |
| L-05 | OAuth Wave 7 symulowany | W-01 | `wave7-connectors.routes.ts:52-113` | P2 | 3 | **ZAMKNIĘTA 07-19 (decyzja, bez wdrożenia)** — Piotr rozstrzygnął `_DECYZJE_RUNDA3.md` #12 (D-02): wave7 label = martwy, NIE dodawać do `Wave7ConnectorAdminPanel.tsx`. OAuth pozostaje manual/simulated bez UI-labela (świadomie, internal-only moduł) |
| L-06 | i18n inline 5/9 plików | W-01,W-06 | `AIChat/Wave5-9*.tsx` (5 plików `isPolish`) | P2 | 4 | **CZĘŚCIOWO ZAMKNIĘTA 2026-06-17 `d14351d555`** — Wave5-9 codemod `isPolish→t('aios.*')` (223 konwersje, **212 kluczy → `scripts/i18n-sweep/keys_M22.json`** dla Harvard 2); 4 residue=nonStringTernary (słusznie pominięte). **Reszta ODROCZONA→H2/Faza4**: AIPlatformModule ~314 hardkodów EN (manual, poza codemodem) + injekcja `translation.json` (H2) |
| L-07 | §27 niezastosowany (1 `<table>` + divs) | W-01 | `AIOSWave0GateReport.tsx` (1×`<table>`); ActionCenter/ResearchSessions własne `divs` | P2 | 4 | **ZAMKNIĘTA 2026-06-17 0c4cf8cc58** — AIOSWave0GateReport `<table>`→FilterableTable; ActionCenter (karty + conditional action-bary) i ResearchSessionsDock (master-detail dock) **zostawione świadomie** (nie tabularne, FilterableTable=regres UX) |
| L-08 | brak route-integration Wave 6–9 + unit Wave 6 (T2–T6) | W-01 | tylko service-unit | P1-test | 4 | **ZAMKNIĘTA 2026-06-17 305e88012c** — 33 route-integration testy `tests/integration/ai-os/wave{6,7,8,9}-*.test.ts` (zielone); Wave 6 unit `wave6ContextLearningService.test.ts` (5) już istniał. Ścieżki → H1 do CI |
| L-09 | cross-org IDOR | W-01 | wszystkie serwisy `WHERE organization_id=?` | — | — | **NIEAKTUALNA** — org-scope szczelny we wszystkich serwisach (karta §6). Zweryfikowane 2026-06-13 + 2026-06-17. |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | governance `actionDecisions` — USUNIĘTY `f35aa8d7c8`; odbudować? | odbudować przy potrzebie / trwale descope | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-7: wytnij/descope dual-stack (actionDecisions)** chyba że konkretnie w roadmapie |
| D-02 | Wave 7 OAuth | realny provider flow / trwały label „Manual/Simulated" | Piotr | TBD | otwarta (modułowa) |
| D-03 | i18n internal (DBR77-only) | przetłumaczyć / świadomy dług internal | Piotr | 2026-06-13 | **ROZSTRZYGNIĘTE → DP-10: świadomy dług internal, NIE tłumaczyć v1** |

### 05 · Flagi/rollout — `INTERNAL_TOOLS_ENABLED` (default false; na Railway MUSI być `true`), `ENABLE_V8_GLOBAL` (Artifacts), whitelista domena/rola/orgId; `betaAccess.ts: INTERNAL_TOOLS='open'` (badge, gating realny przez `canUseInternalTools()`+middleware). DEV bypass `NODE_ENV` (`internalTools.middleware.ts:39`) — sprawdzić staging.
### 06 · Ryzyka — Karta ma podwójny rozjazd co do `_actionDecisionRoutes` (1d „martwy" vs nagłówek „zamontowany `f35aa8d7c8`") — **rozstrzygnięte R3: kod USUNIĘTY** (DP-7 descope). „7 guardów bez routerów" w karcie = **STALE** (routery zamontowane) — nie planować cięcia. DEV bypass `NODE_ENV` — sprawdzić staging. Dev `.env` → Railway PROD.
### 07 · Log — 2026-06-13 (teczka pogłębiona): panele Wave 5-9 enum (FE→BE→tabele); R3 — `_actionDecisionRoutes` USUNIĘTY (0 w Gateway, DP-7 descope), **„7 guardów bez routerów" STALE** (routery `:486-512` zamontowane), org-scope BRAK-IDOR; DP-7→D-01, DP-10→D-03. Re-audit 2026-06-11: A 19→20, E 4→6, ocena 54. Re-ocena po Fazach 1/3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + re-audit + kod-R3 + DP-7/10; uwagi żywe = brak, jawnie dziedziczone z karty) · R2 zero sierot (wejście→luka→DoD) · R3 statusy z dowodem (**L-02 USUNIĘTY, L-03 „7 guardów" STALE-nie-dotyczy — routery zamontowane, L-09 BRAK-IDOR** zweryfikowane w kodzie) · R4 DoD z liczbami (i18n 5/9, hex 0, table 1) · R5 decyzje przekrojowe ROZSTRZYGNIĘTE (D-01=DP-7, D-03=DP-10; D-02 modułowa otwarta); pozostaje R6/żywa weryfikacja · A–E docelowy zlinkowany (C = panele Wave 5-9 + maszyna flag + Gateway mounts) · F epiki→stories Gherkin→L-xx · G DoD+SC+sec · R6 sesja żywa = Fazy 3+4 (wymagają staging + INTERNAL_TOOLS=true). **Teczka kompletna do egzekucji.**

**Ryzyko (1 zdanie):** Karta podwójnie myli się co do `_actionDecisionRoutes` (USUNIĘTY, nie martwy/zamontowany — DP-7 descope) ORAZ co do „7 guardów bez routerów" (routery JUŻ zamontowane `:486-512`) — planowanie wokół obu byłoby pracą nad nieaktualnym stanem kodu.

## EKRANY (inwentarz) — 2026-06-19

Audyt weryfikacyjny: teczka SOLID, deklaracje napraw zgodne z kodem (zweryfikowane plik:linia).

| # | Ekran / widok | Cel | Plik komponentu |
|---|---|---|---|
| 1 | AIOS Hub | Strona główna AI OS (V10 voice-config live + Build Milestones statyczny) | `src/components/AIChat/AIOSHub.tsx` |
| 2 | Wave 0 Gate Report | Raport bramki Wave 0 (1× surowy `<table>`→FilterableTable, L-07) | `src/components/AIChat/AIOSWave0GateReport.tsx` |
| 3 | Action Center | Governance run-ledger: approve/reject/execute + audit (org-scoped, `ai_runs`) | `src/components/AIChat/ActionCenter.tsx` |
| 4 | Research Sessions Dock | Lifecycle sesji research + evidence graph + final artifact (master-detail dock) | `src/components/AIChat/ResearchSessionsDock.tsx` |
| 5 | Wave 5 Artifact Runtime Panel | Artefakty (za `ENABLE_V8_GLOBAL`); banner „unavailable" przy V8-off (L-01 zweryf. early-return `:253`) | `src/components/AIChat/Wave5ArtifactRuntimePanel.tsx` |
| 6 | Wave 6 Context Learning Panel | Pamięć kontekstu Teresy: snapshots/ledger/memory-candidates/stewardship | `src/components/AIChat/Wave6ContextLearningPanel.tsx` |
| 7 | Wave 7 Connector Admin Panel | Konektory (OAuth symulowany — L-05/D-02 zamknięta 07-19, label odrzucony) | `src/components/AIChat/Wave7ConnectorAdminPanel.tsx` |
| 8 | Wave 8 Agent Catalog Panel | Katalog agentów: definitions/runs/schedules/notifications | `src/components/AIChat/Wave8AgentCatalogPanel.tsx` |
| 9 | Wave 9 Outcome AIOps Panel | Outcomes/KPI: evidence/provider-health/eval/acceptance/incidents | `src/components/AIChat/Wave9OutcomeAIOpsPanel.tsx` |

**Liczba ekranów: 9.** Wszystkie gatowane potrójnie (betaAccess `dbr77.com` + `InternalToolsGate` FE + `internalTools.middleware.ts` BE → non-dbr77 = 404, zweryf. test 32/32).
