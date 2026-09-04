import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IdeaNotebookRightPanelPrototypeGate } from '../IdeaNotebookRightPanelPrototype';

describe('IdeaNotebookRightPanelPrototype flag contract', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
  });
  afterEach(cleanup);

  it('keeps the current DOM unchanged when no override or environment value exists', () => {
    const { container } = render(<IdeaNotebookRightPanelPrototypeGate context="idea" ariaLabel="Panel narzędzi idei" legacy={<div data-testid="legacy">Dzisiejszy panel</div>} />);
    expect(container.innerHTML).toBe('<div data-testid="legacy">Dzisiejszy panel</div>');
  });

  it('keeps the current DOM unchanged when the flag is explicitly OFF', () => {
    window.history.replaceState({}, '', '/?ff_idea_notebook_right_panel_prototype=0');
    render(<IdeaNotebookRightPanelPrototypeGate context="notebook" ariaLabel="Panel narzędzi notatki" legacy={<div data-testid="legacy">Legacy</div>} />);
    expect(screen.getByTestId('legacy')).toBeTruthy();
    expect(screen.queryByLabelText('Szczegóły notatki')).toBeNull();
  });

  it('renders the same prototype shell for the Idea context when ON', () => {
    window.localStorage.setItem('ff.ideaNotebookRightPanelPrototype', '1');
    render(<IdeaNotebookRightPanelPrototypeGate context="idea" ariaLabel="Panel narzędzi idei" legacy={<div>Legacy</div>} />);
    expect(screen.getByLabelText('Szczegóły idei')).toBeTruthy();
    expect(document.querySelector('[data-artifact-section="properties"]')).toBeTruthy();
  });

  it('renders the same prototype shell for the Notebook context when ON', () => {
    window.localStorage.setItem('ff.ideaNotebookRightPanelPrototype', '1');
    render(<IdeaNotebookRightPanelPrototypeGate context="notebook" ariaLabel="Panel narzędzi notatki" legacy={<div>Legacy</div>} />);
    expect(screen.getByLabelText('Szczegóły notatki')).toBeTruthy();
    expect(document.querySelector('[data-artifact-section="relations"]')).toBeTruthy();
  });

  it('supports a visible-focus Tab cycle and closes one panel layer with Escape', async () => {
    window.localStorage.setItem('ff.ideaNotebookRightPanelPrototype', '1');
    const onClose = vi.fn();
    render(<IdeaNotebookRightPanelPrototypeGate context="idea" ariaLabel="Panel narzędzi idei" onClose={onClose} legacy={<div>Legacy</div>} />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Zamknij panel' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Zamknij panel' }).className).toContain('focus-visible:ring-2');
    await user.tab();
    expect(screen.getByRole('button', { name: /Actions|Akcje/ })).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText('Szczegóły idei'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
