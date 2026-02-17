import { describe, expect, it } from 'vitest';

import {
  InitiativeStatus,
  MODULES,
  buildStatusFilterSQL,
  getModuleConfigForStatus,
  getModuleForStatus,
  getStatusesForModule,
  getToolsVisibleStatuses,
  isStatusInModule,
  willChangeModule,
} from '../../../../server/src/constants/initiativeStatuses.ts';

describe('initiativeStatuses: modules + visibility', () => {
  it('maps CANCELLED and ARCHIVED to initiatives module (historical fallback)', () => {
    expect(getModuleForStatus(InitiativeStatus.CANCELLED)).toBe('initiatives');
    expect(getModuleForStatus(InitiativeStatus.ARCHIVED)).toBe('initiatives');
  });

  it('maps DRAFT to the first matching module (tools)', () => {
    expect(getModuleForStatus(InitiativeStatus.DRAFT)).toBe('tools');
  });

  it('detects module changes across a transition', () => {
    expect(willChangeModule(InitiativeStatus.DRAFT, InitiativeStatus.PENDING_REVIEW)).toBe(false);
    expect(willChangeModule(InitiativeStatus.DRAFT, InitiativeStatus.REVIEW)).toBe(true);
  });

  it('exposes statuses per module and membership checks', () => {
    const tools = getStatusesForModule('tools');
    expect(tools).toEqual(MODULES.tools.statuses);
    expect(isStatusInModule(InitiativeStatus.DRAFT, 'tools')).toBe(true);
    expect(isStatusInModule(InitiativeStatus.EXECUTING, 'tools')).toBe(false);
  });

  it('builds SQL filter clause and params for module visibility', () => {
    const { clause, params } = buildStatusFilterSQL('tools', 'i.status');
    expect(clause).toContain('UPPER(i.status) IN (');
    expect(params).toEqual(getToolsVisibleStatuses());

    // Sanity: clause has the right number of placeholders.
    const qCount = (clause.match(/\?/g) || []).length;
    expect(qCount).toBe(params.length);

    // Module config should exist for known status.
    expect(getModuleConfigForStatus(InitiativeStatus.REVIEW)).toEqual(MODULES.initiatives);
  });
});
