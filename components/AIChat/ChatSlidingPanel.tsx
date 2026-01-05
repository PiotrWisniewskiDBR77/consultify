import React, { useState } from 'react';

import { ChatHistorySidebar } from './ChatHistorySidebar';

interface ChatSlidingPanelProps {
    trigger?: React.ReactNode;
}

export const ChatSlidingPanel: React.FC<ChatSlidingPanelProps> = ({ trigger }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {trigger && <div onClick={() => setIsOpen(true)}>{trigger}</div>}
            {/* The ChatHistorySidebar itself handles its open/close state via useConversationStore, 
                but this component can act as a wrapper or provide additional sliding logic if needed.
                In this codebase, it seems ChatHistorySidebar is already a floating overlay controlled by store.
            */}
            <ChatHistorySidebar onNewChat={() => setIsOpen(false)} />
        </>
    );
};

export default ChatSlidingPanel;
