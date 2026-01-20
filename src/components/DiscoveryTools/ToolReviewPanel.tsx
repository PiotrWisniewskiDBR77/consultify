/**
 * ToolReviewPanel
 * Review phase summary, gaps, and approval actions.
 */

import { AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react';
import React from 'react';

import { PorterData, SWOTData, ToolSession, ToolType } from '@/store/useToolStore';

interface ToolReviewPanelProps {
  toolType: ToolType;
  session: ToolSession;
  gaps: string[];
  isPolish: boolean;
  onApprove: () => void;
  onSendBack: () => void;
  onConfigureGenerate: () => void;
  generationDefaults: { methodologyId: string; count: number; includeChatContext: boolean };
}

export const ToolReviewPanel: React.FC<ToolReviewPanelProps> = ({
  toolType,
  session,
  gaps,
  isPolish,
  onApprove,
  onSendBack,
  onConfigureGenerate,
  generationDefaults,
}) => {
  const inputData = session.inputData;

  const summary =
    toolType === 'dynamic-swot'
      ? (() => {
          const swot = inputData as SWOTData;
          return [
            `${isPolish ? 'Mocne strony' : 'Strengths'}: ${
              swot.items.filter((i) => i.quadrant === 'strengths').length
            }`,
            `${isPolish ? 'Slabe strony' : 'Weaknesses'}: ${
              swot.items.filter((i) => i.quadrant === 'weaknesses').length
            }`,
            `${isPolish ? 'Szanse' : 'Opportunities'}: ${
              swot.items.filter((i) => i.quadrant === 'opportunities').length
            }`,
            `${isPolish ? 'Zagrozenia' : 'Threats'}: ${
              swot.items.filter((i) => i.quadrant === 'threats').length
            }`,
            `${isPolish ? 'Korelacje' : 'Correlations'}: ${swot.correlations.length}`,
          ];
        })()
      : (() => {
          const porter = inputData as PorterData;
          const scores = Object.values(porter.forces || {}).map((f) => f.score || 0);
          const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
          return [
            `${isPolish ? 'Atrakcyjnosc' : 'Attractiveness'}: ${avg.toFixed(1)}/5`,
            `${isPolish ? 'Sila konkurencji' : 'Competitive intensity'}: ${scores.length}`,
          ];
        })();

  const ready = gaps.length === 0;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-primary-500" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {isPolish ? 'Review' : 'Review'}
          </h2>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <h3 className="font-medium text-slate-900 dark:text-white mb-2">
            {isPolish ? 'Podsumowanie' : 'Summary'}
          </h3>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            {summary.map((item, idx) => (
              <li key={idx}>• {item}</li>
            ))}
          </ul>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-2 mb-2">
            {ready ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
            <h3 className="font-medium text-slate-900 dark:text-white">
              {isPolish ? 'Braki (gaps)' : 'Gaps'}
            </h3>
          </div>
          {ready ? (
            <p className="text-sm text-emerald-600">
              {isPolish ? 'Brak brakow. Gotowe do zatwierdzenia.' : 'No gaps. Ready to approve.'}
            </p>
          ) : (
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              {gaps.map((gap, idx) => (
                <li key={idx}>• {gap}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <h3 className="font-medium text-slate-900 dark:text-white mb-2">
            {isPolish ? 'Generate initiatives' : 'Generate initiatives'}
          </h3>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {isPolish ? 'Metodyka' : 'Methodology'}: {generationDefaults.methodologyId}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {isPolish ? 'Liczba' : 'Count'}: {generationDefaults.count}
          </div>
          <button
            onClick={onConfigureGenerate}
            className="mt-3 text-sm text-primary-600 hover:text-primary-700"
          >
            {isPolish ? 'Konfiguruj' : 'Configure'}
          </button>
        </div>
      </div>

      <div className="w-80 border-l border-slate-200 dark:border-navy-700 p-4 flex flex-col gap-3 bg-slate-50 dark:bg-navy-900">
        <button
          onClick={onApprove}
          disabled={!ready}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            ready
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : 'bg-slate-200 dark:bg-navy-800 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isPolish ? 'Approve' : 'Approve'}
        </button>
        <button
          onClick={onSendBack}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300"
        >
          {isPolish ? 'Send back to Draft' : 'Send back to Draft'}
        </button>
      </div>
    </div>
  );
};

export default ToolReviewPanel;
