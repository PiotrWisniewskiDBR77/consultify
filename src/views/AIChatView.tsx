import React from 'react';

import { UnifiedChatPanel } from '@/components/AIChat/UnifiedChatPanel';

export const AIChatView: React.FC = () => {
  return (
    <div className="h-full min-h-0">
      <UnifiedChatPanel className="h-full" mode="full" showModeToggle={false} />
    </div>
  );
};

export default AIChatView;
