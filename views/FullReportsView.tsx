import React, { useEffect, useState } from 'react';
import { FullReportDocument } from '../components/FullReportDocument';
import { FullStep6Workspace } from '../components/FullStep6Workspace';
import { FullReport } from '../types';
import { translations } from '../translations';
import { useAppStore } from '../store/useAppStore';
import { exportReportToPDF } from '../services/pdf/pdfExport';
import { Download } from 'lucide-react';

export const FullReportsView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    setFullSessionData: updateFullSession,
  } = useAppStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const language = currentUser?.preferredLanguage || 'EN';
  const t = translations.fullReports.reportTemplates;
  const ts = translations.sidebar;

  // Chat handler removed


  useEffect(() => {
    if (!fullSession.report) {
      generateReport();
    }
  }, []);

  const getAxisLabel = (id: string) => {
    const key = `fullStep1_${id === 'digitalProducts' ? 'prod' : id.substring(0, 4)}` as any;
    return ts[key]?.[language] || id;
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

    const newReport: FullReport = {
      executiveSummary: execSummary,
      keyFindings,
      recommendations,
      generatedAt: new Date().toISOString()
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
      <div className="flex w-full h-full bg-navy-950 items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 animate-pulse">Generating Final Report...</p>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full" dir={language === 'AR' ? 'rtl' : 'ltr'}>
      <div className={`flex-1 flex flex-col h-full min-w-[600px] ${language === 'AR' ? 'border-l' : 'border-r'} border-elegant overflow-hidden bg-navy-950 relative`}>

        {/* Floating Export Button */}
        <div className="absolute top-4 right-8 z-50">
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

        <div className="flex-1 overflow-y-auto w-full p-8" id="full-report-content">
          <FullReportDocument report={fullSession.report} language={language} />
        </div>
      </div>

      <div className="w-[450px] shrink-0 bg-navy-900 flex flex-col border-l border-white/5">
        <FullStep6Workspace
          fullSession={fullSession}
          language={language}
        />
      </div>
    </div>
  );
};
