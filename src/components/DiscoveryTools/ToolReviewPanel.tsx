/**
 * ToolReviewPanel
 * Review phase summary, gaps, and approval actions.
 */

import { AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react';
import React from 'react';

import {
  GrowthPathsData,
  OperationalToolData,
  PorterData,
  PortfolioPriorityData,
  RiskUncertaintyData,
  SWOTData,
  ToolSession,
  ToolType,
} from '@/store/useToolStore';

interface ToolReviewPanelProps {
  toolType: ToolType;
  session: ToolSession;
  gaps: string[];
  isPolish: boolean;
  onApprove: () => void;
  onSendBack: (comment?: string) => void;
  onConfigureGenerate: () => void;
  generationDefaults: { methodologyId: string; count: number; includeChatContext: boolean };
  decisions?: {
    decision_type: string;
    status: string;
    decision_id?: string;
    decision_status?: string;
  }[];
  canApprove?: boolean;
  canGenerate?: boolean;
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
  decisions = [],
  canApprove = true,
  canGenerate = true,
}) => {
  const inputData = session.inputData;

  const summary = (() => {
    if (toolType === 'dynamic-swot') {
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
    }
    if (toolType === 'market-forces') {
      const porter = inputData as PorterData;
      const scores = Object.values(porter.forces || {}).map((f) => f.score || 0);
      const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
      return [
        `${isPolish ? 'Atrakcyjnosc' : 'Attractiveness'}: ${avg.toFixed(1)}/5`,
        `${isPolish ? 'Sila konkurencji' : 'Competitive intensity'}: ${scores.length}`,
      ];
    }
    if (toolType === 'growth-paths') {
      const growth = inputData as GrowthPathsData;
      return [
        `${isPolish ? 'Penetracja' : 'Penetration'}: ${growth.quadrants.marketPenetration.length}`,
        `${isPolish ? 'Rozwój rynku' : 'Market dev.'}: ${
          growth.quadrants.marketDevelopment.length
        }`,
        `${isPolish ? 'Rozwój produktu' : 'Product dev.'}: ${
          growth.quadrants.productDevelopment.length
        }`,
        `${isPolish ? 'Dywersyfikacja' : 'Diversification'}: ${
          growth.quadrants.diversification.length
        }`,
      ];
    }
    if (toolType === 'portfolio-priority') {
      const portfolio = inputData as PortfolioPriorityData;
      return [
        `${isPolish ? 'Inicjatywy' : 'Initiatives'}: ${portfolio.initiatives.length}`,
        `Stars: ${portfolio.initiatives.filter((i) => i.category === 'star').length}`,
        `Cash Cows: ${portfolio.initiatives.filter((i) => i.category === 'cash-cow').length}`,
        `Question Marks: ${portfolio.initiatives.filter((i) => i.category === 'question-mark').length}`,
        `Dogs: ${portfolio.initiatives.filter((i) => i.category === 'dog').length}`,
      ];
    }
    if (toolType === 'risk-uncertainty') {
      const risk = inputData as RiskUncertaintyData;
      return [
        `${isPolish ? 'Sygnały' : 'Signals'}: ${risk.signals?.length || 0}`,
        `${isPolish ? 'Założenia' : 'Assumptions'}: ${risk.assumptions.length}`,
        `${isPolish ? 'Ryzyka' : 'Risks'}: ${risk.risks.length}`,
        `${isPolish ? 'Scenariusze' : 'Scenarios'}: ${risk.scenarios.length}`,
        `${isPolish ? 'Ruchy' : 'Moves'}: ${risk.recommendedMoves?.length || 0}`,
      ];
    }
    if (
      [
        'sop-builder',
        'a3-problem-solving',
        'smed-planner',
        'dms-builder',
        'inventory-autopilot',
      ].includes(toolType)
    ) {
      const operational = inputData as OperationalToolData;
      const sections = operational.sections || {};
      const totalItems = Object.values(sections).reduce((sum, items) => sum + items.length, 0);
      return [
        `${isPolish ? 'Sekcje' : 'Sections'}: ${Object.keys(sections).length}`,
        `${isPolish ? 'Elementy' : 'Items'}: ${totalItems}`,
      ];
    }
    const porter = inputData as PorterData;
    const scores = Object.values(porter.forces || {}).map((f) => f.score || 0);
    const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    return [
      `${isPolish ? 'Atrakcyjnosc' : 'Attractiveness'}: ${avg.toFixed(1)}/5`,
      `${isPolish ? 'Sila konkurencji' : 'Competitive intensity'}: ${scores.length}`,
    ];
  })();

  const ready = gaps.length === 0;
  const [comment, setComment] = React.useState('');
  const [confirmApprove, setConfirmApprove] = React.useState(false);

  const decisionStatus = (type: string) => {
    const match = decisions.find((d) => d.decision_type === type);
    return match?.decision_status || match?.status || 'UNKNOWN';
  };

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
            disabled={!canGenerate}
            className={`mt-3 text-sm ${
              canGenerate
                ? 'text-primary-600 hover:text-primary-700'
                : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            {isPolish ? 'Konfiguruj' : 'Configure'}
          </button>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <h3 className="font-medium text-slate-900 dark:text-white mb-2">
            {isPolish ? 'Decision gates' : 'Decision gates'}
          </h3>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Request Review: {decisionStatus('REQUEST_REVIEW')}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Approve Tool: {decisionStatus('APPROVE_TOOL')}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Generate Initiatives: {decisionStatus('GENERATE_INITIATIVES')}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {isPolish ? 'Komentarz' : 'Comment'}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-2 resize-none"
            placeholder={isPolish ? 'Powod odeslania do Draft' : 'Reason for sending back'}
          />
        </div>
      </div>

      <div className="w-80 border-l border-slate-200 dark:border-navy-700 p-4 flex flex-col gap-3 bg-slate-50 dark:bg-navy-900">
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={confirmApprove}
            onChange={(e) => setConfirmApprove(e.target.checked)}
          />
          {isPolish ? 'Potwierdzam zatwierdzenie' : 'I confirm approval'}
        </label>
        <button
          onClick={onApprove}
          disabled={!ready || !canApprove || !confirmApprove}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            ready && canApprove && confirmApprove
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : 'bg-slate-200 dark:bg-navy-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          {isPolish ? 'Approve' : 'Approve'}
        </button>
        <button
          onClick={() => onSendBack(comment)}
          disabled={!comment.trim() || !canApprove}
          className={`px-4 py-2 rounded-lg text-sm font-medium border ${
            comment.trim() && canApprove
              ? 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300'
              : 'bg-slate-100 dark:bg-navy-800 border-slate-200 dark:border-navy-700 text-slate-600 cursor-not-allowed'
          }`}
        >
          {isPolish ? 'Send back to Draft' : 'Send back to Draft'}
        </button>
      </div>
    </div>
  );
};

export default ToolReviewPanel;
