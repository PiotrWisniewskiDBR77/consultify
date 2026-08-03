import { ChevronRight, ClipboardList, ExternalLink, Plus, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { StatusChip, type StatusTone } from '@/components/ui/primitives';
import { Api } from '@/services/api';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import {
  FilterableTable,
  type TableColumn,
  type TableRow,
} from '../shared/ModuleHub/FilterableTable';
import { type RowAction } from '../shared/RowActionsMenu';
import { type PreviewableItem, TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import TeresaMark from '../shared/TeresaMark';
import { type KpiDrawerSection, type ResultsKPI } from './kpiDomain';
import type { SignalSheetKpiItem, SignalSheetRecord } from './kpiSignalSheetTypes';
interface KpiQueueViewProps {
  kpis: ResultsKPI[];
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  onOpenKpi: (kpiId: string, section?: KpiDrawerSection) => void;
  onOpenSheet: (sheet: SignalSheetRecord) => void;
  createNonce?: number;
  manualSheets?: SignalSheetRecord[];
  onCreateSheet?: (sheet: SignalSheetRecord) => void;
}

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addCadence = (date: Date, frequency?: ResultsKPI['measurementFrequency']) => {
  const next = new Date(date);
  switch (String(frequency || 'MONTHLY').toUpperCase()) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      return next;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      return next;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      return next;
    default:
      next.setMonth(next.getMonth() + 1);
      return next;
  }
};

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

type PreviewSheet = SignalSheetRecord & PreviewableItem;

const statusToneToChip = (tone: SignalSheetRecord['statusTone']): StatusTone => {
  if (tone === 'amber') return 'warning';
  if (tone === 'red') return 'danger';
  if (tone === 'emerald') return 'success';
  if (tone === 'primary') return 'info';
  return 'neutral';
};

const toneClassName = (tone: SignalSheetRecord['statusTone']) => {
  if (tone === 'amber') return 'bg-amber-500/10 text-amber-600 dark:text-amber-300';
  if (tone === 'red') return 'bg-danger-500/10 text-danger-500';
  if (tone === 'emerald') return 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-300';
  if (tone === 'primary') return 'bg-c-info/10 text-c-info';
  return 'bg-slate-500/10 text-slate-500 dark:text-slate-300';
};

export const KpiQueueView: React.FC<KpiQueueViewProps> = ({
  kpis,
  activeFilters,
  onFilterChange,
  onOpenKpi,
  onOpenSheet,
  createNonce,
  manualSheets = [],
  onCreateSheet,
}) => {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [requiredInputsText, setRequiredInputsText] = useState(
    'Actual value\nSource system\nCommentary / evidence'
  );
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>([]);
  const [kpiSearch, setKpiSearch] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  const generatedSheets = useMemo<SignalSheetRecord[]>(() => {
    const today = startOfDay(new Date());
    return [...kpis]
      .map((kpi) => {
        const latestDate = kpi.latestMeasurementDate
          ? startOfDay(new Date(kpi.latestMeasurementDate))
          : null;
        const resolvedDueDate =
          latestDate && !Number.isNaN(latestDate.getTime())
            ? startOfDay(addCadence(latestDate, kpi.measurementFrequency))
            : startOfDay(new Date());
        const ownerLabel =
          String(kpi.ownerName || '').trim() || t('common.unassigned', 'Unassigned');
        const phaseLabel =
          kpi.observationPhase === 'realization'
            ? t('results.phase.realization', 'Realization')
            : kpi.observationPhase === 'both'
              ? t('results.phase.both', 'Both phases')
              : t('results.phase.postImplementation', 'Post-implementation');
        const frequencyLabel =
          String(kpi.measurementFrequency || 'MONTHLY').charAt(0) +
          String(kpi.measurementFrequency || 'MONTHLY')
            .slice(1)
            .toLowerCase();
        const diffDays = Math.round(
          (resolvedDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        const ownerMissing = !String(kpi.ownerName || '').trim();

        const readiness = ownerMissing
          ? {
              label: t('results.kpi.signals.readiness.ownerGap', 'Owner missing'),
              tone: 'slate' as const,
            }
          : kpi.needsEntry || kpi.latestValue == null || diffDays <= 0
            ? {
                label: t('results.kpi.signals.readiness.missingData', 'Missing fresh data'),
                tone: 'amber' as const,
              }
            : kpi.openDeviationCase || kpi.status === 'below'
              ? {
                  label: t(
                    'results.kpi.signals.readiness.review',
                    'Ready for report, needs review'
                  ),
                  tone: 'red' as const,
                }
              : {
                  label: t('results.kpi.signals.readiness.ready', 'Ready for report'),
                  tone: 'emerald' as const,
                };

        const dueLabel =
          diffDays < 0
            ? t('results.kpi.signals.due.overdue', 'Overdue')
            : diffDays === 0
              ? t('results.kpi.signals.due.today', 'Due today')
              : t('results.kpi.signals.due.byDate', 'Due {{date}}', {
                  date: formatDate(resolvedDueDate),
                });

        const item: SignalSheetKpiItem = {
          id: kpi.id,
          name: kpi.name,
          initiativeName: kpi.initiativeName,
          ownerName: kpi.ownerName,
          unit: kpi.unit,
          latestValue: kpi.latestValue,
          targetValue: kpi.targetValue,
          latestMeasurementDate: kpi.latestMeasurementDate,
          measurementFrequency: kpi.measurementFrequency,
          observationPhase: kpi.observationPhase,
          needsEntry: kpi.needsEntry,
        };

        const sheet: SignalSheetRecord = {
          id: `generated-${kpi.id}`,
          title: `${kpi.name} ${t('results.kpi.signals.sheet.titleSuffix', 'entry sheet')}`,
          kind: 'generated',
          ownerLabel,
          dueDate: resolvedDueDate.toISOString().slice(0, 10),
          dueLabel,
          statusLabel: readiness.label,
          statusTone: readiness.tone,
          frequencyLabel,
          phaseLabel,
          summary: t(
            'results.kpi.signals.sheet.summary',
            '{{owner}} should provide data by {{due}} for {{kpi}} so the KPI report can be refreshed on time.',
            { owner: ownerLabel, due: dueLabel, kpi: kpi.name }
          ),
          instructions: t(
            'results.kpi.signals.sheet.instructionsDefault',
            'Collect the actual KPI value for the current cycle, confirm the data source, and add a short explanation if the signal is below target or incomplete.'
          ),
          requiredInputs: [
            t('results.kpi.signals.required.value', 'Actual value'),
            t('results.kpi.signals.required.source', 'Source / system of record'),
            t('results.kpi.signals.required.notes', 'Commentary or evidence'),
          ],
          updatedAt: kpi.latestMeasurementDate || kpi.createdAt,
          items: [item],
        };
        return sheet;
      })
      .sort((a, b) => {
        const order = { slate: 0, amber: 1, red: 2, emerald: 3, primary: 4 } as const;
        const toneDiff = order[a.statusTone] - order[b.statusTone];
        if (toneDiff !== 0) return toneDiff;
        return String(a.dueDate).localeCompare(String(b.dueDate));
      });
  }, [kpis, t]);

  const sheets = useMemo<PreviewSheet[]>(
    () =>
      [...manualSheets, ...generatedSheets].map((sheet) => ({
        ...sheet,
        title: sheet.title,
      })),
    [generatedSheets, manualSheets]
  );

  const selectedSheet = useMemo(
    () => (selectedId ? (sheets.find((sheet) => sheet.id === selectedId) ?? null) : null),
    [selectedId, sheets]
  );

  const filteredKpis = useMemo(() => {
    const q = kpiSearch.trim().toLowerCase();
    if (!q) return kpis;
    return kpis.filter((kpi) => {
      const text = [kpi.name, kpi.initiativeName, kpi.ownerName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    });
  }, [kpiSearch, kpis]);

  useEffect(() => {
    if (!createNonce) return;
    setCreateOpen(true);
  }, [createNonce]);

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('common.type', 'Type'),
        width: '10%',
        render: (row) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              row.kind === 'manual-ai'
                ? 'bg-c-info/10 text-c-info'
                : 'bg-slate-500/10 text-slate-500 dark:text-slate-300'
            }`}
          >
            {row.kind === 'manual-ai'
              ? t('results.kpi.signals.type.ai', 'AI-designed sheet')
              : t('results.kpi.signals.type.runtime', 'Generated sheet')}
          </span>
        ),
      },
      { id: 'name', label: t('results.kpi.signals.sheetName', 'Sheet'), width: '28%' },
      { id: 'scope', label: t('results.kpi.signals.scope', 'KPI package'), width: '18%' },
      { id: 'owner', label: t('common.owner', 'Owner'), width: '14%' },
      { id: 'due', label: t('common.due', 'Due'), width: '12%' },
      {
        id: 'status',
        label: t('common.status', 'Status'),
        width: '18%',
        render: (row) => (
          <StatusChip label={String(row.status || '—')} tone={statusToneToChip(row.statusTone)} />
        ),
      },
    ],
    [t]
  );

  const rows: TableRow[] = useMemo(
    () =>
      sheets.map((sheet) => ({
        id: sheet.id,
        type: sheet.kind,
        kind: sheet.kind,
        name: sheet.title,
        scope:
          sheet.items.length === 1
            ? sheet.items[0]?.name || '—'
            : t('results.kpi.signals.scopeMulti', '{{count}} KPI in sheet', {
                count: sheet.items.length,
              }),
        owner: sheet.ownerLabel,
        due: sheet.dueLabel,
        status: sheet.statusLabel,
        statusTone: sheet.statusTone,
      })),
    [sheets, t]
  );

  const getRowActions = useCallback(
    (row: TableRow): RowAction[] => {
      const sheet = sheets.find((item) => item.id === row.id);
      if (!sheet) return [];
      return [
        {
          id: 'preview',
          label: t('common.preview', 'Open preview'),
          icon: ChevronRight,
          onClick: () => setSelectedId(sheet.id),
        },
        {
          id: 'open-sheet',
          label: t('results.kpi.signals.openSheet', 'Open sheet'),
          icon: ExternalLink,
          onClick: () => onOpenSheet(sheet),
        },
        {
          id: 'record',
          label: t('results.kpi.signals.record', 'Record data'),
          onClick: () => {
            const firstItem = sheet.items[0];
            if (firstItem) onOpenKpi(firstItem.id, 'record');
          },
        },
      ];
    },
    [onOpenKpi, onOpenSheet, sheets, t]
  );

  const handleGenerateAi = useCallback(async () => {
    const selectedItems = kpis.filter((kpi) => selectedKpiIds.includes(kpi.id));
    if (selectedItems.length === 0) return;

    setGeneratingAi(true);
    try {
      const contextText = selectedItems
        .map(
          (item) =>
            `KPI: ${item.name}; Initiative: ${item.initiativeName || 'n/a'}; Owner: ${item.ownerName || 'unassigned'}; Frequency: ${item.measurementFrequency || 'MONTHLY'}; Target: ${item.targetValue ?? 'n/a'}`
        )
        .join('\n');
      const systemInstruction = [
        'You are preparing a concise data-entry sheet configuration for KPI collection.',
        'Return ONLY valid JSON.',
        'Schema: {"title": string, "instructions": string, "requiredInputs": string[]}',
      ].join('\n');
      const aiRes: any = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'KPI data entry sheet',
        language: 'en',
      });
      const raw = String(aiRes?.text || '').trim();
      const parsed = JSON.parse(raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] || raw);
      if (parsed?.title) setTitle(String(parsed.title));
      if (parsed?.instructions) setInstructions(String(parsed.instructions));
      if (Array.isArray(parsed?.requiredInputs)) {
        setRequiredInputsText(parsed.requiredInputs.map((item: any) => String(item)).join('\n'));
      }
    } catch {
      toast.error(t('results.kpi.signals.aiFailed', 'Failed to generate AI sheet draft'));
    } finally {
      setGeneratingAi(false);
    }
  }, [kpis, selectedKpiIds, t]);

  const handleCreateSheet = useCallback(() => {
    const selectedItems = kpis.filter((kpi) => selectedKpiIds.includes(kpi.id));
    if (!onCreateSheet || selectedItems.length === 0) return;

    const ownerSet = Array.from(
      new Set(selectedItems.map((item) => String(item.ownerName || '').trim()).filter(Boolean))
    );
    const frequencySet = Array.from(
      new Set(selectedItems.map((item) => String(item.measurementFrequency || 'MONTHLY')))
    );
    const phaseSet = Array.from(
      new Set(selectedItems.map((item) => String(item.observationPhase || 'post-implementation')))
    );

    const sheet: SignalSheetRecord = {
      id: `signal-sheet-${Date.now()}`,
      title: title.trim() || t('results.kpi.signals.defaultSheetTitle', 'AI data-entry sheet'),
      kind: 'manual-ai',
      ownerLabel:
        ownerSet.length === 0
          ? t('common.unassigned', 'Unassigned')
          : ownerSet.length === 1
            ? ownerSet[0]
            : t('results.kpi.signals.multiOwner', 'Multiple owners'),
      dueDate: dueDate || new Date().toISOString().slice(0, 10),
      dueLabel: dueDate
        ? t('results.kpi.signals.due.byDate', 'Due {{date}}', {
            date: formatDate(new Date(`${dueDate}T00:00:00`)),
          })
        : t('common.due', 'Due'),
      statusLabel: t('results.kpi.signals.type.ai', 'AI-designed sheet'),
      statusTone: 'primary',
      frequencyLabel:
        frequencySet.length === 1
          ? frequencySet[0].charAt(0) + frequencySet[0].slice(1).toLowerCase()
          : t('results.kpi.signals.mixed', 'Mixed cadence'),
      phaseLabel:
        phaseSet.length === 1
          ? phaseSet[0] === 'realization'
            ? t('results.phase.realization', 'Realization')
            : phaseSet[0] === 'both'
              ? t('results.phase.both', 'Both phases')
              : t('results.phase.postImplementation', 'Post-implementation')
          : t('results.kpi.signals.mixedPhase', 'Mixed phases'),
      summary: t(
        'results.kpi.signals.aiSummary',
        'AI-supported custom sheet prepared for {{count}} KPI.',
        {
          count: selectedItems.length,
        }
      ),
      instructions:
        instructions.trim() ||
        t(
          'results.kpi.signals.instructionsFallback',
          'Collect the requested KPI values, validate the source, and add short commentary for anomalies before publishing the report.'
        ),
      requiredInputs: requiredInputsText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      updatedAt: new Date().toISOString(),
      items: selectedItems.map((item) => ({
        id: item.id,
        name: item.name,
        initiativeName: item.initiativeName,
        ownerName: item.ownerName,
        unit: item.unit,
        latestValue: item.latestValue,
        targetValue: item.targetValue,
        latestMeasurementDate: item.latestMeasurementDate,
        measurementFrequency: item.measurementFrequency,
        observationPhase: item.observationPhase,
        needsEntry: item.needsEntry,
      })),
    };

    onCreateSheet(sheet);
    setCreateOpen(false);
    setTitle('');
    setInstructions('');
    setRequiredInputsText('Actual value\nSource system\nCommentary / evidence');
    setSelectedKpiIds([]);
    setKpiSearch('');
    onOpenSheet(sheet);
  }, [
    dueDate,
    instructions,
    kpis,
    onCreateSheet,
    onOpenSheet,
    requiredInputsText,
    selectedKpiIds,
    t,
    title,
  ]);

  return (
    <>
      <div className="p-4">
        <TableWithPreviewLayout<PreviewSheet>
          selectedId={selectedId}
          selectedItem={selectedSheet}
          onSelect={setSelectedId}
          onOpenFull={(id) => {
            const sheet = sheets.find((item) => item.id === id);
            if (sheet) onOpenSheet(sheet);
          }}
          itemIds={sheets.map((sheet) => sheet.id)}
          getItemById={(id) => sheets.find((sheet) => sheet.id === id) ?? null}
          renderPreview={(item) => {
            const metaPills: MetaPill[] = [
              {
                label:
                  item.kind === 'manual-ai'
                    ? t('results.kpi.signals.type.ai', 'AI-designed sheet')
                    : t('results.kpi.signals.type.runtime', 'Generated sheet'),
                className:
                  item.kind === 'manual-ai'
                    ? 'bg-c-info/10 text-c-info'
                    : 'bg-slate-500/10 text-slate-500 dark:text-slate-300',
              },
              {
                label: item.statusLabel,
                className: toneClassName(item.statusTone),
              },
              {
                label: t('results.kpi.signals.scopeMulti', '{{count}} KPI in sheet', {
                  count: item.items.length,
                }),
                className: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-300',
              },
            ];
            const relationItems: RelationItem[] = item.items.map((sheetItem) => ({
              label: `${sheetItem.name}${sheetItem.initiativeName ? ` (${sheetItem.initiativeName})` : ''}`,
              type: 'kpi',
            }));

            return (
              <div className="space-y-4">
                <PreviewMetaCard pills={metaPills}>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {t('common.owner', 'Owner')}
                      </div>
                      <div className="text-slate-900 dark:text-white">{item.ownerLabel}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-500 dark:text-slate-400">
                        {t('common.due', 'Due')}
                      </div>
                      <div className="text-slate-900 dark:text-white">{item.dueLabel}</div>
                    </div>
                  </div>
                </PreviewMetaCard>
                <PreviewDetailsSection
                  label={t('common.summary', 'Summary')}
                  text={item.summary}
                  compact
                />
                <PreviewDetailsSection
                  label={t('results.kpi.signals.sheet.instructions', 'Collection guidance')}
                  text={item.instructions}
                  compact
                />
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('common.relations', 'Relations')}
                  </div>
                  <PreviewRelations
                    items={relationItems}
                    emptyLabel={t('results.kpi.signals.noKpis', 'No KPI linked to this sheet')}
                  />
                </div>
              </div>
            );
          }}
          renderPreviewFooter={(item) => {
            const rows: ActionRow[] = [
              {
                columns: 2,
                buttons: [
                  {
                    label: t('results.kpi.signals.openSheet', 'Open sheet'),
                    icon: ClipboardList,
                    colorScheme: 'primary',
                    onClick: () => onOpenSheet(item),
                  },
                  {
                    label: t('results.kpi.signals.record', 'Record data'),
                    icon: ExternalLink,
                    colorScheme: 'neutral',
                    onClick: () => {
                      const firstItem = item.items[0];
                      if (firstItem) onOpenKpi(firstItem.id, 'record');
                    },
                  },
                ],
              },
            ];
            return <PreviewActionBar rows={rows} />;
          }}
        >
          <FilterableTable
            columns={columns}
            data={rows}
            selectedRowId={selectedId}
            activeFilters={activeFilters}
            onFilterChange={onFilterChange}
            density="compact"
            canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
            getRowActions={getRowActions}
            onRowClick={(row) => setSelectedId(String(row.id))}
            onRowDoubleClick={(row) => {
              const sheet = sheets.find((item) => item.id === row.id);
              if (sheet) onOpenSheet(sheet);
            }}
            emptyMessage={t(
              'results.kpi.signals.emptyTable',
              'No data-entry sheets available yet.'
            )}
          />
        </TableWithPreviewLayout>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => setCreateOpen(false)}
          />
          <div className="relative mx-4 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-700 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary-500/10 p-2">
                  <TeresaMark size={16} className="text-primary-400" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {t('results.kpi.signals.createTitle', 'Create data-entry sheet')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t('common.name', 'Name')}
                  </label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 text-sm text-slate-900 dark:text-white"
                    placeholder={t(
                      'results.kpi.signals.titlePlaceholder',
                      'e.g. Weekly production data sheet'
                    )}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t('common.due', 'Due')}
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t('results.kpi.signals.create.kpis', 'KPI package')}
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleGenerateAi()}
                    disabled={generatingAi || selectedKpiIds.length === 0}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    <Sparkles size={12} />
                    {generatingAi
                      ? t('common.loading', 'Loading...')
                      : t('results.kpi.signals.aiDraft', 'Generate with AI')}
                  </button>
                </div>
                <input
                  value={kpiSearch}
                  onChange={(event) => setKpiSearch(event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 text-sm text-slate-900 dark:text-white"
                  placeholder={t('common.search', 'Search')}
                />
                <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50/40 dark:bg-navy-800/40">
                  {filteredKpis.map((kpi) => {
                    const checked = selectedKpiIds.includes(kpi.id);
                    return (
                      <label
                        key={kpi.id}
                        className="flex cursor-pointer items-start gap-2 border-b border-slate-200 dark:border-navy-700 p-3 last:border-b-0 hover:bg-white/60 dark:hover:bg-navy-800/70"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setSelectedKpiIds((prev) =>
                              event.target.checked
                                ? Array.from(new Set([...prev, kpi.id]))
                                : prev.filter((id) => id !== kpi.id)
                            )
                          }
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                            {kpi.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {[kpi.initiativeName, kpi.ownerName, kpi.measurementFrequency]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('results.kpi.signals.sheet.instructions', 'Collection guidance')}
                </label>
                <textarea
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  className="min-h-[96px] w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  placeholder={t(
                    'results.kpi.signals.instructionsPlaceholder',
                    'Explain what should be collected, how it should be validated, and what to do with anomalies.'
                  )}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('results.kpi.signals.sheet.requiredInputs', 'Data to provide')}
                </label>
                <textarea
                  value={requiredInputsText}
                  onChange={(event) => setRequiredInputsText(event.target.value)}
                  className="min-h-[88px] w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="button"
                disabled={selectedKpiIds.length === 0}
                onClick={handleCreateSheet}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-navy-900 dark:bg-[#F4F7FB] px-4 text-sm font-medium text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <Plus size={14} />
                {t('results.kpi.signals.createAction', 'Create sheet')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KpiQueueView;
