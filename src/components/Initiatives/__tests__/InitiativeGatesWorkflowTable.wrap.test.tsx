/**
 * H1 (plan row 31): the Gates workflow table must never clip its cells —
 * decision names, stage descriptions and approver labels wrap instead of
 * truncating, and carry a title tooltip with the full text.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const DECISION_LABEL = 'Submit for Review';
const INITIATIVE_NAME = 'Northwind packing line changeover';
const INITIATIVE_DESCRIPTION = 'scope';

const CTX = {
  initiative: { name: INITIATIVE_NAME, status: 'DRAFT' },
  initiativeId: 'init-1',
  isPolish: false,
  status: 'DRAFT',
  decisions: [],
  users: [],
  ownerId: 'u-owner',
  sponsorId: 'u-sponsor',
  summary: 'summary',
  description: INITIATIVE_DESCRIPTION,
  stakeholders: [],
  raidItems: [],
  tasks: [],
  isMutating: false,
  fetchAll: vi.fn(),
  onOpenDecision: vi.fn(),
  gateRoles: [],
  setGateRoles: vi.fn(),
  userGateRoles: [],
  statusHistory: [],
  gateReadiness: null,
};

vi.mock('../sections/InitiativeContext', () => ({
  useInitiativeContext: () => CTX,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import { InitiativeGatesWorkflowTable } from '../sections/InitiativeGatesWorkflowTable';

describe('InitiativeGatesWorkflowTable (H1, plan row 31)', () => {
  it('renders no truncated node inside the gates table', () => {
    const { container } = render(<InitiativeGatesWorkflowTable />);
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.querySelectorAll('.truncate')).toHaveLength(0);
  });

  it('shows the full gate decision name with a title tooltip', () => {
    render(<InitiativeGatesWorkflowTable />);
    const badge = screen.getByTitle(DECISION_LABEL);
    const label = within(badge).getByText(DECISION_LABEL);
    expect(label.className).toContain('break-words');
    expect(label.className).not.toMatch(/(^|\s)truncate(\s|$)/);
  });

  it('wraps stage descriptions and keeps the full text in a tooltip', () => {
    const { container } = render(<InitiativeGatesWorkflowTable />);
    const descriptions = [...container.querySelectorAll('td p[title]')];
    expect(descriptions.length).toBeGreaterThan(0);
    for (const p of descriptions) {
      expect(p.getAttribute('title')).toBe(p.textContent);
      expect(p.className).not.toMatch(/(^|\s)truncate(\s|$)/);
    }
  });

  it('gives the Status column enough width for the decision pill', () => {
    const { container } = render(<InitiativeGatesWorkflowTable />);
    const heads = [...container.querySelectorAll('thead th')];
    const statusHead = heads.find((h) => (h.textContent || '').trim() === 'Status');
    expect(statusHead?.className).toContain('w-[13%]');
  });

  it('keeps the Readiness column at its rebalanced w-[11%] width (D-30)', () => {
    const { container } = render(<InitiativeGatesWorkflowTable />);
    const heads = [...container.querySelectorAll('thead th')];
    const readinessHead = heads.find(
      (h) => (h.textContent || '').trim() === 'initiatives.initiativeGatesWorkflowTable.readiness'
    );
    expect(readinessHead, 'Readiness header not found').not.toBeUndefined();
    expect(readinessHead?.className).toContain('w-[11%]');
  });
});
