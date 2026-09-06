import { describe, expect, it } from 'vitest';
import { InitiativeStatus, MODULES, buildStatusFilterSQL, getModuleConfigForStatus, getModuleForStatus, getStatusesForModule, getToolsVisibleStatuses, isStatusInModule, willChangeModule } from '../../../../server/src/constants/initiativeStatuses.ts';

describe('initiativeStatuses: DEC-424 modules + visibility', () => {
  it('maps the canonical execution and benefits boundaries', () => {
    expect(getModuleForStatus(InitiativeStatus.DRAFT)).toBe('initiatives');
    expect(getModuleForStatus(InitiativeStatus.IN_EXECUTION)).toBe('execution');
    expect(getModuleForStatus(InitiativeStatus.CLOSED)).toBe('benefits');
  });
  it('detects module changes across canonical transitions', () => {
    expect(willChangeModule(InitiativeStatus.DRAFT, InitiativeStatus.PENDING_APPROVAL)).toBe(false);
    expect(willChangeModule(InitiativeStatus.APPROVED, InitiativeStatus.IN_EXECUTION)).toBe(true);
  });
  it('exposes statuses per module and membership checks', () => {
    expect(getStatusesForModule('tools')).toEqual(MODULES.tools.statuses);
    expect(isStatusInModule(InitiativeStatus.DRAFT, 'tools')).toBe(true);
    expect(isStatusInModule(InitiativeStatus.IN_EXECUTION, 'tools')).toBe(false);
  });
  it('builds the SQL filter from canonical visibility', () => {
    const { sql, params } = buildStatusFilterSQL(getToolsVisibleStatuses(), 'i');
    expect(sql).toContain('i.status IN (');
    expect(params).toEqual(getToolsVisibleStatuses());
    expect((sql.match(/\?/g) || []).length).toBe(params.length);
    expect(getModuleConfigForStatus(InitiativeStatus.IN_EXECUTION)).toEqual(MODULES.execution);
  });
});
