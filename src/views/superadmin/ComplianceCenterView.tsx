/**
 * ComplianceCenterView - Super Admin Compliance Management
 *
 * Enterprise compliance dashboard:
 * - SOC 2 Type II compliance
 * - GDPR Article 30 records
 * - HIPAA compliance tracking
 * - ISO 27001 controls
 * - Audit management
 * - DSAR handling
 */

import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock,
  Download,
  Edit,
  Eye,
  FileCheck,
  FileText,
  Loader2,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Target,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';

interface ComplianceFramework {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  requirements: {
    id: string;
    category: string;
    title: string;
    description: string;
  }[];
}

interface ComplianceStatus {
  frameworkId: string;
  frameworkName: string;
  total: number;
  compliant: number;
  inProgress: number;
  pending: number;
  nonCompliant: number;
  score: number;
}

interface DSAR {
  id: string;
  requesterEmail: string;
  requestType: string;
  status: string;
  receivedAt: string;
  dueDate: string;
  assignedTo?: string;
}

interface Audit {
  id: string;
  name: string;
  frameworkId: string;
  auditType: string;
  status: string;
  plannedStart: string;
  plannedEnd: string;
  findingsCount: number;
}

interface ProcessingRecord {
  id: string;
  name: string;
  purpose: string;
  data_categories: string;
  legal_basis: string;
  retention_period: string;
  status: string;
  created_at: string;
}

type TabType = 'overview' | 'frameworks' | 'dsar' | 'audits' | 'records';

const STATUS_COLORS = {
  compliant: 'bg-emerald-500',
  in_progress: 'bg-blue-500',
  pending: 'bg-slate-400',
  non_compliant: 'bg-danger-500',
  not_applicable: 'bg-slate-300',
};

const DSAR_TYPE_LABELS = {
  access: 'Data Access',
  rectification: 'Rectification',
  erasure: 'Erasure',
  restriction: 'Restriction',
  portability: 'Data Portability',
  objection: 'Objection',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;

  return (
    Array.isArray(value.data) ||
    keys.some((key) => Array.isArray(value[key])) ||
    Boolean(
      data &&
      (Array.isArray(data.data) ||
        keys.some((key) => Array.isArray(data[key])) ||
        Boolean(nestedData && keys.some((key) => Array.isArray(nestedData[key]))))
    )
  );
};

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

export const ComplianceCenterView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus[]>([]);
  const [dsarRequests, setDsarRequests] = useState<DSAR[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [frameworksLoadError, setFrameworksLoadError] = useState<string | null>(null);
  const [dsarLoadError, setDsarLoadError] = useState<string | null>(null);
  const [auditsLoadError, setAuditsLoadError] = useState<string | null>(null);
  const [processingRecordsLoadError, setProcessingRecordsLoadError] = useState<string | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [processingRecords, setProcessingRecords] = useState<ProcessingRecord[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Modal states
  const [editControlModal, setEditControlModal] = useState<{ open: boolean; control: any } | null>(
    null
  );
  const [editControlForm, setEditControlForm] = useState({
    name: '',
    description: '',
    status: 'pending',
    category: '',
    priority: 'medium',
  });
  const [editControlSaving, setEditControlSaving] = useState(false);

  const [dsarCreateModal, setDsarCreateModal] = useState(false);
  const [dsarCreateForm, setDsarCreateForm] = useState({
    subjectName: '',
    requesterEmail: '',
    requestType: 'access',
    description: '',
  });
  const [dsarCreateSaving, setDsarCreateSaving] = useState(false);

  const [dsarViewModal, setDsarViewModal] = useState<{ open: boolean; dsar: any } | null>(null);
  const [dsarViewLoading, setDsarViewLoading] = useState(false);

  const [auditCreateModal, setAuditCreateModal] = useState(false);
  const [auditCreateForm, setAuditCreateForm] = useState({
    name: '',
    auditType: 'internal',
    scheduledDate: '',
    scope: '',
    auditor: '',
    frameworkId: '',
  });
  const [auditCreateSaving, setAuditCreateSaving] = useState(false);

  const [recordCreateModal, setRecordCreateModal] = useState(false);
  const [recordCreateForm, setRecordCreateForm] = useState({
    name: '',
    purpose: '',
    dataCategories: '',
    legalBasis: '',
    retentionPeriod: '',
  });
  const [recordCreateSaving, setRecordCreateSaving] = useState(false);

  const [exportingReport, setExportingReport] = useState(false);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const pct = (part: any, total: any) => {
    const t = Number(total);
    if (!Number.isFinite(t) || t <= 0) return 0;
    const p = Number(part);
    if (!Number.isFinite(p) || p <= 0) return 0;
    return Math.max(0, Math.min(100, (p / t) * 100));
  };

  const formatDate = (value: any, fallback = 'Unknown date') => {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
  };

  const formatDateTime = (value: any, fallback = 'Unknown date') => {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
  };

  const isOverdue = (value: any, status: string) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date < new Date() && status !== 'completed';
  };

  const getRecordId = (result: any, key: string) => {
    const payload = getObjectPayload(result) as any;
    return (
      payload?.id ||
      payload?.[key]?.id ||
      payload?.record?.id ||
      payload?.request?.id ||
      payload?.audit?.id
    );
  };

  const normalizeFrameworks = (raw: any[]): ComplianceFramework[] => {
    if (!Array.isArray(raw)) return [];
    // Support legacy response where frameworks were strings like "GDPR"
    return raw
      .map((fw: any) => {
        if (typeof fw === 'string') {
          const name = fw;
          const id = `fw_${String(fw).toLowerCase()}`;
          return {
            id,
            name,
            displayName: name,
            description: '',
            version: '',
            requirements: [],
          } as ComplianceFramework;
        }
        const id = String(fw?.id || '');
        const name = String(fw?.name || fw?.standard || fw?.code || fw?.id || '');
        const displayName = String(
          fw?.displayName || fw?.display_name || fw?.display_name || fw?.name || name || ''
        );
        const requirements = Array.isArray(fw?.requirements) ? fw.requirements : [];
        return {
          id,
          name,
          displayName,
          description: String(fw?.description || ''),
          version: String(fw?.version || ''),
          requirements,
        } as ComplianceFramework;
      })
      .filter((fw) => !!fw?.id);
  };

  const normalizeComplianceStatus = (raw: any, fw: ComplianceFramework): ComplianceStatus => {
    // Backend is expected to return { status: { ... } }, but some older paths returned a string.
    const obj = raw && typeof raw === 'object' ? raw : {};
    const frameworkId = String(obj.frameworkId || obj.framework_id || fw?.id || '');
    const frameworkName = String(
      obj.frameworkName || obj.framework_name || fw?.displayName || fw?.name || 'Unknown'
    );
    const total = Number(obj.total ?? (fw?.requirements || []).length) || 0;
    const compliant = Number(obj.compliant) || 0;
    const inProgress = Number(obj.inProgress ?? obj.in_progress) || 0;
    const nonCompliant = Number(obj.nonCompliant ?? obj.non_compliant) || 0;
    const pending =
      Number(obj.pending) || Math.max(0, total - compliant - inProgress - nonCompliant);
    const score = Number.isFinite(Number(obj.score))
      ? Number(obj.score)
      : total > 0
        ? Math.round((compliant / total) * 100)
        : 0;

    return {
      frameworkId,
      frameworkName,
      total,
      compliant,
      inProgress,
      pending,
      nonCompliant,
      score,
    };
  };

  const fetchDsarRequests = useCallback(async () => {
    try {
      const dsarResult = await Api.get('/superadmin/compliance/dsar');
      if (!hasListShape(dsarResult, ['requests', 'dsarRequests', 'items'])) {
        throw new Error('DSAR response was not a list');
      }
      const list = getListPayload<DSAR>(dsarResult, ['requests', 'dsarRequests', 'items']);
      setDsarRequests(list);
      setDsarLoadError(null);
      return list;
    } catch (error: unknown) {
      setDsarLoadError(normalizeApiErrorMessage(error, 'Failed to load data subject requests'));
      setDsarRequests([]);
      return null;
    }
  }, []);

  const fetchAudits = useCallback(async () => {
    try {
      const auditsResult = await Api.get('/superadmin/compliance/audits');
      if (!hasListShape(auditsResult, ['audits', 'items'])) {
        throw new Error('Compliance audits response was not a list');
      }
      const auditsList = getListPayload<Audit>(auditsResult, ['audits', 'items']);
      setAudits(auditsList);
      setAuditsLoadError(null);
      return auditsList;
    } catch (error: unknown) {
      setAuditsLoadError(normalizeApiErrorMessage(error, 'Failed to load compliance audits'));
      setAudits([]);
      return null;
    }
  }, []);

  const fetchProcessingRecords = useCallback(async () => {
    try {
      const prResult = await Api.get('/superadmin/compliance/processing-records');
      if (!hasListShape(prResult, ['records', 'processingRecords', 'items'])) {
        throw new Error('Processing records response was not a list');
      }
      const recordsList = getListPayload<ProcessingRecord>(prResult, [
        'records',
        'processingRecords',
        'items',
      ]);
      setProcessingRecords(recordsList);
      setProcessingRecordsLoadError(null);
      return recordsList;
    } catch (error: unknown) {
      setProcessingRecordsLoadError(
        normalizeApiErrorMessage(error, 'Failed to load processing records')
      );
      setProcessingRecords([]);
      return null;
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFrameworksLoadError(null);
    setDsarLoadError(null);
    setAuditsLoadError(null);
    setProcessingRecordsLoadError(null);
    try {
      const [frameworksResult, orgsResult] = await Promise.all([
        // Use non-/api path so `Api.get` prefixes API_URL (works with/without proxy).
        Api.get('/superadmin/compliance/frameworks').catch((e: any) => {
          const raw =
            e?.data?.error ||
            e?.data?.message ||
            e?.message ||
            'Failed to load compliance frameworks';
          const msg = typeof raw === 'string' ? raw : (raw as any)?.message || JSON.stringify(raw);
          setFrameworksLoadError(msg);
          return { frameworks: [] };
        }),
        Api.getOrganizations().catch(() => []),
      ]);
      if (!hasListShape(frameworksResult, ['frameworks', 'items'])) {
        setFrameworksLoadError('Compliance frameworks response was not a list');
        setFrameworks([]);
        setComplianceStatus([]);
      } else {
        const normalizedFrameworks = normalizeFrameworks(
          getListPayload<ComplianceFramework>(frameworksResult, ['frameworks', 'items'])
        );
        setFrameworks(normalizedFrameworks);

        // Fetch compliance status for each framework
        const statusPromises = normalizedFrameworks.map(async (fw: ComplianceFramework) => {
          try {
            const result = await Api.get(
              `/superadmin/compliance/status/${fw.id}${
                selectedOrg !== 'all' ? `?organizationId=${selectedOrg}` : ''
              }`
            );
            const statusPayload = getObjectPayload(result) as any;
            return normalizeComplianceStatus(statusPayload?.status ?? statusPayload, fw);
          } catch {
            return normalizeComplianceStatus(null, fw);
          }
        });
        const statusResults = await Promise.all(statusPromises);
        setComplianceStatus(statusResults);
      }
      setOrganizations(
        getListPayload<{ id: string; name: string }>(orgsResult, ['organizations', 'items'])
      );

      await fetchDsarRequests();
      await fetchAudits();
      await fetchProcessingRecords();
    } catch (error) {
      console.error('Failed to fetch compliance data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchAudits, fetchDsarRequests, fetchProcessingRecords, selectedOrg]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const overallScore =
    complianceStatus.length > 0
      ? Math.round(complianceStatus.reduce((sum, s) => sum + s.score, 0) / complianceStatus.length)
      : 0;

  const pendingDsars = dsarRequests.filter(
    (d) => d.status === 'pending' || d.status === 'in_progress'
  ).length;
  const overdueDoars = dsarRequests.filter((d) => isOverdue(d.dueDate, d.status)).length;
  const activeAudits = audits.filter((a) => a.status === 'in_progress').length;

  const handleEditControl = (_control: any) => {
    showNotice(
      'Control editing is unavailable: framework requirements are read-only until control persistence is connected.'
    );
  };

  const handleSaveControl = async () => {
    if (!editControlModal?.control) return;
    setEditControlSaving(true);
    try {
      await Api.put(
        `/superadmin/compliance/controls/${editControlModal.control.id}`,
        editControlForm
      );
      showNotice('Control updated successfully');
      setEditControlModal(null);
      await fetchData();
    } catch (error) {
      showNotice(normalizeApiErrorMessage(error, 'Failed to update control'));
    } finally {
      setEditControlSaving(false);
    }
  };

  const handleCreateDsar = async () => {
    if (!dsarCreateForm.requesterEmail || !dsarCreateForm.requestType) {
      showNotice('Email and request type are required');
      return;
    }
    setDsarCreateSaving(true);
    try {
      const result = await Api.post('/superadmin/compliance/dsar', dsarCreateForm);
      const createdId = getRecordId(result, 'request');
      if (!createdId) {
        throw new Error('DSAR creation response was incomplete');
      }
      const refreshed = await fetchDsarRequests();
      if (!refreshed?.some((request) => request.id === createdId)) {
        throw new Error('DSAR creation was not confirmed by the server');
      }
      showNotice('DSAR request created successfully');
      setDsarCreateModal(false);
      setDsarCreateForm({
        subjectName: '',
        requesterEmail: '',
        requestType: 'access',
        description: '',
      });
    } catch (error) {
      showNotice(normalizeApiErrorMessage(error, 'Failed to create DSAR request'));
    } finally {
      setDsarCreateSaving(false);
    }
  };

  const handleViewDsar = async (dsar: DSAR) => {
    setDsarViewLoading(true);
    setDsarViewModal({ open: true, dsar });
    try {
      const result = await Api.get(`/superadmin/compliance/dsar/${dsar.id}`);
      const payload = getObjectPayload(result) as any;
      setDsarViewModal({ open: true, dsar: payload?.request || payload || dsar });
    } catch (error) {
      showNotice(normalizeApiErrorMessage(error, 'Failed to load DSAR request details'));
    } finally {
      setDsarViewLoading(false);
    }
  };

  const handleCreateAudit = async () => {
    if (!auditCreateForm.name) {
      showNotice('Audit name is required');
      return;
    }
    setAuditCreateSaving(true);
    try {
      const result = await Api.post('/superadmin/compliance/audits', auditCreateForm);
      const createdId = getRecordId(result, 'audit');
      if (!createdId) {
        throw new Error('Audit schedule response was incomplete');
      }
      const refreshed = await fetchAudits();
      if (!refreshed?.some((audit) => audit.id === createdId)) {
        throw new Error('Audit schedule was not confirmed by the server');
      }
      showNotice('Audit scheduled successfully');
      setAuditCreateModal(false);
      setAuditCreateForm({
        name: '',
        auditType: 'internal',
        scheduledDate: '',
        scope: '',
        auditor: '',
        frameworkId: '',
      });
    } catch (error) {
      showNotice(normalizeApiErrorMessage(error, 'Failed to schedule audit'));
    } finally {
      setAuditCreateSaving(false);
    }
  };

  const handleCreateRecord = async () => {
    if (!recordCreateForm.name) {
      showNotice('Record name is required');
      return;
    }
    setRecordCreateSaving(true);
    try {
      const result = await Api.post('/superadmin/compliance/processing-records', recordCreateForm);
      const createdId = getRecordId(result, 'record');
      if (!createdId) {
        throw new Error('Processing record creation response was incomplete');
      }
      const refreshed = await fetchProcessingRecords();
      if (!refreshed?.some((record) => record.id === createdId)) {
        throw new Error('Processing record creation was not confirmed by the server');
      }
      showNotice('Processing record added successfully');
      setRecordCreateModal(false);
      setRecordCreateForm({
        name: '',
        purpose: '',
        dataCategories: '',
        legalBasis: '',
        retentionPeriod: '',
      });
    } catch (error) {
      showNotice(normalizeApiErrorMessage(error, 'Failed to add processing record'));
    } finally {
      setRecordCreateSaving(false);
    }
  };

  const handleExportReport = async () => {
    setExportingReport(true);
    try {
      const result = await Api.get('/superadmin/compliance/export');
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotice('Compliance report exported');
    } catch (error) {
      showNotice(normalizeApiErrorMessage(error, 'Failed to export report'));
    } finally {
      setExportingReport(false);
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">Overall Compliance</span>
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                overallScore >= 80
                  ? 'bg-emerald-500/10'
                  : overallScore >= 50
                    ? 'bg-amber-500/10'
                    : 'bg-danger-500/10'
              }`}
            >
              <Target
                className={
                  overallScore >= 80
                    ? 'text-emerald-500'
                    : overallScore >= 50
                      ? 'text-amber-500'
                      : 'text-danger-500'
                }
                size={20}
              />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {frameworksLoadError ? 'Unavailable' : `${overallScore}%`}
          </div>
          {frameworksLoadError ? (
            <div className="mt-1 text-sm text-amber-600">Framework source unavailable</div>
          ) : (
            <div className="mt-2 h-2 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  overallScore >= 80
                    ? 'bg-emerald-500'
                    : overallScore >= 50
                      ? 'bg-amber-500'
                      : 'bg-danger-500'
                }`}
                style={{ width: `${overallScore}%` }}
              />
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">Pending DSARs</span>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="text-blue-500" size={20} />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {dsarLoadError ? 'Unavailable' : pendingDsars}
          </div>
          {dsarLoadError ? (
            <div className="mt-1 text-sm text-amber-600">DSAR source unavailable</div>
          ) : overdueDoars > 0 ? (
            <div className="mt-1 text-sm text-danger-500 flex items-center gap-1">
              <AlertCircle size={14} />
              {overdueDoars} overdue
            </div>
          ) : null}
        </div>

        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">Active Audits</span>
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
              <FileCheck className="text-primary-500" size={20} />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {auditsLoadError ? 'Unavailable' : activeAudits}
          </div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {auditsLoadError ? 'Audit source unavailable' : `${audits.length} total`}
          </div>
        </div>

        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">Frameworks</span>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Shield className="text-emerald-500" size={20} />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {frameworksLoadError ? 'Unavailable' : frameworks.length}
          </div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {frameworksLoadError ? 'Framework source unavailable' : 'Active'}
          </div>
        </div>
      </div>

      {/* Framework Status */}
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Compliance by Framework
        </h3>
        {frameworksLoadError ? (
          <DegradedState
            title="Compliance frameworks unavailable"
            description={frameworksLoadError}
          />
        ) : (
          <div className="space-y-4">
            {complianceStatus.map((status) => (
              <div key={status.frameworkId} className="p-4 bg-slate-50 dark:bg-navy-900 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold">
                      {String(status?.frameworkName || 'U')
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white">
                        {status.frameworkName || 'Unknown'}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {Number(status.total) || 0} controls
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-2xl font-bold ${
                        status.score >= 80
                          ? 'text-emerald-600'
                          : status.score >= 50
                            ? 'text-amber-600'
                            : 'text-danger-600'
                      }`}
                    >
                      {Number(status.score) || 0}%
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFramework(status.frameworkId);
                        setActiveTab('frameworks');
                      }}
                      className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      View Details <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-1 h-2">
                  <div
                    className="bg-emerald-500 rounded-l"
                    style={{ width: `${pct(status.compliant, status.total)}%` }}
                  />
                  <div
                    className="bg-blue-500"
                    style={{ width: `${pct(status.inProgress, status.total)}%` }}
                  />
                  <div
                    className="bg-slate-300"
                    style={{ width: `${pct(status.pending, status.total)}%` }}
                  />
                  <div
                    className="bg-danger-500 rounded-r"
                    style={{ width: `${pct(status.nonCompliant, status.total)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />{' '}
                    {Number(status.compliant) || 0} Compliant
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />{' '}
                    {Number(status.inProgress) || 0} In Progress
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />{' '}
                    {Number(status.pending) || 0} Pending
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-danger-500" />{' '}
                    {Number(status.nonCompliant) || 0} Non-Compliant
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent DSARs */}
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Recent Data Subject Requests
          </h3>
          <button
            onClick={() => setActiveTab('dsar')}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            View All <ChevronRight size={14} />
          </button>
        </div>
        <div className="space-y-3">
          {dsarLoadError ? (
            <DegradedState title="Recent DSAR requests unavailable" description={dsarLoadError} />
          ) : (
            dsarRequests.slice(0, 5).map((dsar) => (
              <div
                key={dsar.id}
                className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-navy-700 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Users size={16} className="text-blue-500" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {dsar.requesterEmail}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {DSAR_TYPE_LABELS[dsar.requestType as keyof typeof DSAR_TYPE_LABELS] ||
                        dsar.requestType}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      dsar.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : dsar.status === 'in_progress'
                          ? 'bg-blue-500/10 text-blue-600'
                          : dsar.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-danger-500/10 text-danger-600'
                    }`}
                  >
                    {dsar.status.replace('_', ' ')}
                  </span>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Due: {formatDate(dsar.dueDate)}
                  </div>
                </div>
              </div>
            ))
          )}
          {!dsarLoadError && dsarRequests.length === 0 && (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p>No data subject requests</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderFrameworksTab = () => {
    const framework = selectedFramework ? frameworks.find((f) => f.id === selectedFramework) : null;

    if (framework) {
      const requirements = Array.isArray(framework.requirements) ? framework.requirements : [];
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedFramework(null)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
            >
              <ChevronRight size={20} className="rotate-180 text-slate-600 dark:text-slate-500" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {framework.displayName}
              </h2>
              <p className="text-slate-500 dark:text-slate-400">
                {framework.description} - Version {framework.version}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              Framework requirements are read-only here. Persisted DSAR, audit and processing
              records remain editable through their dedicated flows.
            </div>
            <table
              /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full"
            >
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-700">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    ID
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Control
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Category
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Status
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {requirements.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/20">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-slate-700 dark:text-slate-300">
                        {req.id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">{req.title}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {req.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400">
                        {req.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 dark:bg-navy-800/10 text-slate-600 dark:text-slate-400">
                        <Clock size={12} />
                        Pending
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEditControl(req)}
                        className="p-2 cursor-not-allowed opacity-60 rounded-lg"
                        title="Control editing unavailable until persisted controls are connected"
                      >
                        <Edit size={16} className="text-slate-600 dark:text-slate-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (frameworksLoadError) {
      return (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <DegradedState
            title="Compliance frameworks unavailable"
            description={frameworksLoadError}
          />
          <div className="mt-6 flex justify-center">
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-navy-700 dark:hover:bg-navy-600 dark:text-slate-200 rounded-lg font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    if (frameworks.length === 0) {
      return (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-10 text-center">
          <Shield size={40} className="mx-auto mb-3 text-slate-600 dark:text-slate-400" />
          <p className="text-slate-900 dark:text-white font-semibold">No compliance frameworks</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl mx-auto">
            This section lists available compliance standards (e.g., SOC 2, GDPR, HIPAA) so you can
            review their controls and see completion status per organization.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-navy-700 dark:hover:bg-navy-600 dark:text-slate-200 rounded-lg font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {frameworks.map((fw) => {
          const status = complianceStatus.find((s) => s.frameworkId === fw.id);
          const reqsCount = Array.isArray((fw as any)?.requirements)
            ? (fw as any).requirements.length
            : 0;
          return (
            <button
              key={fw.id}
              onClick={() => setSelectedFramework(fw.id)}
              className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 text-left hover:border-primary-300 dark:hover:border-primary-500/30 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-xl">
                    {(fw.displayName || fw.name || 'F').charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {fw.displayName}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Version {fw.version}
                    </p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-600 dark:text-slate-500" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{fw.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {reqsCount} controls
                </span>
                {status && (
                  <span
                    className={`text-lg font-bold ${
                      status.score >= 80
                        ? 'text-emerald-600'
                        : status.score >= 50
                          ? 'text-amber-600'
                          : 'text-danger-600'
                    }`}
                  >
                    {status.score}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderDsarTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
            size={18}
          />
          <input
            type="text"
            placeholder="Search requests..."
            disabled={!!dsarLoadError}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg"
          />
        </div>
        <button
          onClick={() => setDsarCreateModal(true)}
          disabled={!!dsarLoadError}
          className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={18} />
          New Request
        </button>
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        {dsarLoadError ? (
          <div className="p-6">
            <DegradedState title="DSAR requests unavailable" description={dsarLoadError} />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-navy-700">
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Requester
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Type
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Status
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Received
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Due Date
                </th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
              {dsarRequests.map((dsar) => (
                <tr key={dsar.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/20">
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {dsar.requesterEmail}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">
                      {DSAR_TYPE_LABELS[dsar.requestType as keyof typeof DSAR_TYPE_LABELS] ||
                        dsar.requestType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        dsar.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : dsar.status === 'in_progress'
                            ? 'bg-blue-500/10 text-blue-600'
                            : dsar.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-danger-500/10 text-danger-600'
                      }`}
                    >
                      {dsar.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {formatDate(dsar.receivedAt)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-sm ${
                        isOverdue(dsar.dueDate, dsar.status)
                          ? 'text-danger-600 font-medium'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {formatDate(dsar.dueDate)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleViewDsar(dsar)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
                    >
                      <Eye size={16} className="text-slate-600 dark:text-slate-500" />
                    </button>
                  </td>
                </tr>
              ))}
              {dsarRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Users size={40} className="mx-auto mb-3 text-slate-600" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                      No data subject requests
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderAuditsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setAuditCreateModal(true)}
          disabled={!!auditsLoadError}
          className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={18} />
          Schedule Audit
        </button>
      </div>

      {auditsLoadError ? (
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
          <DegradedState title="Compliance audits unavailable" description={auditsLoadError} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {audits.map((audit) => (
            <div
              key={audit.id}
              className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">{audit.name}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {audit.auditType} audit
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    audit.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : audit.status === 'in_progress'
                        ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {audit.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-4">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {formatDate(audit.plannedStart)} - {formatDate(audit.plannedEnd)}
                </span>
              </div>
              {audit.findingsCount > 0 && (
                <div className="p-3 bg-danger-50 dark:bg-danger-500/10 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={16} className="text-danger-500" />
                  <span className="text-sm text-danger-700 dark:text-danger-400">
                    {audit.findingsCount} findings
                  </span>
                </div>
              )}
            </div>
          ))}
          {audits.length === 0 && (
            <div className="col-span-2 text-center py-12 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
              <FileCheck size={40} className="mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">No audits scheduled</p>
              <p className="text-sm text-slate-600 dark:text-slate-500">
                Schedule your first compliance audit
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderRecordsTab = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-200 dark:border-blue-500/20">
        <div className="flex items-start gap-3">
          <FileText size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-300">
              GDPR Article 30 - Records of Processing Activities
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
              Document all data processing activities as required by GDPR Article 30.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setRecordCreateModal(true)}
          disabled={!!processingRecordsLoadError}
          className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={18} />
          Add Processing Record
        </button>
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        {processingRecordsLoadError ? (
          <div className="p-6">
            <DegradedState
              title="Processing records unavailable"
              description={processingRecordsLoadError}
            />
          </div>
        ) : processingRecords.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-navy-700">
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Name
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Purpose
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Legal Basis
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Retention
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
              {processingRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/20">
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                    {rec.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {rec.purpose}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">
                      {rec.legal_basis || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {rec.retention_period || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {formatDate(rec.created_at, '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <FileText size={40} className="mx-auto mb-3 text-slate-600" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">No processing records</p>
            <p className="text-sm text-slate-600 dark:text-slate-500">
              Document your data processing activities
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 relative">
      {notice && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-pulse">
          {notice}
        </div>
      )}
      <InfoButton cardId="superadmin-compliance" position="top-right" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Compliance Center</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage regulatory compliance and audits
          </p>
        </div>
        <div className="flex items-center gap-3">
          <InfoButton
            cardId="superadmin-compliance"
            position="header-inline"
            size="md"
            showLabel
            label="Help"
          />
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
          >
            <option value="all">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <button
            onClick={fetchData}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={handleExportReport}
            disabled={
              exportingReport ||
              !!frameworksLoadError ||
              !!dsarLoadError ||
              !!auditsLoadError ||
              !!processingRecordsLoadError
            }
            className="px-4 py-2 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/20 flex items-center gap-2 disabled:opacity-50"
          >
            {exportingReport ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Export Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-lg w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: <PieChart size={16} /> },
          { id: 'frameworks', label: 'Frameworks', icon: <Shield size={16} /> },
          { id: 'dsar', label: 'DSAR', icon: <Users size={16} /> },
          { id: 'audits', label: 'Audits', icon: <FileCheck size={16} /> },
          { id: 'records', label: 'Processing Records', icon: <FileText size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'frameworks' && renderFrameworksTab()}
          {activeTab === 'dsar' && renderDsarTab()}
          {activeTab === 'audits' && renderAuditsTab()}
          {activeTab === 'records' && renderRecordsTab()}
        </>
      )}

      {/* Edit Control Modal */}
      {editControlModal?.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-lg border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Control</h3>
              <button
                onClick={() => setEditControlModal(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg"
              >
                <X size={18} className="text-slate-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editControlForm.name}
                  onChange={(e) => setEditControlForm({ ...editControlForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editControlForm.description}
                  onChange={(e) =>
                    setEditControlForm({ ...editControlForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editControlForm.status}
                    onChange={(e) =>
                      setEditControlForm({ ...editControlForm, status: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="compliant">Compliant</option>
                    <option value="in_progress">In Progress</option>
                    <option value="non_compliant">Non-Compliant</option>
                    <option value="not_applicable">Not Applicable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={editControlForm.priority}
                    onChange={(e) =>
                      setEditControlForm({ ...editControlForm, priority: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={editControlForm.category}
                  onChange={(e) =>
                    setEditControlForm({ ...editControlForm, category: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditControlModal(null)}
                className="px-4 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveControl}
                disabled={editControlSaving}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {editControlSaving && <Loader2 size={16} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create DSAR Modal */}
      {dsarCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-lg border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">New DSAR Request</h3>
              <button
                onClick={() => setDsarCreateModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg"
              >
                <X size={18} className="text-slate-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject Name
                </label>
                <input
                  type="text"
                  value={dsarCreateForm.subjectName}
                  onChange={(e) =>
                    setDsarCreateForm({ ...dsarCreateForm, subjectName: e.target.value })
                  }
                  placeholder="Data subject's full name"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={dsarCreateForm.requesterEmail}
                  onChange={(e) =>
                    setDsarCreateForm({ ...dsarCreateForm, requesterEmail: e.target.value })
                  }
                  placeholder="requester@example.com"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Request Type *
                </label>
                <select
                  value={dsarCreateForm.requestType}
                  onChange={(e) =>
                    setDsarCreateForm({ ...dsarCreateForm, requestType: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="access">Data Access</option>
                  <option value="erasure">Erasure / Deletion</option>
                  <option value="rectification">Rectification</option>
                  <option value="portability">Data Portability</option>
                  <option value="restriction">Restriction</option>
                  <option value="objection">Objection</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={dsarCreateForm.description}
                  onChange={(e) =>
                    setDsarCreateForm({ ...dsarCreateForm, description: e.target.value })
                  }
                  placeholder="Details about the request..."
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDsarCreateModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDsar}
                disabled={dsarCreateSaving}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {dsarCreateSaving && <Loader2 size={16} className="animate-spin" />}
                Create Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View DSAR Modal */}
      {dsarViewModal?.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-2xl border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                DSAR Request Details
              </h3>
              <button
                onClick={() => setDsarViewModal(null)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg"
              >
                <X size={18} className="text-slate-600" />
              </button>
            </div>
            {dsarViewLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-primary-500" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
                      Request ID
                    </span>
                    <p className="text-slate-900 dark:text-white font-mono text-sm mt-1">
                      {dsarViewModal.dsar.id}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
                      Status
                    </span>
                    <p className="mt-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          dsarViewModal.dsar.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : dsarViewModal.dsar.status === 'in_progress'
                              ? 'bg-blue-500/10 text-blue-600'
                              : dsarViewModal.dsar.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-danger-500/10 text-danger-600'
                        }`}
                      >
                        {(dsarViewModal.dsar.status || 'pending').replace('_', ' ')}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
                      Requester
                    </span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1">
                      {dsarViewModal.dsar.requesterEmail}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
                      Subject Name
                    </span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1">
                      {dsarViewModal.dsar.subject_name || dsarViewModal.dsar.subjectName || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
                      Request Type
                    </span>
                    <p className="mt-1">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">
                        {DSAR_TYPE_LABELS[
                          dsarViewModal.dsar.requestType as keyof typeof DSAR_TYPE_LABELS
                        ] || dsarViewModal.dsar.requestType}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
                      Assigned To
                    </span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1">
                      {dsarViewModal.dsar.assignedTo || '—'}
                    </p>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
                    Description
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                    {dsarViewModal.dsar.description || '—'}
                  </p>
                </div>
                <div className="border-t border-slate-200 dark:border-navy-700 pt-4">
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
                    Timeline
                  </span>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        Received: {formatDateTime(dsarViewModal.dsar.receivedAt, '—')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${isOverdue(dsarViewModal.dsar.dueDate, dsarViewModal.dsar.status) ? 'bg-danger-500' : 'bg-amber-500'}`}
                      />
                      <span
                        className={`text-sm ${isOverdue(dsarViewModal.dsar.dueDate, dsarViewModal.dsar.status) ? 'text-danger-600 font-medium' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        Due: {formatDateTime(dsarViewModal.dsar.dueDate, '—')}
                      </span>
                    </div>
                    {dsarViewModal.dsar.completedAt && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Completed: {formatDateTime(dsarViewModal.dsar.completedAt, '—')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setDsarViewModal(null)}
                className="px-4 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Audit Modal */}
      {auditCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-lg border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Schedule Audit</h3>
              <button
                onClick={() => setAuditCreateModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg"
              >
                <X size={18} className="text-slate-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Audit Name *
                </label>
                <input
                  type="text"
                  value={auditCreateForm.name}
                  onChange={(e) => setAuditCreateForm({ ...auditCreateForm, name: e.target.value })}
                  placeholder="e.g. Q1 2026 SOC 2 Audit"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Audit Type
                  </label>
                  <select
                    value={auditCreateForm.auditType}
                    onChange={(e) =>
                      setAuditCreateForm({ ...auditCreateForm, auditType: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="internal">Internal</option>
                    <option value="external">External</option>
                    <option value="certification">Certification</option>
                    <option value="surveillance">Surveillance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={auditCreateForm.scheduledDate}
                    onChange={(e) =>
                      setAuditCreateForm({ ...auditCreateForm, scheduledDate: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Framework
                </label>
                <select
                  value={auditCreateForm.frameworkId}
                  onChange={(e) =>
                    setAuditCreateForm({ ...auditCreateForm, frameworkId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Select framework...</option>
                  {frameworks.map((fw) => (
                    <option key={fw.id} value={fw.id}>
                      {fw.displayName || fw.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Scope
                </label>
                <textarea
                  rows={2}
                  value={auditCreateForm.scope}
                  onChange={(e) =>
                    setAuditCreateForm({ ...auditCreateForm, scope: e.target.value })
                  }
                  placeholder="Audit scope description..."
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Auditor
                </label>
                <input
                  type="text"
                  value={auditCreateForm.auditor}
                  onChange={(e) =>
                    setAuditCreateForm({ ...auditCreateForm, auditor: e.target.value })
                  }
                  placeholder="Auditor name or firm"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setAuditCreateModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAudit}
                disabled={auditCreateSaving}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {auditCreateSaving && <Loader2 size={16} className="animate-spin" />}
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Processing Record Modal */}
      {recordCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-lg border border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Add Processing Record
              </h3>
              <button
                onClick={() => setRecordCreateModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg"
              >
                <X size={18} className="text-slate-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Processing Activity Name *
                </label>
                <input
                  type="text"
                  value={recordCreateForm.name}
                  onChange={(e) =>
                    setRecordCreateForm({ ...recordCreateForm, name: e.target.value })
                  }
                  placeholder="e.g. Customer Data Processing"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Purpose
                </label>
                <textarea
                  rows={2}
                  value={recordCreateForm.purpose}
                  onChange={(e) =>
                    setRecordCreateForm({ ...recordCreateForm, purpose: e.target.value })
                  }
                  placeholder="Purpose of processing..."
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Data Categories
                </label>
                <input
                  type="text"
                  value={recordCreateForm.dataCategories}
                  onChange={(e) =>
                    setRecordCreateForm({ ...recordCreateForm, dataCategories: e.target.value })
                  }
                  placeholder="e.g. Personal data, Financial data"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Legal Basis
                  </label>
                  <select
                    value={recordCreateForm.legalBasis}
                    onChange={(e) =>
                      setRecordCreateForm({ ...recordCreateForm, legalBasis: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="consent">Consent (Art. 6(1)(a))</option>
                    <option value="contract">Contract (Art. 6(1)(b))</option>
                    <option value="legal_obligation">Legal Obligation (Art. 6(1)(c))</option>
                    <option value="vital_interests">Vital Interests (Art. 6(1)(d))</option>
                    <option value="public_task">Public Task (Art. 6(1)(e))</option>
                    <option value="legitimate_interests">
                      Legitimate Interests (Art. 6(1)(f))
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Retention Period
                  </label>
                  <input
                    type="text"
                    value={recordCreateForm.retentionPeriod}
                    onChange={(e) =>
                      setRecordCreateForm({ ...recordCreateForm, retentionPeriod: e.target.value })
                    }
                    placeholder="e.g. 3 years"
                    className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setRecordCreateModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRecord}
                disabled={recordCreateSaving}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {recordCreateSaving && <Loader2 size={16} className="animate-spin" />}
                Add Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceCenterView;
