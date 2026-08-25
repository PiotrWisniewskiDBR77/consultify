import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getAdminSessions, revokeAdminSession } from '../../../services/adminSessionsApi';
import { AdminSessionsPanel } from '../AdminSessionsPanel';
vi.mock('../../../services/adminSessionsApi', () => ({
  getAdminSessions: vi.fn(),
  revokeAdminSession: vi.fn(),
}));
describe('AdminSessionsPanel', () => {
  it('confirms revoke and applies readback', async () => {
    vi.mocked(getAdminSessions).mockResolvedValue([
      { id: 's1', user_id: 'u1', user_email: 'owner@example.com', device_info: 'Safari' },
    ]);
    vi.mocked(revokeAdminSession).mockResolvedValue([]);
    render(<AdminSessionsPanel />);
    expect(await screen.findByText('owner@example.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /actions|akcje/i }));
    fireEvent.click(await screen.findByText('Unieważnij sesję'));
    fireEvent.click(screen.getByRole('button', { name: 'Unieważnij sesję' }));
    expect(revokeAdminSession).toHaveBeenCalledWith('s1');
  });
});
