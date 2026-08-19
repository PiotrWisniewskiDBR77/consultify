import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ToolProcessDiagram } from '../ToolProcessDiagram';

describe('ToolProcessDiagram', () => {
  it('renders distinct semantic process sequences for SWOT and Market Forces', () => {
    const { rerender } = render(<ToolProcessDiagram toolType="dynamic-swot" isPolish={false} />);
    const swot = screen.getByRole('list');
    expect(within(swot).getAllByRole('listitem')).toHaveLength(4);
    expect(within(swot).getByText('Frame the decision')).toBeInTheDocument();

    rerender(<ToolProcessDiagram toolType="market-forces" isPolish={false} />);
    const market = screen.getByRole('list');
    expect(within(market).getAllByRole('listitem')).toHaveLength(4);
    expect(within(market).getByText('Define the market')).toBeInTheDocument();
    expect(within(market).queryByText('Frame the decision')).not.toBeInTheDocument();
  });
});
