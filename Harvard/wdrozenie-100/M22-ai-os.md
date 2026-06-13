# TECZKA M22 — AI OS / Internal Tools (pełna teczka wg wzoru M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (`KARTA_AUDYTU.md` §0–§7 + kod) i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M22 AI OS / Internal Tools · **Pula:** internal (DBR77-only, `dbr77.com` whitelist)
- **Ocena audytu:** 54/100 · **Tier:** Alpha · **Status:** 🟦 NIEPEŁNY · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** brak P0 żywy; P1 UX deception (Artifacts panel przy V8 off). Pula nietestowana na żywo (Fazy 3+4 deferred).
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 (re-audit) · teczka 2026-06-13
- **Karta:** `Harvard/modules/M22-ai-os/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/` (Fazy 3/4 deferred — pusta)
- **Kod:** `src/components/AIChat/` (AIOSHub, ActionCenter, ResearchSessionsDock, Wave5–9 panels) · `server/src/routes/{research,wave6-context,wave7-connectors,wave8-agents,wave9-outcomes,artifacts}.routes.ts` · `server/src/middleware/internalTools.middleware.ts` · `server/src/Gateway.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (26 funkcji) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟡 | karta §5 (§27 ocena powierzchni) + §1c (Artifacts UX) | stany ekranu + delta Artifacts-gate |
| C Dane+API+reguły | 🟢 | karta §1e (wiring) + §1f (flagi) + kod 6 wave-routes | maszyna flag (niżej) |
| D AI/Teresa | 🟢 | karta §1 (Wave 6 memory, Research) | granice (niżej) |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (Fale 1–3) | przeformułowane na epiki↔luki |
| G DoD/jakość | 🟢 | karta §0 (SC1–7) + §2 (backlog T1–T7) | **liczby** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1d/§6 | **Rejestr Wejść + Decyzji + korekta R3** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
Werdykt + checklista 26 funkcji: karta §0/§1.
- **Job-to-be-done:** dać zespołowi DBR77 wewnętrzny „system operacyjny AI" — Research Sessions, Action Center (governance run-ledger), pamięć kontekstu Teresy (Wave 6), konektory/agenty/outcome-ops (Wave 7–9) i artefakty (Wave 5) — z twardym gatingiem domena+rola+org.
- **Persony/role:** wyłącznie superadmin/admin/owner z domeny `dbr77.com` (potrójny gating: `betaAccess.ts` + `InternalToolsGate` FE + `internalTools.middleware.ts` BE). Klient tenantowy NIE ma dostępu.
- **Zakres v1:** ActionCenter (approve/reject/execute + run ledger + audit) · Research Sessions (lifecycle + evidence graph + final artifact) · Wave 6 memory · Wave 7 connectors · Wave 8 agents · Wave 9 outcomes/KPI · Wave 5 artifacts (za `ENABLE_V8_GLOBAL`). **POZA v1:** realny OAuth provider flow (Wave 7 symulowany); governance `_actionDecisionRoutes` (USUNIĘTY — patrz H/03 L-02); ModuleHub/MELS hub.
- **Metryka:** moduł wewnętrzny — wartość = zespół DBR77 zarządza AI-runami i pamięcią Teresy bez ręcznego SQL; zero cross-org IDOR (utrzymane).

## B · UX DOCELOWE *(link + delta)*
Ocena powierzchni §27 + stany: karta §5. Wszystkie panele Wave używają własnych `divs` (nie DataTable, brak Menu 1/2/3/preview/sort).
- **Stany ekranu (docelowo):** Artifacts panel MUSI mieć stan „brak-V8" — dziś przy `INTERNAL_TOOLS_ENABLED=true` + `ENABLE_V8_GLOBAL=false` panel renderuje aktywne przyciski, każdy klik → 404 bez komunikatu (karta §1c, P1 UX deception). **Delta:** ukryć panel lub czytelny baner „V8 not enabled" (SC7).
- **i18n/§27:** delta jakościowa, niżej w G (liczby).

## C · DANE + API + REGUŁY *(link + maszyna flag)*
- **Wiring FE↔BE↔DB:** karta §1e (6 wave-service'ów z tabelami + migracjami `20260425_wave5–9_*`, `607_research_evidence_v3`). **Flagi:** karta §1f.
- **Maszyna flag (kanon, `internalTools.middleware.ts` + Gateway):** `INTERNAL_TOOLS_ENABLED=false` → cały moduł 404; `ENABLE_V8_GLOBAL=false` → tylko Artifacts 404; `NODE_ENV=dev/test` → bypass domain/role (P2, sprawdzić na staging); whitelista domena/rola/orgId.
- **Auth/RBAC:** trzy warstwy spójne (karta §6) — org-scope egzekwowany we wszystkich serwisach (`WHERE organization_id=?`), zero cross-org IDOR, zero `x-*-role` abuse. **To najlepiej zabezpieczony moduł aplikacji.**

## D · AI / TERESA *(link)*
- **Co generuje:** Research final artifact (raport markdown z evidence graph — confidence/source/sprzeczności); Wave 6 memory candidates zasilające kontekst Teresy; ActionCenter mirror run-ledger Teresy.
- **Granice:** ActionCenter wymaga approve→execute (governance), nie auto-wykonanie. Run ledger read-only.

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **←** M01 Czat (`ai_runs` mirror → ActionCenter), M20 Tabele (`tp_connectors` link Wave 7), M13 Inicjatywy (`initiative_id` FK Wave 9). **→** M02 Canvas (Research compact), M01 Czat (deep-link `?actionId=`), M17 Outputs (Wave 5 Artifacts share). **Kręgosłup:** niezależny od Fazy 0 — równoległy.

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Integralność Artifacts-gate (FAZA 1):** Artifacts ukryty lub baner „V8 not enabled" przy `ENABLE_V8_GLOBAL=false` (L-01). [karta §7 Fala 1]
- **EPIK 2 — Czystość Gateway (FAZA 1):** zweryfikowano — `_actionDecisionRoutes` USUNIĘTY, 7 guardów bez routerów do sprawdzenia (L-02, L-03). [karta §7 Fala 2]
- **EPIK 3 — Bezpieczeństwo testowane (FAZA 1):** test middleware non-dbr77→404 (T1, L-04). [karta §7 Fala 1]
- **EPIK 4 — Honest Wave 7 (FAZA 3):** OAuth realny lub label „Manual/Simulated" (L-05). [karta §7 Fala 2]
- **EPIK 5 — Szlif kanonu (FAZA 4):** §27 ActionCenter+ResearchSessions + i18n Wave panels + route-integration Wave 6–9 (T2–T5) + unit Wave 6 (T6) (L-06, L-07, L-08). [karta §7 Fala 3]

## G · JAKOŚĆ / DoD *(skwantyfikowane)*
| # | Kryterium | Miara M22 (zmierzone 2026-06-13, `src/components/AIChat/{Wave5-9,AIOS*,ActionCenter,ResearchSessions*}` = 9 plików) |
|---|-----------|-----------|
| 1 | Front↔back | Artifacts działa lub czytelnie zablokowany (SC7); `_actionDecisionRoutes` — **0 importów w Gateway.ts** (zweryfikowane, USUNIĘTY); 7 guardów bez routerów (`Gateway.ts:388-394`) wyczyszczone |
| 2 | Bezpieczeństwo | test middleware (non-dbr77 → 404, T1); org-scope szczelny (już — karta §6); 0 żywych P0/P1-sec |
| 3 | i18n | **5/9** plików nadal z `isPolish`/`i18n.language==='pl'` (po częściowej `b77fd87ae7`); **5/9** ma `useTranslation` — domknąć pozostałe Wave panels |
| 4 | Tokeny | **0** hex w 9 plikach AIOS (czysto) |
| 5 | §27 | **1** surowy `<table>` w surface AIOS; ActionCenter + ResearchSessions na własnych `divs` → FilterableTable |
| 6 | E2E w PR-gate | SC1–SC7 + route-integration Wave 6/7/8/9 (T2–T5) zielone na `Londyn` |

Scenariusze SC1–SC7 + backlog T1–T7: karta §0/§2. Bezpieczeństwo: karta §6. Wydajność: polling 5s Research (karta §1).

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §0–§7 | 2026-06-11 | 23/26 funkcji realne; Artifacts UX P1; brak route-integration testów | L-01,04,05,06,07,08 |
| W-02 | **Uwagi żywe** | 2026-06-13 | **brak** — pula nietestowana na żywo; dziedziczę z karty (Fazy 3+4 deferred) | — |
| W-03 | Re-audit Sprinty 1–5 | 2026-06-11 | karta twierdzi „`_actionDecisionRoutes` zamontowany `f35aa8d7c8`"; i18n Wave `b77fd87ae7` | L-02 (R3 koryguje) |
| W-04 | Kod `Gateway.ts` (R3) | 2026-06-13 | grep: `_actionDecisionRoutes` = **0 wystąpień** → USUNIĘTY (nie zamontowany) | L-02 |
| W-05 | Feedback prod | — | brak — moduł DBR77-only, nie w pętli feedback klienckiego | — |

### 02 · Stan obecny (prawda kodu) — karta §1
REALNE 6 wave-service'ów (5–9 + research) + ActionCenter + AI Memory. STUB: AIOSHub Build Milestones (statyczny), OAuth Wave 7 (manual toggle). ZEPSUTE: Artifacts panel przy V8 off (P1 UX). **Naprawione/usunięte:** i18n Wave panels (`b77fd87ae7`, częściowo); fake features Sprint 4 (`f35aa8d7c8` — w tym usunięcie `_actionDecisionRoutes`).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | Artifacts panel widoczny przy 404 (V8 off) | W-01 | `Wave5ArtifactRuntimePanel.tsx` + `artifacts.routes.ts:38-40` + `Gateway.ts:380,747` | P1 UX | 1 | otwarta |
| L-02 | `_actionDecisionRoutes` (martwy/governance) | W-03,W-04 | `Gateway.ts` — **0 wystąpień** (grep 2026-06-13) | — | — | **STALE-zweryfikowane: USUNIĘTY** (`f35aa8d7c8`). Karta ma podwójny rozjazd (1d „martwy" vs nagłówek „zamontowany") — OBA nieaktualne; kod nie istnieje. Decyzja D-01: czy odbudować governance |
| L-03 | 7 guardów bez routerów | W-01 | `Gateway.ts:388-394` (ai-training/infrastructure/development/budgets/prompts-dup/analytics/operations) | P3 | 3 | otwarta (potwierdzić w kodzie) |
| L-04 | brak testu middleware security (T1) | W-01 | `internalTools.middleware.ts:72-76` | P0-test | 1 | otwarta |
| L-05 | OAuth Wave 7 symulowany | W-01 | `wave7-connectors.routes.ts:80-113` | P2 | 3 | otwarta (decyzja D-02) |
| L-06 | i18n inline 5/9 plików | W-01 | `src/components/AIChat/Wave*`,`ActionCenter`,`ResearchSessions*` (5/9 isPolish, 5/9 useTranslation) | P2 | 4 | otwarta |
| L-07 | §27 niezastosowany (1 `<table>` + divs) | W-01 | ActionCenter/ResearchSessions własne `divs` | P2 | 4 | otwarta |
| L-08 | brak route-integration Wave 6–9 + unit Wave 6 (T2–T6) | W-01 | tylko service-unit | P1-test | 4 | otwarta |
| L-09 | cross-org IDOR | W-01 | wszystkie serwisy `WHERE organization_id=?` | — | — | **STALE-zweryfikowane: BRAK** (karta §6, org-scope szczelny) |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | governance `actionDecisions` (PolicyEngine/audit-export) — usunięty `f35aa8d7c8`; odbudować? | odbudować przy potrzebie / trwale descope | Piotr | TBD | otwarta |
| D-02 | Wave 7 OAuth | realny provider flow / trwały label „Manual/Simulated" | Piotr | TBD | otwarta |
| D-03 | i18n internal (DBR77-only) | przetłumaczyć / świadomy dług internal | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — `INTERNAL_TOOLS_ENABLED` (default false; na Railway MUSI być `true`), `ENABLE_V8_GLOBAL` (Artifacts), whitelista domena/rola/orgId; `betaAccess.ts: INTERNAL_TOOLS='open'` (badge, gating realny przez `canUseInternalTools()`+middleware).
### 06 · Ryzyka — Karta ma podwójny rozjazd co do `_actionDecisionRoutes` (1d „martwy" vs nagłówek „zamontowany `f35aa8d7c8`") — **rozstrzygnięte R3: kod USUNIĘTY**, nie planować budowy ani montażu. DEV bypass `NODE_ENV` — sprawdzić staging. Dev `.env` → Railway PROD.
### 07 · Log — 2026-06-13 (teczka): R3-weryfikacja `_actionDecisionRoutes` USUNIĘTY (0 w Gateway), org-scope BRAK-IDOR potwierdzony. Re-audit 2026-06-11: A 19→20, E 4→6, ocena 54. Re-ocena po Fazach 1/3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + re-audit + kod-R3; uwagi żywe = brak, jawnie dziedziczone z karty) · R2 zero sierot (wejście→luka→DoD) · R3 statusy z dowodem (L-02 USUNIĘTY, L-09 BRAK-IDOR zweryfikowane w kodzie) · R4 DoD z liczbami (i18n 5/9, hex 0, table 1) · R5 decyzje z właścicielem (terminy TBD z Piotrem) · A–E docelowy zlinkowany · F epiki↔luki · G DoD+SC+sec · R6 sesja żywa = Fazy 3+4 (zaplanowane, wymagają staging + INTERNAL_TOOLS=true). **Teczka kompletna do egzekucji.**

**Ryzyko (1 zdanie):** Karta podwójnie myli się co do `_actionDecisionRoutes` (raz „martwy import", raz „zamontowany") — w rzeczywistości kod został USUNIĘTY commitem `f35aa8d7c8`, więc planowanie wokół niego (mount lub usunięcie) byłoby pracą nad nieistniejącym kodem.
