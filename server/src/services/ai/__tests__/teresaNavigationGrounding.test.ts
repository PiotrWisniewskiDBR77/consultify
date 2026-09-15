import { describe, expect, it, vi } from 'vitest';

import { buildTeresaNavigationGrounding } from '../teresaNavigationGrounding.js';

const ORG = 'org-navigation-test';

describe('Teresa navigation grounding — P-T13 variant B', () => {
  it('does not name modules hidden by role, organization or runtime flag', async () => {
    const queryFn = vi.fn(async () => [
      { flag_key: 'MODULE_AUDITS', enabled: false },
    ]);
    const out = await buildTeresaNavigationGrounding({
      organizationId: ORG,
      userRole: 'MEMBER',
      language: 'en',
      runtimeFlags: { VITE_MODULE_MEETINGS: false },
      queryFn,
    });

    expect(out).not.toBeNull();
    expect(out?.items.some((item) => item.id === 'ADMIN')).toBe(false);
    expect(out?.items.some((item) => item.id === 'MODULE_AUDITS')).toBe(false);
    expect(out?.items.some((item) => item.id === 'MODULE_MEETING')).toBe(false);
    expect(out?.systemInstructionAddon).not.toContain('Administration');
    expect(out?.systemInstructionAddon).not.toContain('Audits');
    expect(out?.systemInstructionAddon).not.toContain('Meetings');
    expect(out?.excluded).toEqual(expect.arrayContaining([
      { id: 'ADMIN', reason: 'role_required' },
      { id: 'MODULE_AUDITS', reason: 'organization_flag_off' },
      { id: 'MODULE_MEETING', reason: 'runtime_flag_off' },
    ]));
    expect(queryFn).toHaveBeenCalledWith(expect.stringContaining('organization_id = ?'), [ORG]);
  });

  it('gives an English click path only for an available admin module', async () => {
    const out = await buildTeresaNavigationGrounding({
      organizationId: ORG,
      userRole: 'ADMIN',
      language: 'en-US',
      runtimeFlags: { VITE_MODULE_MEETINGS: true, VITE_PMO_PROJECTS: true },
      queryFn: vi.fn(async () => [{ flag_key: 'MODULE_AUDITS', enabled: true }]),
    });

    expect(out?.systemInstructionAddon).toContain('Administration: Administration (/admin)');
    expect(out?.systemInstructionAddon).toContain('Meetings: Meetings (/meetings)');
    expect(out?.systemInstructionAddon).toContain('Finance: Finance (/finance) — planned, not available yet');
    expect(out?.systemInstructionAddon).toContain('Do not claim that you open the screen');
  });

  it('localizes safe labels, click paths and unavailability reason to Polish', async () => {
    const out = await buildTeresaNavigationGrounding({
      organizationId: ORG,
      userRole: 'OWNER',
      language: 'pl-PL',
      runtimeFlags: { VITE_MODULE_MEETINGS: true, VITE_PMO_PROJECTS: true },
      queryFn: vi.fn(async () => []),
    });

    expect(out?.systemInstructionAddon).toContain('NAWIGACJA DOSTĘPNA UŻYTKOWNIKOWI');
    expect(out?.systemInstructionAddon).toContain('Administracja: Administracja (/admin)');
    expect(out?.systemInstructionAddon).toContain('Projekty: Moja praca → Projekty (/projects)');
    expect(out?.systemInstructionAddon).toContain('Finanse: Finanse (/finance) — planowane, jeszcze niedostępne');
  });

  it('fails closed without an organization', async () => {
    expect(await buildTeresaNavigationGrounding({ organizationId: '' })).toBeNull();
  });

  it.each([
    ['en', 'Projects', 'My Work → Projects'],
    ['pl', 'Projekty', 'Moja praca → Projekty'],
  ] as const)('hides Projects label, click path and route when its runtime flag is OFF in %s', async (language, label, clickPath) => {
    const out = await buildTeresaNavigationGrounding({
      organizationId: ORG,
      userRole: 'MEMBER',
      language,
      runtimeFlags: { VITE_MODULE_MEETINGS: false, VITE_PMO_PROJECTS: false },
      queryFn: vi.fn(async () => []),
    });

    expect(out?.items.some((item) => item.id === 'PROJECTS')).toBe(false);
    expect(out?.excluded).toContainEqual({ id: 'PROJECTS', reason: 'runtime_flag_off' });
    expect(out?.systemInstructionAddon).not.toContain(label);
    expect(out?.systemInstructionAddon).not.toContain(clickPath);
    expect(out?.systemInstructionAddon).not.toContain('/projects');
  });

  it.each([
    ['en', 'Projects: My Work → Projects (/projects)'],
    ['pl', 'Projekty: Moja praca → Projekty (/projects)'],
  ] as const)('shows Projects according to the UI route gate when its server runtime flag is ON in %s', async (language, expectedLine) => {
    const out = await buildTeresaNavigationGrounding({
      organizationId: ORG,
      userRole: 'MEMBER',
      language,
      runtimeFlags: { VITE_MODULE_MEETINGS: false, VITE_PMO_PROJECTS: true },
      queryFn: vi.fn(async () => []),
    });

    expect(out?.items).toContainEqual(expect.objectContaining({ id: 'PROJECTS', route: '/projects' }));
    expect(out?.systemInstructionAddon).toContain(expectedLine);
  });

  it.each([
    ['en', ['Audits', 'Results', 'Finance', 'Materials', 'Meetings']],
    ['pl', ['Audyty', 'Wyniki', 'Finanse', 'Materiały', 'Spotkania']],
  ] as const)('fails closed for organization-gated navigation when flag lookup faults in %s', async (language, hiddenLabels) => {
    const out = await buildTeresaNavigationGrounding({
      organizationId: ORG,
      userRole: 'ADMIN',
      language,
      runtimeFlags: { VITE_MODULE_MEETINGS: true },
      queryFn: vi.fn(async () => {
        throw new Error('feature_flags unavailable');
      }),
    });

    const organizationGatedIds = [
      'MODULE_AUDITS',
      'MODULE_BENEFITS',
      'MODULE_ECONOMICS',
      'MODULE_PRESENTATIONS',
      'MODULE_MEETING',
    ];
    expect(out?.items.filter((item) => organizationGatedIds.includes(item.id))).toEqual([]);
    expect(out?.excluded).toEqual(expect.arrayContaining(
      organizationGatedIds.map((id) => ({ id, reason: 'organization_flag_unverified' }))
    ));
    for (const label of hiddenLabels) {
      expect(out?.systemInstructionAddon).not.toContain(label);
    }
    for (const route of ['/audit-programs', '/results', '/finance', '/presentations', '/meetings']) {
      expect(out?.systemInstructionAddon).not.toContain(route);
    }
  });
});
