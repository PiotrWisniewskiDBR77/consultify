/**
 * MultiFwBenchmarkComparison
 *
 * Component for comparing multi-framework assessment scores against industry benchmarks.
 * Displays percentile rankings, category comparisons, and regional analysis.
 */

import {
  Award,
  BarChart3,
  Building2,
  ChevronDown,
  Globe2,
  Info,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AssessmentFramework } from '../../store/useMultiFrameworkStore';

// ============================================
// TYPES
// ============================================

interface BenchmarkData {
  industry: string;
  industryName: string;
  sampleSize: number;
  lastUpdated: string;
  percentile: number;
  percentileLabel: string;
  industryAverage: number;
  gapToAverage: number;
  categoryComparison: Record<
    string,
    {
      score: number;
      benchmark: number;
      gap: number;
      status: 'above' | 'below';
    }
  >;
  strengths: Array<{ id: string; gap: number }>;
  weaknesses: Array<{ id: string; gap: number }>;
}

interface MultiFwBenchmarkComparisonProps {
  framework: AssessmentFramework;
  scoreResult: {
    overall: number;
    categories: Record<string, number>;
  };
  projectId: string;
  industry?: string;
  region?: string;
  companySize?: string;
}

// ============================================
// INDUSTRY OPTIONS
// ============================================

const INDUSTRY_OPTIONS: Record<AssessmentFramework, Array<{ id: string; name: string }>> = {
  DRD: [
    { id: 'manufacturing_discrete', name: 'Discrete Manufacturing' },
    { id: 'manufacturing_process', name: 'Process Manufacturing' },
    { id: 'services', name: 'Services' },
  ],
  SIRI: [
    { id: 'manufacturing_discrete', name: 'Discrete Manufacturing' },
    { id: 'manufacturing_process', name: 'Process Manufacturing' },
    { id: 'automotive', name: 'Automotive' },
    { id: 'aerospace', name: 'Aerospace & Defense' },
    { id: 'electronics', name: 'Electronics' },
  ],
  ADMA: [
    { id: 'manufacturing_discrete', name: 'Discrete Manufacturing' },
    { id: 'manufacturing_process', name: 'Process Manufacturing' },
  ],
  CMMI: [
    { id: 'software', name: 'Software Development' },
    { id: 'it_services', name: 'IT Services' },
    { id: 'defense', name: 'Defense & Government' },
  ],
  LEAN: [
    { id: 'manufacturing_discrete', name: 'Discrete Manufacturing' },
    { id: 'manufacturing_process', name: 'Process Manufacturing' },
  ],
};

const REGION_OPTIONS = [
  { id: 'APAC', name: 'Asia-Pacific' },
  { id: 'Europe', name: 'Europe' },
  { id: 'North America', name: 'North America' },
  { id: 'South America', name: 'South America' },
];

const SIZE_OPTIONS = [
  { id: 'small', name: 'Small (<50 employees)' },
  { id: 'medium', name: 'Medium (50-250)' },
  { id: 'large', name: 'Large (250-1000)' },
  { id: 'enterprise', name: 'Enterprise (>1000)' },
];

// ============================================
// CATEGORY LABELS
// ============================================

const CATEGORY_LABELS: Record<AssessmentFramework, Record<string, string>> = {
  DRD: {},
  SIRI: {
    PROCESS: 'Process',
    TECHNOLOGY: 'Technology',
    ORGANIZATION: 'Organization',
  },
  ADMA: {
    strategy: 'Strategy & Organization',
    smart_products: 'Smart Products',
    smart_operations: 'Smart Operations',
    smart_supply: 'Smart Supply Chain',
    data_driven: 'Data-Driven Services',
  },
  CMMI: {
    DOING: 'Doing',
    MANAGING: 'Managing',
    ENABLING: 'Enabling',
  },
  LEAN: {
    MEASURE: 'Pomierz',
    OPTIMIZE: 'Zoptymalizuj',
    AUTOMATE: 'Automatyzuj',
  },
};

// ============================================
// COMPONENT
// ============================================

export const MultiFwBenchmarkComparison: React.FC<MultiFwBenchmarkComparisonProps> = ({
  framework,
  scoreResult,
  projectId,
  industry: initialIndustry,
  region: initialRegion,
  companySize: initialSize,
}) => {
  const [selectedIndustry, setSelectedIndustry] = useState(
    initialIndustry || INDUSTRY_OPTIONS[framework]?.[0]?.id || 'manufacturing_discrete'
  );
  const [selectedRegion, setSelectedRegion] = useState(initialRegion || 'Europe');
  const [selectedSize, setSelectedSize] = useState(initialSize || 'medium');
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch benchmark data
  useEffect(() => {
    fetchBenchmarkData();
  }, [framework, scoreResult, selectedIndustry, selectedRegion, selectedSize]);

  const fetchBenchmarkData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/benchmark/compare?` +
          `framework=${framework}&` +
          `score=${scoreResult.overall}&` +
          `industry=${selectedIndustry}&` +
          `region=${selectedRegion}&` +
          `size=${selectedSize}&` +
          `categories=${JSON.stringify(scoreResult.categories)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setBenchmarkData(data);
      } else {
        setBenchmarkData(null);
        setError('Failed to load benchmark data');
      }
    } catch (err) {
      setBenchmarkData(null);
      setError('Failed to load benchmark data');
    }
    setIsLoading(false);
  };

  // Prepare radar chart data
  const radarData = useMemo(() => {
    if (!benchmarkData) return [];

    const labels = CATEGORY_LABELS[framework] || {};
    return Object.entries(benchmarkData.categoryComparison).map(([catId, data]) => ({
      category: labels[catId] || catId,
      score: data.score,
      benchmark: data.benchmark,
    }));
  }, [benchmarkData, framework]);

  // Prepare bar chart data
  const barData = useMemo(() => {
    if (!benchmarkData) return [];

    const labels = CATEGORY_LABELS[framework] || {};
    return Object.entries(benchmarkData.categoryComparison).map(([catId, data]) => ({
      name: labels[catId] || catId,
      gap: data.gap,
      fill: data.gap >= 0 ? '#10B981' : '#F43F5E',
    }));
  }, [benchmarkData, framework]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-200 dark:bg-navy-700 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 dark:bg-navy-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!benchmarkData) {
    return (
      <div className="p-6 rounded-xl border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-900">
        <div className="text-sm text-gray-700 dark:text-gray-200">
          {error || 'No benchmark data available.'}
        </div>
        <button
          onClick={fetchBenchmarkData}
          className="mt-3 px-3 py-1.5 text-sm rounded-lg bg-brand text-white hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-navy-900 rounded-xl">
        {/* Industry Select */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            <Building2 className="w-3 h-3 inline mr-1" />
            Industry
          </label>
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-600 rounded-lg text-sm"
          >
            {INDUSTRY_OPTIONS[framework]?.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>

        {/* Region Select */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            <Globe2 className="w-3 h-3 inline mr-1" />
            Region
          </label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-600 rounded-lg text-sm"
          >
            {REGION_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>

        {/* Size Select */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            <Users className="w-3 h-3 inline mr-1" />
            Company Size
          </label>
          <select
            value={selectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-600 rounded-lg text-sm"
          >
            {SIZE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Percentile Card */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Award className="w-8 h-8 opacity-80" />
            <span className="text-xs opacity-80">Percentile Rank</span>
          </div>
          <div className="text-4xl font-bold mb-1">{benchmarkData.percentile}%</div>
          <div className="text-sm opacity-90">{benchmarkData.percentileLabel}</div>
          <div className="mt-4 text-xs opacity-75">
            Better than {benchmarkData.percentile}% of {benchmarkData.industryName} organizations
          </div>
        </div>

        {/* Score vs Average */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-gray-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="w-6 h-6 text-gray-600 dark:text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">vs Industry Average</span>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {scoreResult.overall.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Your Score</div>
            </div>
            <div className="flex items-center gap-1 mb-1">
              {benchmarkData.gapToAverage >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-rose-500" />
              )}
              <span
                className={`text-lg font-semibold ${
                  benchmarkData.gapToAverage >= 0 ? 'text-green-500' : 'text-rose-500'
                }`}
              >
                {benchmarkData.gapToAverage > 0 ? '+' : ''}
                {benchmarkData.gapToAverage}
              </span>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Industry average:{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {benchmarkData.industryAverage}
            </span>
          </div>
        </div>

        {/* Sample Info */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-gray-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-4">
            <Target className="w-6 h-6 text-gray-600 dark:text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Benchmark Data</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Sample Size</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {benchmarkData.sampleSize} orgs
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Last Updated</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {benchmarkData.lastUpdated}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Framework</span>
              <span className="font-medium text-gray-900 dark:text-white">{framework}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-gray-200 dark:border-navy-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Category Comparison</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="category" tick={{ fill: '#6B7280', fontSize: 11 }} />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 5]}
                  tick={{ fill: '#6B7280', fontSize: 10 }}
                />
                <Radar
                  name="Your Score"
                  dataKey="score"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                />
                <Radar
                  name="Industry Benchmark"
                  dataKey="benchmark"
                  stroke="#9CA3AF"
                  fill="#9CA3AF"
                  fillOpacity={0.2}
                  strokeDasharray="5 5"
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gap Chart */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-gray-200 dark:border-navy-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Gap to Industry Average
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" domain={[-2, 2]} tick={{ fill: '#6B7280', fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: any) => [value > 0 ? `+${value}` : value, 'Gap'] as any}
                />
                <Bar dataKey="gap" radius={[0, 4, 4, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
          <h3 className="font-semibold text-green-800 dark:text-green-200 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Strengths (Above Benchmark)
          </h3>
          {benchmarkData.strengths.length > 0 ? (
            <div className="space-y-3">
              {benchmarkData.strengths.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <span className="text-sm text-green-700 dark:text-green-300">
                    {CATEGORY_LABELS[framework]?.[s.id] || s.id}
                  </span>
                  <span className="text-sm font-medium text-green-600">+{s.gap.toFixed(1)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-green-600 dark:text-green-400 opacity-70">
              No categories significantly above benchmark
            </p>
          )}
        </div>

        {/* Weaknesses */}
        <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-6 border border-rose-200 dark:border-rose-800">
          <h3 className="font-semibold text-rose-800 dark:text-rose-200 mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            Improvement Areas (Below Benchmark)
          </h3>
          {benchmarkData.weaknesses.length > 0 ? (
            <div className="space-y-3">
              {benchmarkData.weaknesses.map((w) => (
                <div key={w.id} className="flex items-center justify-between">
                  <span className="text-sm text-rose-700 dark:text-rose-300">
                    {CATEGORY_LABELS[framework]?.[w.id] || w.id}
                  </span>
                  <span className="text-sm font-medium text-rose-600">{w.gap.toFixed(1)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-rose-600 dark:text-rose-400 opacity-70">
              All categories at or above benchmark
            </p>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-navy-900 rounded-lg">
        <Info className="w-5 h-5 text-gray-600 dark:text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Benchmark data is based on aggregated industry assessments and may not reflect the most
          recent market conditions. Sample sizes vary by industry and region. Use these comparisons
          as guidance rather than absolute measures.
        </p>
      </div>
    </div>
  );
};

export default MultiFwBenchmarkComparison;
