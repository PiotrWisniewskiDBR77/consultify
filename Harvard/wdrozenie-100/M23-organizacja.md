# TECZKA M23 — Organizacja (workspace organizacji) (pełna teczka wg wzoru M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje `KARTA_AUDYTU.md` §1–§7 + kod i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M23 Organizacja (workspace org) · **Pula:** internal (org-admin/owner; kontekst Teresy)
- **Ocena audytu:** 52/100 · **Tier:** Alpha · **Status:** 🟦 NIEPEŁNY · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** karta opisuje 3×P1 — **R3 koryguje: WSZYSTKIE 3 NAPRAWIONE i zweryfikowane w kodzie 2026-06-13** (patrz H/03). Pula nietestowana na żywo.
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 (re-audit) · teczka 2026-06-13
- **Karta:** `Harvard/modules/M23-organizacja/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md, f2_tests_report.md, f56_kanon_sec.md`
- **Kod:** `src/components/Organization/` · `server/src/routes/{competency,organization-context-store}.routes.ts` · `server/src/routes/organization/organization-data.routes.ts` · `server/src/routes/organization-profiles.routes.ts` · `useContextBuilderStore.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (S1–S7) | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟡 | karta §5 (drift admin) | stany + delta fasady kontekstu |
| C Dane+API+reguły | 🟢 | karta §1e + kod 4 routery | reguły org-scope (niżej) |
| D AI/Teresa | 🟢 | karta §1g (profil→kontekst) | granice (niżej) |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (Fale 1–3) | przeformułowane na epiki↔luki |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + korekta R3 (3×P1)** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
Werdykt + S1–S7: karta §0/§1.
- **Job-to-be-done:** dać organizacji jeden workspace na najwrażliwsze dane (profil firmy, strategia/cele, kompetencje, członkowie, branding, knowledge graph) — które zasilają kontekst Teresy i RBAC całej platformy.
- **Persony/role:** owner/admin (pełny dostęp + zaproszenia + role), member (ograniczony; deep-link do sekcji admin musi być zablokowany — patrz L-04). Org-switch tylko do org z aktywnym membership.
- **Zakres v1:** profil firmy (SSOT backend) · Goals/Challenges/Strategy (teraz backend per-org — W11) · Knowledge Graph · Members + zaproszenia · Competencies · Domains · Branding · baner kontekstu Teresy. **POZA v1:** auto-join z approved-domains (feature-gap); `analyze` endpoint (martwy 404).
- **Metryka:** profil/strategia przeżywają zmianę przeglądarki/org i AI je widzi (kontrast z dawną fasadą localStorage — naprawione W11).

## B · UX DOCELOWE *(link + delta)*
Drift admin + §27 + i18n: karta §5. Org-switch wzorcowy. **Delta historyczna (naprawiona):** „kontekst organizacyjny" był fasadą localStorage — naprawione backendem per-org (`organization-context-store.routes.ts`, W11 `d013ab7c4c`). **Pozostała delta:** drift admin (deep-link `/organization/members` → lokalny `OrganizationAdminPanel` vs klik → redirect M24) — patrz L-04.

## C · DANE + API + REGUŁY *(link + org-scope)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (route `requireAuth` bez roli).
- **Reguły org-scope (kanon, zweryfikowane 2026-06-13):**
  - `organization-profiles.routes.ts` — `userOrgId!==orgId→403` na `:189,378,622` + role-gate PUT (WZORCOWE, najwrażliwsze dane).
  - `competency.routes.ts` — `router.use(verifyToken)` (`:10`) + `requireRole('admin','owner')` (`:14`) na write. **NAPRAWIONE** (był P1 no-auth).
  - `organization/organization-data.routes.ts` — `requireRole('admin','owner')` na export (`:212,:351`). **NAPRAWIONE** (był P1 export bez role-gate).
  - `organization-context-store.routes.ts` — `verifyToken` (`:15`) + PUT per-org (`:64`), mount `Gateway.ts:700`. **REALNY backend** (była fasada localStorage).
  - `auth.routes.ts:707` — org-switch membership-verified.

## D · AI / TERESA *(link)*
- **Co zasila:** profil firmy → backendowy kontekst Teresy; Goals/Challenges/Strategy per-org (W11) → kontekst Teresy (naprawione; dawniej localStorage, AI nie widział).
- **Granice:** Goals AI-sugestie — karta §1b oznacza `onRefine` no-op (MOCK-STUB) — żywo zweryfikować po W11.

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **→** kontekst Teresy (profil + Goals/Strategy per-org), M24 Admin (redirect sekcji ADMINISTRATION — drift przy deep-link), cała app (org-switch wymiana tokenu). **Kręgosłup:** niezależny od Fazy 0. **Zależność:** drift redirect koordynować z M24.

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Bezpieczeństwo zweryfikowane (FAZA 1):** 3×P1 z karty NAPRAWIONE w kodzie (L-01/02/03) — domknąć testami regresji (L-07). [karta §7 Fala 1]
- **EPIK 2 — Kontekst org realny (FAZA 1/2):** Goals/Challenges/Strategy backend per-org + zasilanie Teresy (L-01, W11 `d013ab7c4c`) — żywo potwierdzić persystencję. [karta §7 Fala 2]
- **EPIK 3 — Koniec driftu admin (FAZA 3):** role-gate `/organization/*` lub redirect przy URL (L-04). [karta §7 Fala 1/2]
- **EPIK 4 — Honest billing (FAZA 3):** Billing/Limits CTA realne lub jawny komunikat (L-05). [karta §7 Fala 2]
- **EPIK 5 — Szlif (FAZA 4):** §27 (członkowie/competencies/domains) + i18n `t()` + sanityzacja SVG + wytnij martwy `analyze` (L-06, L-08, L-09). [karta §7 Fala 3]

## G · JAKOŚĆ / DoD *(skwantyfikowane)*
| # | Kryterium | Miara M23 (zmierzone 2026-06-13, `src/components/Organization/` = 5 plików ts/tsx) |
|---|-----------|-----------|
| 1 | Front↔back | Goals/Challenges/Strategy backend per-org (W11) + widoczne dla Teresy; Billing CTA żywe lub jawnie opisane; 0 martwych CTA |
| 2 | Bezpieczeństwo | competency auth+role ✅ (`fd8707c5b2`/`e3945bc7fc`); export role-gate ✅ (`fd8707c5b2`); + testy regresji + `orgContext.middleware.test.ts` z PG (45 SKIP) |
| 3 | i18n | **1/5** plików z `isPolish` (`CompetencyCatalog.tsx:51`) — `t()` zamiast `isPl`, przetłumaczyć opcje ról |
| 4 | Tokeny | **15** hex w 5 plikach (m.in. `#6366f1` default brand = wartość-dana OK) — zweryfikować pozostałe |
| 5 | §27 | **2** surowe `<table>` → FilterableTable (członkowie/competencies/domains) |
| 6 | E2E w PR-gate | competency-auth + export-role + multi-tenant isolation (`orgContext.middleware.test.ts` z PG) zielone na `Londyn` |

Scenariusze S1–S7 + 185 PASS/3 FAIL(stale)/45 SKIP: karta §0/§2. Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §0–§7 | 2026-06-11 | mocny rdzeń + 3×P1 (competency no-auth, export no-role, Goals localStorage) + drift admin | L-01,02,03,04,06 |
| W-02 | **Uwagi żywe** | 2026-06-13 | **brak** — pula nietestowana na żywo; dziedziczę z karty | — |
| W-03 | Re-audit Sprinty 1–5 | 2026-06-11 | W11 org-context-store backend (`d013ab7c4c`); W2 competency+export (`fd8707c5b2`/`e3945bc7fc`/`c7f36d9f3f`) | L-01,02,03 (R3 koryguje) |
| W-04 | Kod (R3) | 2026-06-13 | grep: competency `verifyToken+requireRole`; export `requireRole`; context-store mount+PUT | L-01,02,03 (potwierdza naprawę) |
| W-05 | Feedback prod | — | brak — moduł org-admin, nie kliencka pętla feedback bezpośrednia | — |

### 02 · Stan obecny (prawda kodu) — karta §1
REALNE: profil firmy (org+role scoped), KG, Members, Domains, Branding, org-switch (membership-verified), kontekst Teresy. **Naprawione (R3, kod 2026-06-13):** Goals/Challenges/Strategy → backend per-org (`organization-context-store.routes.ts`, `d013ab7c4c`); competency → `verifyToken`+`requireRole`; org-data export → `requireRole`. ZEPSUTE/dług: Billing CTA martwe (P2), drift admin (P2), martwy `analyze` (P3).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | Goals/Challenges/Strategy fasada localStorage (nie per-org, nie Teresa) | W-01,W-03 | `organization-context-store.routes.ts:15,64` + `Gateway.ts:700` | P1 fasada | 1/2 | **STALE-zweryfikowane: NAPRAWIONE** `d013ab7c4c` (backend per-org + PUT mount). Karta §1b/1e wciąż „localStorage-only" = rozjazd. Żywo: potwierdzić persystencję + Goals AI no-op |
| L-02 | `/api/competency/*` bez auth | W-01,W-03 | `competency.routes.ts:10` (`verifyToken`) `:14` (`requireRole admin,owner`) | P1 sec | 1 | **STALE-zweryfikowane: NAPRAWIONE** `fd8707c5b2`/`e3945bc7fc` (verifyToken+role w kodzie 2026-06-13) |
| L-03 | org-data export bez role-gate | W-01,W-03 | `organization/organization-data.routes.ts:212,351` (`requireRole admin,owner`) | P1 sec | 1 | **STALE-zweryfikowane: NAPRAWIONE** `fd8707c5b2` (role-gate w kodzie 2026-06-13) |
| L-04 | route `/organization/*` bez role-gate (deep-link member→admin) + drift admin | W-01 | `AppRoutes.tsx:2180` `requireAuth` bez roli; lokalny `OrganizationAdminPanel` (932 l.) | P2 | 3 | otwarta (koordynować z M24) |
| L-05 | Billing/Limits CTA martwe | W-01 | `OrganizationAdminPanel.tsx:292,474` (tylko `trackFunnelEvent`) | P2 | 3 | otwarta (decyzja D-01) |
| L-06 | i18n `isPl` + nieprzetłumaczone opcje ról | W-01 | `CompetencyCatalog.tsx:51`; `OrganizationAdminPanel.tsx:179` | P2 | 4 | otwarta |
| L-07 | brak testów competency-auth/export-role/store-persist; 3 FAIL stale; 45 SKIP | W-01 | `organizationData.no-stubs.test.ts`; `orgContext.middleware.test.ts` | P1-test | 1 | otwarta |
| L-08 | §27 (2 `<table>`) | W-01 | `src/components/Organization/` | P2 | 4 | otwarta |
| L-09 | SVG branding stored-XSS; martwy `analyze` 404; KG orgId fallback | W-01 | branding upload; `organization-profiles:analyze`; KG `:20-32` | P2/P3 | 3 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Billing/Limits CTA | realny checkout / jawne „zarządzane przez…" | Piotr | TBD | otwarta |
| D-02 | drift admin (lokalny panel vs redirect M24) | redirect przy URL / `requiredRole` na pod-ścieżkach | Piotr | TBD | otwarta |
| D-03 | Goals AI (obecnie `onRefine` no-op) | realny LLM / usunąć przycisk | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — route `/organization/*` = `requireAuth` bez roli (gating po API, miejscami słaby — L-04). Brak beta-locka modułu (org core).
### 06 · Ryzyka — Karta opisuje 3×P1 jako żywe, ale re-audit + **weryfikacja kodu 2026-06-13 potwierdza wszystkie 3 NAPRAWIONE** (competency `verifyToken+requireRole`, export `requireRole`, Goals backend per-org). Karta §1b/1e/§6 wciąż opisuje stare stany = rozjazd. NIE budować od zera — domknąć testami regresji. Dev `.env` → Railway PROD (testy sec read-only). 45 SKIP = multi-tenant isolation nietestowana bez PG.
### 07 · Log — 2026-06-13 (teczka): R3 potwierdza 3×P1 NAPRAWIONE w kodzie. Re-audit 2026-06-11: A 17→20, B 9→11, C 7→8, F 5→7, ocena 52. Re-ocena po testach regresji + Fazach 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + re-audit + kod-R3; uwagi żywe = brak, jawnie dziedziczone) · R2 zero sierot · R3 statusy z dowodem (L-01/02/03 NAPRAWIONE — zweryfikowane w kodzie 2026-06-13, korekta rozjazdu karty) · R4 DoD z liczbami (i18n 1/5, hex 15, table 2) · R5 decyzje z właścicielem (terminy TBD) · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Fazy 3+4. **Teczka kompletna do egzekucji.**

**Ryzyko (1 zdanie):** Karta nadal opisuje 3×P1 (competency no-auth, export no-role, Goals localStorage) jako żywe blokery, ale weryfikacja kodu potwierdza że WSZYSTKIE są naprawione — bez tej korekty zespół ponownie budowałby już istniejące fixy zamiast dopiąć brakujące testy regresji.
