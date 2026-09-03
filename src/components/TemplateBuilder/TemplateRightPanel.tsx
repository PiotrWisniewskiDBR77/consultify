/**
 * TemplateRightPanel — prawy rail wspólnej powłoki builderów (#83d).
 *
 * Jedno rzeczywiste narzędzie (kanon §2 PRAWA): Właściwości szablonu.
 * Teresa wróci dopiero razem z bezpiecznym handlerem UnifiedChat — prawy rail
 * nie może eksponować martwego CTA ani obiecywać niewdrożonej funkcji.
 *
 * Branding = motyw org OSOBNO od template'u (D19); tu tylko ref/picker.
 */

import { type LucideIcon, Settings2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Field, Segmented, Select, TextArea, TextInput } from './templateBuilderFields';
import {
  pickTemplateLabel,
  SCOPE_LABELS,
  SCOPE_LABELS_EN,
  type TemplateDraft,
  type TemplateScope,
} from './templateBuilderModel';

export type TemplateRightTool = 'properties';

export interface TemplateRightRailToolDef {
  id: TemplateRightTool;
  label: string;
  icon: LucideIcon;
}

export const TEMPLATE_RIGHT_TOOLS: TemplateRightRailToolDef[] = [
  { id: 'properties', label: 'Właściwości', icon: Settings2 },
];

/** Motywy org (Brand Kit) — w realu z themeRegistry/brandIngestion; tu przykładowe. */
export interface ThemeOption {
  value: string;
  label: string;
}

export const TemplateRightPanel: React.FC<{
  activeTool: TemplateRightTool | null;
  draft: TemplateDraft;
  themeOptions: ThemeOption[];
  onDraftChange: (patch: Partial<TemplateDraft>) => void;
}> = ({ draft, themeOptions, onDraftChange }) => {
  const { t, i18n } = useTranslation();
  const scopeOpts = (Object.keys(SCOPE_LABELS) as TemplateScope[]).map((k) => ({
    value: k,
    label: pickTemplateLabel(SCOPE_LABELS, SCOPE_LABELS_EN, k, i18n.language || 'pl'),
  }));
  return (
    <div className="p-4 space-y-4" data-testid="template-properties-panel">
      <div className="flex items-center gap-2 text-c-text">
        <Settings2 className="w-4 h-4 text-c-text-muted" />
        <span className="text-sm font-semibold">
          {t('templateBuilder.rightPanel.heading', 'Właściwości szablonu')}
        </span>
      </div>
      <Field label={t('templateBuilder.rightPanel.nameLabel', 'Nazwa')}>
        <TextInput
          value={draft.name}
          onChange={(v) => onDraftChange({ name: v })}
          testId="prop-name"
        />
      </Field>
      <Field
        label={t('templateBuilder.rightPanel.descLabel', 'Opis')}
        hint={t('templateBuilder.rightPanel.descHint', 'Krótko: do czego służy ten szablon.')}
      >
        <TextArea
          value={draft.description}
          onChange={(v) => onDraftChange({ description: v })}
          rows={2}
          testId="prop-desc"
        />
      </Field>
      <Field label={t('templateBuilder.rightPanel.availabilityLabel', 'Dostępność')}>
        <Segmented
          value={draft.scope}
          options={scopeOpts}
          onChange={(v) => onDraftChange({ scope: v })}
          testId="prop-scope"
        />
      </Field>
      <Field
        label={t('templateBuilder.rightPanel.themeLabel', 'Motyw (branding org)')}
        hint={t('templateBuilder.rightPanel.themeHint', 'Brand Kit organizacji — osobno od struktury (D19).')}
      >
        <Select
          value={draft.themeRef ?? ''}
          options={[
            { value: '', label: t('templateBuilder.shell.defaultOrgTheme', 'Domyślny motyw org') },
            ...themeOptions,
          ]}
          onChange={(v) => onDraftChange({ themeRef: v === '' ? null : v })}
          testId="prop-theme"
        />
      </Field>
    </div>
  );
};

export default TemplateRightPanel;
