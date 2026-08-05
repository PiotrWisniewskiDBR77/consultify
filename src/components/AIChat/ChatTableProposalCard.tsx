/**
 * ChatTableProposalCard — displays a schema proposal inline in chat
 * with Accept / Reject / Refine actions.
 */
import { Check, Loader2, MessageSquare, Table2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

interface ProposalOperation {
  id: string;
  operationType: string;
  target?: Record<string, string>;
  payload?: Record<string, unknown>;
}

export interface SchemaProposal {
  id: string;
  intent: string;
  confidence: number;
  summary: string;
  operations: ProposalOperation[];
  warnings: Array<{ message: string }>;
  status: string;
}

interface Props {
  proposal: SchemaProposal;
  onStatusChange: (status: 'executed' | 'rejected' | 'refining') => void;
  onNavigateToTable?: (baseId: string) => void;
}

export const ChatTableProposalCard: React.FC<Props> = ({
  proposal,
  onStatusChange,
  onNavigateToTable,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [loading, setLoading] = useState(false);
  const [refineMode, setRefineMode] = useState(false);
  const [refineText, setRefineText] = useState('');
  const [currentProposal, setCurrentProposal] = useState(proposal);
  const [executed, setExecuted] = useState(false);
  const [rejected, setRejected] = useState(false);
  // FIX (M01-P07A — consistent error states): accept/reject/refine only ever
  // did `console.error` on failure — no toast, no inline message, nothing
  // rendered. A failed accept looked IDENTICAL to a slow-but-pending one:
  // the user has no way to tell "still working" from "silently failed",
  // and no recovery hint. `error` surfaces the failure inline (translated
  // PL/EN like the rest of this card) instead of leaving it invisible.
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await TablePlatformApi.executeSchemaProposal(currentProposal.id);
      setExecuted(true);
      onStatusChange('executed');
      if (result?.createdIds?.baseId && onNavigateToTable) {
        onNavigateToTable(result.createdIds.baseId);
      }
    } catch (err) {
      console.error('Execute failed', err);
      setError(
        isPl
          ? 'Nie udało się utworzyć tabeli. Spróbuj ponownie.'
          : 'Failed to create the table. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError(null);
    try {
      await TablePlatformApi.rejectSchemaProposal(currentProposal.id);
      setRejected(true);
      onStatusChange('rejected');
    } catch (err) {
      console.error('Reject failed', err);
      setError(
        isPl
          ? 'Nie udało się odrzucić propozycji. Spróbuj ponownie.'
          : 'Failed to reject the proposal. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!refineText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const refined = await TablePlatformApi.refineSchemaProposal(currentProposal.id, refineText);
      if (refined) {
        setCurrentProposal(refined as SchemaProposal);
      }
      setRefineMode(false);
      setRefineText('');
      onStatusChange('refining');
    } catch (err) {
      console.error('Refine failed', err);
      setError(
        isPl
          ? 'Nie udało się doprecyzować propozycji. Spróbuj ponownie.'
          : 'Failed to refine the proposal. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (executed) {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 my-2">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium">
          <Check size={16} />
          {isPl ? 'Tabela utworzona pomyślnie!' : 'Table created successfully!'}
        </div>
      </div>
    );
  }

  if (rejected) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-4 my-2 opacity-60">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <X size={16} />
          {isPl ? 'Propozycja odrzucona' : 'Proposal rejected'}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-4 my-2">
      <div className="flex items-center gap-2 mb-3">
        <Table2 size={16} className="text-primary-600 dark:text-primary-400" />
        <span className="text-sm font-semibold text-primary-800 dark:text-primary-300">
          {isPl ? 'Propozycja schematu tabeli' : 'Table Schema Proposal'}
        </span>
        <span className="ml-auto text-xs text-slate-500">
          {Math.round(currentProposal.confidence * 100)}% {isPl ? 'pewności' : 'confidence'}
        </span>
      </div>

      <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{currentProposal.summary}</p>

      {currentProposal.operations.length > 0 && (
        <div className="space-y-1 mb-3">
          {currentProposal.operations.map((op) => (
            <div
              key={op.id}
              className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"
            >
              <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">
                {op.operationType}
              </span>
              <span>{op.target?.name || op.target?.tableName || ''}</span>
            </div>
          ))}
        </div>
      )}

      {currentProposal.warnings.length > 0 && (
        <div className="mb-3 text-xs text-amber-600 dark:text-amber-400">
          {currentProposal.warnings.map((w, i) => (
            <div key={i}>⚠ {w.message}</div>
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/20 px-3 py-2 text-xs text-danger-700 dark:text-danger-400"
        >
          {error}
        </div>
      )}

      {refineMode ? (
        <div className="flex gap-2 mt-2">
          <input
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
            placeholder={isPl ? 'Opisz zmiany...' : 'Describe changes...'}
            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-navy-900 text-sm"
            autoFocus
          />
          <button
            onClick={handleRefine}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-xs font-medium hover:bg-navy-800 disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : isPl ? 'Wyślij' : 'Send'}
          </button>
          <button
            onClick={() => setRefineMode(false)}
            className="px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
        </div>
      ) : (
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleAccept}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {isPl ? 'Akceptuj' : 'Accept'}
          </button>
          <button
            onClick={() => setRefineMode(true)}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-100 dark:bg-primary-800/30 text-primary-700 dark:text-primary-300 text-xs font-medium hover:bg-primary-200 dark:hover:bg-primary-800/50 disabled:opacity-50"
          >
            <MessageSquare size={12} />
            {isPl ? 'Doprecyzuj' : 'Refine'}
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <X size={12} />
            {isPl ? 'Odrzuć' : 'Reject'}
          </button>
        </div>
      )}
    </div>
  );
};
