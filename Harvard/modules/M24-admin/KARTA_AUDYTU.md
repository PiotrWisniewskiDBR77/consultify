# M24 — Panel Administratora (org admin) — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `7808e4717f`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M24 · inwentarz `Harvard/podzial/inventory/INV_G_*.md` (sekcja PANEL ADMINISTRATORA, poz.1-7) · poprzednia karta `docs/audit/2026-06-02/MODULE_17` (54/100) + plan 2026-06-07 · `[[project_admin_firmy_shell]]`
**Evidence:** `Harvard/modules/M24-admin/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 50/100 — Tier: Alpha · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 22 | 5/5 paneli REALNE (Team&Access, Billing 7 endp., AI Controls 9/9 pod-zakładek, Security 6/6, Audit+CSV); 2 pozycje martwy kod; karta-checkout fasada (honest, flag-gated). |
| B. Wiring i dane | 15 | 13 | Wszystkie panele na realnych backendach + tabelach; org-scope rdzenia (adminP32) szczelny. |
| C. Testy automatyczne | 15 | 8 | 40 PASS/4 FAIL (stale/drift); RBAC anti-escalation dobrze testowany, ale **org-scope (cross-org) nietestowany nigdzie**, E2E fałszywa zieleń. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 niewykonana. |
| E. Kanony/UI | 10 | 6 | i18n 0× `isPolish` (dobrze) + shell spójny, ale §27 NIE użyty na 4 tabelach admina (surowe `<table>`); security/audit hardkod EN. |
| F. Bezpieczeństwo/dostęp | 10 | 3 | **Główny panel adminP32 WZORCOWY** (ADMIN_BOUNDARY_VIOLATION, anti-escalation, owner/self serwerowo), ale **2 boczne routery cross-org IDOR** (admin-data, ai-settings). |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **TAK — cross-org leak+write na `admin-data.routes.ts` (any-user PII read `:54`, admin cross-org write `:94`) + `ai-settings.routes.ts` (owner/admin cross-org R/W `:218,:255`) → max 50 + P0.** Zweryfikowane osobiście. Suma surowa 52 > 50 → cap wiąże na 50. Dodatkowo Faza 4 → max 70 + „NIEPEŁNY". |

**Werdykt jednym akapitem:** Panel administratora ma **dwubiegunowy profil bezpieczeństwa** — i to jest najważniejsze ustalenie audytu. **Główny router panelu (`adminP32.routes.ts`) jest WZORCOWY:** strażnik `requireAdminContext` z twardym `if (orgId !== req.user.organizationId && !isSuperAdmin) → 403 ADMIN_BOUNDARY_VIOLATION` (`:300`), rola aktora liczona z członkostwa w danym orgId (nie z globalnego JWT), wszystkie panele (billing/security/ai/audit/iam) scoped `WHERE organization_id=?`; eskalacja ADMIN→SUPERADMIN NIEMOŻLIWA (`UpdateMemberRoleSchema.role` bez SUPERADMIN; `normalizeOrganizationRole('SUPERADMIN')`→org-ADMIN, nigdy nie tknie `is_superadmin`); ochrona OWNER/last-owner/self serwerowa; P0 superadmin≥admin potwierdzony naprawiony (`ProtectedRoute.tsx:72-74`); SSO/billing bez wycieku sekretów (tylko flagi posture / `pm_` token, nie `sk_`/certy). **ALE dwa boczne routery zasilające panel AI Controls są szeroko otwarte cross-org** (zweryfikowane osobiście): (1) **`admin-data.routes.ts`** (mount `Gateway.ts:422`, tylko `router.use(verifyToken)`) — `GET /user-tiers/:orgId` (`:54`) i `GET /cost-attribution/:orgId` (`:124`) **bez requireRole/membership** → DOWOLNY zalogowany user czyta listę członków z e-mailami + tier AI + koszty DOWOLNEJ org przez podmianę `:orgId` (cross-org PII leak); `PUT /user-tiers/:orgId/:userId` (`:94`) ma `requireRole('admin','owner')`, ale `requireRole` sprawdza GLOBALNĄ rolę, nie członkostwo w `:orgId` → admin org A pisze tier w org B (cross-org write); (2) **`ai-settings.routes.ts`** — `GET /org/:orgId` (`:218`, guard OR) i `PUT /org/:orgId` (`:255`) pozwalają globalnej roli `owner`/`administrator` czytać i zapisywać AI-settings DOWOLNEJ org (org-match egzekwowany tylko dla `administrator` na PUT, `owner` go omija). **Krytyczna lekcja metodologiczna:** agent SEC orzekł „BRAK P0/P1, panel wzorcowy" — bo sprawdził TYLKO główny `adminP32`; agent KOD złapał boczne routery. Osobista weryfikacja potwierdziła dziury — dlatego krzyżowo sprawdzam też różowe werdykty, nie tylko alarmujące. Funkcjonalnie panel jest mocny (5/5 paneli realne: pełny CRUD członków z ochroną, billing 7 endpointów, AI Controls 9/9 pod-zakładek realnych, Security 6/6 z realnym SCIM/IAM/API-keys, Audit z eksportem CSV). Hard cap (cross-org → 50) + niewykonane Fazy 3+4.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_G sekcja PANEL ADMINISTRATORA, poz.1-7.
**Scenariusze krytyczne (7):**
1. **S1** — Team & Access: CRUD członków/role + ochrona OWNER/self.
2. **S2** — Billing & Plans (7 endpointów + Stripe gating).
3. **S3** — AI Controls (governance + 9 pod-zakładek).
4. **S4** — Security & Identity (6 zakładek + SCIM/IAM).
5. **S5** — Audit Log (zdarzenia + CSV export + retencja).
6. **S6** — Transfer własności.
7. **S7** — Kod zaproszenia (cap 500).
**Obowiązujące kanony:** §27 — **TAK** (członkowie, audit, invoices, payment methods) · CARD_CONTENT_FORMULA: **N/D** · wzorzec: `AdminSettingsModule` z własnym sidebarem · gating: rola **ADMIN** (`ProtectedRoute`) + `DesktopOnlyGuard`.

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Werdykty: **REALNE 5 paneli · MARTWE 2 (AdminSidebar + resztki Admin/).**

### 1a. REALNE (zweryfikowane)
- Team&Access (CRUD `Api.getOrganizationMembers/add/updateRole/remove`, ochrona OWNER+self FE+BE `OrganizationController.ts:242,358`, kod zaproszenia cap 500 `:377`), Billing (7 endpointów `getAdminBilling*`), AI Controls (**9/9 pod-zakładek realne**, fetchują backend), Security (**6/6**: SCIM tokeny+group-mappings, Delegated IAM CRUD, API access `/api/api-keys`), Audit Log (zdarzenia org-scoped + CSV `adminP32.routes.ts:2311`).

### 1b. MOCK / STUB
- **[honest] Karta-checkout** (`AdminBillingFinOpsPanel.tsx`) — surowy `paymentMethodId`, brak Stripe Elements; fasada zgodna z `VITE_STRIPE_ENABLED` OFF.
- 2 pod-zakładki AI mają „mock data" fallback dla list wtórnych (nie placeholder-only).

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- Boczne routery cross-org (sekcja 6) — funkcjonalnie „działają", ale to dziury bezpieczeństwa.

### 1d. UKRYTE / MARTWY KOD
- **[MARTWY] `layout/AdminSidebar.tsx`** — 0 importerów → wytnij.
- **[MARTWE/współdzielone] resztki `components/Admin/`** (`ABTestingDashboard`, `V8AdminDiagnosticsPanel` żyją w superadminie; `ChatV9Flags*` flag-overlay) — nie montowane w org-adminie; per plik do rozstrzygnięcia.
- **[MARTWY] `GET /debug-memberships`** (`organizations.routes.ts:47-70`) surowy PG + console.log → usuń.

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Status |
|---|---|---|---|
| Members CRUD | `OrganizationController` | organization_members | DZIAŁA (membership-scoped) |
| Billing | `adminP32` (7 endp.) | billing/invoices | DZIAŁA (org-scoped) |
| AI Controls | `adminP32` + `ai-settings` + `admin-data` | ai_settings, ai_usage_stats | DZIAŁA; **ai-settings/admin-data cross-org (P0)** |
| Security/SCIM/IAM | `adminP32` | scim/iam tables | DZIAŁA (org-scoped) |
| Audit Log | `adminAuditService` | audit events | DZIAŁA (filtr in-memory, P2 perf) |

### 1f. Flagi
| Flaga | Default | Wpływ |
|---|---|---|
| `VITE_STRIPE_ENABLED` | OFF | karty płatności (honest gating) |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WYJŚCIE → | cała platforma | AI settings (governance/limits) | DZIAŁA (ai-settings cross-org P0) |
| WYJŚCIE → | Stripe | billing (pm token) | DZIAŁA (za flagą) |
| WYJŚCIE → | M23 Organizacja | members/ownership | DZIAŁA |
| przekrój | M27 SuperAdmin | plan changes / cross-org = plane superadmin | rozdzielone (P0 superadmin≥admin naprawione) |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `7808e4717f`):** **40 PASS / 4 FAIL / 0 SKIP.**
**Root-cause 4 FAIL (stale/drift, nie regresja):** 3× `effectiveAccessService.test.ts` (test importuje symbole już nieeksportowane: `WORKFLOW_CAPABILITIES`, `mapLegacyPermissionObjectToCapabilities`, `FACTORY_ROLE_TEMPLATES`; capability `initiative.create`→`submit`); 1× `roles.routes.test.ts` (handler wymaga `name`, test wysyła `label` → 400).
**RBAC: testowany (najmocniejsza część)** — `OrganizationController.membership.test.ts` weryfikuje anty-eskalację ADMIN→OWNER, last-owner, anty-self-lockout, odmowę non-admin, audyt. **Org-scope (cross-org): NIE testowany NIGDZIE** — krytyczna luka (zgodna z odkrytymi dziurami bocznych routerów).
**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | PR-gate | Luka |
|---|---|---|---|---|---|
| S1 Team&Access | ✓ mock | ✓ RBAC | fake | ✗ | cross-org nietestowany |
| S2 Billing | 1 panel | ✗ | fake | ✗ | 7 endpointów |
| S3 AI Controls | ✗ | tylko v8 flags | ✗ | ✗ | 9 zakładek |
| S4 Security/SCIM | ✗ | roles; SCIM=0 | fake | ✗ | SCIM |
| S5 Audit+CSV | ✗ | emisja; odczyt/export=0 | fake | ✗ | export |
| S6/S7 transfer/invite | ✗ | częśc. | ✗ | ✗ | — |
**CI:** `test-suite.yml` tylko `[main,develop]`; default `Londyn` → PR-gate ≈ 0; E2E admin smoke-only (fałszywa zieleń: goto+url-truthy, bez logowania/asercji).
**Backlog testowy:** [P0] B1 testy cross-org IDOR (admin org A→org B = 403/404) members/billing/audit/**admin-data/ai-settings**; [P0] B2 privilege-escalation (brak SUPERADMIN przez updateMemberRole); [P1] B3/B4 stale testy, B5 billing 7 endp.+Stripe OFF, B6 audit+CSV; [P2] B7-B11 SCIM/panele/transfer/invite/realne E2E RBAC.

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** **Test bezpieczeństwa na żywo (KRYTYCZNY):** curl `GET /api/admin-data/user-tiers/<obca-org>` na koncie zwykłego usera → czy zwraca e-maile obcej org (P0 read); `PUT` tier + `ai-settings PUT /org/<obca>` jako owner innej org (P0 write — read-only/ostrożnie!). Smoke: members CRUD, billing, audit CSV. **Uwaga DB:** dev `.env` może wskazywać Railway PROD.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 7 scenariuszy; szczególnie: **cross-org IDOR admin-data/ai-settings (read-only proof)**, RBAC (member przez API na endpoint admina), transfer własności, audit CSV export, AI Controls 9 zakładek (czy realne dane).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S7 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27:** **[P2]** żadna z 4 tabel admina (członkowie/audit/invoices/payment methods) nie używa `TABLE_AND_PREVIEW_CANON` — surowe `<table>`, brak Menu 1/2/3/preview/sort/filtr.
**Wzorzec hubowy:** `AdminSettingsModule` + własny sidebar spójny; `DesktopOnlyGuard` obecny.
**i18n:** **0× `isPolish`** (dobrze), ale security/audit/scim/members w dużej części hardkod EN (toasty, nagłówki, ROLE_GUIDANCE); wzorcowe: BillingFinOps (24× `t()`), IamPolicy (8×). **[P2]**
**UI:** 0 hardkodów hex. **Stany:** loading/empty OK; error głównie przez toast (brak inline error-state, P3).
**CARD_CONTENT_FORMULA:** N/D.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md` (uwaga: raport SEC orzekł „BRAK P0/P1" — **NIEPRAWIDŁOWO**, sprawdził tylko adminP32; boczne routery skorygowane tu po osobistej weryfikacji).
| Warstwa | Stan | Dowód |
|---|---|---|
| Główny panel `adminP32` | WZORCOWY | `requireAdminContext`→`ADMIN_BOUNDARY_VIOLATION` (`:300`) |
| `admin-data.routes.ts` | **CROSS-ORG IDOR** | `:54` GET tylko verifyToken; `:94` PUT requireRole globalny |
| `ai-settings.routes.ts` | **CROSS-ORG R/W** | `:218` GET OR-guard; `:255` PUT owner omija org-match |
| Eskalacja ADMIN→SUPERADMIN | NIEMOŻLIWA | `UpdateMemberRoleSchema` bez SUPERADMIN |

**Findingi:**
- **[P0] cross-org leak+write `admin-data.routes.ts`** — mount `Gateway.ts:422`, tylko `router.use(verifyToken)`. `GET /user-tiers/:orgId` (`:54`) + `GET /cost-attribution/:orgId` (`:124`) bez requireRole/membership → dowolny user czyta e-maile+tier+koszty dowolnej org. `PUT /user-tiers/:orgId/:userId` (`:94`) `requireRole` sprawdza GLOBALNĄ rolę → admin org A pisze w org B. **Zweryfikowane osobiście.** Fix: membership-check `:orgId` względem aktora (jak `requireAdminContext`).
- **[P0] cross-org R/W `ai-settings.routes.ts`** — `GET /org/:orgId` (`:218` guard OR) + `PUT /org/:orgId` (`:255`): globalna rola `owner`/`administrator` czyta/zapisuje AI-settings dowolnej org (org-match tylko dla `administrator` na PUT). **Zweryfikowane osobiście.** Fix: zawsze `userOrgId === orgId`.
- **[P2] F6-05 audit-logs globalny SELECT** — `adminAuditService.ts:71` `SELECT * LIMIT 1000` bez `WHERE organization_id`, filtr in-memory (`matchesAuditFilter` fail-closed → nie wyciek, ale tenant może nie zobaczyć własnych logów przy capie + perf).
- **[P3]** members POST/PATCH/DELETE bez route-level role middleware (F6-02); ADMIN ma `iam:write` (lateralne, F6-03); surowy `cardNumber` do backendu = PCI scope-creep (F6-04); martwy `/debug-memberships` (F6-06).

**OK/WZORCOWE (nie powielać):** główny panel adminP32 org-boundary; anty-eskalacja SUPERADMIN; ochrona OWNER/last-owner/self serwerowa; P0 superadmin≥admin naprawiony; SSO/billing bez wycieku sekretów.

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0)
1. **Membership-check na `admin-data.routes.ts`** — wszystkie endpointy `:orgId` muszą weryfikować, że aktor jest ADMIN/OWNER **w tej org** (wzór `requireAdminContext`); GET-y dodać role-gate — Weryfikacja: zwykły user/obcy admin na `:orgId` innej org → 403; test cross-org.
2. **Org-match na `ai-settings.routes.ts`** — `userOrgId === orgId` zawsze (GET i PUT), bez bypassu dla globalnego `owner` — Weryfikacja: owner org A na `/org/<B>` → 403.
3. **Testy cross-org IDOR + privilege-escalation** (B1/B2) — Weryfikacja: zielone, pokrywają oba routery + brak SUPERADMIN przez role.

### Fala 2 — Domknięcie wartości (P2)
1. **Audit-logs org-scoped SQL** (`WHERE organization_id=?` zamiast in-memory cap 1000) — Weryfikacja: tenant widzi pełne własne logi.
2. **Route-level role middleware** na members POST/PATCH/DELETE + usunąć `/debug-memberships` — Weryfikacja: spójny gating, martwy endpoint znika.
3. **PCI** — nie przyjmować surowego `cardNumber` na backendzie (tylko Stripe token) — Weryfikacja: backend bez PAN.

### Fala 3 — Jakość i kanony (P2/P3)
1. **§27** dla 4 tabel admina (`TableWithPreviewLayout`) — Weryfikacja: §27 A-S.
2. **i18n** — `t()` w security/audit/scim/members (wzór BillingFinOps) — Weryfikacja: PL/EN komplet.
3. **Wytnij martwy kod** (AdminSidebar, resztki Admin/) + inline error-state — Weryfikacja: 0 referencji.
4. **CI** — `Londyn` w PR-gate + realne E2E RBAC-by-role (zamiast smoke-fake) — Weryfikacja: biegnie, asercje na rolach.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. cross-org IDOR obu routerów + escalation) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: smoke 200 + cross-org IDOR potwierdzony zamknięty + czyste logi
- [ ] 4. Kanony: §27 tabel, i18n
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (martwy kod, debug endpoint)
- [ ] 6. Dwa P0 cross-org (admin-data + ai-settings) zamknięte

---
**Pozostałe do domknięcia audytu M24:** Faza 3 (Railway — żywy proof cross-org IDOR) + Faza 4 (żywe 7 scenariuszy). **Dwa blockery P0: cross-org IDOR na bocznych routerach `admin-data` + `ai-settings`** (główny panel `adminP32` WZORCOWY — dziury w torach „dosadzonych", wzorzec M20/M16). Metodologicznie: SEC orzekł błędnie „wzorcowy" sprawdzając tylko główny router — osobista weryfikacja skorygowała. Po naprawie 2× P0 + Fazach 3/4 realnie Beta.
