/**
 * T064 — MegatrendsWorkspace — Canonical shared component for Megatrend Analysis.
 * Single implementation, reused from Tools → Strategy (canonical).
 * Extracted from MegatrendScannerModule — zero feature loss.
 */

import { ArrowLeft, FileText, Globe, PlusCircle, Radar, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { useMegatrendStore } from '../../store/megatrendStore';
import { AIInsightsCard } from './AIInsightsCard';
import { CustomTrendCard } from './CustomTrendCard';
import { IndustryBaselineCard } from './IndustryBaselineCard';
import { TrendDetailCard } from './TrendDetailCard';
import { type RadarMegatrend, TrendRadarCard } from './TrendRadarCard';

interface CustomTrend {
  id: string;
  label: string;
  description: string;
  type: 'Technology' | 'Business' | 'Societal';
  ring: 'Now' | 'Watch Closely' | 'On the Horizon';
}

interface MegatrendsWorkspaceProps {
  source?: 'tools' | 'organization' | 'context_redirect';
  showHeader?: boolean;
  onBack?: () => void;
}

export const MegatrendsWorkspace: React.FC<MegatrendsWorkspaceProps> = ({
  source = 'tools',
  showHeader = true,
  onBack,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'baseline' | 'radar' | 'detail' | 'custom' | 'insights'>('baseline');
  const [lastTab, setLastTab] = useState<'baseline' | 'radar'>('baseline');
  const [selectedTrendId, setSelectedTrendId] = useState<string | null>(null);
  const [industry, setIndustry] = useState('automotive');

  const { megatrends, loading, error, fetchMegatrends } = useMegatrendStore();

  useEffect(() => {
    fetchMegatrends(industry);
    trackFunnelEvent('megatrends_opened', { source });
  }, [industry, fetchMegatrends, source]);

  const handleTrendSelect = (trendId: string) => {
    if (activeTab === 'baseline' || activeTab === 'radar') setLastTab(activeTab);
    setSelectedTrendId(trendId);
    setActiveTab('detail');
  };

  const [customTrends, setCustomTrends] = useState<CustomTrend[]>([
    { id: '1', label: 'Local Competitor Pricing', description: 'Aggressive undercutting in Q3', type: 'Business', ring: 'Now' },
  ]);

  const customTrendHandlers = {
    onAdd: (trend: Omit<CustomTrend, 'id'>) => {
      setCustomTrends(prev => [...prev, { ...trend, id: Math.random().toString(36).substr(2, 9) }]);
    },
    onDelete: (id: string) => {
      setCustomTrends(prev => prev.filter(p => p.id !== id));
    },
  };

  const radarData: RadarMegatrend[] = megatrends.map(m => ({
    id: m.id,
    label: m.label,
    type: m.type,
    ring: m.aiSuggestion?.ring || 'Watch Closely',
    impact: m.impactScore || 4,
    description: m.shortDescription,
  }));

  const tabs = [
    { id: 'baseline' as const, label: t('megatrends.tabs.baseline', 'Industry Baseline'), icon: Globe },
    { id: 'radar' as const, label: t('megatrends.tabs.radar', 'Trend Radar Map'), icon: Radar },
    { id: 'detail' as const, label: t('megatrends.tabs.detail', 'Trend Detail'), icon: FileText },
    { id: 'custom' as const, label: t('megatrends.tabs.custom', 'Custom Trends'), icon: PlusCircle },
    { id: 'insights' as const, label: t('megatrends.tabs.insights', 'AI Insights'), icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-center gap-3">
          {onBack && (<button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 transition-colors"><ArrowLeft size={18} /></button>)}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('megatrends.title', 'Megatrend Analysis')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('megatrends.subtitle', 'Explore industry megatrends, build a radar, and surface strategic insights')}</p>
          </div>
        </div>
      )}
      <div className="flex border-b border-slate-200/60 dark:border-navy-700/60 space-x-6 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <tab.icon size={15} strokeWidth={1.5} />{tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-[400px]">
        {activeTab === 'baseline' && (<IndustryBaselineCard industry={industry} megatrends={megatrends} loading={loading} error={error} onTrendSelect={handleTrendSelect} />)}
        {activeTab === 'radar' && (<div className="flex justify-center py-8"><TrendRadarCard data={radarData} loading={loading} error={error} onTrendSelect={handleTrendSelect} /></div>)}
        {activeTab === 'detail' && (
          <div className="max-w-4xl mx-auto">
            {selectedTrendId ? (<TrendDetailCard trendId={selectedTrendId} onClose={() => setActiveTab(lastTab)} />) : (
              <div className="text-center py-12 bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-dashed border-slate-200 dark:border-navy-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('megatrends.selectTrend', 'Select a trend from the Baseline or Radar Map to see details.')}</p>
                <button onClick={() => setActiveTab('baseline')} className="mt-3 text-sm text-slate-700 dark:text-slate-300 hover:underline font-medium">{t('megatrends.goToBaseline', 'Go to Baseline')}</button>
              </div>
            )}
          </div>
        )}
        {activeTab === 'custom' && (<CustomTrendCard trends={customTrends} onAdd={customTrendHandlers.onAdd} onDelete={customTrendHandlers.onDelete} />)}
        {activeTab === 'insights' && <AIInsightsCard megatrends={megatrends} loading={loading} />}
      </div>
    </div>
  );
};

export default MegatrendsWorkspace;
