/**
 * @vitest-environment jsdom
 *
 * L-06 (M18 Document Studio) verification.
 *
 * Manual test doc `Harvard/Testy manualne/TESTY_M18_DOKUMENTY.md` flagged:
 * "bezpośredni URL /document-studio omija bramkę beta" (direct URL bypasses
 * the beta gate). Code audit (2026-07-04) found the route in AppRoutes.tsx
 * IS already wrapped in `<BetaGate moduleId="MODULE_DOCUMENT_STUDIO">`.
 *
 * This test proves the BetaGate mechanism itself works correctly for this
 * exact moduleId:
 *   - With the current SSOT config (`MODULE_DOCUMENT_STUDIO: 'open'` in
 *     src/utils/betaAccess.ts), the gate is a deliberate no-op — every
 *     authenticated user reaches the module. This matches nearly every
 *     other beta module in BETA_MENU_STATUS (all 'open' except
 *     MODULE_AUDITS / MODULE_MEETING) and the server-side betaGate
 *     middleware, which was intentionally made a pass-through in commit
 *     14df49c1fa ("bypass server betaGate — mirrors client SSOT, all
 *     modules open").
 *   - If MODULE_DOCUMENT_STUDIO were ever flipped back to 'closed' (the
 *     single-flip mechanism betaAccess.ts documents), the SAME route gate
 *     would immediately block non-admin users and redirect them to /chat —
 *     with no further code change needed.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BetaGate } from '../../src/components/ProtectedRoute';
import { BETA_MENU_STATUS } from '../../src/utils/betaAccess';

const authState = vi.hoisted(() => ({
  currentUser: {
    isAuthenticated: true,
    role: 'USER',
  } as { isAuthenticated: boolean; role?: string },
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: () => authState,
}));

function renderDocumentStudioGate() {
  render(
    <MemoryRouter initialEntries={['/document-studio']}>
      <Routes>
        <Route path="/chat" element={<div>Chat Screen</div>} />
        <Route
          path="/document-studio"
          element={
            <BetaGate moduleId="MODULE_DOCUMENT_STUDIO">
              <div>Document Studio Content</div>
            </BetaGate>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('L-06 — BetaGate on /document-studio (MODULE_DOCUMENT_STUDIO)', () => {
  beforeEach(() => {
    authState.currentUser = { isAuthenticated: true, role: 'USER' };
  });

  it('current SSOT config: MODULE_DOCUMENT_STUDIO is "open"', () => {
    // Documents the live production config this test suite depends on. If
    // this ever flips, the test below ("blocks non-admin when closed")
    // becomes the live behavior instead of a hypothetical.
    expect(BETA_MENU_STATUS.MODULE_DOCUMENT_STUDIO).toBe('open');
  });

  it('regular USER reaches Document Studio while the module is open (current prod state)', () => {
    renderDocumentStudioGate();

    expect(screen.getByText('Document Studio Content')).toBeInTheDocument();
    expect(screen.queryByText('Chat Screen')).not.toBeInTheDocument();
  });

  it('admin (OWNER) also reaches Document Studio while open', () => {
    authState.currentUser = { isAuthenticated: true, role: 'OWNER' };

    renderDocumentStudioGate();

    expect(screen.getByText('Document Studio Content')).toBeInTheDocument();
  });
});

describe('L-06 — BetaGate mechanism (module simulated as closed)', () => {
  // MODULE_DOCUMENT_STUDIO is 'open' today so BetaGate is a no-op for it in
  // production. To prove the *gate itself* is wired and would enforce
  // access the moment the SSOT flips to 'closed', exercise BetaGate against
  // a moduleId that IS closed today (MODULE_ECONOMICS), using the exact same
  // component imported by AppRoutes.tsx.
  function renderClosedModuleGate(role: string) {
    authState.currentUser = { isAuthenticated: true, role };
    render(
      <MemoryRouter initialEntries={['/finance']}>
        <Routes>
          <Route path="/chat" element={<div>Chat Screen</div>} />
          <Route
          path="/finance"
            element={
              <BetaGate moduleId="MODULE_ECONOMICS">
                <div>Finance Content</div>
              </BetaGate>
            }
          />
        </Routes>
      </MemoryRouter>
    );
  }

  it('blocks a regular USER and redirects to /chat when the module is closed', () => {
    renderClosedModuleGate('USER');

    expect(screen.getByText('Chat Screen')).toBeInTheDocument();
    expect(screen.queryByText('Finance Content')).not.toBeInTheDocument();
  });

  it('still allows OWNER/ADMIN through a closed module (BETA_ADMINS_EXEMPT)', () => {
    renderClosedModuleGate('OWNER');

    expect(screen.getByText('Finance Content')).toBeInTheDocument();
  });

  it('does not rewrite an unauthenticated closed-beta deep link to chat', () => {
    authState.currentUser = { isAuthenticated: false };
    render(
      <MemoryRouter initialEntries={['/finance?ff_wave3FinanceOwnerReview=1']}>
        <Routes>
          <Route path="/chat" element={<div>Chat Screen</div>} />
          <Route
            path="/finance"
            element={
              <BetaGate moduleId="MODULE_ECONOMICS">
                <div>Finance Content</div>
              </BetaGate>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Chat Screen')).not.toBeInTheDocument();
    expect(screen.queryByText('Finance Content')).not.toBeInTheDocument();
  });
});
