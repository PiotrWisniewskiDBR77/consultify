import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createRealT } from '@/test-utils/realTranslations';

import { ProjectRolePermissionCopy } from '../ProjectRolePermissionCopy';

const permissions = [
  'manage-delivery',
  'approve-own-business-case',
  'resolve-escalations',
  'raise-blockers',
];
const roles = [
  'PROJECT_SPONSOR',
  'PROJECT_LEADER',
  'STEERING_COMMITTEE',
  'WORKSTREAM_OWNER',
  'TASK_ASSIGNEE',
];
const approvalRoles = ['BUSINESS_AUTHORITY', 'GATE_AUTHORITY', 'DOMAIN_AUTHORITY'];

function OperatingModelLanguageSurface({ language }: { language: 'en' | 'pl' }) {
  const translate = createRealT(language);
  return (
    <section>
      <select aria-label="role-selector">
        {roles.map((role) => (
          <option key={role}>{translate(`myWork.projects.roles.${role}`)}</option>
        ))}
      </select>
      <div data-testid="assignments">
        {roles.map((role) => (
          <span key={role}>{translate(`myWork.projects.roles.${role}`)}</span>
        ))}
      </div>
      <div data-testid="responsibilities">
        {permissions.map((permission) => (
          <span key={permission}>{translate(`myWork.projects.permissions.${permission}`)}</span>
        ))}
      </div>
      <div data-testid="approval-inputs">
        {approvalRoles.map((role) => (
          <span key={role}>{translate(`myWork.projects.approvalRoles.${role}`)}</span>
        ))}
      </div>
    </section>
  );
}

describe('F2-3 E2 role permission localized behavior', () => {
  for (const language of ['en', 'pl'] as const) {
    it(`renders human permission copy without raw slugs in ${language}`, () => {
      const translate = createRealT(language);
      const { container } = render(
        <ProjectRolePermissionCopy
          can={permissions.slice(0, 2)}
          cannot={permissions.slice(2)}
          translate={translate}
        />
      );

      for (const permission of permissions) expect(container.textContent).not.toContain(permission);
      expect(screen.getByText(language === 'pl' ? /Może:/ : /Can:/)).toBeInTheDocument();
    });

    it(`renders selectors, assignments, responsibilities and approval inputs without technical identifiers in ${language}`, () => {
      const { container } = render(<OperatingModelLanguageSurface language={language} />);
      for (const raw of [...roles, ...permissions, ...approvalRoles]) {
        expect(container.textContent).not.toContain(raw);
      }
      expect(screen.getByRole('option', { name: language === 'pl' ? 'Sponsor projektu' : 'Project sponsor' })).toBeInTheDocument();
      expect(screen.getByTestId('approval-inputs')).toHaveTextContent(
        language === 'pl' ? 'Osoba zatwierdzająca bramkę' : 'Stage-gate approver'
      );
    });
  }
});
