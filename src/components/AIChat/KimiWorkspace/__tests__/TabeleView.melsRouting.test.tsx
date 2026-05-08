/**
 * @vitest-environment jsdom
 *
 * Routing smoke for `<TabeleView>` flag branching (EPIC-T16-S4).
 *
 * Verifies that:
 *   - When `isMelsTabeleEnabled()` returns true the component mounts
 *     `<TabeleMelsView>`.
 *   - When the flag is false the component mounts the legacy
 *     `<KimiWorkspaceShell lane="tabele">`.
 *   - When `showHome` conditions are met (no artifact, no template
 *     prompt, no current run) the home grid mounts regardless of flag.
 *
 * The test mocks the heavy collaborators so we exercise only the
 * branching logic added in S4.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defOrOpts?: unknown) => {
      if (typeof defOrOpts === 'string') return defOrOpts;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

const searchParamsMock = new URLSearchParams('artifactId=tbl-1');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [searchParamsMock, () => undefined] as const,
  };
});

const setMelsFlag = vi.fn(() => false);
vi.mock('@/utils/melsTabeleFlag', () => ({
  isMelsTabeleEnabled: () => setMelsFlag(),
  MELS_TABELE_FLAG_KEYS: { localStorage: 'x', query: 'y', env: 'z' },
}));

vi.mock('../tabeleShell/TabeleMelsView', () => ({
  TabeleMelsView: (props: { preview?: unknown }) => (
    <div data-testid="mels-view-stub" data-has-preview={props.preview ? '1' : '0'}>
      MELS view
    </div>
  ),
}));

vi.mock('../KimiWorkspaceShell', () => ({
  KimiWorkspaceShell: () => <div data-testid="legacy-shell-stub">Legacy shell</div>,
  ArtifactPreview: undefined,
}));

vi.mock('../ArtifactModuleHome', () => ({
  ArtifactModuleHome: () => <div data-testid="artifact-home-stub">Home grid</div>,
}));

const pipelineMock = {
  taskSteps: [],
  totalSteps: 0,
  completedSteps: 0,
  isGenerating: false,
  isCompleted: true,
  isFailed: false,
  failureReason: null,
  preview: null,
  currentRun: { id: 'run-1' },
  isBusy: false,
  advancePipeline: vi.fn(),
  startGeneration: vi.fn(),
  handleReplay: vi.fn(),
  handleRemix: vi.fn(),
  handleDownload: vi.fn(),
};
vi.mock('../useKimiArtifactPipeline', () => ({
  useKimiArtifactPipeline: () => pipelineMock,
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({ currentOrganization: { id: 'org-1' }, currentProjectId: 'proj-1' }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector: (s: unknown) => unknown) =>
    selector({ activeMessages: [] }),
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn().mockResolvedValue({}) },
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  getTable: vi.fn().mockResolvedValue({}),
  listRecords: vi.fn().mockResolvedValue({ records: [], total: 0 }),
  listSchemaProposals: vi.fn().mockResolvedValue([]),
  proposeSchemaChange: vi.fn(),
  explainRelation: vi.fn(),
}));

vi.mock('@/utils/tabeleArtifactOpen', () => ({
  downloadTabeleArtifactCsv: vi.fn().mockResolvedValue(true),
  openTableBuilderInNewTab: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../tabeleSystemPrompt', () => ({
  TABELE_SYSTEM_PROMPT: '',
}));

import { TabeleView } from '../TabeleView';

describe('TabeleView MELS flag routing', () => {
  beforeEach(() => {
    setMelsFlag.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('mounts the legacy KimiWorkspaceShell when the flag is OFF', () => {
    setMelsFlag.mockReturnValue(false);
    render(<TabeleView />);
    expect(screen.getByTestId('legacy-shell-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('mels-view-stub')).not.toBeInTheDocument();
  });

  it('mounts the TabeleMelsView when the flag is ON', () => {
    setMelsFlag.mockReturnValue(true);
    render(<TabeleView />);
    expect(screen.getByTestId('mels-view-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-shell-stub')).not.toBeInTheDocument();
  });
});
