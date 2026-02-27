import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: any, arg2?: any, arg3?: any) => {
      if (typeof arg2 === 'string') {
        if (arg3 && typeof arg3 === 'object') {
          return arg2.replaceAll('{{label}}', String((arg3 as any).label ?? ''));
        }
        return arg2;
      }
      return String(key);
    },
  }),
}));

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

    fireEvent.click(screen.getByRole('button', { name: /(show more|pokaż więcej|aiChat\.showMore)/i }));
    expect(screen.getAllByTestId('conversation-item')).toHaveLength(6);

    fireEvent.click(screen.getByRole('button', { name: /(show less|pokaż mniej|aiChat\.showLess)/i }));
    expect(screen.getAllByTestId('conversation-item')).toHaveLength(5);
  });

  it('marks active conversation item based on activeId', () => {
    const groups = { pinned: [{ id: 'p1', title: 'Pinned 1' }, { id: 'p2', title: 'Pinned 2' }] };
    render(<ConversationList groups={groups} activeId="p2" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Pinned 1' })).toHaveAttribute('data-active', '0');
    expect(screen.getByRole('button', { name: 'Pinned 2' })).toHaveAttribute('data-active', '1');
  });

  it('does not render "Show more" toggle when group size is within the limit', () => {
    const groups = {
      pinned: Array.from({ length: 5 }).map((_, i) => ({ id: `p${i + 1}`, title: `Pinned ${i + 1}` })),
    };
    render(<ConversationList groups={groups} activeId={null} onSelect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });

  it('renders groups in pinned → today order', () => {
    const groups = {
      today: [{ id: 't1', title: 'Today 1' }],
      pinned: [{ id: 'p1', title: 'Pinned 1' }],
    };
    render(<ConversationList groups={groups} activeId={null} onSelect={vi.fn()} />);

    const pinned = screen.getByText('Przypięte');
    const today = screen.getByText('Dzisiaj');
    expect(pinned.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('collapses/expands a group via click and keyboard and delegates selection', () => {
    const onSelect = vi.fn();
    const groups = {
      pinned: [{ id: 'p1', title: 'Pinned 1' }],
    };
    render(<ConversationList groups={groups} activeId={null} onSelect={onSelect} />);

    const groupHeader = screen.getByRole('button', { name: /przypięte/i });
    fireEvent.click(groupHeader);
    expect(toggleConversationGroupCollapsedMock).toHaveBeenCalledWith('pinned');

    fireEvent.keyDown(groupHeader, { key: 'Enter' });
    expect(toggleConversationGroupCollapsedMock).toHaveBeenCalledWith('pinned');

    fireEvent.keyDown(groupHeader, { key: ' ' });
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
