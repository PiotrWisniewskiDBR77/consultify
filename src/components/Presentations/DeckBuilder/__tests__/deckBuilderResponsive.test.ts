/** @vitest-environment node */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(__dirname, '../deckBuilderResponsive.css'), 'utf8');
const viewSource = fs.readFileSync(path.resolve(__dirname, '../DeckBuilderMelsView.tsx'), 'utf8');

describe('DeckBuilder laptop-width policy', () => {
  it('reserves the central canvas by compacting both tertiary rails at 1280px', () => {
    expect(css).toContain('@media (max-width: 1365px)');
    expect(css).toContain("[data-testid='mels-left-rail']");
    expect(css).toContain('width: 48px !important');
    expect(css).toContain("[data-testid='mels-right-rail']");
    expect(css).toContain('width: 56px !important');
    expect(css).toContain("[data-testid='mels-right-rail']:has(");
    expect(css).toContain('width: 336px !important');
    expect(css).toContain(':focus-within');
  });

  it('turns Teresa into a non-layout overlay while retaining the command row', () => {
    expect(css).toContain("[data-testid='mels-ai-entry']");
    expect(css).toContain('position: absolute');
    expect(css).toContain("[data-testid='mels-topbar-chips']");
    expect(css).toContain('visibility: visible');
  });

  it('fits the host content area instead of creating a viewport-height inner scroller', () => {
    expect(viewSource).toContain('className="h-full flex flex-col bg-c-surface overflow-hidden"');
    expect(viewSource).not.toContain(
      'className="h-screen flex flex-col bg-c-surface overflow-hidden"'
    );
  });

  it('restores thumbnail-list visibility and interaction when the compact rail opens', () => {
    expect(css).toContain("[data-testid='mels-left-rail']:hover");
    expect(css).toContain("[data-testid='mels-left-rail']:focus-within");
    expect(css).toContain("[data-testid='mels-left-rail-list']");
    expect(css).toContain('visibility: visible');
    expect(css).toContain('pointer-events: auto');
  });
});
