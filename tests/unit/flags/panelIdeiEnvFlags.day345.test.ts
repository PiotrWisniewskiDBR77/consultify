// KONTRAKT DYŻURU 345
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ENABLE_NOTEBOOK_SPEC_A_SHELL,
  isNotebookSpecAShellEnabled,
} from '@/components/MyWork/notebook/notebookSpecAShellFlag';
import {
  ENABLE_ARTIFACT_RIGHT_RAIL,
  isArtifactRightRailEnabled,
} from '@/utils/artifactRightRailFlag';
import { isIdeaNotebookRightPanelPrototypeEnabled } from '@/utils/ideaNotebookRightPanelPrototypeFlag';

describe('Day345 panel flags use build-time env without changing defaults', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
    vi.unstubAllEnvs();
  });

  it('keeps defaults OFF, OFF and ON', () => {
    expect(isIdeaNotebookRightPanelPrototypeEnabled()).toBe(false);
    expect(ENABLE_ARTIFACT_RIGHT_RAIL).toBe(false);
    expect(isArtifactRightRailEnabled()).toBe(false);
    expect(ENABLE_NOTEBOOK_SPEC_A_SHELL).toBe(true);
    expect(isNotebookSpecAShellEnabled()).toBe(true);
  });

  it('reads all three named Vite env keys through their static expressions', () => {
    vi.stubEnv('VITE_IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE', 'true');
    vi.stubEnv('VITE_ARTIFACT_RIGHT_RAIL_ENABLED', 'true');
    vi.stubEnv('VITE_ENABLE_NOTEBOOK_SPEC_A_SHELL', 'false');

    expect(isIdeaNotebookRightPanelPrototypeEnabled()).toBe(true);
    expect(isArtifactRightRailEnabled()).toBe(true);
    expect(isNotebookSpecAShellEnabled()).toBe(false);
  });
});
