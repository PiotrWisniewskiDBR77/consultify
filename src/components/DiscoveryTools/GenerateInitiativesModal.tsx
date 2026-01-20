/**
 * GenerateInitiativesModal
 * Configure initiative generation parameters.
 */

import { X } from 'lucide-react';
import React, { useState } from 'react';

const METHODOLOGIES = [
  { id: 'impact-feasibility', label: 'Impact x Feasibility' },
  { id: 'value-effort', label: 'Value x Effort' },
  { id: 'risk-compliance', label: 'Risk/Compliance' },
  { id: 'customer-market', label: 'Customer/Market' },
  { id: 'operational-efficiency', label: 'Operational Efficiency' },
];

interface GenerateInitiativesModalProps {
  isPolish: boolean;
  defaults: { methodologyId: string; count: number; includeChatContext: boolean };
  onClose: () => void;
  onGenerate: (payload: {
    methodologyId: string;
    count: number;
    includeChatContext: boolean;
  }) => void;
}

export const GenerateInitiativesModal: React.FC<GenerateInitiativesModalProps> = ({
  isPolish,
  defaults,
  onClose,
  onGenerate,
}) => {
  const [count, setCount] = useState(defaults.count);
  const [methodologyId, setMethodologyId] = useState(defaults.methodologyId);
  const [includeChatContext, setIncludeChatContext] = useState(defaults.includeChatContext);

  const handleGenerate = () => {
    onGenerate({ methodologyId, count, includeChatContext });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg bg-white dark:bg-navy-900 rounded-xl shadow-lg border border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isPolish ? 'Generate initiatives' : 'Generate initiatives'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800">
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

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={includeChatContext}
              onChange={(e) => setIncludeChatContext(e.target.checked)}
            />
            {isPolish ? 'Include AI chat context' : 'Include AI chat context'}
          </label>
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
            className="px-4 py-2 rounded-lg text-sm text-white bg-primary-500 hover:bg-primary-600"
          >
            {isPolish ? 'Generate drafts' : 'Generate drafts'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateInitiativesModal;
