export type ArtifactPanelMode = 'closed' | 'docked' | 'overlay';

export interface ArtifactPanelArbitrationInput {
  viewportWidth: number;
  leftRequested: boolean;
  teresaRequested: boolean;
  leftPinned?: boolean;
  leftWidth?: number;
  teresaWidth?: number;
  minCanvasWidth: number;
}

export interface ArtifactPanelArbitrationResult {
  left: ArtifactPanelMode;
  teresa: ArtifactPanelMode;
}

const DEFAULT_LEFT_WIDTH = 264;
const DEFAULT_TERESA_WIDTH = 360;
const COMPACT_BREAKPOINT = 1280;
const WIDE_BREAKPOINT = 1600;

/**
 * Keeps the editing canvas usable while enforcing one left structure panel and
 * one global Teresa surface. The function is intentionally UI-framework
 * agnostic so every artifact adapter uses exactly the same spatial contract.
 */
export function resolveArtifactPanelArbitration({
  viewportWidth,
  leftRequested,
  teresaRequested,
  leftPinned = false,
  leftWidth = DEFAULT_LEFT_WIDTH,
  teresaWidth = DEFAULT_TERESA_WIDTH,
  minCanvasWidth,
}: ArtifactPanelArbitrationInput): ArtifactPanelArbitrationResult {
  if (!leftRequested && !teresaRequested) {
    return { left: 'closed', teresa: 'closed' };
  }

  if (viewportWidth < COMPACT_BREAKPOINT) {
    if (teresaRequested) return { left: 'closed', teresa: 'overlay' };
    return { left: 'overlay', teresa: 'closed' };
  }

  if (!teresaRequested) {
    return { left: leftRequested ? 'docked' : 'closed', teresa: 'closed' };
  }

  if (!leftRequested) {
    return {
      left: 'closed',
      teresa: viewportWidth - teresaWidth >= minCanvasWidth ? 'docked' : 'overlay',
    };
  }

  const bothPanelsFit = viewportWidth - leftWidth - teresaWidth >= minCanvasWidth;
  if (bothPanelsFit && (viewportWidth >= WIDE_BREAKPOINT || leftPinned)) {
    return { left: 'docked', teresa: 'docked' };
  }

  if (viewportWidth - teresaWidth >= minCanvasWidth) {
    return { left: 'closed', teresa: 'docked' };
  }

  return { left: 'closed', teresa: 'overlay' };
}
