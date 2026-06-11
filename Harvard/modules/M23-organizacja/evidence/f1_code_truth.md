# M23 — Organizacja — FAZA 1: Prawda kodu (f1_code_truth)

Branch: `feat/deliverables-light` · Data: 2026-06-11 · Metoda: czytanie kodu runtime (FE `src/`, BE `server/src/`). Dokumenty = hipotezy, weryfikowane kodem (~7:1).

Trasa `/organization/*` → `OrganizationView.tsx`. `ProtectedRoute requireAuth` (logowanie), BEZ wymogu roli na routcie. Sidebar pokazuje sekcje tylko ADMIN/OWNER/SUPERADMIN, ale member może wejść deep-linkiem — gating wyłącznie po API.

---

## WERDYKTY PER POZYCJA (14)

| # | Pozycja | Werdykt | Dowód |
|---|---------|---------|-------|
| 1 | Profil firmy `/organization/profile` | **REALNE** (SSOT backend) | `OrganizationProfileModule.tsx:662` GET, `:698` PUT `/organization-profiles/:orgId`; ekstrakcja AI `:714` POST `/ai/extract-org-context` |
| 2 | Cele (Goals) | **MOCK-STUB / DZIAŁA-LOKALNIE** (localStorage-only, AI mock) | `GoalsExpectationsModule.tsx:24` store; `:27-36` hardcoded `aiSuggestions`; `:152,:166` `onRefine={() => {}}` no-op; persist `useContextBuilderStore.ts:414-415` localStorage |
| 3 | Wyzwania (Challenge Map) | **DZIAŁA-LOKALNIE** (localStorage-only) | `ChallengeMapModule.tsx:26` `useContextBuilderStore`; brak `Api.`; persist localStorage |
| 4 | Strategia (Strategic Synthesis) | **DZIAŁA-LOKALNIE + AI realne** (persist localStorage-only) | AI realne `useContextBuilderStore.ts:262` `Api.chatWithAI` + fallback rule-based `:276-393`; persist localStorage `:414-415` |
| 5 | Megatrendy | **DZIAŁA — redirect** | `OrganizationView.tsx:131-137` redirect do `DISCOVERY_TOOLS.STRATEGIC_MEGATRENDS` + `trackFunnelEvent` |
| 6 | Knowledge Graph | **REALNE** | `KnowledgeGraphExplorer.tsx:7,9,25-33` ReactFlow+dagre; `:158,:176` `Api.kgGetStats/kgSearchEntities` → `/api/knowledge-graph/*` |
| 7 | Baner kontekstu Teresy | **REALNE** | `OrgContextSummaryBanner.tsx:80` GET `/api/organization-context`; `:137` POST `/rebuild`; `:106-128` Socket.IO `/org-context` |
| 8 | Members | **REALNE** (niepełny panel) | `OrganizationAdminPanel.tsx:121` `Api.createOrganizationInvitation` → `/api/invitations`; lista `:62` `Api.getOrganizationMembers`; brak remove/role-change w panelu |
| 9 | Competencies | **REALNE — ALE BACKEND BEZ AUTH (ZEPSUTE bezp.)** | `CompetencyCatalog.tsx:73-154` `/competency/*`; serwis scoper OK, ale router bez `verifyToken` (patrz SEC) |
| 10 | Billing | **WIDOCZNE-ALE-NIEPEŁNE** (CTA martwe) | live: `OrganizationAdminPanel.tsx:258` `useLimits`→policy-snapshot; CTA `:292-295` tylko `trackFunnelEvent('billing_activate')`, brak checkoutu |
| 11 | Limits | **WIDOCZNE-ALE-NIEPEŁNE** (CTA martwe) | live: `:366` `Api.organizationPolicySnapshot`; CTA "View Plans" `:475` tylko `trackFunnelEvent('limits_view')` |
| 12 | Domains | **REALNE** | custom domain `:615` PATCH `/branding/:orgId`; approved domains `:541,:568,:592` GET/POST/DELETE `/organizations/:orgId/approved-domains` |
| 13 | Branding | **REALNE** (Regional read-only) | logo `:829-830` `Api.upload`+PATCH `/branding/:orgId`; kolor `:812` PATCH live; Regional `:905-920` `InfoRow` read-only z `orgData` |
| 14 | OrgContext (global) | **REALNE** | `OrgContext.tsx:136` POST `/api/auth/switch-organization` → nowy token; `:153` `tokenService.saveTokens`; `:166` BroadcastChannel; `:210` hard reload |

---

## POTWIERDZENIA KLUCZOWYCH ZARZUTÓW

### A. poz.2-4 localStorage-only — POTWIERDZONE
`useContextBuilderStore.ts:192-417` — pojedynczy zustand store z `persist(..., { name: 'consultify-context-builder', storage: createJSONStorage(() => localStorage) })` (`:414-415`). Trzyma `goals`, `challenges`, `synthesis`. **Brak jakiegokolwiek `Api.put/post` zapisującego te dane do backendu.** Jedyne wywołanie sieci to `Api.chatWithAI` (generacja sugestii ryzyk/szans, `:262`) — wynik też ląduje tylko w localStorage (`:395-402`).

Kontrast z poz.1 Profil: ten ma realny backend SSOT (`organization-profiles.routes.ts`) i zasila kontekst Teresy przez `organizationContextService.recordOrganizationProfile` (`:558`). **Goals/Challenges/Strategy NIE zasilają backendowego kontekstu Teresy** — AI ich nie widzi, a dane znikają przy zmianie przeglądarki / urządzenia / wyczyszczeniu storage. To persistencja-fasada udająca dane „organizacyjne".

Dodatkowo store jest **per-przeglądarka, nie per-org**: brak `organizationId` w kluczu storage → po przełączeniu organizacji (poz.14, hard reload) te same lokalne Goals/Challenges/Strategy „wyciekają" wizualnie do innej org w tej samej przeglądarce.

### B. poz.10/11 martwe CTA Billing/Limits — POTWIERDZONE
- Billing „Upgrade": `OrganizationAdminPanel.tsx:292-295` — `onClick={() => trackFunnelEvent('org_admin_cta_clicked', { action: 'billing_activate' })}`. Zero nawigacji, zero checkoutu (Stripe/Sellix). Ikona `ExternalLink` sugeruje wyjście, którego nie ma.
- Limits „View Plans": `:474-480` — `onClick={() => trackFunnelEvent('org_admin_cta_clicked', { action: 'limits_view' })}`. To samo: ślepe CTA.

Same dane są live (policy-snapshot przez `useLimits`, `:357-381`) — niepełna jest tylko ścieżka konwersji.

### C. Podwójna implementacja (drift) ADMINISTRATION — POTWIERDZONE
`OrganizationView.tsx:37-44` `ADMIN_REDIRECTS` mapuje members/competencies/billing/limits/domains/branding na trasy `/admin/*`. `handleSectionChange` (`:149-163`): klik w sidebarze sekcji admin → `navigate(adminRedirect)` (do modułu M24 Admin), NIE renderuje lokalnego panelu.

ALE `renderContent` (`:175-190`): jeśli `activeSection ∈ ADMIN_SECTIONS` (z bezpośredniego URL np. `/organization/members`), renderuje lokalny `<OrganizationAdminPanel section=…/>`. Czyli:
- klik w UI → M24 Admin (`/admin/people`, `/admin/billing`, …),
- deep-link `/organization/members` → lokalny `OrganizationAdminPanel.tsx` (osobna implementacja Members/Billing/Limits/Domains/Branding).

To dwie różne implementacje tej samej funkcji, rozjeżdżające się w czasie (drift). Member bez admina, wchodząc deep-linkiem na `/organization/billing`, trafia na lokalny panel zamiast redirectu — obejście intencji nawigacyjnej.

---

## SYGNAŁY DLA SEC (cross-org IDOR + missing-role-gate)

Enumeracja WSZYSTKICH routerów org i sposobu montażu (`Gateway.ts:628-741`):

| Router | Mount (Gateway) | Auth na mount | Auth w routerze | Org-scope |
|--------|-----------------|---------------|-----------------|-----------|
| `organization-profiles.routes.ts` | `:699` | brak | `router.use(verifyToken)` `:175` | **OK**: `userOrgId !== orgId → 403` `:189,:378`; PUT dodatkowo role-gate `:383` |
| `branding.routes.ts` | `:737` `gatewayVerifyToken` + highRiskSurfaceGuard | tak | `verifyToken` per-route + `isRequestSuperAdmin` bypass | **OK**: org-scope `:147-152` + membership-role `:162-172` |
| `organizations.routes.ts` (+ownership, +approved-domains) | `:671-679` `gatewayVerifyToken` + trialGuard + invite-guard | tak | — | scope w handlerach |
| `organization-context.routes.ts` | `:698` | brak | `router.use(verifyToken)` `:26` | scope z `req.user.organizationId` |
| `organization-data.routes.ts` | `:700` | brak | `router.use(verifyToken)` `:14` (real plik `organization/organization-data.routes.ts`) | **OK**: orgId = `req.user.organizationId` `:155,:215,:352,:400,:428` (nie z URL) |
| `organization-limits.routes.ts` | `:701` (`/api/organization`) | brak | `router.use(verifyToken)` `:15` | scope z usera |
| `capability.routes.ts` | `:643` | brak | `router.use(verifyToken)` `:8` | scope z usera |
| **`competency.routes.ts`** | **`:644`** | **BRAK** | **BRAK — zero middleware** (`grep router.use` = pusto) | scope-by-orgId, ale orgId puste |
| `knowledge-graph.routes.ts` | `:628` | brak | `router.use(verifyToken)` `:35` | **PODEJRZANE**: `requireUser` fallback `req.query.organizationId` `knowledge-graph.routes.ts:26` |

### 🔴 SYG-1 (P0, missing-auth + null-org leak): `/api/competency` BEZ ŻADNEJ AUTORYZACJI
`Gateway.ts:644` montuje `competencyRoutes` bez `gatewayVerifyToken`. Sam router (`competency.routes.ts`) importuje wyłącznie *typ* `AuthRequest` (`:3`), **nie ma `verifyToken` ani `router.use`** — żaden z 13 endpointów (GET/POST/PUT/DELETE kategorii, poziomów, kompetencji, seed-defaults, initiative-requirements) nie sprawdza tokenu.

Skutki:
1. **Endpointy osiągalne bez logowania** (np. `POST /api/competency/categories/seed-defaults`, `DELETE /api/competency/categories/:id`).
2. **Kolaps org-scope do org `''`**: każdy handler liczy `orgId = req.organizationId || req.user?.organizationId || ''` (`:16,:25,:37,...`). Bez auth `req.user` jest `undefined` → orgId = `''`. Serwis `competencyTaxonomyService.ts` filtruje po `organization_id = $1` z `''` — wspólny null-org koszyk. Zapisy (INSERT z `organization_id=''`) i odczyty trafiają do współdzielonej przestrzeni, nie do organizacji użytkownika.

To wzorzec znany z M24 (boczne routery admin-data/ai-settings z dziurami, których główny nie miał) — tu główny `organization-profiles` jest twardy, a boczny `competency` całkiem bez bramki.

### 🟠 SYG-2 (do weryfikacji w SEC, możliwy cross-org IDOR): `/api/knowledge-graph` org z query-param
`knowledge-graph.routes.ts:20-31` `requireUser`: `orgId = req.user?.organizationId || req.organizationId || (req.query.organizationId as string)`. Ostatni fallback bierze `organizationId` z query-stringa. `verifyToken` jest (`:35`), więc trzeba ważnego tokenu, ALE jeśli token nie niesie `organizationId` w claimach, member może podać `?organizationId=<obca-org>` i serwis KG (`unifiedKGService.searchEntities/getEntityById`) zwróci encje obcej org — o ile serwis nie waliduje membership. **SEC: sprawdzić czy `unifiedKGService` re-waliduje przynależność usera do `orgId`; jeśli nie → cross-org read przez query-param.**

### 🟡 SYG-3 (missing-role-gate na routcie): `/organization/*` bez wymogu roli
`OrganizationView` montowany pod `requireAuth` bez roli. Member wchodzi deep-linkiem na każdą sekcję, w tym ADMINISTRATION (lokalny `OrganizationAdminPanel`). Gating jest tylko po API. Gdzie API jest twarde (profile PUT role-gate, branding membership-role) — OK; gdzie API jest miękkie/odczytowe (np. Members GET, Limits/Billing policy-snapshot, **competency bez auth**) — member zobaczy/zmieni dane bez kontroli roli na froncie.

---

## TABELE WIRINGU

### 1e — Wiring (encja → DB/endpoint)
| Sekcja | Storage / Endpoint | Typ |
|--------|--------------------|-----|
| Profil | `organization_profiles` + `organization_settings('branding')` via `/organization-profiles/:orgId` (GET/PUT); ekstrakcja `/ai/extract-org-context` | backend SSOT |
| Goals | **localStorage** `consultify-context-builder` (zustand persist) | **localStorage-only** |
| Challenges | **localStorage** `consultify-context-builder` | **localStorage-only** |
| Strategy | **localStorage** `consultify-context-builder` (+ `Api.chatWithAI` do generacji, nie do zapisu) | **localStorage-only** |
| Megatrends | redirect → Discovery Tools | n/d |
| Knowledge Graph | `/api/knowledge-graph/*` (`Api.kg*`), tabele KG via `unifiedKGService` | backend |
| Members | `/organizations/:orgId/members` (GET), `/api/invitations` (POST) | backend |
| Competencies | `/competency/{categories,levels,competencies}` → `competency_*` (Postgres) | backend (bez auth!) |
| Billing/Limits | `/api/organization/policy-snapshot` (`organization-limits.routes`) | backend (read-only) |
| Domains | custom: PATCH `/branding/:orgId`; approved: `/organizations/:orgId/approved-domains` | backend |
| Branding | `/branding/:orgId` (GET/PATCH) + `Api.upload`; Regional read-only z `orgData` | backend |

### 1f — Flagi
- AI sugestie Goals = hardcoded mock (`GoalsExpectationsModule.tsx:27-36`), `onRefine` no-op.
- Billing „Upgrade" / Limits „View Plans" = tylko `trackFunnelEvent` (martwe CTA).
- Goals/Challenges/Strategy = localStorage-only, persistencja-fasada, niewidoczne dla Teresy, nie per-org.
- `/api/competency` = brak auth (P0).
- Podwójna implementacja admin: M24 redirect (klik) vs lokalny `OrganizationAdminPanel` (deep-link).
- KG org z query-param fallback (możliwy IDOR).

### 1g — Połączenia
- Profil → kontekst Teresy: PUT profilu woła `organizationContextService.recordOrganizationProfile` (`organization-profiles.routes.ts:558`) → claims → baner (poz.7) + Socket.IO rebuild.
- Goals/Challenges/Strategy → **brak połączenia** z kontekstem Teresy (tylko localStorage).
- Members → M24 (klik sidebar → `/admin/people`); zaproszenia → `/api/invitations`.
- Org switch (poz.14) → wymiana tokenu → hard reload → reset całej app + BroadcastChannel sync między kartami.

---

## PODSUMOWANIE FAZY 1
REALNE: Profil(1), KG(6), Baner Teresy(7), Members(8 — niepełny), Domains(12), Branding(13), OrgContext switch(14).
DZIAŁA-LOKALNIE (persist-fasada, nie-org, niewidoczne dla AI): Goals(2), Challenges(3), Strategy(4).
WIDOCZNE-ALE-NIEPEŁNE (martwe CTA): Billing(10), Limits(11).
REDIRECT: Megatrends(5).
ZEPSUTE bezpieczeństwo (P0): Competencies(9) — backend bez auth.

Główne ryzyka do FAZY SEC: (1) `/api/competency` bez `verifyToken` → unauth + null-org leak; (2) `/api/knowledge-graph` org z query-param → możliwy cross-org read; (3) `/organization/*` bez role-gate na routcie (gating tylko po API, miejscami miękkim).
