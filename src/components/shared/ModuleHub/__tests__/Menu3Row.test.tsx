/**
 * Menu3Row smoke tests
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MENU_3_INNER_CLASS, MENU_3_LEFT_CLASS, MENU_3_RIGHT_CLASS } from '../../ModuleMenu3';
import { Menu3Row } from '../Menu3Row';

describe('Menu3Row', () => {
  it('renders left and right slots inside the canonical inner row', () => {
    const { container } = render(
      <Menu3Row left={<span>Preset chips</span>} right={<button>Action</button>} />
    );

    expect(screen.getByText('Preset chips')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();

    const inner = container.firstChild as HTMLElement;
    // Uses the canonical MENU_3 inner / left / right class tokens.
    expect(inner.className).toContain(MENU_3_INNER_CLASS.split(' ')[0]);
    expect(container.innerHTML).toContain(MENU_3_LEFT_CLASS.split(' ')[0]);
    expect(container.innerHTML).toContain(MENU_3_RIGHT_CLASS.split(' ')[0]);
  });

  it('merges extra className onto the inner row', () => {
    const { container } = render(<Menu3Row className="custom-row" left={null} right={null} />);
    expect((container.firstChild as HTMLElement).className).toContain('custom-row');
  });
});
