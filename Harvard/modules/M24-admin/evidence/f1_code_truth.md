# M24 — Panel Administratora (org admin) — FAZA 1: Prawda kodu

**Branch:** feat/deliverables-light · **Agent:** KOD · **Data:** 2026-06-11
**Zakres:** trasy `/admin/*` → `ProtectedRoute requiredRole=ADMIN` → `AdminView` → `AdminSettingsModule` (5 paneli).
Metoda: czytanie kodu runtime (FE `src/`, BE `server/src/`). Dokumenty = hipotezy (~7:1).

---

## Punkt wejścia / routing (potwierdzony)

- `src/components/ProtectedRoute.tsx:72-74` — **P0 superadmin≥admin NAPRAWIONE**: jeśli `requiredRole==='ADMIN'` i rola = SUPERADMIN → redirect do `ROUTES.SUPERADMIN.ROOT`. SUPERADMIN nie wchodzi w org-admin przez hierarchię `3>=2`. REALNE.
- `src/views/admin/AdminSettingsModule.tsx:142-157` — switch renderuje 5 paneli: people→`AdminMembersRolesPanel`, billing→`AdminBillingFinOpsPanel`, ai→`AdminAIControlCenterPanel`, security→`AdminSecurityIdentityPanel`, audit→`AdminAuditLogPanel`. Sidebar: `AdminSettingsSidebar.tsx` (5 pozycji NAV_ITEMS:25-66). REALNE.

---

## WERDYKTY PER POZYCJA (7)

### 1. Team & Access (people) — **REALNE**
Plik: `src/components/Admin/AdminMembersRolesPanel.tsx`
- CRUD członków realny: `loadMembers`→`Api.getOrganizationMembers` (66-83), `handleInvite`→`Api.addOrganizationMember` (105), `handleRoleChange`→`Api.updateOrganizationMemberRole` (129), `handleRemove`→`Api.removeOrganizationMember` (143). Backend endpointy: `src/services/api.ts:8423-8458` → `/organizations/:orgId/members*`.
- Ochrona OWNER realna: `ownerProtected = memberRole==='OWNER'` blokuje select roli i Remove (291, 305, 328); zmiana na OWNER blokowana w UI (123-126, 314-316) i w BE (`OrganizationController.ts:242, 358`).
- Ochrona self realna: `selfProtected = member.user_id===currentUser?.id` blokuje Remove (292, 328); BE chroni ostatniego ownera (`LAST_OWNER_PROTECTED`, `OrganizationController.ts:374`) i degradację siebie poniżej ADMIN (384).
- Transfer własności: `OwnershipManagementView` montowany (445). REALNE (osobny widok).
- Kod zaproszenia: `handleGenerateInviteCode`→`Api.post('/access-codes/generate', {maxUses, expiresInDays:7})` (158-178). Cap **max 500** wymuszony w UI (377-383: `Math.min(500,...)`). **UWAGA: domyślna wartość = 50, nie 500** (54, 355) — INV mówił „max 500"; cap=500 OK, default=50.

### 2. Billing & Plans — **REALNE** (z fasadą kart)
Plik: `src/components/Admin/AdminBillingFinOpsPanel.tsx`; API `src/services/api.ts:8558-8700`
- 5 zakładek: Summary / Plan&limits / Payment methods / Invoices / Budgets&tax (56-65).
- 7 endpointów getAdminBilling* REALNE i podpięte (78-105): summary, paymentMethods, invoices, alerts, taxSettings, usageDetails, plans. Mutacje realne: `assignAdminBillingPlan` (128), `add/setDefault/removeBillingPaymentMethod` (156/169/181), `updateBillingAlerts` (191), `updateBillingTaxSettings` (199). BE: `adminP32.routes.ts` (`/admin/billing/*`, org z tokena przez `getAdminActor`).
- Flaga `VITE_STRIPE_ENABLED`: honest gating — `stripeEnabled` (51-55); gdy off → baner „Self-service checkout disabled / contact sales" (633-640). UCZCIWE.
- **Fasada kart (FYI):** zakładka payments przyjmuje surowy `paymentMethodId` jako string (412-424) — brak Stripe Elements / tokenizacji. Endpoint persystuje, ale to nie jest realny checkout (zgodne z flagą off). MOCK-STUB tylko warstwa „dodaj kartę".

### 3. AI Controls (ai) — **REALNE** (9/9 pod-zakładek żywe)
Plik: `src/components/Admin/AdminAIControlCenterPanel.tsx`
- Karty summary: `Api.getAdminAISummary` (36) REALNE. 2 zakładki: Governance settings=`OrgAISettingsView`, AI operations=`AIModule initialTab="ai-health"` (120).
- `src/views/admin/AIModule.tsx:48-94` — **9 pod-zakładek**, wszystkie z realnym backendem (zweryfikowane grep API/fetch):
  1. LLM Config → `AdminLLMView` (13 wywołań API)
  2. Access & Limits → `AccessLimitsTab` (`/api/ai-settings/org/:id`, `/api/admin-data/user-tiers/:id`, `/cost-attribution/:id`)
  3. Policy & Governance → `PolicyGovernanceTab` (`/api/ai-settings/org/:id` GET+PUT)
  4. Models & Providers → `ModelsProvidersTab` (`Api.getLLMProviders`, `/api/llm/status`, `/org/:id/available-models`, test/refresh)
  5. Features & Privacy → `FeaturesPrivacyTab` (`/api/ai-settings/org/:id`, `Api.aiGetSystemPrompts/aiUpdateSystemPrompt`)
  6. Audit & Compliance → `AuditComplianceTab` (`/api/admin-data/custom-templates|security-events|compliance-reports/:id`, `Api.exportTenantAdminAuditLogs`)
  7. AI Health → `AIMissionControl` (`/api/llm/health/status`, `/health/test/:id`)
  8. Help Analytics → `HelpAnalyticsDashboard` (API)
  9. Tokens → `TokenBillingManagementView` (4 wywołania API)
- Komentarze „Mock data" w `AccessLimitsTab:90` i `AuditComplianceTab:94` dotyczą **fallback/demo dla wtórnych list** (user tiers / przykładowe wiersze), nie głównego data-flow — tab i tak fetchuje realnie. Nie placeholder-only.

### 4. Security & Identity — **REALNE** (6/6 zakładek żywe)
Plik: `src/components/Admin/AdminSecurityIdentityPanel.tsx:78-83`; wszystkie 6 z realnym API:
1. Security policy → `AdminSecurityPolicyPanel` (`Api.getAdminSecurityPolicy/updateAdminSecurityPolicy`, api.ts:8460-8472)
2. Collaboration policy → `AdminCollaborationControlsPanel` (`get/updateAdminCollaborationControls`, 8474-8486)
3. API access → `ApiKeysManagementView` (`/api/api-keys` GET/POST/DELETE — pełny CRUD)
4. Delegated IAM → `AdminIamPolicyPanel` (`get/updateAdminIAMPolicy`, `get/create/deleteAdminIAMAssignment`, 8592-8629) — REALNE CRUD przypisań
5. SCIM & lifecycle → `AdminScimLifecyclePanel` (`getAdminScimSummary`, `createAdminScimToken`, `createAdminScimGroupMapping`, 8716+)
6. Risk summary → `AdminRiskSummaryPanel` (`Api.getAdminRiskSummary`)
- Żaden tab nie jest placeholderem. SCIM/IAM/API-access = realne (tokeny, group-mappings, assignments persystowane przez `adminP32.routes.ts`).

### 5. Audit Log — **REALNE**
Plik: `src/components/Admin/AdminAuditLogPanel.tsx`
- Realne zdarzenia z DB: `Api.getTenantAdminAuditLogs({limit:100,search})` + stats + risk + compliance (28-44). BE: `adminP32.routes.ts:2266-2289` — `adminAuditService.getLogs` filtrowane `matchesAuditFilter(log, orgId, ...)` (org z `getAdminActor`).
- Statystyki realne: `/audit-logs/stats` (2292-2309).
- Eksport CSV realny: `handleExport`→`Api.exportTenantAdminAuditLogs()` (blob→download, 56-74); BE `/audit-logs/export` buduje realny CSV `text/csv` (2311-2338).
- Retencja realna (zapis): `saveRetention`→`Api.updateAdminComplianceDataRetention` (78); domyślnie 730 dni (23).
- FYI wydajność: BE wczytuje `getLogs({limit:1000})` i filtruje w pamięci po orgId — przy >1000 globalnych zdarzeń możliwe ucięcie, ale org-filter nadal zastosowany (brak wycieku).

### 6. layout/AdminSidebar.tsx — **MARTWY KOD** (potwierdzone)
- `src/components/layout/AdminSidebar.tsx`: **0 realnych importerów**. Grep `components/layout/AdminSidebar'` oraz `from './AdminSidebar'` = pusto. Wcześniejszy „hit" w `SuperAdminView.tsx` to dopasowanie substringu `SuperAdminSidebar` (linie 30-31, 255 importują/renderują `SuperAdminSidebar`, nie `AdminSidebar`). MARTWY.

### 7. Resztki components/Admin/ — **MARTWY / WSPÓŁDZIELONE (nie w org-adminie)**
- `ABTestingDashboard` — montowany w **superadmin**: `views/superadmin/AIPlatformModule.tsx`, `.../Development/ExperimentsTab.tsx`. WSPÓŁDZIELONE z superadmin, NIE w org-adminie.
- `V8AdminDiagnosticsPanel` — montowany w **superadmin**: `.../Operations/HealthMonitoringTab.tsx`. WSPÓŁDZIELONE, nie org-admin.
- `ChatV9FlagsPanel/Overlay/Indicator` — szeroko referowane przez `utils/*chatV9*` i overlay flag; nie montowane w `AdminSettingsModule`. Nie należą do org-admina (debug/flag overlay). Względem M24: MARTWE w org-adminie.
- Inne orphany w `components/Admin/` (AIPerformanceDashboard, SLADashboard, PromptTestBench, PromptAssistantPanel, UserAssignmentsPanel, AdminState, AIMissionControl[też używany], itd.) — nie montowane przez `AdminSettingsModule`; część żyje w superadmin. Potwierdzony żywy zestaw org-admina = TYLKO 5 paneli z `AdminSettingsModule.tsx:142-157` + ich pod-komponenty.

---

## SEKCJA SEC — cross-org / privilege escalation (KLUCZOWE)

### Privilege escalation ADMIN→SUPERADMIN: **BRAK (czyste)**
- People/role endpoint nie pozwala podnieść do OWNER bez bycia OWNER (`OrganizationController.ts:242, 358`; `adminP32.routes.ts:399`). Rola SUPERADMIN nie jest w słowniku ról org (`ADMIN_PEOPLE_ROLES` = OWNER/ADMIN/MEMBER/GUEST/CONSULTANT, `adminP32.routes.ts:90`). Nie da się ustawić SUPERADMIN przez role endpoint. ADMIN nie eskaluje do SUPERADMIN tą drogą.

### Cross-org: DWA TORY o RÓŻNEJ jakości

**TOR A — adminP32.routes.ts (billing/AI-summary/IAM/SCIM/security/audit/compliance): CZYSTE.**
- `getAdminActor` (`adminP32.routes.ts:279-348`): org = `req.query.orgId || req.user.organizationId` (290), ale **twardy guard 300-307**: `if (orgId !== req.user.organizationId && !isSuperAdmin) → 403 ADMIN_BOUNDARY_VIOLATION`. Dodatkowo weryfikacja membership w `organization_members` (309-326). Cross-org tu ZABLOKOWANY.

**TOR B — endpointy member (organizations.routes.ts): CZYSTE (przez membership).**
- `org` z URL `:orgId`, ale kontroler liczy `actorRole` z członkostwa actora w TYM org (`members.find(m=>m.user_id===userId)`, `OrganizationController.ts:217, 320, 438`). Admin org A z org B w URL → brak membership → `!currentUserMember` → 403 `ADMIN_ACCESS_REQUIRED` (221-229). Cross-org skutecznie zablokowany mimo URL-orgId. GET listy chroniony `requireRole('ADMIN','OWNER','SUPERADMIN')` (organizations.routes.ts:103-107).

### 🔴 ZNALEZIONE DZIURY CROSS-ORG (TOR wtórny AI Controls)

**B-1. `ai-settings.routes.ts` `/org/:orgId` — CROSS-ORG IDOR (read + write).**
Plik: `server/src/routes/ai-settings.routes.ts`
- GET `/org/:orgId` (204-231): guard linia **218**: `if (userRole !== 'owner' && userRole !== 'administrator' && userOrgId !== orgIdStr) → 403`. Logika OR: **każdy** z globalną rolą `owner`/`administrator` czyta AI-settings/budżety/prompty **DOWOLNEJ** org (bypass `userOrgId===orgId`). Admin org A → czyta org B.
- PUT `/org/:orgId` (239-260): `isAdmin = userRole==='owner' || (userOrgId===orgId && userRole==='administrator')` (254-255). Globalny `owner` **zapisuje** ustawienia AI dowolnej org. Cross-org WRITE dla roli owner.
- Konsument: `OrgAISettingsView` + `PolicyGovernanceTab`/`FeaturesPrivacyTab`/`AccessLimitsTab` (pkt 3).

**B-2. `admin-data.routes.ts` `/.../:orgId` — CROSS-ORG IDOR (read).**
Plik: `server/src/routes/admin-data.routes.ts` (PLIK ŻYWY — mount `Gateway.ts:422` `app.use('/api/admin-data', adminDataRoutes)` z `import './routes/admin-data.routes.js'`; `adminData.routes.ts` to ORPHAN/duplikat, niemontowany).
- Router-level tylko `router.use(verifyToken)` (44) — **brak** router-wide `requireRole` ani org-membership.
- GET `/user-tiers/:orgId` (54-88): `WHERE u.organization_id = ?` z `req.params.orgId` (59, 83) — **bez** sprawdzenia że actor należy do tej org. Analogicznie GET `/cost-attribution/:orgId` (124), `/security-events/:orgId` (208), `/recent-activity/:orgId` (304), `/sessions/:orgId` (389), `/login-history/:orgId` (437), `/compliance-reports/:orgId` (510), `/custom-templates/:orgId` (547), `/user-groups/:orgId` (592), `/scheduled-events/:orgId` (635).
- Mutacje mają `requireRole('super_admin','admin','owner')` (96, 267, 488, 781, 869), ale `requireRole` sprawdza **tylko globalną rolę** (`rbac.middleware.ts:173-206` — `getRequestRole(req)`, brak weryfikacji `:orgId` vs org actora). Więc admin org A może czytać (i przez mutacje pisać) dane org B podając orgId w URL.
- Skutek: wyciek user-tiers, cost-attribution, security-events, login-history, sessions, compliance-reports innej organizacji do dowolnego ADMIN/OWNER.

**Wniosek SEC:** rdzeń org-admina (P32: billing/security/audit/IAM/SCIM + member CRUD) jest org-szczelny. Dziury cross-org siedzą w **wtórnych** endpointach AI Controls (`ai-settings/org/:orgId` i `admin-data/*/:orgId`), które ufają orgId z URL i polegają wyłącznie na globalnej roli. To pasuje do hipotezy „core dziurawe → tu raczej hybryda": panel admina ma rdzeń czysty, ale dwa boczne tory AI = systemowy cross-org IDOR. Privilege-escalation ADMIN→SUPERADMIN: brak.

---

## TABELE

### 1e — Wiring (panel → endpoint/tabela)
| Panel | Główne endpointy | Tabela/usługa DB | Werdykt |
|---|---|---|---|
| members (people) | `/organizations/:orgId/members` GET/POST/PATCH/DELETE | `organization_members`, `users` | REALNE |
| billing | `/admin/billing/{summary,plans,plan,payment-methods,invoices,usage-details,alerts,tax-settings}` | adminP32 + org_settings/billing | REALNE |
| ai-settings | `/admin/ai/summary`; `/api/ai-settings/org/:orgId` GET/PUT; `/api/llm/*`; `/api/admin-data/*/:orgId` | AISettingsService, ai_usage_stats, llm | REALNE (z dziurami SEC B-1/B-2) |
| security | `/admin/security`, `/admin/collaboration`, `/admin/iam/*`, `/admin/identity/scim*`, `/api/api-keys`, `/admin/risk` | adminP32 + org_settings | REALNE |
| audit | `/admin/audit-logs`, `/audit-logs/stats`, `/audit-logs/export`, `/admin/compliance/*` | adminAuditService.getLogs | REALNE |

### 1f — Flagi
| Flaga | Lokalizacja | Efekt | Honest? |
|---|---|---|---|
| `VITE_STRIPE_ENABLED` | `AdminBillingFinOpsPanel.tsx:51` | off → baner „checkout disabled/contact sales"; karty to surowy id | TAK (uczciwy gating) |
| (brak innych flag w 5 panelach org-admina) | — | — | — |

### 1g — Połączenia
- członkowie → org: przez `organization_members` (org z URL, walidowany membershipem actora). Czyste.
- billing → Stripe: NIE podpięty realny Stripe (flaga off + raw id). Persystencja własna w DB. Fasada checkoutu.
- AI settings → cała platforma: `/api/ai-settings/org/:orgId` + `/api/llm/*` realnie sterują polityką AI org. ⚠ cross-org (B-1).
- audit → events: `adminAuditService` (member/security/collab/integration changes); org-scoped filtrem. Czyste.

---

## PODSUMOWANIE LICZBOWE
- **AI Controls: 9/9 pod-zakładek REALNE** (0 placeholder-only; 2 mają mock-fallback dla list wtórnych).
- **Security: 6/6 zakładek REALNE** (SCIM/IAM/API-access = pełne CRUD, nie stuby).
- **Billing: REALNY** (7 endpointów żywe; karty = fasada za uczciwą flagą `VITE_STRIPE_ENABLED`).
- **Members + Audit: REALNE.**
- **Martwy kod:** `layout/AdminSidebar.tsx` = 0 importerów (MARTWY); `ABTestingDashboard`/`V8AdminDiagnosticsPanel`/`ChatV9Flags*` = superadmin/flag overlay, nie w org-adminie.
- **SEC:** privilege-escalation ADMIN→SUPERADMIN = BRAK. Cross-org IDOR = **2 dziury** w wtórnych torach AI Controls (`ai-settings/org/:orgId` read+write dla globalnej roli owner/administrator; `admin-data/*/:orgId` read bez org-membership). Rdzeń P32 (billing/security/audit/IAM/SCIM/members) = org-szczelny.
