/**
 * CompetencyRequirementsSection (T065)
 *
 * Displays and manages competency requirements for an initiative.
 * Uses InlineTable pattern: "Add requirement" + table of requirements.
 */

import { AlertCircle, BookOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

interface Requirement {
  id: string;
  capabilityId: string;
  capabilityName: string;
  categoryName: string | null;
  minLevel: number;
  priority: 'required' | 'nice_to_have';
  headcount: number | null;
  justification: string | null;
  notes: string | null;
}

interface Competency {
  id: string;
  name: string;
  categoryName: string | null;
}

interface Level {
  levelValue: number;
  label: string;
  labelPl: string | null;
}

const API_URL = '/api';

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token') || '';
  const res = await fetch(`${API_URL}${url}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const CompetencyRequirementsSection: React.FC<InitiativeSectionProps> = () => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  const { initiativeId, readonly } = useInitiativeContext();

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [newCapId, setNewCapId] = useState('');
  const [newMinLevel, setNewMinLevel] = useState(3);
  const [newPriority, setNewPriority] = useState<'required' | 'nice_to_have'>('required');
  const [newHeadcount, setNewHeadcount] = useState('');
  const [newJustification, setNewJustification] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [reqRes, compRes, lvlRes] = await Promise.all([
        apiFetch<{ requirements: Requirement[] }>(
          `/competency/initiatives/${initiativeId}/requirements`
        ),
        apiFetch<{ competencies: Competency[] }>('/competency/competencies'),
        apiFetch<{ levels: Level[] }>('/competency/levels'),
      ]);
      setRequirements(reqRes.requirements);
      setCompetencies(compRes.competencies);
      setLevels(lvlRes.levels);
    } catch {
      // silent — section may not have data yet
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    if (initiativeId) loadData();
  }, [initiativeId, loadData]);

  const handleAdd = useCallback(async () => {
    if (!newCapId) {
      toast.error(t('competency.requirements.selectCompetency', 'Select a competency'));
      return;
    }
    try {
      await apiFetch(`/competency/initiatives/${initiativeId}/requirements`, {
        method: 'POST',
        body: JSON.stringify({
          capabilityId: newCapId,
          minLevel: newMinLevel,
          priority: newPriority,
          headcount: newHeadcount ? parseFloat(newHeadcount) : undefined,
          justification: newJustification || undefined,
        }),
      });
      trackFunnelEvent('initiative_requirement_added', {
        initiativeId,
        capabilityId: newCapId,
        priority: newPriority,
      });
      setNewCapId('');
      setNewMinLevel(3);
      setNewPriority('required');
      setNewHeadcount('');
      setNewJustification('');
      setShowAdd(false);
      loadData();
    } catch {
      toast.error(t('competency.requirements.addFailed', 'Failed to add requirement'));
    }
  }, [initiativeId, newCapId, newMinLevel, newPriority, newHeadcount, newJustification, loadData, t]);

  const handleDelete = useCallback(
    async (reqId: string) => {
      try {
        await apiFetch(`/competency/initiatives/${initiativeId}/requirements/${reqId}`, {
          method: 'DELETE',
        });
        trackFunnelEvent('initiative_requirement_removed', { initiativeId, requirementId: reqId });
        loadData();
      } catch {
        toast.error(t('competency.requirements.deleteFailed', 'Failed to remove requirement'));
      }
    },
    [initiativeId, loadData, t]
  );

  const getLevelLabel = (value: number) => {
    const lvl = levels.find((l) => l.levelValue === value);
    if (!lvl) return `${value}`;
    return isPl && lvl.labelPl ? `${value} — ${lvl.labelPl}` : `${value} — ${lvl.label}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-purple-500" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-purple-500" />
          <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
            {t('competency.requirements.title', 'Competency Requirements')}
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            ({requirements.length})
          </span>
        </div>
        {!readonly && (
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 dark:text-purple-400 font-medium"
          >
            <Plus size={14} />
            {t('competency.requirements.add', 'Add Requirement')}
          </button>
        )}
      </div>

      {/* Empty state callout */}
      {requirements.length === 0 && !showAdd && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              {t('competency.requirements.empty', 'No competency requirements defined')}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              {t(
                'competency.requirements.emptyHint',
                'Define what competencies this initiative needs so the team can be properly resourced.'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t('competency.requirements.competency', 'Competency')} *
              </label>
              <select
                value={newCapId}
                onChange={(e) => setNewCapId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white"
              >
                <option value="">{t('competency.requirements.select', '— Select —')}</option>
                {competencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.categoryName ? `(${c.categoryName})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t('competency.requirements.minLevel', 'Min. Level')}
              </label>
              <select
                value={newMinLevel}
                onChange={(e) => setNewMinLevel(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white"
              >
                {(levels.length > 0
                  ? levels.map((l) => l.levelValue)
                  : [1, 2, 3, 4, 5]
                ).map((v) => (
                  <option key={v} value={v}>
                    {getLevelLabel(v)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t('competency.requirements.priority', 'Priority')}
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as 'required' | 'nice_to_have')}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white"
              >
                <option value="required">
                  {t('competency.requirements.mustHave', 'Must-have')}
                </option>
                <option value="nice_to_have">
                  {t('competency.requirements.niceToHave', 'Nice-to-have')}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t('competency.requirements.headcount', 'Headcount / FTE')}
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={newHeadcount}
                onChange={(e) => setNewHeadcount(e.target.value)}
                placeholder="e.g. 2.0"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t('competency.requirements.justification', 'Justification')}
              </label>
              <input
                value={newJustification}
                onChange={(e) => setNewJustification(e.target.value)}
                placeholder={t('competency.requirements.justificationPlaceholder', 'Why needed?')}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 font-medium"
            >
              {t('competency.requirements.addBtn', 'Add')}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 text-sm rounded-lg"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Requirements table */}
      {requirements.length > 0 && (
        <div className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
                  {t('competency.table.name', 'Competency')}
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
                  {t('competency.table.category', 'Category')}
                </th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
                  {t('competency.requirements.minLevel', 'Min Level')}
                </th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
                  {t('competency.requirements.priority', 'Priority')}
                </th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
                  {t('competency.requirements.headcount', 'FTE')}
                </th>
                {!readonly && (
                  <th className="w-8 px-3 py-2" />
                )}
              </tr>
            </thead>
            <tbody>
              {requirements.map((req) => (
                <tr
                  key={req.id}
                  className="border-b border-slate-100 dark:border-navy-800 last:border-0"
                >
                  <td className="px-3 py-2">
                    <span className="font-medium text-navy-900 dark:text-white text-xs">
                      {req.capabilityName}
                    </span>
                    {req.justification && (
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">
                        {req.justification}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {req.categoryName ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400">
                        {req.categoryName}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="text-center px-3 py-2">
                    <span className="text-xs font-mono text-navy-900 dark:text-white">
                      {req.minLevel}/5
                    </span>
                  </td>
                  <td className="text-center px-3 py-2">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        req.priority === 'required'
                          ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {req.priority === 'required'
                        ? t('competency.requirements.mustHave', 'Must-have')
                        : t('competency.requirements.niceToHave', 'Nice-to-have')}
                    </span>
                  </td>
                  <td className="text-center px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                    {req.headcount != null ? req.headcount : '—'}
                  </td>
                  {!readonly && (
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDelete(req.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CompetencyRequirementsSection;
