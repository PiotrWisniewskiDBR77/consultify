import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AdminAccessRequestsPanel } from '../AdminAccessRequestsPanel';

const renderPanel = () =>
  render(
    <MemoryRouter>
      <AdminAccessRequestsPanel />
    </MemoryRouter>
  );

describe('AdminAccessRequestsPanel', () => {
  it('states honestly that tenant access requests are unavailable', () => {
    renderPanel();
    expect(
      screen.getByText(/Wnioski o dostęp do tej organizacji nie są jeszcze obsługiwane/)
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('labels the future workflow as a plan and describes tenant membership', () => {
    renderPanel();
    expect(screen.getByText('Planowany przepływ')).toBeInTheDocument();
    expect(screen.getByText(/aktywne członkostwo w istniejącej organizacji/)).toBeInTheDocument();
    expect(screen.getByText(/Audyt zapisuje osobę decydującą/)).toBeInTheDocument();
  });
  it('links only to working tenant alternatives', () => {
    renderPanel();
    expect(screen.getByRole('link', { name: /Wyślij zaproszenie/ })).toHaveAttribute(
      'href',
      '/admin/team/invitations'
    );
    expect(
      screen.getByRole('link', { name: /Zarządzaj zweryfikowanymi domenami/ })
    ).toHaveAttribute('href', '/admin/security/domains');
  });
});
