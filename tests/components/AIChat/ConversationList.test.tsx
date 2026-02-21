import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toggleConversationGroupCollapsedMock = vi.fn();
let collapsedConversationGroupsState: Record<string, boolean> = {};

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector?: any) => {
    const state = {
      collapsedConversationGroups: collapsedConversationGroupsState,
      toggleConversationGroupCollapsed: toggleConversationGroupCollapsedMock,
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('../../../src/components/AIChat/ConversationItem', () => ({
  ConversationItem: ({
    conversation,
    isActive,
    onSelect,
  }: {
    conversation: any;
    isActive: boolean;
    onSelect: (id: string) => void;
  }) => (
    <button
      data-testid="conversation-item"
      data-active={isActive ? '1' : '0'}
      onClick={() => onSelect(conversation.id)}
    >
      {conversation.title || conversation.id}
    </button>
  ),
}));

import { ConversationList } from '../../../src/components/AIChat/ConversationList';

describe('ConversationList (L2)', () => {
  beforeEach(() => {
    toggleConversationGroupCollapsedMock.mockReset();
    collapsedConversationGroupsState = {};
  });

  it('renders ordered groups and limits items to MAX_VISIBLE_PER_GROUP with show more/less', () => {
    const groups = {
      pinned: Array.from({ length: 6 }).map((_, i) => ({ id: `p${i + 1}`, title: `Pinned ${i + 1}` })),
    };

    render(<ConversationList groups={groups} activeId="p2" onSelect={vi.fn()} />);

    expect(screen.getByText('Przypięte')).toBeInTheDocument();
    expect(screen.getAllByTestId('conversation-item')).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: /show more/i }));
    expect(screen.getAllByTestId('conversation-item')).toHaveLength(6);

    fireEvent.click(screen.getByRole('button', { name: /show less/i }));
    expect(screen.getAllByTestId('conversation-item')).toHaveLength(5);
  });

  it('collapses/expands a group via click and keyboard and delegates selection', () => {
    const onSelect = vi.fn();
    const groups = {
      pinned: [{ id: 'p1', title: 'Pinned 1' }],
    };
    render(<ConversationList groups={groups} activeId={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByLabelText(/toggle przypięte/i));
    expect(toggleConversationGroupCollapsedMock).toHaveBeenCalledWith('pinned');

    fireEvent.keyDown(screen.getByLabelText(/toggle przypięte/i), { key: 'Enter' });
    expect(toggleConversationGroupCollapsedMock).toHaveBeenCalledWith('pinned');

    fireEvent.keyDown(screen.getByLabelText(/toggle przypięte/i), { key: ' ' });
    expect(toggleConversationGroupCollapsedMock).toHaveBeenCalledWith('pinned');

    fireEvent.click(screen.getByRole('button', { name: /pinned 1/i }));
    expect(onSelect).toHaveBeenCalledWith('p1');
  });

  it('hides conversations when group is collapsed in store', () => {
    collapsedConversationGroupsState = { pinned: true };
    const groups = { pinned: [{ id: 'p1', title: 'Pinned 1' }] };

    render(<ConversationList groups={groups} activeId={null} onSelect={vi.fn()} />);
    expect(screen.queryByTestId('conversation-item')).not.toBeInTheDocument();
  });
});

