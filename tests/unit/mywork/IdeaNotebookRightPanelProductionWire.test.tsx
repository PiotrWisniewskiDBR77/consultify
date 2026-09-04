import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { IdeaRightPanel } from '@/components/standard/IdeaRightPanel';

const props = {
  isPolish: true,
  title: 'Idea produkcyjna 342',
  propertiesContent: <div data-testid="real-properties">Realne właściwości idei</div>,
  relationsContent: <div data-testid="real-relations">Realne powiązania idei</div>,
  teresaContent: <div data-testid="real-history">Realna historia idei</div>,
};

describe('Day342 production right-panel wire', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
  });
  afterEach(cleanup);

  it('keeps the real Idea panel DOM unchanged with the prototype flag OFF', () => {
    const { container } = render(<IdeaRightPanel {...props} />);
    expect(container.querySelector('aside[aria-label="Idea produkcyjna 342"]')).toBeNull();
    expect(container.querySelector('[data-artifact-section="properties"]')).toBeTruthy();
    expect(container.querySelector('[data-artifact-section="relations"]')).toBeTruthy();
  });

  it('renders the shared shell with real Idea sections in the production component when ON', () => {
    window.localStorage.setItem('ff.ideaNotebookRightPanelPrototype', '1');
    render(<IdeaRightPanel {...props} />);
    expect(screen.getByLabelText('Idea produkcyjna 342')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Properties|Właściwości/ }));
    fireEvent.click(screen.getByRole('button', { name: /Relations|Powiązania/ }));
    expect(screen.getByTestId('real-properties')).toHaveTextContent('Realne właściwości idei');
    expect(screen.getByTestId('real-relations')).toHaveTextContent('Realne powiązania idei');
    expect(screen.getByTestId('real-history')).toHaveTextContent('Realna historia idei');
  });

  it('KONTRAKT DLA DYŻURU 345 — keeps one landmark, token width and stable accessible name when ON', () => {
    const off = render(<IdeaRightPanel {...props} />);
    expect(off.container.querySelector('aside')).toHaveAttribute(
      'aria-label',
      'Panel narzędzi idei'
    );
    off.unmount();

    window.localStorage.setItem('ff.ideaNotebookRightPanelPrototype', '1');
    const on = render(<IdeaRightPanel {...props} />);
    const asides = on.container.querySelectorAll('aside');
    expect(asides).toHaveLength(1);
    expect(asides[0]).toHaveAttribute('aria-label', 'Panel narzędzi idei');
    expect(on.container.firstElementChild).toHaveStyle({
      width: 'var(--ntype-right-panel-width)',
      minWidth: 'var(--ntype-right-panel-width)',
    });
  });

  it('keeps artifactRightRail superior when both competing flags are ON', () => {
    window.localStorage.setItem('ff.artifact.right_rail', '1');
    window.localStorage.setItem('ff.ideaNotebookRightPanelPrototype', '1');
    render(<IdeaRightPanel {...props} />);
    expect(screen.getByTestId('idea-artifact-right-rail')).toBeTruthy();
    expect(document.querySelector('aside[aria-label="Idea produkcyjna 342"]')).toBeNull();
  });
});
