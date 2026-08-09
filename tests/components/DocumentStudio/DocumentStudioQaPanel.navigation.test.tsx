import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, arg?: string | { defaultValue?: string }) =>
      typeof arg === 'string' ? arg : (arg?.defaultValue ?? _key),
  }),
}));

const getQaMock = vi.fn();
vi.mock('@/components/DocumentStudio/api', () => ({
  getDocumentStudioQaReport: (...args: unknown[]) => getQaMock(...args),
}));

import { DocumentStudioQaPanel } from '@/components/DocumentStudio/DocumentStudioQaPanel';

describe('DocumentStudioQaPanel finding navigation', () => {
  it('exposes a keyboard-accessible action that hands the exact finding to the canvas', async () => {
    const finding = {
      findingId: 'finding-1',
      severity: 'medium',
      message: 'Heading is too dense',
      sectionId: 'sec-1',
      blockId: 'blk-2',
    };
    getQaMock.mockResolvedValue({
      generatedAt: '2026-08-06T20:00:00.000Z',
      anyBlocking: false,
      categories: [
        {
          category: 'format',
          score: 80,
          blocking: false,
          summary: 'One advisory',
          findings: [finding],
        },
      ],
    });
    const onNavigateFinding = vi.fn();
    render(<DocumentStudioQaPanel artifactId="artifact-1" onNavigateFinding={onNavigateFinding} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run QA' }));
    await waitFor(() => expect(screen.getByText('Heading is too dense')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Go to finding in document' }));

    expect(onNavigateFinding).toHaveBeenCalledWith(finding);
  });
});
