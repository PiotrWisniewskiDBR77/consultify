/**
 * Deck Template Gallery (T059)
 * Browse, preview, and clone presentation templates.
 */

import {
  CheckCircle2,
  ChevronRight,
  Copy,
  FileText,
  Layout,
  Loader2,
  Sparkles,
  Star,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

function unwrap<T = any>(res: any): T {
  const d = res?.data;
  if (d && typeof d === 'object' && 'data' in d) return d.data;
  return d;
}

interface DeckTemplate {
  id: string;
  name: string;
  description: string;
  deck_type: string;
  audience: string;
  goal: string;
  theme: string;
  language_default: string;
  outline_json: { intent: string; title: string }[];
  must_have_intents: string[];
  recommended_visuals: string[];
  max_slides: number;
  min_slides: number;
  is_system: boolean;
  cloned_from: string | null;
}

interface DeckTemplateGalleryProps {
  onSelectTemplate?: (templateId: string) => void;
}

const DECK_TYPE_COLORS: Record<string, string> = {
  steering_committee: 'from-blue-500 to-indigo-500',
  program_update: 'from-emerald-500 to-blue-500',
  valuation_pack: 'from-violet-500 to-violet-600',
  tool_workshop: 'from-amber-500 to-amber-500',
  assessment_summary: 'from-blue-500 to-blue-500',
};

const AUDIENCE_LABELS: Record<string, { en: string; pl: string }> = {
  sponsor: { en: 'Sponsor', pl: 'Sponsor' },
  executive: { en: 'Executive', pl: 'Zarząd' },
  investor: { en: 'Investor / VC', pl: 'Inwestor / VC' },
  internal: { en: 'Internal Team', pl: 'Zespół wewnętrzny' },
};

const GOAL_LABELS: Record<string, { en: string; pl: string }> = {
  inform: { en: 'Inform', pl: 'Informuj' },
  decide: { en: 'Decide', pl: 'Decyduj' },
  sell: { en: 'Sell', pl: 'Sprzedaj' },
  align: { en: 'Align', pl: 'Alignuj' },
};

export const DeckTemplateGallery: React.FC<DeckTemplateGalleryProps> = ({ onSelectTemplate }) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [templates, setTemplates] = useState<DeckTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await Api.get('/presentations/templates');
      const data = unwrap(res);
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load templates');
    }
    setLoading(false);
  };

  const handleClone = async (templateId: string) => {
    setCloning(templateId);
    try {
      const res = await Api.post(`/presentations/templates/${templateId}/clone`, {});
      const data = unwrap(res);
      trackFunnelEvent('template_cloned', { templateId, newId: data?.id });
      toast.success(t('presentations.templates.cloned', 'Template cloned to your organization'));
      loadTemplates();
    } catch {
      toast.error(t('presentations.templates.cloneFailed', 'Failed to clone'));
    }
    setCloning(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingState variant="spinner" />
      </div>
    );
  }

  const systemTemplates = templates.filter((t) => t.is_system);
  const orgTemplates = templates.filter((t) => !t.is_system);

  return (
    <div className="space-y-8">
      {/* System Templates */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-amber-400" />
          {t('presentations.templates.systemTemplates', 'System Templates')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemTemplates.map((tmpl) => (
            <TemplateCard
              key={tmpl.id}
              template={tmpl}
              isPl={isPl}
              isExpanded={expandedId === tmpl.id}
              onToggle={() => setExpandedId(expandedId === tmpl.id ? null : tmpl.id)}
              onSelect={onSelectTemplate ? () => onSelectTemplate(tmpl.id) : undefined}
              onClone={() => handleClone(tmpl.id)}
              cloning={cloning === tmpl.id}
            />
          ))}
        </div>
      </div>

      {/* Org Templates */}
      {orgTemplates.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <Layout className="w-5 h-5 text-c-info" />
            {t('presentations.templates.orgTemplates', 'Organization Templates')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orgTemplates.map((tmpl) => (
              <TemplateCard
                key={tmpl.id}
                template={tmpl}
                isPl={isPl}
                isExpanded={expandedId === tmpl.id}
                onToggle={() => setExpandedId(expandedId === tmpl.id ? null : tmpl.id)}
                onSelect={onSelectTemplate ? () => onSelectTemplate(tmpl.id) : undefined}
                cloning={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TemplateCard: React.FC<{
  template: DeckTemplate;
  isPl: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect?: () => void;
  onClone?: () => void;
  cloning: boolean;
}> = ({ template, isPl, isExpanded, onToggle, onSelect, onClone, cloning }) => {
  const { t } = useTranslation();
  const gradientClass = DECK_TYPE_COLORS[template.deck_type] || 'from-slate-500 to-slate-600';
  const audience = isPl
    ? AUDIENCE_LABELS[template.audience]?.pl
    : AUDIENCE_LABELS[template.audience]?.en;
  const goal = isPl ? GOAL_LABELS[template.goal]?.pl : GOAL_LABELS[template.goal]?.en;

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header gradient */}
      <div className={`h-2 bg-gradient-to-r ${gradientClass}`} />

      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white">{template.name}</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {template.description}
            </p>
          </div>
          {template.is_system && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 ml-2">
              SYSTEM
            </span>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Tag label={audience || template.audience} />
          <Tag label={goal || template.goal} />
          <Tag label={template.theme} />
          <Tag label={`${template.min_slides}–${template.max_slides} slides`} />
        </div>

        {/* Outline preview */}
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 mt-3 text-sm text-c-info hover:text-c-info"
        >
          {isExpanded ? (
            <ChevronRight size={14} className="rotate-90" />
          ) : (
            <ChevronRight size={14} />
          )}
          {t('presentations.templates.viewOutline', 'View outline')} ({template.outline_json.length}{' '}
          {t('presentations.outline.slides', 'slides')})
        </button>

        {isExpanded && (
          <div className="mt-2 space-y-1 pl-2 border-l-2 border-c-info/20">
            {template.outline_json.map((slide, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-slate-600 w-4">{i + 1}</span>
                <FileText size={12} className="text-slate-600" />
                <span className="text-slate-600 dark:text-slate-300">{slide.title}</span>
                <span className="text-xs text-slate-600">({slide.intent})</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-navy-700">
          {onSelect && (
            <button
              onClick={onSelect}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-navy-900 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 text-sm font-medium rounded-lg hover:bg-navy-800"
            >
              <Sparkles size={14} /> {t('presentations.templates.use', 'Use')}
            </button>
          )}
          {onClone && template.is_system && (
            <button
              onClick={onClone}
              disabled={cloning}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50"
            >
              {cloning ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
              {t('presentations.templates.clone', 'Clone')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Tag: React.FC<{ label: string }> = ({ label }) => (
  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400">
    {label}
  </span>
);

export default DeckTemplateGallery;
