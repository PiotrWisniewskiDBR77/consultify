
import React from 'react';
import { FullReport, Language } from '../types';
import { translations } from '../translations';
import { FileText } from 'lucide-react';

interface FullReportDocumentProps {
   report: FullReport;
   language: Language;
}

const SectionHeader = ({ title }: { title: string }) => (
   <div className="mt-8 mb-4 border-b border-navy-800 pb-2">
      <h3 className="text-lg font-bold text-purple-400 uppercase tracking-wide">{title}</h3>
   </div>
);

export const FullReportDocument: React.FC<FullReportDocumentProps> = ({
   report,
   language
}) => {
   const t = translations.fullReports;

   return (
      <div className="h-full bg-gray-50 dark:bg-navy-950 flex flex-col">
         {/* Document Header */}
         <div className="h-16 border-b border-slate-200 dark:border-navy-800 flex items-center px-8 bg-white dark:bg-navy-950 shrink-0 print:hidden">
            <FileText className="text-purple-500 mr-3" size={20} />
            <span className="font-semibold text-navy-900 dark:text-white tracking-wide">{t.header[language]}</span>
            <span className="ml-auto text-xs text-slate-500 font-mono">
               Generated: {new Date(report.generatedAt).toLocaleDateString()}
            </span>
         </div>

         {/* Scrollable Document Area */}
         <div className="flex-1 overflow-y-auto p-8 lg:p-12 print:p-0 print:overflow-visible" id="report-content-area">
            <div className="max-w-4xl mx-auto bg-white dark:bg-navy-900/50 p-8 lg:p-16 rounded-xl border border-slate-200 dark:border-white/5 shadow-xl dark:shadow-2xl print:shadow-none print:border-none print:max-w-none">

               {/* Title Page */}
               <div className="text-center mb-16 border-b-2 border-purple-500 pb-8">
                  <div className="text-sm font-bold tracking-[0.3em] text-slate-400 uppercase mb-4">CONFIDENTIAL</div>
                  <h1 className="text-4xl lg:text-5xl font-bold text-navy-900 dark:text-white mb-4">Digital Transformation Blueprint</h1>
                  <p className="text-xl text-slate-500 dark:text-slate-400">Strategic Assessment & Execution Roadmap</p>
               </div>

               {/* 1. Executive Summary */}
               <SectionHeader title={t.sections.exec[language]} />
               <div className="prose prose-slate dark:prose-invert prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:leading-relaxed max-w-none mb-12">
                  <p className="font-medium text-lg text-navy-900 dark:text-white mb-6">
                     {report.transformationDescription}
                  </p>
                  {report.executiveSummary.split('\n\n').map((para, i) => (
                     <p key={i} className="mb-4">{para}</p>
                  ))}
               </div>

               {/* 2. DRD Maturity Levels */}
               {report.drdLevels && (
                  <div className="mb-12">
                     <SectionHeader title="Digital Maturity Assessment (DRD)" />
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {report.drdLevels.map((level, i) => (
                           <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-800 rounded-lg">
                              <span className="font-medium text-slate-700 dark:text-slate-200">{level.axis}</span>
                              <div className="flex items-center gap-2">
                                 <div className="w-32 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: `${(level.level / 5) * 100}%` }}></div>
                                 </div>
                                 <span className="font-bold text-slate-900 dark:text-white w-8 text-right">{level.level.toFixed(1)}</span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               {/* 3. Key Initiatives */}
               {report.keyInitiatives && (
                  <div className="mb-12">
                     <SectionHeader title={t.sections.initiatives[language] || "Key Initiatives"} />
                     <table className="w-full text-left text-sm">
                        <thead>
                           <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500">
                              <th className="pb-2 font-semibold">Initiative Name</th>
                              <th className="pb-2 font-semibold">Status</th>
                              <th className="pb-2 font-semibold">Expected Impact</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                           {report.keyInitiatives.map((init, i) => (
                              <tr key={i}>
                                 <td className="py-3 font-medium text-navy-900 dark:text-white">{init.name}</td>
                                 <td className="py-3 text-slate-600 dark:text-slate-400 capitalize">{init.status.replace('_', ' ')}</td>
                                 <td className="py-3 text-slate-600 dark:text-slate-400">{init.impact}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}

               {/* 4. Financials & ROI */}
               {report.financials && (
                  <div className="mb-12">
                     <SectionHeader title="Financial Projection & ROI" />
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                        <div className="p-4 bg-slate-50 dark:bg-navy-800 rounded-xl">
                           <div className="text-xs text-slate-500 uppercase mb-1">Total Investment</div>
                           <div className="text-xl font-bold text-navy-900 dark:text-white">${report.financials.cost.toLocaleString()}</div>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                           <div className="text-xs text-green-600 dark:text-green-400 uppercase mb-1">Annual Benefit</div>
                           <div className="text-xl font-bold text-green-700 dark:text-green-300">${report.financials.benefit.toLocaleString()}</div>
                        </div>
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                           <div className="text-xs text-purple-600 dark:text-purple-400 uppercase mb-1">ROI</div>
                           <div className="text-xl font-bold text-purple-700 dark:text-purple-300">{report.financials.roi.toFixed(0)}%</div>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                           <div className="text-xs text-blue-600 dark:text-blue-400 uppercase mb-1">Payback</div>
                           <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{report.financials.payback.toFixed(1)} <span className="text-xs font-normal">years</span></div>
                        </div>
                     </div>
                  </div>
               )}

               {/* 5. AI Recommendations */}
               {report.aiRecommendations && (
                  <div className="mb-12">
                     <SectionHeader title="AI Consultant Recommendations" />
                     <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-6">
                        <ul className="space-y-4">
                           {report.aiRecommendations.map((rec, i) => (
                              <li key={i} className="flex gap-4">
                                 <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">AI</div>
                                 <p className="text-indigo-900 dark:text-indigo-100 text-sm leading-relaxed">{rec}</p>
                              </li>
                           ))}
                        </ul>
                     </div>
                  </div>
               )}

               {/* 6. Roadmap & Closing */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {report.roadmapHighlights && (
                     <div>
                        <SectionHeader title="Roadmap Highlights" />
                        <ul className="space-y-3">
                           {report.roadmapHighlights.map((item, i) => (
                              <li key={i} className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                                 <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                 {item}
                              </li>
                           ))}
                        </ul>
                     </div>
                  )}
                  {report.lessonsLearned && (
                     <div>
                        <SectionHeader title="Lessons Learned" />
                        <ul className="space-y-3">
                           {report.lessonsLearned.map((item, i) => (
                              <li key={i} className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                                 <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                 {item}
                              </li>
                           ))}
                        </ul>
                     </div>
                  )}
               </div>

               {/* Footer */}
               <div className="mt-24 pt-8 border-t border-slate-200 dark:border-white/5 text-center text-xs text-slate-400">
                  <p>CONFIDENTIAL - Generated by CONSULTIFY AI for {report.executiveSummary.split(',')[0].split('for ')[1] || 'Internal Use'}</p>
                  <p className="mt-1">This report contains proprietary analysis and should not be distributed without authorization.</p>
               </div>

            </div>
         </div>
      </div>
   );
};
