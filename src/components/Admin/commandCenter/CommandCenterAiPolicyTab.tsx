/**
 * Command Center — "Polityka AI" (F-CC4, blok Harvey-Parity HP-10…13).
 *
 * Odczyt + formularz PUT dla `orgAiPolicyService` — tryb cytowań, limity
 * tokenów, listy tematów/narzędzi/modeli. `customSafetyRules` (tablica
 * {name,pattern,action}) pokazana tylko do odczytu w tej dostawie — pełny
 * CRUD sub-formularza to kandydat na F-CC5.
 *
 * Endpointy: getAiPolicy · setAiPolicy.
 */
import { Loader2, Save } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  getAiPolicy,
  type OrgAiPolicy,
  setAiPolicy,
} from '../../../services/enterpriseComplianceApi';
import { EmptyState, LoadingState } from '../../shared/states';

const CITATION_MODES: OrgAiPolicy['requiredCitationMode'][] = [
  'none',
  'recommended',
  'required',
  'strict',
];

const inputClass =
  'w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus focus:outline-none focus:ring-1 focus:ring-c-focus';
const selectClass = inputClass;

const toCsv = (values: string[] | undefined | null): string => (values || []).join(', ');
const fromCsv = (value: string): string[] =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
const toLines = (values: string[] | undefined | null): string => (values || []).join('\n');
const fromLines = (value: string): string[] =>
  value
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);

export const CommandCenterAiPolicyTab: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<OrgAiPolicy | null>(null);

  const [citationMode, setCitationMode] =
    useState<OrgAiPolicy['requiredCitationMode']>('recommended');
  const [maxTokensPerMessage, setMaxTokensPerMessage] = useState(4000);
  const [maxTokensPerConversation, setMaxTokensPerConversation] = useState(64000);
  const [allowedTopicsText, setAllowedTopicsText] = useState('');
  const [blockedTopicsText, setBlockedTopicsText] = useState('');
  const [disclaimersText, setDisclaimersText] = useState('');
  const [blockedToolsText, setBlockedToolsText] = useState('');
  const [allowedModelsText, setAllowedModelsText] = useState('');
  const [dataResidencyRegion, setDataResidencyRegion] = useState('');
  const [enforceEuOnly, setEnforceEuOnly] = useState(false);

  const applyPolicy = (p: OrgAiPolicy) => {
    setPolicy(p);
    setCitationMode(p.requiredCitationMode || 'recommended');
    setMaxTokensPerMessage(p.maxTokensPerMessage ?? 4000);
    setMaxTokensPerConversation(p.maxTokensPerConversation ?? 64000);
    setAllowedTopicsText(toCsv(p.allowedTopics));
    setBlockedTopicsText(toCsv(p.blockedTopics));
    setDisclaimersText(toLines(p.mandatoryDisclaimers));
    setBlockedToolsText(toCsv(p.blockedTools));
    setAllowedModelsText(toCsv(p.allowedModels));
    setDataResidencyRegion(p.dataResidencyRegion || '');
    setEnforceEuOnly(!!p.enforceEuOnly);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAiPolicy();
      applyPolicy(data);
    } catch (err: any) {
      setError(
        err?.message || t('commandCenter.aiPolicy.toasts.loadError', 'Failed to load AI policy')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await setAiPolicy({
        requiredCitationMode: citationMode,
        maxTokensPerMessage,
        maxTokensPerConversation,
        allowedTopics: fromCsv(allowedTopicsText),
        blockedTopics: fromCsv(blockedTopicsText),
        mandatoryDisclaimers: fromLines(disclaimersText),
        blockedTools: fromCsv(blockedToolsText),
        allowedModels: fromCsv(allowedModelsText),
        dataResidencyRegion: dataResidencyRegion.trim() || null,
        enforceEuOnly,
      });
      applyPolicy(updated);
      toast.success(t('commandCenter.aiPolicy.toasts.saved', 'AI policy updated'));
    } catch (err: any) {
      toast.error(
        err?.message || t('commandCenter.aiPolicy.toasts.saveError', 'Failed to update AI policy')
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState template="panel" />;
  }

  if (error && !policy) {
    return (
      <EmptyState
        variant="error"
        title={error}
        primaryAction={{ label: 'Retry', onClick: () => void load() }}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-c-border bg-c-surface p-5">
      <h3 className="text-base font-semibold text-c-text">
        {t('commandCenter.aiPolicy.title', 'Organization AI policy')}
      </h3>
      <p className="mt-1 text-sm text-c-text-secondary">
        {t(
          'commandCenter.aiPolicy.description',
          'Citation requirements, token limits, and safety controls applied to every conversation in this organization.'
        )}
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-c-text-secondary">
            {t('commandCenter.aiPolicy.fields.citationMode', 'Required citation mode')}
          </label>
          <select
            className={selectClass}
            value={citationMode}
            onChange={(e) => setCitationMode(e.target.value as OrgAiPolicy['requiredCitationMode'])}
          >
            {CITATION_MODES.map((v) => (
              <option key={v} value={v}>
                {t(`commandCenter.aiPolicy.fields.citationModeOptions.${v}`, v)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-c-text">
            <input
              type="checkbox"
              checked={enforceEuOnly}
              onChange={(e) => setEnforceEuOnly(e.target.checked)}
              className="h-4 w-4 rounded border-c-border text-c-text focus:ring-c-focus"
            />
            {t('commandCenter.aiPolicy.fields.enforceEuOnly', 'Enforce EU-only processing')}
          </label>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-c-text-secondary">
            {t('commandCenter.aiPolicy.fields.maxTokensPerMessage', 'Max tokens per message')}
          </label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={maxTokensPerMessage}
            onChange={(e) => setMaxTokensPerMessage(Number(e.target.value || 0))}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-c-text-secondary">
            {t(
              'commandCenter.aiPolicy.fields.maxTokensPerConversation',
              'Max tokens per conversation'
            )}
          </label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={maxTokensPerConversation}
            onChange={(e) => setMaxTokensPerConversation(Number(e.target.value || 0))}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-c-text-secondary">
            {t('commandCenter.aiPolicy.fields.dataResidencyRegion', 'Data residency region')}
          </label>
          <input
            className={inputClass}
            value={dataResidencyRegion}
            onChange={(e) => setDataResidencyRegion(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-c-text-secondary">
            {t('commandCenter.aiPolicy.fields.allowedModels', 'Allowed models (comma-separated)')}
          </label>
          <input
            className={inputClass}
            value={allowedModelsText}
            onChange={(e) => setAllowedModelsText(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-c-text-secondary">
            {t('commandCenter.aiPolicy.fields.allowedTopics', 'Allowed topics (comma-separated)')}
          </label>
          <input
            className={inputClass}
            value={allowedTopicsText}
            onChange={(e) => setAllowedTopicsText(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-c-text-secondary">
            {t('commandCenter.aiPolicy.fields.blockedTopics', 'Blocked topics (comma-separated)')}
          </label>
          <input
            className={inputClass}
            value={blockedTopicsText}
            onChange={(e) => setBlockedTopicsText(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-c-text-secondary">
            {t('commandCenter.aiPolicy.fields.blockedTools', 'Blocked tools (comma-separated)')}
          </label>
          <input
            className={inputClass}
            value={blockedToolsText}
            onChange={(e) => setBlockedToolsText(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-c-text-secondary">
            {t(
              'commandCenter.aiPolicy.fields.mandatoryDisclaimers',
              'Mandatory disclaimers (one per line)'
            )}
          </label>
          <textarea
            rows={3}
            className={inputClass}
            value={disclaimersText}
            onChange={(e) => setDisclaimersText(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-c-border bg-c-surface-raised p-4">
        <h4 className="text-sm font-semibold text-c-text">
          {t('commandCenter.aiPolicy.customSafetyRules.title', 'Custom safety rules')}
        </h4>
        <p className="mt-1 text-xs text-c-text-secondary">
          {t(
            'commandCenter.aiPolicy.customSafetyRules.description',
            'Read-only in this view — {{count}} rule(s) configured.',
            { count: policy?.customSafetyRules?.length || 0 }
          )}
        </p>
        {policy?.customSafetyRules?.length ? (
          <ul className="mt-2 space-y-1 text-xs text-c-text-secondary">
            {policy.customSafetyRules.map((rule, idx) => (
              <li key={`${rule.name}-${idx}`}>
                <span className="font-medium text-c-text">{rule.name}</span> —{' '}
                <code className="rounded bg-c-surface px-1 py-0.5">{rule.pattern}</code> (
                {rule.action})
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-c-text-muted">
            {t(
              'commandCenter.aiPolicy.customSafetyRules.empty',
              'No custom safety rules configured.'
            )}
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text px-4 py-2 text-sm font-medium text-c-bg hover:bg-c-text-secondary disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('commandCenter.aiPolicy.actions.save', 'Save policy')}
        </button>
      </div>
    </div>
  );
};

export default CommandCenterAiPolicyTab;
