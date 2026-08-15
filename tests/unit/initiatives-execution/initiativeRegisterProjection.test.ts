import { describe, expect, it } from 'vitest';

import {
  INITIATIVE_LIFECYCLE_PRESETS,
  lifecycleMatchesPreset,
  projectCanonicalInitiativeRegisterRow,
  toCanonicalInitiativeRegisterItem,
} from '../../../src/components/Initiatives/initiativeRegisterProjection';

const record = (overrides: Record<string, unknown> = {}) => ({
  version: 7,
  updatedAt: '2026-08-10T06:00:00.000Z',
  initiative: {
    initiativeId: 'initiative-1',
    lifecycleState: 'REGISTERED_DRAFT',
    title: 'Digital Performance Management',
    problem: 'Decisions use stale operating data.',
    proposedOutcome: null,
    projectId: 'project-1',
    initiativeOwnerId: 'owner-1',
    readiness: 'NOT_EVALUATED' as const,
    source: {
      proposalId: 'proposal-1',
      proposalVersion: 2,
      sourceType: 'assessment-finding',
      sourceId: 'finding-1',
      sourceVersion: 3,
      freshness: 'STALE' as const,
    },
    ...overrides,
  },
});

describe('canonical Initiative register projection', () => {
  it('keeps unknown business facts literal and derives only the governed next step', () => {
    const row = projectCanonicalInitiativeRegisterRow(record());

    expect(row).toMatchObject({
      id: 'initiative-1',
      canonicalVersion: 7,
      lifecycle: 'REGISTERED_DRAFT',
      lifecycleLabel: 'Szkic zarejestrowany',
      gateName: 'Definition',
      gateReadiness: 'NOT_EVALUATED',
      ownerId: 'owner-1',
      nextAction: 'Uzupełnij definicję',
      expectedImpact: 'UNKNOWN',
      impactConfidence: 'UNKNOWN',
      plannedWindow: null,
      healthState: 'N/A',
      sourceFreshness: 'STALE',
    });
  });

  it('covers the complete business lifecycle with stable mutually exclusive presets', () => {
    const states = INITIATIVE_LIFECYCLE_PRESETS.flatMap((preset) => preset.states);
    expect(new Set(states).size).toBe(states.length);
    expect(lifecycleMatchesPreset('READY_FOR_DECISION', 'DECISION')).toBe(true);
    expect(lifecycleMatchesPreset('READY_FOR_DECISION', 'PREPARATION')).toBe(false);
    expect(lifecycleMatchesPreset('ARCHIVED', 'HISTORICAL')).toBe(true);
    expect(lifecycleMatchesPreset('IN_EXECUTION', null)).toBe(true);
  });

  it('never derives a healthy state or a schedule window from missing data', () => {
    const row = projectCanonicalInitiativeRegisterRow(
      record({ lifecycleState: 'IN_EXECUTION', readiness: 'NOT_EVALUATED' })
    );
    expect(row.healthState).toBe('UNKNOWN');
    expect(row.plannedWindow).toBeNull();
    expect(row.nextAction).toBe('Monitoruj realizację');
  });

  it('keeps freshness UNKNOWN when a legacy read model has no source lineage object', () => {
    const row = projectCanonicalInitiativeRegisterRow(record({ source: undefined }) as any);
    expect(row.sourceFreshness).toBe('UNKNOWN');
    const item = toCanonicalInitiativeRegisterItem(record({ source: undefined }) as any);
    expect(item.sourceId).toBeUndefined();
    expect(item.sourceType).toBeUndefined();
  });

  it('renders a recognizable owner label instead of exposing a raw principal identifier', () => {
    const currentOwner = toCanonicalInitiativeRegisterItem(
      record({ initiativeOwnerId: 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2' }) as any,
      { id: 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2', displayName: 'Piotr Wiśniewski' }
    );
    const namedRole = toCanonicalInitiativeRegisterItem(
      record({ initiativeOwnerId: 'operations-owner' }) as any
    );

    expect(currentOwner.ownerBusiness).toMatchObject({
      id: 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2',
      firstName: 'Piotr Wiśniewski',
    });
    expect(namedRole.ownerBusiness?.firstName).toBe('Operations Owner');
  });
});
