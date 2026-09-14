import { describe, expect, it } from 'vitest';

import { CANONICAL_PMO_ROLES, deriveProjectOperatingModel } from '../projectOperatingModel.js';

describe('F2-3 E2 project operating model', () => {
  const notifications = {
    taskOverdue: true,
    decisionPending: true,
    weeklySummary: true,
  };

  it('uses the five PMBOK-lite roles selected by DEC-488 with explicit permissions', () => {
    expect(CANONICAL_PMO_ROLES.map((role) => role.key)).toEqual([
      'PROJECT_SPONSOR',
      'PROJECT_LEADER',
      'STEERING_COMMITTEE',
      'WORKSTREAM_OWNER',
      'TASK_ASSIGNEE',
    ]);
    expect(CANONICAL_PMO_ROLES.every((role) => role.can.length > 0 && role.cannot.length > 0)).toBe(
      true
    );
  });

  it('keeps capacity per person and derives responsibility, communication and acceptance inputs from project roles', () => {
    const model = deriveProjectOperatingModel({
      members: [
        { userId: 'sponsor-1', name: 'Sponsor', role: 'PROJECT_SPONSOR', allocationPercent: 20 },
        { userId: 'pm-1', name: 'Manager', role: 'PROJECT_MANAGER', allocationPercent: 80 },
        { userId: 'pmo-1', name: 'PMO', role: 'PMO', allocationPercent: 40 },
        { userId: 'board-1', name: 'Board', role: 'STEERING_COMMITTEE', allocationPercent: 10 },
        { userId: 'member-1', name: 'Member', role: 'TEAM_MEMBER', allocationPercent: 60 },
      ],
      notifications,
    });

    expect(model.capacity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'sponsor-1', allocationPercent: 20 }),
        expect.objectContaining({ userId: 'pm-1', allocationPercent: 80 }),
        expect.objectContaining({ userId: 'pmo-1', allocationPercent: 40 }),
        expect.objectContaining({ userId: 'board-1', allocationPercent: 10 }),
        expect.objectContaining({ userId: 'member-1', allocationPercent: 60 }),
      ])
    );
    expect(
      model.responsibilities.find((row) => row.roleKey === 'PROJECT_LEADER')?.decisionLevel
    ).toBe(2);
    expect(
      model.communication.find((row) => row.trigger === 'WEEKLY_SUMMARY')?.recipientIds
    ).toEqual(['board-1', 'member-1', 'pm-1', 'pmo-1', 'sponsor-1']);
    expect(model.approvalInputs.roleBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roleKey: 'BUSINESS_AUTHORITY',
          principalId: 'sponsor-1',
          projectRole: 'PROJECT_SPONSOR',
          stageGateDuty: 'REVIEWER',
        }),
        expect.objectContaining({
          roleKey: 'DOMAIN_AUTHORITY',
          principalId: 'board-1',
          projectRole: 'STEERING_COMMITTEE',
          stageGateDuty: 'REVIEWER',
        }),
        expect.objectContaining({
          roleKey: 'GATE_AUTHORITY',
          principalId: 'pm-1',
          projectRole: 'PROJECT_LEADER',
          stageGateDuty: 'EXECUTOR',
        }),
        expect.objectContaining({
          roleKey: 'GATE_AUTHORITY',
          principalId: 'pmo-1',
          projectRole: 'PMO',
          stageGateDuty: 'EXECUTOR',
        }),
      ])
    );
  });

  it('produces different approval inputs for different team compositions', () => {
    const first = deriveProjectOperatingModel({
      members: [{ userId: 'pm-a', name: 'A', role: 'PROJECT_LEADER', allocationPercent: 100 }],
      notifications,
    });
    const second = deriveProjectOperatingModel({
      members: [
        { userId: 'pm-b', name: 'B', role: 'PROJECT_LEADER', allocationPercent: 100 },
        {
          userId: 'committee-b',
          name: 'Committee',
          role: 'STEERING_COMMITTEE',
          allocationPercent: 10,
        },
      ],
      notifications,
    });
    expect(second.approvalInputs.roleBindings).not.toEqual(first.approvalInputs.roleBindings);
  });
});
