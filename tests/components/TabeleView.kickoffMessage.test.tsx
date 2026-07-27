/**
 * @vitest-environment jsdom
 *
 * Kickoff pułapka (fala 1c, 2026-07-27): `setChatKickoffMessage` + navigate to
 * a KIMI lane used to silently drop the message — `MainLayout` turns the
 * global split `UnifiedChatPanel` off on these routes (`hasEmbeddedModuleChat`)
 * and the Studio itself has no embedded chat to seed. The fix consumes
 * `chatKickoffMessage` from the ui store the same way the existing
 * `templatePrompt` auto-trigger does: fire `pipeline.startGeneration` once,
 * then clear the store so it can't re-fire on a later visit.
 *
 * `TabeleView` is used as the representative lane (identical pattern also
 * applied to `PrezentacjeView` / `ExceleView` — see those files under
 * src/components/AIChat/KimiWorkspace/).
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

// No artifactId/templateArtifactId/templatePrompt/view=new — the "home" gate
// is open by default, and a pending kickoff message must keep it closed.
const searchParamsMock = new URLSearchParams('');
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [searchParamsMock, () => undefined] as const,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/utils/melsTabeleFlag', () => ({
  isMelsTabeleEnabled: () => false,
  MELS_TABELE_FLAG_KEYS: { localStorage: 'x', query: 'y', env: 'z' },
}));

vi.mock('@/components/AIChat/KimiWorkspace/tabeleShell/TabeleMelsView', () => ({
  TabeleMelsView: () => <div data-testid="mels-view-stub">MELS view</div>,
}));

vi.mock('@/components/AIChat/KimiWorkspace/KimiWorkspaceShell', () => ({
  KimiWorkspaceShell: () => <div data-testid="legacy-shell-stub">Legacy shell</div>,
  ArtifactPreview: undefined,
}));

vi.mock('@/components/AIChat/KimiWorkspace/ArtifactModuleHome', () => ({
  ArtifactModuleHome: () => <div data-testid="artifact-home-stub">Home grid</div>,
}));

const startGenerationMock = vi.fn();
const pipelineMock = {
  taskSteps: [],
  totalSteps: 0,
  completedSteps: 0,
  isGenerating: false,
  isCompleted: false,
  isFailed: false,
  failureReason: null,
  preview: null,
  currentRun: null as { id: string } | null,
  isBusy: false,
  advancePipeline: vi.fn(),
  startGeneration: startGenerationMock,
  handleReplay: vi.fn(),
  handleRemix: vi.fn(),
  handleDownload: vi.fn(),
};
vi.mock('@/components/AIChat/KimiWorkspace/useKimiArtifactPipeline', () => ({
  useKimiArtifactPipeline: () => pipelineMock,
}));

// Mutable store stub: tests flip `.chatKickoffMessage` before rendering.
const clearChatKickoffMessageMock = vi.fn();
const uiStoreState: { chatKickoffMessage: string | null } = { chatKickoffMessage: null };
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({
      currentOrganization: { id: 'org-1' },
      currentProjectId: 'proj-1',
      chatKickoffMessage: uiStoreState.chatKickoffMessage,
      clearChatKickoffMessage: clearChatKickoffMessageMock,
    }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector: (s: unknown) => unknown) => selector({ activeMessages: [] }),
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
  buildTableBuilderOpenPath: vi.fn().mockResolvedValue(null),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/AIChat/KimiWorkspace/tabeleSystemPrompt', () => ({
  TABELE_SYSTEM_PROMPT: '',
}));

vi.mock('@/components/AIChat/KimiWorkspace/tabele/loadTabelePreview', () => ({
  loadTabelePreviewByTableId: vi.fn().mockResolvedValue(null),
  resolveAccessibleTableId: vi.fn().mockResolvedValue(null),
}));

import { TabeleView } from '@/components/AIChat/KimiWorkspace/TabeleView';

describe('TabeleView — chatKickoffMessage consumption', () => {
  beforeEach(() => {
    uiStoreState.chatKickoffMessage = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts the pipeline with the pending kickoff message and clears the store', () => {
    uiStoreState.chatKickoffMessage = '  Stwórz tabelę ryzyk projektu  ';
    render(<TabeleView />);

    expect(startGenerationMock).toHaveBeenCalledTimes(1);
    expect(startGenerationMock).toHaveBeenCalledWith('Stwórz tabelę ryzyk projektu');
    expect(clearChatKickoffMessageMock).toHaveBeenCalledTimes(1);
    // The pending message must suppress the home gate so the pipeline state
    // (not a stale "home" screen) is what the user sees while it starts.
    expect(screen.queryByTestId('artifact-home-stub')).not.toBeInTheDocument();
  });

  it('does nothing when there is no pending kickoff message', () => {
    uiStoreState.chatKickoffMessage = null;
    render(<TabeleView />);

    expect(startGenerationMock).not.toHaveBeenCalled();
    expect(clearChatKickoffMessageMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('artifact-home-stub')).toBeInTheDocument();
  });

  it('ignores a blank/whitespace-only kickoff message', () => {
    uiStoreState.chatKickoffMessage = '   ';
    render(<TabeleView />);

    expect(startGenerationMock).not.toHaveBeenCalled();
    expect(clearChatKickoffMessageMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('artifact-home-stub')).toBeInTheDocument();
  });
});
