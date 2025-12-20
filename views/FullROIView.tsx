import React, { useEffect, useCallback } from 'react';
import { SplitLayout } from '../components/SplitLayout';
// import { FullROIWorkspace } from '../components/FullROIWorkspace';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api'; // Keep imports to avoid breaking other things if needed

export const FullROIView: React.FC = () => {
  const { addChatMessage: addMessage, setIsBotTyping: setTyping } = useAppStore();

  const handleAiChat = async (text: string) => {
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() });
    setTyping(true);
    setTimeout(() => {
      addMessage({ id: Date.now().toString(), role: 'ai', content: "This module is currently under construction.", timestamp: new Date() });
      setTyping(false);
    }, 1000);
  };

  return (
    <SplitLayout title="Value Realization & ROI" onSendMessage={handleAiChat}>
      <div className="w-full h-full bg-navy-900 flex flex-col items-center justify-center p-8 text-white">
        <div className="text-center max-w-lg">
          <h2 className="text-3xl font-bold mb-4">Economics & ROI</h2>
          <p className="text-slate-400 mb-8">
            This module is currently being enhanced with advanced AI simulation capabilities.
            Please check back later.
          </p>
          <div className="p-6 bg-white/5 rounded-xl border border-white/10">
            <div className="font-mono text-sm text-yellow-400">Status: Under Construction</div>
          </div>
        </div>
      </div>
    </SplitLayout>
  );
};
