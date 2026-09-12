// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BetaGate } from '../../ProtectedRoute';
import { getMenuStructure } from '../../navigation/Sidebar/menuConfig';
import { declutterMenu, lockClosedBetaModules } from '../../../utils/betaAccess';
import { BETA_MENU_STATUS } from '../../../utils/betaMenuStatus';
import { isPilotAllowedMenuId, isPilotAllowedPath } from '../../../utils/pilotAccess';
import { lockMainMenuForPublicProduction } from '../../../utils/publicProduction';
vi.unmock('react-router-dom');
const state = vi.hoisted(() => ({ currentUser: { role: 'OWNER', isAuthenticated: true } }));
vi.mock('../../../store/useAppStore', () => ({ useAppStore: () => state }));
afterEach(cleanup);
describe('DEC-470 finance announcement', () => {
  for (const role of ['OWNER', 'ADMIN', 'USER', 'MEMBER']) {
    it(`${role} sees announcement without mounting finance`, () => {
      state.currentUser = { role, isAuthenticated: true };
      const mount = vi.fn(() => <div>FINANCE_ENGINE</div>);
      render(
        <MemoryRouter>
          <BetaGate moduleId="MODULE_ECONOMICS">{React.createElement(mount)}</BetaGate>
        </MemoryRouter>
      );
      expect(screen.getByRole('heading', { name: 'Finance — Coming soon' })).toBeInTheDocument();
      expect(mount).not.toHaveBeenCalled();
    });
    it(`${role} has visible unlocked announcement across menu gates`, () => {
      const raw = getMenuStructure((_key, fallback) => fallback || _key);
      const publicMenu = lockMainMenuForPublicProduction(raw, true, 'locked', '/chat');
      const menu = declutterMenu(lockClosedBetaModules(publicMenu, role, 'locked'));
      const finance = menu.find((i) => i.id === 'MODULE_ECONOMICS');
      expect(finance).toMatchObject({ badge: 'soon' });
      expect(finance?.isLocked).not.toBe(true);
      expect(isPilotAllowedMenuId('MODULE_ECONOMICS')).toBe(true);
    });
  }
  it('preserves backend beta closed and meeting default hiding', () => {
    expect(BETA_MENU_STATUS.MODULE_ECONOMICS).toBe('closed');
    expect(getMenuStructure((k) => k).find((i) => i.id === 'MODULE_MEETING')).toBeUndefined();
  });
  it('allows canonical and legacy finance deep links through pilot routing only', () => {
    for (const path of [
      '/finance',
      '/finance/statements/x',
      '/finance/models/x',
      '/finance/analyses/x',
      '/finance/predictions/x',
      '/finance/valuations/x',
      '/finance/unknown/x',
      '/economics',
      '/economics/legacy',
    ])
      expect(isPilotAllowedPath(path)).toBe(true);
    expect(isPilotAllowedPath('/finance-secrets')).toBe(false);
  });
  it('unauthenticated caller mounts no finance or announcement', () => {
    state.currentUser = { role: 'USER', isAuthenticated: false };
    render(
      <MemoryRouter>
        <BetaGate moduleId="MODULE_ECONOMICS">
          <div>FINANCE_ENGINE</div>
        </BetaGate>
      </MemoryRouter>
    );
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByText('FINANCE_ENGINE')).toBeNull();
  });
});
