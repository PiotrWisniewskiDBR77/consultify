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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useOrganizationContext } from '@/hooks/discovery/useOrganizationContext';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyResults,
  V8ResultsApi,
  type V8ResultsCreateKpiMappingPayload,
  type V8ResultsRcaAction,
  type V8ResultsRcaHypothesis,
  type V8ResultsUpdateKpiPayload,
} from '@/services/api/v8/results';
import { InitiativeKPI, KPIMeasurement } from '@/types/core';

import type { KpiDrawerSection } from './kpiDomain';
import { RecoveryCardPanel } from './RecoveryCardPanel';
import { isResultsFlagEnabled } from './resultsFeatureFlags';
import { buildLinkedInitiatives, dedupeInitiativeOptions } from './resultsLineage';

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
  // #M15/OC2: RCA-suggest diagnostics (flag deviationDiagnostics, default OFF).
  const [rcaSuggestBusy, setRcaSuggestBusy] = useState(false);
  const [rcaHypotheses, setRcaHypotheses] = useState<V8ResultsRcaHypothesis[] | null>(null);
  const [rcaActions, setRcaActions] = useState<V8ResultsRcaAction[] | null>(null);
  const [closeEvidenceText, setCloseEvidenceText] = useState('');
  const [closeEvidenceRef, setCloseEvidenceRef] = useState('');
  const [closeResolutionNotes, setCloseResolutionNotes] = useState('');

  const [newValue, setNewValue] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  const [initiativeSearch, setInitiativeSearch] = useState('');
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

  const handleRecord = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newValue) return;
      setSubmitting(true);
      try {
        const payload = {
          value: Number(newValue),
          periodStart: String(newDate).slice(0, 10),
          notes: newNotes.trim() || undefined,
        };
        try {
          await V8ResultsApi.createKpiTimeSeriesValue(kpiId, payload);
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) {
            throw error;
          }
          await Api.post(`/benefits/kpis/${kpiId}/time-series`, payload);
        }
        setNewValue('');
        setNewNotes('');
        fetchData();
        onValueRecorded?.();
        toast.success(t('results.drawer.recorded', 'Measurement recorded'));
      } catch (error: any) {
        toast.error(
          error?.message || t('results.drawer.recordFailed', 'Failed to record measurement')
        );
      } finally {
        setSubmitting(false);
      }
    },
    [kpiId, newValue, newDate, newNotes, fetchData, onValueRecorded]
  );

  const handleSaveSettings = useCallback(async () => {
    if (!settingsName.trim()) return;
    setSavingSettings(true);
    try {
      const kpiDirection =
        settingsDirection === 'decrease' ? 'LOWER_IS_BETTER' : 'HIGHER_IS_BETTER';
      const payload: V8ResultsUpdateKpiPayload = {
        name: settingsName.trim(),
        description: settingsDescription.trim() || undefined,
        unit: settingsUnit.trim() || undefined,
        baselineValue: settingsBaseline !== '' ? Number(settingsBaseline) : null,
        targetValue: settingsTarget !== '' ? Number(settingsTarget) : null,
        measurementFrequency: settingsFrequency,
        direction: kpiDirection,
        thresholdMode: settingsThresholdMode,
        amberThresholdPct:
          settingsThresholdMode === 'PERCENT_FROM_TARGET' && settingsAmberThreshold !== ''
            ? Number(settingsAmberThreshold)
            : null,
        redThresholdPct:
          settingsThresholdMode === 'PERCENT_FROM_TARGET' && settingsRedThreshold !== ''
            ? Number(settingsRedThreshold)
            : null,
        amberThresholdAbs:
          settingsThresholdMode === 'ABSOLUTE' && settingsAmberThreshold !== ''
            ? Number(settingsAmberThreshold)
            : null,
        redThresholdAbs:
          settingsThresholdMode === 'ABSOLUTE' && settingsRedThreshold !== ''
            ? Number(settingsRedThreshold)
            : null,
        visibility: settingsVisibility,
        // RES-02: round-trip the version this drawer last read so the backend
        // can reject (409) a save based on stale data instead of silently
        // overwriting a concurrent edit.
        expectedVersion: kpi?.currentDefinitionVersion ?? undefined,
      };
      try {
        await V8ResultsApi.updateKpi(kpiId, payload);
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        await Api.put(`/benefits/kpis/${kpiId}`, payload);
      }
      setEditMode(false);
      fetchData();
      onValueRecorded?.();
      toast.success(t('results.drawer.saved', 'KPI settings saved'));
    } catch (error: any) {
      // RES-02: a version conflict is not a generic failure — the save was
      // correctly rejected because someone else changed this KPI first. Never
      // treat this as success, and reload the current server state instead of
      // leaving the user staring at a stale form that will just conflict again.
      if (error?.status === 409 && error?.data?.code === 'RESULTS_KPI_VERSION_CONFLICT') {
        toast.error(
          t(
            'results.drawer.saveConflict',
            'This KPI was changed by someone else in the meantime. Reloading the latest version.'
          )
        );
        setEditMode(false);
        fetchData();
        return;
      }
      toast.error(error?.message || t('results.drawer.saveFailed', 'Failed to save KPI settings'));
    } finally {
      setSavingSettings(false);
    }
  }, [
    fetchData,
    kpi,
    kpiId,
    onValueRecorded,
    settingsBaseline,
    settingsAmberThreshold,
    settingsDescription,
    settingsDirection,
    settingsFrequency,
    settingsName,
    settingsRedThreshold,
    settingsTarget,
    settingsThresholdMode,
    settingsUnit,
    settingsVisibility,
  ]);

  const handleDeleteKpi = useCallback(async () => {
    if (!kpiId) return;
    const ok = window.confirm(
      t(
        'results.drawer.deleteConfirm',
        'Delete this KPI? This will remove its measurements, mappings, and deviation cases.'
      )
    );
    if (!ok) return;
    setDeleting(true);
    try {
      try {
        await V8ResultsApi.deleteKpi(kpiId);
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        await Api.delete(`/benefits/kpis/${kpiId}`);
      }
      onValueRecorded?.();
      onClose();
      toast.success(t('results.drawer.deleted', 'KPI deleted'));
    } catch (error: any) {
      toast.error(error?.message || t('results.drawer.deleteFailed', 'Failed to delete KPI'));
    } finally {
      setDeleting(false);
    }
  }, [kpiId, onClose, onValueRecorded, t]);

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

  const handleLinkInitiative = useCallback(
    async (initiativeId: string) => {
      if (!initiativeId) return;
      setMappingBusy(true);
      try {
        const payload: V8ResultsCreateKpiMappingPayload = {
          initiativeId,
          kpiId: String(kpiId),
          impactWeight: 1.0,
          impactDirection: settingsDirection === 'decrease' ? 'decrease' : 'increase',
          confidence: 'medium',
        };
        try {
          await V8ResultsApi.createKpiMapping(payload);
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) {
            throw error;
          }
          await Api.post('/benefits/kpi-mappings', payload);
        }
        setInitiativeSearch('');
        fetchData();
        onValueRecorded?.();
      } catch {
        // silent
      } finally {
        setMappingBusy(false);
      }
    },
    [fetchData, kpiId, onValueRecorded, settingsDirection]
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

  const quickStats: QuickStat[] = useMemo(() => {
    if (!kpi) return [];
    const gap =
      kpi.targetValue != null && kpi.latestValue != null ? kpi.targetValue - kpi.latestValue : null;
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
        value:
          kpi.latestValue != null ? `${kpi.latestValue}${kpi.unit ? ' ' + kpi.unit : ''}` : '—',
        color: kpi.isOnTarget ? 'text-emerald-400' : 'text-danger-400',
      },
      {
        label: t('results.drawer.gap', 'Gap'),
        value: gap != null ? `${gap > 0 ? '+' : ''}${gap}${kpi.unit ? ' ' + kpi.unit : ''}` : '—',
        color: gap != null ? (gap <= 0 ? 'text-emerald-400' : 'text-danger-400') : undefined,
      },
    ];
  }, [kpi, t]);

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
    'w-full h-9 px-3 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-colors';

  const caseBadgeCls =
    openCase?.severity === 'RED'
      ? 'bg-danger-500/10 text-danger-400 border-danger-500/30'
      : openCase?.severity === 'AMBER'
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        : 'bg-slate-500/10 text-slate-600 border-slate-500/30';

  const handleAcknowledge = useCallback(async () => {
    if (!openCase?.id) return;
    setCaseBusy(true);
    try {
      try {
        await V8ResultsApi.acknowledgeDeviationCase(openCase.id);
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        await Api.post(`/benefits/deviation-cases/${openCase.id}/acknowledge`, {});
      }
      fetchData();
    } finally {
      setCaseBusy(false);
    }
  }, [openCase?.id, fetchData]);

  const handleSaveRca = useCallback(async () => {
    if (!openCase?.id) return;
    setCaseBusy(true);
    try {
      const payload = { rcaText: rcaDraft };
      try {
        await V8ResultsApi.updateDeviationCaseRca(openCase.id, payload);
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        await Api.put(`/benefits/deviation-cases/${openCase.id}/rca`, payload);
      }
      fetchData();
    } finally {
      setCaseBusy(false);
    }
  }, [openCase?.id, rcaDraft, fetchData]);

  // #M15/OC2: pull heuristic RCA hypotheses + actions from the (formerly
  // orphaned) deviationRcaSuggestService via the V8 rca-suggest endpoint.
  // Read-only — does NOT persist rca_text; the user still saves via handleSaveRca.
  const handleSuggestRca = useCallback(async () => {
    if (!openCase?.id) return;
    setRcaSuggestBusy(true);
    try {
      const res = await V8ResultsApi.getDeviationCaseRcaSuggest(openCase.id);
      setRcaHypotheses(Array.isArray(res?.hypotheses) ? res.hypotheses : []);
      setRcaActions(Array.isArray(res?.actions) ? res.actions : []);
    } catch (error) {
      // No legacy fallback exists for this new engine — surface and stop.
      toast.error(t('results.deviation.rcaSuggestError', 'Could not generate RCA suggestions'));
      // eslint-disable-next-line no-console
      console.error('rca-suggest failed', error);
    } finally {
      setRcaSuggestBusy(false);
    }
  }, [openCase?.id, t]);

  const handleAddAction = useCallback(async () => {
    if (!openCase?.id || !newActionTitle.trim()) return;
    setCaseBusy(true);
    try {
      const payload = {
        title: newActionTitle.trim(),
        dueDate: newActionDue ? String(newActionDue).slice(0, 10) : undefined,
      };
      try {
        await V8ResultsApi.createDeviationAction(openCase.id, payload);
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        await Api.post(`/benefits/deviation-cases/${openCase.id}/actions`, payload);
      }
      setNewActionTitle('');
      setNewActionDue('');
      fetchData();
    } finally {
      setCaseBusy(false);
    }
  }, [openCase?.id, newActionTitle, newActionDue, fetchData]);

  const handleResolve = useCallback(async () => {
    if (!openCase?.id) return;
    setCaseBusy(true);
    try {
      try {
        await V8ResultsApi.resolveDeviationCase(openCase.id);
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        await Api.post(`/benefits/deviation-cases/${openCase.id}/resolve`, {});
      }
      fetchData();
    } finally {
      setCaseBusy(false);
    }
  }, [openCase?.id, fetchData]);

  const handleUpdateActionStatus = useCallback(
    async (action: DeviationAction, status: DeviationAction['status']) => {
      if (!openCase?.id) return;
      setCaseBusy(true);
      try {
        const payload = { status };
        try {
          await V8ResultsApi.updateDeviationAction(openCase.id, action.id, payload);
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) {
            throw error;
          }
          await Api.put(`/benefits/deviation-cases/${openCase.id}/actions/${action.id}`, payload);
        }
        fetchData();
      } finally {
        setCaseBusy(false);
      }
    },
    [openCase?.id, fetchData]
  );

  const handleClose = useCallback(async () => {
    if (!openCase?.id) return;
    if (!closeEvidenceText.trim() && !closeEvidenceRef.trim()) return;
    setCaseBusy(true);
    try {
      const payload = {
        evidenceText: closeEvidenceText.trim() || undefined,
        evidenceRef: closeEvidenceRef.trim() || undefined,
        resolutionNotes: closeResolutionNotes.trim() || undefined,
      };
      try {
        await V8ResultsApi.closeDeviationCase(openCase.id, payload);
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        await Api.post(`/benefits/deviation-cases/${openCase.id}/close`, payload);
      }
      fetchData();
    } finally {
      setCaseBusy(false);
    }
  }, [openCase?.id, closeEvidenceRef, closeEvidenceText, closeResolutionNotes, fetchData]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy-950/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 shadow-2xl flex flex-col overflow-hidden">
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
              onClick={() =>
                void openKpiAiChat(t('results.drawer.ai.defaultPrompt', 'Analyze this KPI'))
              }
              className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-500/10 text-primary-500 transition-colors"
              title={t('results.drawer.ai.askAi', 'Ask AI')}
            >
              <Sparkles size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 transition-colors"
            >
              <X size={18} />
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
                      ? ([['recovery', t('results.recoveryCard.tabLabel', 'Recovery Card')]] as const)
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
                          disabled={caseBusy}
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
                          caseBusy || (!closeEvidenceText.trim() && !closeEvidenceRef.trim())
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
                        className={`w-full min-h-[90px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-900/40 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30`}
                        value={rcaDraft}
                        onChange={(e) => setRcaDraft(e.target.value)}
                        placeholder={t(
                          'results.deviation.rcaPlaceholder',
                          'Explain the root cause...'
                        )}
                      />
                      <button
                        type="button"
                        disabled={caseBusy}
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
                                disabled={caseBusy}
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
                          className={inputCls}
                          value={newActionTitle}
                          onChange={(e) => setNewActionTitle(e.target.value)}
                          placeholder={t('results.deviation.actionPlaceholder', 'New action')}
                        />
                        <input
                          className={inputCls}
                          type="date"
                          value={newActionDue}
                          onChange={(e) => setNewActionDue(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={caseBusy || !newActionTitle.trim()}
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
                        className={`${inputCls} min-h-[88px] resize-none py-2`}
                        value={closeEvidenceText}
                        onChange={(e) => setCloseEvidenceText(e.target.value)}
                        placeholder={t(
                          'results.deviation.closeEvidenceText',
                          'Describe the evidence that confirms the deviation is closed.'
                        )}
                      />
                      <input
                        className={inputCls}
                        value={closeEvidenceRef}
                        onChange={(e) => setCloseEvidenceRef(e.target.value)}
                        placeholder={t(
                          'results.deviation.closeEvidenceRef',
                          'Link to task, report, attachment, or external proof (optional)'
                        )}
                      />
                      <textarea
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
                    {t('results.drawer.recordTitle', 'Record New Value')}
                  </h3>
                  <form onSubmit={handleRecord} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input
                          className={inputCls}
                          type="number"
                          step="any"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          placeholder={t('results.drawer.valuePlaceholder', 'Value')}
                          required
                        />
                      </div>
                      <div>
                        <input
                          className={inputCls}
                          type="date"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <input
                      className={inputCls}
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder={t(
                        'results.drawer.notesPlaceholder',
                        'Notes, source, or audit comment (optional)'
                      )}
                    />
                    <button
                      type="submit"
                      disabled={!newValue || submitting}
                      className="w-full h-9 text-sm font-medium rounded-full bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting
                        ? t('common.saving', 'Saving...')
                        : t('results.drawer.record', 'Record')}
                    </button>
                  </form>
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
                    {!editMode ? (
                      <button
                        type="button"
                        onClick={() => setEditMode(true)}
                        className="h-8 px-3 rounded-full text-xs font-medium border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Pencil size={14} />
                          {t('common.edit', 'Edit')}
                        </span>
                      </button>
                    ) : null}
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

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            {t('results.drawer.visibility', 'Visibility')}
                          </div>
                          <select
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

                  {editMode ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingSettings || !settingsName.trim()}
                        onClick={() => void handleSaveSettings()}
                        className="h-8 px-3 rounded-full text-xs font-medium border border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-300 hover:bg-primary-500/15 transition-colors disabled:opacity-60"
                      >
                        {savingSettings
                          ? t('common.saving', 'Saving...')
                          : t('common.save', 'Save')}
                      </button>
                      <button
                        type="button"
                        disabled={savingSettings}
                        onClick={() => {
                          setEditMode(false);
                          setSettingsName(String((kpi as any)?.name || ''));
                          setSettingsDescription(String((kpi as any)?.description || ''));
                          setSettingsUnit(String((kpi as any)?.unit || ''));
                          setSettingsBaseline(
                            (kpi as any)?.baselineValue != null
                              ? String((kpi as any).baselineValue)
                              : ''
                          );
                          setSettingsTarget(
                            (kpi as any)?.targetValue != null
                              ? String((kpi as any).targetValue)
                              : ''
                          );
                          setSettingsFrequency(
                            ((kpi as any)?.measurementFrequency || 'MONTHLY') as any
                          );
                          setSettingsDirection(
                            (kpi as any)?.direction === 'LOWER_IS_BETTER' ? 'decrease' : 'increase'
                          );
                          setSettingsThresholdMode(
                            ((kpi as any)?.thresholdMode || 'PERCENT_FROM_TARGET') as any
                          );
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
                        }}
                        className="h-8 px-3 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-500 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-60"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                    </div>
                  ) : null}

                  {normalizedSection === 'definition' && (
                    <div
                      id="kpi-drawer-danger"
                      className="rounded-lg border border-danger-500/20 bg-danger-500/5 p-4 scroll-mt-4"
                    >
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => void handleDeleteKpi()}
                        className="w-full h-9 text-sm font-medium rounded-full border border-danger-500/30 bg-danger-500/10 text-danger-600 dark:text-danger-300 hover:bg-danger-500/15 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                      >
                        <Trash2 size={16} />
                        {deleting
                          ? t('common.deleting', 'Deleting...')
                          : t('common.delete', 'Delete')}
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

                  <div className="space-y-2">
                    <input
                      className={inputCls}
                      value={initiativeSearch}
                      onChange={(e) => setInitiativeSearch(e.target.value)}
                      placeholder={t('results.drawer.linkSearch', 'Search initiatives to link...')}
                      disabled={mappingBusy}
                    />
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/30">
                      {initiatives
                        .filter((i) => {
                          if (!initiativeSearch.trim()) return true;
                          return i.name.toLowerCase().includes(initiativeSearch.toLowerCase());
                        })
                        .filter(
                          (i) => !mappings.some((m) => String(m.initiative_id) === String(i.id))
                        )
                        .slice(0, 25)
                        .map((i) => (
                          <button
                            key={i.id}
                            type="button"
                            disabled={mappingBusy}
                            onClick={() => void handleLinkInitiative(i.id)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-60"
                          >
                            {i.name}
                          </button>
                        ))}
                      {initiatives.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                          {t('common.loading', 'Loading...')}
                        </div>
                      ) : null}
                    </div>
                  </div>
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
