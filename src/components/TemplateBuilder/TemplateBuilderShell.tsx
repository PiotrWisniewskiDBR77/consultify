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
import { useTranslation } from 'react-i18next';

import { ExecutiveModuleShell } from '@/components/shared/ExecutiveModuleShell';
import type { TopBarChipDescriptor } from '@/components/shared/ExecutiveModuleShell/ChipDescriptor';
import type { RightRailToolDescriptor } from '@/components/shared/ExecutiveModuleShell/RightRail';

import {
  pickTemplateLabel,
  SCOPE_LABELS,
  SCOPE_LABELS_EN,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPE_LABELS_EN,
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
  saveLabel?: string;
  validationErrors?: string[];
  lifecycle?: {
    status: string;
    version: string;
    historyCount: number;
    onValidate: () => void;
    onApprove?: () => void;
    onDeprecate?: () => void;
    onDelete?: () => void;
  };

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
  saveLabel,
  validationErrors = [],
  lifecycle,
  onBack,
  persistRailState = true,
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language || 'pl';
  const resolvedSaveLabel = saveLabel ?? t('templateBuilder.shell.save', 'Zapisz jako szablon');
  const themeLabel =
    themeOptions.find((o) => o.value === draft.themeRef)?.label ??
    t('templateBuilder.shell.defaultOrgTheme', 'Domyślny motyw org');

  const chips: TopBarChipDescriptor[] = useMemo(
    () => [
      {
        id: 'type-badge',
        label: pickTemplateLabel(TEMPLATE_TYPE_LABELS, TEMPLATE_TYPE_LABELS_EN, draft.type, language),
        kind: 'standard',
        group: 'secondary',
        disabled: true,
        tooltip: t('templateBuilder.shell.typeTooltip', 'Typ szablonu (ustalony przy tworzeniu)'),
      },
      {
        id: 'scope-badge',
        label: pickTemplateLabel(SCOPE_LABELS, SCOPE_LABELS_EN, draft.scope, language),
        kind: 'standard',
        group: 'secondary',
        dotTone: draft.scope === 'org' ? 'info' : 'neutral',
        onClick: () => onActiveRightToolChange('properties'),
        tooltip: t('templateBuilder.shell.scopeTooltip', 'Zakres widoczności — kliknij, by zmienić'),
      },
      {
        id: 'theme',
        label: themeLabel,
        icon: Palette,
        kind: 'standard',
        group: 'secondary',
        onClick: () => onActiveRightToolChange('properties'),
        tooltip: t(
          'templateBuilder.shell.themeTooltip',
          'Motyw / branding organizacji (D19 — osobno od szablonu)'
        ),
      },
      {
        id: 'validate-template',
        label:
          validationErrors.length === 0
            ? t('templateBuilder.shell.validationOk', 'Walidacja: OK')
            : t('templateBuilder.shell.validationErrors', 'Błędy: {{count}}', {
                count: validationErrors.length,
              }),
        kind: 'standard',
        group: 'secondary',
        dotTone: validationErrors.length === 0 ? 'success' : 'danger',
        onClick: lifecycle?.onValidate,
        tooltip:
          validationErrors[0] ||
          t('templateBuilder.shell.validationPassedTooltip', 'Szablon przeszedł walidację struktury'),
      },
      ...(lifecycle
        ? [
            {
              id: 'template-version',
              label: t('templateBuilder.shell.versionHistory', '{{version}} · {{status}} · {{count}} zmian', {
                version: lifecycle.version,
                status: lifecycle.status,
                count: lifecycle.historyCount,
              }),
              kind: 'standard' as const,
              group: 'secondary' as const,
              onClick: lifecycle.onValidate,
              tooltip: t('templateBuilder.shell.versionHistoryTooltip', 'Wersja i historia lifecycle'),
            },
          ]
        : []),
      ...(lifecycle?.onDeprecate
        ? [
            {
              id: 'deprecate-template',
              label: t('templateBuilder.shell.deprecate', 'Wycofaj'),
              kind: 'standard' as const,
              group: 'secondary' as const,
              onClick: lifecycle.onDeprecate,
              tooltip: t(
                'templateBuilder.shell.deprecateTooltip',
                'Wycofaj szablon z użycia bez utraty historii'
              ),
            },
          ]
        : []),
      ...(lifecycle?.onDelete
        ? [
            {
              id: 'delete-template',
              label: t('templateBuilder.shell.deleteDraft', 'Usuń draft'),
              kind: 'standard' as const,
              group: 'secondary' as const,
              onClick: lifecycle.onDelete,
              tooltip: t('templateBuilder.shell.deleteDraftTooltip', 'Usuń nieopublikowany szablon'),
            },
          ]
        : []),
      ...(lifecycle?.onApprove
        ? [
            {
              id: 'approve-template',
              label: t('templateBuilder.shell.approveAndPublish', 'Zatwierdź i opublikuj'),
              kind: 'primary' as const,
              group: 'primary' as const,
              onClick: lifecycle.onApprove,
              tooltip: t('templateBuilder.shell.approveTooltip', 'Zatwierdź szablon do użycia'),
            },
          ]
        : []),
      {
        id: 'save-template',
        label: saving ? t('templateBuilder.shell.saving', 'Zapisywanie…') : resolvedSaveLabel,
        kind: 'primary',
        group: 'primary',
        disabled: saving || !canSave,
        onClick: onSave,
        tooltip: canSave
          ? t('templateBuilder.shell.saveTooltip', 'Zapisz reużywalny szablon')
          : validationErrors[0] || t('templateBuilder.shell.completeTemplate', 'Uzupełnij szablon'),
      },
    ],
    [
      draft.type,
      draft.scope,
      themeLabel,
      saving,
      canSave,
      saveLabel,
      validationErrors,
      lifecycle,
      onSave,
      onActiveRightToolChange,
    ]
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
            moduleLabel={t('templateBuilder.shell.moduleLabel', 'Kreator szablonu')}
            title={draft.name}
            onTitleChange={(next) => onDraftChange({ name: next })}
            onBack={onBack}
            backLabel={t('templateBuilder.shell.back', 'Wróć')}
            topBarChips={chips}
            leftRailTitle={
              draft.type === 'doc'
                ? t('templateBuilder.shell.sections', 'Sekcje')
                : draft.type === 'deck'
                  ? t('templateBuilder.shell.slides', 'Slajdy')
                  : t('templateBuilder.shell.sheets', 'Arkusze')
            }
            leftRailContent={
              <TemplateStructureList
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
