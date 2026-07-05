import { FileText, Globe, PlusCircle, Radar, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { AIInsightsCard } from '../../../components/Megatrend/AIInsightsCard';
import { CustomTrendCard } from '../../../components/Megatrend/CustomTrendCard';
import { IndustryBaselineCard } from '../../../components/Megatrend/IndustryBaselineCard';
import { TrendDetailCard } from '../../../components/Megatrend/TrendDetailCard';
import { RadarMegatrend, TrendRadarCard } from '../../../components/Megatrend/TrendRadarCard';
import { useMegatrendStore } from '../../../store/megatrendStore';
import { DynamicListItem } from '../shared/DynamicList';

interface CustomTrend {
  id: string;
  label: string;
  description: string;
  type: 'Technology' | 'Business' | 'Societal';
  ring: 'Now' | 'Watch Closely' | 'On the Horizon';
}

export const MegatrendScannerModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'baseline' | 'radar' | 'detail' | 'custom' | 'insights'
  >('baseline');
  const [lastTab, setLastTab] = useState<'baseline' | 'radar'>('baseline');
  const [selectedTrendId, setSelectedTrendId] = useState<string | null>(null);
  const [industry, setIndustry] = useState('automotive');

  // Use megatrend store for data
  const { megatrends, loading, error, fetchMegatrends } = useMegatrendStore();

  // Load data on mount or industry change
  useEffect(() => {
    fetchMegatrends(industry);
  }, [industry, fetchMegatrends]);

  const handleTrendSelect = (trendId: string) => {
    if (activeTab === 'baseline' || activeTab === 'radar') {
      setLastTab(activeTab);
    }
    setSelectedTrendId(trendId);
    setActiveTab('detail');
  };

  // For custom trends, keep local state (could be extended to store)
  const [customTrends, setCustomTrends] = useState<CustomTrend[]>([
    {
      id: '1',
      label: 'Local Competitor Pricing',
      description: 'Aggressive undercutting in Q3',
      type: 'Business',
      ring: 'Now',
    },
  ]);

  const customTrendHandlers = {
    onAdd: (trend: Omit<CustomTrend, 'id'>) => {
      setCustomTrends((prev) => [
        ...prev,
        { ...trend, id: Math.random().toString(36).substr(2, 9) },
      ]);
    },
    onDelete: (id: string) => {
      setCustomTrends((prev) => prev.filter((p) => p.id !== id));
    },
  };

  // Map detailed trends to radar format
  const radarData: RadarMegatrend[] = megatrends.map((m) => ({
    id: m.id,
    label: m.label,
    type: m.type,
    // Use mapped property from store
    ring: m.aiSuggestion?.ring || 'Watch Closely',
    impact: m.impactScore || 4,
    description: m.shortDescription,
  }));

  // TABS CONFIG
  const tabs = [
    { id: 'baseline', label: 'Industry Baseline', icon: Globe },
    { id: 'radar', label: 'Trend Radar Map', icon: Radar },
    { id: 'detail', label: 'Trend Detail', icon: FileText },
    { id: 'custom', label: 'Custom Trends', icon: PlusCircle },
    { id: 'insights', label: 'AI Insights', icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      <div className="flex border-b border-c-border-subtle space-x-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() =>
              setActiveTab(tab.id as 'baseline' | 'radar' | 'detail' | 'custom' | 'insights')
            }
            className={`
                            flex items-center gap-2 pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap
                            ${
                              activeTab === tab.id
                                ? 'border-c-accent text-c-accent'
                                : 'border-transparent text-c-text-muted hover:text-c-text'
                            }
                        `}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {/* TAB 1: INDUSTRY BASELINE */}
        {activeTab === 'baseline' && (
          <IndustryBaselineCard
            industry={industry}
            megatrends={megatrends}
            loading={loading}
            error={error}
            onTrendSelect={handleTrendSelect}
          />
        )}

        {/* TAB 2: TREND RADAR */}
        {activeTab === 'radar' && (
          <div className="flex justify-center py-8">
            <TrendRadarCard
              data={radarData}
              loading={loading}
              error={error}
              onTrendSelect={handleTrendSelect}
            />
          </div>
        )}

        {/* TAB 3: TREND DETAIL */}
        {activeTab === 'detail' && (
          <div className="max-w-4xl mx-auto">
            {selectedTrendId ? (
              <TrendDetailCard trendId={selectedTrendId} onClose={() => setActiveTab(lastTab)} />
            ) : (
              <div className="text-center py-12 bg-c-surface-raised dark:bg-c-surface rounded-lg border border-dashed border-c-border-subtle">
                <p className="text-c-text-muted">
                  Please select a trend from the Baseline or Radar Map to see details.
                </p>
                <button
                  onClick={() => setActiveTab('baseline')}
                  className="mt-4 text-c-accent hover:opacity-80 font-medium"
                >
                  Go to Baseline
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CUSTOM TRENDS */}
        {activeTab === 'custom' && (
          <CustomTrendCard
            trends={customTrends}
            onAdd={customTrendHandlers.onAdd}
            onDelete={customTrendHandlers.onDelete}
          />
        )}

        {/* TAB 5: AI INSIGHTS */}
        {activeTab === 'insights' && <AIInsightsCard megatrends={megatrends} loading={loading} />}
      </div>
    </div>
  );
};
