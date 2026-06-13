# TECZKA M24 — Panel Administratora (org admin) (pełna teczka wg wzoru M13)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje `KARTA_AUDYTU.md` §1–§7 + kod i dokłada brakujące ogniwa (Rejestr Wejść · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M24 Panel Administratora (org admin) · **Pula:** internal (org ADMIN/OWNER)
- **Ocena audytu:** 58/100 · **Tier:** Alpha górny · **Status:** 🟦 NIEPEŁNY · **Rozmiar:** S-M (do 2 dni)
- **Żywy bloker:** brak P0 — **oba P0 cross-org NAPRAWIONE** (`1f9ed50f05`, `fd8707c5b2`), zweryfikowane. Pula nietestowana na żywo.
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 + Fala 6 2026-06-12 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M24-admin/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md, f2_tests_report.md, f56_kanon_sec.md`
- **Kod:** `src/components/Admin/` (52 plików) · `AdminSettingsModule` · `server/src/routes/{adminP32,admin-data,ai-settings}.routes.ts` · `server/src/services/adminAuditService.ts`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + §0 (S1–S7) + `[[project_admin_firmy_shell]]` | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 (§27 + i18n) | stany + delta §27 |
| C Dane+API+reguły | 🟢 | karta §1e + kod 3 routery | reguły org-boundary (niżej) |
| D AI/Teresa | 🟡 | karta (AI Controls governance) | granice (niżej) |
| E Integracje | 🟢 | karta §1g | — |
| F Epiki | 🟢 | karta §7 (Fale 1–3) | przeformułowane na epiki↔luki |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1d/§6 | **Rejestr Wejść + Decyzji + korekta R3 (P0)** (niżej) |

---

## A · INTENCJA *(link + uzupełnienie)*
Werdykt + S1–S7 + 5 paneli: karta §0/§1. Shell: `[[project_admin_firmy_shell]]` (live = `AdminSettingsModule` 5 paneli).
- **Job-to-be-done:** dać administratorowi organizacji jedno miejsce do zarządzania zespołem/rolami, billingiem, governance AI, bezpieczeństwem (SCIM/IAM/API-keys) i audytem — bez wchodzenia na control-plane superadmina.
- **Persony/role:** ADMIN/OWNER danej org (rola z członkostwa w tym orgId, NIE z globalnego JWT). Eskalacja ADMIN→SUPERADMIN niemożliwa. Ochrona OWNER/last-owner/self serwerowa.
- **Zakres v1:** Team&Access (CRUD + zaproszenia cap 500) · Billing (7 endp., Stripe gated) · AI Controls (9/9 pod-zakładek) · Security (6/6: SCIM/IAM/API-keys) · Audit Log + CSV. **POZA v1:** Stripe Elements (flag-gated OFF, karta-checkout fasada); martwy `AdminSidebar`/resztki `Admin/`.
- **Metryka:** admin zarządza org bez SQL; zero cross-org leak (naprawione + do utrzymania testem).

## B · UX DOCELOWE *(link + delta)*
§27 + i18n: karta §5. `AdminSettingsModule` + sidebar spójny, `DesktopOnlyGuard`. **Delta:** żadna z 4 tabel (członkowie/audit/invoices/payment methods) nie używa `TABLE_AND_PREVIEW_CANON` (surowe `<table>`) → §27 A-S (L-05). i18n: 0× `isPolish` (dobrze) ale security/audit/scim/members hardkod EN (L-06). Error-state przez toast (P3, brak inline).

## C · DANE + API + REGUŁY *(link + org-boundary)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (`VITE_STRIPE_ENABLED` OFF).
- **Reguły org-boundary (kanon, zweryfikowane 2026-06-13):**
  - `adminP32.routes.ts` — `requireAdminContext`→`ADMIN_BOUNDARY_VIOLATION` (`:300`), rola z członkostwa w orgId. **WZORCOWY.**
  - `admin-data.routes.ts` — router-level `requireRole` + `:orgId` org-scope. **NAPRAWIONE P0 cross-org** (`1f9ed50f05`).
  - `ai-settings.routes.ts` — admin/owner-only, zawsze `userOrgId===orgId`. **NAPRAWIONE P0 cross-org** (`fd8707c5b2`).
  - `UpdateMemberRoleSchema` — bez SUPERADMIN (anty-eskalacja).
  - `adminAuditService.ts:71` — `SELECT * LIMIT 1000` bez `WHERE organization_id`, filtr in-memory (fail-closed, P2 perf — L-04).

## D · AI / TERESA *(link)*
- **Co steruje:** AI Controls (governance/limits) per org → wpływa na runtime AI całej platformy. AI settings cross-org NAPRAWIONE (`fd8707c5b2`).
- **Granice:** 2 pod-zakładki AI mają mock fallback dla list wtórnych (nie placeholder-only).

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **→** cała platforma (AI settings governance), M23 Organizacja (members/ownership + drift redirect), Stripe (billing pm token, za flagą). **Przekrój:** M27 SuperAdmin (plane rozdzielone, P0 superadmin≥admin naprawiony). **Zależność:** drift redirect koordynować z M23.

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — P0 zabezpieczone testem (FAZA 3):** oba P0 cross-org NAPRAWIONE (L-01/02) → testy regresji IDOR + escalation (L-03). [karta §7 Fala 1]
- **EPIK 2 — Audit szczelny (FAZA 3):** audit-logs org-scoped SQL zamiast in-memory cap (L-04). [karta §7 Fala 2]
- **EPIK 3 — Higiena BE (FAZA 3):** route-level role middleware members; usunąć `/debug-memberships`; PCI bez surowego PAN (L-07). [karta §7 Fala 2]
- **EPIK 4 — Czystość kodu (FAZA 3/4):** wytnij `AdminSidebar` + resztki `Admin/` + inline error-state (L-08). [karta §7 Fala 3]
- **EPIK 5 — Szlif (FAZA 4):** §27 (4 tabele) + i18n `t()` (wzór BillingFinOps) + E2E RBAC-by-role (L-05, L-06, L-09). [karta §7 Fala 3]

## G · JAKOŚĆ / DoD *(skwantyfikowane)*
| # | Kryterium | Miara M24 (zmierzone 2026-06-13, `src/components/Admin/` = 52 pliki ts/tsx) |
|---|-----------|-----------|
| 1 | Front↔back | 0 martwych przycisków; karta-checkout żywa (Stripe Elements) lub jawnie gated; martwy kod usunięty |
| 2 | Bezpieczeństwo | oba P0 cross-org zamknięte ✅ (`1f9ed50f05`+`fd8707c5b2`) + testy regresji IDOR/escalation; audit-logs org-scoped; PCI bez PAN |
| 3 | i18n | **0/52** plików z `isPolish` (czysto), ale security/audit/scim/members hardkod EN → `t()` |
| 4 | Tokeny | **0** hex w 52 plikach (czysto) |
| 5 | §27 | **10** surowych `<table>` → FilterableTable/TableWithPreviewLayout (4 główne tabele admina) |
| 6 | E2E w PR-gate | cross-org IDOR + escalation + RBAC-by-role zielone na `Londyn` (zamiast E2E smoke-fake) |

Scenariusze S1–S7 + 44 PASS/0 FAIL: karta §0/§2. Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §0–§7 | 2026-06-11 | 5/5 paneli realne; adminP32 wzorcowy; 2 boczne routery cross-org P0 (potem naprawione); §27/i18n dług | L-01,02,03,04,05,06 |
| W-02 | **Uwagi żywe** | 2026-06-13 | **brak** — pula nietestowana na żywo; dziedziczę z karty | — |
| W-03 | Re-audit + Fala 6 | 2026-06-11/12 | P0 cross-org naprawione (`1f9ed50f05`/`fd8707c5b2`); drift testy (`8f3992ccf2`, 44 PASS) | L-01,02,03 (R3 koryguje) |
| W-04 | Kod (R3) | 2026-06-13 | commity `1f9ed50f05`/`fd8707c5b2` istnieją; karta §6 oznacza oba P0 jako NAPRAWIONE | L-01,02 (potwierdza) |
| W-05 | Feedback prod | — | brak bezpośredni — admin org, nie kliencka pętla feedback | — |

### 02 · Stan obecny (prawda kodu) — karta §1
REALNE 5 paneli (Team&Access, Billing 7 endp., AI Controls 9/9, Security 6/6, Audit+CSV). **Naprawione (R3):** admin-data cross-org (`1f9ed50f05`), ai-settings cross-org (`fd8707c5b2`), drift testy (`8f3992ccf2`). MARTWE: `layout/AdminSidebar.tsx` (0 importerów), resztki `Admin/`, `GET /debug-memberships`. Honest fasada: karta-checkout (flag-gated OFF).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | cross-org leak+write `admin-data.routes.ts` | W-01,W-03 | router-level `requireRole`+`:orgId` org-scope | P0 sec | — | **STALE-zweryfikowane: NAPRAWIONE** `1f9ed50f05` (commit istnieje; karta §6 potwierdza) |
| L-02 | cross-org R/W `ai-settings.routes.ts` | W-01,W-03 | admin/owner-only, `userOrgId===orgId` | P0 sec | — | **STALE-zweryfikowane: NAPRAWIONE** `fd8707c5b2` (commit istnieje; karta §6 potwierdza) |
| L-03 | brak testów cross-org IDOR + escalation (B1/B2) | W-01 | brak `tests/…cross-org` | P0-test | 3 | otwarta (zabezpiecza naprawione P0) |
| L-04 | audit-logs globalny SELECT cap 1000 | W-01 | `adminAuditService.ts:71` | P2 | 3 | otwarta |
| L-05 | §27 niezastosowany (10 `<table>`) | W-01 | 4 tabele admina | P2 | 4 | otwarta |
| L-06 | i18n hardkod EN (security/audit/scim/members) | W-01 | wzór BillingFinOps (24×`t()`) | P2 | 4 | otwarta |
| L-07 | members bez route-level role middleware; PCI surowy `cardNumber`; martwy `/debug-memberships` | W-01 | `organizations.routes.ts:47-70` | P3 | 3 | otwarta |
| L-08 | martwy kod FE (`AdminSidebar` + resztki `Admin/`) | W-01 | `layout/AdminSidebar.tsx` (0 importerów) | P3 | 3/4 | otwarta |
| L-09 | CI nie obejmuje `Londyn`; E2E admin smoke-fake | W-01 | `test-suite.yml` `[main,develop]` | P2 | 4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | karta-checkout | Stripe Elements (live) / trwały label „managed/disabled" | Piotr | TBD | otwarta |
| D-02 | resztki `components/Admin/` (część żyje w superadminie) | per plik: wytnij / przenieś / zostaw | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — `VITE_STRIPE_ENABLED` (OFF → karta-checkout fasada honest); gating ADMIN (`ProtectedRoute`) + `DesktopOnlyGuard`; beta-lock 3-warstwowy (W7).
### 06 · Ryzyka — Oba P0 cross-org NAPRAWIONE, ale bez testów regresji (B1/B2) naprawa niezabezpieczona. Metodologia: SEC orzekł błędnie „wzorcowy" patrząc tylko na adminP32 — KAŻDY boczny router wymaga testu IDOR. Dev `.env` → Railway PROD (testy cross-org read-only). 
### 07 · Log — 2026-06-13 (teczka): R3 potwierdza oba P0 NAPRAWIONE (`1f9ed50f05`+`fd8707c5b2`). Re-audit 2026-06-11: F 3→8; Fala 6: C 8→9 (44 PASS); ocena 58. Re-ocena po testach regresji + Fazach 3/4.

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta + re-audit + kod-R3; uwagi żywe = brak) · R2 zero sierot · R3 statusy z dowodem (L-01/02 NAPRAWIONE — commity zweryfikowane, karta §6 potwierdza) · R4 DoD z liczbami (i18n 0/52, hex 0, table 10) · R5 decyzje z właścicielem (terminy TBD) · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = Fazy 3+4. **Teczka kompletna do egzekucji.**

**Ryzyko (1 zdanie):** Oba P0 cross-org (admin-data `1f9ed50f05` + ai-settings `fd8707c5b2`) są naprawione, ale dopóki brak testów regresji IDOR/escalation, naprawa jest niezabezpieczona — a lekcja metodologiczna (SEC zaufał tylko głównemu routerowi adminP32, przeoczył boczne) nakazuje pokryć testem KAŻDY boczny router.
