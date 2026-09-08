/**
 * TemplateCenterEditors — CENTRUM wspólnej powłoki builderów (#83c/#83d).
 *
 * Powłoka (ExecutiveModuleShell) i raile są WSPÓLNE; archetyp typu zmienia
 * WYŁĄCZNIE ten komponent centrum — kontrakt Editor Shell Standard (D-I).
 * Każdy edytor operuje na STRUKTURZE jednego elementu (nie treści finalnej).
 */

import { FileText, LayoutTemplate, Plus, Table2, Trash2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Field, Segmented, Select, TextArea, TextInput, Toggle } from './templateBuilderFields';
import {
  type DeckSlide,
  DEPTH_LABELS,
  DEPTH_LABELS_EN,
  DOC_BLOCK_LABELS,
  DOC_BLOCK_LABELS_EN,
  type DocBlockKind,
  type DocSection,
  newSheetColumn,
  pickTemplateLabel,
  SHEET_COLUMN_TYPE_LABELS,
  SHEET_COLUMN_TYPE_LABELS_EN,
  type SheetColumn,
  type SheetColumnType,
  type SheetValidationType,
  SLIDE_ARCHETYPE_LABELS,
  SLIDE_ARCHETYPE_LABELS_EN,
  type SlideArchetype,
  type TemplateDepth,
  type WorkbookTemplateSheet,
} from './templateBuilderModel';

const CENTER_WRAP = 'h-full overflow-y-auto bg-c-bg flex justify-center';
const CARD =
  'w-full max-w-2xl m-6 rounded-xl border border-c-border bg-c-surface p-6 space-y-5 shadow-sm';

const EmptyCenter: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="h-full flex flex-col items-center justify-center gap-3 text-c-text-muted bg-c-bg">
    <div className="opacity-40">{icon}</div>
    <p className="text-sm">{text}</p>
  </div>
);

// ── DOC — edytor sekcji ────────────────────────────────────────────────────

export const DocSectionEditor: React.FC<{
  section: DocSection | null;
  onChange: (patch: Partial<DocSection>) => void;
}> = ({ section, onChange }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language || 'pl';
  if (!section)
    return (
      <EmptyCenter
        icon={<FileText className="h-6 w-6" aria-hidden />}
        text={t('templateBuilder.editors.doc.emptyPick', 'Pick a section from the list on the left.')}
      />
    );
  const blockOpts = (Object.keys(DOC_BLOCK_LABELS) as DocBlockKind[]).map((k) => ({
    value: k,
    label: pickTemplateLabel(DOC_BLOCK_LABELS, DOC_BLOCK_LABELS_EN, k, language),
  }));
  const depthOpts = (Object.keys(DEPTH_LABELS) as TemplateDepth[]).map((k) => ({
    value: k,
    label: pickTemplateLabel(DEPTH_LABELS, DEPTH_LABELS_EN, k, language),
  }));
  return (
    <div className={CENTER_WRAP} data-testid="doc-section-editor">
      <div className={CARD}>
        <div className="flex items-center gap-2 text-c-text-muted text-xs font-semibold uppercase tracking-wide">
          <FileText className="w-4 h-4" aria-hidden />
          {t('templateBuilder.editors.doc.heading', 'Document section')}
        </div>
        <Field label={t('templateBuilder.editors.doc.titleLabel', 'Section title')}>
          <TextInput
            value={section.title}
            onChange={(v) => onChange({ title: v })}
            placeholder={t('templateBuilder.editors.doc.titlePlaceholder', 'np. Streszczenie wykonawcze')}
            testId="doc-title"
          />
        </Field>
        <Field
          label={t('templateBuilder.editors.doc.blockLabel', 'Typ bloku')}
          hint={t('templateBuilder.editors.doc.blockHint', 'What element the generator renders in this section.')}
        >
          <Select
            value={section.block}
            options={blockOpts}
            onChange={(v) => onChange({ block: v })}
            testId="doc-block"
          />
        </Field>
        <Field label={t('templateBuilder.editors.doc.depthLabel', 'Length / depth')}>
          <Segmented
            value={section.depth}
            options={depthOpts}
            onChange={(v) => onChange({ depth: v })}
            testId="doc-depth"
          />
        </Field>
        <Field
          label={t('templateBuilder.editors.instructionLabel', 'Instructions for the generator')}
          hint={t(
            'templateBuilder.editors.doc.instructionHint',
            'Structural placeholder — what should go here. NOT the final content.'
          )}
        >
          <TextArea
            value={section.hint}
            onChange={(v) => onChange({ hint: v })}
            placeholder={t(
              'templateBuilder.editors.doc.instructionPlaceholder',
              'np. 3 kluczowe wnioski + rekomendacja, ton executive'
            )}
            testId="doc-hint"
          />
        </Field>
        <Toggle
          checked={section.aiFilled}
          onChange={(v) => onChange({ aiFilled: v })}
          label={t('templateBuilder.editors.aiFilledLabel', 'AI-filled')}
          description={t(
            'templateBuilder.editors.doc.aiFilledDesc',
            'When off — the section stays empty for manual completion.'
          )}
        />
      </div>
    </div>
  );
};

// ── DECK — edytor slajdu ───────────────────────────────────────────────────

export const DeckSlideEditor: React.FC<{
  slide: DeckSlide | null;
  onChange: (patch: Partial<DeckSlide>) => void;
}> = ({ slide, onChange }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language || 'pl';
  if (!slide)
    return (
      <EmptyCenter
        icon={<LayoutTemplate className="h-6 w-6" aria-hidden />}
        text={t('templateBuilder.editors.deck.emptyPick', 'Pick a slide from the list on the left.')}
      />
    );
  const archOpts = (Object.keys(SLIDE_ARCHETYPE_LABELS) as SlideArchetype[]).map((k) => ({
    value: k,
    label: pickTemplateLabel(SLIDE_ARCHETYPE_LABELS, SLIDE_ARCHETYPE_LABELS_EN, k, language),
  }));
  return (
    <div className={CENTER_WRAP} data-testid="deck-slide-editor">
      <div className={CARD}>
        <div className="flex items-center gap-2 text-c-text-muted text-xs font-semibold uppercase tracking-wide">
          <LayoutTemplate className="w-4 h-4" aria-hidden />
          {t('templateBuilder.editors.deck.heading', 'Presentation slide')}
        </div>
        {/* Podgląd archetypu — schematyczny układ slajdu. */}
        <SlidePreview archetype={slide.archetype} title={slide.title} />
        <Field label={t('templateBuilder.editors.deck.titleLabel', 'Slide title')}>
          <TextInput
            value={slide.title}
            onChange={(v) => onChange({ title: v })}
            placeholder={t('templateBuilder.editors.deck.titlePlaceholder', 'np. Kontekst rynkowy')}
            testId="deck-title"
          />
        </Field>
        <Field
          label={t('templateBuilder.editors.deck.archetypeLabel', 'Layout archetype')}
          hint={t('templateBuilder.editors.deck.archetypeHint', 'The slide\'s layout — changes composition, not content.')}
        >
          <Select
            value={slide.archetype}
            options={archOpts}
            onChange={(v) => onChange({ archetype: v })}
            testId="deck-archetype"
          />
        </Field>
        <Field
          label={t('templateBuilder.editors.instructionLabel', 'Instructions for the generator')}
          hint={t('templateBuilder.editors.deck.instructionHint', 'What the slide shows; structural placeholder.')}
        >
          <TextArea
            value={slide.hint}
            onChange={(v) => onChange({ hint: v })}
            placeholder={t(
              'templateBuilder.editors.deck.instructionPlaceholder',
              'e.g. market-share chart + 2 sentences of commentary'
            )}
            testId="deck-hint"
          />
        </Field>
        <Toggle
          checked={slide.aiFilled}
          onChange={(v) => onChange({ aiFilled: v })}
          label={t('templateBuilder.editors.aiFilledLabel', 'AI-filled')}
          description={t(
            'templateBuilder.editors.deck.aiFilledDesc',
            'When off — the slide stays empty for manual completion.'
          )}
        />
      </div>
    </div>
  );
};

const SlidePreview: React.FC<{ archetype: SlideArchetype; title: string }> = ({
  archetype,
  title,
}) => {
  const { t, i18n } = useTranslation();
  const bar = 'rounded bg-c-border';
  return (
    <div className="rounded-lg border border-c-border bg-c-bg p-4">
      <div className="aspect-video w-full rounded-md border border-c-border bg-c-surface p-3 flex flex-col gap-2">
        {archetype === 'cover' || archetype === 'section' || archetype === 'closing' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <div className={`h-3 w-1/2 ${bar}`} />
            <div className={`h-2 w-1/3 ${bar}`} />
          </div>
        ) : archetype === 'quote' ? (
          <div className="flex-1 flex items-center justify-center">
            <div className={`h-2.5 w-3/4 ${bar}`} />
          </div>
        ) : (
          <>
            <div className={`h-2.5 w-2/5 ${bar}`} />
            {archetype === 'two-column' ? (
              <div className="flex-1 flex gap-2">
                <div className="flex-1 rounded bg-c-bg border border-c-border" />
                <div className="flex-1 rounded bg-c-bg border border-c-border" />
              </div>
            ) : archetype === 'kpi' ? (
              <div className="flex-1 grid grid-cols-3 gap-2">
                <div className="rounded bg-c-bg border border-c-border" />
                <div className="rounded bg-c-bg border border-c-border" />
                <div className="rounded bg-c-bg border border-c-border" />
              </div>
            ) : archetype === 'chart' ? (
              <div className="flex-1 flex items-end gap-1.5 px-1">
                <div className="w-full bg-c-border rounded-t" style={{ height: '40%' }} />
                <div className="w-full bg-c-border rounded-t" style={{ height: '70%' }} />
                <div className="w-full bg-c-border rounded-t" style={{ height: '55%' }} />
                <div className="w-full bg-c-border rounded-t" style={{ height: '85%' }} />
              </div>
            ) : (
              <div className="flex-1 space-y-1.5">
                <div className={`h-2 w-full ${bar}`} />
                <div className={`h-2 w-5/6 ${bar}`} />
                <div className={`h-2 w-4/6 ${bar}`} />
              </div>
            )}
          </>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-c-text-muted truncate">
        {pickTemplateLabel(SLIDE_ARCHETYPE_LABELS, SLIDE_ARCHETYPE_LABELS_EN, archetype, i18n.language || 'pl')} ·{' '}
        {title || t('templateBuilder.editors.deck.untitled', 'untitled')}
      </p>
    </div>
  );
};

// ── TABLE — edytor kolumny (Excel/Sheet) ───────────────────────────────────

export const WorkbookSheetEditor: React.FC<{
  sheet: WorkbookTemplateSheet | null;
  onChange: (sheet: WorkbookTemplateSheet) => void;
}> = ({ sheet, onChange }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language || 'pl';
  if (!sheet)
    return (
      <EmptyCenter
        icon={<Table2 className="h-6 w-6" aria-hidden />}
        text={t('templateBuilder.editors.table.emptyPick', 'Pick a sheet from the list on the left.')}
      />
    );
  const typeOpts = (Object.keys(SHEET_COLUMN_TYPE_LABELS) as SheetColumnType[]).map((k) => ({
    value: k,
    label: pickTemplateLabel(SHEET_COLUMN_TYPE_LABELS, SHEET_COLUMN_TYPE_LABELS_EN, k, language),
  }));
  const validationOpts: { value: SheetValidationType; label: string }[] = [
    { value: 'none', label: t('templateBuilder.editors.table.validation.none', 'None') },
    { value: 'list', label: t('templateBuilder.editors.table.validation.list', 'List of values') },
    { value: 'decimal', label: t('templateBuilder.editors.table.validation.decimal', 'Decimal number') },
    { value: 'whole', label: t('templateBuilder.editors.table.validation.whole', 'Whole number') },
  ];
  const patchColumn = (id: string, patch: Partial<SheetColumn>) =>
    onChange({
      ...sheet,
      columns: sheet.columns.map((column) => (column.id === id ? { ...column, ...patch } : column)),
    });
  return (
    <div className={CENTER_WRAP} data-testid="workbook-sheet-editor">
      <div className={CARD}>
        <div className="flex items-center gap-2 text-c-text-muted text-xs font-semibold uppercase tracking-wide">
          <Table2 className="w-4 h-4" aria-hidden />
          {t('templateBuilder.editors.table.heading', 'Workbook sheet')}
        </div>
        <Field label={t('templateBuilder.editors.table.sheetNameLabel', 'Sheet name')}>
          <TextInput
            value={sheet.name}
            onChange={(name) => onChange({ ...sheet, name })}
            placeholder={t('templateBuilder.editors.table.sheetNamePlaceholder', 'np. Plan finansowy')}
            testId="sheet-name"
          />
        </Field>
        {sheet.columns.map((column, index) => (
          <div key={column.id} className="space-y-4 rounded-lg border border-c-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-c-text">
                {t('templateBuilder.editors.table.columnN', 'Kolumna {{n}}', { n: index + 1 })}
              </span>
              <button
                type="button"
                aria-label={t('templateBuilder.editors.table.deleteColumnN', 'Delete column {{n}}', {
                  n: index + 1,
                })}
                disabled={sheet.columns.length === 1}
                onClick={() =>
                  onChange({
                    ...sheet,
                    columns: sheet.columns.filter((item) => item.id !== column.id),
                  })
                }
                className="rounded p-1 text-c-text-muted hover:text-c-danger disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <Field label={t('templateBuilder.editors.table.columnNameLabel', 'Column name')}>
              <TextInput
                value={column.name}
                onChange={(name) => patchColumn(column.id, { name })}
                testId={`sheet-column-${index}-name`}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('templateBuilder.editors.table.dataTypeLabel', 'Typ danych')}>
                <Select
                  value={column.type}
                  options={typeOpts}
                  onChange={(type) => patchColumn(column.id, { type })}
                  testId={`sheet-column-${index}-type`}
                />
              </Field>
              <Field
                label={t('templateBuilder.editors.table.numberFormatLabel', 'Format liczbowy')}
                hint={t('templateBuilder.editors.table.numberFormatHint', 'Opcjonalny format zgodny z Excel.')}
              >
                <TextInput
                  value={column.numberFormat}
                  onChange={(numberFormat) => patchColumn(column.id, { numberFormat })}
                  placeholder="np. #,##0.00"
                  testId={`sheet-column-${index}-number-format`}
                />
              </Field>
            </div>
            {column.type === 'formula' ? (
              <Field
                label={t('templateBuilder.editors.table.formulaLabel', 'Starting formula')}
                hint={t(
                  'templateBuilder.editors.table.formulaHint',
                  'Np. =B2*C2; zostanie zapisana w pierwszym wierszu.'
                )}
              >
                <TextInput
                  value={column.formula}
                  onChange={(formula) => patchColumn(column.id, { formula })}
                  placeholder="=B2*C2"
                  testId={`sheet-column-${index}-formula`}
                />
              </Field>
            ) : (
              <Field
                label={t('templateBuilder.editors.table.starterValueLabel', 'Starting value')}
                hint={t('templateBuilder.editors.table.starterValueHint', 'Optional value for the first row.')}
              >
                <TextInput
                  value={column.starterValue}
                  onChange={(starterValue) => patchColumn(column.id, { starterValue })}
                  testId={`sheet-column-${index}-starter`}
                />
              </Field>
            )}
            <Field label={t('templateBuilder.editors.table.validationLabel', 'Data validation')}>
              <Select
                value={column.validation.type}
                options={validationOpts}
                onChange={(type) =>
                  patchColumn(column.id, { validation: { ...column.validation, type } })
                }
                testId={`sheet-column-${index}-validation-type`}
              />
            </Field>
            {column.validation.type === 'list' && (
              <Field
                label={t('templateBuilder.editors.table.allowedValuesLabel', 'Allowed values')}
                hint={t('templateBuilder.editors.table.allowedValuesHint', 'Separate values with commas.')}
              >
                <TextInput
                  value={column.validation.values}
                  onChange={(values) =>
                    patchColumn(column.id, { validation: { ...column.validation, values } })
                  }
                  placeholder="Plan, Realizacja"
                  testId={`sheet-column-${index}-validation-values`}
                />
              </Field>
            )}
            {(column.validation.type === 'decimal' || column.validation.type === 'whole') && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('templateBuilder.editors.table.minLabel', 'Minimum')}>
                  <TextInput
                    value={column.validation.min}
                    onChange={(min) =>
                      patchColumn(column.id, { validation: { ...column.validation, min } })
                    }
                    testId={`sheet-column-${index}-validation-min`}
                  />
                </Field>
                <Field label={t('templateBuilder.editors.table.maxLabel', 'Maksimum')}>
                  <TextInput
                    value={column.validation.max}
                    onChange={(max) =>
                      patchColumn(column.id, { validation: { ...column.validation, max } })
                    }
                    testId={`sheet-column-${index}-validation-max`}
                  />
                </Field>
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          data-testid="sheet-add-column"
          onClick={() => onChange({ ...sheet, columns: [...sheet.columns, newSheetColumn()] })}
          className="inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text hover:bg-c-surface-raised"
        >
          <Plus className="h-4 w-4" aria-hidden /> {t('templateBuilder.editors.table.addColumn', 'Add column')}
        </button>
      </div>
    </div>
  );
};
