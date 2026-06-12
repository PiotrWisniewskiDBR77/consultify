/**
 * TabeleView — Sprint 4 orchestrator tests.
 *
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  startGenerationMock: vi.fn().mockResolvedValue(undefined),
  advancePipelineMock: vi.fn().mockResolvedValue(undefined),
  handleReplayMock: vi.fn(),
  handleRemixMock: vi.fn(),
  handleDownloadMock: vi.fn().mockResolvedValue(undefined),
  openTableBuilderInNewTabMock: vi.fn().mockResolvedValue(true),
  buildTableBuilderOpenPathMock: vi.fn().mockResolvedValue('/presentations?tab=sheets&tableId=table-1'),
  downloadTabeleArtifactCsvMock: vi.fn().mockResolvedValue(true),
  proposeSchemaChangeMock: vi.fn().mockResolvedValue({ id: 'proposal-1' }),
  explainRelationMock: vi.fn().mockResolvedValue({
    relations: [
      {
        reason: 'Owner relation matched by role id.',
      },
    ],
    cacheHit: false,
    computedInMs: 5,
  }),
  activeMessages: [] as Array<{ id: string; role: 'user' | 'ai'; content: string }>,
  pipelineState: null as any,
}));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline', () => ({
  useKimiArtifactPipeline: () => mockState.pipelineState,
}));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/KimiWorkspaceShell', () => ({
  KimiWorkspaceShell: (props: any) => (
    <div data-testid="kimi-shell" data-lane={props.lane}>
      <div data-testid="shell-preview-type">{props.preview?.type || 'none'}</div>
      <div data-testid="shell-completed">{String(props.isCompleted)}</div>
      <div data-testid="shell-system-prompt">{props.chatSystemPrompt}</div>
      <button type="button" onClick={() => props.onStartGeneration('Create role register')}>
        Start generation
      </button>
      <button type="button" onClick={props.onPreviewFile}>
        Preview file
      </button>
      <button type="button" onClick={props.onDownload}>
        Download
      </button>
    </div>
  ),
}));

vi.mock('../../../../src/utils/tabeleArtifactOpen', () => ({
  openTableBuilderInNewTab: (...args: any[]) => mockState.openTableBuilderInNewTabMock(...args),
  buildTableBuilderOpenPath: (...args: any[]) => mockState.buildTableBuilderOpenPathMock(...args),
  downloadTabeleArtifactCsv: (...args: any[]) => mockState.downloadTabeleArtifactCsvMock(...args),
}));

vi.mock('../../../../src/services/api', () => ({
  Api: {
    get: vi.fn().mockResolvedValue({ title: 'Template role register' }),
  },
}));

vi.mock('../../../../src/services/api/tablePlatform.api', () => ({
  getTable: vi.fn().mockResolvedValue({
    id: 'table-1',
    name: 'Role Register',
    fields: [
      { id: 'field-name', name: 'Name', fieldType: 'text' },
      { id: 'field-owner', name: 'Owner', fieldType: 'text' },
    ],
  }),
  listRecords: vi.fn().mockResolvedValue({
    records: [{ id: 'record-1', data: { Name: 'Sponsor', Owner: 'CEO' } }],
    total: 1,
  }),
  listSchemaProposals: vi.fn().mockResolvedValue([]),
  proposeSchemaChange: (...args: any[]) => mockState.proposeSchemaChangeMock(...args),
  explainRelation: (...args: any[]) => mockState.explainRelationMock(...args),
}));

vi.mock('../../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector: any) =>
    selector({
      activeMessages: mockState.activeMessages,
      setDisplayMode: vi.fn(),
      setWorkspaceContext: vi.fn(),
    }),
}));

vi.mock('../../../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({
      currentOrganization: { id: 'workspace-1', name: 'Test Org' },
      currentProjectId: 'project-1',
    }),
}));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/useModuleTemplates', () => ({
  useModuleTemplates: () => ({ templates: [], loading: false, error: null }),
}));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/useModuleRecentArtifacts', () => ({
  useModuleRecentArtifacts: () => ({ artifacts: [], loading: false, error: null }),
}));

import TabeleView from '../../../../src/components/AIChat/KimiWorkspace/TabeleView';
import { TABELE_SYSTEM_PROMPT } from '../../../../src/components/AIChat/KimiWorkspace/tabeleSystemPrompt';

function resetPipeline(overrides: Record<string, unknown> = {}) {
  mockState.pipelineState = {
    taskSteps: [],
    totalSteps: 8,
    completedSteps: 0,
    isGenerating: false,
    isCompleted: false,
    isFailed: false,
    failureReason: null,
    preview: null,
    currentRun: null,
    isBusy: false,
    startGeneration: mockState.startGenerationMock,
    advancePipeline: mockState.advancePipelineMock,
    handleReplay: mockState.handleReplayMock,
    handleRemix: mockState.handleRemixMock,
    handleDownload: mockState.handleDownloadMock,
    ...overrides,
  };
}

function renderTabele(initialEntry = '/tabele') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/tabele" element={<TabeleView />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TabeleView — Sprint 4 orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.activeMessages = [];
    resetPipeline();
  });

  it('renders the module home on bare /tabele', () => {
    renderTabele('/tabele');
    expect(screen.getByRole('heading', { name: /Table Studio/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start new/i })).toBeInTheDocument();
  });

  it('renders the tabele shell for /tabele?view=new and passes the system prompt', () => {
    renderTabele('/tabele?view=new');
    expect(screen.getByTestId('kimi-shell')).toHaveAttribute('data-lane', 'tabele');
    const renderedPrompt = screen.getByTestId('shell-system-prompt').textContent || '';
    expect(renderedPrompt).toContain('You are an operational table architect');
    expect(renderedPrompt).toContain('proposal -> approval -> execution -> audit');
    expect(renderedPrompt).toContain(TABELE_SYSTEM_PROMPT.split('\n')[0]);

    fireEvent.click(screen.getByRole('button', { name: /Start generation/i }));
    expect(mockState.startGenerationMock).toHaveBeenCalledWith('Create role register');
  });

  it('auto-triggers generation from templatePrompt', async () => {
    renderTabele('/tabele?view=new&templatePrompt=Create%20vendor%20master');
    await waitFor(() => {
      expect(mockState.startGenerationMock).toHaveBeenCalledWith('Create vendor master');
    });
  });

  it('hydrates a reopened table preview from artifactId', async () => {
    renderTabele('/tabele?artifactId=table-1');
    await waitFor(() => {
      expect(screen.getByTestId('shell-preview-type')).toHaveTextContent('tabele');
    });
    expect(screen.getByTestId('shell-completed')).toHaveTextContent('true');
  });

  it('resolves the Table Builder path and navigates via the Sprint 4 utility', async () => {
    resetPipeline({
      isCompleted: true,
      preview: {
        type: 'tabele',
        title: 'Role Register',
        tableId: 'table-1',
        tabeleSchemaFields: [],
        tabeleRelations: [],
      },
    });

    renderTabele('/tabele?view=new');
    fireEvent.click(screen.getByRole('button', { name: /Preview file/i }));

    // The builder now opens via in-SPA navigation: resolve the path for the
    // table, then navigate to it (no separate new-tab utility).
    await waitFor(() => {
      expect(mockState.buildTableBuilderOpenPathMock).toHaveBeenCalledWith('table-1');
    });
  });

  it('downloads CSV via the Tabele artifact utility', async () => {
    resetPipeline({
      isCompleted: true,
      preview: {
        type: 'tabele',
        title: 'Role Register',
        tableId: 'table-1',
        tabeleSchemaFields: [],
        tabeleRelations: [],
      },
    });

    renderTabele('/tabele?view=new');
    fireEvent.click(screen.getByRole('button', { name: /Download/i }));

    await waitFor(() => {
      expect(mockState.downloadTabeleArtifactCsvMock).toHaveBeenCalledWith('table-1');
    });
  });

  it('routes an export csv chat intent after table completion', async () => {
    mockState.activeMessages = [
      { id: 'u-1', role: 'user', content: 'Create role register' },
      { id: 'a-1', role: 'ai', content: 'Done' },
      { id: 'u-2', role: 'user', content: 'export csv' },
    ];
    resetPipeline({
      isCompleted: true,
      preview: {
        type: 'tabele',
        title: 'Role Register',
        tableId: 'table-1',
        tableData: { columns: ['id'], rows: [{ id: 'record-1' }] },
        tabeleSchemaFields: [],
        tabeleRelations: [],
      },
    });

    renderTabele('/tabele?view=new');

    await waitFor(() => {
      expect(mockState.downloadTabeleArtifactCsvMock).toHaveBeenCalledWith('table-1');
    });
  });

  it('routes an open builder chat intent after table completion', async () => {
    mockState.activeMessages = [
      { id: 'u-1', role: 'user', content: 'Create role register' },
      { id: 'a-1', role: 'ai', content: 'Done' },
      { id: 'u-2', role: 'user', content: 'open builder' },
    ];
    resetPipeline({
      isCompleted: true,
      preview: {
        type: 'tabele',
        title: 'Role Register',
        tableId: 'table-1',
        tableData: { columns: ['id'], rows: [{ id: 'record-1' }] },
        tabeleSchemaFields: [],
        tabeleRelations: [],
      },
    });

    renderTabele('/tabele?view=new');

    await waitFor(() => {
      expect(mockState.buildTableBuilderOpenPathMock).toHaveBeenCalledWith('table-1');
    });
  });

  it('routes an explain relation chat intent after table completion', async () => {
    mockState.activeMessages = [
      { id: 'u-1', role: 'user', content: 'Create role register' },
      { id: 'a-1', role: 'ai', content: 'Done' },
      { id: 'u-2', role: 'user', content: 'explain relation' },
    ];
    resetPipeline({
      isCompleted: true,
      preview: {
        type: 'tabele',
        title: 'Role Register',
        tableId: 'table-1',
        tableData: { columns: ['id'], rows: [{ id: 'record-1' }] },
        tabeleSchemaFields: [],
        tabeleRelations: [],
      },
    });

    renderTabele('/tabele?view=new');

    await waitFor(() => {
      expect(mockState.explainRelationMock).toHaveBeenCalledWith('table-1', 'record-1');
    });
  });
});
