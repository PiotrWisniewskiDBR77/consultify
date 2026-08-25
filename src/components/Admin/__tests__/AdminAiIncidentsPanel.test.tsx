import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { getAiIncidents } from '../../../services/adminAiIncidentsApi';
import { AdminAiIncidentsPanel } from '../AdminAiIncidentsPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

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
