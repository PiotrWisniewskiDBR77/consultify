import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getAiIncidents } from '../../../services/adminAiIncidentsApi';
import { AdminAiIncidentsPanel } from '../AdminAiIncidentsPanel';
vi.mock('../../../services/adminAiIncidentsApi', () => ({ getAiIncidents: vi.fn() }));
describe('AdminAiIncidentsPanel', () => {
  it('renders calculated incidents with disclosure', async () => {
    vi.mocked(getAiIncidents).mockResolvedValue([
      {
        start: '2026-08-24T10:00:00Z',
        durationMs: 60000,
        samples: 2,
        lastError: 'timeout',
        source: 'llm_health_events',
      },
    ]);
    render(<AdminAiIncidentsPanel />);
    expect(await screen.findByText('timeout')).toBeInTheDocument();
    expect(
      screen.getByText(/trwały rejestr historyczny nie jest jeszcze prowadzony/)
    ).toBeInTheDocument();
  });
  it('treats no incidents as good news', async () => {
    vi.mocked(getAiIncidents).mockResolvedValue([]);
    render(<AdminAiIncidentsPanel />);
    expect(await screen.findByText(/Brak incydentów w bieżącym oknie/)).toBeInTheDocument();
  });
});
