/**
 * @vitest-environment jsdom
 *
 * DEC-415 — trzy uwagi właściciela z przejścia 06.09 15:10, część widoczna
 * w `InterviewFocusPanel`:
 *  (A) po wyborze stanu CAŁA karta pytania dostaje lewą krawędź i tło w
 *      kolorze semantycznym („bardzo trudno się tym zarządza"),
 *  (C) „Podyktuj" dopisuje rozpoznany tekst do pola „Twoja odpowiedź"
 *      (nie zastępuje) — sterowane prawdziwym zdarzeniem `result`
 *      przeglądarkowego `SpeechRecognition`, którego atrapę wstrzykujemy
 *      w miejsce hardware'u.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Globalny mock w `tests/setup.ts` przybija język do 'en'. Tutaj interesuje
// nas dowód, że `lang` rozpoznawania mowy IDZIE Z i18n (właściciel pracuje po
// polsku), więc nadpisujemy mock lokalnie na 'pl'.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'pl', changeLanguage: vi.fn() },
    ready: true,
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import { InterviewFocusPanel } from '../InterviewFocusPanel';
import { makeInterviewFocusQuestion, makeResolutionData } from './fixtures';

// ---------------------------------------------------------------------------
// Atrapa Web Speech API — pozwala wysterować zdarzenie `result` ręcznie,
// dokładnie tak, jak zrobiłaby to przeglądarka po rozpoznaniu mowy.
// ---------------------------------------------------------------------------
let lastRecognition: FakeRecognition | null = null;

class FakeRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastRecognition = this;
  }
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.started = false;
  }
  emitFinal(text: string): void {
    this.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: text }], { isFinal: true })],
    });
  }
}

function installWebSpeech(): void {
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
    FakeRecognition;
  (navigator as unknown as { mediaDevices: unknown }).mediaDevices = {
    getUserMedia: vi.fn(),
  };
}

afterEach(() => {
  lastRecognition = null;
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  delete (navigator as unknown as { mediaDevices?: unknown }).mediaDevices;
});

function renderPanel(
  question: ReturnType<typeof makeInterviewFocusQuestion>,
  onAnswerChange = vi.fn()
) {
  const utils = render(
    <InterviewFocusPanel
      breadcrumb={['DRD', 'Procesy Sprzedaży', 'Poziom 3']}
      questions={[question]}
      questionIndex={2}
      questionTotal={7}
      resolutionData={makeResolutionData()}
      onAnswerChange={onAnswerChange}
      onAnswerStateChange={vi.fn()}
      onResolutionAction={vi.fn()}
      onEvidenceDrop={vi.fn()}
      onBack={vi.fn()}
      onSave={vi.fn()}
      onNext={vi.fn()}
      onSkip={vi.fn()}
      onAskTeresa={vi.fn()}
      canGoBack
      canGoNext
    />
  );
  return { ...utils, onAnswerChange };
}

describe('(A) karta pytania niesie kolor wybranego stanu odpowiedzi', () => {
  it('„Potwierdzone" → zielona lewa krawędź na CAŁEJ karcie', () => {
    const q = makeInterviewFocusQuestion({ answerState: 'confirmed' });
    renderPanel(q);
    const card = screen.getByTestId(`question-card-${q.question.questionId}`);
    expect(card.className).toContain('border-l-4');
    expect(card.className).toContain('border-l-c-success');
    expect(card.getAttribute('data-answer-state')).toBe('confirmed');
  });

  it('„Częściowo" → pomarańczowa lewa krawędź, nigdy zielona', () => {
    const q = makeInterviewFocusQuestion({ answerState: 'partial' });
    renderPanel(q);
    const card = screen.getByTestId(`question-card-${q.question.questionId}`);
    expect(card.className).toContain('border-l-c-warning');
    expect(card.className).not.toContain('c-success');
  });

  it('bez odpowiedzi karta zostaje neutralna — kolor pojawia się dopiero po wyborze', () => {
    const q = makeInterviewFocusQuestion({ answerState: null });
    renderPanel(q);
    const card = screen.getByTestId(`question-card-${q.question.questionId}`);
    expect(card.className).not.toContain('border-l-4');
    expect(card.getAttribute('data-answer-state')).toBe('unanswered');
  });

  it('wybrany przycisk stanu jest wypełniony tym samym kolorem co karta', () => {
    const q = makeInterviewFocusQuestion({ answerState: 'confirmed' });
    renderPanel(q);
    const button = screen.getByRole('radio', { name: /Potwierdzone/ });
    expect(button.className).toMatch(/bg-c-success\/15/);
    expect(button.className).toContain('border-c-success');
  });
});

describe('(C) „Podyktuj" — rozpoznany tekst dopisuje się do pola odpowiedzi', () => {
  it('zdarzenie `result` z przeglądarkowego STT dopisuje tekst, nie zastępuje istniejącego', async () => {
    installWebSpeech();
    const q = makeInterviewFocusQuestion({ answerText: 'Wstępna notatka.' });
    const { onAnswerChange } = renderPanel(q);

    const toggle = screen.getByTestId('voice-channel-toggle');
    // Web Speech jest dostępne → bierzemy drogę przeglądarki, nie serwerową.
    expect(toggle.getAttribute('data-stt-provider')).toBe('web');

    fireEvent.click(toggle);
    expect(screen.getByTestId('voice-channel-toggle')).toHaveTextContent('Słucham…');
    expect(lastRecognition).toBeTruthy();
    expect(lastRecognition!.lang).toBe('pl-PL');

    await act(async () => {
      lastRecognition!.emitFinal('proces jest udokumentowany');
    });

    expect(onAnswerChange).toHaveBeenCalledWith(
      q.question.questionId,
      'Wstępna notatka. proces jest udokumentowany'
    );
  });

  it('drugi fragment dopisuje się do pierwszego, a nie nadpisuje go', async () => {
    installWebSpeech();
    const q = makeInterviewFocusQuestion({ answerText: '' });
    const { onAnswerChange } = renderPanel(q);

    fireEvent.click(screen.getByTestId('voice-channel-toggle'));
    await act(async () => {
      lastRecognition!.emitFinal('pierwszy fragment');
    });
    await act(async () => {
      lastRecognition!.emitFinal('drugi fragment');
    });

    expect(onAnswerChange).toHaveBeenLastCalledWith(
      q.question.questionId,
      'pierwszy fragment drugi fragment'
    );
  });
});
