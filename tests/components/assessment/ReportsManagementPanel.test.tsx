/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const apiGetMock = vi.fn();

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: vi.fn(),
    delete: vi.fn(),
  },
  getHeaders: () => ({ Authorization: 'Bearer test' }),
}));

/**
 * Lokalne nadpisanie globalnego mocka `react-i18next` z `tests/setup.ts`.
 *
 * Panel przeszedł na i18n (defekt 93-polski-ocena: cały ekran renderował się po
 * angielsku na `lang=pl`). Globalny mock zwraca SAM KLUCZ i interpoluje tylko
 * `{var}`, więc nie da się nim sprawdzić ani copy, ani wstrzykniętego `runId`.
 * Tutaj `t()` rozwiązuje klucze z prawdziwego `public/locales/en/translation.json`
 * i interpoluje `{{var}}` — dzięki temu test pilnuje JEDNOCZEŚNIE provenance
 * readbacku i tego, że klucze tłumaczeń faktycznie istnieją.
 */
vi.mock('react-i18next', async () => {
  const en = (await import('../../../public/locales/en/translation.json')).default as Record<
    string,
    unknown
  >;

  const lookup = (key: string): string | undefined => {
    const value = key
      .split('.')
      .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], en);
    return typeof value === 'string' ? value : undefined;
  };

  const t = (key: string, options?: Record<string, unknown>): string => {
    const template = lookup(key) ?? (options?.defaultValue as string) ?? key;
    if (!options) return template;
    return Object.entries(options).reduce(
      (acc, [name, value]) =>
        acc.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g'), String(value)),
      template
    );
  };

  return {
    useTranslation: () => ({ t, i18n: { language: 'en', changeLanguage: vi.fn() } }),
    Trans: ({ children }: { children?: unknown }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  };
});

import { ReportsManagementPanel } from '../../../src/components/assessment/manage/ReportsManagementPanel';

describe('ReportsManagementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows report provenance readback from the same assessment run', async () => {
    apiGetMock.mockResolvedValue({
      reports: [
        {
          id: 'rpt-1',
          title: 'DRD Executive Report',
          sourceName: 'Canonical DRD',
          status: 'APPROVED',
          createdAt: '2026-04-11T08:00:00.000Z',
          updatedAt: '2026-04-11T09:00:00.000Z',
          createdBy: 'user-1',
          createdByName: 'Ada Lovelace',
          initiativesCount: 2,
          config: {
            assessmentRunId: 'run-42',
            workbenchReviewState: 'accepted',
          },
        },
      ],
    });

    render(
      <MemoryRouter>
        <ReportsManagementPanel
          assessmentId="asm-1"
          assessmentName="Canonical DRD"
          workflowStatus="APPROVED"
          canManage={true}
          onRefresh={async () => {}}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('DRD Executive Report')).toBeInTheDocument();
    });

    expect(screen.getByText(/Current report lane readback: run run-42/i)).toBeInTheDocument();
    expect(screen.getAllByText(/run run-42 • review: accepted/i)).toHaveLength(2);

    // Kolumny i copy nagłówka idą przez i18n — brak klucza objawiłby się surowym
    // `assessment.reportsManagePanel.*` w DOM (tak wyglądał defekt przed naprawą).
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Author')).toBeInTheDocument();
    expect(screen.queryByText(/assessment\.reportsManagePanel\./)).toBeNull();
  });
});
