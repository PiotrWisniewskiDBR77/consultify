/**
 * @vitest-environment jsdom
 *
 * HELP §5: when the Method Pack has no help content for a question, the UI
 * shows an explicit "Help content unavailable" — Teresa must never invent a
 * substitute.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { QuestionHelpDisclosure } from '../QuestionHelpDisclosure';
import { makeQuestion } from './fixtures';

describe('QuestionHelpDisclosure', () => {
  it('renders inline help when the pack provides content', () => {
    render(<QuestionHelpDisclosure question={makeQuestion()} help={null} onAskTeresa={vi.fn()} />);
    expect(screen.getByTestId('question-help-disclosure')).toBeInTheDocument();
    expect(screen.getByText(/Chodzi o to, czy istnieje spisany opis/)).toBeInTheDocument();
  });

  it('shows the explicit "Help content unavailable" state when the pack has no help copy', () => {
    const bareQuestion = makeQuestion({
      plainLanguageExplanation: '',
      whyItMatters: '',
      positiveAnswerExample: '',
    });
    render(<QuestionHelpDisclosure question={bareQuestion} help={null} onAskTeresa={vi.fn()} />);
    expect(screen.getByTestId('question-help-unavailable')).toHaveTextContent('Help content unavailable');
    expect(screen.queryByTestId('question-help-disclosure')).not.toBeInTheDocument();
  });

  it('expands the examples drawer progressively (level 2 help)', () => {
    render(<QuestionHelpDisclosure question={makeQuestion()} help={null} onAskTeresa={vi.fn()} />);
    expect(screen.queryByText(/Mamy spisaną procedurę/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Przykład i dowody'));
    expect(screen.getByText(/Mamy spisaną procedurę/)).toBeInTheDocument();
  });

  it('routes "Zapytaj Teresę" to the caller instead of duplicating the Teresa panel', () => {
    const onAskTeresa = vi.fn();
    render(<QuestionHelpDisclosure question={makeQuestion()} help={null} onAskTeresa={onAskTeresa} />);
    fireEvent.click(screen.getByText('Zapytaj Teresę'));
    expect(onAskTeresa).toHaveBeenCalledWith('explain');
  });
});
