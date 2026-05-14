/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from '../../src/components/ProtectedRoute';

const authState = vi.hoisted(() => ({
  currentUser: {
    isAuthenticated: true,
    role: 'USER',
  } as { isAuthenticated: boolean; role?: string },
  isAuthInitializing: false,
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: () => authState,
}));

describe('ProtectedRoute triad role hierarchy', () => {
  beforeEach(() => {
    authState.currentUser = {
      isAuthenticated: true,
      role: 'USER',
    };
    authState.isAuthInitializing = false;
  });

  function renderProtectedRoute(requiredRole?: 'SUPERADMIN' | 'ADMIN' | 'USER') {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Screen</div>} />
          <Route path="/chat" element={<div>Chat Screen</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute requiredRole={requiredRole}>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
  }

  it('redirects unauthenticated users to login', () => {
    authState.currentUser = {
      isAuthenticated: false,
      role: 'USER',
    };

    renderProtectedRoute('USER');

    expect(screen.getByText('Login Screen')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('allows OWNER to access routes requiring ADMIN', () => {
    authState.currentUser = {
      isAuthenticated: true,
      role: 'OWNER',
    };

    renderProtectedRoute('ADMIN');

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('allows SUPERADMIN to access routes requiring ADMIN', () => {
    authState.currentUser = {
      isAuthenticated: true,
      role: 'SUPERADMIN',
    };

    renderProtectedRoute('ADMIN');

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects authenticated users without sufficient role to dashboard', () => {
    authState.currentUser = {
      isAuthenticated: true,
      role: 'USER',
    };

    renderProtectedRoute('ADMIN');

    expect(screen.getByText('Chat Screen')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('allows administrator alias for ADMIN routes', () => {
    authState.currentUser = {
      isAuthenticated: true,
      role: 'administrator',
    };

    renderProtectedRoute('ADMIN');

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('allows member alias for USER routes', () => {
    authState.currentUser = {
      isAuthenticated: true,
      role: 'MEMBER',
    };

    renderProtectedRoute('USER');

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
