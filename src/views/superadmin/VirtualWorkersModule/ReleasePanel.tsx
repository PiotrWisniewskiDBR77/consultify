import { CheckCircle2, RefreshCw, Rocket, Send } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../../services/api';

interface Release {
  id: string;
  profile_id: string | null;
  evaluation_id: string | null;
  release_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  activated_at: string | null;
}

interface ReleasePanelProps {
  workerId: string;
  profileId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  ready: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  rolled_back: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const ReleasePanel: React.FC<ReleasePanelProps> = ({ workerId, profileId }) => {
  const [items, setItems] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await Api.get(`/api/virtual-workers/${workerId}/releases`);
      const payload = response?.data?.data ?? response?.data;
      setItems(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error('Failed to fetch releases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [workerId]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await Api.post(`/api/virtual-workers/${workerId}/releases`, {
        profile_id: profileId || null,
        release_type: 'profile',
        status,
        notes: notes.trim() || null,
        payload_json: {
          created_from: 'virtual_workers_superadmin',
        },
      });
      setNotes('');
      setStatus('draft');
      fetchItems();
    } catch (err) {
      console.error('Failed to create release:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (releaseId: string) => {
    try {
      await Api.post(`/api/virtual-workers/${workerId}/releases/${releaseId}/activate`, {});
      fetchItems();
    } catch (err) {
      console.error('Failed to activate release:', err);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Release Control</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Create governed release entries and activate a verified worker version.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
          >
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="rolled_back">Rolled Back</option>
          </select>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Release notes"
            className="md:col-span-2 px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
        >
          <Send size={14} />
          {saving ? 'Creating...' : 'Create Release'}
        </button>
      </section>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Rocket className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No releases yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-5 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {item.release_type} release
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {new Date(item.created_at).toLocaleString()}
                  {item.notes ? ` · ${item.notes}` : ''}
                </p>
                {item.activated_at && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    Activated {new Date(item.activated_at).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] || STATUS_COLORS.draft}`}
                >
                  {item.status}
                </span>
                {item.status !== 'active' && (
                  <button
                    onClick={() => handleActivate(item.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={13} />
                    Activate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
