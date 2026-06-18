/**
 * FrameworkGenerator — Consulting framework generator for the Idea Table.
 * Generates pre-filled table structures (columns + rows) from consulting frameworks,
 * grounded in company context (assessments, interviews, KPIs).
 */
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Loader2,
  Network,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';
import { SELECT_COLORS } from './tableTypes';

interface FrameworkDef {
  id: string;
  nameEn: string;
  namePl: string;
  descEn: string;
  descPl: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  columns: ColumnDef[];
  sampleRows: Array<Record<string, any>>;
}

const FRAMEWORKS: FrameworkDef[] = [
  {
    id: 'swot',
    nameEn: 'SWOT Analysis',
    namePl: 'Analiza SWOT',
    descEn: 'Strengths, Weaknesses, Opportunities, Threats',
    descPl: 'Mocne strony, Słabe strony, Szanse, Zagrożenia',
    icon: Target,
    color: 'text-blue-600',
    columns: [
      { key: 'label', header: 'Item', type: 'text', visible: true, width: 240 },
      {
        key: 'category',
        header: 'Category',
        type: 'select',
        visible: true,
        width: 140,
        options: ['Strength', 'Weakness', 'Opportunity', 'Threat'],
        optionColors: {
          Strength: '#d1fae5',
          Weakness: '#fee2e2',
          Opportunity: '#dbeafe',
          Threat: '#fef3c7',
        },
      },
      { key: 'impact', header: 'Impact', type: 'rating', visible: true, width: 120 },
      { key: 'likelihood', header: 'Likelihood', type: 'rating', visible: true, width: 120 },
      { key: 'action', header: 'Action', type: 'text', visible: true, width: 200 },
    ],
    sampleRows: [
      { label: 'Strong brand recognition', category: 'Strength', impact: 4, likelihood: 5 },
      { label: 'Limited digital capabilities', category: 'Weakness', impact: 4, likelihood: 4 },
      { label: 'Emerging market expansion', category: 'Opportunity', impact: 5, likelihood: 3 },
      { label: 'Regulatory changes', category: 'Threat', impact: 3, likelihood: 3 },
    ],
  },
  {
    id: 'stakeholder',
    nameEn: 'Stakeholder Map',
    namePl: 'Mapa interesariuszy',
    descEn: 'Identify and analyze key stakeholders',
    descPl: 'Identyfikacja i analiza kluczowych interesariuszy',
    icon: Users,
    color: 'text-primary-600',
    columns: [
      { key: 'label', header: 'Stakeholder', type: 'text', visible: true, width: 200 },
      { key: 'role', header: 'Role', type: 'text', visible: true, width: 160 },
      { key: 'influence', header: 'Influence', type: 'rating', visible: true, width: 120 },
      { key: 'interest', header: 'Interest', type: 'rating', visible: true, width: 120 },
      {
        key: 'strategy',
        header: 'Strategy',
        type: 'select',
        visible: true,
        width: 140,
        options: ['Manage closely', 'Keep satisfied', 'Keep informed', 'Monitor'],
        optionColors: {
          'Manage closely': '#fee2e2',
          'Keep satisfied': '#fef3c7',
          'Keep informed': '#dbeafe',
          Monitor: '#d1fae5',
        },
      },
      { key: 'owner', header: 'Owner', type: 'person', visible: true, width: 140 },
    ],
    sampleRows: [
      {
        label: 'CEO',
        role: 'Executive Sponsor',
        influence: 5,
        interest: 4,
        strategy: 'Manage closely',
      },
      {
        label: 'IT Director',
        role: 'Technical Lead',
        influence: 4,
        interest: 5,
        strategy: 'Manage closely',
      },
      {
        label: 'End Users',
        role: 'Beneficiaries',
        influence: 2,
        interest: 4,
        strategy: 'Keep informed',
      },
    ],
  },
  {
    id: 'risk_register',
    nameEn: 'Risk Register',
    namePl: 'Rejestr ryzyk',
    descEn: 'Identify, assess and mitigate project risks',
    descPl: 'Identyfikacja, ocena i mitygacja ryzyk projektowych',
    icon: Shield,
    color: 'text-danger-600',
    columns: [
      { key: 'label', header: 'Risk', type: 'text', visible: true, width: 220 },
      {
        key: 'category',
        header: 'Category',
        type: 'select',
        visible: true,
        width: 130,
        options: ['Technical', 'Organizational', 'External', 'Financial'],
        optionColors: {
          Technical: '#dbeafe',
          Organizational: '#ede9fe',
          External: '#fef3c7',
          Financial: '#fee2e2',
        },
      },
      { key: 'probability', header: 'Probability', type: 'rating', visible: true, width: 120 },
      { key: 'impact', header: 'Impact', type: 'rating', visible: true, width: 120 },
      {
        key: 'score',
        header: 'Score',
        type: 'formula',
        visible: true,
        width: 80,
        formula: '{probability} * {impact}',
      },
      { key: 'mitigation', header: 'Mitigation', type: 'text', visible: true, width: 200 },
      { key: 'owner', header: 'Owner', type: 'person', visible: true, width: 130 },
      {
        key: 'status',
        header: 'Status',
        type: 'select',
        visible: true,
        width: 110,
        options: ['Open', 'Mitigated', 'Accepted', 'Closed'],
        optionColors: {
          Open: '#fee2e2',
          Mitigated: '#fef3c7',
          Accepted: '#dbeafe',
          Closed: '#d1fae5',
        },
      },
    ],
    sampleRows: [
      {
        label: 'Data migration failure',
        category: 'Technical',
        probability: 3,
        impact: 5,
        status: 'Open',
      },
      {
        label: 'Resource unavailability',
        category: 'Organizational',
        probability: 3,
        impact: 4,
        status: 'Open',
      },
      { label: 'Budget overrun', category: 'Financial', probability: 2, impact: 4, status: 'Open' },
    ],
  },
  {
    id: 'action_plan',
    nameEn: 'Action Plan',
    namePl: 'Plan działań',
    descEn: 'Structured action items with owners and deadlines',
    descPl: 'Strukturyzowane działania z właścicielami i terminami',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    columns: [
      { key: 'label', header: 'Action', type: 'text', visible: true, width: 240 },
      { key: 'owner', header: 'Owner', type: 'person', visible: true, width: 140 },
      { key: 'deadline', header: 'Deadline', type: 'date', visible: true, width: 130 },
      {
        key: 'status',
        header: 'Status',
        type: 'select',
        visible: true,
        width: 120,
        options: ['To Do', 'In Progress', 'Done', 'Blocked'],
        optionColors: {
          'To Do': '#e0e7ff',
          'In Progress': '#fef3c7',
          Done: '#d1fae5',
          Blocked: '#fee2e2',
        },
      },
      {
        key: 'priority',
        header: 'Priority',
        type: 'select',
        visible: true,
        width: 110,
        options: ['Low', 'Medium', 'High', 'Critical'],
        optionColors: { Low: '#d1fae5', Medium: '#fef3c7', High: '#fce7f3', Critical: '#fee2e2' },
      },
      { key: 'progress', header: 'Progress', type: 'progress', visible: true, width: 140 },
      { key: 'dependencies', header: 'Dependencies', type: 'text', visible: true, width: 160 },
    ],
    sampleRows: [
      { label: 'Define project scope', status: 'To Do', priority: 'High', progress: 0 },
      { label: 'Stakeholder interviews', status: 'To Do', priority: 'High', progress: 0 },
      { label: 'Technology assessment', status: 'To Do', priority: 'Medium', progress: 0 },
    ],
  },
  {
    id: 'benchmarking',
    nameEn: 'Benchmarking Table',
    namePl: 'Tabela benchmarkingowa',
    descEn: 'Compare dimensions against industry benchmarks',
    descPl: 'Porównanie wymiarów z benchmarkami branżowymi',
    icon: BarChart3,
    color: 'text-indigo-600',
    columns: [
      { key: 'label', header: 'Dimension', type: 'text', visible: true, width: 200 },
      { key: 'our_score', header: 'Our Score', type: 'number', visible: true, width: 110 },
      { key: 'industry_avg', header: 'Industry Avg', type: 'number', visible: true, width: 120 },
      {
        key: 'gap',
        header: 'Gap',
        type: 'formula',
        visible: true,
        width: 80,
        formula: '{our_score} - {industry_avg}',
      },
      {
        key: 'priority',
        header: 'Priority',
        type: 'select',
        visible: true,
        width: 110,
        options: ['Low', 'Medium', 'High'],
        optionColors: { Low: '#d1fae5', Medium: '#fef3c7', High: '#fee2e2' },
      },
      { key: 'action', header: 'Action', type: 'text', visible: true, width: 200 },
    ],
    sampleRows: [
      { label: 'Digital Strategy', our_score: 3.2, industry_avg: 3.8, priority: 'High' },
      { label: 'Operations Excellence', our_score: 3.5, industry_avg: 3.6, priority: 'Medium' },
      { label: 'Innovation Culture', our_score: 2.8, industry_avg: 3.4, priority: 'High' },
    ],
  },
  {
    id: 'porter',
    nameEn: "Porter's Five Forces",
    namePl: 'Pięć sił Portera',
    descEn: 'Analyze competitive forces in the industry',
    descPl: 'Analiza sił konkurencyjnych w branży',
    icon: Zap,
    color: 'text-amber-600',
    columns: [
      { key: 'label', header: 'Factor', type: 'text', visible: true, width: 220 },
      {
        key: 'force',
        header: 'Force',
        type: 'select',
        visible: true,
        width: 180,
        options: [
          'Competitive Rivalry',
          'Supplier Power',
          'Buyer Power',
          'Threat of Substitution',
          'Threat of New Entry',
        ],
        optionColors: {
          'Competitive Rivalry': '#fee2e2',
          'Supplier Power': '#fef3c7',
          'Buyer Power': '#dbeafe',
          'Threat of Substitution': '#ede9fe',
          'Threat of New Entry': '#d1fae5',
        },
      },
      { key: 'intensity', header: 'Intensity', type: 'rating', visible: true, width: 120 },
      {
        key: 'trend',
        header: 'Trend',
        type: 'select',
        visible: true,
        width: 120,
        options: ['Increasing', 'Stable', 'Decreasing'],
        optionColors: { Increasing: '#fee2e2', Stable: '#fef3c7', Decreasing: '#d1fae5' },
      },
      { key: 'response', header: 'Strategic Response', type: 'text', visible: true, width: 200 },
    ],
    sampleRows: [
      {
        label: 'Many competitors with similar offerings',
        force: 'Competitive Rivalry',
        intensity: 4,
        trend: 'Increasing',
      },
      {
        label: 'Few specialized technology vendors',
        force: 'Supplier Power',
        intensity: 3,
        trend: 'Stable',
      },
      {
        label: 'Price-sensitive customer base',
        force: 'Buyer Power',
        intensity: 4,
        trend: 'Increasing',
      },
    ],
  },
];

interface FrameworkGeneratorProps {
  open: boolean;
  onClose: () => void;
  onApply: (columns: ColumnDef[], rows: TableNode[]) => void;
}

export const FrameworkGenerator: React.FC<FrameworkGeneratorProps> = ({
  open,
  onClose,
  onApply,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [selected, setSelected] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const handleApply = useCallback(() => {
    const fw = FRAMEWORKS.find((f) => f.id === selected);
    if (!fw) return;
    setApplying(true);

    const cols = fw.columns.map((c) => ({
      ...c,
      header:
        isPl && c.header === 'Item'
          ? 'Element'
          : isPl && c.header === 'Action'
            ? 'Działanie'
            : isPl && c.header === 'Owner'
              ? 'Właściciel'
              : c.header,
    }));

    const rows: TableNode[] = fw.sampleRows.map((r, idx) => ({
      id: `fw-${fw.id}-${Date.now()}-${idx}`,
      type: 'idea',
      data: { ...r },
      position: { x: 0, y: 0 },
    }));

    setTimeout(() => {
      onApply(cols, rows);
      setApplying(false);
      setSelected(null);
      onClose();
      toast.success(
        isPl
          ? `Framework "${isPl ? fw.namePl : fw.nameEn}" zastosowany`
          : `Framework "${fw.nameEn}" applied`
      );
    }, 300);
  }, [isPl, onApply, onClose, selected]);

  if (!open) return null;

  const selectedFw = FRAMEWORKS.find((f) => f.id === selected);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-[560px] max-h-[80vh] overflow-auto rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {isPl ? 'Generator frameworków' : 'Framework Generator'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <X size={16} className="text-slate-600" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
            {isPl
              ? 'Wybierz framework konsultingowy. Tabela zostanie wypełniona odpowiednimi kolumnami i przykładowymi danymi.'
              : 'Choose a consulting framework. The table will be populated with appropriate columns and sample data.'}
          </p>

          <div className="grid grid-cols-2 gap-2">
            {FRAMEWORKS.map((fw) => {
              const Icon = fw.icon;
              const isActive = selected === fw.id;
              return (
                <button
                  key={fw.id}
                  onClick={() => setSelected(fw.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    isActive
                      ? 'border-primary-500/50 bg-primary-500/5 ring-1 ring-primary-500/20'
                      : 'border-slate-200/60 dark:border-navy-700/60 hover:bg-slate-50 dark:hover:bg-navy-800'
                  }`}
                >
                  <Icon size={20} className={`${fw.color} flex-shrink-0 mt-0.5`} />
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isPl ? fw.namePl : fw.nameEn}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {isPl ? fw.descPl : fw.descEn}
                    </div>
                    <div className="text-[9px] text-slate-600 mt-1">
                      {fw.columns.length} {isPl ? 'kolumn' : 'columns'} · {fw.sampleRows.length}{' '}
                      {isPl ? 'wierszy' : 'rows'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedFw && (
            <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-navy-800/50 border border-slate-200/40 dark:border-navy-700/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                {isPl ? 'Podgląd kolumn' : 'Column preview'}
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedFw.columns.map((col) => (
                  <span
                    key={col.key}
                    className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-navy-700/60 text-slate-700 dark:text-slate-300"
                  >
                    {col.header}
                    <span className="text-slate-600 ml-1">({col.type})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleApply}
            disabled={!selected || applying}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            {applying ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isPl ? 'Zastosuj framework' : 'Apply framework'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FrameworkGenerator;
