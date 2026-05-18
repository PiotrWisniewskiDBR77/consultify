import { describe, expect, it } from 'vitest';

import {
  getWhiteboardModeCopy,
  getWhiteboardShortcuts,
} from '@/components/MyWork/whiteboard/whiteboardInteractionGrammar';

describe('whiteboardInteractionGrammar', () => {
  it('explains draw mode as a separate overlay that can be exited explicitly', () => {
    const copy = getWhiteboardModeCopy('draw', false, false);

    expect(copy.modeLabel).toBe('Draw mode');
    expect(copy.toggleLabel).toBe('Canvas');
    expect(copy.exitHint).toContain('Esc');
  });

  it('explains locked board mode honestly', () => {
    const copy = getWhiteboardModeCopy('board', true, true);

    expect(copy.modeLabel).toBe('Tryb boardu');
    expect(copy.helper).toContain('tylko do odczytu');
  });

  it('exposes only the small trusted shortcut set for whiteboard help', () => {
    const shortcuts = getWhiteboardShortcuts(false).map((item) => item.key);

    expect(shortcuts).toEqual(['?', 'Escape', 'Ctrl+S']);
  });
});
