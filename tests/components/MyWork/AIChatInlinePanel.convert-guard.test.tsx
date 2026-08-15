import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AIChatInlinePanel } from '../../../src/components/MyWork/notebook/AIChatInlinePanel';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      i18n: { language: 'en' },
      t: (key: string) => key,
    }),
  };
});

vi.mock('../../../src/components/shared/WorkspaceTools', () => ({
  AIQuickActions: () => <div>AI quick actions</div>,
  SectionLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ShareSection: () => <div>Share</div>,
  ToolsPanelShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TransformTextSection: () => <div>Transform</div>,
}));

describe('AIChatInlinePanel convert guard', () => {
  it('disables deliverable conversion buttons when the note is not ready', () => {
    render(
      <AIChatInlinePanel
        open
        onClose={vi.fn()}
        editor={null}
        noteTitle="Note"
        noteContent="Short note"
        noteTags={[]}
        page={{
          id: 'note-1',
          maturity: 'seed',
          summary: null,
          updatedAt: '2026-03-28T10:00:00.000Z',
          visibility: 'private',
          projectId: null,
          wordCount: 12,
        }}
        onConvert={vi.fn()}
        canConvertDeliverable={false}
        convertBlockedReason="Refine the note first."
      />
    );

    expect(screen.getByRole('button', { name: /Report/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Presentation/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Assessment/i })).toBeDisabled();
    expect(screen.getAllByText('Refine the note first.').length).toBeGreaterThan(0);
  });
});
