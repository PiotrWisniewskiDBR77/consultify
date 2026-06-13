# TECZKA M23 — Organizacja (workspace organizacji) (pełna teczka wg wzoru M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje `KARTA_AUDYTU.md` §1–§7 + kod i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · korekta staleności R3 · enumeracja API · epiki→stories Gherkin→L-xx). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja głębi (PODŁOGA): [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M23 Organizacja (workspace org) · **Pula:** internal (org-admin/owner; kontekst Teresy)
- **Ocena audytu:** 52/100 · **Tier:** Alpha · **Status:** 🟦 NIEPEŁNY (Fazy 3+4) · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** karta opisuje 3×P1 — **R3 koryguje: WSZYSTKIE 3 NAPRAWIONE i zweryfikowane w kodzie 2026-06-13** (patrz H/03). Pula nietestowana na żywo (internal).
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 (re-audit) · teczka 2026-06-13 (pogłębiona)
- **Karta:** `Harvard/modules/M23-organizacja/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md, f2_tests_report.md, f56_kanon_sec.md`
- **Kod:** `src/components/Organization/` (5 plików: `OrganizationAdminPanel.tsx`, `CompetencyCatalog.tsx`, `KnowledgeGraphExplorer.tsx`, `OrgContextSummaryBanner.tsx`, `OrganizationSidebar.tsx`) · `server/src/routes/{competency,organization-context-store}.routes.ts` · `server/src/routes/organization/organization-data.routes.ts` · `server/src/routes/organization-profiles.routes.ts` · `useContextBuilderStore.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (S1–S7) | job-to-be-done + zakres v1/POZA (niżej) |
| B UX docelowe | 🟡 | karta §5 (drift admin) | stany ekranu + delta fasady kontekstu (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e + kod 4 routery | **enumeracja API per router + reguły org-scope** (niżej) |
| D AI/Teresa | 🟢 | karta §1g (profil→kontekst) | granice + zasilanie per-org (niżej) |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (Fale 1–3) | **epiki→stories Gherkin→L-xx** (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby zmierzone** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji + korekta R3 (3×P1) + DP-11 billing** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
Werdykt + S1–S7: karta §0/§1.
- **Job-to-be-done:** dać organizacji jeden workspace na najwrażliwsze dane (profil firmy, strategia/cele, kompetencje, członkowie, branding, knowledge graph) — które zasilają kontekst Teresy i RBAC całej platformy.
- **Persony/role:** owner/admin (pełny dostęp + zaproszenia + role), member (ograniczony; deep-link do sekcji admin musi być zablokowany — L-04). Org-switch tylko do org z aktywnym membership (`organization_members`, ACTIVE).
- **Zakres v1:** profil firmy (SSOT backend) · Goals/Challenges/Strategy (teraz backend per-org — W3) · Knowledge Graph · Members + zaproszenia · Competencies · Domains · Branding · baner kontekstu Teresy · org-switch (wymiana tokenu). **POZA v1:** auto-join z approved-domains (feature-gap, brak konsumenta); `analyze` endpoint (martwy 404); **Billing/Limits = jedno miejsce w Admin/M24, tylko label „zarządzane przez DBR77", BEZ live-checkout** (DP-11, L-05).
- **Metryka:** profil/strategia przeżywają zmianę przeglądarki/org i AI je widzi (kontrast z dawną fasadą localStorage — naprawione W3); member nie wchodzi deep-linkiem do sekcji admin (L-04).

## B · UX DOCELOWE *(link + delta + stany)*
Drift admin + §27 + i18n: karta §5. Org-switch wzorcowy.
- **Stany ekranu (kanon „koniec cichych pustek"):** pusty (org bez profilu → CTA „uzupełnij profil"), ładowanie (skeleton sekcji), błąd (baner z Retry — wzór `7495c12ffb` z M25), pełny, **brak-uprawnień** (member na deep-linku admin → redirect/403, dziś dziura L-04).
- **Delta historyczna (NAPRAWIONA):** „kontekst organizacyjny" (Goals/Challenges/Strategy) był fasadą localStorage — naprawione backendem per-org (`organization-context-store.routes.ts`, W3 `d013ab7c4c`).
- **Pozostała delta:** drift admin — deep-link `/organization/members` → renderuje lokalny `OrganizationAdminPanel` (932 l.) vs klik → redirect `ADMIN_REDIRECTS` do M24 (L-04); Billing/Limits CTA tylko `trackFunnelEvent` (L-05, DP-11 = label managed).

## C · DANE + API + REGUŁY *(enumeracja + org-scope)*
- **Wiring FE↔BE↔DB:** karta §1e (kompletna tabela). **Flagi:** karta §1f (route `requireAuth` bez roli).
- **Model danych:** `organization_profiles` (strategia/cele = najwrażliwsze), `organization_members` (membership+rola), `org_context_store` (Goals/Challenges/Strategy per-org, W3), KG tables, competency tables. Pułapki bigint/jsonb → `pgFlags.ts`.
- **API per router (metoda · gate · zweryfikowane 2026-06-13):**
  - **`organization-profiles.routes.ts`** (WZORCOWY, najwrażliwsze dane): `userOrgId!==orgId→403` na `:189,378,622` + role-gate na PUT. Martwy `POST /:orgId/analyze` (404, L-09).
  - **`competency.routes.ts`** (14 endpointów: `GET/POST/PUT/DELETE categories`, `seed-defaults`, skills CRUD): `router.use(verifyToken)` (`:10`) + `requireRole('admin','owner')` na write (`:14`). **NAPRAWIONE** (był P1 no-auth, mount `Gateway.ts:644` bez gatewayVerifyToken).
  - **`organization/organization-data.routes.ts`** (5 endp.: `GET /`, `POST /export/:category` `:210`, `POST /export/all` `:349`, `GET/PUT`): `router.use(verifyToken)` (`:14`) + `requireRole('admin','owner')` na export (`:212,:351`). **NAPRAWIONE** (był P1 export bez role-gate → member eksfiltrował audit_log/activity_log).
  - **`organization-context-store.routes.ts`** (2 endp.: `GET /` `:24`, `PUT /` `:64`): `router.use(verifyToken)` (`:15`), per-org, mount `Gateway.ts:700`. **REALNY backend** (była fasada localStorage `useContextBuilderStore.ts:414`).
  - **`auth.routes.ts:707`** — org-switch membership-verified (ACTIVE w `organization_members` przed wydaniem tokenu).
- **Reguły biznesowe:** org-switch = wymiana JWT po weryfikacji membership; profil PUT = role-gated; eksport danych = admin/owner-only; brak maszyny stanów (workspace, nie workflow).

## D · AI / TERESA *(link)*
- **Co zasila:** profil firmy → backendowy kontekst Teresy; Goals/Challenges/Strategy per-org (W3) → kontekst Teresy (naprawione; dawniej localStorage, AI nie widział).
- **Granice:** Goals AI-sugestie — karta §1b oznacza `onRefine` no-op (MOCK-STUB) — albo realny LLM, albo usunąć przycisk (D-03); persona „nie udawaj wykonania".
- **Wejścia kontekstu:** profil + strategia/cele per-org (backend, nie localStorage).

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **→** kontekst Teresy (profil + Goals/Strategy per-org), M24 Admin (redirect sekcji ADMINISTRATION — drift przy deep-link L-04), cała app (org-switch wymiana tokenu). **Kręgosłup:** niezależny od Fazy 0. **Zależność blokująca:** drift redirect koordynować z M24 (D-02 ↔ M24 drift).

## F · EPIKI → STORIES → ZADANIA *(z karty §7, forma Gherkin)*
- **EPIK 1 — Bezpieczeństwo zweryfikowane (FAZA 1):** 3×P1 z karty NAPRAWIONE w kodzie → domknąć testami regresji.
  - **Story 1.1:** jako audytor chcę testu competency-auth, aby naprawa `verifyToken+requireRole` nie zregresowała. *Dane* niezalogowany/member; *gdy* `POST /api/competency/categories`; *wtedy* 401/403. → **Z→L-07**
  - **Story 1.2:** jako member chcę dostać 403 na eksporcie. *Dane* rola member; *gdy* `POST /organization-data/export/all`; *wtedy* 403 (nie eksfiltracja audit_log). → **Z→L-07**
  - **Story 1.3:** jako tenant chcę izolacji multi-tenant. *Dane* PG up; *gdy* `orgContext.middleware.test.ts` (dziś 45 SKIP); *wtedy* zielony cross-org. → **Z→L-07**
- **EPIK 2 — Kontekst org realny (FAZA 1/2):** Goals/Challenges/Strategy backend per-org + zasilanie Teresy.
  - **Story 2.1:** jako konsultant chcę by cele przeżyły zmianę przeglądarki/org. *Dane* zapis Goals w org A; *gdy* zmiana przeglądarki i powrót; *wtedy* dane są (nie localStorage). → **Z→L-01 (NAPRAWIONE `d013ab7c4c`, żywo potwierdzić)**
- **EPIK 3 — Koniec driftu admin (FAZA 3):** role-gate `/organization/*` lub redirect przy URL.
  - **Story 3.1:** jako member chcę być odbity z sekcji admin. *Dane* member; *gdy* deep-link `/organization/members`; *wtedy* redirect M24/403 (nie lokalny panel). → **Z→L-04 (D-02)**
- **EPIK 4 — Honest billing (FAZA 3, DP-11):** Billing/Limits = label „zarządzane przez DBR77", bez live-checkout.
  - **Story 4.1:** jako admin chcę uczciwego komunikatu billing. *Dane* klik „Upgrade"; *gdy* CTA; *wtedy* label managed (nie martwy `trackFunnelEvent`). → **Z→L-05 (D-01=DP-11)**
- **EPIK 5 — Szlif kanonu (FAZA 4):** §27 + i18n + sanityzacja + martwy kod.
  - **Story 5.1:** §27 dla 2 tabel (członkowie/competencies). → **Z→L-08**
  - **Story 5.2:** i18n `t()` zamiast `isPl` + opcje ról przetłumaczone. → **Z→L-06**
  - **Story 5.3:** sanityzacja SVG branding + wytnij martwy `analyze` + KG orgId fallback. → **Z→L-09**

## G · JAKOŚĆ / DoD *(skwantyfikowane, zmierzone 2026-06-13)*
| # | Kryterium | Miara M23 (`src/components/Organization/` = 5 plików ts/tsx) |
|---|-----------|-----------|
| 1 | Front↔back | Goals/Challenges/Strategy backend per-org (W3) + widoczne dla Teresy; Billing CTA label managed (DP-11); 0 martwych CTA |
| 2 | Bezpieczeństwo | competency `verifyToken+requireRole` ✅ (`fd8707c5b2`/`e3945bc7fc`); export `requireRole` ✅ (`fd8707c5b2`, `:212/:351`); + testy regresji + `orgContext.middleware.test.ts` z PG (dziś **45 SKIP**) |
| 3 | i18n | **1/5** plików z `isPolish` (`CompetencyCatalog.tsx:51`) — `t()` zamiast `isPl`, przetłumaczyć opcje ról |
| 4 | Tokeny | **15** hex w 5 plikach (m.in. `#6366f1` default brand = wartość-dana OK; DP-8 palety legalne) — zweryfikować resztę |
| 5 | §27 | **2** surowe `<table>` → FilterableTable (członkowie/competencies) |
| 6 | E2E w PR-gate | competency-auth + export-role + multi-tenant isolation zielone na `Londyn` (dziś `test-suite.yml` tylko `[main,develop]`) |

Scenariusze S1–S7 + 185 PASS/3 FAIL(stale)/45 SKIP: karta §0/§2. Bezpieczeństwo: karta §6.
- **Wydajność/limity:** KG relacje przy dużych grafach; eksport danych (paginacja/strumień). **Telemetria:** % org z uzupełnionym profilem; czy AI widzi kontekst.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §0–§7 | 2026-06-11 | mocny rdzeń + 3×P1 (competency no-auth, export no-role, Goals localStorage) + drift admin | L-01,02,03,04,06 |
| W-02 | **Uwagi żywe** (`UWAGI_TESTY_2026-06-13.md`) | 2026-06-13 | **brak** — pula internal nietestowana na żywo; dziedziczę z karty | — |
| W-03 | Re-audit Sprinty 1–5 | 2026-06-11 | org-context-store backend (`d013ab7c4c`); competency+export (`fd8707c5b2`/`e3945bc7fc`/`c7f36d9f3f`) | L-01,02,03 (R3 koryguje) |
| W-04 | Kod (R3) | 2026-06-13 | grep zweryfikowany: competency `verifyToken+requireRole`(:10/:14); export `requireRole`(:212/:351); context-store mount(:15)+PUT(:64) | L-01,02,03 (potwierdza naprawę) |
| W-05 | `_DECYZJE.md` DP-11 | 2026-06-13 | billing = jedno miejsce Admin, label managed, bez live-checkout | L-05 |
| W-06 | Feedback prod | — | brak — moduł org-admin, nie kliencka pętla feedback bezpośrednia | — |

### 02 · Stan obecny (prawda kodu) — karta §1
REALNE: profil firmy (org+role scoped), KG, Members, Domains, Branding, org-switch (membership-verified), kontekst Teresy. **Naprawione (R3, kod 2026-06-13):** Goals/Challenges/Strategy → backend per-org (`organization-context-store.routes.ts`, `d013ab7c4c`); competency → `verifyToken`+`requireRole`; org-data export → `requireRole`. ZEPSUTE/dług: Billing CTA martwe → DP-11 (P2), drift admin (P2), martwy `analyze` (P3).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | Goals/Challenges/Strategy fasada localStorage (nie per-org, nie Teresa) | W-01,W-03 | `organization-context-store.routes.ts:15,64` + `Gateway.ts:700` | P1 fasada | 1/2 | **STALE-zweryfikowane: NAPRAWIONE** `d013ab7c4c` (backend per-org + PUT mount). Karta §1b/1e wciąż „localStorage-only" = rozjazd. Żywo: persystencja + Goals AI no-op (D-03) |
| L-02 | `/api/competency/*` bez auth | W-01,W-03,W-04 | `competency.routes.ts:10` (`verifyToken`) `:14` (`requireRole admin,owner`) | P1 sec | 1 | **STALE-zweryfikowane: NAPRAWIONE** `fd8707c5b2`/`e3945bc7fc` (kod 2026-06-13) |
| L-03 | org-data export bez role-gate | W-01,W-03,W-04 | `organization/organization-data.routes.ts:212,351` (`requireRole admin,owner`) | P1 sec | 1 | **STALE-zweryfikowane: NAPRAWIONE** `fd8707c5b2` (kod 2026-06-13) |
| L-04 | route `/organization/*` bez role-gate (deep-link member→admin) + drift admin | W-01 | `AppRoutes.tsx:2180` `requireAuth` bez roli; lokalny `OrganizationAdminPanel` (932 l.) | P2 | 3 | otwarta (koordynować z M24, D-02) |
| L-05 | Billing/Limits CTA martwe | W-01,W-05 | `OrganizationAdminPanel.tsx:292,474` (tylko `trackFunnelEvent`) | P2 | 3 | otwarta → **DP-11 (label managed, bez checkout)** |
| L-06 | i18n `isPl` + nieprzetłumaczone opcje ról | W-01 | `CompetencyCatalog.tsx:51`; `OrganizationAdminPanel.tsx:179` | P2 | 4 | otwarta |
| L-07 | brak testów competency-auth/export-role/store-persist; 3 FAIL stale; 45 SKIP | W-01 | `organizationData.no-stubs.test.ts`; `orgContext.middleware.test.ts` | P1-test | 1 | otwarta |
| L-08 | §27 (2 `<table>`) | W-01 | `src/components/Organization/` | P2 | 4 | otwarta |
| L-09 | SVG branding stored-XSS; martwy `analyze` 404; KG orgId fallback | W-01 | branding upload; `organization-profiles:analyze`; KG `:20-32` | P2/P3 | 3 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Billing/Limits CTA | realny checkout / **jawne „zarządzane przez DBR77"** | Piotr | TBD | **rekom DP-11 = label managed, bez live-checkout** |
| D-02 | drift admin (lokalny panel vs redirect M24) | redirect przy URL / `requiredRole` na pod-ścieżkach | Piotr | TBD | otwarta (koordynacja M24) |
| D-03 | Goals AI (obecnie `onRefine` no-op) | realny LLM / usunąć przycisk | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — route `/organization/*` = `requireAuth` bez roli (gating po API, miejscami słaby — L-04). Brak beta-locka modułu (org core). DP-11: billing label „managed by DBR77".
### 06 · Ryzyka — Karta opisuje 3×P1 jako żywe, ale **weryfikacja kodu 2026-06-13 potwierdza wszystkie 3 NAPRAWIONE** (competency `verifyToken+requireRole`, export `requireRole`, Goals backend per-org). Karta §1b/1e/§6 wciąż opisuje stare stany = rozjazd. NIE budować od zera — domknąć testami regresji. Dev `.env` → Railway PROD (testy sec read-only). 45 SKIP = multi-tenant isolation nietestowana bez PG.
### 07 · Log — 2026-06-13 (teczka pogłębiona): R3 potwierdza 3×P1 NAPRAWIONE w kodzie; DP-11 wpisane do L-05/D-01; enumeracja API per router + epiki Gherkin dodane. Re-audit 2026-06-11: A 17→20, B 9→11, C 7→8, F 5→7, ocena 52. Re-ocena po testach regresji + Fazach 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + re-audit + kod-R3 + DP-11; uwagi żywe = brak, jawnie dziedziczone) · R2 zero sierot (wejście→luka→story→DoD) · R3 statusy z dowodem (L-01/02/03 NAPRAWIONE — zweryfikowane w kodzie 2026-06-13, korekta rozjazdu karty) · R4 DoD z liczbami (i18n 1/5, hex 15, table 2, 45 SKIP) · R5 decyzje z właścicielem (D-01=DP-11; terminy TBD) · A–E docelowy zlinkowany · F epiki→stories Gherkin↔luki · G DoD+S+sec+wydajność · R6 sesja żywa = Fazy 3+4. **Teczka kompletna do egzekucji.**

**Ryzyko (1 zdanie):** Karta nadal opisuje 3×P1 (competency no-auth, export no-role, Goals localStorage) jako żywe blokery, ale weryfikacja kodu potwierdza że WSZYSTKIE są naprawione — bez tej korekty zespół ponownie budowałby już istniejące fixy zamiast dopiąć brakujące testy regresji (L-07).
