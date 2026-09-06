/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({ Api: { organizationContextGet: vi.fn().mockResolvedValue({ counts: { claims: 2 } }) } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }) }));

import { OrgContextSummaryBanner } from '../OrgContextSummaryBanner';

// DEC-419: Teresa ma jedno wejście — Menu 1. Panele/banery nie mogą mieć
// własnych „Zapytaj Teresę o …”. Ten test broni braku takiego przycisku
// w OrgContextSummaryBanner (dawniej: `askTeresa` otwierał czat inline).
describe('OrgContextSummaryBanner — DEC-419 (bez "Zapytaj Teresę o …")', () => {
  beforeEach(() => vi.clearAllMocks());

  it('nie renderuje przycisku "Zapytaj Teresę o kontekst organizacji"', async () => {
    render(<OrgContextSummaryBanner organizationId="org-p8" />);
    await waitFor(() => expect(screen.getByText(/Teresa context:/i)).toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: /Teresa.*organization context/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Zapytaj Teresę/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ask Teresa about/i)).not.toBeInTheDocument();
  });
});
