import { describe, expect, it } from 'vitest';

import { AppView } from '../../../../types';
import { APP_VIEW_TO_ROUTE, ROUTES } from '../../../../routes/routeConfig';
import { getMenuStructure } from '../menuConfig';

const identityT = (key: string, fallback?: string) => fallback ?? key;

/**
 * DEC-2026-08-24-01 (OWNER_DECISION_LEDGER_2026-08-24.md): the sidebar
 * "Interview" entry must resolve to the canonical /interview address, not the
 * legacy /discovery alias.
 */
describe('Sidebar menu Interview entry (DEC-2026-08-24-01)', () => {
  it('points the INTERVIEW menu item at AppView.INTERVIEW', () => {
    const menu = getMenuStructure(identityT as any);
    const interviewItem = menu.find((item) => item.id === 'INTERVIEW');
    expect(interviewItem).toBeDefined();
    expect(interviewItem?.viewId).toBe(AppView.INTERVIEW);
  });

  it('resolves that viewId to the canonical /interview route', () => {
    const menu = getMenuStructure(identityT as any);
    const interviewItem = menu.find((item) => item.id === 'INTERVIEW');
    expect(interviewItem).toBeDefined();
    const route = APP_VIEW_TO_ROUTE[interviewItem!.viewId];
    expect(route).toBe(ROUTES.INTERVIEW);
    expect(route).toBe('/interview');
  });
});
