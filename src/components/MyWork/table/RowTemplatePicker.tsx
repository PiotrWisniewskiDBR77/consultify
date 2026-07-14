/**
 * RowTemplatePicker — Quick template selector when adding a new row.
 * Pre-fills columns with template-specific defaults.
 */
import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  Plus,
  Shield,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { TableNode } from './tableTypes';

export interface RowTemplate {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  labelEn: string;
  labelPl: string;
  descEn: string;
  descPl: string;
  color: string;
  defaults: Record<string, any>;
}

const ROW_TEMPLATES: RowTemplate[] = [
  {
    id: 'blank',
    icon: Plus,
    labelEn: 'Blank row',
    labelPl: 'Pusty wiersz',
    descEn: 'Empty row to fill manually',
    descPl: 'Pusty wiersz do ręcznego wypełnienia',
    color: 'var(--c-tag-8)',
    defaults: {},
  },
  {
    id: 'idea',
    icon: Lightbulb,
    labelEn: 'Idea',
    labelPl: 'Pomysł',
    descEn: 'New idea with impact & effort',
    descPl: 'Nowy pomysł z wpływem i wysiłkiem',
    color: 'var(--c-tag-9)',
    defaults: { type: 'idea', status: 'To Do', priority: 'Medium' },
  },
  {
    id: 'action_item',
    icon: Zap,
    labelEn: 'Action Item',
    labelPl: 'Zadanie',
    descEn: 'Actionable task with owner & deadline',
    descPl: 'Zadanie z właścicielem i terminem',
    color: 'var(--c-tag-1)',
    defaults: { type: 'action', status: 'To Do', priority: 'High' },
  },
  {
    id: 'risk',
    icon: AlertTriangle,
    labelEn: 'Risk',
    labelPl: 'Ryzyko',
    descEn: 'Risk item with probability & impact',
    descPl: 'Ryzyko z prawdopodobieństwem i wpływem',
    color: 'var(--c-tag-4)',
    defaults: { type: 'risk', status: 'To Do', priority: 'High' },
  },
  {
    id: 'stakeholder',
    icon: Users,
    labelEn: 'Stakeholder',
    labelPl: 'Interesariusz',
    descEn: 'Person or group with influence & interest',
    descPl: 'Osoba lub grupa z wpływem i zainteresowaniem',
    color: 'var(--c-tag-2)',
    defaults: { type: 'stakeholder', status: 'In Progress' },
  },
  {
    id: 'opportunity',
    icon: TrendingUp,
    labelEn: 'Opportunity',
    labelPl: 'Szansa',
    descEn: 'Business opportunity to explore',
    descPl: 'Szansa biznesowa do zbadania',
    color: 'var(--c-tag-12)',
    defaults: { type: 'opportunity', status: 'To Do', priority: 'Medium' },
  },
  {
    id: 'decision',
    icon: CheckCircle2,
    labelEn: 'Decision',
    labelPl: 'Decyzja',
    descEn: 'Decision to be made with options',
    descPl: 'Decyzja do podjęcia z opcjami',
    color: 'var(--c-tag-10)',
    defaults: { type: 'decision', status: 'To Do' },
  },
  {
    id: 'requirement',
    icon: ListChecks,
    labelEn: 'Requirement',
    labelPl: 'Wymaganie',
    descEn: 'Business or technical requirement',
    descPl: 'Wymaganie biznesowe lub techniczne',
    color: 'var(--c-tag-11)',
    defaults: { type: 'requirement', status: 'To Do', priority: 'Medium' },
  },
  {
    id: 'kpi',
    icon: Target,
    labelEn: 'KPI / Metric',
    labelPl: 'KPI / Metryka',
    descEn: 'Key performance indicator to track',
    descPl: 'Kluczowy wskaźnik do śledzenia',
    color: 'var(--c-tag-5)',
    defaults: { type: 'kpi' },
  },
  {
    id: 'constraint',
    icon: Shield,
    labelEn: 'Constraint',
    labelPl: 'Ograniczenie',
    descEn: 'Limitation or boundary condition',
    descPl: 'Ograniczenie lub warunek brzegowy',
    color: 'var(--c-tag-8)',
    defaults: { type: 'constraint', status: 'To Do' },
  },
];

interface RowTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: RowTemplate) => void;
  anchorRect?: DOMRect | null;
}

export const RowTemplatePicker: React.FC<RowTemplatePickerProps> = ({
  open,
  onClose,
  onSelect,
  anchorRect,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const handleSelect = useCallback(
    (tpl: RowTemplate) => {
      onSelect(tpl);
      onClose();
    },
    [onClose, onSelect]
  );

  if (!open) return null;

  const style: React.CSSProperties = {};
  if (anchorRect) {
    style.position = 'fixed';
    style.left = anchorRect.left;
    style.top = anchorRect.bottom + 4;
    if ((style.top as number) > window.innerHeight - 400) {
      style.top = anchorRect.top - 400;
    }
  } else {
    style.position = 'fixed';
    style.left = '50%';
    style.top = '50%';
    style.transform = 'translate(-50%, -50%)';
  }

  return (
    <div className="fixed inset-0 z-[150]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[280px] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden"
        style={style}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
            {isPl ? 'Szablon wiersza' : 'Row Template'}
          </span>
          <button onClick={onClose} className="p-0.5 rounded hover:bg-c-surface-raised">
            <X size={11} className="text-c-text-muted" />
          </button>
        </div>
        <div className="max-h-[360px] overflow-auto p-1.5">
          {ROW_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <button
                key={tpl.id}
                onClick={() => handleSelect(tpl)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-c-surface-raised transition-colors text-left"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `color-mix(in srgb, ${tpl.color} 15%, transparent)` }}
                >
                  <Icon size={13} style={{ color: tpl.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-c-text-secondary">
                    {isPl ? tpl.labelPl : tpl.labelEn}
                  </div>
                  <div className="text-[9px] text-c-text-muted truncate">
                    {isPl ? tpl.descPl : tpl.descEn}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export function createNodeFromTemplate(template: RowTemplate): TableNode {
  return {
    id: `node-${Date.now()}`,
    type: template.defaults.type || 'idea',
    data: {
      label: '',
      color: template.color,
      ...template.defaults,
    },
    position: { x: 0, y: 0 },
  };
}

export { ROW_TEMPLATES };
export default RowTemplatePicker;
