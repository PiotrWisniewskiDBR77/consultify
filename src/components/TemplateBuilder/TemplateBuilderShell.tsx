/**
 * TemplateBuilderShell — WSPÓLNA POWŁOKA 3 builderów template (#83d).
 *
 * Reużywa `ExecutiveModuleShell` (Editor Shell Standard D-I) 1:1 — wzorzec
 * z `DeckBuilderMelsView`. Jeden szkielet dla Dokument/Prezentacja/Arkusz;
 * archetyp typu zmienia WYŁĄCZNIE centrum (`centerEditor`) i etykiety listy.
 *
 * GÓRA  = command-row: badge typu · badge zakresu · picker motywu (secondary)
 *          · „Zapisz jako szablon" (primary = navy, NIE crimson).
 * LEWA  = spis struktury (TemplateStructureList).
 * ŚRODEK= edytor elementu (przekazany przez `centerEditor`).
 * PRAWA = Właściwości + Teresa (TemplateRightPanel).
 */

import { Palette } from 'lucide-react';
import React, { useMemo } from 'react';

import { ExecutiveModuleShell } from '@/components/shared/ExecutiveModuleShell';
import type { TopBarChipDescriptor } from '@/components/shared/ExecutiveModuleShell/ChipDescriptor';
import type { RightRailToolDescriptor } from '@/components/shared/ExecutiveModuleShell/RightRail';

import {
  elementCount,
  SCOPE_LABELS,
  TEMPLATE_TYPE_LABELS,
  type TemplateDraft,
} from './templateBuilderModel';
import {
  TEMPLATE_RIGHT_TOOLS,
  TemplateRightPanel,
  type TemplateRightTool,
  type ThemeOption,
} from './TemplateRightPanel';
import { type StructureListItem, TemplateStructureList } from './TemplateStructureList';

export interface TemplateBuilderShellProps {
  draft: TemplateDraft;
  onDraftChange: (patch: Partial<TemplateDraft>) => void;

  /** Spis struktury (lewa) — wyliczony przez kontener per typ. */
  structureItems: StructureListItem[];
  addLabel: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDelete: (id: string) => void;

  /** Centrum — edytor elementu (per typ). */
  centerEditor: React.ReactNode;

  /** Motywy org (Brand Kit) do pickera. */
  themeOptions: ThemeOption[];

  /** Prawy rail — kontrolowany aktywny tool (żeby chip motywu mógł go otwierać). */
  activeRightTool: TemplateRightTool | null;
  onActiveRightToolChange: (tool: TemplateRightTool | null) => void;

  /** Zapis jako szablon (POST fasady). */
  onSave: () => void;
  saving?: boolean;
  canSave?: boolean;

  onBack?: () => void;
  persistRailState?: boolean;
}

export const TemplateBuilderShell: React.FC<TemplateBuilderShellProps> = ({
  draft,
  onDraftChange,
  structureItems,
  addLabel,
  selectedId,
  onSelect,
  onAdd,
  onMove,
  onDelete,
  centerEditor,
  themeOptions,
  activeRightTool,
  onActiveRightToolChange,
  onSave,
  saving = false,
  canSave = true,
  onBack,
  persistRailState = true,
}) => {
  const themeLabel =
    themeOptions.find((o) => o.value === draft.themeRef)?.label ?? 'Domyślny motyw org';

  const chips: TopBarChipDescriptor[] = useMemo(
    () => [
      {
        id: 'type-badge',
        label: TEMPLATE_TYPE_LABELS[draft.type],
        kind: 'standard',
        group: 'secondary',
        disabled: true,
        tooltip: 'Typ szablonu (ustalony przy tworzeniu)',
      },
      {
        id: 'scope-badge',
        label: SCOPE_LABELS[draft.scope],
        kind: 'standard',
        group: 'secondary',
        dotTone: draft.scope === 'org' ? 'info' : 'neutral',
        onClick: () => onActiveRightToolChange('properties'),
        tooltip: 'Zakres widoczności — kliknij, by zmienić',
      },
      {
        id: 'theme',
        label: themeLabel,
        icon: Palette,
        kind: 'standard',
        group: 'secondary',
        onClick: () => onActiveRightToolChange('properties'),
        tooltip: 'Motyw / branding organizacji (D19 — osobno od szablonu)',
      },
      {
        id: 'save-template',
        label: saving ? 'Zapisywanie…' : 'Zapisz jako szablon',
        kind: 'primary',
        group: 'primary',
        disabled: saving || !canSave,
        onClick: onSave,
        tooltip: canSave ? 'Zapisz reużywalny szablon' : 'Uzupełnij nazwę szablonu',
      },
    ],
    [draft.type, draft.scope, themeLabel, saving, canSave, onSave, onActiveRightToolChange]
  );

  const rightTools: RightRailToolDescriptor[] = useMemo(
    () =>
      TEMPLATE_RIGHT_TOOLS.map((t) => ({
        id: t.id,
        label: t.label,
        icon: t.icon,
        active: activeRightTool === t.id,
      })),
    [activeRightTool]
  );

  return (
    <div
      className="h-screen flex flex-col bg-c-surface overflow-hidden"
      data-testid="template-builder-shell"
      data-structure-count={structureItems.length}
    >
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col">
          <ExecutiveModuleShell
            moduleKey={`template-builder-${draft.type}`}
            moduleLabel="Kreator szablonu"
            title={draft.name}
            onTitleChange={(next) => onDraftChange({ name: next })}
            onBack={onBack}
            backLabel="Wróć"
            topBarChips={chips}
            leftRailTitle={
              draft.type === 'doc' ? 'Sekcje' : draft.type === 'deck' ? 'Slajdy' : 'Kolumny'
            }
            leftRailContent={
              <TemplateStructureList
                key={`${draft.type}:${structureItems.map((item) => item.id).join('|')}`}
                items={structureItems}
                selectedId={selectedId}
                addLabel={addLabel}
                onSelect={onSelect}
                onAdd={onAdd}
                onMove={onMove}
                onDelete={onDelete}
              />
            }
            rightRailTools={rightTools}
            activeRightRailToolId={activeRightTool}
            onActiveRightRailToolChange={(id) =>
              onActiveRightToolChange((id as TemplateRightTool | null) ?? null)
            }
            renderRightRailPanel={(activeToolId) => (
              <TemplateRightPanel
                activeTool={(activeToolId as TemplateRightTool | null) ?? 'properties'}
                draft={draft}
                themeOptions={themeOptions}
                onDraftChange={onDraftChange}
              />
            )}
            canvas={centerEditor}
            onRunPrimary={canSave && !saving ? onSave : undefined}
            helpModalTitle="Skróty — kreator szablonu"
            persistRailState={persistRailState}
            testId="template-builder-mels"
          />
        </div>
      </div>
    </div>
  );
};

export default TemplateBuilderShell;
