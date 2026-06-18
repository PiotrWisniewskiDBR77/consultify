/**
 * Customer Health View
 */

import { Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

type OrganizationRow = {
  id: string;
  name: string;
};

type CustomerHealth = {
  overall_health?: unknown;
  overallHealth?: unknown;
  churn_risk?: unknown;
  engagement_level?: unknown;
  engagementLevel?: unknown;
  engagement_score?: string | number;
  adoption_score?: unknown;
  open_tickets_count?: unknown;
  openTicketsCount?: unknown;
  risk_factors?: string[];
  opportunities?: string[];
};

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

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

  return (
    'data' in value ||
    keys.some((key) => key in value) ||
    Boolean(data && keys.some((key) => key in data))
  );
};

const asText = (value: unknown, fallback: string) =>
  value === null || value === undefined || value === '' ? fallback : String(value);

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const CustomerHealthView: React.FC = () => {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [health, setHealth] = useState<CustomerHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    try {
      const orgs = await Api.getOrganizations();
      if (!hasListShape(orgs, ['organizations', 'items'])) {
        throw new Error('Organizations response was not a list');
      }
      const normalizedOrgs = getListPayload<OrganizationRow>(orgs, ['organizations', 'items']);
      setOrganizations(normalizedOrgs);
      setSelectedOrgId((current) => current || normalizedOrgs[0]?.id || '');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch organizations');
      setLoadError(message);
      toast.error(message);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    if (!selectedOrgId) return null;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await Api.getCustomerHealthCheck(selectedOrgId);
      const payload = getObjectPayload(data);
      if (!isRecord(payload)) {
        throw new Error('Customer health response was missing health data');
      }
      setHealth(payload as CustomerHealth);
      return payload as CustomerHealth;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch customer health');
      setHealth(null);
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    if (selectedOrgId) {
      void fetchHealth();
    }
  }, [selectedOrgId, fetchHealth]);

  const getHealthColor = (healthLevel: string) => {
    switch (healthLevel?.toLowerCase()) {
      case 'excellent':
        return 'text-green-700 dark:text-green-400';
      case 'good':
        return 'text-green-700 dark:text-green-300';
      case 'fair':
        return 'text-yellow-800 dark:text-yellow-400';
      case 'poor':
        return 'text-danger-700 dark:text-danger-400';
      default:
        return 'text-slate-700 dark:text-slate-400';
    }
  };

  const overallHealth = asText(health?.overall_health || health?.overallHealth, 'N/A');
  const engagement = asText(
    health?.engagement_level || health?.engagementLevel || health?.engagement_score,
    'N/A'
  );
  const churnRisk = asText(health?.churn_risk, 'N/A');
  const adoptionScore =
    health?.adoption_score === null || health?.adoption_score === undefined
      ? null
      : safeNumber(health.adoption_score, Number.NaN);
  const openTickets = safeNumber(health?.open_tickets_count ?? health?.openTicketsCount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Customer Health</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Monitor customer health and engagement
          </p>
        </div>
        <select
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
        >
          <option value="">Select Organization</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      {loadError && <DegradedState title="Customer health unavailable" description={loadError} />}

      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : loadError ? null : health ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-500 dark:text-slate-400 text-sm">Overall Health</h3>
              <Activity className="text-primary-400" size={20} />
            </div>
            <div className={`text-3xl font-bold ${getHealthColor(overallHealth)}`}>
              {overallHealth}
            </div>
            {churnRisk !== 'N/A' && (
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Churn Risk:{' '}
                <span className="text-yellow-800 dark:text-yellow-400">{churnRisk}</span>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-500 dark:text-slate-400 text-sm">Engagement</h3>
              <TrendingUp className="text-green-400" size={20} />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{engagement}</div>
            {adoptionScore !== null && Number.isFinite(adoptionScore) && (
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Adoption Score:{' '}
                <span className="text-green-700 dark:text-green-400">{adoptionScore}%</span>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-500 dark:text-slate-400 text-sm">Support</h3>
              <AlertTriangle className="text-yellow-400" size={20} />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{openTickets}</div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">Open Tickets</div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          No health data available. Health checks are calculated automatically.
        </div>
      )}
    </div>
  );
};
