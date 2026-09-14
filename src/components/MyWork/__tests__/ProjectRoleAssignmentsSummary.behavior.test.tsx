import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createRealT } from '@/test-utils/realTranslations';

import { ProjectRoleAssignmentsSummary } from '../ProjectRoleAssignmentsSummary';

const translate = createRealT('pl');
const label = (roleKey: string) => translate(`myWork.projects.roles.${roleKey}`);
const memberLabel = (member: { firstName?: string; lastName?: string }) =>
  [member.firstName, member.lastName].filter(Boolean).join(' ');

describe('F2-3 E2 project role assignments production API behavior', () => {
  it('groups projectRole from the real API shape and follows a persisted role edit', () => {
    const apiMembers = [
      {
        id: 'pm-anna',
        userId: 'user-anna',
        firstName: 'Anna',
        lastName: 'Sponsor',
        projectRole: 'PROJECT_SPONSOR',
        allocationPercent: 40,
      },
      {
        id: 'pm-jan',
        userId: 'user-jan',
        firstName: 'Jan',
        lastName: 'Kowalski',
        projectRole: 'TASK_ASSIGNEE',
        allocationPercent: 60,
      },
    ];
    const { rerender } = render(
      <ProjectRoleAssignmentsSummary members={apiMembers} roleLabel={label} memberLabel={memberLabel} />
    );

    const assignments = screen.getByTestId('pmo-role-assignments');
    expect(within(assignments).getByText('Sponsor projektu')).toBeInTheDocument();
    expect(within(assignments).getByText('Członek zespołu')).toBeInTheDocument();
    expect(assignments).toHaveTextContent('Anna Sponsor');
    expect(assignments).toHaveTextContent('Jan Kowalski');
    expect(assignments).not.toHaveTextContent('MEMBER');

    rerender(
      <ProjectRoleAssignmentsSummary
        members={apiMembers.map((member) =>
          member.id === 'pm-jan'
            ? { ...member, projectRole: 'PROJECT_LEADER', allocationPercent: 75 }
            : member
        )}
        roleLabel={label}
        memberLabel={memberLabel}
      />
    );

    expect(within(assignments).getByText('Sponsor projektu')).toBeInTheDocument();
    expect(within(assignments).getByText('Kierownik projektu')).toBeInTheDocument();
    expect(within(assignments).queryByText('Członek zespołu')).not.toBeInTheDocument();
    expect(assignments).not.toHaveTextContent('MEMBER');
  });
});
