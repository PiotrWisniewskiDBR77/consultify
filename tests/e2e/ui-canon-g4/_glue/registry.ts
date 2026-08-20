/**
 * UI-CANON G4 — surface registry.
 *
 * Routes, gates and ready-signals are taken from the real router
 * (`src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`) and the components
 * themselves, not from documentation. Where a component exposes a
 * `data-testid` we use it, because it is language-independent; otherwise the
 * signal is a regex that must match in BOTH Polish and English.
 *
 * Several hub tab-bars are hardcoded in a single language regardless of the
 * account locale (Execution and Initiatives are Polish-only, Assessment's
 * five-surface tabs are English-only). That is recorded as a finding, and it
 * also means one literal is a legitimate PL+EN signal for those hubs.
 */

import type { SurfaceSpec } from '../_g4/types';

/** Shared landmark rendered by every StandardModuleBar-based hub. */
const MODULE_TABLIST = /Module sections/i;

export const SURFACES: SurfaceSpec[] = [
  {
    taskId: 'CHAT-UI-CANON-001',
    key: 'CHAT',
    module: 'Chat',
    route: '/chat',
    readySignal: /Zacznijmy transformację|Let's start your transformation|Zapytaj Teresę|Ask Teresa/i,
    gates: [
      'AppRoutes.tsx:1654-1666 — no BetaGate, no ProductionModuleGate, no feature flag. Mounts unconditionally for an authenticated user.',
    ],
    stateProbes: [
      {
        state: 'ready',
        path: '/chat',
        // The composer's prompt is a placeholder attribute, not text content,
        // so the assertion targets the surface's rendered heading instead.
        expect: /Zacznijmy transformację|Let's start your transformation/i,
        rationale: 'The composer screen is the surface\'s working state for a fresh tenant.',
      },
      {
        state: 'loading',
        path: '/chat',
        rationale: 'Sampled during a real cold boot; nothing is intercepted or delayed artificially.',
      },
    ],
    statesNotPresent: ['forbidden', 'stale'],
  },
  {
    taskId: 'MYW-AGT-UI-CANON-001',
    key: 'MYW',
    module: 'My Work (incl. Agent)',
    route: '/my-work',
    secondaryRoutes: ['/my-work?tab=agent', '/my-work?tab=vault'],
    readySignal: /Moja praca|My Work|Zadania|Tasks|Decyzje|Decisions/i,
    gates: [
      "AppRoutes.tsx:1481-1500 — ProductionModuleGate is a no-op ('My Work' is in PUBLIC_PRODUCTION_CORE_ROUTE_MODULES, AppRoutes.tsx:825).",
      'Agent tab: isAgentPlanEnabled() default ON (src/utils/agentPlanFlag.ts). Vault tab: isClientVaultEnabled() default ON (src/utils/clientVaultFlag.ts). Neither is overridden here.',
      "manager tab requires isAdmin||isManager||isSuperAdmin — satisfied by the ADMIN bootstrap session.",
      "home/Radar tab is hardcoded RADAR_ENABLED=false (MyWorkHub.tsx:245) with no runtime override — it cannot mount for anyone and is recorded as dead code, not swept.",
    ],
    stateProbes: [
      {
        state: 'empty',
        path: '/my-work',
        rationale: 'The bootstrap tenant is brand new, so the hub renders its genuine empty state.',
      },
    ],
    statesNotPresent: ['stale'],
  },
  {
    taskId: 'INT-UI-CANON-001',
    key: 'INT',
    module: 'Interview',
    route: '/interview',
    secondaryRoutes: ['/discovery'],
    readySignal: /Wywiad|Interview|Discovery|Sesj|Session/i,
    gates: [
      'AppRoutes.tsx:1907-1918 wrapped in V8UnavailableBanner(moduleName="Interview"); content depends on GET /v8/flags, gated server-side by ENABLE_V8_GLOBAL (server/src/middleware/v8FeatureGate.middleware.ts:15).',
      'This harness runs the backend with ENABLE_V8_GLOBAL=true, so the banner must not appear — if it does, that is a recorded failure, not a skip.',
      '/discovery renders the identical InterviewHub without the V8 banner (menuConfig.ts:69-73 points the sidebar at /discovery, not /interview).',
    ],
    statesNotPresent: ['stale'],
  },
  {
    taskId: 'TLS-UI-CANON-001',
    key: 'TLS',
    module: 'Consulting / Discovery Tools',
    route: '/discovery-tools',
    secondaryRoutes: ['/discovery-tools/strategic', '/discovery-tools/operational', '/discovery-tools/digital'],
    readySignal: /Biblioteka|Library|Narzędzia|Tools/i,
    gates: [
      'AppRoutes.tsx:1934-1948 — only ProductionModuleGate, a no-op outside the consultify.ai production hostname.',
    ],
    statesNotPresent: ['forbidden', 'stale'],
  },
  {
    taskId: 'ASM-UI-CANON-001',
    key: 'ASM',
    module: 'Assessment',
    route: '/assessment',
    secondaryRoutes: ['/assessment/drd', '/assessment/siri'],
    // Five-surface tabs are hardcoded English literals even for PL accounts
    // (AssessmentHub.tsx:719-748) — a single literal is therefore a valid
    // PL+EN signal here, and the missing translation is reported as a finding.
    readySignal: /Library|Processes|Outputs|Reports|Initiatives|Ocena|Assessment/i,
    gates: [
      'AppRoutes.tsx:2153-2185 — ProtectedRoute(requireAuth) + ProductionModuleGate; no BetaGate.',
      'assessmentFiveSurfacesV1 defaults TRUE (useFeatureFlags.tsx:177-202) and is not overridden; landing tab is "library".',
    ],
    statesNotPresent: ['stale'],
  },
  {
    taskId: 'INI-UI-CANON-001',
    key: 'INI',
    module: 'Initiatives',
    route: '/initiatives',
    secondaryRoutes: ['/roadmap', '/portfolio'],
    // Tab labels are hardcoded Polish (InitiativesHub) with no English variant.
    readySignal: /Inicjatywy|Initiatives|Portfel|Portfolio/i,
    gates: [
      "AppRoutes.tsx:2188-2202 — ProductionModuleGate no-op ('Initiatives' is a core module).",
    ],
    stateProbes: [
      {
        state: 'empty',
        path: '/initiatives',
        rationale: 'Fresh tenant has no initiatives, so this is the surface\'s real empty state.',
      },
    ],
    statesNotPresent: ['stale'],
  },
  {
    taskId: 'EXE-UI-CANON-001',
    key: 'EXE',
    module: 'Execution',
    route: '/execution',
    secondaryRoutes: ['/execution?tab=rollout'],
    // First tab label is the hardcoded Polish literal 'Realizacje'
    // (ExecutionHub.tsx:1996) in both locales.
    readySignal: /Realizacje|Execution|Wdrożen|Implementation/i,
    gates: [
      'AppRoutes.tsx:2322-2342 wrapped in V8UnavailableBanner(moduleName="Execution") — same ENABLE_V8_GLOBAL dependency as Interview; the harness sets it true.',
      "ProductionModuleGate names 'Implementation' rather than 'Execution' in PUBLIC_PRODUCTION_CORE_ROUTE_MODULES (AppRoutes.tsx:825) — a naming mismatch that only bites on the VTS public-production hostname; no-op here.",
    ],
    statesNotPresent: ['stale'],
  },
  {
    taskId: 'RES-UI-CANON-001',
    key: 'RES',
    module: 'Results',
    route: '/results',
    secondaryRoutes: ['/results/kpi', '/results/roi', '/results/okr'],
    readySignal: /Wyniki|Results|Rezultaty|KPI|OKR|ROI/i,
    // The three Results-Next registries default OFF; the query override is the
    // product's own documented mechanism and persists into localStorage.
    flagOverrides: {
      'ff.results_vnext_kpi_registry': '1',
      'ff.results_vnext_roi_registry': '1',
      'ff.results_vnext_okr_registry': '1',
    },
    gates: [
      "AppRoutes.tsx:2632-2648 — BetaGate moduleId='MODULE_BENEFITS' status 'open' (betaAccess.ts:39): never blocks.",
      'Results-Next registries (kpiRegistry/roiRegistry/okrRegistry, resultsVNextFeatureFlags.ts:32-48) default OFF; enabled here via their own localStorage keys so the registries render instead of the disabled panel. The default-OFF behaviour is itself recorded, not hidden.',
      'RES-MVP-VISIBILITY-001 default is OWNER/ADMIN only; the bootstrap session is ADMIN.',
    ],
    stateProbes: [
      {
        state: 'empty',
        path: '/results',
        rationale: 'Fresh tenant has no results, so this is the surface\'s genuine empty state.',
      },
      {
        state: 'error',
        path: '/results/kpi/00000000-0000-0000-0000-000000000000',
        rationale:
          'A well-formed but non-existent KPI id makes the real backend answer 404; nothing is stubbed.',
      },
    ],
    statesNotPresent: ['stale'],
  },
  {
    taskId: 'FIN-UI-CANON-001',
    key: 'FIN',
    module: 'Finance',
    route: '/finance',
    readySignal: /Finanse|Finance|Sprawozdania|Statements/i,
    gates: [
      "AppRoutes.tsx:2254-2270 — BetaGate moduleId='MODULE_ECONOMICS' status 'closed' (betaAccess.ts:47), but BETA_ADMINS_EXEMPT=true (betaAccess.ts:32) and the session is ADMIN, so it passes. A non-admin is redirected to /chat — that redirect is the surface's real forbidden behaviour.",
      'FIN-MVP-RECONCILIATION-001 default: Results Actual immutable, Finance may only raise a proposal/dispute.',
    ],
    stateProbes: [
      {
        state: 'empty',
        path: '/finance',
        rationale: 'Fresh tenant has no statements or models, so this is the real empty state.',
      },
      {
        state: 'error',
        path: '/finance/statements/00000000-0000-0000-0000-000000000000',
        rationale:
          'A well-formed but non-existent statement id makes the real backend answer 404; nothing is stubbed.',
      },
    ],
    statesNotPresent: ['stale'],
  },
  {
    taskId: 'MAT-UI-CANON-001',
    key: 'MAT',
    module: 'Materials',
    route: '/presentations',
    secondaryRoutes: ['/document-studio', '/tabele'],
    readySignal: /Prezentacje|Presentations|Raporty|Reports|Materiały|Materials/i,
    // Table Studio and Document Studio render their own titles, so the
    // module-level signal would report a false "did not render" there.
    routeSignals: {
      '/tabele': /Tabele|Tables|Table Studio|Arkusz|Sheet/i,
      '/document-studio': /Dokument|Document|Studio/i,
    },
    gates: [
      "AppRoutes.tsx:2471-2490 — BetaGate moduleId='MODULE_PRESENTATIONS' status 'open'.",
      'MAT-POL-001 default: provider-independent editing ON, external export UNAVAILABLE until a provider is approved.',
    ],
    statesNotPresent: ['stale'],
  },
  {
    taskId: 'MTG-UI-CANON-001',
    key: 'MTG',
    module: 'Meeting',
    route: '/meeting',
    readySignal: /Spotkania|Meeting|Notatki|Minutes/i,
    gates: [
      "AppRoutes.tsx:2492-2508 — BetaGate moduleId='MODULE_MEETING' status 'closed' (betaAccess.ts:53) with admin exemption; the ADMIN session passes.",
      "The sidebar still badges Meeting as 'soon' (menuConfig.ts:174-179) although the hub is a working CRUD surface — recorded as a stale-label finding.",
      'MTG-POL-001 default: recording OFF, no transcript persistence without opt-in.',
    ],
    statesNotPresent: ['stale'],
  },
  {
    taskId: 'ORG-UI-CANON-001',
    key: 'ORG',
    module: 'Organization',
    route: '/organization',
    // Only Profile/Goals/Challenges/Strategy render content; Members/Billing/
    // Limits/Domains/Branding always redirect away and are deliberately not
    // swept as Organization surfaces.
    secondaryRoutes: ['/organization/profile', '/organization/goals', '/organization/strategy'],
    readySignal: /Profil firmy|Company Profile|Organizacja|Organization/i,
    gates: [
      'AppRoutes.tsx:3016-3029 — ProtectedRoute(requireAuth) only, no role gate at route level.',
      'OrganizationView redirects Members/Billing/Limits/Domains/Branding to /admin/* for admins and /chat for non-admins; those five are dead ends, recorded as a finding rather than swept.',
    ],
    statesNotPresent: ['stale'],
  },
  {
    taskId: 'ADM-UI-CANON-001',
    key: 'ADM',
    module: 'Admin',
    route: '/admin',
    // /admin/operations and /admin/integrations are NOT valid sections and
    // silently fall through to `people`; they are excluded on purpose.
    secondaryRoutes: ['/admin/people', '/admin/security', '/admin/billing'],
    readySignal: /Zespół i dostęp|Team & Access|Administracja|Admin/i,
    gates: [
      'AppRoutes.tsx:3032-3048 — ProtectedRoute(requiredRole="ADMIN"). The bootstrap session is exactly ADMIN.',
      'A SUPERADMIN is redirected to /superadmin instead of AdminView (ProtectedRoute.tsx:84-90), so the fixture role matters and is pinned to ADMIN.',
      "AdminSettingsModule parses the pathname manually; valid sections are people|billing|ai|security|audit|command|health, default 'people'.",
    ],
    statesNotPresent: ['stale'],
  },
  {
    taskId: 'SET-UI-CANON-001',
    key: 'SET',
    module: 'Settings',
    route: '/settings',
    // /settings/billing redirects an admin out into /admin/billing, so it is
    // not a Settings target for this fixture.
    secondaryRoutes: ['/settings/profile', '/settings/security-dashboard'],
    readySignal: /Ustawienia|Settings|Profil|Profile/i,
    gates: [
      'AppRoutes.tsx:2992-3013 — ProtectedRoute(requireAuth) only; /settings redirects to /settings/profile.',
      'SET-MVP-OAUTH-001 and SET-MVP-DELETE-001 defaults stay fail-closed: no provider enabled, destructive deletion execution OFF.',
    ],
    statesNotPresent: ['stale'],
  },
  {
    taskId: 'PRT-UI-CANON-001',
    key: 'PRT',
    module: 'Partner Portal',
    route: '/partner',
    secondaryRoutes: ['/partner/dashboard', '/partner/commission'],
    readySignal: /Podłącz profil partnera|Connect your partner profile|Partner/i,
    gates: [
      'AppRoutes.tsx:3077-3093 — ProtectedRoute(requireAuth) only; the route deliberately has no role gate and relies on server-side data scoping.',
      'A fresh admin with no partner connection sees the "Connect your partner profile" CTA rather than partner data — that is the honest default surface for this fixture, not an error.',
      'PRT-POL-001 / PRT-MVP-ACCRUAL-001 defaults: one base currency, versioned accrual, manual payout request, no auto payout/KYC/tax.',
    ],
    statesNotPresent: ['stale'],
  },
  {
    // The sixteenth module. `UI-CANON-ALL-001` requires 16 module inventories
    // (`denominators.requiredModuleInventories: 16`) while this registry carried
    // only 15 — Audits was the gap. Registering it here closes the roster; it is
    // deliberately NOT added to the 82-task authority list in
    // `docs/cleanup/POST_CLEANUP_COMPLETION_PLAN.md`, because changing that
    // denominator is an integrator decision, not this lane's.
    taskId: 'AUD-UI-CANON-001',
    key: 'AUD',
    module: 'Audits',
    route: '/audit-programs',
    // `/audit-programs` is the sole canonical Audits mount. The retired
    // `/audit-programs/method` entry redirects here, so G4 must exercise the
    // current tab URLs rather than score the compatibility redirect.
    secondaryRoutes: [
      '/audit-programs?tab=library',
      '/audit-programs?tab=processes',
      '/audit-programs?tab=outputs',
      '/audit-programs?tab=reports',
      '/audit-programs?tab=initiatives',
    ],
    // The hub renders `data-testid="audits-hub"` (AuditsHub.tsx:764). Text is
    // used here because the shared sweep matches on text; the AUD spec
    // additionally asserts the test id, which is language-independent.
    readySignal: /Audit programs|Programy audytow|Audits|Audyty/i,
    // All five method routes share one marker: the method hub's own tab bar.
    //
    // Two traps were hit while calibrating this and are recorded so nobody
    // re-introduces them. (1) `/Raporty/` also matches the *hub*, which carries
    // its own "Raporty DRD" tab, so a flag-race redirect to the hub would have
    // been scored as a successful render. (2) A word-boundary regex such as
    // `/\bReports\b/` never matches, because `textContent` concatenates the tab
    // labels without separators into "LibrarySesjeOutputsReportsInitiatives" —
    // that produced a FAIL for a tab whose screenshot proves it rendered fine.
    //
    // `OutputsReports` appears only in the method hub's tab bar and never on
    // the hub, so it is a sound "the method hub is mounted" marker. Which of
    // the five tabs is active is established by the deep-link URL and by the
    // per-tab screenshot, not by this text signal.
    routeSignals: {
      '/audit-programs?tab=library': /OutputsReports|WynikiRaporty/,
      '/audit-programs?tab=processes': /OutputsReports|WynikiRaporty/,
      '/audit-programs?tab=outputs': /OutputsReports|WynikiRaporty/,
      '/audit-programs?tab=reports': /OutputsReports|WynikiRaporty/,
      '/audit-programs?tab=initiatives': /OutputsReports|WynikiRaporty/,
    },
    // Each tab gets its OWN marker: the *selected* tab carrying that tab's
    // label. A redirect to the hub cannot satisfy it (the hub's tab bar has
    // different labels), and unlike a text match it is immune to `textContent`
    // concatenating sibling labels. Both locales are listed because the labels
    // are translated now that `audits.method.tabs.*` exists in pl and en.
    routeSelectors: {
      '/audit-programs?tab=library':
        '[role="tab"][aria-selected="true"]:has-text("Biblioteka"), [role="tab"][aria-selected="true"]:has-text("Library")',
      '/audit-programs?tab=processes':
        '[role="tab"][aria-selected="true"]:has-text("Sesje"), [role="tab"][aria-selected="true"]:has-text("Sessions")',
      '/audit-programs?tab=outputs':
        '[role="tab"][aria-selected="true"]:has-text("Wyniki"), [role="tab"][aria-selected="true"]:has-text("Outputs")',
      '/audit-programs?tab=reports':
        '[role="tab"][aria-selected="true"]:has-text("Raporty"), [role="tab"][aria-selected="true"]:has-text("Reports")',
      '/audit-programs?tab=initiatives':
        '[role="tab"][aria-selected="true"]:has-text("Inicjatywy"), [role="tab"][aria-selected="true"]:has-text("Initiatives")',
    },
    gates: [
      "AppRoutes.tsx:1573-1587 — BetaGate moduleId='MODULE_AUDITS', status 'open' (betaAccess.ts:48), so it never blocks.",
      'AppRoutes.tsx — /audit-programs is the sole canonical Audits UI; /audit-programs/method is a compatibility redirect and is not scored as a separate surface.',
      'The retired auditsFiveSurfacesV1 flag is not enabled by this harness and does not control the canonical mount.',
      'AppRoutes.tsx:736-741 — /audit-programs/drd-report/:reportId redirects unless isDrdReportEnabled(); that flag has NO server/tenant scoping (query/localStorage/env only, src/utils/drdReportFlag.ts), which is recorded as a finding.',
      '/audits is a public marketing showcase under AuthLayout with no BetaGate and no auth requirement (AuditsShowcasePage.tsx) and is NOT the working application.',
    ],
    statesNotPresent: ['stale'],
  },
];

export { MODULE_TABLIST };
