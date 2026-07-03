/**
 * R3 — DocTableBlock render tests (zebra, header, risk semantics).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DocTableBlock } from '../../../../src/components/DocumentStudio/blocks/DocTableBlock';
import { narrowTableContent } from '../../../../src/components/DocumentStudio/blocks/docBlockContent';

describe('DocTableBlock', () => {
  it('renders bold header + body cells from narrowed dual-key content', () => {
    const content = narrowTableContent({
      headers: ['Name', 'Score'],
      data: [{ Name: 'Alpha', Score: 90 }],
    })!;
    render(<DocTableBlock content={content} />);
    const th = screen.getByText('Name');
    expect(th.tagName).toBe('TH');
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('90')).toBeTruthy();
  });

  it('applies zebra striping (odd rows tinted)', () => {
    const content = narrowTableContent({
      columns: ['c'],
      rows: [['r0'], ['r1'], ['r2']],
    })!;
    const { container } = render(<DocTableBlock content={content} />);
    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(3);
    // row index 1 is the zebra-striped one
    expect((bodyRows[1] as HTMLElement).style.background).toBe('rgb(248, 250, 252)');
  });

  it('colours Impact cell under riskSemantics while keeping the label', () => {
    const content = narrowTableContent(
      { columns: ['Risk', 'Impact'], rows: [['Outage', 'High']] },
      { riskSemantics: true }
    )!;
    const { container } = render(<DocTableBlock content={content} />);
    const high = screen.getByText('High');
    expect(high.tagName).toBe('TD');
    // label preserved; a non-default background was applied
    const bg = (high as HTMLElement).style.background;
    expect(bg).not.toBe('');
    expect(container.textContent).toContain('High');
  });
});
