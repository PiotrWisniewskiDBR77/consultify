/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));
vi.mock('@/services/api', () => ({ Api: {} }));
vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector: (state: { activeMessages: unknown[] }) => unknown) =>
    selector({ activeMessages: [] }),
}));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ chatKickoffMessage: null, clearChatKickoffMessage: vi.fn() }),
}));
vi.mock('@/utils/artifactStudioFlags', () => ({ isArtifactStudioLaneEnabled: () => false }));
vi.mock('@/utils/artifactStudioTelemetry', () => ({ emitArtifactStudioShellSelected: vi.fn() }));
vi.mock('@/utils/exceleRightRailFlag', () => ({ isExceleRightRailEnabled: () => false }));
vi.mock('@/utils/triModeFlag', () => ({ isTriModeEnabled: () => true }));
vi.mock('../useKimiArtifactPipeline', () => ({
  useKimiArtifactPipeline: () => ({
    advancePipeline: vi.fn(),
    startGeneration: vi.fn(),
    currentRun: null,
    isGenerating: false,
    isBusy: false,
    isCompleted: false,
    isFailed: false,
    failureReason: null,
    preview: null,
    taskSteps: [],
    totalSteps: 0,
    completedSteps: 0,
    handleDownload: vi.fn(),
    handleRemix: vi.fn(),
    handleReplay: vi.fn(),
  }),
}));
vi.mock('../ArtifactModuleHome', () => ({
  ArtifactModuleHome: () => <div>Ostatnie</div>,
}));
vi.mock('../KimiWorkspaceShell', () => ({ KimiWorkspaceShell: () => <div>workspace</div> }));
vi.mock('../SpreadsheetArtifactStudio', () => ({ SpreadsheetArtifactStudio: () => null }));
vi.mock('../ExceleRightPanel', () => ({ ExceleRightPanel: () => null }));
vi.mock('../ExceleRightRail', () => ({ ExceleRightRail: () => null }));

import { ExceleView } from '../ExceleView';

describe('Day 276 — droga startu nowego arkusza', () => {
  it('gołe /excele pokazuje trzy drogi startu, a nie ekran Ostatnie', () => {
    render(
      <MemoryRouter initialEntries={['/excele']}>
        <ExceleView />
      </MemoryRouter>
    );

    expect(screen.getByText('Jak chcesz zacząć arkusz?')).toBeInTheDocument();
    expect(screen.getByText('Czysto')).toBeInTheDocument();
    expect(screen.getByText('Z AI')).toBeInTheDocument();
    expect(screen.getByText('Z szablonu')).toBeInTheDocument();
    expect(screen.queryByText('Ostatnie')).not.toBeInTheDocument();
  });
});
