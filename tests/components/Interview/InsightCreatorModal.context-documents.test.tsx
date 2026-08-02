/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.fn();
const listContextDocumentsMock = vi.fn();
const listInsightsMock = vi.fn();
const checkInsightSimilarityMock = vi.fn();
const createInsightMock = vi.fn();

import enTranslation from '../../../public/locales/en/translation.json';

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
    i18n: { language: 'en', changeLanguage: () => {}, getFixedT: () => tEn },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: {
    listContextDocuments: (...args: any[]) => listContextDocumentsMock(...args),
    listInsights: (...args: any[]) => listInsightsMock(...args),
    checkInsightSimilarity: (...args: any[]) => checkInsightSimilarityMock(...args),
    createInsight: (...args: any[]) => createInsightMock(...args),
    uploadContextDocument: vi.fn(),
  },
}));

import { InsightCreatorModal } from '../../../src/components/Interview/InsightCreatorModal';

describe('InsightCreatorModal context documents', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    listContextDocumentsMock.mockReset();
    listInsightsMock.mockReset();
    checkInsightSimilarityMock.mockReset();
    createInsightMock.mockReset();
    createInsightMock.mockResolvedValue({ insight: { id: 'insight-1' } });
    listInsightsMock.mockResolvedValue({ insights: [] });
    checkInsightSimilarityMock.mockResolvedValue({ matches: [] });

    apiGetMock.mockImplementation((path: string) => {
      if (path === '/interview/sessions/completed') {
        return Promise.resolve([
          {
            id: 'session-1',
            name: 'Interview 1',
            status: 'approved',
            answeredQuestions: 8,
            totalQuestions: 10,
          },
        ]);
      }
      if (path === '/interview/templates') {
        return Promise.resolve([{ id: 'template-1', name: 'Template 1' }]);
      }
      return Promise.resolve([]);
    });

    listContextDocumentsMock.mockResolvedValue({
      documents: [
        {
          id: 'doc-ready',
          filename: 'ready-doc.pdf',
          status: 'ready',
          scope: 'user',
          ownerId: 'user-1',
          mimeType: 'application/pdf',
          fileSize: 1234,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'doc-processing',
          filename: 'processing-doc.pptx',
          status: 'processing',
          scope: 'user',
          ownerId: 'user-1',
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          fileSize: 2345,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  });

  it('submits selected ready context document ids', async () => {
    render(<InsightCreatorModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('AI Insight Creator')).toBeInTheDocument();
    });

    // --- Step 1: Define (title) ---
    fireEvent.change(screen.getByPlaceholderText('e.g. Digital Transformation Analysis Q1 2024'), {
      target: { value: 'Context-doc insight' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // --- Step 2: Source (pick a session) ---
    await waitFor(() => {
      expect(screen.getByText('Interview 1')).toBeInTheDocument();
    });
    const sessionLabel = screen.getByText('Interview 1').closest('label');
    const sessionCheckbox = sessionLabel?.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;
    fireEvent.click(sessionCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // --- Step 3: Refine — context documents live inside the "Advanced" disclosure ---
    fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

    await waitFor(() => {
      expect(screen.getByText('ready-doc.pdf')).toBeInTheDocument();
    });

    const readyDocLabel = screen.getByText('ready-doc.pdf').closest('label');
    const readyDocCheckbox = readyDocLabel?.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;
    fireEvent.click(readyDocCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      expect(createInsightMock).toHaveBeenCalledTimes(1);
    });

    const payload = createInsightMock.mock.calls[0][0];
    expect(payload.selectedContextDocumentIds).toEqual(['doc-ready']);
  });
});
