/**
 * [ODMROZENIE 02_INTERVIEW DEC-557] Wpis 43 — freeze two P1 fixes in
 * `InterviewSingleQuestionRuntime.tsx` (immersive interview shell).
 *
 * WHAT THIS FILE GUARDS (measured pixel-wise in the real Hub shell via the
 * dev-render harness `u05-sesja-wywiadu-powloka`, 1440x900, lang=en):
 *   1. An answered/approved question in the left navigation rail carried
 *      `line-through` (6 struck-through questions on staging). Dimming
 *      (`opacity-50`) and the checkmark already exist, so the strike-through
 *      only hurt legibility — removed. The question stays readable, dimmed.
 *   2. The hint block in the `immersive` variant rendered the DARK-background
 *      variant (`text-amber-400/70` label, `text-amber-200/90` content) on a
 *      LIGHT card (`bg-white`): pixel contrast 1.70:1 (label) and 1.28:1
 *      (content) in light theme, 4.32:1 (label) in dark — all < 4.5:1.
 *      Fixed with the `text-c-warning` token (light #a3541c -> 5.15:1; dark
 *      #e8a33d -> 7.97:1).
 *   3. D-21: the immersive hint CONTENT kept a raw Tailwind dark override
 *      (`dark:text-amber-200/90`) on top of the token; removed so the
 *      `--c-warning` token paints both themes (dark 7.97:1, still AA).
 *
 * MUTATION PROOF: restoring `line-through`, `text-amber-400/70` or
 * `dark:text-amber-200/90` turns the matching test red.
 */
import { render, screen, within } from '@testing-library/react';
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

// Test fixture copy, kept in a constant shared by the mock and the assertion.
const HINT_TEXT = 'Examples: OEE, on-time delivery, first-pass yield, cycle time.';

const questions: InterviewQuestion[] = [
  {
    id: 'q-1',
    sessionId: 's-dec557',
    category: 'general',
    questionText: 'What are the top 3 KPIs you use to measure operational performance?',
    answerText: '',
    answerType: 'open',
    status: 'in_progress',
    confidenceScore: 0,
    tags: [],
    sortOrder: 1,
    isTemplate: false,
    description: HINT_TEXT,
  },
  {
    id: 'q-2',
    sessionId: 's-dec557',
    category: 'general',
    questionText: 'Which executive owns the outcome?',
    answerText: 'COO',
    answerType: 'short_text',
    status: 'answered',
    confidenceScore: 80,
    tags: [],
    sortOrder: 2,
    isTemplate: false,
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

describe('DEC-557 (Wpis 43) — approved question readable + hint contrast AA', () => {
  it('answered question in the immersive rail has NO line-through (readable, only dimmed)', () => {
    render(<InterviewSingleQuestionRuntime {...baseProps} immersive />);
    const nav = screen.getByRole('navigation', {
      name: 'interview.singleQuestionRuntime.questionNavigation',
    });
    const answered = within(nav).getByText('Which executive owns the outcome?');
    expect(answered.className).not.toContain('line-through');
    // The answered state is carried by dimming + checkmark, not a strike-through.
    expect(answered.closest('button')?.className).toContain('opacity-50');
  });

  it('immersive hint uses the AA token text-c-warning, not the pale dark-bg amber variant', () => {
    render(<InterviewSingleQuestionRuntime {...baseProps} immersive />);
    const label = screen.getByText('interview.singleQuestionRuntime.hint');
    expect(label.className).toContain('text-c-warning');
    expect(label.className).not.toContain('amber-400');
    const content = screen.getByText(HINT_TEXT);
    expect(content.className).toContain('text-c-warning');
  });

  it('D-21: immersive hint content has NO raw dark amber override — the token paints both themes', () => {
    render(<InterviewSingleQuestionRuntime {...baseProps} immersive />);
    const content = screen.getByText(HINT_TEXT);
    const classes = content.className.split(/\s+/);
    expect(classes).toContain('text-c-warning');
    expect(classes).not.toContain('dark:text-amber-200/90');
  });
});
