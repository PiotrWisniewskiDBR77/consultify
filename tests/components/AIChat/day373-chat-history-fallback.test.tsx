import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (state: any) => unknown) => {
    const state = { isSidebarCollapsed: false, currentUser: null };
    return selector ? selector(state) : state;
  },
}));

const { conversationState, projectState } = vi.hoisted(() => ({
conversationState: {
  conversations: [],
  groupedConversations: { archived: [] },
  activeConversationId: null,
  isLoading: false,
  isSidebarOpen: true,
  searchQuery: '',
  showArchived: false,
  fetchConversations: vi.fn(),
  setActiveConversation: vi.fn(),
  createConversation: vi.fn(),
  toggleSidebar: vi.fn(),
  setSearchQuery: vi.fn(),
  toggleShowArchived: vi.fn(),
  clearActiveChat: vi.fn(),
  bulkOperation: vi.fn(),
  serverSearch: vi.fn(),
},
projectState: {
  projects: [],
  expandedProjectIds: [],
  isLoading: false,
  fetchProjects: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  updateProject: vi.fn(),
  toggleProjectExpanded: vi.fn(),
  getConversationsByProjectId: vi.fn(() => []),
  getPersonalProjects: vi.fn(() => []),
  getTeamProjects: vi.fn(() => []),
  moveConversationToProject: vi.fn(),
},
}));
vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: () => conversationState,
  groupConversations: vi.fn(() => ({ archived: [] })),
}));

vi.mock('@/store/useChatProjectStore', () => ({
  useChatProjectStore: Object.assign(() => projectState, { getState: () => projectState }),
}));
vi.mock('@/components/AIChat/useChatProjectsRealtime', () => ({
  useChatProjectsRealtime: vi.fn(),
}));

import { ChatHistorySidebar } from '../../../src/components/AIChat/ChatHistorySidebar';

describe('day373 ChatHistorySidebar missing-key fallback', () => {
  it('renders Nowa rozmowa when aiChat.newChat is unavailable', () => {
    render(<ChatHistorySidebar onNewChat={vi.fn()} />);
    expect(screen.getByTestId('chat-history-new-chat')).toHaveTextContent('Nowa rozmowa');
    expect(screen.queryByText('Nowy czat')).toBeNull();
  });
});
