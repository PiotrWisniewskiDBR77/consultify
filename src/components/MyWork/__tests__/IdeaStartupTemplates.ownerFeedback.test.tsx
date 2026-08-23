import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaStartupTemplates } from '../table/IdeaStartupTemplates';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

describe('IdeaStartupTemplates owner feedback', () => {
  const DialogHarness = () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open New Idea
        </button>
        <IdeaStartupTemplates open={open} onClose={() => setOpen(false)} onSelect={vi.fn()} />
      </>
    );
  };

  it('starts focused in the idea description and offers an explicit cancel path', async () => {
    const onClose = vi.fn();
    render(<IdeaStartupTemplates open onClose={onClose} onSelect={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('textbox').closest('textarea')).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('starts with three neutral, unselected action cards', () => {
    render(<IdeaStartupTemplates open onClose={vi.fn()} onSelect={vi.fn()} />);

    const ai = screen.getByRole('button', { name: /Start with AI/ });
    const blank = screen.getByRole('button', { name: /Blank canvas/ });
    const template = screen.getByRole('button', {
      name: /myWorkTable\.ideaStartupTemplates\.useTemplate/,
    });

    for (const card of [ai, blank, template]) expect(card).toHaveAttribute('aria-pressed', 'false');
    expect(template.className).not.toContain('border-c-success');
    expect(template.className).toContain('border-c-border-subtle');
  });

  it('preserves optional brief content across Hide/Add and restores focus into the brief', () => {
    render(<IdeaStartupTemplates open onClose={vi.fn()} onSelect={vi.fn()} />);

    const toggle = screen.getByRole('button', {
      name: /myWorkTable\.ideaStartupTemplates\.addBrief/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);

    const problem = screen.getByPlaceholderText('myWorkTable.ideaStartupTemplates.problem');
    expect(problem).toHaveFocus();
    fireEvent.change(problem, { target: { value: 'Reduce lead time' } });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);

    expect(screen.getByPlaceholderText('myWorkTable.ideaStartupTemplates.problem')).toHaveValue(
      'Reduce lead time'
    );
    expect(screen.getByPlaceholderText('myWorkTable.ideaStartupTemplates.problem')).toHaveFocus();
  });

  it('does not start globally when Enter is used while writing', () => {
    const onSelect = vi.fn();
    render(<IdeaStartupTemplates open onClose={vi.fn()} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /Start with AI/ }));
    const description = screen.getAllByRole('textbox')[0];
    fireEvent.change(description, { target: { value: 'Line one' } });
    fireEvent.keyDown(description, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: /myWorkTable\.ideaStartupTemplates\.addBrief/ })
    );
    for (const field of [
      screen.getByLabelText('myWorkTable.ideaStartupTemplates.problem'),
      screen.getByLabelText('myWorkTable.ideaStartupTemplates.goalOutcome'),
      screen.getByLabelText('myWorkTable.ideaStartupTemplates.constraintsOnePerLine'),
    ]) {
      fireEvent.keyDown(field, { key: 'Enter' });
      expect(onSelect).not.toHaveBeenCalled();
    }

    const selectedCard = screen.getByRole('button', { name: /Start with AI/ });
    selectedCard.focus();
    fireEvent.keyDown(selectedCard, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the invoker after explicit Cancel', async () => {
    render(<DialogHarness />);
    const invoker = screen.getByRole('button', { name: 'Open New Idea' });
    invoker.focus();
    fireEvent.click(invoker);
    await waitFor(() => expect(screen.getByLabelText(/describeTheProblemIdeaOr/)).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(invoker).toHaveFocus());
  });

  it('exposes selected workspace state and responsive stacking contracts', () => {
    render(<IdeaStartupTemplates open onClose={vi.fn()} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Mind Map' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Process Flow' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('group', { name: /n1ChooseYourTool/ })).toHaveClass(
      'grid-cols-2',
      'sm:grid-cols-4'
    );
    expect(screen.getByRole('group', { name: /n2ChooseAStart/ })).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-3'
    );
  });
});
