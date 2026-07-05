/**
 * GenerateInitiativesModal
 * Configure initiative generation parameters.
 */

import { X } from 'lucide-react';
import React, { useState } from 'react';

import { Api } from '@/services/api';

const METHODOLOGIES = [
  { id: 'impact-feasibility', label: 'Impact x Feasibility' },
  { id: 'value-effort', label: 'Value x Effort' },
  { id: 'risk-compliance', label: 'Risk/Compliance' },
  { id: 'customer-market', label: 'Customer/Market' },
  { id: 'operational-efficiency', label: 'Operational Efficiency' },
];

const METHODOLOGY_PREVIEW: Record<string, { category: string; priority: string; risk: string }> = {
  'impact-feasibility': { category: 'Strategy', priority: 'P1', risk: 'Medium' },
  'value-effort': { category: 'Operations', priority: 'P2', risk: 'Low' },
  'risk-compliance': { category: 'Process Auto', priority: 'P1', risk: 'High' },
  'customer-market': { category: 'Digital', priority: 'P2', risk: 'Medium' },
  'operational-efficiency': { category: 'Operations', priority: 'P2', risk: 'Low' },
};

interface GenerateInitiativesModalProps {
  isPolish: boolean;
  defaults: { methodologyId: string; count: number; includeChatContext: boolean };
  onClose: () => void;
  onGenerate: (payload: {
    methodologyId: string;
    count: number;
    includeChatContext: boolean;
    decisionOwnerId?: string;
  }) => void;
}

export const GenerateInitiativesModal: React.FC<GenerateInitiativesModalProps> = ({
  isPolish,
  defaults,
  onClose,
  onGenerate,
}) => {
  const [count, setCount] = useState(defaults.count);
  const [customCount, setCustomCount] = useState('');
  const [methodologyId, setMethodologyId] = useState(defaults.methodologyId);
  const [includeChatContext, setIncludeChatContext] = useState(defaults.includeChatContext);
  const [decisionOwnerId, setDecisionOwnerId] = useState<string>('');
  const [users, setUsers] = useState<any[]>([]);

  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        const fetchedUsers = await Api.getUsers();
        setUsers(fetchedUsers || []);
      } catch (err) {
        console.error('Failed to load users', err);
      }
    };
    loadUsers();
  }, []);
  const previewMeta = METHODOLOGY_PREVIEW[methodologyId] || {
    category: 'Operations',
    priority: 'P3',
    risk: 'Medium',
  };
  const customValue = Number(customCount);
  const finalCount =
    customCount !== '' && Number.isFinite(customValue)
      ? Math.min(7, Math.max(1, customValue))
      : count;

  const handleGenerate = () => {
    onGenerate({
      methodologyId,
      count: finalCount,
      includeChatContext,
      decisionOwnerId: decisionOwnerId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg bg-white dark:bg-navy-900 rounded-xl shadow-lg border border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isPolish ? 'Generate initiatives' : 'Generate initiatives'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPolish ? 'Liczba inicjatyw' : 'Initiatives count'}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[3, 4, 5, 6, 7].map((value) => (
                <button
                  key={value}
                  onClick={() => setCount(value)}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    count === value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600'
                      : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <input
                type="number"
                min={1}
                max={7}
                value={customCount}
                onChange={(e) => setCustomCount(e.target.value)}
                placeholder={isPolish ? 'Custom (1-7)' : 'Custom (1-7)'}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-sm bg-white dark:bg-navy-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPolish ? 'Metodyka' : 'Methodology'}
            </label>
            <div className="space-y-2">
              {METHODOLOGIES.map((method) => (
                <label key={method.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="methodology"
                    value={method.id}
                    checked={methodologyId === method.id}
                    onChange={() => setMethodologyId(method.id)}
                  />
                  <span className="text-slate-700 dark:text-slate-300">{method.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPolish ? 'Decision Owner' : 'Decision Owner'}{' '}
              {isPolish ? '(opcjonalnie)' : '(optional)'}
            </label>
            <select
              value={decisionOwnerId}
              onChange={(e) => setDecisionOwnerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-sm bg-white dark:bg-navy-900"
            >
              <option value="">{isPolish ? '-- Wybierz --' : '-- Select --'}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email || user.id}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={includeChatContext}
              onChange={(e) => setIncludeChatContext(e.target.checked)}
            />
            {isPolish ? 'Include AI chat context' : 'Include AI chat context'}
          </label>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
            <div className="text-xs text-slate-500 mb-2">
              {isPolish ? 'Preview list' : 'Preview list'}
            </div>
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
              {Array.from({ length: finalCount }).map((_, idx) => (
                <div key={idx}>
                  • Initiative {idx + 1} · {previewMeta.category} · {previewMeta.priority} ·{' '}
                  {previewMeta.risk}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700"
          >
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 rounded-lg text-sm text-c-bg bg-c-text hover:bg-c-text-secondary"
          >
            {isPolish ? 'Generate drafts' : 'Generate drafts'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateInitiativesModal;
