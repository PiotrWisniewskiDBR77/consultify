/**
 * TemplateRightPanel — prawy rail wspólnej powłoki builderów (#83d).
 *
 * Dwa narzędzia (≤5 sekcji, kanon §2 PRAWA):
 *   - Właściwości: meta szablonu (nazwa, opis, zakres, motyw org).
 *   - Teresa: jedno wejście AI (F4) — placeholder "Omów z Teresą".
 *
 * Branding = motyw org OSOBNO od template'u (D19); tu tylko ref/picker.
 */

import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { Settings2 } from 'lucide-react';
import React from 'react';

import { Field, Segmented, Select, TextArea, TextInput } from './templateBuilderFields';
import { SCOPE_LABELS, type TemplateDraft, type TemplateScope } from './templateBuilderModel';

export type TemplateRightTool = 'properties' | 'teresa';

export interface TemplateRightRailToolDef {
  id: TemplateRightTool;
  label: string;
  icon: LucideIcon;
}

export const TEMPLATE_RIGHT_TOOLS: TemplateRightRailToolDef[] = [
  { id: 'properties', label: 'Właściwości', icon: Settings2 },
  { id: 'teresa', label: 'Omów z Teresą', icon: Sparkles },
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
}> = ({ activeTool, draft, themeOptions, onDraftChange }) => {
  if (activeTool === 'teresa') {
    return (
      <div className="p-4 space-y-3" data-testid="template-teresa-panel">
        <div className="flex items-center gap-2 text-c-text">
          <Sparkles className="w-4 h-4 text-c-focus" />
          <span className="text-sm font-semibold">Teresa</span>
        </div>
        <p className="text-sm text-c-text-muted">
          Poproś Teresę o zaproponowanie struktury szablonu, przeredagowanie sekcji albo dobranie
          archetypów slajdów.
        </p>
        <div className="rounded-lg border border-dashed border-c-border bg-c-bg p-3 text-[13px] text-c-text-muted">
          Wejście AI (F4) — jeden byt asystenta. Podłączenie do UnifiedChatPanel poza zakresem tego
          kroku (buildery struktury).
        </div>
        <button
          type="button"
          disabled
          className="w-full rounded-lg bg-c-surface border border-c-border px-3 py-2 text-sm font-medium text-c-text-muted opacity-60 cursor-not-allowed"
        >
          Otwórz rozmowę z Teresą
        </button>
      </div>
    );
  }

  // properties (default)
  const scopeOpts = (Object.keys(SCOPE_LABELS) as TemplateScope[]).map((k) => ({
    value: k,
    label: SCOPE_LABELS[k],
  }));
  return (
    <div className="p-4 space-y-4" data-testid="template-properties-panel">
      <div className="flex items-center gap-2 text-c-text">
        <Settings2 className="w-4 h-4 text-c-text-muted" />
        <span className="text-sm font-semibold">Właściwości szablonu</span>
      </div>
      <Field label="Nazwa">
        <TextInput
          value={draft.name}
          onChange={(v) => onDraftChange({ name: v })}
          testId="prop-name"
        />
      </Field>
      <Field label="Opis" hint="Krótko: do czego służy ten szablon.">
        <TextArea
          value={draft.description}
          onChange={(v) => onDraftChange({ description: v })}
          rows={2}
          testId="prop-desc"
        />
      </Field>
      <Field label="Dostępność">
        <Segmented
          value={draft.scope}
          options={scopeOpts}
          onChange={(v) => onDraftChange({ scope: v })}
          testId="prop-scope"
        />
      </Field>
      <Field label="Motyw (branding org)" hint="Brand Kit organizacji — osobno od struktury (D19).">
        <Select
          value={draft.themeRef ?? ''}
          options={[{ value: '', label: 'Domyślny motyw org' }, ...themeOptions]}
          onChange={(v) => onDraftChange({ themeRef: v === '' ? null : v })}
          testId="prop-theme"
        />
      </Field>
    </div>
  );
};

export default TemplateRightPanel;
