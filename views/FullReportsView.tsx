import React, { useEffect, useState, useCallback } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { FullReportDocument } from '../components/FullReportDocument';
import { FullExecutionDashboardWorkspace } from '../components/FullExecutionDashboardWorkspace';
import { AIConsultantView } from './AIConsultantView';
import { FullReport, AIMessageHistory, FullInitiative } from '../types';
// import { translations } from '../translations';
import { useAppStore } from '../store/useAppStore';
import { exportReportToPDF } from '../services/pdf/pdfExport';
import { Download, Bot, FileText } from 'lucide-react';
import { AIFeedbackButton } from '../components/AIFeedbackButton';
import { sendMessageToAI } from '../services/ai/gemini';

// ... imports
import { ReportContainer } from '../components/ReportBuilder/ReportContainer';

export const FullReportsView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    addChatMessage: addMessage,
    setIsBotTyping: setTyping,
    activeChatMessages: messages
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'report' | 'consultant'>('report');
  const language = currentUser?.preferredLanguage || 'EN';

  const addUserMessage = (content: string) => {
    addMessage({ id: Date.now().toString(), role: 'user', content, timestamp: new Date() });
  };

  const addAiMessage = useCallback((content: string, delay = 600) => {
    setTyping(true);
    setTimeout(() => {
      addMessage({
        id: Date.now().toString(),
        role: 'ai',
        content,
        timestamp: new Date()
      });
      setTyping(false);
    }, delay);
  }, [addMessage, setTyping]);

  const handleAiChat = async (text: string) => {
    addUserMessage(text);
    setTyping(true);

    try {
      const history: AIMessageHistory[] = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      // Context needs to be dynamic now based on ReportBuilder content
      // For now, we keep it generic
      const context = `
        Context: User is building the Final Digital Transformation Report.
        User Question: ${text}
      `;

      const response = await sendMessageToAI(history, context);
      addAiMessage(response, 0);

    } catch (e) {
      console.error(e);
      addAiMessage("I apologize, I am having trouble processing that right now.");
      setTyping(false);
    }
  };

  // --- Final Report View ---
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-navy-950">

      {/* Tab Navigation */}
      <div className="h-14 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-white/10 flex items-center px-6 gap-6">
        <button
          onClick={() => setActiveTab('report')}
          className={`h-full flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'report' ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-slate-500 hover:text-navy-900 dark:text-slate-400'}`}
        >
          <FileText size={18} />
          Report Builder
        </button>
        <button
          onClick={() => setActiveTab('consultant')}
          className={`h-full flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'consultant' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-navy-900 dark:text-slate-400'}`}
        >
          <Bot size={18} />
          AI Consultant Insights
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <SplitLayout title="" onSendMessage={handleAiChat} hideSidebar={true}>
          <div className="flex w-full h-full" dir={language === 'AR' ? 'rtl' : 'ltr'}>
            {activeTab === 'consultant' ? (
              <div className="w-full h-full overflow-hidden">
                <AIConsultantView session={fullSession} />
              </div>
            ) : (
              <div className="w-full h-full bg-gray-50 dark:bg-navy-950">
                <ReportContainer
                  projectId={fullSession.id} // Using SessionID as ProjectID for now
                  organizationId={currentUser?.organizationId || ''}
                />
              </div>
            )}
          </div>
        </SplitLayout>
      </div>
    </div>
  );
};
