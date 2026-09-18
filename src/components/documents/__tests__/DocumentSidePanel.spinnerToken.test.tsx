/**
 * @vitest-environment jsdom
 *
 * D-87 (DEC-646): the document-list loading spinner must use a NEUTRAL token,
 * not crimson `text-primary-500` (#85182F). CLAUDE.md pkt 3 reserves crimson
 * for critical semantics only — a loading indicator is not critical. This test
 * freezes the canonical neutral token `text-c-text-muted` (the same token the
 * global app spinner in `App.tsx` and the DocumentStudio siblings use).
 *
 * Mutation proof: restore `text-primary-500` on `DocumentSidePanel.tsx:457`
 * -> the two assertions below go RED.
 */
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getProjectDocuments: vi.fn(),
  getUserDocuments: vi.fn(),
  language: 'en' as 'en' | 'pl',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: hoisted.language },
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getProjectDocuments: hoisted.getProjectDocuments,
    getUserDocuments: hoisted.getUserDocuments,
    uploadDocumentToLibrary: vi.fn(),
    createPersonalTask: vi.fn(),
    moveDocumentToProject: vi.fn(),
    deleteDocument: vi.fn(),
    acknowledgeDocument: vi.fn(),
  },
}));

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: () => ({
    activeSidePanel: 'DOCUMENTS',
    closeSidePanel: vi.fn(),
    currentUser: { id: 'u1', role: 'consultant' },
    setCurrentView: vi.fn(),
  }),
}));

const { DocumentSidePanel } = await import('../DocumentSidePanel');

describe('D-87 (DEC-646) — spinner listy dokumentów: token neutralny, nie crimson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loading spinner carries text-c-text-muted and never crimson text-primary-500', async () => {
    // Hold the fetch pending so `loading` stays true and the body spinner renders.
    hoisted.getProjectDocuments.mockReturnValue(new Promise(() => {}));
    const { container } = render(<DocumentSidePanel projectId="proj-1" />);

    // The loading block is the only `.py-12` container in the panel (:456);
    // its svg is the Loader2 body spinner, distinct from the header RefreshCw.
    await waitFor(() => {
      expect(container.querySelector('.py-12 svg.animate-spin')).not.toBeNull();
    });

    const spinner = container.querySelector('.py-12 svg.animate-spin') as SVGElement;
    expect(spinner.classList.contains('text-c-text-muted')).toBe(true);
    expect(spinner.classList.contains('text-primary-500')).toBe(false);
  });
});
