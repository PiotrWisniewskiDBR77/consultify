import { describe, it, expect } from 'vitest';
import { AppView } from '../../../../src/types';
import {
  getAdminMenuItem,
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

  it('includes affiliate dashboard only for ECOSYSTEM_NODE journey', () => {
    const base = getMenuStructure(t);
    expect(base.some((i) => i.id === 'AFFILIATE_DASHBOARD')).toBe(false);

    const eco = getMenuStructure(t, 'ECOSYSTEM_NODE');
    expect(eco.some((i) => i.id === 'AFFILIATE_DASHBOARD')).toBe(true);
    const affiliate = eco.find((i) => i.id === 'AFFILIATE_DASHBOARD');
    expect(affiliate?.viewId).toBe(AppView.AFFILIATE_DASHBOARD);
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

  it('builds SuperAdmin menu item with subitems', () => {
    const superadmin = getSuperAdminMenuItem(t);
    expect(superadmin.id).toBe('SUPERADMIN');
    expect(Array.isArray(superadmin.subItems)).toBe(true);
    expect(superadmin.subItems?.length).toBeGreaterThanOrEqual(3);
    expect(superadmin.subItems?.some((s) => s.viewId === AppView.SUPERADMIN_OVERVIEW)).toBe(true);
  });

  it('maps view IDs to display names (getViewName)', () => {
    expect(getViewName(AppView.MY_WORK, t)).toBe('My Work');
    expect(getViewName(AppView.PORTFOLIO_ROADMAP, t)).toBe('Portfolio & Roadmap');
    expect(getViewName(AppView.AI_CHAT, t)).toBe('common.previousStep');
  });
});
