/**
 * @vitest-environment jsdom
 *
 * KpisSection — F3 (D11) proof-of-pattern render test.
 *
 * Locks in the ADDITIVE CardBlockRenderer display layer:
 *   - With KPIs loaded (async via Api.get), the generic renderer
 *     (`[data-card-renderer][data-section-key="kpis"]`) mounts BELOW the edit
 *     table as a `[data-block="table"]` surfacing the KPI names.
 *   - With NO KPIs (Api.get → []), the renderer preview is not shown.
 *
 * KPIs are fetched on mount, so the preview depends on resolved state — the
 * assertions await the async load via findBy / waitFor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Api.get is mocked PER-TEST below; declare the spy up front so the module
// mock factory can close over it before the component imports it.
const apiGet = vi.fn();
vi.mock('@/services/api', () => ({
  Api: { get: (...args: any[]) => apiGet(...args) },
}));

// react-i18next → return the key (so labels are deterministic, non-empty)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// framer-motion → plain elements
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: () => (props: any) => <div {...props} />,
    }
  ),
}));

// react-hot-toast → no-op
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

// AIFieldEnhancer → trivial marker (avoids API/network deps)
vi.mock('@/components/shared/AIFieldEnhancer', () => ({
  AIFieldEnhancer: () => <span data-testid="ai-enhancer" />,
}));

// shared NMode blocks → trivial stubs that still render data so the test can
// observe the edit table separately from the additive preview.
vi.mock('@/components/shared/NModeBlocks', () => ({
  Callout: ({ children }: any) => <div data-testid="callout">{children}</div>,
  EmptyStateInline: ({ message }: any) => <div data-testid="empty-state">{message}</div>,
  InlineTable: ({ data }: any) => (
    <table data-testid="edit-table">
      <tbody>
        {(data || []).map((row: any) => (
          <tr key={row.id}>
            <td>{row.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

const ctxValue: any = {
  initiative: { id: '1', name: 'X', status: 'DRAFT', priority: 'high' },
  initiativeId: '1',
  isPolish: true,
  kpisAiRequest: null,
  clearKpisAiRequest: vi.fn(),
};

vi.mock('@/components/Initiatives/sections/InitiativeContext', () => ({
  useInitiativeContext: () => ctxValue,
}));

import { KpisSection } from '@/components/Initiatives/sections/KpisSection';

const SECTION_PROPS: any = {
  sectionType: { id: 'kpis', label: 'KPIs' },
  expanded: true,
  onToggle: vi.fn(),
  readonly: false,
};

beforeEach(() => {
  apiGet.mockReset();
});

describe('KpisSection — CardBlockRenderer display layer', () => {
  it('renders the generic CardBlockRenderer table preview once KPIs load', async () => {
    apiGet.mockResolvedValue([
      {
        id: '1',
        name: 'Czas cyklu',
        unit: 'dni',
        baselineValue: 14,
        currentValue: 10,
        targetValue: 7,
      },
    ]);

    const { container } = render(<KpisSection {...SECTION_PROPS} />);

    // Await the async load → the additive renderer appears.
    await waitFor(() => {
      expect(container.querySelector('[data-card-renderer]')).not.toBeNull();
    });

    const renderer = container.querySelector('[data-card-renderer]');
    expect(renderer?.getAttribute('data-section-key')).toBe('kpis');

    const table = container.querySelector('[data-block="table"]');
    expect(table).not.toBeNull();
    expect(table?.textContent).toContain('Czas cyklu');
  });

  it('does NOT render the renderer preview when there are no KPIs', async () => {
    apiGet.mockResolvedValue([]);

    const { container } = render(<KpisSection {...SECTION_PROPS} />);

    // Let the async load settle (empty-state appears), then assert no preview.
    await screen.findByTestId('empty-state');
    await waitFor(() => {
      expect(container.querySelector('[data-card-renderer]')).toBeNull();
    });
  });
});
