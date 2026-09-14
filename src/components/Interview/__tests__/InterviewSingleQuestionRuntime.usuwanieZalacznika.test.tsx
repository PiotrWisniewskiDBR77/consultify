/**
 * P-T15 (uwaga testera XV: „Wywiad — brak możliwości usuwania dodanych
 * załączników") — test RENDERU panelu odpowiedzi.
 *
 * PREMISA ZMIERZONA NA LINII `1154ebd809`: kosz przy załączniku ISTNIAŁ w DOM,
 * ale stał z atrybutem `disabled` i klasą `cursor-not-allowed`
 * (`InterviewSingleQuestionRuntime.tsx:2434` i `:2460` przed naprawą), a
 * `InterviewSingleQuestionRuntimeProps` nie miało ani jednego wołacza
 * usuwania. Trasa serwera BYŁA gotowa (`interview.routes.ts:470`
 * `DELETE /interview/evidence/:evidenceId` → `InterviewController.deleteEvidence`)
 * i workspace miał już `handleDeleteEvidence` (`InterviewWorkspace.tsx:1550`)
 * — brakowało JEDNEGO PRZEWODU między nimi. To jest kształt „zbudowane, ale
 * niepodłączone", więc test patrzy na DOM i na wołanie, nie na źródło.
 *
 * Sprawdzane:
 *  1. jedno kliknięcie NIE kasuje — najpierw pyta (potwierdzenie ze zlecenia);
 *  2. potwierdzenie woła `onDeleteEvidence` z ID tego załącznika;
 *  3. „Anuluj" nie woła niczego;
 *  4. UPRAWNIENIA JAK PRZY DODAWANIU: przy `readOnly` kosza NIE MA w ogóle
 *     (a nie: jest i jest martwy — to był właśnie defekt);
 *  5. bez `onDeleteEvidence` (stary wołacz) kosz się nie renderuje.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/services/api', () => ({
  Api: {},
  API_URL: 'http://local.test/api',
  getHeaders: () => ({}),
}));
vi.mock('../../shared/NModeBlocks/ArtifactAttachPopover', () => ({
  ArtifactAttachPopover: () => null,
}));

import type { InterviewEvidence } from '../EvidencePanel';
import { InterviewSingleQuestionRuntime } from '../InterviewSingleQuestionRuntime';
import type { InterviewQuestion } from '../QuestionsList';

const questions: InterviewQuestion[] = [
  {
    id: 'q-1',
    sessionId: 'session-1',
    category: 'general',
    questionText: 'What outcome must this transformation deliver?',
    answerText: 'Shorter close cycle.',
    answerType: 'open',
    status: 'answered',
    confidenceScore: 60,
    tags: [],
    sortOrder: 1,
    isTemplate: false,
  },
];

/** Załącznik-plik (chip), czyli dokładnie to, co dodaje tester w panelu. */
const evidence: InterviewEvidence[] = [
  {
    id: 'ev-1',
    sessionId: 'session-1',
    questionId: 'q-1',
    category: 'general',
    evidenceType: 'file',
    name: 'close-calendar.xlsx',
    title: 'close-calendar.xlsx',
    mimeType: 'application/vnd.ms-excel',
    uploadedAt: '2026-09-10T08:00:00.000Z',
  },
];

const baseProps = {
  questions,
  evidence,
  activeCategory: 'general' as const,
  onCategoryChange: vi.fn(),
  onUpdateQuestion: vi.fn(),
  onUploadFile: vi.fn(),
  onAddLink: vi.fn(),
  onAddVoiceEvidence: vi.fn(),
  onSubmitSession: vi.fn(),
};

const kosz = () => screen.queryByRole('button', { name: 'interview.singleQuestionRuntime.remove' });

describe('P-T15 — usuwanie załącznika w panelu odpowiedzi Wywiadu', () => {
  it('jedno kliknięcie pyta, dopiero potwierdzenie usuwa', async () => {
    const onDeleteEvidence = vi.fn().mockResolvedValue(undefined);
    render(<InterviewSingleQuestionRuntime {...baseProps} onDeleteEvidence={onDeleteEvidence} />);

    const przycisk = kosz();
    expect(przycisk).not.toBeNull();
    expect(przycisk).not.toBeDisabled();

    fireEvent.click(przycisk as HTMLElement);
    // Pytanie widoczne, kasowania JESZCZE nie ma.
    expect(screen.getByText('Remove attachment?')).toBeTruthy();
    expect(onDeleteEvidence).not.toHaveBeenCalled();

    // Po kliknięciu kosza jego miejsce zajmuje para „Usuń / Anuluj" — nazwa
    // przycisku potwierdzenia idzie z tego samego klucza co aria-label kosza.
    fireEvent.click(
      screen.getByRole('button', { name: 'interview.singleQuestionRuntime.remove' })
    );
    await waitFor(() => expect(onDeleteEvidence).toHaveBeenCalledWith('ev-1'));
  });

  it('„Anuluj" zamyka pytanie i nie usuwa niczego', () => {
    const onDeleteEvidence = vi.fn();
    render(<InterviewSingleQuestionRuntime {...baseProps} onDeleteEvidence={onDeleteEvidence} />);

    fireEvent.click(kosz() as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Remove attachment?')).toBeNull();
    expect(onDeleteEvidence).not.toHaveBeenCalled();
  });

  it('readOnly ⇒ kosza NIE MA (uprawnienia jak przy dodawaniu, nie martwy przycisk)', () => {
    render(
      <InterviewSingleQuestionRuntime
        {...baseProps}
        readOnly
        onDeleteEvidence={vi.fn()}
      />
    );
    expect(kosz()).toBeNull();
  });

  it('stary wołacz bez `onDeleteEvidence` ⇒ kosza nie ma (zero martwego DOM)', () => {
    render(<InterviewSingleQuestionRuntime {...baseProps} />);
    expect(kosz()).toBeNull();
  });
});
