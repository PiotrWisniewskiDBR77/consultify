/**
 * RoutingRulesTab - Configuration > Routing Rules
 * NEW: Intelligent routing configuration
 */

import {
  AlertCircle,
  ArrowRight,
  Check,
  Globe,
  Layers,
  Plus,
  RefreshCw,
  Route,
  Scale,
  Server,
  Settings,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface RoutingRule {
  id: string;
  name: string;
  description: string;
  type: 'cost' | 'latency' | 'health' | 'geographic' | 'load_balance';
  priority: number;
  isActive: boolean;
  config: {
    threshold?: number;
    fallbackProvider?: string;
    region?: string;
    weight?: number;
  };
}

interface TierRouting {
  tier: string;
  label: string;
  description: string;
  defaultModel: string;
  fallbackModel: string;
}

export const RoutingRulesTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [tierRoutings, setTierRoutings] = useState<TierRouting[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);

  useEffect(() => {
    loadRoutingConfig();
  }, []);

  const loadRoutingConfig = async () => {
    setLoading(true);
    try {
      // Mock data - replace with API call
      setTierRoutings([
        {
          tier: 'BUDGET',
          label: 'Budget Tier',
          description: 'Simple questions, fast responses',
          defaultModel: 'gpt-4o-mini',
          fallbackModel: 'claude-3-haiku',
        },
        {
          tier: 'STANDARD',
          label: 'Standard Tier',
          description: 'Most tasks (chat, magic wand)',
          defaultModel: 'gpt-4o',
          fallbackModel: 'claude-3-5-sonnet',
        },
        {
          tier: 'PREMIUM',
          label: 'Premium Tier',
          description: 'Complex analysis, reports',
          defaultModel: 'gpt-4o',
          fallbackModel: 'claude-3-5-sonnet',
        },
        {
          tier: 'REASONING',
          label: 'Reasoning Tier',
          description: 'MAX Mode, deep thinking',
          defaultModel: 'o1-preview',
          fallbackModel: 'claude-3-5-sonnet',
        },
      ]);

      setRules([
        {
          id: '1',
          name: 'Cost Optimization',
          description: 'Route to cheapest available provider',
          type: 'cost',
          priority: 1,
          isActive: true,
          config: { threshold: 0.001 },
        },
        {
          id: '2',
          name: 'Latency Guard',
          description: 'Failover when latency exceeds threshold',
          type: 'latency',
          priority: 2,
          isActive: true,
          config: { threshold: 5000, fallbackProvider: 'groq' },
        },
        {
          id: '3',
          name: 'Health Check Failover',
          description: 'Auto-failover on provider health issues',
          type: 'health',
          priority: 3,
          isActive: true,
          config: {},
        },
        {
          id: '4',
          name: 'EU Data Residency',
          description: 'Route EU users to EU-based providers',
          type: 'geographic',
          priority: 4,
          isActive: false,
          config: { region: 'eu' },
        },
      ]);
    } catch (err) {
      toast.error('Failed to load routing configuration');
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, isActive: !r.isActive } : r))
    );
    toast.success('Rule updated');
  };

  const getTypeIcon = (type: RoutingRule['type']) => {
    switch (type) {
      case 'cost':
        return <Scale size={16} className="text-emerald-400" />;
      case 'latency':
        return <Zap size={16} className="text-amber-400" />;
      case 'health':
        return <AlertCircle size={16} className="text-blue-400" />;
      case 'geographic':
        return <Globe size={16} className="text-purple-400" />;
      case 'load_balance':
        return <Layers size={16} className="text-cyan-400" />;
      default:
        return <Settings size={16} />;
    }
  };

  const getTypeBadgeColor = (type: RoutingRule['type']) => {
    switch (type) {
      case 'cost':
        return 'bg-emerald-500/10 text-emerald-400';
      case 'latency':
        return 'bg-amber-500/10 text-amber-400';
      case 'health':
        return 'bg-blue-500/10 text-blue-400';
      case 'geographic':
        return 'bg-purple-500/10 text-purple-400';
      case 'load_balance':
        return 'bg-cyan-500/10 text-cyan-400';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Route size={24} className="text-indigo-500" />
            Routing Rules
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure intelligent model routing and failover policies
          </p>
        </div>
        <button
          onClick={() => setShowAddRule(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={16} />
          Add Rule
        </button>
      </div>

      {/* Model Routing per Tier */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Server size={18} className="text-slate-500" />
          Model Routing per Tier
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Define which LLM model to use for different complexity levels.
        </p>

        <div className="space-y-4">
          {tierRoutings.map((item) => (
            <div
              key={item.tier}
              className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-navy-900/50 rounded-lg border border-slate-200 dark:border-navy-700"
            >
              <div className="flex-1">
                <div className="font-medium text-slate-900 dark:text-white">{item.label}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{item.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={item.defaultModel}
                  className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="o1-preview">o1-preview</option>
                  <option value="claude-3-haiku">claude-3-haiku</option>
                  <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                </select>
                <ArrowRight size={16} className="text-slate-400" />
                <select
                  value={item.fallbackModel}
                  className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                >
                  <option value="">No fallback</option>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="claude-3-haiku">claude-3-haiku</option>
                  <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                  <option value="groq-llama">groq-llama</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Routing Rules */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Route size={18} className="text-slate-500" />
          Active Routing Rules
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Rules are evaluated in priority order. First matching rule is applied.
        </p>

        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                rule.isActive
                  ? 'bg-slate-50 dark:bg-navy-900/50 border-slate-200 dark:border-navy-700'
                  : 'bg-slate-100 dark:bg-navy-950/50 border-slate-200 dark:border-navy-800 opacity-60'
              }`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 font-mono text-sm">
                {rule.priority}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-900 dark:text-white">{rule.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeColor(rule.type)}`}
                  >
                    {getTypeIcon(rule.type)}
                    <span className="ml-1">{rule.type}</span>
                  </span>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{rule.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    rule.isActive
                      ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-500 hover:text-emerald-500'
                  }`}
                >
                  <Check size={16} />
                </button>
                <button className="p-2 rounded-lg bg-slate-200 dark:bg-navy-700 text-slate-500 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Circuit Breaker Settings */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <AlertCircle size={18} className="text-slate-500" />
          Circuit Breaker Configuration
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Failure Threshold
            </label>
            <input
              type="number"
              defaultValue={5}
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Number of failures before circuit opens
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Cooldown Period (seconds)
            </label>
            <input
              type="number"
              defaultValue={60}
              className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Wait time before retrying failed provider
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoutingRulesTab;
