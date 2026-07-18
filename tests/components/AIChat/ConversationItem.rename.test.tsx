import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const renameConversation = vi.fn();

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
  }),
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  getConversationEntityType: () => null,
  useConversationStore: () => ({
    renameConversation,
  }),
}));

vi.mock('../../../src/components/AIChat/MoveToProjectModal', () => ({
  MoveToProjectModal: () => null,
}));

import { ConversationItem } from '../../../src/components/AIChat/ConversationItem';

describe('ConversationItem rename action', () => {
  beforeEach(() => {
    renameConversation.mockReset();
  });

  it('opens inline title editing from the actions menu and saves the typed name', async () => {
    render(
      <ConversationItem
        conversation={
          {
            id: 'c1',
            title: 'New conversation',
            titleSource: 'auto',
            starred: false,
            archived: false,
            tags: [],
            messageCount: 0,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
          } as any
        }
        onSelect={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    const input = screen.getByDisplayValue('New conversation');
    fireEvent.change(input, { target: { value: 'QA test DBR77 marketplace' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(renameConversation).toHaveBeenCalledWith('c1', 'QA test DBR77 marketplace');
  });
});
