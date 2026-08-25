import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Maximize2,
  Presentation,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  buildReportMarkdown,
  computeRAG,
  exportReportPDF,
  RAG_CONFIG,
  type ReportDef,
} from './executionReports';

interface ReportCompactPanelProps {
  report: ReportDef | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerate?: (report: ReportDef) => void;
  mode?: 'overlay' | 'embedded';
}

type PanelTab = 'contract' | 'ai' | 'export';

const PANEL_TABS: { id: PanelTab; labelKey: string; fallback: string }[] = [
  { id: 'contract', labelKey: 'execution.reportPanel.contract', fallback: 'Scope' },
  { id: 'ai', labelKey: 'execution.reportPanel.data', fallback: 'AI' },
  { id: 'export', labelKey: 'execution.reportPanel.export', fallback: 'Export' },
];

const RAG_BAR: Record<string, string> = {
  green: 'from-emerald-500 to-emerald-400',
  amber: 'from-amber-500 to-amber-400',
  red: 'from-danger-500 to-danger-400',
};

const RAG_DOT: Record<string, string> = {
  green: 'bg-emerald-500 shadow-emerald-500/40',
  amber: 'bg-amber-500 shadow-amber-500/40',
  red: 'bg-danger-500 shadow-danger-500/40',
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
    {children}
  </div>
);

const PanelSection: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <section className="space-y-2">
    <SectionLabel>{label}</SectionLabel>
    {children}
  </section>
);

export const ReportCompactPanel: React.FC<ReportCompactPanelProps> = ({
  report,
  isOpen,
  onClose,
  onGenerate,
  mode = 'overlay',
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PanelTab>('contract');
  const [isExporting, setIsExporting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const rag = useMemo(() => (report ? computeRAG(report) : 'green'), [report]);
  const ragConf = RAG_CONFIG[rag];

  const handleCopyMarkdown = useCallback(() => {
    if (!report) return;
    const md = buildReportMarkdown(report, rag);
    navigator.clipboard.writeText(md).then(
      () => toast.success(t('execution.reportPanel.copied', 'Report copied to clipboard')),
      () => toast.error(t('execution.reportPanel.copyFailed', 'Copy failed'))
    );
  }, [rag, report, t]);

  const handleExportPDF = useCallback(() => {
    if (!report) return;
    setIsExporting(true);
    try {
      exportReportPDF(report, rag);
      toast.success(t('execution.reportPanel.pdfExported', 'PDF downloaded'));
    } catch {
      toast.error(t('execution.reportPanel.pdfFailed', 'PDF export failed'));
    } finally {
      setIsExporting(false);
    }
  }, [rag, report, t]);

  const handleExportPresentation = useCallback(() => {
    if (!report) return;
    const md = buildReportMarkdown(report, rag);
    const encoded = encodeURIComponent(md);
    const title = encodeURIComponent(report.title);
    window.open(
      `/prezentacje?sourceType=execution_report&sourceName=${title}&content=${encoded}`,
      '_blank'
    );
    toast.success(t('execution.reportPanel.presentationOpened', 'Opening presentation generator…'));
  }, [rag, report, t]);

  if (!isOpen || !report) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {mode === 'overlay' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-dropdown bg-black/20 backdrop-blur-[2px] dark:bg-black/40"
              onClick={onClose}
            />
          )}
          <motion.div
            ref={panelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-overlay flex w-[440px] max-w-full flex-col border-l bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/[0.06] dark:bg-navy-950/95"
          >
            {/* RAG bar */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${RAG_BAR[rag]}`} />

            {/* Header */}
            <div className="border-b border-slate-200/60 px-4 pt-3 pb-2 dark:border-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full shadow-sm ${RAG_DOT[rag]}`} />
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide ${ragConf.text}`}
                      >
                        {t(ragConf.labelKey, ragConf.label)}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-500">
                      {report.cadence}
                    </span>
                    <span className="text-[10px] text-slate-600 dark:text-slate-400">·</span>
                    <span className="text-[10px] text-slate-600 dark:text-slate-500">
                      {report.dataQuality?.freshnessLabel ?? 'Live'}
                    </span>
                  </div>
                  <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {report.title}
                  </h3>
                  <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-500">
                    {report.audience}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {onGenerate && (
                    <button
                      type="button"
                      onClick={() => onGenerate(report)}
                      className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
                      title={t('execution.reportPanel.generate', 'Generate with AI')}
                    >
                      <Maximize2 size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-600 dark:hover:bg-white/[0.06]"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Highlight chips */}
              <div className="mt-2.5 flex flex-wrap gap-1">
                {report.highlights.slice(0, 4).map((h) => (
                  <span
                    key={h.label}
                    className={[
                      'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      h.variant === 'critical'
                        ? 'bg-danger-500/10 text-danger-400'
                        : h.variant === 'warn'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-slate-100/80 text-slate-500 dark:bg-white/[0.04] dark:text-slate-400',
                    ].join(' ')}
                  >
                    {h.label}: {h.value}
                  </span>
                ))}
                {report.degradedFlags.map((flag) => (
                  <span
                    key={flag}
                    className="inline-flex items-center rounded-full bg-danger-500/10 px-2 py-0.5 text-[10px] font-medium text-danger-400"
                  >
                    {flag}
                  </span>
                ))}
              </div>

              {/* Tab bar */}
              <div className="mt-3 flex gap-0.5">
                {PANEL_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={[
                        'rounded-t-lg border-b-2 px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                        isActive
                          ? 'border-[var(--c-info)] text-[var(--c-info)] dark:text-[var(--c-info)]'
                          : 'border-transparent text-slate-600 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300',
                      ].join(' ')}
                    >
                      {t(tab.labelKey, tab.fallback)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {activeTab === 'contract' && (
                <>
                  <PanelSection label={t('execution.reportPanel.sections.scope', 'Scope')}>
                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                      {report.scope}
                    </p>
                  </PanelSection>
                  <PanelSection
                    label={t('execution.reportPanel.sections.dataSources', 'Data Sources')}
                  >
                    <div className="flex flex-wrap gap-1">
                      {report.dataSources.map((src) => (
                        <span
                          key={src}
                          className="inline-block rounded-full bg-slate-100/80 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-white/[0.04] dark:text-slate-400"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection
                    label={t('execution.reportPanel.sections.mandatorySections', 'Mandatory Sections')}
                  >
                    <ol className="list-inside list-decimal space-y-0.5">
                      {report.sections.map((s) => (
                        <li key={s} className="text-[11px] text-slate-500 dark:text-slate-400">
                          {s}
                        </li>
                      ))}
                    </ol>
                  </PanelSection>
                  <PanelSection
                    label={t('execution.reportPanel.sections.ragLogic', 'RAG / Confidence Logic')}
                  >
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {report.ragLogic}
                    </p>
                  </PanelSection>
                </>
              )}

              {activeTab === 'ai' && (
                <>
                  <PanelSection
                    label={t(
                      'execution.reportPanel.sections.aiExecutiveReadout',
                      'AI Executive Readout'
                    )}
                  >
                    <div className="space-y-1.5">
                      {report.aiExecutiveReadout.map((line) => (
                        <div
                          key={line}
                          className="rounded-lg border border-slate-200/60 bg-white/40 px-3 py-2 text-[11px] leading-relaxed text-slate-600 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-slate-300"
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection
                    label={t(
                      'execution.reportPanel.sections.aiRecommendedActions',
                      'AI Recommended Actions'
                    )}
                  >
                    <div className="space-y-1.5">
                      {report.aiRecommendedActions.map((action) => (
                        <div
                          key={action.id}
                          className={[
                            'rounded-lg border p-3',
                            'border-slate-200/60 bg-white/40 dark:border-white/[0.05] dark:bg-white/[0.02]',
                            action.severity === 'critical' ? 'ring-1 ring-danger-500/20' : '',
                            action.severity === 'warn' ? 'ring-1 ring-amber-500/20' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <div className="text-[12px] font-semibold text-slate-900 dark:text-white">
                            {action.action}
                          </div>
                          <div className="mt-1 text-[10px] text-slate-600 dark:text-slate-500">
                            {action.owner} · {action.dueLabel}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {action.expectedEffect}
                          </div>
                        </div>
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection
                    label={t('execution.reportPanel.sections.dataQuality', 'Data Quality')}
                  >
                    <div className="flex flex-wrap gap-1">
                      {[
                        t('execution.reportPanel.dataQualityTags.freshness', {
                          defaultValue: 'Freshness: {{value}}',
                          value: report.dataQuality?.freshnessLabel ?? '—',
                        }),
                        t('execution.reportPanel.dataQualityTags.confidence', {
                          defaultValue: 'Confidence: {{value}}',
                          value: report.dataQuality?.confidence ?? '—',
                        }),
                      ].map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100/80 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-white/[0.04] dark:text-slate-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {((report.dataQuality?.knownLimitations ?? []).length ?? 0) > 0 && (
                      <div className="mt-2 space-y-1">
                        {(report.dataQuality?.knownLimitations ?? []).map((lim) => (
                          <div key={lim} className="text-[10px] text-slate-600 dark:text-slate-500">
                            ⚠ {lim}
                          </div>
                        ))}
                      </div>
                    )}
                  </PanelSection>
                </>
              )}

              {activeTab === 'export' && (
                <PanelSection label={t('execution.reportPanel.sections.export', 'Export')}>
                  <div className="space-y-1.5">
                    <ExportButton
                      icon={Copy}
                      label={t('execution.reportPanel.copy', 'Copy as Markdown')}
                      onClick={handleCopyMarkdown}
                    />
                    <ExportButton
                      icon={Download}
                      label={t('execution.reportPanel.exportPdf', 'Download PDF')}
                      onClick={handleExportPDF}
                      loading={isExporting}
                    />
                    <ExportButton
                      icon={Presentation}
                      label={t('execution.reportPanel.exportDeck', 'Open presentation builder')}
                      onClick={handleExportPresentation}
                    />
                  </div>
                </PanelSection>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const ExportButton: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  loading?: boolean;
}> = ({ icon: Icon, label, onClick, loading }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center justify-between rounded-lg border border-slate-200/60 bg-white/40 px-3 py-2.5 text-left transition-colors hover:bg-slate-50/80 active:scale-[0.99] dark:border-white/[0.05] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
  >
    <span className="flex items-center gap-2 text-[12px] text-slate-600 dark:text-slate-200">
      <Icon size={14} />
      {label}
    </span>
    {loading ? (
      <Loader2 size={14} className="animate-spin text-slate-600" />
    ) : (
      <ChevronRight size={14} className="text-slate-600 dark:text-slate-400" />
    )}
  </button>
);
