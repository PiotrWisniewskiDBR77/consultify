/**
 * @vitest-environment jsdom
 *
 * CB-05/RB-044 — the split-control chevron used to hardcode the English word
 * "options" appended to a (possibly Polish) label, producing mixed-language
 * accessible names like "Utwórz options". It must now route through
 * `t('canvas.toolbarPrimitives.moreOptionsFor', ...)` instead of a literal
 * template string.
 */
import { render } from '@testing-library/react';
import { Plus } from 'lucide-react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { CanvasToolbarDropdown } from '../CanvasToolbarPrimitives';

describe('CanvasToolbarDropdown chevron accessible name', () => {
  it('never renders the old hardcoded "<label> options" English suffix, and still names the control', () => {
    const { container } = render(
      <CanvasToolbarDropdown
        icon={Plus}
        label="Utwórz"
        items={[{ id: 'a', label: 'A', onClick: () => {} }]}
        onMainClick={() => {}}
      />
    );
    const buttons = container.querySelectorAll('button');
    const chevronBtn = Array.from(buttons).find((b) => b.hasAttribute('aria-haspopup'));
    expect(chevronBtn).toBeTruthy();
    expect(chevronBtn?.getAttribute('aria-label')).not.toBe('Utwórz options');
    expect(chevronBtn?.getAttribute('aria-label')).toContain('Utwórz');
  });
});
