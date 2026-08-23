import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

import { NModeCardState } from '@/components/shared/NModeLayout/NModeCardState';

describe('Task generated-section hand-off', () => {
  it('keeps Regenerate/Edit real and explains that the parent Task Save persists the draft', () => {
    const regenerate = vi.fn();
    const edit = vi.fn();
    render(
      <NModeCardState
        state="ai-draft"
        sectionName="Strategy"
        aiGenerated
        onRegenerate={regenerate}
        onEdit={edit}
        persistenceNotice="Review this draft, then save the task to persist it."
      >
        Generated strategy content
      </NModeCardState>
    );
    expect(screen.getByRole('status')).toHaveTextContent('save the task to persist it');
    expect(screen.queryByText('sharedComponents.nModeCardState.acceptAction')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('sharedComponents.nModeCardState.regenerateAction'));
    fireEvent.click(screen.getByText('sharedComponents.nModeCardState.editAction'));
    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it('does not show the draft persistence hand-off for a completed card', () => {
    render(
      <NModeCardState
        state="done"
        sectionName="Strategy"
        persistenceNotice="Review this draft, then save the task to persist it."
      >
        Saved content
      </NModeCardState>
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
