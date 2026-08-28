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
 * {@link BETA_MENU_STATUS} — no other change is required. That map (and the
 * other pure gating constants) now lives in `./betaMenuStatus.ts`, which is
 * DOM-free so the server can consume a generated mirror of it; this module
 * re-exports it unchanged and adds the browser-side helpers.
 */

import type { MenuItem } from '../components/navigation/Sidebar/types';
import {
  BETA_ADMINS_EXEMPT,
  BETA_LOCKED_CODE,
  BETA_MENU_STATUS,
  BETA_SUBAREA_STATUS,
  type BetaStatus,
} from './betaMenuStatus';
import { isAdminOwnerOrSuperAdminRole } from './roleGuards';

export type { BetaStatus } from './betaMenuStatus';
export {
  BETA_ADMINS_EXEMPT,
  BETA_LOCKED_CODE,
  BETA_MENU_STATUS,
  BETA_SUBAREA_STATUS,
} from './betaMenuStatus';

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
