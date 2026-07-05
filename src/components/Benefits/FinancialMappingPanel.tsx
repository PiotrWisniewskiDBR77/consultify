/**
 * Financial Mapping Panel (T049)
 * KPI ↔ BS/P&L/CF mapping with transparent, editable relationships.
 */

import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Edit3,
  FileText,
  Info,
  Link,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface StatementLine {
  id: string;
  statement_type: string;
  line_code: string;
  line_name: string;
  line_name_pl: string | null;
  is_system: boolean;
  sort_order: number;
}

interface KPIFinancialMapping {
  id: string;
  kpi_id: string;
  kpi_name: string;
  unit: string;
  statement_line_id: string;
  line_name: string;
  line_code: string;
  statement_type: string;
  direction: string;
  relationship_type: string;
  multiplier: number;
  confidence: string;
  assumptions_text: string | null;
}

interface FinancialImpact {
  statementLineId: string;
  lineName: string;
  lineNamePl: string | null;
  statementType: string;
  lineCode: string;
  direction: string;
  relationshipType: string;
  multiplier: number;
  confidence: string;
  kpiDelta: number;
  estimatedImpact: number;
  assumptions: string | null;
}

export const FinancialMappingPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [lines, setLines] = useState<StatementLine[]>([]);
  const [mappings, setMappings] = useState<KPIFinancialMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedType, setExpandedType] = useState<string | null>('P&L');

  const [formKpiId, setFormKpiId] = useState('');
  const [formLineId, setFormLineId] = useState('');
  const [formDirection, setFormDirection] = useState('positive');
  const [formType, setFormType] = useState('linear');
  const [formMultiplier, setFormMultiplier] = useState(1);
  const [formConfidence, setFormConfidence] = useState('medium');
  const [formAssumptions, setFormAssumptions] = useState('');

  const [kpiOptions, setKpiOptions] = useState<{ id: string; name: string; unit: string }[]>([]);
  const [impactData, setImpactData] = useState<{
    kpiId: string;
    impacts: FinancialImpact[];
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [linesRes, mappingsRes, kpiMapRes] = await Promise.all([
        Api.get('/benefits/financial/statement-lines'),
        Api.get('/benefits/financial/kpi-mappings'),
        Api.get('/benefits/kpi-mappings'),
      ]);
      setLines(linesRes.data || []);
      setMappings(mappingsRes.data || []);

      const unique = new Map<string, { id: string; name: string; unit: string }>();
      (kpiMapRes.data || []).forEach((m: any) => {
        if (m.kpi_id && !unique.has(m.kpi_id)) {
          unique.set(m.kpi_id, { id: m.kpi_id, name: m.kpi_name || 'Unknown', unit: m.unit || '' });
        }
      });
      setKpiOptions(Array.from(unique.values()));
    } catch (err) {
      console.error('[FinancialMapping] Failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, StatementLine[]> = { 'P&L': [], BS: [], CF: [] };
    lines.forEach((l) => {
      if (map[l.statement_type]) map[l.statement_type].push(l);
    });
    return map;
  }, [lines]);

  const mappingsByLine = useMemo(() => {
    const map: Record<string, KPIFinancialMapping[]> = {};
    mappings.forEach((m) => {
      if (!map[m.statement_line_id]) map[m.statement_line_id] = [];
      map[m.statement_line_id].push(m);
    });
    return map;
  }, [mappings]);

  const handleSaveMapping = async () => {
    if (!formKpiId || !formLineId) {
      toast.error(t('kpi.financial.selectBoth', 'Select both KPI and statement line'));
      return;
    }
    try {
      await Api.post('/benefits/financial/kpi-mappings', {
        kpiId: formKpiId,
        statementLineId: formLineId,
        direction: formDirection,
        relationshipType: formType,
        multiplier: formMultiplier,
        confidence: formConfidence,
        assumptionsText: formAssumptions || null,
      });
      trackFunnelEvent('kpi_financial_mapping_created', { kpiId: formKpiId, lineId: formLineId });
      toast.success(t('kpi.financial.saved', 'Mapping saved'));
      setShowForm(false);
      resetForm();
      loadData();
    } catch {
      toast.error(t('kpi.financial.saveFailed', 'Failed to save mapping'));
    }
  };

  const handleDelete = async (mappingId: string) => {
    try {
      await Api.delete(`/benefits/financial/kpi-mappings/${mappingId}`);
      toast.success(t('kpi.financial.deleted', 'Mapping removed'));
      loadData();
    } catch {
      toast.error(t('kpi.financial.deleteFailed', 'Failed'));
    }
  };

  const handleViewImpact = async (kpiId: string) => {
    try {
      const res = await Api.get(`/benefits/financial/impact/${kpiId}`);
      setImpactData({ kpiId, impacts: res.data?.impacts || [] });
      trackFunnelEvent('kpi_financial_impact_viewed', { kpiId });
    } catch {
      toast.error('Failed to load impact data');
    }
  };

  const resetForm = () => {
    setFormKpiId('');
    setFormLineId('');
    setFormDirection('positive');
    setFormType('linear');
    setFormMultiplier(1);
    setFormConfidence('medium');
    setFormAssumptions('');
  };

  const STMT_LABELS: Record<string, { en: string; pl: string; color: string }> = {
    'P&L': { en: 'Profit & Loss', pl: 'Rachunek zysków i strat', color: 'text-emerald-500' },
    BS: { en: 'Balance Sheet', pl: 'Bilans', color: 'text-blue-500' },
    CF: { en: 'Cash Flow', pl: 'Przepływy pieniężne', color: 'text-primary-500' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('kpi.financial.title', 'KPI → Financial Statement Mapping')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('kpi.financial.subtitle', 'Link KPIs to P&L, Balance Sheet, and Cash Flow items')}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500"
        >
          <Plus size={16} /> {t('kpi.financial.addMapping', 'Add Mapping')}
        </button>
      </div>

      {/* Statement Lines grouped by type */}
      {(['P&L', 'BS', 'CF'] as const).map((stmtType) => {
        const label = STMT_LABELS[stmtType];
        const stmtLines = grouped[stmtType] || [];
        const isExpanded = expandedType === stmtType;

        return (
          <div
            key={stmtType}
            className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            <button
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-navy-800/50"
              onClick={() => setExpandedType(isExpanded ? null : stmtType)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown size={16} className="text-slate-600" />
                ) : (
                  <ChevronRight size={16} className="text-slate-600" />
                )}
                <FileText size={18} className={label.color} />
                <span className="font-semibold text-slate-900 dark:text-white">
                  {isPl ? label.pl : label.en}
                </span>
                <span className="text-xs text-slate-600">
                  ({stmtLines.length} {t('kpi.financial.lines', 'lines')})
                </span>
              </div>
              <span className="text-sm text-slate-600">
                {stmtLines.reduce((c, l) => c + (mappingsByLine[l.id]?.length || 0), 0)}{' '}
                {t('kpi.financial.mappings', 'mappings')}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-200 dark:border-navy-700 divide-y divide-slate-50 dark:divide-navy-800">
                {stmtLines.map((line) => {
                  const lineMappings = mappingsByLine[line.id] || [];
                  return (
                    <div key={line.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-xs text-slate-600 mr-2">
                            {line.line_code}
                          </span>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {isPl && line.line_name_pl ? line.line_name_pl : line.line_name}
                          </span>
                        </div>
                        {lineMappings.length > 0 && (
                          <span className="text-xs bg-primary-500/10 text-primary-500 px-2 py-0.5 rounded-full">
                            {lineMappings.length} KPIs
                          </span>
                        )}
                      </div>
                      {lineMappings.length > 0 && (
                        <div className="mt-2 space-y-1 pl-4">
                          {lineMappings.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between text-sm group"
                            >
                              <div className="flex items-center gap-2">
                                <Link size={12} className="text-slate-600" />
                                <span className="text-slate-600 dark:text-slate-300">
                                  {m.kpi_name}
                                </span>
                                <ArrowRight size={12} className="text-slate-600" />
                                <span
                                  className={`text-xs font-medium ${m.direction === 'positive' ? 'text-green-500' : m.direction === 'negative' ? 'text-danger-500' : 'text-slate-600'}`}
                                >
                                  {m.direction === 'positive'
                                    ? '↑ improves'
                                    : m.direction === 'negative'
                                      ? '↓ worsens'
                                      : '—'}
                                </span>
                                <span className="text-xs text-slate-600">×{m.multiplier}</span>
                                <ConfBadgeSmall level={m.confidence} />
                              </div>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleViewImpact(m.kpi_id)}
                                  className="text-blue-400 hover:text-blue-300"
                                  title="View impact"
                                >
                                  <DollarSign size={14} />
                                </button>
                                <button
                                  onClick={() => handleDelete(m.id)}
                                  className="text-danger-400 hover:text-danger-300"
                                  title="Remove"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Impact Preview */}
      {impactData && impactData.impacts.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-blue-800 dark:text-blue-400">
              {t('kpi.financial.impactPreview', 'Financial Impact Preview')}
            </h4>
            <button
              onClick={() => setImpactData(null)}
              className="text-blue-400 hover:text-blue-300"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {impactData.impacts.map((imp, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-600">{imp.lineCode}</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {isPl && imp.lineNamePl ? imp.lineNamePl : imp.lineName}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600">Δ KPI: {imp.kpiDelta.toFixed(2)}</span>
                  <span
                    className={`font-medium ${imp.estimatedImpact >= 0 ? 'text-green-600' : 'text-danger-600'}`}
                  >
                    {imp.estimatedImpact >= 0 ? '+' : ''}
                    {imp.estimatedImpact.toFixed(2)}
                  </span>
                  <ConfBadgeSmall level={imp.confidence} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-400 mt-3 italic">
            {t(
              'kpi.financial.impactDisclaimer',
              'Impact estimates are based on stated multipliers and assumptions.'
            )}
          </p>
        </div>
      )}

      {/* Add Mapping Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('kpi.financial.addMapping', 'Add Financial Mapping')}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-slate-600 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  KPI
                </label>
                <select
                  value={formKpiId}
                  onChange={(e) => setFormKpiId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">{t('kpi.financial.selectKpi', 'Select KPI...')}</option>
                  {kpiOptions.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('kpi.financial.statementLine', 'Statement Line')}
                </label>
                <select
                  value={formLineId}
                  onChange={(e) => setFormLineId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">{t('kpi.financial.selectLine', 'Select line...')}</option>
                  {['P&L', 'BS', 'CF'].map((st) => (
                    <optgroup key={st} label={STMT_LABELS[st]?.[isPl ? 'pl' : 'en'] || st}>
                      {(grouped[st] || []).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.line_code} — {isPl && l.line_name_pl ? l.line_name_pl : l.line_name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('kpi.financial.direction', 'Direction')}
                  </label>
                  <select
                    value={formDirection}
                    onChange={(e) => setFormDirection(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="positive">
                      {t('kpi.financial.positive', 'Positive (improves)')}
                    </option>
                    <option value="negative">
                      {t('kpi.financial.negative', 'Negative (worsens)')}
                    </option>
                    <option value="neutral">{t('kpi.financial.neutral', 'Neutral')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('kpi.financial.multiplier', 'Multiplier')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formMultiplier}
                    onChange={(e) => setFormMultiplier(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('kpi.financial.relType', 'Relationship')}
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="linear">{t('kpi.financial.linear', 'Linear')}</option>
                    <option value="percentage">
                      {t('kpi.financial.percentage', 'Percentage')}
                    </option>
                    <option value="step">{t('kpi.financial.step', 'Step function')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('kpi.financial.confidence', 'Confidence')}
                  </label>
                  <select
                    value={formConfidence}
                    onChange={(e) => setFormConfidence(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="high">{t('kpi.financial.confHigh', 'High')}</option>
                    <option value="medium">{t('kpi.financial.confMedium', 'Medium')}</option>
                    <option value="low">{t('kpi.financial.confLow', 'Low')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('kpi.financial.assumptions', 'Assumptions')}
                </label>
                <textarea
                  value={formAssumptions}
                  onChange={(e) => setFormAssumptions(e.target.value)}
                  rows={2}
                  placeholder={t(
                    'kpi.financial.assumptionsPlaceholder',
                    'Describe the relationship and any assumptions...'
                  )}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleSaveMapping}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500"
              >
                <Save size={14} /> {t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 text-xs text-slate-600">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p className="italic">
          {t(
            'kpi.financial.disclaimer',
            'Financial mappings are approximations. Actual relationships may vary by industry and context. Always verify with finance team.'
          )}
        </p>
      </div>
    </div>
  );
};

const ConfBadgeSmall: React.FC<{ level: string }> = ({ level }) => {
  const cls: Record<string, string> = {
    high: 'bg-green-500/20 text-green-600 dark:text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    low: 'bg-danger-500/20 text-danger-600 dark:text-danger-400',
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cls[level] || cls.low}`}>
      {level}
    </span>
  );
};

export default FinancialMappingPanel;
