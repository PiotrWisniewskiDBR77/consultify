/**
 * InventoryClassificationStep - ABC/XYZ classification
 */
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  OperationalItem,
  OperationalToolData,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

interface InventoryClassificationStepProps {
  session: ToolSession;
  isPolish: boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const InventoryClassificationStep: React.FC<InventoryClassificationStepProps> = ({
  session,
  isPolish,
}) => {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const [skuGroup, setSkuGroup] = useState('');
  const [category, setCategory] = useState('A/X');
  const [notes, setNotes] = useState('');

  const data = session.inputData as OperationalToolData;
  const items = data.sections?.['sku-classification'] || [];

  const handleAdd = () => {
    if (!skuGroup.trim()) return;
    const newItem: OperationalItem = {
      id: generateId(),
      title: skuGroup.trim(),
      description: notes.trim(),
      impact: 'medium',
      effort: 'low',
      category,
    };
    updateInputData({
      sections: {
        ...data.sections,
        'sku-classification': [...items, newItem],
      },
    });
    setSkuGroup('');
    setCategory('A/X');
    setNotes('');
  };

  const handleRemove = (itemId: string) => {
    updateInputData({
      sections: {
        ...data.sections,
        'sku-classification': items.filter((item) => item.id !== itemId),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsTools.operational.inventoryClassificationStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.operational.inventoryClassificationStep.description')}
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={skuGroup}
          onChange={(e) => setSkuGroup(e.target.value)}
          placeholder={t(
            'discoveryToolsTools.operational.inventoryClassificationStep.skuGroupPlaceholder'
          )}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <div className="flex items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300"
          >
            {['A/X', 'A/Y', 'A/Z', 'B/X', 'B/Y', 'B/Z', 'C/X', 'C/Y', 'C/Z'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!skuGroup.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {t('discoveryToolsTools.common.add')}
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t(
            'discoveryToolsTools.operational.inventoryClassificationStep.notesPlaceholder'
          )}
          rows={2}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white resize-none"
        />
        <InlineAssist
          hint={t('discoveryToolsTools.operational.inventoryClassificationStep.hint')}
        />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="p-8 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600">
            {t('discoveryToolsTools.operational.inventoryClassificationStep.empty')}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">{item.title}</h4>
                  {item.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {item.description}
                    </p>
                  )}
                  {item.category && (
                    <div className="text-xs text-slate-500 mt-2">
                      {t('discoveryToolsTools.common.category')}: {item.category}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(item.id)}
                  className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-900/30 text-slate-600 hover:text-danger-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default InventoryClassificationStep;
