/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { Menu2AIButton } from '../NModeMenu2';

describe('DEC-524 Menu2AIButton', () => {
  it('uses the neutral shell palette and contains no c-ai token', () => {
    render(<Menu2AIButton />);

    const button = screen.getByRole('button', { name: 'Analyze with AI' });
    expect(button).toHaveClass(
      'border-c-border-subtle',
      'bg-c-surface',
      'text-c-text-secondary',
      'hover:bg-c-surface-raised',
      'hover:text-c-text'
    );
    expect(button.className).not.toContain('c-ai');
  });
});
