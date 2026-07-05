/**
 * DataGovernancePanel - Data governance and retention settings
 */

import { AlertTriangle, Clock, Database, Shield } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

interface RetentionPolicy {
  dataType: string;
  retentionDays: number;
  autoDelete: boolean;
}

export const DataGovernancePanel: React.FC = () => {
  const [policies, setPolicies] = useState<RetentionPolicy[]>([
    { dataType: 'Audit Logs', retentionDays: 365, autoDelete: false },
    { dataType: 'User Sessions', retentionDays: 90, autoDelete: true },
    { dataType: 'AI Conversations', retentionDays: 180, autoDelete: false },
    { dataType: 'Temporary Files', retentionDays: 7, autoDelete: true },
  ]);

  const updatePolicy = (index: number, updates: Partial<RetentionPolicy>) => {
    const newPolicies = [...policies];
    newPolicies[index] = { ...newPolicies[index], ...updates };
    setPolicies(newPolicies);
    toast.success('Policy updated');
  };

  return (
    <div className="bg-c-surface-raised rounded-xl border border-white/10 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="w-5 h-5 text-primary-400" />
        <h3 className="text-lg font-semibold text-c-text">Data Governance</h3>
      </div>

      <div className="space-y-4">
        {policies.map((policy, index) => (
          <div
            key={policy.dataType}
            className="bg-c-surface rounded-lg p-4 flex items-center justify-between"
          >
            <div>
              <div className="text-c-text font-medium">{policy.dataType}</div>
              <div className="text-sm text-slate-400 dark:text-slate-500 flex items-center gap-2 mt-1">
                <Clock className="w-3 h-3" />
                Retention: {policy.retentionDays} days
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
                <input
                  type="checkbox"
                  checked={policy.autoDelete}
                  onChange={(e) => updatePolicy(index, { autoDelete: e.target.checked })}
                  className="rounded border-slate-600 bg-c-surface-raised text-primary-500 focus:ring-primary-500"
                />
                Auto-delete
              </label>
              <input
                type="number"
                value={policy.retentionDays}
                onChange={(e) =>
                  updatePolicy(index, { retentionDays: parseInt(e.target.value) || 0 })
                }
                className="w-20 px-2 py-1 bg-c-surface-raised border border-white/10 rounded text-c-text text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-yellow-400 font-medium">Compliance Notice</div>
          <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Ensure retention policies comply with GDPR, SOC2, and other applicable regulations.
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataGovernancePanel;
