/**
 * ConfigurationPanel - System Configuration Management
 */

import { Edit, Loader2, Plus, Save, Settings, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

export const ConfigurationPanel: React.FC = () => {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>('');

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const data = await (Api as any).getSystemConfigs();
      setConfigs(data);
    } catch (error) {
      console.error('Failed to fetch configs:', error);
      toast.error('Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, value: any, configType: string) => {
    try {
      await (Api as any).setSystemConfig({
        config_key: key,
        config_value: value,
        config_type: configType,
      });
      toast.success('Configuration saved');
      setEditingKey(null);
      fetchConfigs();
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text mb-2">System Configuration</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm">Manage system-wide settings</p>
        </div>
      </div>

      <div className="space-y-2">
        {configs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            No configurations
          </div>
        ) : (
          configs.map((config) => (
            <div
              key={config.config_key}
              className="p-4 bg-slate-50/30 dark:bg-navy-950/20 rounded-xl border border-c-border-subtle"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-c-text font-medium">{config.config_key}</span>
                    <span className="px-2 py-1 text-xs bg-c-surface-raised text-slate-300 rounded">
                      {config.config_type}
                    </span>
                    {config.environment && (
                      <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded">
                        {config.environment}
                      </span>
                    )}
                  </div>
                  {config.description && (
                    <p className="text-sm text-slate-400 dark:text-slate-500 mb-2">
                      {config.description}
                    </p>
                  )}
                  {editingKey === config.config_key ? (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type={config.config_type === 'number' ? 'number' : 'text'}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50/30 dark:bg-navy-950/20 border border-c-border-subtle rounded-lg text-c-text"
                      />
                      <button
                        onClick={() => handleSave(config.config_key, editValue, config.config_type)}
                        className="p-2 bg-green-600 hover:bg-green-700 rounded-lg"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={() => setEditingKey(null)}
                        className="p-2 bg-c-surface-raised hover:bg-slate-600 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-300">
                      {typeof config.config_value === 'object'
                        ? JSON.stringify(config.config_value)
                        : String(config.config_value)}
                    </p>
                  )}
                </div>
                {editingKey !== config.config_key && (
                  <button
                    onClick={() => {
                      setEditingKey(config.config_key);
                      setEditValue(config.config_value);
                    }}
                    className="p-2 rounded-lg bg-c-surface-raised text-slate-300 hover:bg-slate-600 transition-colors"
                  >
                    <Edit size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConfigurationPanel;
