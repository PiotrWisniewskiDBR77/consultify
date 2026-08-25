import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

import { AIChatInlinePanel } from '../../../src/components/MyWork/notebook/AIChatInlinePanel';

// AIChatInlinePanel.tsx calls t('myWorkNotebook.aiChatInlinePanel.convertReport') etc. with
// NO inline fallback (relies on public/locales/en/translation.json). The previous mock
// omitted `t` entirely (`t is not a function`); resolve real English copy from the locale
// file instead (same pattern as IdeaExportMenu.test.tsx).
function resolveTranslation(key: string, options?: Record<string, unknown>): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined),
      enTranslation
    );
  const template = typeof value === 'string' ? value : key;
  if (!options) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
    Object.prototype.hasOwnProperty.call(options, name) ? String(options[name]) : `{{${name}}}`
  );
}

// Keep `t` a stable function identity across renders (react-i18next's real `t` is stable;
// see tests/setup.ts note on why a per-call arrow can break effect/callback deps).
const stableT = (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options);

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      i18n: { language: 'en' },
      t: stableT,
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
