/**
 * [ODMROZENIE 02_INTERVIEW DEC-557] D-44 — freeze the Required-badge contrast
 * fix in `InterviewSingleQuestionRuntime.tsx` (immersive interview shell).
 *
 * WHAT THIS FILE GUARDS (CTO pixel measurement, `akcepty-wdr23-20260917/IS-2.png`):
 *   The immersive Required badge rendered `text-danger-400` (#ED5541 =
 *   rgb(237,85,65)) on `bg-danger-500/10` over the LIGHT card (`bg-white` =
 *   rgb(253,230,235) composited) in BOTH themes: contrast 2.96:1 < 4.5 AA.
 *   Fixed like the non-immersive branch and the DEC-557 hint: light uses
 *   `text-danger-600` (#C1042F -> 5.32:1 on that background), dark keeps
 *   `dark:text-danger-400` (~4.9:1 on the dark card).
 *
 * MUTATION PROOF: restoring bare `text-danger-400` in the immersive branch
 * turns the test red.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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

import { InterviewSingleQuestionRuntime } from '../InterviewSingleQuestionRuntime';
import type { InterviewQuestion } from '../QuestionsList';

const questions: InterviewQuestion[] = [
  {
    id: 'q-req-1',
    sessionId: 's-d44',
    category: 'general',
    questionText: 'What are the top 3 KPIs you use to measure operational performance?',
    answerText: '',
    answerType: 'open',
    status: 'in_progress',
    confidenceScore: 0,
    tags: [],
    sortOrder: 1,
    isTemplate: false,
    isRequired: true,
  },
];

const baseProps = {
  questions,
  evidence: [],
  activeCategory: 'general' as const,
  onCategoryChange: vi.fn(),
  onUpdateQuestion: vi.fn(),
  onUploadFile: vi.fn(),
  onAddLink: vi.fn(),
  onAddVoiceEvidence: vi.fn(),
  onSubmitSession: vi.fn(),
};

describe('D-44 — immersive Required badge meets AA contrast in light theme', () => {
  it('immersive Required badge uses text-danger-600 (light AA) with dark:text-danger-400, not bare text-danger-400', () => {
    render(<InterviewSingleQuestionRuntime {...baseProps} immersive />);
    const badge = screen.getByText('interview.singleQuestionRuntime.required');
    const classes = badge.className.split(/\s+/);
    expect(classes).toContain('text-danger-600');
    expect(classes).toContain('dark:text-danger-400');
    // Bare `text-danger-400` (without the dark: variant) = the 2.96:1 regression.
    expect(classes).not.toContain('text-danger-400');
  });

  it('non-immersive Required badge keeps the same AA pair', () => {
    render(<InterviewSingleQuestionRuntime {...baseProps} />);
    const badge = screen.getByText('interview.singleQuestionRuntime.required');
    const classes = badge.className.split(/\s+/);
    expect(classes).toContain('text-danger-600');
    expect(classes).toContain('dark:text-danger-400');
    expect(classes).not.toContain('text-danger-400');
  });
});
