# WP M24 — Panel Administratora (org admin) · dokończenie do 100%

**Pula:** internal · **Karta:** `Harvard/modules/M24-admin/KARTA_AUDYTU.md` (ocena 58/100) · **Rozmiar:** S-M (do 2 dni) · **Żywy bloker:** brak P0 (NAPRAWIONE)
**Faza programu:** FAZA 3 (szlif + testy IDOR) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Panel solidny funkcjonalnie: 5/5 paneli REALNE — Team&Access (CRUD członków + ochrona OWNER/last-owner/self FE+BE `OrganizationController.ts:242,358`, kod zaproszenia cap 500), Billing (7 endpointów), AI Controls (9/9 pod-zakładek), Security (6/6: SCIM/IAM/API-keys), Audit Log + CSV. Główny router `adminP32.routes.ts` WZORCOWY: `requireAdminContext`→`ADMIN_BOUNDARY_VIOLATION` (`:300`), rola z członkostwa w danym orgId, eskalacja ADMIN→SUPERADMIN niemożliwa. **Naprawione w audycie:** oba P0 cross-org w bocznych routerach — `admin-data.routes.ts` router-level requireRole + `:orgId` org-scope (commit `1f9ed50f05`) i `ai-settings.routes.ts` admin/owner-only `userOrgId===orgId` (commit `fd8707c5b2`); drift testów naprawiony (`8f3992ccf2`, 44 PASS/0 FAIL). Pozostaje: §27 na 4 tabelach, audit-logs global SELECT (P2), brak testów cross-org IDOR, martwy kod, Fazy 3+4. NIE planować od nowa P0 — zamknięte.

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 3 + 4)
- **[honest] Karta-checkout fasada** — `AdminBillingFinOpsPanel.tsx` surowy `paymentMethodId`, brak Stripe Elements; zgodne z `VITE_STRIPE_ENABLED=OFF` (świadome). FAZA 3: rozważyć Stripe Elements lub jawny label.
- **[P3] error-state przez toast** — brak inline error-state w panelach. FAZA 3.
- i18n: 0× `isPolish` (dobrze), ale security/audit/scim/members hardkod EN (toasty, nagłówki, ROLE_GUIDANCE); wzorzec: BillingFinOps (24× `t()`). FAZA 4.

### (b) BACKEND / API (FAZA 3)
- **[P2 F6-05] audit-logs globalny SELECT** — `adminAuditService.ts:71` `SELECT * LIMIT 1000` bez `WHERE organization_id`, filtr in-memory (`matchesAuditFilter` fail-closed → brak wycieku, ale tenant może nie zobaczyć własnych logów przy capie + perf). Fix: `WHERE organization_id=?` w SQL.
- **[P3 F6-02]** members POST/PATCH/DELETE bez route-level role middleware (gating egzekwowany w handlerze). Dodać middleware dla spójności.
- **[P3 F6-04] PCI scope-creep** — surowy `cardNumber` do backendu; przyjmować tylko Stripe token.
- **[P3 F6-06] martwy `GET /debug-memberships`** (`organizations.routes.ts:47-70`) surowy PG + console.log → usuń.
- **[P3] martwy kod FE** — `layout/AdminSidebar.tsx` (0 importerów); resztki `components/Admin/` (per plik do rozstrzygnięcia, część żyje w superadminie).

### (c) INTEGRACJA / TESTY (FAZA 3 + 4)
- **[P0 testowy] cross-org IDOR nietestowany NIGDZIE** (B1) — mimo naprawy `1f9ed50f05`/`fd8707c5b2` brak testu regresji: admin org A → org B = 403/404 na members/billing/audit/**admin-data/ai-settings**. FAZA 3 (zabezpieczenie naprawionych P0).
- **[P0 testowy] privilege-escalation** (B2) — brak SUPERADMIN przez `updateMemberRole`. FAZA 3.
- **[P2]** B5 billing 7 endp.+Stripe OFF, B6 audit+CSV, B7-B11 SCIM/transfer/invite. FAZA 4.
- CI: `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate ≈ 0; E2E admin smoke-fake (goto+url-truthy, bez logowania/asercji). FAZA 4: realne E2E RBAC-by-role + trigger `Londyn`.

## 3. Kroki realizacji
1. **(FAZA 3)** Testy cross-org IDOR (B1) + privilege-escalation (B2) — pokrywają oba naprawione routery + brak SUPERADMIN przez role.
2. **(FAZA 3)** Audit-logs org-scoped SQL (`WHERE organization_id=?` zamiast in-memory cap 1000).
3. **(FAZA 3)** Route-level role middleware members POST/PATCH/DELETE; usunąć `/debug-memberships`; PCI — backend bez surowego PAN.
4. **(FAZA 3/4)** Wytnij martwy kod (AdminSidebar, resztki Admin/); inline error-state.
5. **(FAZA 4)** §27 dla 4 tabel (`TableWithPreviewLayout`); i18n `t()` (wzór BillingFinOps); realne E2E RBAC-by-role + trigger CI `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** zero martwych przycisków; karta-checkout żywa (Stripe Elements) lub jawnie gated; martwy kod usunięty.
2. **Bezpieczeństwo:** oba P0 cross-org zamknięte (już — `1f9ed50f05`+`fd8707c5b2`) + testy regresji IDOR/escalation; audit-logs org-scoped; PCI bez PAN.
3. **i18n:** `t()` w security/audit/scim/members.
4. **Tokeny:** Visual Standard (0 hex już OK).
5. **§27:** 4 tabele admina przez FilterableTable/TableWithPreviewLayout.
6. **E2E w PR-gate:** cross-org IDOR + escalation + RBAC-by-role zielone na `Londyn`.

## 5. Weryfikacja
- IDOR: admin org A próbuje `GET/PUT admin-data/user-tiers/<org B>` i `ai-settings PUT /org/<org B>` → 403/404 (test + żywy read-only proof na staging).
- escalation: `updateMemberRole(SUPERADMIN)` → odrzucone.
- audit: tenant widzi pełne własne logi (nie ucięte capem 1000).
- Fazy 3/4 z dowodami w `Harvard/modules/M24-admin/evidence/`.
- Uwaga DB: dev `.env` może wskazywać Railway PROD — testy cross-org OSTROŻNIE (read-only).

## 6. Zależności
- WYJŚCIE → cała platforma (AI settings governance); → M23 Organizacja (members/ownership + drift redirect — koordynować z WP M23); przekrój M27 (plane superadmin rozdzielone).
- Niezależne od kręgosłupa (Faza 0).
- Ryzyko jednym zdaniem: oba P0 cross-org NAPRAWIONE, ale bez testów regresji (B1/B2) naprawa jest niezabezpieczona — metodologicznie SEC orzekł błędnie „wzorcowy" patrząc tylko na adminP32, więc każdy boczny router trzeba pokryć testem IDOR.
