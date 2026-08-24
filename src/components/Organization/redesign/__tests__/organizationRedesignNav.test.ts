/**
 * Kontrakt nawigacji redesignu v1: 21 → 11 ekranów przy NIEZMIENIONYCH 6 grupach.
 * Źródło liczb: `org-konsolidacja-propozycja.md` §4 (akcept właściciela 2026-08-24).
 */
import { describe, expect, it } from 'vitest';

import { ORGANIZATION_MODULES } from '../../OrganizationSidebar';
import {
  ORGANIZATION_REDESIGN_MODULES,
  ORGANIZATION_REDESIGN_SCREEN_COUNT,
  REDESIGN_SCREEN_REDIRECTS,
  getOrganizationRedesignModules,
  resolveRedesignScreen,
} from '../organizationRedesignNav';

const legacyScreenIds = ORGANIZATION_MODULES.flatMap((module) =>
  module.children.map((child) => child.id)
);
const redesignScreenIds = ORGANIZATION_REDESIGN_MODULES.flatMap((module) =>
  module.children.map((child) => child.id)
);

describe('Organization redesign navigation (21 → 11)', () => {
  it('keeps the frozen six-module hierarchy, in the same order', () => {
    expect(ORGANIZATION_REDESIGN_MODULES.map((module) => module.id)).toEqual(
      ORGANIZATION_MODULES.map((module) => module.id)
    );
  });

  it('exposes exactly eleven screens', () => {
    expect(ORGANIZATION_REDESIGN_SCREEN_COUNT).toBe(11);
    expect(redesignScreenIds).toHaveLength(11);
    expect(new Set(redesignScreenIds).size).toBe(11);
  });

  it('reuses canonical screen ids, so routes need no migration', () => {
    for (const id of redesignScreenIds) expect(legacyScreenIds).toContain(id);
  });

  it('routes every absorbed screen to the screen that took over its content', () => {
    for (const [absorbed, host] of Object.entries(REDESIGN_SCREEN_REDIRECTS)) {
      expect(redesignScreenIds).toContain(host);
      expect(redesignScreenIds).not.toContain(absorbed);
      expect(resolveRedesignScreen(absorbed as never)).toBe(host);
    }
  });

  it('leaves surviving screens untouched by the redirect map', () => {
    for (const id of redesignScreenIds) expect(resolveRedesignScreen(id)).toBe(id);
  });

  it('localizes labels without changing ids', () => {
    const english = getOrganizationRedesignModules('en');
    expect(english.flatMap((module) => module.children.map((child) => child.id))).toEqual(
      redesignScreenIds
    );
    expect(english[0].children[0].label).toBe('Identity & Operating Model');
    expect(getOrganizationRedesignModules('pl')[0].children[0].label).toBe(
      'Tożsamość i model działania'
    );
  });
});
