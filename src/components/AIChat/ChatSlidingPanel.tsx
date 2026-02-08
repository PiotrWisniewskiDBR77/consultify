import React from 'react';

import { useConversationStore } from '../../store/useConversationStore';
import { ChatHistorySidebar } from './ChatHistorySidebar';

interface ChatSlidingPanelProps {
  trigger?: React.ReactNode;
  onNewChat?: () => void;
  onSelectConversation?: (id: string) => void;
  activeConversationId?: string | null;
  projectId?: string;
}

export const ChatSlidingPanel: React.FC<ChatSlidingPanelProps> = ({
  trigger,
  onNewChat,
  projectId,
}) => {
  const { toggleSidebar, isSidebarOpen } = useConversationStore();

  return (
    <>
      {trigger && (
        <div
          onClick={() => toggleSidebar()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSidebar();
            }
          }}
        >
          {trigger}
        </div>
      )}

      {/* ChatHistorySidebar handles open/close state via useConversationStore. */}
      <ChatHistorySidebar
        projectId={projectId}
        onNewChat={() => {
          onNewChat?.();
          // Close sidebar after starting a new chat (especially helpful on mobile).
          if (isSidebarOpen) toggleSidebar();
        }}
      />
    </>
  );
};

export default ChatSlidingPanel;
