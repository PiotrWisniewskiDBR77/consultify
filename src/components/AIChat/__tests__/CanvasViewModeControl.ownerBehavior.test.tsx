import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  CanvasViewModeControl,
  type CanvasViewMode,
} from '@/components/AIChat/CanvasViewModeControl';

function Harness() {
  const [mode, setMode] = useState<CanvasViewMode>('rich');
  const [canonicalContent] = useState('# Client plan\n\nPreserve this content.');
  return (
    <>
      <CanvasViewModeControl mode={mode} onModeChange={setMode} />
      <output data-testid="active-mode">{mode}</output>
      <output data-testid="canonical-content">{canonicalContent}</output>
    </>
  );
}

describe('Canvas direct Rich/DOC/MD view control', () => {
  it('switches all three direct modes without modifying canonical content', () => {
    render(<Harness />);
    const content = '# Client plan Preserve this content.';
    expect(screen.getByTestId('canonical-content')).toHaveTextContent(content);

    fireEvent.click(screen.getByRole('radio', { name: 'DOC' }));
    expect(screen.getByTestId('active-mode')).toHaveTextContent('document');
    expect(screen.getByRole('radio', { name: 'DOC' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'MD' }));
    expect(screen.getByTestId('active-mode')).toHaveTextContent('md');
    expect(screen.getByTestId('canonical-content')).toHaveTextContent(content);
  });

  it('supports wrapped arrows plus Home/End with roving focus', () => {
    render(<Harness />);
    const rich = screen.getByRole('radio', { name: 'Rich' });
    rich.focus();
    fireEvent.keyDown(rich, { key: 'ArrowLeft' });
    const md = screen.getByRole('radio', { name: 'MD' });
    expect(md).toHaveFocus();
    expect(md).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(md, { key: 'Home' });
    expect(rich).toHaveFocus();
    fireEvent.keyDown(rich, { key: 'End' });
    expect(md).toHaveFocus();
  });
});

