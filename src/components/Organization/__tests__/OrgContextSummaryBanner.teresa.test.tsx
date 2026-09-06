/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openChatWithContext = vi.fn();
vi.mock('@/hooks/useOpenChatWithContext', () => ({ useOpenChatWithContext: () => openChatWithContext }));
vi.mock('@/services/api', () => ({ Api: { organizationContextGet: vi.fn().mockResolvedValue({ counts: { claims: 2 } }) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }) }));

import { OrgContextSummaryBanner } from '../OrgContextSummaryBanner';

describe('OrgContextSummaryBanner Teresa action', () => {
  beforeEach(() => openChatWithContext.mockClear());

  it('opens the shared chat with organizationId', async () => {
    render(<OrgContextSummaryBanner organizationId="org-p8" />);
    const button = await screen.findByRole('button', { name: /Teresa.*organization context/i });
    fireEvent.click(button);
    await waitFor(() => expect(openChatWithContext).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'organization', entityId: 'org-p8' })));
  });
});
