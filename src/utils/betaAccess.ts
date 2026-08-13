/**
 * Beta access gating — single source of truth.
 *
 * Modules can carry a `beta` badge in the sidebar (see menuConfig.ts). This
 * module decides, per beta module, whether the beta is:
 *   - 'open'   → badge only, fully accessible.
 *   - 'closed' → badge + access blocked for regular users. They see a polished
 *                "access restricted" plate (AccessBlockedModal, code BETA_LOCKED)
 *                and cannot enter the module.
 *
 * Org administrators (ADMIN / OWNER / SUPERADMIN) always keep full access so the
 * team can keep building the beta surfaces while they stay hidden from users.
 *
 * To open or close a beta on production, flip a single value in
 * {@link BETA_MENU_STATUS} — no other change is required.
 */

import { MenuItem } from '../components/navigation/Sidebar/types';
import { isAdminOwnerOrSuperAdminRole } from './roleGuards';

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
  // Finance — ZAMKNIĘTE przed klientami (decyzja Piotra, MVP 2026-07-28):
  // „MVP finansów nie ładowałbym, to jest ogromny projekt… zostawiłbym w wersji
  // beta i klientom bym tego później nie pokazywał, zakluczyłbym to. Nie jesteśmy
  // w stanie do poniedziałku rozwinąć tego modułu."
  // Moduł zostaje dostępny dla administratorów (BETA_ADMINS_EXEMPT), więc dalej
  // nad nim pracujemy — znika tylko z zasięgu klienta.
  MODULE_ECONOMICS: 'closed', // Finance (M16 — poza MVP, patrz _MVP_PRZEGLAD_MENU_2026-07-28.md)
  MODULE_AUDITS: 'open', // FLIP — akcept Piotra 07-16 (816 linii + backend, demo-ready)
  MODULE_PRESENTATIONS: 'open', // Documents (Outputs library)
  MODULE_DOCUMENT_STUDIO: 'open', // Document Studio
  MODULE_PREZENTACJE_GEN: 'open', // Presentation Studio
  MODULE_TABELE: 'open', // Table Studio
  MODULE_MEETING: 'closed', // Meeting (M21 — post-GA beta per _FINISZ_MASTER_PLAN)
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

export function getBetaStatus(id?: string | null): BetaStatus | undefined {
  return BETA_MENU_STATUS[String(id || '').trim()];
}

export function isBetaSubareaClosed(id?: string | null): boolean {
  return BETA_SUBAREA_STATUS[String(id || '').trim()] === 'closed';
}

/** True when a closed beta area must be blocked for this role. */
export function isBetaLockedForRole(role: string | null | undefined): boolean {
  if (!BETA_ADMINS_EXEMPT) return true;
  return !isAdminOwnerOrSuperAdminRole(role);
}

export function isBetaModule(id?: string | null): boolean {
  return getBetaStatus(id) !== undefined;
}

export function isBetaClosed(id?: string | null): boolean {
  return getBetaStatus(id) === 'closed';
}

/**
 * Decorate a menu tree so closed-beta modules are locked. Blocks everyone by
 * default; if BETA_ADMINS_EXEMPT is true, administrators keep full access.
 */
export function lockClosedBetaModules(
  menu: MenuItem[],
  role: string | null | undefined,
  lockedMessage: string
): MenuItem[] {
  if (BETA_ADMINS_EXEMPT && isAdminOwnerOrSuperAdminRole(role)) return menu;

  const decorate = (item: MenuItem): MenuItem => {
    const decoratedChildren = item.subItems?.map(decorate);

    if (!isBetaClosed(item.id)) {
      return decoratedChildren ? { ...item, subItems: decoratedChildren } : item;
    }

    return {
      ...item,
      subItems: decoratedChildren,
      isLocked: true,
      lockedMessage,
      lockedCode: BETA_LOCKED_CODE,
    };
  };

  return menu.map(decorate);
}

/**
 * Nav declutter (Q1 — `Harvard/wdrozenie-100/_AUDYT_NADMIAR_ELEMENTOW_2026-07-11.md`,
 * flag `ff.nav_declutter` in `navDeclutterFlag.ts`, default OFF).
 *
 * `lockClosedBetaModules` above still SHOWS closed-beta modules to admins
 * (BETA_ADMINS_EXEMPT keeps the team able to test them) — that is the direct
 * cause of the "too many elements" complaint: the owner is an admin, so they
 * see Audits/Meeting (empty/post-GA modules) that a regular user never sees.
 *
 * When the nav-declutter flag is ON, call this AFTER `lockClosedBetaModules`
 * to additionally:
 *   1. Remove closed-beta items from the tree entirely, for EVERY role
 *      (effectively `BETA_ADMINS_EXEMPT = false` for just these items) —
 *      instead of the locked/grayed-out plate, they simply do not render.
 *   2. Strip the `beta` badge from items whose status is 'open' (GA per D-A:
 *      Results/Finance/Materials) — access is untouched, only the visual
 *      badge is removed since these modules no longer carry beta risk.
 *
 * When the flag is OFF, this function is never called by Sidebar.tsx — nav
 * renders exactly as it does today.
 */
export function declutterMenu(menu: MenuItem[]): MenuItem[] {
  const strip = (items: MenuItem[]): MenuItem[] =>
    items
      .filter((item) => !isBetaClosed(item.id))
      .map((item) => {
        const next: MenuItem = { ...item };
        if (next.subItems) {
          next.subItems = strip(next.subItems);
        }
        if (next.badge === 'beta' && getBetaStatus(item.id) === 'open') {
          delete next.badge;
        }
        return next;
      });

  return strip(menu);
}

/**
 * Surface the polished beta "access restricted" plate. Intentionally carries no
 * CTA so the modal shows a single acknowledge button.
 */
export function dispatchBetaAccessBlocked(message?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('access:blocked', {
        detail: {
          code: BETA_LOCKED_CODE,
          message,
        },
      })
    );
  } catch {
    // ignore UI-only notification errors
  }
}
