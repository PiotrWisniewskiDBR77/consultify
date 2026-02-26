/**
 * OrgAIPolicyTab - Configuration > Org AI Policy (enterprise)
 *
 * Minimal editor:
 * - pick organizationId
 * - load policy JSON
 * - edit JSON
 * - save
 */
import { RefreshCw, Save, Shield } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

export const OrgAIPolicyTab: React.FC = () => {
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [raw, setRaw] = useState(
    '{\n  "deny_provider_types": ["aggregator"],\n  "require_local_for_data_classes": ["confidential"]\n}'
  );
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [raw]);

  const loadPolicy = async () => {
    const id = String(orgId || '').trim();
    if (!id) {
      toast.error('organizationId is required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/llm/org/${encodeURIComponent(id)}/policy`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load policy');
      const rawPolicy = json?.policy?.policy ?? json?.policy ?? {};
      let policyObj: any = rawPolicy;
      if (typeof rawPolicy === 'string') {
        try {
          policyObj = JSON.parse(rawPolicy);
        } catch {
          policyObj = {};
        }
      }
      setRaw(JSON.stringify(policyObj || {}, null, 2));
      setLastLoadedAt(new Date().toISOString());
      toast.success('Policy loaded');
    } catch (e: any) {
      toast.error(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  const savePolicy = async () => {
    const id = String(orgId || '').trim();
    if (!id) {
      toast.error('organizationId is required');
      return;
    }
    if (!parsed) {
      toast.error('Invalid JSON');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/llm/org/${encodeURIComponent(id)}/policy`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ policy: parsed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      toast.success('Policy saved');
      setLastLoadedAt(new Date().toISOString());
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    // No auto-load; orgId is required.
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield size={22} className="text-indigo-500" />
            Org AI Policy
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise policy enforcement: regions, provider types, origins, and data classes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPolicy}
            disabled={loading || saving}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Load
          </button>
          <button
            onClick={savePolicy}
            disabled={loading || saving || !parsed}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors flex items-center gap-2"
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              organizationId
            </label>
            <input
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="org id"
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-end">
            {lastLoadedAt ? (
              <span>Last load/save: {lastLoadedAt}</span>
            ) : (
              <span>Not loaded yet.</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Policy JSON</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {parsed ? 'Valid JSON' : 'Invalid JSON'}
          </div>
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          spellCheck={false}
          className="w-full h-[420px] p-4 font-mono text-xs bg-white dark:bg-navy-900 text-slate-900 dark:text-slate-100 outline-none"
        />
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        Tip: to enforce enterprise rules, set backend flags:{' '}
        <span className="font-mono">LLM_ORG_POLICY=1</span>.
      </div>
    </div>
  );
};

export default OrgAIPolicyTab;
