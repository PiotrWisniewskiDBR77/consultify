import React, { useEffect, useState, useCallback } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { FullReportDocument } from '../components/FullReportDocument';
import { FullExecutionDashboardWorkspace } from '../components/FullExecutionDashboardWorkspace';
import { AIConsultantView } from './AIConsultantView';
import { FullReport, AIMessageHistory, FullInitiative } from '../types';
import { translations } from '../translations';
import { useAppStore } from '../store/useAppStore';
import { exportReportToPDF } from '../services/pdf/pdfExport';
import { Download, Bot, FileText } from 'lucide-react';
import { AIFeedbackButton } from '../components/AIFeedbackButton';
import { sendMessageToAI } from '../services/ai/gemini';

export const FullReportsView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    setFullSessionData: updateFullSession,
    addChatMessage: addMessage,
    setIsBotTyping: setTyping,
    activeChatMessages: messages
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'report' | 'consultant'>('report');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const language = currentUser?.preferredLanguage || 'EN';
  const t = translations.fullReports.reportTemplates;
  const ts = translations.sidebar;

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

      // Context: Full Report
      const context = `
        Context: User is viewing the Final Digital Transformation Report.
        Report Summary: ${fullSession.report?.executiveSummary || "Not generated yet."}
        Key Findings: ${fullSession.report?.keyFindings?.join("; ") || ""}
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


  useEffect(() => {
    if (!fullSession.report) {
      generateReport();
    }
  }, []);

  const getAxisLabel = (id: string) => {
    const key = `fullStep1_${id === 'digitalProducts' ? 'prod' : id.substring(0, 4)}`;
    return (ts as any)[key]?.[language] || id;
  };

  const generateReport = () => {
    setIsGenerating(true);

    const scores = fullSession.assessment;
    const initiatives = fullSession.initiatives || [];
    const econ = fullSession.economics || { totalCost: 0, totalAnnualBenefit: 0, overallROI: 0, paybackPeriodYears: 0 };

    const companyName = currentUser?.companyName || "Your Company";

    const entries = Object.entries(scores).filter(([k]) => k !== 'completedAxes');
    if (entries.length === 0) { setIsGenerating(false); return; }

    const weakestAxis = entries.sort((a, b) => (a[1] as any).score - (b[1] as any).score)[0];
    const strongestAxis = entries.sort((a, b) => (b[1] as any).score - (a[1] as any).score)[0];

    const type = initiatives.length > 10 ? t.aggressive[language] : t.focused[language];

    const execSummary = t.execSummary[language]
      .replace('{companyName}', companyName)
      .replace('{strongest}', getAxisLabel(strongestAxis[0]))
      .replace('{strongestScore}', (strongestAxis[1] as any).score.toFixed(1))
      .replace('{weakest}', getAxisLabel(weakestAxis[0]))
      .replace('{weakestScore}', (weakestAxis[1] as any).score.toFixed(1))
      .replace('{initCount}', String(initiatives.length))
      .replace('{benefit}', econ.totalAnnualBenefit.toLocaleString())
      .replace('{cost}', econ.totalCost.toLocaleString())
      .replace('{roi}', econ.overallROI.toFixed(0))
      .replace('{payback}', econ.paybackPeriodYears.toFixed(1));

    const keyFindings = [
      t.finding1[language].replace('{strongest}', getAxisLabel(strongestAxis[0])),
      t.finding2[language].replace('{weakest}', getAxisLabel(weakestAxis[0])),
      t.finding3[language].replace('{type}', type)
    ];

    const recommendations = initiatives
      .filter(i => i.priority === 'High')
      .slice(0, 5)
      .map(i => `Priority: ${i.name} (${getAxisLabel(i.axis)}) - ${i.quarter}`);

    // --- New Data Generation ---
    const drdLevels = entries.map(([axis, data]: [string, any]) => ({
      axis: getAxisLabel(axis),
      level: data.score
    }));

    const keyInitiatives = initiatives
      .filter(i => i.priority === 'High' || i.status === 'In Progress')
      .slice(0, 5)
      .map(i => ({
        name: i.name,
        status: i.status,
        impact: i.benefitRange || 'Medium'
      }));

    const kpiResults = [
      { kpi: 'Process Efficiency', value: '+15%', trend: 'up' },
      { kpi: 'Data Quality', value: '85%', trend: 'up' },
      { kpi: 'Cost Reduction', value: '-8%', trend: 'down' } // down is good for cost
    ];

    const financialsFormatted = {
      cost: econ.totalCost,
      benefit: econ.totalAnnualBenefit,
      roi: econ.overallROI,
      payback: econ.paybackPeriodYears
    };

    const newReport: FullReport = {
      executiveSummary: execSummary,
      keyFindings,
      recommendations,
      generatedAt: new Date().toISOString(),

      // Populating new fields
      transformationDescription: `A comprehensive digital transformation program for ${companyName}, focusing on ${type.toLowerCase()} improvements across ${entries.length} key dimensions.`,
      drdLevels,
      keyInitiatives,
      kpiResults,
      financials: financialsFormatted,
      lessonsLearned: [
        "Early stakeholder engagement is critical for adoption.",
        "Data quality issues must be addressed before advanced AI implementation.",
        "Change management requires dedicated resources."
      ],
      aiRecommendations: [
        "Accelerate 'Data Lake' implementation to support Q3 AI pilots.",
        "Invest in upskilling middle management on digital tools.",
        "Consider external partnership for cybersecurity audit."
      ],
      roadmapHighlights: [
        "Q1: Foundation & Quick Wins",
        "Q2: Pilot Execution in Core Operations",
        "Q3: Full Rollout & AI Integration"
      ],
      cultureAssessment: "The organization shows strong willingness to change but requires support in digital literacy and clearer communication of strategic goals."
    };

    setTimeout(() => {
      updateFullSession({ report: newReport });
      setIsGenerating(false);
    }, 1500);
  };

  const handleExportPDF = async () => {
    if (!fullSession.report) return;
    setIsExporting(true);
    await exportReportToPDF('full-report-content', `Consultify_Report_${currentUser?.companyName || 'Export'}.pdf`);
    setIsExporting(false);
  };

  if (isGenerating || !fullSession.report) {
    return (
      <div className="flex w-full h-full bg-gray-50 dark:bg-navy-950 items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 animate-pulse">Generating Final Report...</p>
      </div>
    );
  }



  const handleUpdateInitiative = (updated: FullInitiative) => {
    const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
    updateFullSession({ initiatives: newInits });
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
          Final Report
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
        <SplitLayout title="" onSendMessage={handleAiChat} hideSidebar={true}> {/* Hiding sidebar here because we have tabs now, or strictly inside SplitLayout */}
          <div className="flex w-full h-full" dir={language === 'AR' ? 'rtl' : 'ltr'}>
            {activeTab === 'consultant' ? (
              <div className="w-full h-full overflow-hidden">
                <AIConsultantView session={fullSession} />
              </div>
            ) : (
              <>
                <div className={`flex-1 flex flex-col h-full ${language === 'AR' ? 'border-l' : 'border-r'} border-elegant overflow-hidden bg-gray-50 dark:bg-navy-950 relative`}>

                  {/* Floating Action Buttons */}
                  <div className="absolute top-4 right-8 z-50 flex items-center gap-3">
                    <AIFeedbackButton context="report" data={fullSession.report} />
                    <button
                      onClick={handleExportPDF}
                      disabled={isExporting}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg shadow-lg transition-all"
                    >
                      {isExporting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Download size={18} />
                      )}
                      <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
                    </button>
                  </div>

                  <div className="flex-1 w-full h-full relative overflow-auto" id="full-report-content">
                    <FullReportDocument report={fullSession.report} language={language} />
                  </div>
                </div>

                <div className="w-[400px] shrink-0 bg-white dark:bg-navy-900 flex flex-col border-l border-slate-200 dark:border-white/5">
                  <FullExecutionDashboardWorkspace
                    fullSession={fullSession}
                    onUpdateInitiative={handleUpdateInitiative}
                    onGenerateReport={generateReport}
                    language={language}
                  />
                </div>
              </>
            )}
          </div>
        </SplitLayout>
      </div>
    </div>
  );
};
