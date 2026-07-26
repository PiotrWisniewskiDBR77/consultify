import { describe, it, expect } from 'vitest';
import { AppView } from '../../../../src/types';
import {
  getAdminMenuItem,
  getInternalToolsMenuItem,
  getMenuStructure,
  getOrganizationMenuItem,
  getPartnerMenuItem,
  getSettingsMenuItem,
  getSuperAdminMenuItem,
  getViewName,
} from '../../../../src/components/navigation/Sidebar/menuConfig';

describe('Sidebar menuConfig (L2)', () => {
  const t = (_key: string, fallback?: string) => fallback ?? _key;

  it('builds Organization menu item with correct view and label', () => {
    const item = getOrganizationMenuItem(t);
    expect(item.id).toBe('ORGANIZATION');
    expect(item.viewId).toBe(AppView.ORGANIZATION_PROFILE);
    expect(item.label).toBe('sidebar.organization');
  });

  // Affiliate/Ecosystem dropped from navigation per decision #1 (Harvard): the
  // dashboard was UI-complete but backend-stubbed. It must NOT appear in the
  // sidebar for any journey state (route now redirects to /chat).
  it('never includes affiliate dashboard (dropped per decision #1)', () => {
    expect(getMenuStructure(t).some((i) => i.id === 'AFFILIATE_DASHBOARD')).toBe(false);
    expect(
      getMenuStructure(t, 'ECOSYSTEM_NODE').some((i) => i.id === 'AFFILIATE_DASHBOARD')
    ).toBe(false);
  });

  it('keeps AI OS out of the main sidebar', () => {
    const menu = getMenuStructure(t);
    expect(menu.some((item) => item.id === 'AI_OS')).toBe(false);
    expect(menu.some((item) => item.id === 'INTERNAL_TOOLS')).toBe(false);
  });

  it('does not expose Wnioski as a top-level module', () => {
    const menu = getMenuStructure(t);
    expect(menu.some((item) => item.id === 'CONCLUSIONS')).toBe(false);
    expect(menu.some((item) => item.label === 'Wnioski')).toBe(false);
  });

  // Kanon 2026-07-26 (docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md
  // §3): "Excel" was a duplicate of Materiały → Arkusze and must NOT appear as
  // its own sidebar entry, regardless of isExceleEngineEnabled() — the engine
  // itself stays fully reachable via Materials → Sheets and the /excele deep
  // link (AppRoutes.tsx); only the standalone clickable menu item is removed.
  it('never exposes Excel as its own sidebar module (duplicate of Materiały → Arkusze)', () => {
    expect(getMenuStructure(t).some((i) => i.id === 'MODULE_EXCELE')).toBe(false);
  });

  it('exposes AI OS manual-test entrypoints as an internal tools footer item', () => {
    const aiOs = getInternalToolsMenuItem(t);

    expect(aiOs.label).toBe('Internal Tools');
    expect(aiOs.viewId).toBe(AppView.AI_OS_HOME);
    expect(aiOs.subItems?.map((item) => item.id)).toEqual([
      'AI_OS_HOME',
      'AI_OS_ACTIONS',
      'AI_OS_RESEARCH',
      'AI_OS_ARTIFACTS',
      'AI_OS_MEMORY',
      'AI_OS_CONNECTORS',
      'AI_OS_AGENTS',
      'AI_OS_OUTCOMES',
    ]);
    expect(aiOs.subItems?.map((item) => item.viewId)).toEqual([
      AppView.AI_OS_HOME,
      AppView.AI_OS_ACTION_CENTER,
      AppView.AI_OS_RESEARCH,
      AppView.AI_OS_ARTIFACTS,
      AppView.AI_OS_CONTEXT_MEMORY,
      AppView.AI_OS_CONNECTORS,
      AppView.AI_OS_AGENTS,
      AppView.AI_OS_OUTCOMES,
    ]);
  });

  it('builds other top-level items', () => {
    const admin = getAdminMenuItem(t);
    expect(admin.id).toBe('ADMIN');
    expect(admin.viewId).toBe(AppView.ADMIN_DASHBOARD);

    const settings = getSettingsMenuItem(t);
    expect(settings.id).toBe('SETTINGS');
    expect(settings.viewId).toBe(AppView.SETTINGS_PROFILE_MODULE);

    const partner = getPartnerMenuItem(t);
    expect(partner.id).toBe('PARTNER_PORTAL');
    expect(partner.viewId).toBe(AppView.PARTNER_LANDING);
  });

  it('builds SuperAdmin as a launcher into the dedicated shell', () => {
    const superadmin = getSuperAdminMenuItem(t);
    expect(superadmin.id).toBe('SUPERADMIN');
    expect(superadmin.viewId).toBe(AppView.SUPERADMIN_CUSTOMERS);
    expect(superadmin.subItems).toBeUndefined();
  });

  it('maps view IDs to display names (getViewName)', () => {
    expect(getViewName(AppView.MY_WORK, t)).toBe('My Work');
    expect(getViewName(AppView.PORTFOLIO_ROADMAP, t)).toBe('Portfolio & Roadmap');
    expect(getViewName(AppView.AI_CHAT, t)).toBe('common.previousStep');
  });
});
