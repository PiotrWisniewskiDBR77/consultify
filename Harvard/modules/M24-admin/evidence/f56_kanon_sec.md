# M24 — Panel Administratora (org admin) — Karta audytu FAZA 6 (SEC) + FAZA 5 (KANON)

Agent: KANON+SEC
Data: 2026-06-11
Branch: feat/deliverables-light
Zakres: trasy `/admin/*` → `ProtectedRoute requiredRole="ADMIN"` → `AdminView` (DesktopOnlyGuard) → `AdminSettingsModule` (5 paneli: people/billing/ai/security/audit).
Backend: `/api/admin/*` → `adminP32.routes.ts`; członkowie org → `/api/organizations/:orgId/members` → `OrganizationController`.

---

## FAZA 6 — BEZPIECZEŃSTWO

### 1. Trzy warstwy gatingu — STAN: DOBRY (defense in depth)

| Warstwa | Mechanizm | Plik:linia |
|---|---|---|
| Nawigacja | sidebar ADMIN+ | (sidebar, poza zakresem pliku) |
| Route | `ProtectedRoute requiredRole="ADMIN"` | `src/routes/AppRoutes.tsx:2196-2210` |
| API (adminP32) | `router.use(verifyToken)` + `getAdminActor()` per endpoint z wymaganą capability | `server/src/routes/adminP32.routes.ts:1654`, `:279-348`, oraz każdy handler `:1656+` |
| API (członkowie) | `verifyToken` globalnie + kontroler sprawdza członkostwo w `:orgId` | `server/src/routes/organization/organizations.routes.ts:31`; `server/src/controllers/OrganizationController.ts:121-126,184-189,216-239` |

WNIOSEK: KAŻDY endpoint admina wymaga roli admina **serwerowo**. W `adminP32` przez `getAdminActor` (capability-gated), w members-CRUD przez kontroler (membership-based). Brak endpointów uprzywilejowanych chronionych tylko `verifyToken`.

#### P2 — F6-01: GET members używa GLOBALNEGO `requireRole`, nie org-scoped
`organizations.routes.ts:103-107` zakłada `requireRole('ADMIN','OWNER','SUPERADMIN')`. `requireRole` (`auth.middleware.ts:1287-1325`) sprawdza **globalny claim roli z JWT**, nie członkostwo w `:orgId`. Sam w sobie pozwoliłby adminowi org A wywołać members org B.
ŁAGODZĄCE: kontroler `getMembers` (`OrganizationController.ts:184-189`) dokłada twardy check `isMember(:orgId)` → 403 dla nie-członka. Org-scope utrzymany przez kontroler (defense in depth). Severity obniżony do P2 jako spójnościowy (route-middleware myli, że jest org-aware) — nie jest realnym wyciekiem dopóki kontroler stoi.

#### P3 — F6-02: POST/PATCH/DELETE members BEZ route-level role middleware
`organizations.routes.ts:113,134,164` — tylko `validateBody`, brak `requireRole`. Cała autoryzacja w kontrolerze. Działa poprawnie (patrz pkt 2/3), ale brak warstwy route czyni regresję łatwą (jedno usunięcie checku w kontrolerze = otwarcie). Zalecenie: dodać `requireRole(...)` jako warstwę 1, kontroler jako warstwa 2.

---

### 2. ORG-SCOPE — STAN: DOBRY (cross-org IDOR ZABLOKOWANY)

**adminP32 (security/billing/ai/audit/iam/scim/people):** centralny strażnik `requireAdminContext` (`adminP32.routes.ts:279-348`):
- `orgId = req.query.orgId || req.user.organizationId` (`:290`)
- TWARDY check: `if (orgId !== req.user?.organizationId && !isSuperAdmin) → 403 ADMIN_BOUNDARY_VIOLATION` (`:300-307`)
- rola aktora liczona z **członkostwa w tym orgId** (`SELECT role FROM organization_members WHERE organization_id=? AND user_id=?`, `:309-313`), nie z globalnego JWT
- wszystkie zapytania SQL paneli scoped `WHERE organization_id = ?` (security `:489,494`; iam `:219`; billing `:791,803,1031,1047`; access-codes `:1158`; payment delete `:1070,1076`).

ADMIN org A **nie** może czytać/pisać org B przez adminP32 — `orgId` z body/query jest zrównany do tokena.

**members-CRUD (OrganizationController):** rola aktora wyprowadzana z `members.find(m => m.user_id === userId)` w obrębie `:orgId` (`:217,321,439`); brak członkostwa → 403 (`:221-229,337-345,454-462`). Admin org A nie jest członkiem org B → 403.

WNIOSEK: org z TOKENA (zrównana z body/URL przez hard-equality). Brak emergentnego cross-org IDOR w panelu admina. (Kontrast: systemowy cross-org IDOR opisany w M01/M03 tu NIE występuje — adminP32 ma wzorcowy `ADMIN_BOUNDARY_VIOLATION`.)

---

### 3. PRIVILEGE ESCALATION — STAN: DOBRY (eskalacja do SUPERADMIN ZABLOKOWANA)

#### a) ADMIN → SUPERADMIN przez role endpoint: NIEMOŻLIWE
- `UpdateMemberRoleSchema.role = MemberRoleEnum` (`organization.validators.ts:16-24,62-63`) — enum **NIE zawiera SUPERADMIN**. Body z `role:"SUPERADMIN"` → 400 walidacji.
- Nawet gdyby przeszło: `normalizeOrganizationRole('SUPERADMIN')` → kolapsuje do `ROLES.ADMIN` (org-level) (`organizationService.ts:45-46`). Nigdy nie ustawia globalnej flagi `is_superadmin`/`isSuperAdmin`.
- Globalny superadmin to osobny mechanizm (`isRequestSuperAdmin`, flaga `is_superadmin`), poza tabelą `organization_members` — endpoint członków go nie dotyka.
WNIOSEK: ADMIN nie nada sobie/innym SUPERADMIN. P0-vector zamknięty.

#### b) Ochrona OWNER/self: OBECNA i serwerowa (nie tylko UI)
`OrganizationController.updateMemberRole/removeMember`:
- tylko OWNER zmienia/usuwa OWNER (`:357-369,474-482`)
- ostatni OWNER chroniony (`LAST_OWNER_PROTECTED`, `:371-382,484-495`)
- ochrona self-lockout (`SELF_LOCKOUT_REJECTED`, `:384-392,497-505`)
UI dubluje (disabled na OWNER/self, `AdminMembersRolesPanel.tsx:305,328`), ale egzekwowanie jest serwerowe — bypass przez API nieskuteczny.

#### c) Transfer własności: w osobnym, dedykowanym flow
`OwnershipManagementView` + `ownership.routes.ts` (poza CRUD members). `addMember`/`updateMemberRole` blokują nadanie OWNER przez nie-ownera (`:242-250,357-369`). OK.

#### P0 superadmin≥admin — POTWIERDZONE NAPRAWIONE
`ProtectedRoute.tsx:72-74`: `if (requiredRole === 'ADMIN' && role === 'SUPERADMIN') → Navigate(SUPERADMIN.ROOT)`. SUPERADMIN nie dziedziczy cicho dostępu do `/admin/*` tenanta przez hierarchię `3>=2`. Komentarz cytuje audyt `ADM-RAW-P0-001`. ZAMKNIĘTE.

#### P3 — F6-03: ADMIN ma `iam:write` → może rozszerzać delegowane capabilities w obrębie org
`getActorCapabilities` (`adminP32.routes.ts:242-264`) nadaje ADMIN pełny zestaw, w tym `iam:write`. ADMIN może tworzyć `admin_role_assignments` nadające capabilities (w tym `iam:write`) innym członkom (`:1940-1952`). Pozostaje w granicach org i nie przekracza zakresu ADMIN (brak ścieżki do SUPERADMIN), ale to lateralne poszerzanie uprawnień bez zgody OWNER. Governance-uwaga, nie realny breach. Rozważyć: assignment IAM tylko dla OWNER.

---

### 4. BILLING — STAN: DOBRY, brak wycieku sekretów Stripe

- Wszystkie endpointy billing scoped do `actor.orgId` (token-bound): payment-methods `:1974-2030`, plan/limits upsert `:919-961`, invoices `:1083+`, alerts/tax `:1217+`. Admin org A nie widzi billing org B (`ADMIN_BOUNDARY_VIOLATION` + SQL `WHERE organization_id=?`).
- `readBillingPaymentMethods` robi `SELECT *` (`:1031`) → zwraca `stripe_payment_method_id` (token `pm_...`), `last4`, `brand` — **NIE klucze sekretne Stripe** (`sk_...`). Niskie ryzyko.
- Cross-org plan changes (`billingAdmin.routes.ts`) to plane **SUPERADMIN** (`requireSuperAdminCapability('billing_ops')`, `:22,35,60`) — nie powierzchnia org-admina M24. OK.

#### P3 — F6-04: surowy `cardNumber` w body do `createBillingPaymentMethod`
`adminP32.routes.ts:1041-1042` przyjmuje `body.cardNumber`, liczy `last4` i odrzuca resztę (nie zapisuje PAN). Persystuje tylko `last4`. Jednak przyjmowanie pełnego PAN po stronie aplikacji (zamiast Stripe Elements/tokenizacji na froncie) to obszar PCI-DSS scope-creep. Zalecenie: nie przesyłać PAN do backendu.

---

### 5. SCIM / Delegated IAM / SSO — STAN: DOBRY, brak plaintext-secret pattern

- SSO read (`readSecuritySettings`, `:482-528`): `SELECT * FROM sso_configurations` ale mapuje TYLKO `is_enabled/enforce_sso/provider_name/provider_type/protocol/allow_password_login`. **Nie ujawnia** `client_secret`, certów, kluczy. Brak wzorca plaintext-leak z M25/M20.
- SSO write (`:708-737`): zapisuje wyłącznie `protocol/provider_name/provider_type/is_enabled`. **Nie przyjmuje ani nie persystuje sekretów SSO** przez ten panel.
- IAM assignments scoped do org (`:214-231,1955-1971`), capabilities z `capabilities_json`.
- SCIM lifecycle panel — operuje na flagach posture; brak ekspozycji tokenów w przejrzanych ścieżkach.
BRAK findings P0/P1 dot. sekretów w odpowiedziach.

---

### 6. AUDIT LOG — STAN: scope OK (fail-closed), ale wzorzec global-fetch

- `/audit-logs`, `/stats`, `/export` przez `getAdminActor(... ['audit:read'/'audit:export'])` (`:2265-2330`).
- Scope: `matchesAuditFilter(log, orgId)` (`:1581-1601`) wymaga `logOrgId === orgId`; log bez orgId w metadanych → `'' !== orgId` → **wykluczony (fail-closed)**. Export CSV używa tego samego filtra (`:2311+`). Admin org A nie zobaczy/nie wyeksportuje audytu org B.

#### P2 — F6-05: audit-logs pobiera GLOBALNIE i filtruje w pamięci (limit 1000)
`adminAuditService.getLogs` = `SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?` (`adminAuditService.ts:71`) — **bez `WHERE organization_id`**. Trasy ładują `limit:1000` globalnie i filtrują w app (`adminP32:2280,2300,2316`). Skutki:
- Reliability/correctness: w dużym multi-tenant tenant może NIE zobaczyć własnych nowszych logów (ucięte przez globalny cap 1000 zanim filtr org zadziała).
- Performance: O(N) po wszystkich tenantach na każde żądanie.
- Bezpieczeństwo: scope utrzymany przez `matchesAuditFilter` (fail-closed), więc to NIE wyciek — ale poleganie na poprawności `orgId` w metadanych jest kruche. Zalecenie: filtr `organization_id` na poziomie SQL.

---

### 7. SEKRETY / PII W LOGACH — drobne

- `organizations.routes.ts:47-70` `GET /debug-memberships`: diagnostyczny endpoint tworzący własny `pg.Pool`, `console.log` userId+liczba wierszy, zwraca pełne members usera (tylko własne, `WHERE m.user_id=$1`). Niski wyciek, ale to martwy diagnostyczny kod z surowym PG i logiem — **P3 F6-06**: usunąć przed prod.
- Audyt `logAction` zapisuje `details` z `isSensitive:true` i np. rolami/memberId — to zamierzone (ślad audytowy), nie wyciek do logów aplikacyjnych.

---

## FAZA 5 — KANONY

### §27 — tabele
1. **Tabela członków (Team & Access)** — `AdminMembersRolesPanel.tsx:259-345`: surowa `<table>`, NIE używa kanonicznego komponentu tabeli/Preview/Menu 1·2·3. Brak: sort, filtr, paginacja, kolumny konfigur., empty/loading są inline (`:271-282`). Stan: loading ✔, empty ✔, error → `toast` (brak inline error-state w tabeli). Ocena §27: ~D-tier (custom table, poza kanonem).
2. **Audit log table** (`AdminAuditLogPanel.tsx`) — również poza kanonem TABLE_AND_PREVIEW; ma export CSV i search, ale brak Menu 1/2/3, brak Preview.
3. **Invoices / payment methods** (`AdminBillingFinOpsPanel.tsx`) — listy renderowane custom, poza kanonem.
WNIOSEK §27: żadna z 4 tabel admina nie jest zgodna z `TABLE_AND_PREVIEW_CANON` — to spójna luka modułu (P2 kanon).

### Wzorzec AdminSettingsModule z własnym sidebarem
`AdminSettingsModule.tsx` + `AdminSettingsSidebar.tsx` — spójny shell, 5 sekcji, aliasy ścieżek (`:68-92`), routing `/admin/:section`. Wzorzec czysty i spójny. ✔

### i18n PL/EN
Mieszane. Wzorcowy: `AdminBillingFinOpsPanel` (24× `t()`), `AdminIamPolicyPanel` (8×). Słabe: `AdminSecurityPolicyPanel` (1×), `AdminAuditLogPanel` (2×), `AdminScimLifecyclePanel` (1×) — większość stringów hardkodowana po angielsku. `AdminMembersRolesPanel` — 5× `t()` ale ROLE_GUIDANCE, nagłówki tabeli, toasty po angielsku na sztywno (`:21-41,221-225,262-267,92-97`). **0× `isPolish`** w panelach M24 (dobrze — `isPolish` tylko w `HelpAnalyticsDashboard.tsx`, poza M24). P2 kanon: dokończyć i18n w security/audit/scim/members.

### Hardkody kolorów
**0** hardkodowanych `#hex` w panelach Admin (`grep` = 0). Używane tokeny Tailwind (slate/navy/primary). ✔ (drobny: literalne `bg-blue-600`/`bg-blue-50` w members invite, `:389,402` — token-owe klasy, akceptowalne).

### Stany empty/loading/error
- loading ✔ (spinnery, "Loading members…")
- empty ✔ ("No members found")
- error — w większości przez `toast.error`, brak inline error-state w tabelach (P3 kanon).

---

## PODSUMOWANIE FINDINGÓW

| ID | Sev | Obszar | Skrót |
|---|---|---|---|
| F6-01 | P2 | RBAC | GET members `requireRole` globalny, nie org-scoped (łagodzone kontrolerem) |
| F6-02 | P3 | RBAC | POST/PATCH/DELETE members bez route-level role middleware |
| F6-03 | P3 | PrivEsc | ADMIN ma `iam:write` → lateralne poszerzanie capabilities w org |
| F6-04 | P3 | Billing/PCI | surowy `cardNumber` przyjmowany przez backend |
| F6-05 | P2 | Audit | global-fetch logów + filtr w pamięci (correctness/perf; scope fail-closed OK) |
| F6-06 | P3 | Sekrety | martwy `GET /debug-memberships` z surowym PG + console.log |
| K5-01 | P2 | §27 | 4 tabele admina poza TABLE_AND_PREVIEW_CANON |
| K5-02 | P2 | i18n | security/audit/scim/members w dużej części hardkod EN |
| K5-03 | P3 | Stany | brak inline error-state w tabelach (tylko toast) |

**BRAK P0/P1.** Kluczowe wektory P0 (cross-org IDOR, eskalacja ADMIN→SUPERADMIN, superadmin≥admin) są **zamknięte**: `ADMIN_BOUNDARY_VIOLATION` (adminP32:300), membership-based actorRole, `MemberRoleEnum` bez SUPERADMIN + kolaps `normalizeOrganizationRole`, oraz `ProtectedRoute.tsx:72-74`. Panel admina M24 jest pod względem bezpieczeństwa autoryzacji **mocny i wzorcowy** dla reszty systemu.
