import {
  AlertTriangle,
  Calendar,
  Clock3,
  GitBranch,
  Link2,
  MessageCircle,
  Pencil,
  ShieldAlert,
  Sigma,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import { useOrganizationContext } from '@/hooks/discovery/useOrganizationContext';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyResults,
  V8ResultsApi,
  type V8ResultsRcaAction,
  type V8ResultsRcaHypothesis,
  type V8ResultsUpdateKpiPayload,
} from '@/services/api/v8/results';
import { InitiativeKPI, KPIMeasurement } from '@/types/core';

import { type KpiDrawerSection } from './kpiDomain';
import { RecoveryCardPanel } from './RecoveryCardPanel';
import { isResultsFlagEnabled } from './resultsFeatureFlags';
import { buildLinkedInitiatives, dedupeInitiativeOptions } from './resultsLineage';

interface KpiReconciledReading {
  value: number | null;
  measuredAt: string | null;
  /** True when the catalog's cached latestValue/latestMeasurementDate
   * disagrees with the freshly-fetched measurement history's actual latest
   * entry — a real staleness signal to surface, not a decoration. */
  mismatchWithCatalog: boolean;
}

/**
 * CB-04/RB-013 — ONE reconciled "current reading" for a KPI. Before this,
 * this drawer read `kpi.latestValue` (the catalog's cached aggregate field,
 * computed by a separate list-view fetch) for the header quick-stat, while
 * independently deriving its own "latest" from the drawer's own
 * freshly-fetched `measurements` array for the sparkline — two unreconciled
 * read models for what a user experiences as a single fact ("what is this
 * KPI's current value"). The measurement HISTORY is the unambiguous source
 * (it is the actual row set, not a cached portfolio-list optimization) —
 * this always renders from it, and flags (rather than silently swallows)
 * any disagreement with the catalog cache so a real staleness bug surfaces
 * instead of just picking whichever value happened to render first.
 *
 * Kept local to this drawer (rather than in kpiDomain.ts) so it has no
 * dependency outside this file's recovery scope.
 */
function reconcileKpiLatestReading(
  catalog: Pick<InitiativeKPI, 'latestValue' | 'latestMeasurementDate'>,
  measurements: Array<{ value: number; measuredAt: string | null | undefined }>
): KpiReconciledReading {
  const sorted = [...measurements]
    .filter((m) => m.measuredAt)
    .sort(
      (a, b) =>
        new Date(b.measuredAt as string).getTime() - new Date(a.measuredAt as string).getTime()
    );
  const latestFromHistory = sorted[0] ?? null;

  if (!latestFromHistory) {
    return {
      value: catalog.latestValue ?? null,
      measuredAt: catalog.latestMeasurementDate ?? null,
      mismatchWithCatalog: false,
    };
  }

  const catalogValue = catalog.latestValue;
  const catalogDate = catalog.latestMeasurementDate;
  const mismatchWithCatalog =
    catalogValue != null &&
    catalogDate != null &&
    (Number(catalogValue) !== Number(latestFromHistory.value) ||
      new Date(catalogDate).getTime() !==
        new Date(latestFromHistory.measuredAt as string).getTime());

  return {
    value: latestFromHistory.value,
    measuredAt: latestFromHistory.measuredAt ?? null,
    mismatchWithCatalog,
  };
}

interface KPITimeSeriesDrawerProps {
  kpiId: string;
  onClose: () => void;
  onValueRecorded?: () => void;
  initialSection?: KpiDrawerSection;
}

type QuickStat = { label: string; value: string; color?: string };
type MetricStat = {
  label: string;
  value: string;
  hint: string;
  color?: string;
  icon: React.ReactNode;
};
type TimelineItem = { label: string; value: string; hint: string };

type DeviationAction = {
  id: string;
  title: string;
  ownerUserId?: string | null;
  dueDate?: string | null;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
};

type DeviationCase = {
  id: string;
  kpiId: string;
  severity: 'AMBER' | 'RED';
  status: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  deviationSummary?: string | null;
  rcaText?: string | null;
  evidenceText?: string | null;
  evidenceRef?: string | null;
  resolutionNotes?: string | null;
  actions?: DeviationAction[];
};

type InitiativeOption = { id: string; name: string };

type KpiMappingRow = {
  id: string;
  initiative_id: string;
  initiative_name?: string | null;
  kpi_id: string;
  kpi_name?: string | null;
  impact_direction?: string | null;
};

type KpiConnectorRow = {
  id: string;
  connectorName: string;
  connectorType?: string | null;
  targetKpiIds?: string[];
  scheduleCron?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  isActive?: boolean;
  config?: Record<string, unknown>;
};

const normalizeDrawerSection = (section?: KpiDrawerSection): KpiDrawerSection => {
  if (section === 'settings') return 'definition';
  if (section === 'links') return 'lineage';
  return section || 'summary';
};

const measurementDate = (measurement: KPIMeasurement): string =>
  String(measurement.periodStart || measurement.measuredAt || '');

const measurementLabel = (measurement: KPIMeasurement): string =>
  measurement.periodKey || measurementDate(measurement);

const formatMetricValue = (value: number | null | undefined, unit?: string | null): string => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toLocaleString()}${unit ? ` ${unit}` : ''}`;
};

const frequencyWindowDays = (
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | string | null
): number => {
  const normalized = String(frequency || 'MONTHLY').toUpperCase();
  if (normalized === 'DAILY') return 1;
  if (normalized === 'WEEKLY') return 7;
  if (normalized === 'QUARTERLY') return 90;
  return 30;
};

export const KPITimeSeriesDrawer: React.FC<KPITimeSeriesDrawerProps> = ({
  kpiId,
  onClose,
  onValueRecorded,
  initialSection,
}) => {
  const { t } = useTranslation();
  const openChatWithContext = useOpenChatWithContext();
  const { formatForPrompt: formatOrgContext } = useOrganizationContext();
  const drawerContainerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open: true, onClose, containerRef: drawerContainerRef });
  const [kpi, setKpi] = useState<InitiativeKPI | null>(null);
  const [measurements, setMeasurements] = useState<KPIMeasurement[]>([]);
  const [auditLog, setAuditLog] = useState<
    Array<{
      id: string;
      section: string;
      eventType: string;
      source: string;
      actorUserId?: string | null;
      summary?: string | null;
      before: Record<string, unknown>;
      after: Record<string, unknown>;
      createdAt: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  const [openCase, setOpenCase] = useState<DeviationCase | null>(null);
  const [rcaDraft, setRcaDraft] = useState('');
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionDue, setNewActionDue] = useState('');
  const [caseBusy, setCaseBusy] = useState(false);
  // Only writers with proven canonical successors are retired. Resolve remains
  // live on the historical case because RESULTS-W23 has no mapped successor.
  const retiredDeviationMutation = true;
  const [rcaSuggestBusy, setRcaSuggestBusy] = useState(false);
  const [rcaHypotheses, setRcaHypotheses] = useState<V8ResultsRcaHypothesis[] | null>(null);
  const [rcaActions, setRcaActions] = useState<V8ResultsRcaAction[] | null>(null);
  const [closeEvidenceText, setCloseEvidenceText] = useState('');
  const [closeEvidenceRef, setCloseEvidenceRef] = useState('');
  const [closeResolutionNotes, setCloseResolutionNotes] = useState('');

  const [newValue, setNewValue] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newNotes, setNewNotes] = useState('');
  // CB-04/RB-014: was silently folded into `newNotes` ("Notes, source, or
  // audit comment") — a single ambiguous freeform field. `source` is an
  // EXISTING payload field (V8ResultsCreateKpiTimeSeriesPayload.source) the
  // form never populated; splitting it out actually uses that contract
  // instead of inventing a new one.
  const [newSource, setNewSource] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [settingsName, setSettingsName] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsUnit, setSettingsUnit] = useState('');
  const [settingsBaseline, setSettingsBaseline] = useState('');
  const [settingsTarget, setSettingsTarget] = useState('');
  const [settingsFrequency, setSettingsFrequency] = useState<
    'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
  >('MONTHLY');
  const [settingsDirection, setSettingsDirection] = useState<'increase' | 'decrease'>('increase');
  const [settingsThresholdMode, setSettingsThresholdMode] = useState<
    'ABSOLUTE' | 'PERCENT_FROM_TARGET'
  >('PERCENT_FROM_TARGET');
  const [settingsAmberThreshold, setSettingsAmberThreshold] = useState('');
  const [settingsRedThreshold, setSettingsRedThreshold] = useState('');
  // RES-11: who may see this KPI.
  const [settingsVisibility, setSettingsVisibility] = useState<
    'org_visible' | 'initiative_restricted' | 'private_to_owner'
  >('org_visible');

  const [initiatives, setInitiatives] = useState<InitiativeOption[]>([]);
  const [mappings, setMappings] = useState<KpiMappingRow[]>([]);
  const [connectors, setConnectors] = useState<KpiConnectorRow[]>([]);
  const [mappingBusy, setMappingBusy] = useState(false);
  const [activeSection, setActiveSection] = useState<KpiDrawerSection>(
    normalizeDrawerSection(initialSection)
  );

  useEffect(() => {
    setActiveSection(normalizeDrawerSection(initialSection));
  }, [initialSection, kpiId]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await Api.get('/initiatives');
        const data = (res?.data ?? res) as any;
        // Dedup by id — the same initiative can appear more than once when the
        // source list is composed from joined rows (H2.8 lineage duplicates).
        setInitiatives(dedupeInitiativeOptions((data || []) as any[]));
      } catch {
        // silent
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await Api.get('/results-v4/kpi-connectors');
        const payload = (res?.connectors ?? res?.data?.connectors ?? res?.data ?? res) as any[];
        setConnectors(Array.isArray(payload) ? payload : []);
      } catch {
        setConnectors([]);
      }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogRes, drawerRes] = await Promise.allSettled([
        V8ResultsApi.getKpiCatalog({ kpiId }),
        V8ResultsApi.getKpiDrawerDetail(kpiId),
      ]);

      let catalogKpis: any[] = [];
      let catalogMappings: any[] = [];
      let drawerMeasurements: any[] = [];
      let drawerOpenCase: any = null;
      let drawerAuditLog: any[] = [];
      if (catalogRes.status === 'fulfilled') {
        catalogKpis = Array.isArray(catalogRes.value?.kpis) ? catalogRes.value.kpis : [];
        catalogMappings = Array.isArray(catalogRes.value?.mappings)
          ? catalogRes.value.mappings
          : [];
      } else if (!shouldFallbackToLegacyResults(catalogRes.reason)) {
        throw catalogRes.reason;
      }

      if (drawerRes.status === 'fulfilled') {
        drawerMeasurements = Array.isArray(drawerRes.value?.measurements)
          ? drawerRes.value.measurements
          : [];
        drawerOpenCase = drawerRes.value?.openCase ?? null;
        drawerAuditLog = Array.isArray(drawerRes.value?.auditLog) ? drawerRes.value.auditLog : [];
      } else if (!shouldFallbackToLegacyResults(drawerRes.reason)) {
        throw drawerRes.reason;
      }

      if (
        (catalogRes.status !== 'fulfilled' && shouldFallbackToLegacyResults(catalogRes.reason)) ||
        (drawerRes.status !== 'fulfilled' && shouldFallbackToLegacyResults(drawerRes.reason))
      ) {
        const [kpisRes, mappingsRes, tsRes, casesRes] = await Promise.allSettled([
          Api.get('/benefits/kpis'),
          Api.get(`/benefits/kpi-mappings?kpiId=${encodeURIComponent(kpiId)}`),
          Api.get(`/benefits/kpis/${kpiId}/time-series`),
          Api.get(`/benefits/kpis/${kpiId}/deviation-cases?openOnly=1`),
        ]);
        if (catalogRes.status !== 'fulfilled' && kpisRes.status === 'fulfilled') {
          const payload: any = kpisRes.value as any;
          catalogKpis = payload?.data ?? payload ?? [];
        }
        if (catalogRes.status !== 'fulfilled' && mappingsRes.status === 'fulfilled') {
          const payload: any = mappingsRes.value as any;
          catalogMappings = payload?.data ?? payload ?? [];
        }
        if (drawerRes.status !== 'fulfilled' && tsRes.status === 'fulfilled') {
          const payload: any = tsRes.value as any;
          drawerMeasurements = payload?.data ?? payload ?? [];
        }
        if (drawerRes.status !== 'fulfilled' && casesRes.status === 'fulfilled') {
          const payload: any = casesRes.value as any;
          const list = payload?.data ?? payload ?? [];
          drawerOpenCase = Array.isArray(list) && list.length > 0 ? list[0] : null;
        }
      }

      const found = (catalogKpis || []).find((k: any) => String(k?.id) === String(kpiId));
      if (found) setKpi(found);
      else setKpi(null);

      setMeasurements(
        (drawerMeasurements || []).sort(
          (a: KPIMeasurement, b: KPIMeasurement) =>
            new Date(measurementDate(b)).getTime() - new Date(measurementDate(a)).getTime()
        )
      );
      setAuditLog(
        (drawerAuditLog || []).sort(
          (a: any, b: any) =>
            new Date(String(b?.createdAt || 0)).getTime() -
            new Date(String(a?.createdAt || 0)).getTime()
        )
      );

      if (drawerOpenCase) {
        const first = drawerOpenCase as DeviationCase;
        setOpenCase(first);
        setRcaDraft(first?.rcaText || '');
        setCloseEvidenceText(first?.evidenceText || '');
        setCloseEvidenceRef(first?.evidenceRef || '');
        setCloseResolutionNotes(first?.resolutionNotes || '');
      } else {
        setOpenCase(null);
        setRcaDraft('');
        setCloseEvidenceText('');
        setCloseEvidenceRef('');
        setCloseResolutionNotes('');
      }

      setMappings((catalogMappings || []) as KpiMappingRow[]);
    } catch {
      // silent
      setAuditLog([]);
    } finally {
      setLoading(false);
    }
  }, [kpiId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!kpi) return;
    if (editMode) return;
    setSettingsName(String((kpi as any)?.name || ''));
    setSettingsDescription(String((kpi as any)?.description || ''));
    setSettingsUnit(String((kpi as any)?.unit || ''));
    setSettingsBaseline(
      (kpi as any)?.baselineValue != null && (kpi as any)?.baselineValue !== ''
        ? String((kpi as any).baselineValue)
        : ''
    );
    setSettingsTarget(
      (kpi as any)?.targetValue != null && (kpi as any)?.targetValue !== ''
        ? String((kpi as any).targetValue)
        : ''
    );
    setSettingsFrequency(((kpi as any)?.measurementFrequency || 'MONTHLY') as any);
    setSettingsDirection((kpi as any)?.direction === 'LOWER_IS_BETTER' ? 'decrease' : 'increase');
    setSettingsThresholdMode(((kpi as any)?.thresholdMode || 'PERCENT_FROM_TARGET') as any);
    setSettingsVisibility(((kpi as any)?.visibility || 'org_visible') as any);
    setSettingsAmberThreshold(
      (kpi as any)?.thresholdMode === 'ABSOLUTE'
        ? (kpi as any)?.amberThresholdAbs != null
          ? String((kpi as any).amberThresholdAbs)
          : ''
        : (kpi as any)?.amberThresholdPct != null
          ? String((kpi as any).amberThresholdPct)
          : ''
    );
    setSettingsRedThreshold(
      (kpi as any)?.thresholdMode === 'ABSOLUTE'
        ? (kpi as any)?.redThresholdAbs != null
          ? String((kpi as any).redThresholdAbs)
          : ''
        : (kpi as any)?.redThresholdPct != null
          ? String((kpi as any).redThresholdPct)
          : ''
    );
  }, [kpi, editMode]);

  const openCanonicalKpiRegistry = useCallback(() => {
    // This drawer reads a legacy archive identity. Never infer that it is a
    // canonical KPI UUID; the registry is the truthful selection boundary.
    window.location.assign('/results/kpi');
  }, []);

  const openKpiAiChat = useCallback(
    async (prompt: string) => {
      if (!kpi) return;
      try {
        await openChatWithContext({
          entityType: 'kpi',
          entityId: kpiId,
          entityName: kpi.name,
          contextData: {
            ...(kpi as unknown as Record<string, unknown>),
            organizationContext: formatOrgContext(),
          },
          pmoContext: { kpiId },
        });
        toast.success(t('common.chatOpened', 'Chat opened'), { duration: 1500 });
      } catch {
        toast.error(t('common.chatOpenError', 'Failed to open chat'));
      }
    },
    [kpi, kpiId, openChatWithContext, formatOrgContext, t]
  );

  const openDeviationAiChat = useCallback(
    async (deviationCase: DeviationCase) => {
      try {
        await openChatWithContext({
          entityType: 'kpi',
          entityId: kpiId,
          entityName: `${kpi?.name || 'KPI'} — Deviation ${deviationCase.severity}`,
          contextData: {
            kpi: kpi as unknown as Record<string, unknown>,
            deviation: deviationCase as unknown as Record<string, unknown>,
            organizationContext: formatOrgContext(),
          },
          pmoContext: { kpiId },
        });
        toast.success(t('common.chatOpened', 'Chat opened'), { duration: 1500 });
      } catch {
        toast.error(t('common.chatOpenError', 'Failed to open chat'));
      }
    },
    [kpi, kpiId, openChatWithContext, formatOrgContext, t]
  );


  const handleUnlinkMapping = useCallback(
    async (mappingId: string) => {
      if (!mappingId) return;
      setMappingBusy(true);
      try {
        try {
          await V8ResultsApi.deleteKpiMapping(mappingId);
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) {
            throw error;
          }
          await Api.delete(`/benefits/kpi-mappings/${mappingId}`);
        }
        fetchData();
        onValueRecorded?.();
      } catch {
        // silent
      } finally {
        setMappingBusy(false);
      }
    },
    [fetchData, onValueRecorded]
  );

  // CB-04/RB-013: ONE reconciled current reading — see kpiDomain.ts's
  // reconcileKpiLatestReading() doc comment. The measurement history (this
  // drawer's own fresh fetch) is the source of truth; the catalog's cached
  // `latestValue` is compared against it only to detect staleness, never to
  // override it.
  const reconciledReading = useMemo(() => {
    if (!kpi) return null;
    return reconcileKpiLatestReading(
      { latestValue: kpi.latestValue, latestMeasurementDate: kpi.latestMeasurementDate },
      measurements.map((m) => ({ value: m.value, measuredAt: m.measuredAt }))
    );
  }, [kpi, measurements]);

  const quickStats: QuickStat[] = useMemo(() => {
    if (!kpi) return [];
    const currentValue = reconciledReading?.value ?? kpi.latestValue ?? null;
    const gap =
      kpi.targetValue != null && currentValue != null ? kpi.targetValue - currentValue : null;
    return [
      {
        label: t('results.drawer.baseline', 'Baseline'),
        value:
          (kpi as any).baselineValue != null
            ? `${(kpi as any).baselineValue}${kpi.unit ? ' ' + kpi.unit : ''}`
            : '—',
      },
      {
        label: t('results.columns.target', 'Target'),
        value:
          kpi.targetValue != null ? `${kpi.targetValue}${kpi.unit ? ' ' + kpi.unit : ''}` : '—',
      },
      {
        label: t('results.columns.current', 'Current'),
        value: currentValue != null ? `${currentValue}${kpi.unit ? ' ' + kpi.unit : ''}` : '—',
        color: kpi.isOnTarget ? 'text-emerald-400' : 'text-danger-400',
      },
      {
        label: t('results.drawer.gap', 'Gap'),
        value: gap != null ? `${gap > 0 ? '+' : ''}${gap}${kpi.unit ? ' ' + kpi.unit : ''}` : '—',
        color: gap != null ? (gap <= 0 ? 'text-emerald-400' : 'text-danger-400') : undefined,
      },
    ];
  }, [kpi, t, reconciledReading]);

  const expectationStats: QuickStat[] = useMemo(() => {
    if (!kpi) return [];
    const latestDate = (kpi.latestMeasurementDate || '').slice(0, 10);
    const staleDays = latestDate
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(`${latestDate}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24)
          )
        )
      : null;
    return [
      {
        label: t('results.columns.phase', 'Phase'),
        value:
          kpi.observationPhase === 'realization'
            ? t('results.phase.realization', 'Realization')
            : kpi.observationPhase === 'both'
              ? t('results.phase.both', 'Both phases')
              : t('results.phase.postImplementation', 'Post-implementation'),
      },
      {
        label: t('results.kpi.realizationTarget', 'Realization target'),
        value:
          kpi.realizationExpectation?.targetValue != null
            ? `${kpi.realizationExpectation.targetValue}${kpi.unit ? ` ${kpi.unit}` : ''}`
            : '—',
      },
      {
        label: t('results.kpi.postImplementationTarget', 'Post-implementation target'),
        value:
          kpi.postImplementationExpectation?.targetValue != null
            ? `${kpi.postImplementationExpectation.targetValue}${kpi.unit ? ` ${kpi.unit}` : ''}`
            : '—',
      },
      {
        label: t('results.kpi.freshness', 'Freshness'),
        value:
          staleDays == null
            ? t('results.status.noData', 'No data')
            : staleDays === 0
              ? t('results.kpi.freshnessToday', 'Updated today')
              : `${staleDays}d`,
        color: kpi.needsEntry ? 'text-amber-400' : 'text-slate-900 dark:text-white',
      },
    ];
  }, [kpi, t]);

  const normalizedSection = useMemo(() => normalizeDrawerSection(activeSection), [activeSection]);

  const connectedConnectors = useMemo(
    () =>
      (connectors || []).filter((connector) =>
        Array.isArray(connector.targetKpiIds)
          ? connector.targetKpiIds.some((id) => String(id) === String(kpiId))
          : false
      ),
    [connectors, kpiId]
  );

  /**
   * Deduplicated linked initiatives for the lineage panel (H2.8). Mapping rows
   * can repeat the same initiative, and `initiative_name` is sometimes null
   * (deleted / cross-org join). Dedup by initiative_id and resolve the label from
   * the initiatives list before falling back to "Unknown".
   */
  const linkedInitiatives = useMemo(
    () => buildLinkedInitiatives(mappings, initiatives, t('common.unknown', 'Unknown')),
    [mappings, initiatives, t]
  );

  const definitionStats: QuickStat[] = useMemo(() => {
    if (!kpi) return [];
    return [
      {
        label: t('results.drawer.definitionSource', 'Definition source'),
        value:
          kpi.definitionSource === 'library'
            ? t('results.kpi.source.library', 'Library')
            : t('results.kpi.source.custom', 'Initiative custom'),
      },
      {
        label: t('results.columns.owner', 'Owner'),
        value: (kpi as any).ownerName || kpi.ownerUserId || '—',
      },
      {
        label: t('results.drawer.directionTitle', 'Direction'),
        value:
          (kpi as any).direction === 'LOWER_IS_BETTER'
            ? t('results.direction.decrease', 'Decrease')
            : t('results.direction.increase', 'Increase'),
      },
      {
        label: t('results.createModal.frequency', 'Frequency'),
        value: String(kpi.measurementFrequency || 'MONTHLY'),
      },
    ];
  }, [kpi, t]);

  const targetStats: QuickStat[] = useMemo(() => {
    if (!kpi) return [];
    return [
      {
        label: t('results.drawer.baseline', 'Baseline'),
        value: formatMetricValue((kpi as any).baselineValue, kpi.unit),
      },
      {
        label: t('results.columns.target', 'Target'),
        value: formatMetricValue(kpi.targetValue, kpi.unit),
      },
      {
        label: t('results.drawer.amberThreshold', 'Amber threshold'),
        value:
          settingsThresholdMode === 'ABSOLUTE'
            ? settingsAmberThreshold || '—'
            : settingsAmberThreshold
              ? `${settingsAmberThreshold}%`
              : '—',
      },
      {
        label: t('results.drawer.redThreshold', 'Red threshold'),
        value:
          settingsThresholdMode === 'ABSOLUTE'
            ? settingsRedThreshold || '—'
            : settingsRedThreshold
              ? `${settingsRedThreshold}%`
              : '—',
      },
    ];
  }, [kpi, settingsAmberThreshold, settingsRedThreshold, settingsThresholdMode, t]);

  const definitionAudit = useMemo(
    () => auditLog.filter((entry) => entry.section === 'definition').slice(0, 5),
    [auditLog]
  );

  const targetAudit = useMemo(
    () => auditLog.filter((entry) => entry.section === 'targets').slice(0, 5),
    [auditLog]
  );

  const historyAudit = useMemo(
    () => auditLog.filter((entry) => entry.section === 'history').slice(0, 8),
    [auditLog]
  );

  const maxVal = useMemo(() => {
    if (measurements.length === 0) return 100;
    return Math.max(...measurements.map((m) => m.value), kpi?.targetValue || 0) * 1.2 || 100;
  }, [measurements, kpi]);

  const chartBars = useMemo(() => {
    return [...measurements].reverse().slice(-12);
  }, [measurements]);

  const chartSemantics = useMemo(() => {
    if (!kpi) return [];
    const ordered = [...measurements].reverse();
    const latest = ordered.at(-1) || null;
    const previous = ordered.length > 1 ? ordered.at(-2) || null : null;
    const delta =
      latest &&
      previous &&
      Number.isFinite(Number(latest.value)) &&
      Number.isFinite(Number(previous.value))
        ? Number(latest.value) - Number(previous.value)
        : null;
    const latestValue = latest ? Number(latest.value) : null;
    const achievement =
      latestValue != null &&
      kpi.targetValue != null &&
      Number.isFinite(Number(kpi.targetValue)) &&
      Number(kpi.targetValue) !== 0
        ? (latestValue / Number(kpi.targetValue)) * 100
        : null;
    const projection =
      latestValue != null && delta != null && Number.isFinite(latestValue + delta)
        ? latestValue + delta
        : null;
    return [
      {
        label: t('results.drawer.calculation', 'Calculation'),
        value: t('results.drawer.calculationMethod', 'Latest actual'),
        hint: t(
          'results.drawer.calculationHint',
          'The runtime reads the latest governed measurement as the primary period value.'
        ),
        icon: <Sigma size={14} className="text-c-info" />,
      },
      {
        label: t('results.drawer.periodOnPeriod', 'Period on period'),
        value:
          delta == null
            ? '—'
            : `${delta > 0 ? '+' : ''}${delta.toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}`,
        hint: previous
          ? `${measurementLabel(previous)} -> ${measurementLabel(latest!)}`
          : t('results.drawer.periodOnPeriodHint', 'Need at least two measurements'),
        color: delta == null ? undefined : delta >= 0 ? 'text-emerald-400' : 'text-danger-400',
        icon: <GitBranch size={14} className="text-sky-400" />,
      },
      {
        label: t('results.drawer.achievement', 'Target achievement'),
        value: achievement == null ? '—' : `${Math.round(achievement)}%`,
        hint: t('results.drawer.achievementHint', 'Current actual compared to governed target'),
        color:
          achievement == null
            ? undefined
            : achievement >= 100
              ? 'text-emerald-400'
              : 'text-amber-400',
        icon: <Target size={14} className="text-c-info" />,
      },
      {
        label: t('results.drawer.projection', 'Projection'),
        value: formatMetricValue(projection, kpi.unit),
        hint: t(
          'results.drawer.projectionHint',
          'Simple next-period projection based on the latest measured delta.'
        ),
        color:
          projection == null || kpi.targetValue == null
            ? undefined
            : projection >= Number(kpi.targetValue)
              ? 'text-emerald-400'
              : 'text-danger-400',
        icon: <TrendingUp size={14} className="text-emerald-400" />,
      },
    ] satisfies MetricStat[];
  }, [kpi, measurements, t]);

  const alertSemantics = useMemo(() => {
    if (!kpi) return [];
    const staleDays = kpi.latestMeasurementDate
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(String(kpi.latestMeasurementDate)).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;
    const expectedWindow = frequencyWindowDays(kpi.measurementFrequency);
    const overdueBy = staleDays == null ? null : Math.max(0, staleDays - expectedWindow);
    const actionAgeing = (() => {
      const dueDates = (openCase?.actions || [])
        .map((action) => action.dueDate)
        .filter(Boolean)
        .map((dueDate) => new Date(`${String(dueDate).slice(0, 10)}T00:00:00`).getTime())
        .filter((value) => Number.isFinite(value));
      if (!dueDates.length) return null;
      const oldest = Math.min(...dueDates);
      return Math.max(0, Math.floor((Date.now() - oldest) / (1000 * 60 * 60 * 24)));
    })();
    return [
      {
        label: t('results.drawer.alertFreshness', 'Freshness posture'),
        value:
          staleDays == null
            ? t('results.status.noData', 'No data')
            : overdueBy && overdueBy > 0
              ? `${t('results.drawer.overdue', 'Overdue')} +${overdueBy}d`
              : t('results.drawer.inCadence', 'In cadence'),
        hint: t(
          'results.drawer.alertFreshnessHint',
          'Compares the latest measurement date with the declared reporting cadence.'
        ),
        color: kpi.needsEntry ? 'text-amber-400' : 'text-emerald-400',
        icon: <Clock3 size={14} className="text-amber-400" />,
      },
      {
        label: t('results.drawer.alertThreshold', 'Threshold posture'),
        value:
          kpi.status === 'below'
            ? t('results.filters.below', 'Below')
            : kpi.status === 'on-target'
              ? t('results.filters.onTarget', 'On target')
              : t('results.filters.noData', 'No data'),
        hint: t(
          'results.drawer.alertThresholdHint',
          'Uses governed direction and threshold mode to assess operating posture.'
        ),
        color:
          kpi.status === 'below'
            ? 'text-danger-400'
            : kpi.status === 'on-target'
              ? 'text-emerald-400'
              : 'text-slate-600',
        icon: <AlertTriangle size={14} className="text-danger-400" />,
      },
      {
        label: t('results.drawer.alertReconciliation', 'Reconciliation'),
        value: openCase
          ? `${openCase.severity} · ${openCase.status}`
          : t('results.drawer.aligned', 'Aligned'),
        hint: t(
          'results.drawer.alertReconciliationHint',
          'Deviation cases stay visible until evidence, RCA, and closure are complete.'
        ),
        color: openCase
          ? openCase.severity === 'RED'
            ? 'text-danger-400'
            : 'text-amber-400'
          : 'text-emerald-400',
        icon: <ShieldAlert size={14} className="text-blue-400" />,
      },
      {
        label: t('results.drawer.alertActionAgeing', 'Action ageing'),
        value:
          actionAgeing == null
            ? t('results.drawer.noOpenActions', 'No open actions')
            : `${actionAgeing}d`,
        hint: t(
          'results.drawer.alertActionAgeingHint',
          'Shows how long the oldest due action has been sitting in the deviation lane.'
        ),
        color:
          actionAgeing != null && actionAgeing > 7
            ? 'text-danger-400'
            : 'text-slate-900 dark:text-white',
        icon: <Calendar size={14} className="text-c-info" />,
      },
    ] satisfies MetricStat[];
  }, [kpi, openCase, t]);

  const targetTimeline = useMemo(() => {
    if (!kpi) return [];
    return [
      {
        label: t('results.drawer.timeline.baseline', 'Baseline'),
        value: formatMetricValue((kpi as any).baselineValue ?? null, kpi.unit),
        hint: t('results.drawer.timeline.baselineHint', 'Starting reference for the KPI lane'),
      },
      {
        label: t('results.kpi.realizationTarget', 'Realization target'),
        value: formatMetricValue(kpi.realizationExpectation?.targetValue ?? null, kpi.unit),
        hint: t(
          'results.drawer.timeline.realizationHint',
          'Expected operating result while the initiative is still being realized.'
        ),
      },
      {
        label: t('results.kpi.postImplementationTarget', 'Post-implementation target'),
        value: formatMetricValue(kpi.postImplementationExpectation?.targetValue ?? null, kpi.unit),
        hint: t(
          'results.drawer.timeline.postImplementationHint',
          'Expected steady-state result after go-live and stabilization.'
        ),
      },
      {
        label: t('results.columns.target', 'Target'),
        value: formatMetricValue(kpi.targetValue ?? null, kpi.unit),
        hint: t(
          'results.drawer.timeline.currentTargetHint',
          'Current governed target used by the runtime lane'
        ),
      },
    ] satisfies TimelineItem[];
  }, [kpi, t]);

  useEffect(() => {
    const targets: Partial<Record<KpiDrawerSection, string>> = {
      deviation: 'kpi-drawer-deviation',
      recovery: 'kpi-drawer-recovery',
      record: 'kpi-drawer-record',
      history: 'kpi-drawer-history',
      settings: 'kpi-drawer-settings',
      links: 'kpi-drawer-links',
      danger: 'kpi-drawer-danger',
    };

    const targetId = targets[activeSection];
    if (!targetId) return;

    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);

    return () => window.clearTimeout(timer);
  }, [activeSection, loading]);

  const inputCls =
    'w-full h-9 px-3 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus:ring-c-focus focus-visible:border-c-focus-solid transition-colors';

  const caseBadgeCls =
    openCase?.severity === 'RED'
      ? 'bg-danger-500/10 text-danger-400 border-danger-500/30'
      : openCase?.severity === 'AMBER'
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        : 'bg-slate-500/10 text-slate-600 border-slate-500/30';

  const reportRetiredDeviationMutation = useCallback(() => {
    toast.error(
      t(
        'results.deviation.legacyReadOnly',
        'This legacy command is read-only. Use the canonical KPI tool; Resolve remains available here.'
      )
    );
  }, [t]);
  const handleAcknowledge = reportRetiredDeviationMutation;
  const handleClose = reportRetiredDeviationMutation;
  const handleSaveRca = reportRetiredDeviationMutation;
  const handleAddAction = reportRetiredDeviationMutation;
  const handleUpdateActionStatus = useCallback(
    (_action: DeviationAction, _status: DeviationAction['status']) =>
      reportRetiredDeviationMutation(),
    [reportRetiredDeviationMutation]
  );
  const handleResolve = useCallback(async () => {
    if (!openCase?.id) return;
    setCaseBusy(true);
    try {
      await V8ResultsApi.resolveDeviationCase(openCase.id);
      fetchData();
    } catch {
      toast.error(
        t(
          'results.deviation.resolveFailed',
          'The deviation could not be resolved through the governed Results service. Reload and retry.'
        )
      );
    } finally {
      setCaseBusy(false);
    }
  }, [openCase?.id, fetchData, t]);
  const handleSuggestRca = useCallback(async () => {
    if (!openCase?.id) return;
    setRcaSuggestBusy(true);
    try {
      const res = await V8ResultsApi.getDeviationCaseRcaSuggest(openCase.id);
      setRcaHypotheses(Array.isArray(res?.hypotheses) ? res.hypotheses : []);
      setRcaActions(Array.isArray(res?.actions) ? res.actions : []);
    } catch (error) {
      toast.error(t('results.deviation.rcaSuggestError', 'Could not generate RCA suggestions'));
      // eslint-disable-next-line no-console
      console.error('rca-suggest failed', error);
    } finally {
      setRcaSuggestBusy(false);
    }
  }, [openCase?.id, t]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy-950/40" onClick={onClose} />
      <div
        ref={drawerContainerRef}
        role="dialog"
        aria-modal="true"
        aria-label={kpi?.name || t('results.drawer.title', 'KPI details')}
        tabIndex={-1}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 shadow-2xl flex flex-col overflow-hidden outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary-500/10">
              <TrendingUp size={18} className="text-primary-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {kpi?.name || t('common.loading', 'Loading...')}
              </h2>
              {kpi && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      kpi.isOnTarget
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : kpi.latestValue != null
                          ? 'bg-danger-500/10 text-danger-400'
                          : 'bg-slate-500/10 text-slate-600'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        kpi.isOnTarget
                          ? 'bg-emerald-500'
                          : kpi.latestValue != null
                            ? 'bg-danger-500'
                            : 'bg-slate-400'
                      }`}
                    />
                    {kpi.isOnTarget ? 'On Target' : kpi.latestValue != null ? 'Below' : 'No Data'}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                void openKpiAiChat(t('results.drawer.ai.defaultPrompt', 'Analyze this KPI'))
              }
              className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-500/10 text-primary-500 transition-colors"
              title={t('results.drawer.ai.askAi', 'Ask AI')}
              aria-label={t('results.drawer.ai.askAi', 'Ask AI')}
            >
              <Sparkles size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 transition-colors"
              aria-label={t('results.drawer.closeFor', 'Close {{name}} details', {
                name: kpi?.name || t('results.drawer.kpiFallback', 'KPI'),
              })}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-600">
              <Target size={20} className="animate-pulse mr-2" />
              {t('common.loading', 'Loading...')}
            </div>
          ) : (
            <div className="p-5 space-y-6">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['summary', t('common.overview', 'Overview')],
                    ['definition', t('results.drawer.definitionTitle', 'Definition')],
                    ['targets', t('results.drawer.targetsTitle', 'Targets')],
                    ['deviation', t('results.deviation.title', 'Deviation case')],
                    ...(isResultsFlagEnabled('recoveryCard')
                      ? ([
                          ['recovery', t('results.recoveryCard.tabLabel', 'Recovery Card')],
                        ] as const)
                      : []),
                    ['record', t('results.drawer.recordTitle', 'Record New Value')],
                    ['history', t('results.drawer.history', 'History')],
                    ['lineage', t('results.drawer.lineageTitle', 'Lineage')],
                  ] as Array<[KpiDrawerSection, string]>
                ).map(([section, label]) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setActiveSection(section)}
                    className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
                      normalizedSection === section
                        ? 'border-primary-500/40 bg-primary-500/10 text-primary-700 dark:text-primary-200'
                        : 'border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {normalizedSection === 'summary' && (
                <>
                  {/* CB-04/RB-013: the catalog's cached "latest" and the
                      freshly-fetched measurement history disagreeing is a
                      real staleness bug, not a decoration — surface it
                      instead of silently picking one. */}
                  {reconciledReading?.mismatchWithCatalog && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
                    >
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>
                        {t(
                          'results.drawer.catalogMismatch',
                          'The cached catalog value differs from the latest recorded measurement — showing the measurement.'
                        )}
                      </span>
                    </div>
                  )}
                  {/* Quick Stats */}
                  <div
                    id="kpi-drawer-summary"
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2 scroll-mt-4"
                  >
                    {quickStats.map((s) => (
                      <div
                        key={s.label}
                        className="min-w-0 p-2.5 rounded-lg bg-slate-50 dark:bg-c-surface-raised border border-slate-200 dark:border-c-border"
                      >
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-c-text-muted mb-1 truncate">
                          {s.label}
                        </p>
                        <p
                          className={`text-sm font-semibold tabular-nums truncate ${s.color || 'text-slate-900 dark:text-c-text'}`}
                          title={s.value}
                        >
                          {s.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {expectationStats.map((s) => (
                      <div
                        key={s.label}
                        className="min-w-0 p-2.5 rounded-lg bg-white/70 dark:bg-c-surface border border-slate-200 dark:border-c-border"
                      >
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-c-text-muted mb-1 truncate">
                          {s.label}
                        </p>
                        <p
                          className={`text-sm font-semibold tabular-nums truncate ${s.color || 'text-slate-900 dark:text-c-text'}`}
                          title={s.value}
                        >
                          {s.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-900/40 p-3">
                      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('results.drawer.chartSemanticsTitle', 'Chart semantics')}
                      </div>
                      <div className="space-y-2">
                        {chartSemantics.map((item) => (
                          <div
                            key={item.label}
                            className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                {item.icon}
                                {item.label}
                              </div>
                              <div
                                className={`text-sm font-semibold ${item.color || 'text-slate-900 dark:text-white'}`}
                              >
                                {item.value}
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {item.hint}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-900/40 p-3">
                      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('results.drawer.alertSemanticsTitle', 'Alert semantics')}
                      </div>
                      <div className="space-y-2">
                        {alertSemantics.map((item) => (
                          <div
                            key={item.label}
                            className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                {item.icon}
                                {item.label}
                              </div>
                              <div
                                className={`text-sm font-semibold ${item.color || 'text-slate-900 dark:text-white'}`}
                              >
                                {item.value}
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {item.hint}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Deviation case (R1) */}
              {normalizedSection === 'deviation' ? (
                openCase ? (
                  <div
                    id="kpi-drawer-deviation"
                    className="rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 p-4 space-y-3 scroll-mt-4"
                  >
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                      {t(
                        'results.deviation.legacyArchiveBanner',
                        'Legacy deviation commands are partially retired. Continue acknowledgements, root-cause analysis, corrective actions and closure in the canonical KPI tool. Resolve remains available here.'
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('results.deviation.title', 'Deviation case')}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${caseBadgeCls}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${openCase.severity === 'RED' ? 'bg-danger-500' : 'bg-amber-500'}`}
                        />
                        {openCase.severity} · {openCase.status}
                      </span>
                    </div>

                    {openCase.deviationSummary ? (
                      <div className="text-sm text-slate-700 dark:text-slate-200">
                        {openCase.deviationSummary}
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2 flex-wrap">
                      {openCase.status === 'OPEN' ? (
                        <button
                          type="button"
                          disabled={retiredDeviationMutation}
                          onClick={() => void handleAcknowledge()}
                          className="h-8 px-3 rounded-full text-xs font-medium border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-60"
                        >
                          {t('results.deviation.ack', 'Acknowledge')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={caseBusy}
                        onClick={() => void handleResolve()}
                        className="h-8 px-3 rounded-full text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 transition-colors disabled:opacity-60"
                      >
                        {t('results.deviation.resolve', 'Resolve')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void openDeviationAiChat(openCase)}
                        className="h-8 px-3 rounded-full text-xs font-medium border border-primary-500/30 bg-primary-500/10 text-primary-600 dark:text-primary-300 hover:bg-primary-500/15 transition-colors inline-flex items-center gap-1.5"
                      >
                        <MessageCircle size={13} />
                        {t('results.deviation.askAi', 'Ask AI')}
                      </button>
                      <button
                        type="button"
                        disabled={
                          retiredDeviationMutation ||
                          (!closeEvidenceText.trim() && !closeEvidenceRef.trim())
                        }
                        onClick={() => void handleClose()}
                        className="h-8 px-3 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-500 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-60"
                      >
                        {t('results.deviation.close', 'Close')}
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('results.deviation.rca', 'Root cause analysis')}
                      </div>
                      <textarea
                        readOnly
                        className={`w-full min-h-[90px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-900/40 text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus:ring-c-focus`}
                        value={rcaDraft}
                        onChange={(e) => setRcaDraft(e.target.value)}
                        placeholder={t(
                          'results.deviation.rcaPlaceholder',
                          'Explain the root cause...'
                        )}
                      />
                      <button
                        type="button"
                        disabled={retiredDeviationMutation}
                        onClick={() => void handleSaveRca()}
                        className="h-8 px-3 rounded-full text-xs font-medium border border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-300 hover:bg-primary-500/15 transition-colors disabled:opacity-60"
                      >
                        {t('common.save', 'Save')}
                      </button>

                      {isResultsFlagEnabled('deviationDiagnostics') ? (
                        <button
                          type="button"
                          disabled={rcaSuggestBusy}
                          onClick={() => void handleSuggestRca()}
                          className="h-8 px-3 rounded-full text-xs font-medium border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
                        >
                          <Sparkles size={13} />
                          {rcaSuggestBusy
                            ? t('results.deviation.rcaSuggesting', 'Analyzing…')
                            : t('results.deviation.rcaSuggest', 'Suggest root causes')}
                        </button>
                      ) : null}

                      {isResultsFlagEnabled('deviationDiagnostics') &&
                      rcaHypotheses &&
                      rcaHypotheses.length > 0 ? (
                        <div className="mt-1 space-y-1.5">
                          {rcaHypotheses.map((h, i) => (
                            <button
                              key={`${h.category}-${i}`}
                              type="button"
                              onClick={() =>
                                setRcaDraft((prev) =>
                                  prev.trim() ? `${prev}\n${h.hypothesis}` : h.hypothesis
                                )
                              }
                              title={t(
                                'results.deviation.rcaSuggestApply',
                                'Click to append to root cause analysis'
                              )}
                              className="w-full text-left rounded-lg border border-c-border bg-c-surface px-3 py-2 hover:bg-c-surface-raised transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] uppercase tracking-wide text-c-text-muted">
                                  {h.category}
                                </span>
                                <span className="text-[10px] text-c-text-muted">
                                  {Math.round((h.confidence ?? 0) * 100)}%
                                </span>
                              </div>
                              <div className="text-xs text-c-text-secondary mt-0.5">
                                {h.hypothesis}
                              </div>
                            </button>
                          ))}
                          {rcaActions && rcaActions.length > 0 ? (
                            <ul className="list-disc pl-5 pt-1 space-y-0.5 text-[11px] text-c-text-secondary">
                              {rcaActions.map((a, i) => (
                                <li key={i}>{a.title}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('results.deviation.actions', 'Action plan')}
                      </div>
                      {(openCase.actions || []).length > 0 ? (
                        <div className="space-y-1">
                          {(openCase.actions || []).map((a) => (
                            <div
                              key={a.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <button
                                type="button"
                                disabled={retiredDeviationMutation}
                                onClick={() =>
                                  void handleUpdateActionStatus(
                                    a,
                                    a.status === 'DONE' ? 'OPEN' : 'DONE'
                                  )
                                }
                                className="flex min-w-0 items-center gap-2 text-left"
                              >
                                <span
                                  className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[10px] ${
                                    a.status === 'DONE'
                                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                                      : 'border-slate-300 dark:border-navy-600 text-slate-600'
                                  }`}
                                >
                                  {a.status === 'DONE' ? '✓' : ''}
                                </span>
                                <span
                                  className={`truncate ${
                                    a.status === 'DONE'
                                      ? 'text-slate-500 line-through dark:text-slate-400'
                                      : 'text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  {a.title}
                                </span>
                              </button>
                              <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                                {a.status}
                                {a.dueDate ? ` · ${a.dueDate}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {t('results.deviation.noActions', 'No actions yet')}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          readOnly
                          className={inputCls}
                          value={newActionTitle}
                          onChange={(e) => setNewActionTitle(e.target.value)}
                          placeholder={t('results.deviation.actionPlaceholder', 'New action')}
                        />
                        <input
                          readOnly
                          className={inputCls}
                          type="date"
                          value={newActionDue}
                          onChange={(e) => setNewActionDue(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={retiredDeviationMutation || !newActionTitle.trim()}
                        onClick={() => void handleAddAction()}
                        className="h-8 px-3 rounded-full text-xs font-medium border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-60"
                      >
                        {t('results.deviation.addAction', 'Add action')}
                      </button>
                    </div>

                    <div className="space-y-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/30 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('results.deviation.closeEvidence', 'Closure evidence')}
                      </div>
                      <textarea
                        readOnly
                        className={`${inputCls} min-h-[88px] resize-none py-2`}
                        value={closeEvidenceText}
                        onChange={(e) => setCloseEvidenceText(e.target.value)}
                        placeholder={t(
                          'results.deviation.closeEvidenceText',
                          'Describe the evidence that confirms the deviation is closed.'
                        )}
                      />
                      <input
                        readOnly
                        className={inputCls}
                        value={closeEvidenceRef}
                        onChange={(e) => setCloseEvidenceRef(e.target.value)}
                        placeholder={t(
                          'results.deviation.closeEvidenceRef',
                          'Link to task, report, attachment, or external proof (optional)'
                        )}
                      />
                      <textarea
                        readOnly
                        className={`${inputCls} min-h-[72px] resize-none py-2`}
                        value={closeResolutionNotes}
                        onChange={(e) => setCloseResolutionNotes(e.target.value)}
                        placeholder={t(
                          'results.deviation.closeResolutionNotes',
                          'Resolution notes for audit trail (optional)'
                        )}
                      />
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t(
                          'results.deviation.closeEvidenceHint',
                          'At least one evidence field is required to close the case.'
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-white/[0.08] px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t('results.deviation.empty', 'No active deviation case for this KPI.')}
                  </div>
                )
              ) : null}

              {/* Recovery card (RES-003A) — behind resultsFeatureFlags.recoveryCard, default OFF */}
              {normalizedSection === 'recovery' && isResultsFlagEnabled('recoveryCard') ? (
                openCase ? (
                  <div id="kpi-drawer-recovery" className="scroll-mt-4">
                    <RecoveryCardPanel
                      kpiId={kpiId}
                      deviationCaseId={openCase.id}
                      onChanged={() => {
                        // Recovery-card mutations don't change the KPI's own
                        // measurements, so quickStats doesn't need a refetch
                        // today. Revisit if/when the cockpit surfaces
                        // recovery-card counts in the summary tab.
                      }}
                    />
                  </div>
                ) : (
                  <div
                    id="kpi-drawer-recovery"
                    className="rounded-lg border border-dashed border-slate-200 dark:border-white/[0.08] px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400 scroll-mt-4"
                  >
                    {t(
                      'results.recoveryCard.noOpenCase',
                      'No open deviation case for this KPI — a recovery card needs an active deviation.'
                    )}
                  </div>
                )
              ) : null}

              {/* Simple bar chart */}
              {normalizedSection === 'summary' && (
                <div>
                  <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-3">
                    {t('results.drawer.chartTitle', 'Value Over Time')}
                  </h3>
                  {chartBars.length > 0 ? (
                    <div className="relative h-32 flex items-end gap-1">
                      {kpi?.targetValue != null && (
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-c-info/50"
                          style={{ bottom: `${(kpi.targetValue / maxVal) * 100}%` }}
                        >
                          <span className="absolute -top-3 right-0 text-[10px] text-c-info">
                            {t('results.columns.target', 'Target')}
                          </span>
                        </div>
                      )}
                      {chartBars.map((m) => {
                        const pct = (m.value / maxVal) * 100;
                        const isAboveTarget =
                          kpi?.targetValue != null && m.value >= kpi.targetValue;
                        return (
                          <div
                            key={m.id}
                            className="flex-1 min-w-[12px] group/bar relative"
                            title={`${measurementLabel(m)}: ${m.value}`}
                          >
                            <div
                              className={`w-full rounded-t transition-all ${
                                isAboveTarget ? 'bg-emerald-500/60' : 'bg-danger-500/40'
                              } group-hover/bar:opacity-80`}
                              style={{ height: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                        );
                      })}
                      {chartSemantics[3]?.value !== '—' && kpi?.targetValue != null ? (
                        <div
                          className="absolute right-0 w-5 border-t-2 border-dotted border-emerald-400/80"
                          style={{
                            bottom: `${(Number(String(chartSemantics[3].value).replace(/[^\d.-]/g, '')) / maxVal) * 100}%`,
                          }}
                        >
                          <span className="absolute -top-3 right-0 text-[10px] text-emerald-400">
                            {t('results.drawer.projection', 'Projection')}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="h-32 flex items-center justify-center text-sm text-slate-500 bg-slate-50 dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-navy-700">
                      {t('results.drawer.noMeasurements', 'No measurements yet')}
                    </div>
                  )}
                </div>
              )}

              {/* Record new value */}
              {normalizedSection === 'record' && (
                <div id="kpi-drawer-record" className="scroll-mt-4">
                  <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-3">
                    {t('results.drawer.recordTitleCanonical', 'Canonical measurement entry')}
                  </h3>
                  <p className="mb-3 text-sm text-c-text-secondary">{t('results.drawer.legacyMeasurementArchive', 'This legacy KPI is read-only. Record governed measurements against the approved immutable definition in the KPI registry.')}</p>
                  <button type="button" onClick={openCanonicalKpiRegistry} className="w-full h-9 rounded-full border border-c-border bg-c-surface text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised transition-colors">
                    {t('results.actions.openCanonicalMeasurements', 'Open canonical measurements')}
                  </button>
                </div>
              )}

              {/* History table */}
              {normalizedSection === 'history' && (
                <div id="kpi-drawer-history" className="scroll-mt-4">
                  <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-3">
                    {t('results.drawer.history', 'History')}
                    {measurements.length > 0 && (
                      <span className="ml-1 text-slate-600">({measurements.length})</span>
                    )}
                  </h3>
                  <div className="mb-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50/70 dark:bg-navy-800/50 p-3">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('results.drawer.timelineTitle', 'Governed target checkpoints')}
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {targetTimeline.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.02] p-3"
                        >
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {item.label}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {item.value}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {item.hint}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* §27-exempt: financial-calculation — time-series measurement log with date+value+note columns; tightly coupled to drawer state */}
                  {measurements.length > 0 ? (
                    <div className="border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-navy-800">
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                              {t('results.drawer.historyDate', 'Date')}
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                              {t('results.drawer.historyValue', 'Value')}
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                              {t('results.drawer.historyVariance', 'Variance')}
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                              {t('results.drawer.historyNotes', 'Notes')}
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                              {t('results.drawer.historyBy', 'By')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-navy-700/50">
                          {measurements.map((m) => (
                            <tr key={m.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-3 py-2 text-slate-600">
                                <div className="flex items-center gap-1.5">
                                  <Calendar size={12} className="text-slate-500" />
                                  {measurementDate(m)
                                    ? new Date(measurementDate(m)).toLocaleDateString()
                                    : '—'}
                                  {m.periodKey && m.periodKey !== measurementDate(m) ? (
                                    <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-500">
                                      {m.periodKey}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-slate-600">
                                {m.value.toLocaleString()}
                                {kpi?.unit && (
                                  <span className="ml-0.5 text-xs text-slate-500">{kpi.unit}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-xs">
                                <span
                                  className={
                                    kpi?.targetValue != null &&
                                    Number(m.value) >= Number(kpi.targetValue)
                                      ? 'text-emerald-400'
                                      : 'text-danger-400'
                                  }
                                >
                                  {kpi?.targetValue != null
                                    ? `${Number(m.value) - Number(kpi.targetValue) > 0 ? '+' : ''}${(
                                        Number(m.value) - Number(kpi.targetValue)
                                      ).toLocaleString()}${kpi?.unit ? ` ${kpi.unit}` : ''}`
                                    : '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">
                                {m.notes || '—'}
                              </td>
                              <td className="px-3 py-2 text-slate-500 text-xs">
                                {m.createdBy
                                  ? `${m.createdBy.firstName} ${m.createdBy.lastName}`
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-6">
                      {t('results.drawer.noMeasurements', 'No measurements yet')}
                    </p>
                  )}
                  <div className="mt-4 rounded-lg border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/30 p-3">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('results.drawer.measurementAudit', 'Measurement audit')}
                    </div>
                    <div className="space-y-2">
                      {historyAudit.length > 0 ? (
                        historyAudit.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.02] p-3"
                          >
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {entry.summary || entry.eventType}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {new Date(entry.createdAt).toLocaleString()} · {entry.source}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {t(
                            'results.drawer.noMeasurementAuditYet',
                            'No measurement audit entries yet.'
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(normalizedSection === 'definition' || normalizedSection === 'targets') && (
                <div
                  id="kpi-drawer-settings"
                  className="rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 p-4 space-y-4 scroll-mt-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {normalizedSection === 'definition'
                        ? t('results.drawer.definitionTitle', 'Definition')
                        : t('results.drawer.targetsTitle', 'Targets')}
                    </div>
                    <button type="button" onClick={openCanonicalKpiRegistry} className="h-8 px-3 rounded-full text-xs font-medium border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors">
                      <span className="inline-flex items-center gap-2"><Pencil size={14} />{t('results.actions.editGovernedDefinition', 'Edit governed definition')}</span>
                    </button>
                  </div>

                  {normalizedSection === 'definition' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {definitionStats.map((item) => (
                          <div
                            key={item.label}
                            className="p-2.5 rounded-lg bg-white/70 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700"
                          >
                            <p className="text-[10px] uppercase text-slate-500 mb-1">
                              {item.label}
                            </p>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {t('results.createModal.name', 'Name')} *
                          </div>
                          <input
                            className={inputCls}
                            value={settingsName}
                            onChange={(e) => setSettingsName(e.target.value)}
                            disabled={!editMode}
                          />
                        </div>

                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {t('results.createModal.description', 'Description')}
                          </div>
                          <textarea
                            className={`${inputCls} h-20 resize-none py-2`}
                            value={settingsDescription}
                            onChange={(e) => setSettingsDescription(e.target.value)}
                            disabled={!editMode}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                              {t('results.createModal.unit', 'Unit')}
                            </div>
                            <input
                              className={inputCls}
                              value={settingsUnit}
                              onChange={(e) => setSettingsUnit(e.target.value)}
                              disabled={!editMode}
                            />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                              {t('results.createModal.direction', 'Direction')}
                            </div>
                            <select
                              className={`${inputCls} appearance-none`}
                              value={settingsDirection}
                              onChange={(e) => setSettingsDirection(e.target.value as any)}
                              disabled={!editMode}
                            >
                              <option value="increase">
                                {t('results.direction.increase', 'Increase')}
                              </option>
                              <option value="decrease">
                                {t('results.direction.decrease', 'Decrease')}
                              </option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {t('results.drawer.visibility', 'Visibility')}
                          </div>
                          <select
                            aria-label={t('results.drawer.visibility', 'Visibility')}
                            className={`${inputCls} appearance-none`}
                            value={settingsVisibility}
                            onChange={(e) => setSettingsVisibility(e.target.value as any)}
                            disabled={!editMode}
                          >
                            <option value="org_visible">
                              {t('results.drawer.visibilityOrg', 'Organization')}
                            </option>
                            <option value="initiative_restricted">
                              {t('results.drawer.visibilityTeam', 'Initiative team only')}
                            </option>
                            <option value="private_to_owner">
                              {t('results.drawer.visibilityPrivate', 'Private (owner only)')}
                            </option>
                          </select>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/30 p-3">
                        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {t('results.drawer.changeHistory', 'Change history')}
                        </div>
                        <div className="space-y-2">
                          {definitionAudit.length > 0 ? (
                            definitionAudit.map((entry) => (
                              <div
                                key={entry.id}
                                className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.02] p-3"
                              >
                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                  {entry.summary || entry.eventType}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {new Date(entry.createdAt).toLocaleString()} · {entry.source}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {t(
                                'results.drawer.noAuditYet',
                                'No definition changes recorded yet.'
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {targetStats.map((item) => (
                          <div
                            key={item.label}
                            className="p-2.5 rounded-lg bg-white/70 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700"
                          >
                            <p className="text-[10px] uppercase text-slate-500 mb-1">
                              {item.label}
                            </p>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/30 p-3">
                        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {t('results.drawer.timelineTitle', 'Governed target checkpoints')}
                        </div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          {targetTimeline.map((item) => (
                            <div
                              key={item.label}
                              className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.02] p-3"
                            >
                              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                {item.label}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                {item.value}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {item.hint}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {t('results.columns.baseline', 'Baseline')}
                          </div>
                          <input
                            className={inputCls}
                            type="number"
                            value={settingsBaseline}
                            onChange={(e) => setSettingsBaseline(e.target.value)}
                            disabled={!editMode}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {t('results.columns.target', 'Target')}
                          </div>
                          <input
                            className={inputCls}
                            type="number"
                            value={settingsTarget}
                            onChange={(e) => setSettingsTarget(e.target.value)}
                            disabled={!editMode}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {t('results.createModal.frequency', 'Frequency')}
                          </div>
                          <select
                            className={`${inputCls} appearance-none`}
                            value={settingsFrequency}
                            onChange={(e) => setSettingsFrequency(e.target.value as any)}
                            disabled={!editMode}
                          >
                            <option value="DAILY">Daily</option>
                            <option value="WEEKLY">Weekly</option>
                            <option value="MONTHLY">Monthly</option>
                            <option value="QUARTERLY">Quarterly</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {t('results.drawer.thresholdMode', 'Threshold mode')}
                          </div>
                          <select
                            className={`${inputCls} appearance-none`}
                            value={settingsThresholdMode}
                            onChange={(e) => setSettingsThresholdMode(e.target.value as any)}
                            disabled={!editMode}
                          >
                            <option value="PERCENT_FROM_TARGET">
                              {t('results.drawer.thresholdPercent', 'Percent from target')}
                            </option>
                            <option value="ABSOLUTE">
                              {t('results.drawer.thresholdAbsolute', 'Absolute gap')}
                            </option>
                          </select>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {t('results.drawer.amberThreshold', 'Amber threshold')}
                          </div>
                          <input
                            className={inputCls}
                            type="number"
                            step="any"
                            value={settingsAmberThreshold}
                            onChange={(e) => setSettingsAmberThreshold(e.target.value)}
                            disabled={!editMode}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {t('results.drawer.redThreshold', 'Red threshold')}
                          </div>
                          <input
                            className={inputCls}
                            type="number"
                            step="any"
                            value={settingsRedThreshold}
                            onChange={(e) => setSettingsRedThreshold(e.target.value)}
                            disabled={!editMode}
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/30 p-3">
                        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {t('results.drawer.targetHistory', 'Target change log')}
                        </div>
                        <div className="space-y-2">
                          {targetAudit.length > 0 ? (
                            targetAudit.map((entry) => (
                              <div
                                key={entry.id}
                                className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.02] p-3"
                              >
                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                  {entry.summary || entry.eventType}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {new Date(entry.createdAt).toLocaleString()}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {t(
                                'results.drawer.noTargetAuditYet',
                                'No target changes recorded yet.'
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {normalizedSection === 'definition' && (
                    <div id="kpi-drawer-canonical-management" className="rounded-lg border border-slate-200 dark:border-navy-700 p-4 scroll-mt-4">
                      <button
                        type="button"
                        onClick={openCanonicalKpiRegistry}
                        className="w-full h-9 text-sm font-medium rounded-full border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors inline-flex items-center justify-center gap-2"
                      >
                        <Target size={16} />
                        {t('results.actions.manageInRegistry', 'Manage in KPI registry')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {normalizedSection === 'lineage' && (
                <div
                  id="kpi-drawer-links"
                  className="rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 p-4 space-y-4 scroll-mt-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('results.drawer.lineageTitle', 'Lineage')}
                    </div>
                    <GitBranch size={16} className="text-slate-600" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-white/70 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700">
                      <p className="text-[10px] uppercase text-slate-500 mb-1">
                        {t('results.drawer.definitionSource', 'Definition source')}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {kpi?.definitionSource === 'library'
                          ? t('results.kpi.source.library', 'Library')
                          : t('results.kpi.source.custom', 'Initiative custom')}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/70 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700">
                      <p className="text-[10px] uppercase text-slate-500 mb-1">
                        {t('results.columns.phase', 'Phase')}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {kpi?.observationPhase || '—'}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/70 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700">
                      <p className="text-[10px] uppercase text-slate-500 mb-1">
                        {t('results.drawer.lineageConnectors', 'Connectors')}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {connectedConnectors.length}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/70 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700">
                      <p className="text-[10px] uppercase text-slate-500 mb-1">
                        {t('results.tabs.initiatives', 'Initiatives')}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {mappings.length}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/30 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('results.drawer.linksTitle', 'Linked initiatives')}
                    </div>
                    {linkedInitiatives.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {linkedInitiatives.map((m) => (
                          <span
                            key={m.initiativeId}
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/70 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.08] text-xs text-slate-700 dark:text-slate-200"
                          >
                            <span className="truncate max-w-[220px]">{m.label}</span>
                            <button
                              type="button"
                              disabled={mappingBusy}
                              onClick={() => void handleUnlinkMapping(m.mappingId)}
                              className="text-slate-600 hover:text-danger-400 transition-colors disabled:opacity-60"
                              title={t('common.remove', 'Remove')}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('results.drawer.noLinks', 'No linked initiatives')}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/30 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('results.drawer.lineageConnectors', 'Connector lineage')}
                    </div>
                    {connectedConnectors.length > 0 ? (
                      <div className="space-y-2">
                        {connectedConnectors.map((connector) => (
                          <div
                            key={connector.id}
                            className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.02] p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                  {connector.connectorName}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {connector.connectorType || 'api'} ·{' '}
                                  {connector.scheduleCron || 'manual'}
                                </div>
                              </div>
                              <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                                <div>{connector.lastRunStatus || 'never'}</div>
                                <div>
                                  {connector.lastRunAt
                                    ? new Date(connector.lastRunAt).toLocaleString()
                                    : '—'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t(
                          'results.drawer.lineageNoConnectors',
                          'No connectors linked to this KPI yet.'
                        )}
                      </div>
                    )}
                  </div>

                  <button type="button" onClick={openCanonicalKpiRegistry} className="w-full h-9 rounded-full border border-c-border bg-c-surface text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised transition-colors">
                    {t('results.actions.manageImpactInRegistry', 'Manage impacts in KPI registry')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default KPITimeSeriesDrawer;
