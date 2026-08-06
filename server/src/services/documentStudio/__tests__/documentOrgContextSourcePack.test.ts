/**
 * Document Studio — auto org-context grounding (P0 URODZINOWE, 2026-07-27).
 *
 * Covers `documentOrgContextSourcePack.ts`:
 *   - `buildOrgContextSourcePack` — reuses `AIContextBuilder._buildOrganizationContext`
 *     for org name/industry + two small org-scoped SQL reads (active
 *     projects/initiatives) to assemble a minimal grounding pack.
 *   - `applyOrgContextGrounding` — the pure merge rule: only auto-grounds
 *     when the caller sent NO sourceRefs; an explicit source pack always
 *     wins; fail-open (no pack -> request unchanged).
 *
 * These tests are the "proof it works" requested for the P0 fix: a
 * generation call with an empty org gets no grounding (no regression), a
 * generation call for an org with real projects/initiatives gets a
 * sourceRef + a PL summary that actually contains those facts (not just a
 * pointer nothing reads).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAllMock = vi.fn();
const buildOrganizationContextMock = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAllMock(...args),
}));

vi.mock('../../aiContextBuilder.js', () => ({
  default: {
    _buildOrganizationContext: (...args: unknown[]) => buildOrganizationContextMock(...args),
  },
}));

import {
  applyOrgContextGrounding,
  buildOrgContextSourcePack,
} from '../documentOrgContextSourcePack.js';
import type { DocumentIntake, DocumentSourceRef } from '../documentStudioTypes.js';

function baseIntake(overrides: Partial<DocumentIntake> = {}): DocumentIntake {
  return {
    description: 'Przygotuj raport podsumowujący dla zarządu.',
    language: 'pl',
    density: 'standard',
    goal: 'inform',
    ...overrides,
  } as DocumentIntake;
}

describe('buildOrgContextSourcePack', () => {
  beforeEach(() => {
    dbAllMock.mockReset();
    buildOrganizationContextMock.mockReset();
  });

  it('returns null for organizationId falsy input without touching the DB', async () => {
    const result = await buildOrgContextSourcePack('');
    expect(result).toBeNull();
    expect(dbAllMock).not.toHaveBeenCalled();
    expect(buildOrganizationContextMock).not.toHaveBeenCalled();
  });

  it('returns null (no regression) for a brand-new organization with zero data', async () => {
    buildOrganizationContextMock.mockResolvedValue({ organizationName: 'Unknown', industry: null });
    dbAllMock.mockResolvedValue([]);

    const result = await buildOrgContextSourcePack('org-empty');
    expect(result).toBeNull();
  });

  it('builds a real pack with org name + active projects + active initiatives', async () => {
    buildOrganizationContextMock.mockResolvedValue({
      organizationName: 'DBR77',
      industry: 'Consulting',
    });
    dbAllMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects')) {
        return Promise.resolve([{ name: 'Transformacja AI 2026' }, { name: 'Program Vegas' }]);
      }
      if (sql.includes('FROM initiatives')) {
        return Promise.resolve([{ name: 'Automatyzacja raportowania' }]);
      }
      return Promise.resolve([]);
    });

    const pack = await buildOrgContextSourcePack('org-dbr77');

    expect(pack).not.toBeNull();
    expect(pack?.organizationName).toBe('DBR77');
    expect(pack?.activeProjectNames).toEqual(['Transformacja AI 2026', 'Program Vegas']);
    expect(pack?.activeInitiativeNames).toEqual(['Automatyzacja raportowania']);
    // The PL summary — this is what actually reaches the generation prompt —
    // must literally contain the org's real facts, not just a reference id.
    expect(pack?.contextSummaryPl).toContain('DBR77');
    expect(pack?.contextSummaryPl).toContain('Consulting');
    expect(pack?.contextSummaryPl).toContain('Transformacja AI 2026');
    expect(pack?.contextSummaryPl).toContain('Program Vegas');
    expect(pack?.contextSummaryPl).toContain('Automatyzacja raportowania');
    expect(pack?.sourceRef.sourceType).toBe('organization_context');
    expect(pack?.sourceRef.sourceTitle).toContain('DBR77');
  });

  it('degrades to a name-only pack when the org has no projects/initiatives yet', async () => {
    buildOrganizationContextMock.mockResolvedValue({
      organizationName: 'Acme Sp. z o.o.',
      industry: null,
    });
    dbAllMock.mockResolvedValue([]);

    const pack = await buildOrgContextSourcePack('org-acme');
    expect(pack).not.toBeNull();
    expect(pack?.contextSummaryPl).toContain('Acme Sp. z o.o.');
    expect(pack?.activeProjectNames).toEqual([]);
    expect(pack?.activeInitiativeNames).toEqual([]);
  });

  it('fails open (returns null, never throws) when the org-context lookup itself throws', async () => {
    buildOrganizationContextMock.mockRejectedValue(new Error('db offline'));
    dbAllMock.mockRejectedValue(new Error('db offline'));

    await expect(buildOrgContextSourcePack('org-broken')).resolves.toBeNull();
  });

  it('fails open when only the projects/initiatives queries throw but org lookup succeeds', async () => {
    buildOrganizationContextMock.mockResolvedValue({ organizationName: 'DBR77', industry: null });
    dbAllMock.mockRejectedValue(new Error('table locked'));

    const pack = await buildOrgContextSourcePack('org-dbr77');
    expect(pack).not.toBeNull();
    expect(pack?.activeProjectNames).toEqual([]);
    expect(pack?.activeInitiativeNames).toEqual([]);
    expect(pack?.contextSummaryPl).toContain('DBR77');
  });
});

describe('applyOrgContextGrounding', () => {
  const samplePack = {
    sourceRef: {
      sourceType: 'organization_context',
      sourceId: 'org-context-org-dbr77',
      sourceTitle: 'Kontekst organizacji: DBR77',
    } as DocumentSourceRef,
    contextSummaryPl: 'Organizacja: DBR77. Aktywne projekty (1): Transformacja AI 2026.',
    organizationName: 'DBR77',
    activeProjectNames: ['Transformacja AI 2026'],
    activeInitiativeNames: [],
  };

  it('auto-grounds when the caller sent no sourceRefs and a pack is available', () => {
    const intake = baseIntake();
    const result = applyOrgContextGrounding(intake, [], samplePack);

    expect(result.autoGrounded).toBe(true);
    expect(result.sourceRefs).toEqual([samplePack.sourceRef]);
    expect(result.intake.description).toContain(samplePack.contextSummaryPl);
    expect(result.intake.description).toContain(intake.description);
  });

  it('never mixes auto-grounding with an explicit, caller-supplied source pack', () => {
    const intake = baseIntake();
    const explicitRef: DocumentSourceRef = {
      sourceType: 'text',
      sourceId: 'curator-picked-1',
      sourceTitle: 'Consultant-attached evidence',
    };
    const result = applyOrgContextGrounding(intake, [explicitRef], samplePack);

    expect(result.autoGrounded).toBe(false);
    expect(result.sourceRefs).toEqual([explicitRef]);
    expect(result.intake).toBe(intake);
  });

  it('does not mix broad org context into an explicit quantitative user brief', () => {
    const intake = baseIntake({
      description: '72% realizacji planu, budżet 1,4 mln EUR i ukończono 18 z 21 kamieni milowych.',
    });
    const result = applyOrgContextGrounding(intake, [], samplePack);
    expect(result.autoGrounded).toBe(false);
    expect(result.intake).toBe(intake);
    expect(result.intake.description).not.toContain(samplePack.contextSummaryPl);
    expect(result.sourceRefs).toEqual([
      expect.objectContaining({ sourceType: 'intake', sourceId: 'explicit-user-brief' }),
    ]);
  });

  it('is a no-op (fail-open) when no pack is available, e.g. brand-new organization', () => {
    const intake = baseIntake();
    const result = applyOrgContextGrounding(intake, [], null);

    expect(result.autoGrounded).toBe(false);
    expect(result.sourceRefs).toEqual([]);
    expect(result.intake).toBe(intake);
  });

  it('handles an empty intake description without producing a stray leading blank line join', () => {
    const intake = baseIntake({ description: '' });
    const result = applyOrgContextGrounding(intake, [], samplePack);
    expect(result.intake.description).toBe(samplePack.contextSummaryPl);
  });
});
