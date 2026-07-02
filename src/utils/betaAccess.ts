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
  MODULE_ECONOMICS: 'open', // Finance (M16 — GA per D-A)
  MODULE_AUDITS: 'open', // Audits (M12 — GA per D-A)
  MODULE_PRESENTATIONS: 'open', // Documents (Outputs library)
  MODULE_DOCUMENT_STUDIO: 'open', // Document Studio
  MODULE_PREZENTACJE_GEN: 'open', // Presentation Studio
  MODULE_TABELE: 'open', // Table Studio
  MODULE_MEETING: 'closed', // Meeting (M21 — post-GA beta per _FINISZ_MASTER_PLAN)
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
  MYWORK_IDEAS: 'open', // My Work → Ideas tab
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
