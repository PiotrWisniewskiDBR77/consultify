import React from 'react';
import { SplitLayout } from '../components/SplitLayout';
// import { FullReportDocument } from '../components/FullReportDocument';
// import { FullExecutionDashboardWorkspace } from '../components/FullExecutionDashboardWorkspace';
// import { AIConsultantView } from './AIConsultantView';
// import { FullReport, AIMessageHistory, FullInitiative } from '../types';
// import { translations } from '../translations';
import { useAppStore } from '../store/useAppStore';
// import { exportReportToPDF } from '../services/pdf/pdfExport';
// import { Download, Bot, FileText } from 'lucide-react';
// import { AIFeedbackButton } from '../components/AIFeedbackButton';
// import { sendMessageToAI } from '../services/ai/gemini';

// ... imports
// import { ReportContainer } from '../components/ReportBuilder/ReportContainer';

export const FullReportsView: React.FC = () => {
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
    <SplitLayout title="Final Reports & Strategy" onSendMessage={handleAiChat}>
      <div className="w-full h-full bg-slate-50 dark:bg-navy-950 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-lg">
          <h2 className="text-3xl font-bold mb-4 text-navy-900 dark:text-white">Reports Module</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            The comprehensive report builder is being updated with new templates and export options.
            Please check back later.
          </p>
          <div className="p-6 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
            <div className="font-mono text-sm text-yellow-600 dark:text-yellow-400">Status: Under Construction</div>
          </div>
        </div>
      </div>
    </SplitLayout>
  );
};
