// components/Megatrend/CustomTrendCard.tsx
// Card 4: Custom / Company-Specific Trends
// Allows adding local pressures (e.g., competitor pricing, regulations).
// ----------------------------------------------------------------------

import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

interface CustomTrend {
  id: string;
  label: string;
  description: string;
  type: 'Technology' | 'Business' | 'Societal';
  ring: 'Now' | 'Watch Closely' | 'On the Horizon';
}

interface CustomTrendCardProps {
  trends: CustomTrend[];
  onAdd: (trend: Omit<CustomTrend, 'id'>) => void;
  onDelete: (id: string) => void;
}

export const CustomTrendCard: React.FC<CustomTrendCardProps> = ({ trends, onAdd, onDelete }) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [newTrend, setNewTrend] = useState<Omit<CustomTrend, 'id'>>({
    label: '',
    description: '',
    type: 'Business',
    ring: 'Now',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(newTrend);
    setNewTrend({ label: '', description: '', type: 'Business', ring: 'Now' });
    setIsAdding(false);
  };

  return (
    <div className="bg-c-surface rounded-xl shadow-lg p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-c-text">{t('megatrends.custom.title', 'Custom trends')}</h2>
          <p className="text-sm text-c-text-muted mt-1">
            {t('megatrends.custom.subtitle', 'Add specific pressures unique to your market or niche.')}
          </p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-c-text text-c-surface rounded-lg hover:opacity-90 transition"
          >
            <Plus size={16} /> {t('megatrends.custom.add', 'Add custom trend')}
          </button>
        )}
      </div>

      {/* AI Suggestion Banner */}
      <div className="bg-c-surface-raised p-4 rounded-lg border border-c-border-subtle flex items-start gap-3">
        <AlertCircle className="text-c-text-secondary dark:text-c-text-muted mt-1" size={18} />
        <div>
          <h4 className="font-bold text-sm text-c-text">{t('megatrends.custom.radarWatch', 'AI radar watch')}</h4>
          <p className="text-xs text-c-text-muted mt-1">
            {t(
              'megatrends.custom.radarWatchBody',
              'I am monitoring news sources for “Carbon Tax Legislation” as it seems relevant to your sector.'
            )}
            <button className="text-c-info font-bold ml-1 hover:underline">
              {t('megatrends.custom.addToList', 'Add to the list?')}
            </button>
          </p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {trends.length === 0 && !isAdding && (
          <div className="text-center py-8 text-c-text-secondary dark:text-c-text-muted italic">
            {t('megatrends.custom.empty', 'No custom trends added yet.')}
          </div>
        )}

        {trends.map((trend) => (
          <div
            key={trend.id}
            className="flex justify-between items-start p-4 bg-c-surface-raised border border-c-border-subtle rounded-lg"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-c-text">{trend.label}</h4>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase
                                    ${
                                      trend.type === 'Technology'
                                        ? 'bg-c-tag-1 text-white'
                                        : trend.type === 'Business'
                                          ? 'bg-c-tag-3 text-white'
                                          : 'bg-c-tag-9 text-white'
                                    }`}
                >
                  {trend.type}
                </span>
                <span className="text-[10px] bg-c-surface-raised text-c-text-secondary px-2 py-0.5 rounded font-medium">
                  {trend.ring}
                </span>
              </div>
              <p className="text-sm text-c-text-secondary">{trend.description}</p>
            </div>
            <button
              onClick={() => onDelete(trend.id)}
              className="text-c-text-secondary dark:text-c-text-muted hover:text-c-danger transition p-1"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="bg-c-surface-raised p-4 rounded-lg border border-c-border-subtle animate-in fade-in slide-in-from-top-2"
        >
          <h3 className="font-bold text-c-text mb-4">{t('megatrends.custom.newTitle', 'New custom trend')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-c-text-muted uppercase mb-1">
                {t('megatrends.custom.nameLabel', 'Trend name')}
              </label>
              <input
                type="text"
                required
                value={newTrend.label}
                onChange={(e) => setNewTrend({ ...newTrend, label: e.target.value })}
                placeholder={t('megatrends.custom.namePlaceholder', 'e.g. Local competitor price war')}
                className="w-full px-3 py-2 rounded border border-c-border-subtle dark:bg-c-surface text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-c-text-muted uppercase mb-1">
                {t('megatrends.custom.descriptionLabel', 'Description / why relevant?')}
              </label>
              <textarea
                required
                value={newTrend.description}
                onChange={(e) => setNewTrend({ ...newTrend, description: e.target.value })}
                placeholder={t('megatrends.custom.descriptionPlaceholder', 'Impact on our Q3 sales…')}
                className="w-full px-3 py-2 rounded border border-c-border-subtle dark:bg-c-surface text-sm"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-c-text-muted uppercase mb-1">
                {t('megatrends.custom.typeLabel', 'Type')}
              </label>
              <select
                value={newTrend.type}
                onChange={(e) =>
                  setNewTrend({ ...newTrend, type: e.target.value as CustomTrend['type'] })
                }
                className="w-full px-3 py-2 rounded border border-c-border-subtle dark:bg-c-surface text-sm"
              >
                <option value="Technology">{t('megatrends.custom.type.technology', 'Technology')}</option>
                <option value="Business">{t('megatrends.custom.type.business', 'Business')}</option>
                <option value="Societal">{t('megatrends.custom.type.societal', 'Societal')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-c-text-muted uppercase mb-1">
                Horizon (Ring)
              </label>
              <select
                value={newTrend.ring}
                onChange={(e) =>
                  setNewTrend({ ...newTrend, ring: e.target.value as CustomTrend['ring'] })
                }
                className="w-full px-3 py-2 rounded border border-c-border-subtle dark:bg-c-surface text-sm"
              >
                <option value="Now">{t('megatrends.custom.ring.now', 'Impact now')}</option>
                <option value="Watch Closely">{t('megatrends.custom.ring.watch', 'Watch closely')}</option>
                <option value="On the Horizon">{t('megatrends.custom.ring.horizon', 'On the horizon')}</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-sm text-c-text-secondary hover:bg-c-surface-raised rounded"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-c-text text-c-surface rounded hover:opacity-90"
            >
              {t('megatrends.custom.save', 'Save trend')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
