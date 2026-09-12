/**
 * Beta access gating — PURE SSOT data (no DOM, no imports).
 *
 * Split out of `betaAccess.ts` so the SAME values can be consumed by the
 * server. `betaAccess.ts` itself cannot be: it imports `MenuItem` from the
 * Sidebar component tree and touches `window`, and — decisively — the
 * production backend image is built from `COPY server/ .` (Dockerfile.api),
 * so `server/src/**` may never reach outside `server/`. A server import of
 * `../../../src/utils/betaAccess.js` silently resolves to the ambient
 * `declare module '*.js'` in `server/src/types/custom.d.ts` and fails the
 * production build with TS2614.
 *
 * The server consumes a GENERATED MIRROR of this file at
 * `server/src/sharedRuntime/utils/betaMenuStatus.ts`
 * (`scripts/cleanup/sync-server-runtime-mirrors.mjs`, drift-checked by
 * `npm run build` in server/). Edit THIS file only; run the script to sync.
 *
 * `betaAccess.ts` re-exports everything here, so existing client imports of
 * `BETA_MENU_STATUS` / `BetaStatus` / … from `betaAccess` keep working.
 */

export type BetaStatus = 'open' | 'closed';

export const BETA_LOCKED_CODE = 'BETA_LOCKED';

/**
 * When true, ADMIN / OWNER / SUPERADMIN keep access to closed betas (so the team
 * can keep building) while regular users are blocked. When false, closed betas
 * are blocked for EVERYONE — including admins.
 *
 * Currently true: admins exempt so the team can test all modules.
 */
export const BETA_ADMINS_EXEMPT = true;

/**
 * SSOT: status of every beta module keyed by its sidebar menu id.
 * Keep this list in sync with the `badge: 'beta'` entries in menuConfig.ts.
 */
export const BETA_MENU_STATUS: Record<string, BetaStatus> = {
  MODULE_BENEFITS: 'open', // Results (M15 — GA per D-A)
  MODULE_CONCLUSIONS: 'closed', // HIDDEN 2026-07-04 (owner decision — added without consent); nav entry removed in menuConfig too
  // DEC-470: API beta remains closed; UI announcement is independently reachable.
  MODULE_ECONOMICS: 'closed',
  MODULE_AUDITS: 'open', // FLIP — akcept Piotra 07-16 (816 linii + backend, demo-ready)
  MODULE_PRESENTATIONS: 'open', // Documents (Outputs library)
  MODULE_DOCUMENT_STUDIO: 'open', // Document Studio
  MODULE_PREZENTACJE_GEN: 'open', // Presentation Studio
  MODULE_TABELE: 'open', // Table Studio
  MODULE_MEETING: 'open', // FLIP — decyzja właściciela D-1, 2026-08-30
  // Zlecenia (Case Workspace E7/E8). ZAMKNIĘTE do akceptu właściciela.
  // ★ UWAGA: 'closed' NIE wystarczy jako jedyna bramka — `BETA_ADMINS_EXEMPT`
  // wyżej jest `true`, więc każdy admin/owner i tak by moduł zobaczył. Realną
  // niewidzialność daje DRUGA bramka: flaga runtime `isCaseWorkspaceEnabled()`
  // (`src/components/CaseWorkspace/caseWorkspaceFlag.ts`, domyślnie OFF),
  // sprawdzana przy rejestracji trasy w AppRoutes.tsx.
  MODULE_CASE_WORKSPACE: 'closed',
  // Internal Tools (AI OS) is a footer item rendered outside the gated main menu
  // (not run through lockClosedBetaModules), and is already restricted to DBR77
  // via canUseInternalTools(). Tracked here as 'open' = beta badge only, no lock.
  INTERNAL_TOOLS: 'open',
};

/**
 * SSOT for beta sub-areas that are NOT top-level sidebar modules — e.g. tabs
 * inside a module (My Work → Ideas). Same open/closed semantics as modules.
 */
export const BETA_SUBAREA_STATUS: Record<string, BetaStatus> = {
  // 2026-07-20 (decyzja Piotra, przegląd MVP): Ideas ZAMKNIĘTE dla klientów.
  // Powód: podstawowa ścieżka nie działa — kreator „New Idea" otwiera zawsze
  // mapę myśli niezależnie od wybranego narzędzia, szablony nie istnieją
  // (`templateId: null` zawsze), 3 z 4 narzędzi są puste. Moduł nie jest
  // testowalny, więc nie może być pokazywany klientom.
  // BETA_ADMINS_EXEMPT=true → zespół (admin/owner/superadmin) zachowuje dostęp
  // do dalszej pracy. Otworzyć po wykonaniu i odbiorze sekcji I planu:
  // Harvard/wdrozenie-100/_PLAN_WYKONAWCZY_2026-07-20.md
  MYWORK_IDEAS: 'closed', // My Work → Ideas tab
};

/** DEC-470: announcement only; never grants access to the module or its API. */
export const COMING_SOON_MENU_IDS: ReadonlySet<string> = new Set(['MODULE_ECONOMICS']);
export const isModuleComingSoon = (id?: string | null): boolean =>
  COMING_SOON_MENU_IDS.has(
    String(id || '')
      .trim()
      .toUpperCase()
  );
