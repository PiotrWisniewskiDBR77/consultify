/**
 * @vitest-environment jsdom
 *
 * FALA J2 — sesja zamrożona pokazuje PRODUKT, nie kontrakt.
 *
 * ZMIERZONA PRZYCZYNA (14.09): `DrdHttpMethodWorkspaceScreen` miał wczesny
 * `return <FrozenOutputHttpView/>` dla `state === 'frozen' | 'closed'`, PRZED
 * `MethodWorkspaceShell`. Właściciel po zamrożeniu sesji dostawał surowy
 * zrzut kontraktu (`AssessmentOutput (immutable, v1)`, `contentHash`,
 * `scope`, `limitations`, tabela UNIT/CURRENT/TARGET/GAP) i tracił zakładki
 * Wywiad · Macierz · Raport.
 *
 * Ten zestaw pilnuje trzech rzeczy naraz, bo każda z nich osobno wróciłaby
 * niezauważona:
 *   1. powłoka ZOSTAJE (Menu 1: trzy zakładki), a `contentHash` NIE jest
 *      pierwszym, co widać;
 *   2. domyślną zakładką jest „Raport" z KANONICZNYM dokumentem wyniku
 *      (`AssessmentReportView` z `outputId` — ten sam pojemnik, co trasa
 *      `/assessment/outputs/:outputId/report`);
 *   3. surowy widok nie został skasowany — jest pod „Szczegóły techniczne"
 *      w Ustawieniach.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getSession: vi.fn(),
  listEvents: vi.fn(),
  listOutputs: vi.fn(),
  getOutput: vi.fn(),
  listReports: vi.fn(),
  listInitiativeDrafts: vi.fn(),
}));

vi.mock('@/method-core/api/methodCoreApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreApi')>(
    '@/method-core/api/methodCoreApi'
  );
  return {
    ...actual,
    getSession: hoisted.getSession,
    listEvents: hoisted.listEvents,
    listOutputs: hoisted.listOutputs,
    getOutput: hoisted.getOutput,
    listReports: hoisted.listReports,
    listInitiativeDrafts: hoisted.listInitiativeDrafts,
  };
});

// Kanoniczny dokument wyniku robi własne trzy GET-y (`reportApi.ts`) —
// tutaj sprawdzamy WOŁANIE go z właściwym `outputId`, nie jego wnętrze
// (ma własny zestaw: AssessmentReportView.test.tsx).
vi.mock('@/components/assessment/report/AssessmentReportView', () => ({
  AssessmentReportView: ({ outputId }: { outputId: string | null }) => (
    <div data-testid="kanoniczny-dokument-wyniku">outputId={String(outputId)}</div>
  ),
  default: ({ outputId }: { outputId: string | null }) => (
    <div data-testid="kanoniczny-dokument-wyniku">outputId={String(outputId)}</div>
  ),
}));

const { DrdHttpMethodWorkspaceScreen } = await import('../DrdHttpMethodWorkspaceScreen');
const { DRD_METHOD_PACK_ID, DRD_METHOD_PACK_VERSION } = await import(
  '@/method-core/methods/drd/compileDrdPack'
);

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

const FROZEN_SESSION = {
  id: 'sess-frozen-1',
  organizationId: 'org-1',
  projectId: null,
  module: 'assessment',
  methodPackId: DRD_METHOD_PACK_ID,
  methodPackVersion: DRD_METHOD_PACK_VERSION,
  state: 'frozen',
  domainStage: null,
  mode: 'guided_manual',
  ownerUserId: 'user-1',
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
  version: 7,
  frozenSnapshotId: 'snap-1',
  revisionOfSessionId: null,
};

const OUTPUT = {
  id: 'out-frozen-1',
  organizationId: 'org-1',
  sessionId: 'sess-frozen-1',
  module: 'assessment',
  methodPackId: DRD_METHOD_PACK_ID,
  methodPackVersion: DRD_METHOD_PACK_VERSION,
  outputVersion: 1,
  scope: 'Session sess-frozen-1 — frozen snapshot.',
  current: { '1A': 3 },
  target: { '1A': 4 },
  gap: { '1A': 1 },
  limitations: ['Deterministic derivation, not an AI analysis.'],
  findings: [],
  contentHash: 'abcdef0123456789abcdef0123456789',
  frozenAt: '2026-09-14T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getSession.mockResolvedValue({ session: FROZEN_SESSION, roles: ['owner'] });
  hoisted.listEvents.mockResolvedValue([]);
  hoisted.listOutputs.mockResolvedValue({ outputs: [OUTPUT], total: 1 });
  hoisted.getOutput.mockResolvedValue({
    output: OUTPUT,
    superseded: false,
    supersededByOutputId: null,
  });
  hoisted.listReports.mockResolvedValue([]);
  hoisted.listInitiativeDrafts.mockResolvedValue([]);
});

describe('sesja zamrożona — powłoka zamiast surowego kontraktu', () => {
  it('zostaje w MethodWorkspaceShell z trzema zakładkami i NIE pokazuje contentHash na wejściu', async () => {
    render(
      <DrdHttpMethodWorkspaceScreen storage={makeMemoryStorage()} demoSessionId="sess-frozen-1" />
    );

    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();
    expect(screen.getByTestId('view-mode-interview')).toBeInTheDocument();
    expect(screen.getByTestId('view-mode-matrix')).toBeInTheDocument();
    expect(screen.getByTestId('view-mode-report')).toBeInTheDocument();

    // Surowy zrzut kontraktu NIE jest pierwszym ekranem.
    expect(screen.queryByTestId('drd-http-frozen-output-view')).not.toBeInTheDocument();
    expect(screen.queryByText(/contentHash/)).not.toBeInTheDocument();
  });

  it('otwiera się na zakładce „Raport" z kanonicznym dokumentem dla outputu tej sesji', async () => {
    render(
      <DrdHttpMethodWorkspaceScreen storage={makeMemoryStorage()} demoSessionId="sess-frozen-1" />
    );

    await waitFor(() =>
      expect(screen.getByTestId('view-mode-report')).toHaveAttribute('aria-selected', 'true')
    );
    const dokument = await screen.findByTestId('kanoniczny-dokument-wyniku');
    expect(dokument).toHaveTextContent('outputId=out-frozen-1');
  });

  it('mówi WPROST, dlaczego sesja jest tylko do odczytu (powód: zamrożenie, nie brak roli)', async () => {
    render(
      <DrdHttpMethodWorkspaceScreen storage={makeMemoryStorage()} demoSessionId="sess-frozen-1" />
    );

    const banner = await screen.findByTestId('method-workspace-readonly-banner');
    expect(banner.textContent).toMatch(/zamrożona|frozen/i);
    expect(banner.textContent).not.toMatch(/uczestnikiem|participant/i);
  });

  it('surowy widok żyje dalej — pod „Szczegóły techniczne" w Ustawieniach', async () => {
    render(
      <DrdHttpMethodWorkspaceScreen storage={makeMemoryStorage()} demoSessionId="sess-frozen-1" />
    );

    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ustawienia|Settings/ }));

    const szczegoly = await screen.findByTestId('drd-frozen-technical-details');
    const surowy = within(szczegoly).getByTestId('drd-http-frozen-output-view');
    expect(within(surowy).getByText(/contentHash/)).toBeInTheDocument();
    expect(within(surowy).getByTestId('output-panel')).toHaveTextContent('AssessmentOutput');
  });
});
