import { describe, expect, it } from 'vitest';

import { resolveArtifactPanelArbitration } from '../../../src/components/shared/ArtifactStudio/layout';

describe('resolveArtifactPanelArbitration', () => {
  it('docks both panels on a wide document canvas', () => {
    expect(
      resolveArtifactPanelArbitration({
        viewportWidth: 1920,
        leftRequested: true,
        teresaRequested: true,
        minCanvasWidth: 680,
      }),
    ).toEqual({ left: 'docked', teresa: 'docked' });
  });

  it('automatically closes the left panel at 1440 to protect a presentation canvas', () => {
    expect(
      resolveArtifactPanelArbitration({
        viewportWidth: 1440,
        leftRequested: true,
        teresaRequested: true,
        minCanvasWidth: 760,
      }),
    ).toEqual({ left: 'closed', teresa: 'docked' });
  });

  it('honours an explicit pin only when both panels still fit', () => {
    expect(
      resolveArtifactPanelArbitration({
        viewportWidth: 1440,
        leftRequested: true,
        teresaRequested: true,
        leftPinned: true,
        minCanvasWidth: 760,
      }),
    ).toEqual({ left: 'docked', teresa: 'docked' });
  });

  it('uses a single overlay surface below 1280 and gives Teresa precedence', () => {
    expect(
      resolveArtifactPanelArbitration({
        viewportWidth: 1024,
        leftRequested: true,
        teresaRequested: true,
        minCanvasWidth: 680,
      }),
    ).toEqual({ left: 'closed', teresa: 'overlay' });
  });

  it('opens the left structure panel as an overlay on compact screens', () => {
    expect(
      resolveArtifactPanelArbitration({
        viewportWidth: 1024,
        leftRequested: true,
        teresaRequested: false,
        minCanvasWidth: 680,
      }),
    ).toEqual({ left: 'overlay', teresa: 'closed' });
  });

  it('overlays Teresa when docking would violate the minimum canvas width', () => {
    expect(
      resolveArtifactPanelArbitration({
        viewportWidth: 1280,
        leftRequested: false,
        teresaRequested: true,
        teresaWidth: 640,
        minCanvasWidth: 680,
      }),
    ).toEqual({ left: 'closed', teresa: 'overlay' });
  });
});
