/**
 * @vitest-environment jsdom
 *
 * Smoke tests for TemplateBuilder — covers new-template render, Save Draft
 * presence, and the AI quality-gate wiring (POST /interview/templates/evaluate-quality).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../../public/locales/en/translation.json';

const resolveEnKey = (key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      enTranslation as unknown
    );
  return typeof value === 'string' ? value : undefined;
};

const tEn = (key: string, opt?: unknown): string => {
  const resolved = resolveEnKey(key);
  if (resolved !== undefined) return resolved;
  if (typeof opt === 'string') return opt;
  if (opt && typeof opt === 'object' && 'defaultValue' in (opt as Record<string, unknown>)) {
    return String((opt as { defaultValue: unknown }).defaultValue);
  }
  return key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tEn,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return {
    default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }),
  };
});

const { apiPost, apiGet, apiPatch } = vi.hoisted(() => ({
  apiPost: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    post: apiPost,
    get: apiGet,
    patch: apiPatch,
    delete: vi.fn(async () => ({})),
    postMultipart: vi.fn(async () => ({})),
  },
  shouldAllowDemoData: () => false,
}));

vi.mock('@/services/ai/gemini', () => ({
  sendMessageToAI: vi.fn(async () => ''),
}));

import { TemplateBuilder } from '../TemplateBuilder';

beforeEach(() => {
  apiPost.mockReset();
  apiGet.mockReset();
  apiPatch.mockReset();
  apiPost.mockResolvedValue({ id: 'tmpl-new-1' });
  apiGet.mockResolvedValue([]);
  apiPatch.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TemplateBuilder smoke', () => {
  it('orients a first-time author and moves focus to the first required decision', () => {
    render(<TemplateBuilder isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByTestId('template-builder-first-use-guide')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Create a usable interview template in three steps/i })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start with the topic/i }));
    expect(document.activeElement).toBe(screen.getByPlaceholderText(/digital maturity/i));

    fireEvent.click(screen.getByRole('button', { name: /Dismiss getting-started guide/i }));
    expect(screen.queryByTestId('template-builder-first-use-guide')).not.toBeInTheDocument();
  });

  it('renders the new-template editor with a Save Draft action', () => {
    render(<TemplateBuilder isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('Save Draft')).toBeInTheDocument();
  });

  it('exposes a Check quality action wired to the AI quality gate', async () => {
    apiPost.mockResolvedValueOnce({
      results: [{ questionId: 'q1', score: 100, warnings: [] }],
      averageScore: 100,
      totalWarnings: 0,
    });

    render(<TemplateBuilder isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    const checkBtn = screen.getByRole('button', { name: /Check quality/i });
    expect(checkBtn).toBeInTheDocument();
    // Disabled with zero questions — confirms the gate is wired to question state.
    expect(checkBtn).toBeDisabled();
  });

  it('posts to the evaluate-quality endpoint when Check quality runs', async () => {
    apiPost.mockResolvedValue({
      results: [{ questionId: 'q1', score: 100, warnings: [] }],
      averageScore: 100,
      totalWarnings: 0,
    });

    render(<TemplateBuilder isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    // Add a question so the quality gate has something to evaluate.
    fireEvent.click(screen.getByText('Add Question'));

    const checkBtn = screen.getByRole('button', { name: /Check quality/i });
    await waitFor(() => expect(checkBtn).not.toBeDisabled());
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        '/interview/templates/evaluate-quality',
        expect.objectContaining({ questions: expect.any(Array) })
      );
    });
  });

  it('renders the Teresa quality result panel after a check', async () => {
    apiPost.mockResolvedValue({
      results: [
        {
          questionId: 'q1',
          score: 40,
          warnings: [
            { severity: 'warning', message: { en: 'Question is too short', pl: 'Za krótkie' } },
          ],
        },
      ],
      averageScore: 40,
      totalWarnings: 1,
    });

    render(<TemplateBuilder isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByText('Add Question'));
    const checkBtn = screen.getByRole('button', { name: /Check quality/i });
    await waitFor(() => expect(checkBtn).not.toBeDisabled());
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(screen.getByText(/Teresa reviewed your template/i)).toBeInTheDocument();
    });
    expect(screen.getByText('40/100')).toBeInTheDocument();
    expect(screen.getByText(/Question is too short/i)).toBeInTheDocument();
  });

  it('renders a Publish action alongside Save Draft', () => {
    render(<TemplateBuilder isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('Publish')).toBeInTheDocument();
    expect(screen.getByText('Save Draft')).toBeInTheDocument();
  });
});
