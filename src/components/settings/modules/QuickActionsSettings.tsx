/**
 * QuickActionsSettings - Quick Actions Configuration
 */

import { Command, Grip, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';

interface QuickActionsSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface QuickAction {
  id: string;
  label: string;
  shortcut: string;
  action: string;
  enabled: boolean;
}

export const QuickActionsSettings: React.FC<QuickActionsSettingsProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [commandPaletteEnabled, setCommandPaletteEnabled] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setActions([
        { id: '1', label: 'New Task', shortcut: 'N T', action: 'create_task', enabled: true },
        { id: '2', label: 'New Project', shortcut: 'N P', action: 'create_project', enabled: true },
        { id: '3', label: 'Quick Note', shortcut: 'N N', action: 'create_note', enabled: true },
        { id: '4', label: 'Search', shortcut: 'Cmd+K', action: 'open_search', enabled: true },
        { id: '5', label: 'Go to Inbox', shortcut: 'G I', action: 'go_inbox', enabled: false },
      ]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.put('/api/user/quick-actions', { actions, commandPaletteEnabled });
      toast.success('Quick actions saved');
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Command size={28} className="text-blue-500" />
            Quick Actions
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            Configure command palette and quick actions
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save
        </button>
      </div>

      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Search size={20} className="text-blue-500" />
            <div>
              <p className="font-medium text-c-text">Command Palette</p>
              <p className="text-sm text-c-text-muted">Quick access with Cmd+K</p>
            </div>
          </div>
          <button
            onClick={() => setCommandPaletteEnabled(!commandPaletteEnabled)}
            className={`relative w-12 h-6 rounded-full ${commandPaletteEnabled ? 'bg-blue-600' : 'bg-c-surface-raised'}`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow ${commandPaletteEnabled ? 'left-7' : 'left-1'}`}
            />
          </button>
        </div>
      </div>

      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4">Quick Actions</h3>
        <div className="space-y-2">
          {actions.map((action, i) => (
            <div
              key={action.id}
              className={`flex items-center justify-between p-3 rounded-lg ${action.enabled ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-c-surface-raised opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                <Grip size={16} className="text-c-text-secondary cursor-grab" />
                <span className="font-medium text-c-text">{action.label}</span>
                <kbd className="px-2 py-0.5 bg-c-surface-raised rounded text-xs font-mono">
                  {action.shortcut}
                </kbd>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setActions(actions.map((a, j) => (j === i ? { ...a, enabled: !a.enabled } : a)))
                  }
                  className={`relative w-10 h-5 rounded-full ${action.enabled ? 'bg-blue-600' : 'bg-c-surface-raised'}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-c-surface shadow ${action.enabled ? 'left-5' : 'left-0.5'}`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActionsSettings;
