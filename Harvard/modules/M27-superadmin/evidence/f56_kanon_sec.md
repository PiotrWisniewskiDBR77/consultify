# M27 — SuperAdmin (control plane) — Karta dowodowa F5+F6 (KANON + SEC)

Data: 2026-06-11 · Branch: feat/deliverables-light · Agent: KANON+SEC
Repo: /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
Zakres: FE `src/views/superadmin/*` (124 pliki .tsx), BE routery superadmin/admin/platform/ai zasilające control plane.

---

## FAZA 6 — BEZPIECZEŃSTWO (NAJWAŻNIEJSZA)

### Model bramki (SSOT middleware)

- `verifySuperAdmin` (server/src/middleware/superAdmin.middleware.ts:191) — **wzorcowy**: weryfikuje JWT (HS256, kształt, kontrola znaków), a rolę **czyta z DB jako źródło prawdy** (linia 403 `SELECT role FROM users`), fail-closed. To jest właściwy gate control-plane.
- `verifyAdmin` (server/src/middleware/admin.middleware.ts:161) — **przepuszcza zwykłego org-admina/ownera** (`isAdminRole` L69-74 = admin/administrator/owner; membership lookup L201-219). NIE nadaje się jako gate globalnej konfiguracji platformy.
- `requireRole(...)` (server/src/middleware/rbac.middleware.ts:173) — hierarchia: `admin` level 2 spełnia wymóg `admin`; rola brana **z tokenu** (`getRequestRole` L135). `requireRole('super_admin','admin')` ⇒ org-admin przechodzi.

### TABELA SUPERADMIN-GATE PER ROUTER

| Router (plik) | Mount (Gateway.ts) | Bramka top-level / per-route | Werdykt |
|---|---|---|---|
| superadmin.routes.ts | /api/superadmin (538) | `verifyToken`→`requireSuperAdmin`→`requireAudit`→`superadminAuditMonitor` + per-sekcja `requireSuperAdminCapability` (L345-361) | **OK (wzorcowy)** |
| analytics-superadmin.routes.ts | /api/superadmin/analytics (662) | `verifyToken`+`verifySuperAdmin`+`requireSuperAdminCapability('platform_ops')` (L23-25) | **OK** |
| billing/billingAdmin.routes.ts | /api/superadmin/billing (367) | `verifyToken`+`verifySuperAdmin`+`requireSuperAdminCapability('billing_ops')` (L20-22) | **OK** |
| revenue.routes.ts | /api/revenue (660) | `verifyToken`+`requireSuperAdmin` per-route (L33-34) | **OK** |
| featureFlags.routes.ts | /api/feature-flags (545) | `router.use(requireSuperAdmin)` L237 osłania wszystkie mutacje; tylko `/runtime` (read, org-scoped) przed gate (L204-206) | **OK** |
| module-access.routes.ts | /api/module-access (535) | `/admin/*` (grants, bootstrap/dbr77, toggle) = `verifySuperAdmin` (L152,182,285,299); `/my` self-read | **OK** |
| partners.routes.ts (superAdminPartnerRouter) | /api/superadmin/partner-settlements (925) | `router.use(verifySuperAdmin)` L2305 | **OK** |
| partners.routes.ts (partnerConfigRouter) | /api/superadmin/partner-config (926) | `router.use(verifySuperAdmin)` L2732 | **OK** |
| partnerOutreach.routes.ts | /api/superadmin/partner-outreach (927) | `verifyToken`+`verifySuperAdmin`+capability (L20-22) | **OK** |
| integrations/scim.routes.ts | /api/scim/admin (709) | per-route `verifyToken`+`requireSuperAdmin` (L696-748) | **OK** |
| integrations/sso.routes.ts | (mount sso) | mutacje `verifyToken`+`requireSuperAdmin` (L550-585) | **OK** |
| ai-settings.routes.ts (`/superadmin`) | /api/ai-settings (507) | inline `requirePlatformSuperAdmin` (L107, sprawdza rolę z TOKENU, nie DB) | **OK (słabszy — patrz SEC-05)** |
| audit-events.routes.ts | (mount) | `verifyToken`, ale org-scoped (`req.user.organizationId` L18) — to NIE jest cross-org | **OK (org-scoped)** |
| governanceAdmin.routes.ts | (mount) | stub 503 „not_configured" (L12) | **OK (martwy/bezpieczny)** |
| **llm.routes.ts** | /api/llm | **MIESZANE** — providers CRUD = `verifySuperAdmin` (OK), ale globalne tiery/purposes/market = `verifyToken`/`verifyAdmin` | **DZIURA (P0/P1)** |
| **virtual-workers.routes.ts** | /api/virtual-workers (512) | `router.use(verifyToken)`+`router.use(requireRole('super_admin','admin'))` L21-22 | **DZIURA (P0)** |

---

### FINDINGI SEC (severity malejąco)

#### SEC-01 — P0 — Globalna konfiguracja AI-tier dostępna dla KAŻDEGO zalogowanego usera (brak gate)
`POST/DELETE /api/llm/tiers/assign`, `PUT /api/llm/tiers/priority` chronione **tylko `verifyToken`** — nie ma żadnego sprawdzenia roli.
- Dowód trasy: server/src/routes/llm.routes.ts:793 (`assignToTier`, verifyToken), :799 (`removeFromTier`, verifyToken), :805 (`updateTierPriority`, verifyToken).
- Dowód zakresu: controller zapisuje do GLOBALNEJ tabeli `llm_tier_assignments` BEZ `organization_id` — server/src/controllers/ai/LLMController.ts:2042 (INSERT ... `llm_tier_assignments` L2061-2070), :2085 (DELETE wszystkim), :2112 (UPDATE).
- Skutek: dowolny użytkownik dowolnego tenanta przepina, który provider AI obsługuje globalny tier (BUDGET/STANDARD/PREMIUM/REASONING) → platform-wide hijack routingu AI (kierowanie ruchu na własny/zatruty provider, DoS, eksfiltracja).
- Fix: `verifyToken` → `verifySuperAdmin` na wszystkich trzech trasach.

#### SEC-02 — P0 — Globalne Virtual Workers (Teresa/Anna) edytowalne przez zwykłego org-ADMINA
Router globalnie `requireRole('super_admin','admin')` — `admin` (org-admin) spełnia hierarchię i przechodzi.
- Dowód: server/src/routes/virtual-workers.routes.ts:21-22 (`router.use(verifyToken)`, `router.use(requireRole('super_admin','admin'))`).
- Dowód braku org-scope: `createWorker/updateWorker/deleteWorker` nie przyjmują organizationId; service operuje na GLOBALNEJ tabeli `virtual_workers` — server/src/services/ai/virtualWorkerService.ts:587 (INSERT), :632 (DELETE), brak `organization_id` w zapytaniach (L559-632). Trasy mutujące: routes L45 (POST /), L68 (PUT /:id), L77 (DELETE /:id).
- Skutek: org-admin dowolnego klienta tworzy/edytuje/usuwa platformowe persony AI (slug, rola, voice_enabled, voice_name, surface) widoczne dla WSZYSTKICH tenantów. Privilege-escalation + cross-tenant tampering globalnej konfiguracji asystentów.
- Fix: `requireRole('super_admin')` (usunąć 'admin') albo `verifySuperAdmin`.

#### SEC-03 — P1 — Globalne definicje routingu AI (purposes/assignments) mutowalne przez org-ADMINA
`POST /api/llm/purposes` i `POST /api/llm/purposes/:purpose/assignments` chronione **`verifyAdmin`** (przepuszcza org-admin/owner), a piszą do globalnych tabel.
- Dowód: server/src/routes/llm.routes.ts:1373 (`POST /purposes`, verifyAdmin — UPSERT do `ai_purposes`), :1477 (`POST /purposes/:purpose/assignments`, verifyAdmin — zapis do `ai_purpose_assignments`, dozwolone `organization_id = NULL` = wpis globalny, L1488-1490).
- Dowód innego: `PUT /api/llm/org/:organizationId/policy` (L1690, verifyAdmin) — org-admin może podać CUDZE `:organizationId` w ścieżce; brak weryfikacji że `req.user.organizationId === :organizationId` na poziomie trasy (cross-org policy edit — do potwierdzenia w controllerze, ale gate już za słaby).
- Skutek: org-admin definiuje globalne purpose'y i globalne przypisania providerów do zadań AI. Mniej dotkliwe niż SEC-01 (wymaga roli admin), stąd P1.
- Fix: `verifyAdmin` → `verifySuperAdmin` dla globalnych purposes/assignments; dla `/org/:id/policy` dodać scope-check org == token.org (lub superadmin).

#### SEC-04 — P1 — Globalny market AI (OpenRouter sync / inbox) bez gate
`POST /api/llm/market/openrouter/sync` i `PUT /api/llm/market/inbox/:id` chronione tylko `verifyToken`; operują na globalnej tabeli `ai_market_inbox`.
- Dowód: server/src/routes/llm.routes.ts:1956 (sync, verifyToken → `syncOpenRouterMarket()`), :1998 (`PUT /market/inbox/:id`, verifyToken).
- Skutek: dowolny user wyzwala globalny sync rynku modeli (koszt/rate-limit/DoS) i mutuje globalny inbox akceptacji modeli.
- Fix: `verifySuperAdmin`.

#### SEC-05 — P3 — `ai-settings /superadmin` weryfikuje rolę z TOKENU, nie z DB
`requirePlatformSuperAdmin` (server/src/routes/ai/ai-settings.routes.ts:107) czyta `req.userRole || req.user?.role`, nie sprawdza DB. Token jest podpisany, więc nie da się sfałszować roli, ALE stale-token (degradacja superadmina nie unieważnia natychmiast). Niespójność z wzorcowym `verifySuperAdmin` (DB-as-truth). Do ujednolicenia.

#### SEC-06 — INFO (PASS) — Brak wycieku sekretów providerów
`listProviders` strippuje `api_key` i zwraca tylko `has_api_key` boolean — server/src/controllers/ai/LLMController.ts:110 (`const { api_key: _secret, ...rest } = row`), :114 (`has_api_key`), :193-195 (public endpoint również usuwa `api_key`). Brak plaintext kluczy w odpowiedziach. **OK.**

#### SEC-07 — PASS — Bootstrap DBR77 / Module-Access granty poprawnie zamknięte
`/api/module-access/admin/bootstrap/dbr77`, `/admin/grants`, `/admin/grants/:id/toggle` = `verifySuperAdmin` (module-access.routes.ts:182,285,299). Nikt poza superadminem nie nada sobie beta-access. **OK.** (kontekst: [Beta gating], [Bootstrap])

#### SEC-08 — PASS — FE hierarchia ról + odwrotność (P0 zamknięty)
- „superadmin dziedziczy admin" ZAMKNIĘTY: ProtectedRoute redirectuje superadmina z tras ADMIN do `/superadmin` — src/components/ProtectedRoute.tsx:72-73 (komentarz „audit ADM-RAW-P0-001").
- Odwrotność (ADMIN→SUPERADMIN) zablokowana: `requiredRole="SUPERADMIN"` (level 3) > ADMIN (level 2); org-admin trafiający w `/superadmin/*` jest redirectowany do DASHBOARD — ProtectedRoute.tsx:77-82, AppRoutes.tsx:2218. **OK** (to obrona FE; realną ochroną pozostają bramki serwerowe — patrz SEC-01..04).

> UWAGA SYSTEMOWA: bramki BE llm/virtual-workers (SEC-01..04) to dziury serwerowe — FE redirect ich NIE pokrywa, bo te endpointy są wołane bezpośrednio przez API. To powtórka wzorca z M24 (boczne routery ai-settings/admin-data ze słabszym gate niż główny). NIE ufać że jeden gate w `/superadmin` pokrywa wszystkie powierzchnie control-plane.

---

## FAZA 5 — KANONY

### §27 — tabele (próbka)
Główne tabele control-plane (Organizations/Customers, Users, Audit log, Invoices, Feature flags) renderowane w modułach `CustomersModule`, `OrganizationsView`, `SuperAdminUserManagement`, `InvoiceCenterView`, `feature-flags`. Stany loading/empty/error obecne w głównych (OrganizationsView.tsx, CustomersModule.tsx — grep potwierdza `isLoading/Empty/error`). Pełny per-tabela audit A–S NIE wykonany w tym przebiegu statycznym (live odroczony) — zalecany przy walidacji wizualnej. Severity: P3 (dług audytowy, nie defekt).

### Wzorzec shell
Dedykowany `SuperAdminView` + `SuperAdminSidebar` + `SuperAdminSignalCenter`/`StatusIndicators` — spójny shell, lazy-loaded moduły (CustomersModule, AIPlatformModule, GovernanceModule, ConfigurationModule, SecurityModule, SystemModule, VirtualWorkersModule). `SuperAdminView.tsx:83-95` normalizuje nieznane widoki do roota (redirect) — dobra IA. **OK.**

### KANON-01 — P2 — Martwy płaski `AIPlatformModule.tsx`
src/views/superadmin/AIPlatformModule.tsx (152 linie) — brak importów (jedyny mount to `AIPlatformModule/AIPlatformModule`, SuperAdminView.tsx:42). Duplikat nazwy = ryzyko edycji nie-tego-pliku. Do usunięcia.

### KANON-02 — P2 — i18n PL/EN praktycznie nieobecne w control-plane
114 z 124 plików `src/views/superadmin/*.tsx` nie używa `useTranslation`/`t()` — stringi hardkodowane (m.in. RevenueModule, InvoiceCenterView, LLMManagementView, SSOConfigurationView, ComplianceCenterView, SecurityModule). Severity P2 (control-plane jest internal/EN-first, niższy priorytet niż moduły klienckie, ale niezgodne z kanonem i18n).

### KANON-03 — P3 — Hardkody kolorów
45 wystąpień literałów `#rrggbb` w `src/views/superadmin/*.tsx` (poza tokenami theme). Do migracji na zmienne/Tailwind tokeny przy konformacji kanonu.

### KANON-04 — INFO — Stany empty/loading/error
Obecne w głównych modułach (OrganizationsView, CustomersModule). Pełna inwentaryzacja per-zakładka odroczona do live.

---

## PODSUMOWANIE WERDYKTÓW BRAMEK

- Routery OK (wzorcowo gated): superadmin, analytics-superadmin, billingAdmin, revenue, feature-flags, module-access, partner-settlements/config/outreach, scim, sso, ai-settings(/superadmin), audit-events(org-scoped).
- Routery z DZIURĄ: **llm.routes** (P0 tiers, P1 purposes/market), **virtual-workers** (P0 org-admin na globalne persony).
- Sekrety: brak wycieku (api_key strippowany).
- FE hierarchia: P0 dwukierunkowo zamknięty.

P0 (2): SEC-01 (llm tiers brak gate), SEC-02 (virtual-workers org-admin).
P1 (2): SEC-03 (llm purposes/assignments/org-policy verifyAdmin), SEC-04 (llm market bez gate).
P2 (2): KANON-01 (martwy moduł), KANON-02 (i18n).
P3 (3): SEC-05 (token vs DB), KANON-03 (kolory), §27 dług.
