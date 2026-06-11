# Inwentarz funkcjonalności G — ADMIN + USTAWIENIA + PORTAL PARTNERSKI + SUPERADMIN + AFFILIATE

Część mapy modułów V2. Zweryfikowane w kodzie 2026-06-11, branch `feat/deliverables-light`.

---

## MODUŁ: PANEL ADMINISTRATORA (org admin)

**Trasy:** sidebar ADMIN (ADMIN/OWNER/SUPERADMIN) → `/admin/*` → `ProtectedRoute requiredRole="ADMIN"` → `AdminView` → `AdminSettingsModule`. Aliasy URL mapują na 5 sekcji kanonicznych. `DesktopOnlyGuard` (mobile zablokowane).
**Opis:** żywy org-admin = AdminSettingsModule z 5 panelami i własnym sidebarem (`Admin/AdminSettingsSidebar.tsx`). **P0 superadmin≥admin NAPRAWIONE** — `ProtectedRoute.tsx:72-74` jawnie przekierowuje SUPERADMIN-a z `/admin/*` na `/superadmin`.

1. **Team & Access (people)** — tabela członków (rola/usunięcie z ochroną OWNER i self), dodawanie po e-mail, generator kodu zaproszenia (max 500 użyć) + transfer własności. [DZIAŁA] `AdminMembersRolesPanel.tsx`
2. **Billing & Plans (billing)** — 5 zakładek: Summary, Plan & limits, Payment methods, Invoices, Budgets & tax (7 endpointów Api.getAdminBilling*). [DZIAŁA]; karty płatności [ZA FLAGĄ `VITE_STRIPE_ENABLED`]
3. **AI Controls (ai)** — governance summary + 2 zakładki: Governance settings (OrgAISettingsView) i AI operations (`AIModule` z 9 pod-zakładkami: LLM Config, Access & Limits, Policy & Governance, Models & Providers, Features & Privacy, Audit & Compliance, AI Health, Help Analytics, Tokens). [DZIAŁA]
4. **Security & Identity (security)** — 6 zakładek: Security policy, Collaboration policy, API access, Delegated IAM, SCIM & lifecycle, Risk summary. [DZIAŁA]
5. **Audit Log (audit)** — 100 zdarzeń + search, statystyki, eksport CSV, retencja (730 dni, zapis). [DZIAŁA]
6. **`layout/AdminSidebar.tsx`** — zero importów. [MARTWY KOD]
7. **Resztki w `components/Admin/`** (ChatV9Flags*, ABTestingDashboard, V8AdminDiagnosticsPanel…) — nie montowane w org-adminie; część reużywana przez superadmin AI Platform. [MARTWY KOD / współdzielone — per plik do rozstrzygnięcia]

## MODUŁ: USTAWIENIA (Settings)

**Trasy:** `/settings/*` → `SettingsView` z sidebarem `settings/SettingsSidebar.tsx` (`layout/SettingsSidebar.tsx` = MARTWY KOD).
**Opis:** ~35 sekcji w 10 grupach; sekcje ownership (`overview`, `tenant-*`, `module-preferences`) i `shortcuts` UKRYTE (redirect do Profile); pilot ograniczony do profile/auth-access/language/theme.

1. **Profile / Avatar / Email Signatures / Working Hours** — [DZIAŁA]
2. **Dashboard / Work Preferences / Regional / Language** — [DZIAŁA]
3. **AI: Behavior & Instructions, Model & Parameters, Auto-Complete, Memory & Context, Chat History, Data & Privacy, Prompt Library, Usage Dashboard** — wszystkie spięte z Api. [DZIAŁA — dawne 503 nie występuje w kodzie klienta]
4. **AI: Voice & TTS** — [WIDOCZNE-ALE-ZEPSUTE — znany false negative „not configured" przy działającym głosie (finding 2026-06-08)]
5. **Notifications: Channels & Categories, Email & Digest, Desktop & Sounds, Availability** — [DZIAŁA]
6. **Security: Overview + Authentication & Access** (hasło, MFA, sesje, historia logowań, recovery — skonsolidowane v2, stare URL-e przekierowują). [DZIAŁA]
7. **Integrations: Connected Apps, Calendar Sync, API Keys, Webhooks** — Calendar Sync **NIE jest już fake**: realne connect/disconnect z weryfikacją serwera i czystym fallbackiem „Coming soon". [DZIAŁA]
8. **Data & Consent (GDPR)** — eksport, retencja, **usunięcie konta z weryfikacją hasła NAPRAWIONE** (klient: fraza + hasło, `DataControlsSettings.tsx:357-387`; serwer: bcrypt, `settings.routes.ts:2995-3030`, 30-dniowy grace). [DZIAŁA]
9. **Privacy & Visibility** — [DZIAŁA]
10. **Theme / Accessibility** — [DZIAŁA]; **Keyboard Shortcuts** — [UKRYTE — brak globalnego dispatchera]
11. **Advanced: Import/Export, Templates, Developer (feature flags), Beta Features, History** — [DZIAŁA]
12. **Billing w Settings NIE ISTNIEJE** — AppView.SETTINGS_BILLING mapuje na `/settings/billing`, ale sekcji brak → „Section not found"; billing żyje w Admin i Organization. [STUB/route-only]

## MODUŁ: PORTAL PARTNERSKI

**Trasy:** `/partner/*` → `PartnerPortalViewNew` (3310 l.); route gated tylko `requireAuth` **celowo** (defense-in-depth: egzekwowanie serwerowe, komentarz `AppRoutes.tsx:2231`). Wpis w sidebarze (stopka) tylko gdy `GET /api/partners/connection` → `connected=true`. Publiczne: `/become-partner`, `/become-partner/apply`, `/partner/pricing`; `/partner/onboarding` → EnterpriseOnboardingWizard.
**Opis:** dwukolumnowy portal, 24 sekcje w 8 grupach; bez połączonego profilu nawigacja zablokowana do connect/onboarding.

1. **Home: partner-home, Dashboard, Metrics** — realne API; **performance NIE jest już hardcoded** — uczciwe empty-states. [DZIAŁA]
2. **Referrals: Links & Codes, Click Analytics, Referred Customers** — V8PartnerApi (kampanie, atrybucje). [DZIAŁA]
3. **Earnings: Commissions, Statements, Payouts, Payout Settings** — **auth NAPRAWIONE**: v8 routes rozwiązują partnera przez `getActivePartnerOrgIdForUser(userId)` zamiast `req.user.partnerOrgId`; payout request, dual-control. [DZIAŁA]
4. **Client Management: Access Manager, Organizations, Projects, Users** — odczyty działają; zapisy POST /clients, /employees, /access-links = 503. [DZIAŁA (odczyt) / STUB (zapis)]
5. **Academy: Learning Path, Exams, Certificates** — [DZIAŁA]
6. **Resources: Documentation, Marketing, Case Studies, Templates** — [DZIAŁA]
7. **Directory Profile: Company Info, Specializations, Regions, Public Listing** — GET/PUT z fallbackiem katalogów. [DZIAŁA]
8. **Endpointy 503** — `partners.routes.ts` ma **26 wywołań** featureUnavailable (stabilny kontrakt FEATURE_NOT_AVAILABLE, frontend chowa akcje): POST /clients, GET /clients/:id, POST /employees, GET /stats, /access-links, /licenses, /licenses/order, /invoices, /tiers. [STUB — celowy]
9. **Demo seed** — `ensurePartnerDemoDataset` przy odczytach v8; prod no-op chyba że `DEMO_WRITES_ENABLED` / `PARTNER_DEMO_SEED_ENABLED`. [ZA FLAGĄ]
10. **Partner Pricing** — publiczny. [DZIAŁA]

## MODUŁ: SUPERADMIN

**Trasy:** `/superadmin/*` → `ProtectedRoute requiredRole="SUPERADMIN"` → `SuperAdminView` z **dedykowanym shellem** (bez MainLayout; własny header ze status indicators, Signal Center, Help/Feedback/Docs) + `SuperAdminSidebar` z **5 sekcjami**. Auto-redirect SUPERADMIN-a po loginie. `DesktopOnlyGuard`. Badge na Customers = pending access requests.

1. **Tenant & User Ops** (`CustomersModule.tsx`, 20 zakładek) — Command Center, Organizations, **Users** (UserManagementCore + UserAssignmentsPanel — żyją TU, nie w org-adminie), Lifecycle, Playbooks, Contracts, Commercial (RevenueModule: billing/invoices/usage), Limits & Budgets, Security, Support & CS, **Feedback / Backlog / Feedback Analytics**, Analytics, Compliance, Automation, Communication, Bulk Ops, **Module Waitlist**, **Module Access** (beta-granty + bootstrap DBR77). [DZIAŁA] (znany finding 2026-06-10: pulse/feature 500 — brak tabel prod; in-app feedback martwe `is_active`)
2. **AI Operations** (`AIPlatformModule/`, 7 zakładek × pod-zakładki) — Configuration (Providers, Tiers, Routing, Purposes, Org Policy, Governance, Global), Development (Prompts, Builder, Experiments, Registry), Operations (Mission Control, Health, Performance, SLA, runtime'y, Market Inbox), Analytics (Observatory, Usage, Cost, Pricing, Metrics, Reports), Policy Plane, Security, Knowledge (KB, RAG, Strategic Directions). [DZIAŁA]; stary płaski `AIPlatformModule.tsx` [MARTWY KOD]
3. **Connector Ops / System** (`SystemModule.tsx`) — Health, Audit Log, **Feature Flags**, Integrations, Security, Configuration, Analytics, Backup, API Keys + 5 zakładek presentation-governance. [DZIAŁA]
4. **Governance & Compliance** — Overview, Audit Timeline, Approvals, Compliance, Exports & Retention, Legal & Policies. [DZIAŁA]
5. **Platform Security** (15 zakładek) — Posture, SSO, SCIM, Roles, Permissions, Policies, Admin Sessions, Audit, Workflows, Incidents, Threats, DLP, AI Budgets, Compliance. [DZIAŁA]
6. **Configuration** (Settings, White-label, Legal) — wejście via URL/legacy view. [DZIAŁA]
7. **Virtual Workers** (`VirtualWorkersModule/`: Anna/Teresa — Profile, Knowledge, Preview, Conversations, Analytics, Insights, Evaluations, Release) — route działa, **brak wpisu w sidebarze** → [UKRYTE (tylko URL)]

## MODUŁ/ANEKS: ECOSYSTEM / AFFILIATE DASHBOARD

**Trasy:** `/affiliate` (requireAuth) → `AffiliateDashboardView`; pozycja sidebar „Ecosystem Impact" tylko gdy `journeyState === 'ECOSYSTEM_NODE'`.
**Opis:** dashboard Phase G — KPI poleceń, kody referencyjne.

1. **Cały moduł = STUB end-to-end**: metody klienta to hardcodowane atrapy (`api.ts:12910-12915` — pusta lista, pusty kod), serwerowy `referrals.routes.ts` = „degraded mode" **503 na wszystko**. Widok zawsze pusty. [STUB]

---

### Przekrojowe ustalenia
- **ProtectedRoute**: hierarchia USER(1) < ADMIN=OWNER(2) < SUPERADMIN(3); P0 „superadmin dziedziczy admin" zamknięte jawnym redirectem.
- Martwy kod do sprzątnięcia: `layout/AdminSidebar.tsx`, `layout/SettingsSidebar.tsx`, `views/superadmin/AIPlatformModule.tsx` (płaski), część `components/Admin/*`.
- Settings nie ma panelu billing mimo enum/route — pułapka nawigacyjna.
- Partner Portal: jedyna ścieżka z celowo luźnym gate'em route-level — bezpieczeństwo w 100% po stronie serwera.
