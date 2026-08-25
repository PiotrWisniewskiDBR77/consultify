/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { Search } from 'lucide-react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExecutiveModuleShell } from '../index';

const renderShell = (overrides: Partial<React.ComponentProps<typeof ExecutiveModuleShell>> = {}) =>
  render(
    <ExecutiveModuleShell
      moduleKey="ideas-element-rail-test"
      moduleLabel="Ideas"
      title="Idea"
      topBarChips={[]}
      leftRailContent={<div>Left</div>}
      rightRailTools={[{ id: 'search', label: 'Search', icon: Search }]}
      canvas={<div>Canvas</div>}
      persistRailState={false}
      {...overrides}
    />
  );

describe('ExecutiveModuleShell element inspector rail', () => {
  afterEach(() => window.localStorage.clear());

  it('does not add an empty rail when the additive prop is omitted', () => {
    renderShell();
    expect(screen.getAllByTestId('mels-right-rail')).toHaveLength(1);
    expect(screen.queryByTestId('mels-element-inspector-rail')).not.toBeInTheDocument();
  });

  it('renders the information rail on the left and the independent element rail on the right', () => {
    renderShell({
      inspectorRailSide: 'left',
      elementInspectorRail: <div>Element details</div>,
    });
    expect(screen.getByTestId('mels-left-inspector-rail')).toBeInTheDocument();
    expect(screen.getByTestId('mels-element-inspector-rail')).toHaveTextContent('Element details');
  });

  it('resizes only the element inspector', () => {
    const onElementWidth = vi.fn();
    renderShell({
      inspectorRailSide: 'left',
      elementInspectorRail: <div>Element details</div>,
      elementInspectorWidth: 400,
      onElementInspectorWidthChange: onElementWidth,
    });
    const informationRail = screen.getByTestId('mels-left-inspector-rail');
    const informationWidth = informationRail.getAttribute('style');
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize element inspector' }), {
      key: 'ArrowLeft',
    });
    expect(onElementWidth).toHaveBeenCalledWith(408);
    expect(informationRail.getAttribute('style')).toBe(informationWidth);
  });

  it('announces the clamped 320–560 range', () => {
    renderShell({ elementInspectorRail: <div>Element details</div>, elementInspectorWidth: 900 });
    const separator = screen.getByRole('separator', { name: 'Resize element inspector' });
    expect(separator).toHaveAttribute('aria-valuemin', '320');
    expect(separator).toHaveAttribute('aria-valuemax', '560');
    expect(separator).toHaveAttribute('aria-valuenow', '560');
  });
});
