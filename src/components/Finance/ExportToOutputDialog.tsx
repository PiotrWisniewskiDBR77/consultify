/**
 * ExportToOutputDialog (V3-I01)
 *
 * Modal for exporting financial analysis to report or presentation with traceability.
 * DBR77: Layer-2 modal, rounded-xl, cards with hover:ring-2.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, FileText, Loader2, Presentation, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  confirmInvestmentCaseCandidateHandoff,
  getInvestmentCaseCandidateHandoff,
  previewInvestmentCaseCandidateHandoff,
} from '@/services/api/v8/financeCandidateHandoff';
import { exportFinancialAnalysis, type ExportResult } from '@/services/financeExportService';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { FinanceCandidateHandoffModal } from './shared/FinanceCandidateHandoffModal';

/**
 * FIN-06 — "Investment Case" candidate handoff is keyed on a real
 * `financial_models.id` (see `financeInvestmentCaseCandidateHandoff.ts` on
 * the server: it queries `FROM financial_models ... status = 'approved'`).
 * Of this dialog's three current callers, only `analysisType ===
 * 'financial_model'` (FinanceHub rows of kind 'models'/'prediction', and
 * `FinancialModelWorkspace.tsx` directly) passes an id that is actually a
 * `financial_models.id`. `'financial_analysis'` (FinanceHub's
 * analysis/investment rows — note "investment" tab there means
 * `financial_analyses.analysis_type = 'investment_case'`, a DIFFERENT table
 * from FIN-06's "Investment Case") and `'valuation'` never resolve to a
 * `financial_models.id`, so the handoff is not attempted for them — see the
 * inline explanation shown in that case instead of a broken/misleading call.
 */
function supportsInvestmentCaseHandoff(analysisType: string): boolean {
  return analysisType === 'financial_model';
}

/** Known machine-readable ineligibility reason codes from the backend preview. */
function describeIneligibleReason(reason: string, t: (key: string, fallback: string) => string): string {
  if (reason === 'NOT_APPROVED') {
    return t(
      'finance.export.investmentCaseNotApproved',
      'This model is not approved yet — approve it first, then send it as a Candidate.'
    );
  }
  if (reason === 'NOT_FOUND') {
    return t('finance.export.investmentCaseNotFound', 'This model could not be found.');
  }
  return reason;
}

export interface ExportToOutputDialogProps {
  open: boolean;
  onClose: () => void;
  analysisId: string;
  analysisTitle: string;
  analysisType: string;
  relatedInitiativeIds?: string[];
  onExportComplete: (result: ExportResult) => void;
}

interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  sourceType: string;
  reportType?: string;
}

export const ExportToOutputDialog: React.FC<ExportToOutputDialogProps> = ({
  open,
  onClose,
  analysisId,
  analysisTitle,
  analysisType,
  relatedInitiativeIds,
  onExportComplete,
}) => {
  const { t } = useTranslation();
  const [outputType, setOutputType] = useState<'report' | 'presentation' | 'initiatives'>('report');
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateId, setTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [briefGoal, setBriefGoal] = useState('');
  const [briefAudience, setBriefAudience] = useState('');
  const [briefLanguage, setBriefLanguage] = useState<'pl' | 'en'>('pl');
  const [briefFormat, setBriefFormat] = useState('');
  const [briefScope, setBriefScope] = useState('');

  const sourceType = 'FINANCIAL_ANALYSIS';

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const response = await Api.get(
        `/report-builder/templates?sourceType=${encodeURIComponent(sourceType)}`
      );
      const list = response?.templates || [];
      setTemplates(list);
      if (list.length > 0 && !templateId) {
        const defaultTpl =
          list.find((t: ReportTemplate) => t.reportType === 'FINANCIAL_ANALYSIS') || list[0];
        setTemplateId(defaultTpl?.id || '');
      }
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, [sourceType]);

  useEffect(() => {
    if (open && useTemplate) {
      fetchTemplates();
    }
  }, [open, useTemplate, fetchTemplates]);

  const handleConfirm = async () => {
    setSubmitting(true);
    const hasTemplate = useTemplate && !!templateId;
    try {
      trackFunnelEvent('finance_export_clicked', {
        type: outputType,
        template: hasTemplate ? 'yes' : 'no',
      });

      const result = await exportFinancialAnalysis({
        analysisId,
        analysisTitle,
        analysisType: (analysisType as any) || 'financial_analysis',
        outputType,
        templateId: hasTemplate ? templateId : undefined,
        initiativeIds: relatedInitiativeIds,
        brief: hasTemplate
          ? undefined
          : {
              goal: briefGoal.trim() || undefined,
              audience: briefAudience.trim() || undefined,
              language: briefLanguage,
              format: briefFormat.trim() || undefined,
              scope: briefScope.trim() || undefined,
            },
      });

      trackFunnelEvent('finance_export_created', {
        outputId: result.outputId,
        type: result.outputType,
      });

      onExportComplete(result);
      onClose();
    } catch (err: any) {
      console.error('[ExportToOutputDialog] Export failed:', err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const analysisDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-white dark:bg-navy-900 rounded-xl shadow-xl overflow-hidden flex flex-col ring-1 ring-slate-200 dark:ring-navy-700"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('finance.export.title', 'Export Financial Analysis')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Output type cards */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setOutputType('report')}
                className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left hover:ring-2 hover:ring-primary-400/50 ${
                  outputType === 'report'
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={18} className="text-primary-500" />
                  <span className="font-medium text-slate-900 dark:text-white">
                    {t('finance.export.report', 'Report')}
                  </span>
                  {outputType === 'report' && (
                    <Check size={16} className="text-primary-500 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('finance.export.reportDesc', 'Create a deliverable report from this analysis')}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setOutputType('presentation')}
                className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left hover:ring-2 hover:ring-primary-400/50 ${
                  outputType === 'presentation'
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Presentation size={18} className="text-primary-500" />
                  <span className="font-medium text-slate-900 dark:text-white">
                    {t('finance.export.presentation', 'Presentation')}
                  </span>
                  {outputType === 'presentation' && (
                    <Check size={16} className="text-primary-500 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t(
                    'finance.export.presentationDesc',
                    'Create a presentation deck from this analysis'
                  )}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setOutputType('initiatives')}
                className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left hover:ring-2 hover:ring-primary-400/50 ${
                  outputType === 'initiatives'
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-2 w-full">
                  <span className="text-primary-500 font-semibold">+</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {t('finance.export.initiatives', 'Initiatives')}
                  </span>
                  {outputType === 'initiatives' && (
                    <Check size={16} className="text-primary-500 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t(
                    'finance.export.initiativesDesc',
                    'Create draft initiatives from analysis insights'
                  )}
                </p>
              </button>
            </div>

            {/* Template toggle */}
            {outputType !== 'initiatives' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {t('finance.export.useTemplate', 'Use template')}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useTemplate}
                  onClick={() => setUseTemplate(!useTemplate)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    useTemplate ? 'bg-navy-900' : 'bg-slate-300 dark:bg-navy-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      useTemplate ? 'left-5' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Template dropdown */}
            {outputType !== 'initiatives' && useTemplate && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('finance.export.selectTemplate', 'Select template')}
                </label>
                <div className="relative">
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    disabled={loadingTemplates}
                    className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
                  >
                    {loadingTemplates ? (
                      <option>{t('finance.export.loadingTemplates', 'Loading...')}</option>
                    ) : templates.length === 0 ? (
                      <option>{t('finance.export.noTemplates', 'No templates available')}</option>
                    ) : (
                      templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown
                    size={18}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                </div>
              </div>
            )}

            {/* No-template brief (SSOT) */}
            {outputType !== 'initiatives' && !useTemplate && (
              <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-800/30 p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('finance.export.briefTitle', 'Brief (no-template)')}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      {t('finance.export.goal', 'Goal')}
                    </label>
                    <input
                      value={briefGoal}
                      onChange={(e) => setBriefGoal(e.target.value)}
                      placeholder={t(
                        'finance.export.goalPlaceholder',
                        'e.g. support investment decision'
                      )}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      {t('finance.export.audience', 'Audience')}
                    </label>
                    <input
                      value={briefAudience}
                      onChange={(e) => setBriefAudience(e.target.value)}
                      placeholder={t(
                        'finance.export.audiencePlaceholder',
                        'e.g. board / investors / CFO'
                      )}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        {t('finance.export.language', 'Language')}
                      </label>
                      <select
                        value={briefLanguage}
                        onChange={(e) => setBriefLanguage(e.target.value === 'en' ? 'en' : 'pl')}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                      >
                        <option value="pl">PL</option>
                        <option value="en">EN</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        {t('finance.export.format', 'Format')}
                      </label>
                      <input
                        value={briefFormat}
                        onChange={(e) => setBriefFormat(e.target.value)}
                        placeholder={t(
                          'finance.export.formatPlaceholder',
                          'e.g. executive, 5 slides'
                        )}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      {t('finance.export.scope', 'Scope')}
                    </label>
                    <input
                      value={briefScope}
                      onChange={(e) => setBriefScope(e.target.value)}
                      placeholder={t(
                        'finance.export.scopePlaceholder',
                        'e.g. last 12 months + key ratios'
                      )}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Investment Case → Candidate handoff (FIN-06), via the shared
                FinanceCandidateHandoffModal (embedded variant — this dialog
                already owns its own chrome/footer, so the shared component
                only renders the phase-driven body). Never fabricates a
                success state — the Confirm button only ever renders once a
                real, backend-verified preview is in hand, and any
                ineligibility/error is shown verbatim rather than swallowed. */}
            {outputType === 'initiatives' && (
              <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-800/30 p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('finance.export.investmentCaseHandoffTitle', 'Investment Case → Candidate')}
                </div>

                {!supportsInvestmentCaseHandoff(analysisType) ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t(
                      'finance.export.investmentCaseUnsupported',
                      'Available from an approved Investment Case'
                    )}
                  </div>
                ) : (
                  <FinanceCandidateHandoffModal
                    variant="embedded"
                    open
                    onClose={onClose}
                    sourceType="finance_investment_case"
                    sourceId={analysisId}
                    preview={() => previewInvestmentCaseCandidateHandoff(analysisId)}
                    confirm={() => confirmInvestmentCaseCandidateHandoff(analysisId)}
                    fetchHandoff={() => getInvestmentCaseCandidateHandoff(analysisId)}
                    getReopenLink={() => null}
                    describeIneligibleReason={(reason) => describeIneligibleReason(reason, t)}
                    title={t('finance.export.investmentCaseHandoffTitle', 'Investment Case → Candidate')}
                    noticeText={t(
                      'finance.export.investmentCaseCandidateNotice',
                      'This sends the Investment Case to the Candidate inbox for review — it does not create an Initiative directly.'
                    )}
                    confirmLabel={t('finance.export.sendAsCandidate', 'Send as Candidate')}
                    confirmingLabel={t('finance.export.creating', 'Creating...')}
                    checkingLabel={t('finance.export.checkingEligibility', 'Checking eligibility...')}
                    previewErrorFallback={t(
                      'finance.export.investmentCaseEligibilityFailed',
                      'Could not check eligibility'
                    )}
                    confirmErrorFallback={t(
                      'finance.export.investmentCaseConfirmFailed',
                      'Could not create the Candidate'
                    )}
                    onConfirmed={({ created, candidateId, preview }) => {
                      trackFunnelEvent('finance_export_investment_case_candidate_confirmed', {
                        analysisId,
                        candidateId,
                        created,
                      });
                      // Real receipt, not a fabricated stub: `outputId` is the
                      // actual Candidate id the backend returned, and the
                      // title is honest about what was created — a Candidate
                      // awaiting review, not an Initiative — and honestly
                      // distinguishes a fresh creation from an idempotent
                      // replay (mirroring ValuationWorkspace's existing
                      // created/already-exists distinction).
                      onExportComplete({
                        outputId: candidateId,
                        outputType: 'report',
                        title: created
                          ? t(
                              'finance.export.investmentCaseCandidateCreated',
                              'Sent as Initiative candidate: {{title}}',
                              { title: preview.title }
                            )
                          : t(
                              'finance.export.investmentCaseCandidateAlreadyExists',
                              'Already sent as Initiative candidate: {{title}}',
                              { title: preview.title }
                            ),
                        hasTemplate: false,
                      });
                    }}
                  />
                )}
              </div>
            )}

            {/* Analysis summary */}
            <div className="rounded-xl bg-slate-50 dark:bg-navy-800/50 p-4 border border-slate-200/50 dark:border-navy-700/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                {t('finance.export.analysisSummary', 'Analysis summary')}
              </h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">
                    {t('finance.export.name', 'Name')}
                  </dt>
                  <dd className="text-slate-900 dark:text-white font-medium truncate max-w-[180px]">
                    {analysisTitle}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">
                    {t('finance.export.type', 'Type')}
                  </dt>
                  <dd className="text-slate-900 dark:text-white">{analysisType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">
                    {t('finance.export.date', 'Date')}
                  </dt>
                  <dd className="text-slate-900 dark:text-white">{analysisDate}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Footer — the "Initiatives" output type drives its own Confirm
              button inside the embedded FinanceCandidateHandoffModal above
              (it only ever renders once a real eligible preview is in
              hand), so this generic submit footer only applies to
              report/presentation. */}
          {outputType !== 'initiatives' && (
            <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 flex justify-end">
              <button
                onClick={handleConfirm}
                disabled={submitting || (useTemplate && !templateId)}
                className="px-4 py-2 rounded-full bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('finance.export.creating', 'Creating...')}
                  </>
                ) : (
                  t('finance.export.createDraft', 'Create Draft')
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
