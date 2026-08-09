import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let role = 'ADMIN';
let language = 'en';
const operationsRender = vi.fn();
const { listPlansMock } = vi.hoisted(() => ({ listPlansMock: vi.fn() }));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ currentUser: { id: 'user-1', role } }),
}));
vi.mock('@/services/api', () => ({
  Api: { getMyProjectMemberships: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/services/api/agentPlan.api', () => ({
  listAgentFolders: vi.fn().mockResolvedValue([]),
  listAgentPlans: listPlansMock,
  listAgentProcesses: vi.fn().mockResolvedValue({ processes: [] }),
  createAgentFolder: vi.fn(),
  createAgentPlan: vi.fn(),
  deleteAgentFolder: vi.fn(),
  setAgentPlanFolder: vi.fn(),
  cancelAgentPlan: vi.fn(),
  getAgentPlan: vi.fn(),
}));
vi.mock('@/services/api/agentManifests.api', () => ({
  listAgentManifests: vi.fn().mockResolvedValue({ manifests: [] }),
}));
vi.mock('../AgentPlanWorkspace', () => ({ AgentPlanWorkspace: () => null }));
vi.mock('../AgentProcessTemplatesPanel', () => ({ AgentProcessTemplatesPanel: () => null }));
vi.mock('../TransformationCasesPanel', () => ({
  TransformationCasesPanel: ({ onCanonicalContextChange, onOpenOperations }: any) => (
    <div data-testid="transformations">
      <button
        onClick={() =>
          onCanonicalContextChange({
            transformationCaseId: 'case-new',
            canonicalRunId: undefined,
          })
        }
      >
        Select case
      </button>
      <button
        onClick={() =>
          onOpenOperations?.({
            transformationCaseId: 'case-new',
            canonicalRunId: 'canonical-run-new',
          })
        }
      >
        Open operations
      </button>
    </div>
  ),
}));
vi.mock('../AgentOperationsPanel', () => ({
  AgentOperationsPanel: ({ initialCanonicalRunId }: any) => {
    operationsRender(initialCanonicalRunId);
    return <div data-testid="operations">{initialCanonicalRunId}</div>;
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language },
    t: (_key: string, fallback: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback.defaultValue ?? _key),
  }),
}));

import { AgentHubShell } from '../AgentHubShell';

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{`${location.pathname}${location.search}`}</output>
      <button onClick={() => navigate(-1)}>Back</button>
    </>
  );
}

function renderHub(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <AgentHubShell />
    </MemoryRouter>
  );
}

describe('canonical Agent workspace navigation', () => {
  beforeEach(() => {
    role = 'ADMIN';
    language = 'en';
    operationsRender.mockClear();
    listPlansMock.mockReset().mockResolvedValue({ plans: [] });
  });

  it('persists Case selection and hands the canonical run to Operations', async () => {
    renderHub(
      '/my-work?tab=agent&agentView=transformations&transformationCaseId=case-old&canonicalRunId=stale&keep=1'
    );
    expect(screen.getByTestId('transformations')).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Agent hub' })).toBeInTheDocument();
    expect(screen.getByTestId('agent-hub-workspace-summary')).toHaveTextContent(
      'Teresa prepares the work'
    );
    expect(screen.getByTestId('agent-hub-workspace-summary')).toHaveTextContent('Case: case-old');
    expect(screen.getByTestId('agent-hub-workspace-summary')).toHaveTextContent('Run: stale');

    fireEvent.click(screen.getByRole('button', { name: 'Select case' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        'tab=agent&agentView=transformations&transformationCaseId=case-new&keep=1'
      )
    );
    expect(screen.getByTestId('location')).not.toHaveTextContent('canonicalRunId');

    fireEvent.click(screen.getByRole('button', { name: 'Open operations' }));
    expect(await screen.findByTestId('operations')).toHaveTextContent('canonical-run-new');
    expect(screen.getByTestId('location')).toHaveTextContent('agentView=operations');
    expect(screen.getByTestId('location')).toHaveTextContent('keep=1');
  });

  it('restores the selected Case when browser history returns from Operations', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/my-work',
          element: (
            <>
              <LocationProbe />
              <AgentHubShell />
            </>
          ),
        },
      ],
      {
        initialEntries: [
          '/my-work?tab=agent&agentView=transformations&transformationCaseId=case-new&keep=1',
          '/my-work?tab=agent&agentView=operations&transformationCaseId=case-new&canonicalRunId=canonical-run-new&keep=1',
        ],
        initialIndex: 1,
      }
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId('operations')).toHaveTextContent('canonical-run-new');

    await act(async () => {
      await router.navigate(-1);
    });
    expect(await screen.findByTestId('transformations')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('transformationCaseId=case-new');
  });

  it('fails closed for an unauthorized Operations deep link', async () => {
    role = 'CONSULTANT';
    renderHub(
      '/my-work?tab=agent&agentView=operations&transformationCaseId=case-1&canonicalRunId=foreign-run&keep=1'
    );

    await waitFor(() => expect(screen.queryByTestId('operations')).not.toBeInTheDocument());
    expect(operationsRender).not.toHaveBeenCalled();
    expect(screen.getByText('Agent Operations access denied')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('canonicalRunId=foreign-run');

    fireEvent.click(screen.getByRole('button', { name: 'Return to Cases and approvals' }));
    expect(await screen.findByTestId('transformations')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('transformationCaseId=case-1');
    expect(screen.getByTestId('location')).toHaveTextContent('keep=1');
    expect(screen.getByTestId('location')).not.toHaveTextContent('canonicalRunId');
  });

  it('uses canonical Polish Case and Run vocabulary with explicit empty context', async () => {
    language = 'pl';
    renderHub('/my-work?tab=agent&agentView=processes');

    expect(screen.getByRole('main', { name: 'Centrum Agenta' })).toBeInTheDocument();
    const summary = screen.getByTestId('agent-hub-workspace-summary');
    expect(summary).toHaveTextContent('Agent Hub — wspólna przestrzeń pracy');
    expect(summary).toHaveTextContent('kanoniczne Sprawy i Przebiegi');
    expect(summary).toHaveTextContent('Sprawa: nie wybrano');
    expect(summary).toHaveTextContent('Przebieg: nie wybrano');
    const areaStatus = summary.querySelector('[role="status"]');
    expect(areaStatus).toHaveAttribute('aria-live', 'polite');
    expect(areaStatus).toHaveTextContent('Bieżący obszar Agent Hub: Przebiegi i historia');
    expect(await screen.findByText('Brak procesów')).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Centrum Agenta' })).toHaveAttribute(
      'aria-busy',
      'false'
    );
  });

  it('renders an explicit recoverable error state for Runs and history', async () => {
    listPlansMock.mockRejectedValueOnce(new Error('run history unavailable'));
    renderHub('/my-work?tab=agent&agentView=processes&keep=1');

    expect(await screen.findByText('Failed to load processes')).toBeInTheDocument();
    expect(screen.getByText('run history unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('agentView=processes');
    expect(screen.getByTestId('location')).toHaveTextContent('keep=1');
  });
});
