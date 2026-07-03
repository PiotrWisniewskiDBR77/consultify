import {
  AlertCircle,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Globe,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { User } from '../../types';
import { OrganizationContextOverview } from './OrganizationContextOverview';

interface OrganizationProfileFormProps {
  currentUser: User;
  organizationId?: string;
}

interface OrganizationProfile {
  industry: string;
  industry_code: string;
  industry_subsector: string;
  company_size: 'STARTUP' | 'SMB' | 'MID_MARKET' | 'ENTERPRISE';
  employee_count: number;
  annual_revenue: number;
  founding_year: number;
  headquarters_country: string;
  strategic_priorities: string[];
  competitive_position: 'LEADER' | 'CHALLENGER' | 'FOLLOWER' | 'NICHE';
  growth_stage: 'STARTUP' | 'SCALE_UP' | 'MATURE' | 'TURNAROUND';
  mission_statement: string;
  vision_statement: string;
  digital_maturity_overall: number;
  technology_stack: string[];
  digital_budget_percent: number;
  cloud_adoption_level: 'NONE' | 'EXPLORING' | 'PARTIAL' | 'CLOUD_FIRST' | 'CLOUD_NATIVE';
  primary_markets: string[];
  customer_segments: string[];
  key_competitors: string[];
  market_share_estimate: number;
  regulatory_environment: string[];
  risk_appetite: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  budget_constraints: string;
  timeline_constraints: string;
  preferred_language: string;
  communication_style: 'FORMAL' | 'PROFESSIONAL' | 'CASUAL';
  industry_jargon_level: 'LOW' | 'MEDIUM' | 'HIGH';
  currency: string;
}

const INDUSTRIES = [
  'Technology',
  'Financial Services',
  'Healthcare',
  'Industrial',
  'Consumer',
  'Energy',
  'Telecommunications',
  'Real Estate',
  'Transportation',
  'Education',
  'Government',
  'Other',
];

const COMPANY_SIZES = [
  { value: 'STARTUP', label: 'Startup (<50)', range: '< 50' },
  { value: 'SMB', label: 'SMB (50-250)', range: '50-250' },
  { value: 'MID_MARKET', label: 'Mid-Market (250-1000)', range: '250-1000' },
  { value: 'ENTERPRISE', label: 'Enterprise (1000+)', range: '1000+' },
];

const COMPETITIVE_POSITIONS = [
  {
    value: 'LEADER',
    label: 'Market Leader',
    description: 'Dominant position, setting industry standards',
  },
  {
    value: 'CHALLENGER',
    label: 'Challenger',
    description: 'Growing, actively competing for leadership',
  },
  { value: 'FOLLOWER', label: 'Follower', description: 'Stable position, following market trends' },
  { value: 'NICHE', label: 'Niche Player', description: 'Specialized focus on specific segments' },
];

const GROWTH_STAGES = [
  { value: 'STARTUP', label: 'Startup', description: 'Early stage, product-market fit focus' },
  { value: 'SCALE_UP', label: 'Scale-up', description: 'Rapid growth, scaling operations' },
  { value: 'MATURE', label: 'Mature', description: 'Established, optimizing efficiency' },
  { value: 'TURNAROUND', label: 'Turnaround', description: 'Restructuring or transformation' },
];

const CLOUD_LEVELS = [
  { value: 'NONE', label: 'None' },
  { value: 'EXPLORING', label: 'Exploring' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'CLOUD_FIRST', label: 'Cloud-First' },
  { value: 'CLOUD_NATIVE', label: 'Cloud-Native' },
];

const RISK_APPETITES = [
  { value: 'CONSERVATIVE', label: 'Conservative', description: 'Low risk tolerance' },
  { value: 'MODERATE', label: 'Moderate', description: 'Balanced approach' },
  { value: 'AGGRESSIVE', label: 'Aggressive', description: 'High risk tolerance for growth' },
];

const REGULATIONS = [
  'GDPR',
  'HIPAA',
  'SOX',
  'PCI-DSS',
  'ISO 27001',
  'SOC 2',
  'CCPA',
  'DORA',
  'NIS2',
  'FISMA',
  'FedRAMP',
];

const CURRENCIES = [
  { code: 'PLN', symbol: 'zł', label: 'PLN – Polski złoty' },
  { code: 'EUR', symbol: '€', label: 'EUR – Euro' },
  { code: 'USD', symbol: '$', label: 'USD – US Dollar' },
  { code: 'GBP', symbol: '£', label: 'GBP – British Pound' },
  { code: 'CHF', symbol: 'Fr', label: 'CHF – Swiss Franc' },
  { code: 'SEK', symbol: 'kr', label: 'SEK – Swedish Krona' },
  { code: 'NOK', symbol: 'kr', label: 'NOK – Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', label: 'DKK – Danish Krone' },
  { code: 'CZK', symbol: 'Kč', label: 'CZK – Czech Koruna' },
  { code: 'HUF', symbol: 'Ft', label: 'HUF – Hungarian Forint' },
  { code: 'RON', symbol: 'lei', label: 'RON – Romanian Leu' },
  { code: 'CAD', symbol: 'C$', label: 'CAD – Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'AUD – Australian Dollar' },
  { code: 'JPY', symbol: '¥', label: 'JPY – Japanese Yen' },
  { code: 'CNY', symbol: '¥', label: 'CNY – Chinese Yuan' },
  { code: 'INR', symbol: '₹', label: 'INR – Indian Rupee' },
  { code: 'BRL', symbol: 'R$', label: 'BRL – Brazilian Real' },
];

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  poland: 'PLN',
  polska: 'PLN',
  pl: 'PLN',
  germany: 'EUR',
  deutschland: 'EUR',
  de: 'EUR',
  france: 'EUR',
  fr: 'EUR',
  italy: 'EUR',
  italia: 'EUR',
  it: 'EUR',
  spain: 'EUR',
  españa: 'EUR',
  es: 'EUR',
  netherlands: 'EUR',
  nl: 'EUR',
  austria: 'EUR',
  österreich: 'EUR',
  at: 'EUR',
  belgium: 'EUR',
  be: 'EUR',
  ireland: 'EUR',
  ie: 'EUR',
  portugal: 'EUR',
  pt: 'EUR',
  finland: 'EUR',
  fi: 'EUR',
  greece: 'EUR',
  gr: 'EUR',
  'united states': 'USD',
  usa: 'USD',
  us: 'USD',
  'united kingdom': 'GBP',
  uk: 'GBP',
  gb: 'GBP',
  switzerland: 'CHF',
  schweiz: 'CHF',
  ch: 'CHF',
  sweden: 'SEK',
  se: 'SEK',
  norway: 'NOK',
  no: 'NOK',
  denmark: 'DKK',
  dk: 'DKK',
  'czech republic': 'CZK',
  czechia: 'CZK',
  cz: 'CZK',
  hungary: 'HUF',
  hu: 'HUF',
  romania: 'RON',
  ro: 'RON',
  canada: 'CAD',
  ca: 'CAD',
  australia: 'AUD',
  au: 'AUD',
  japan: 'JPY',
  jp: 'JPY',
  china: 'CNY',
  cn: 'CNY',
  india: 'INR',
  in: 'INR',
  brazil: 'BRL',
  br: 'BRL',
};

const getDefaultCurrency = (country: string | undefined): string => {
  if (!country) return 'USD';
  return COUNTRY_TO_CURRENCY[country.toLowerCase().trim()] || 'USD';
};

interface IndustryCodeSystem {
  label: string;
  placeholder: string;
}

const INDUSTRY_CODE_SYSTEMS: Record<string, IndustryCodeSystem> = {
  poland: { label: 'PKD', placeholder: 'np. 25.11.Z, 62.01.Z' },
  polska: { label: 'PKD', placeholder: 'np. 25.11.Z, 62.01.Z' },
  pl: { label: 'PKD', placeholder: 'np. 25.11.Z, 62.01.Z' },
  germany: { label: 'WZ', placeholder: 'z.B. 25.11, 62.01' },
  deutschland: { label: 'WZ', placeholder: 'z.B. 25.11, 62.01' },
  de: { label: 'WZ', placeholder: 'z.B. 25.11, 62.01' },
  austria: { label: 'ÖNACE', placeholder: 'e.g., 25.11, 62.01' },
  österreich: { label: 'ÖNACE', placeholder: 'z.B. 25.11, 62.01' },
  at: { label: 'ÖNACE', placeholder: 'z.B. 25.11, 62.01' },
  france: { label: 'NAF', placeholder: 'ex. 25.11Z, 62.01Z' },
  fr: { label: 'NAF', placeholder: 'ex. 25.11Z, 62.01Z' },
  'united states': { label: 'NAICS', placeholder: 'e.g., 5112, 5221' },
  usa: { label: 'NAICS', placeholder: 'e.g., 5112, 5221' },
  us: { label: 'NAICS', placeholder: 'e.g., 5112, 5221' },
  canada: { label: 'NAICS', placeholder: 'e.g., 5112, 5221' },
  ca: { label: 'NAICS', placeholder: 'e.g., 5112, 5221' },
  'united kingdom': { label: 'SIC', placeholder: 'e.g., 25110, 62012' },
  uk: { label: 'SIC', placeholder: 'e.g., 25110, 62012' },
  gb: { label: 'SIC', placeholder: 'e.g., 25110, 62012' },
  netherlands: { label: 'SBI', placeholder: 'e.g., 2511, 6201' },
  nl: { label: 'SBI', placeholder: 'e.g., 2511, 6201' },
  italy: { label: 'ATECO', placeholder: 'es. 25.11, 62.01' },
  italia: { label: 'ATECO', placeholder: 'es. 25.11, 62.01' },
  it: { label: 'ATECO', placeholder: 'es. 25.11, 62.01' },
  spain: { label: 'CNAE', placeholder: 'ej. 2511, 6201' },
  españa: { label: 'CNAE', placeholder: 'ej. 2511, 6201' },
  es: { label: 'CNAE', placeholder: 'ej. 2511, 6201' },
  sweden: { label: 'SNI', placeholder: 'e.g., 25.110, 62.010' },
  se: { label: 'SNI', placeholder: 'e.g., 25.110, 62.010' },
  japan: { label: 'JSIC', placeholder: 'e.g., 2411, 3911' },
  jp: { label: 'JSIC', placeholder: 'e.g., 2411, 3911' },
  australia: { label: 'ANZSIC', placeholder: 'e.g., 2291, 7000' },
  au: { label: 'ANZSIC', placeholder: 'e.g., 2291, 7000' },
};

const DEFAULT_INDUSTRY_CODE_SYSTEM: IndustryCodeSystem = {
  label: 'NAICS/GICS',
  placeholder: 'e.g., 5112, 5221',
};

const getIndustryCodeSystem = (country: string | undefined): IndustryCodeSystem => {
  if (!country) return DEFAULT_INDUSTRY_CODE_SYSTEM;
  return INDUSTRY_CODE_SYSTEMS[country.toLowerCase().trim()] || DEFAULT_INDUSTRY_CODE_SYSTEM;
};

/**
 * Input for comma-separated lists.
 * Stores raw text while editing, converts to array on blur.
 */
const CommaListInput: React.FC<{
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const displayValue = editing ? text : (value || []).join(', ');

  return (
    <input
      type="text"
      value={displayValue}
      onFocus={() => {
        setEditing(true);
        setText((value || []).join(', '));
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const parsed = text
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        onChange(parsed);
      }}
      placeholder={placeholder}
      className={className}
    />
  );
};

export const OrganizationProfileForm: React.FC<OrganizationProfileFormProps> = ({
  currentUser,
  organizationId,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [completeness, setCompleteness] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    industry: true,
    company: false,
    strategic: false,
    digital: false,
    market: false,
    constraints: false,
    ai: false,
  });

  const [profile, setProfile] = useState<Partial<OrganizationProfile>>({
    industry: '',
    company_size: 'MID_MARKET',
    competitive_position: 'CHALLENGER',
    growth_stage: 'MATURE',
    risk_appetite: 'MODERATE',
    cloud_adoption_level: 'PARTIAL',
    communication_style: 'PROFESSIONAL',
    industry_jargon_level: 'MEDIUM',
    preferred_language: 'pl',
    strategic_priorities: [],
    technology_stack: [],
    primary_markets: [],
    customer_segments: [],
    key_competitors: [],
    regulatory_environment: [],
  });

  const effectiveOrgId = organizationId || currentUser.organizationId;
  const canRebuildContext = [
    'admin',
    'administrator',
    'owner',
    'superadmin',
    'super_admin',
  ].includes(
    String(currentUser?.role || '')
      .trim()
      .toLowerCase()
  );

  useEffect(() => {
    if (effectiveOrgId) {
      fetchProfile();
    }
  }, [effectiveOrgId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await Api.get(`/organization-profiles/${effectiveOrgId}`);
      if (response.exists && response.profile) {
        setProfile(response.profile);
      }
      setCompleteness(response.completeness || 0);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!effectiveOrgId) return;

    try {
      setSaving(true);
      const response = await Api.put(`/organization-profiles/${effectiveOrgId}`, profile);
      setCompleteness(response.completeness || 0);
      toast.success('Profile saved successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyze = async () => {
    if (!effectiveOrgId) return;

    try {
      setAnalyzing(true);
      const response = await Api.post(`/organization-profiles/${effectiveOrgId}/analyze`, {
        analysisType: 'strategic_positioning',
      });
      toast.success('Analysis complete');
      // Could open a modal with results
      console.log('Analysis:', response.analysis);
    } catch (error: any) {
      toast.error(error.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const updateField = (field: keyof OrganizationProfile, value: any) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const updateArrayField = (field: keyof OrganizationProfile, value: string) => {
    const current = (profile[field] as string[]) || [];
    if (current.includes(value)) {
      updateField(
        field,
        current.filter((v) => v !== value)
      );
    } else {
      updateField(field, [...current, value]);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const renderSectionHeader = (
    id: string,
    title: string,
    icon: React.ReactNode,
    completionPct?: number
  ) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-4 bg-c-surface-raised rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-950 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="text-c-accent">{icon}</div>
        <span className="font-semibold text-navy-900">{title}</span>
        {completionPct !== undefined && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              completionPct >= 80
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : completionPct >= 50
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-c-surface-raised text-c-text-secondary'
            }`}
          >
            {completionPct}%
          </span>
        )}
      </div>
      {expandedSections[id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
    </button>
  );

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Building2 className="text-c-accent" />
            Strategic Profile
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            Define your organization context for AI-powered strategic insights
          </p>
        </div>

        {/* Completeness Indicator */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-c-text-muted">Profile Completeness</div>
            <div className="text-2xl font-bold text-navy-900">{completeness}%</div>
          </div>
          <div className="w-16 h-16 relative">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                className="stroke-c-border-subtle"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                className="stroke-c-accent"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${completeness * 1.76} 176`}
                strokeLinecap="round"
              />
            </svg>
            {completeness >= 80 && (
              <CheckCircle
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green-500"
                size={24}
              />
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-c-accent hover:bg-c-accent text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Profile
        </button>
        <button
          onClick={handleAnalyze}
          disabled={analyzing || completeness < 30}
          className="flex items-center gap-2 px-4 py-2 bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-navy-700 text-navy-900 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          AI Analysis
        </button>
        <button
          onClick={fetchProfile}
          className="flex items-center gap-2 px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-800 rounded-lg transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <OrganizationContextOverview organizationId={effectiveOrgId} canRebuild={canRebuildContext} />

      {/* Sections */}
      <div className="space-y-4">
        {/* Industry Context */}
        <div className="bg-c-surface rounded-xl border border-c-border-subtle dark:border-navy-700 overflow-hidden">
          {renderSectionHeader('industry', 'Industry Context', <Briefcase size={20} />)}
          {expandedSections.industry && (
            <div className="p-6 space-y-4 border-t border-c-border-subtle dark:border-navy-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Industry *
                  </label>
                  <select
                    value={profile.industry || ''}
                    onChange={(e) => updateField('industry', e.target.value)}
                    className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                  >
                    <option value="">Select Industry</option>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Industry Subsector
                  </label>
                  <input
                    type="text"
                    value={profile.industry_subsector || ''}
                    onChange={(e) => updateField('industry_subsector', e.target.value)}
                    placeholder="e.g., SaaS, Fintech, E-commerce"
                    className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                {(() => {
                  const codeSystem = getIndustryCodeSystem(profile.headquarters_country);
                  return (
                    <>
                      <label className="block text-sm font-medium text-c-text-secondary mb-2">
                        {t('admin.strategicProfile.industryCode', {
                          system: codeSystem.label,
                          defaultValue: `Industry Code (${codeSystem.label})`,
                        })}
                      </label>
                      <input
                        type="text"
                        value={profile.industry_code || ''}
                        onChange={(e) => updateField('industry_code', e.target.value)}
                        placeholder={codeSystem.placeholder}
                        className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                      />
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Company Info */}
        <div className="bg-c-surface rounded-xl border border-c-border-subtle dark:border-navy-700 overflow-hidden">
          {renderSectionHeader('company', 'Company Information', <Building2 size={20} />)}
          {expandedSections.company && (
            <div className="p-6 space-y-4 border-t border-c-border-subtle dark:border-navy-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Company Size *
                  </label>
                  <select
                    value={profile.company_size || 'MID_MARKET'}
                    onChange={(e) => updateField('company_size', e.target.value)}
                    className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                  >
                    {COMPANY_SIZES.map((size) => (
                      <option key={size.value} value={size.value}>
                        {size.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Employee Count
                  </label>
                  <input
                    type="number"
                    value={profile.employee_count || ''}
                    onChange={(e) =>
                      updateField('employee_count', parseInt(e.target.value) || null)
                    }
                    placeholder="e.g., 500"
                    className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    {t('admin.strategicProfile.annualRevenue', {
                      currency:
                        profile.currency || getDefaultCurrency(profile.headquarters_country),
                      defaultValue: `Annual Revenue (${profile.currency || getDefaultCurrency(profile.headquarters_country)})`,
                    })}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={profile.annual_revenue || ''}
                      onChange={(e) =>
                        updateField('annual_revenue', parseFloat(e.target.value) || null)
                      }
                      placeholder="e.g., 50000000"
                      className="flex-1 px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                    />
                    <select
                      value={profile.currency || getDefaultCurrency(profile.headquarters_country)}
                      onChange={(e) => updateField('currency', e.target.value)}
                      className="w-28 px-2 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none text-sm"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} {c.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Founding Year
                  </label>
                  <input
                    type="number"
                    value={profile.founding_year || ''}
                    onChange={(e) => updateField('founding_year', parseInt(e.target.value) || null)}
                    placeholder="e.g., 2010"
                    className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Headquarters Country
                </label>
                <input
                  type="text"
                  value={profile.headquarters_country || ''}
                  onChange={(e) => updateField('headquarters_country', e.target.value)}
                  placeholder="e.g., Poland"
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Strategic Context */}
        <div className="bg-c-surface rounded-xl border border-c-border-subtle dark:border-navy-700 overflow-hidden">
          {renderSectionHeader('strategic', 'Strategic Context', <Target size={20} />)}
          {expandedSections.strategic && (
            <div className="p-6 space-y-4 border-t border-c-border-subtle dark:border-navy-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Competitive Position *
                  </label>
                  <select
                    value={profile.competitive_position || 'CHALLENGER'}
                    onChange={(e) => updateField('competitive_position', e.target.value)}
                    className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                  >
                    {COMPETITIVE_POSITIONS.map((pos) => (
                      <option key={pos.value} value={pos.value}>
                        {pos.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-c-text-muted mt-1">
                    {
                      COMPETITIVE_POSITIONS.find((p) => p.value === profile.competitive_position)
                        ?.description
                    }
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Growth Stage *
                  </label>
                  <select
                    value={profile.growth_stage || 'MATURE'}
                    onChange={(e) => updateField('growth_stage', e.target.value)}
                    className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                  >
                    {GROWTH_STAGES.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-c-text-muted mt-1">
                    {GROWTH_STAGES.find((s) => s.value === profile.growth_stage)?.description}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Strategic Priorities (comma-separated)
                </label>
                <CommaListInput
                  value={profile.strategic_priorities || []}
                  onChange={(val) => updateField('strategic_priorities', val)}
                  placeholder="e.g., Digital transformation, Customer experience, Cost optimization"
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Mission Statement
                </label>
                <textarea
                  value={profile.mission_statement || ''}
                  onChange={(e) => updateField('mission_statement', e.target.value)}
                  rows={2}
                  placeholder="What is your organization's mission?"
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Digital Context */}
        <div className="bg-c-surface rounded-xl border border-c-border-subtle dark:border-navy-700 overflow-hidden">
          {renderSectionHeader('digital', 'Digital & Technology', <Cpu size={20} />)}
          {expandedSections.digital && (
            <div className="p-6 space-y-4 border-t border-c-border-subtle dark:border-navy-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Digital Maturity Self-Assessment (1-7)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    step="0.1"
                    value={profile.digital_maturity_overall || ''}
                    onChange={(e) =>
                      updateField('digital_maturity_overall', parseFloat(e.target.value) || null)
                    }
                    placeholder="e.g., 4.5"
                    className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-2">
                    Cloud Adoption Level
                  </label>
                  <select
                    value={profile.cloud_adoption_level || 'PARTIAL'}
                    onChange={(e) => updateField('cloud_adoption_level', e.target.value)}
                    className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                  >
                    {CLOUD_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Digital Budget (% of total IT spend)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={profile.digital_budget_percent || ''}
                  onChange={(e) =>
                    updateField('digital_budget_percent', parseFloat(e.target.value) || null)
                  }
                  placeholder="e.g., 25"
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Technology Stack (comma-separated)
                </label>
                <CommaListInput
                  value={profile.technology_stack || []}
                  onChange={(val) => updateField('technology_stack', val)}
                  placeholder="e.g., AWS, React, Python, Kubernetes"
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Market Context */}
        <div className="bg-c-surface rounded-xl border border-c-border-subtle dark:border-navy-700 overflow-hidden">
          {renderSectionHeader('market', 'Market & Competition', <TrendingUp size={20} />)}
          {expandedSections.market && (
            <div className="p-6 space-y-4 border-t border-c-border-subtle dark:border-navy-700">
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Primary Markets (comma-separated)
                </label>
                <CommaListInput
                  value={profile.primary_markets || []}
                  onChange={(val) => updateField('primary_markets', val)}
                  placeholder="e.g., Poland, DACH, CEE"
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Customer Segments (comma-separated)
                </label>
                <CommaListInput
                  value={profile.customer_segments || []}
                  onChange={(val) => updateField('customer_segments', val)}
                  placeholder="e.g., B2B, Enterprise, SMB"
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Key Competitors (comma-separated)
                </label>
                <CommaListInput
                  value={profile.key_competitors || []}
                  onChange={(val) => updateField('key_competitors', val)}
                  placeholder="e.g., Competitor A, Competitor B"
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Estimated Market Share (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={profile.market_share_estimate || ''}
                  onChange={(e) =>
                    updateField('market_share_estimate', parseFloat(e.target.value) || null)
                  }
                  placeholder="e.g., 15"
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Constraints */}
        <div className="bg-c-surface rounded-xl border border-c-border-subtle dark:border-navy-700 overflow-hidden">
          {renderSectionHeader('constraints', 'Constraints & Risk', <Shield size={20} />)}
          {expandedSections.constraints && (
            <div className="p-6 space-y-4 border-t border-c-border-subtle dark:border-navy-700">
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('admin.strategicProfile.regulatoryEnvironment', {
                    defaultValue: 'Regulatory Environment',
                  })}
                </label>
                <p className="text-xs text-c-text-muted mb-2">
                  {t('admin.strategicProfile.regulatoryEnvironmentHint', {
                    defaultValue:
                      'Select regulations and standards your organization is currently subject to or must comply with.',
                  })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {REGULATIONS.map((reg) => (
                    <button
                      key={reg}
                      onClick={() => updateArrayField('regulatory_environment', reg)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        (profile.regulatory_environment || []).includes(reg)
                          ? 'bg-c-accent-soft border-c-accent text-c-accent dark:border-c-accent'
                          : 'bg-c-surface-raised border-c-border-subtle text-c-text-secondary dark:border-navy-700 hover:border-c-accent'
                      }`}
                    >
                      {reg}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Risk Appetite
                </label>
                <div className="flex gap-3">
                  {RISK_APPETITES.map((risk) => (
                    <button
                      key={risk.value}
                      onClick={() => updateField('risk_appetite', risk.value)}
                      className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
                        profile.risk_appetite === risk.value
                          ? 'bg-c-accent-soft border-c-accent text-c-accent dark:border-c-accent'
                          : 'bg-c-surface-raised border-c-border-subtle text-c-text-secondary dark:border-navy-700 hover:border-c-accent'
                      }`}
                    >
                      <div className="font-medium">{risk.label}</div>
                      <div className="text-xs mt-1 opacity-70">{risk.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('admin.strategicProfile.budgetConstraints', {
                    defaultValue: 'Strategic Initiative Budget Constraints',
                  })}
                </label>
                <p className="text-xs text-c-text-muted mb-2">
                  {t('admin.strategicProfile.budgetConstraintsHint', {
                    defaultValue:
                      'Describe budget limits for digital transformation, consulting, or strategic projects — not the overall company budget.',
                  })}
                </p>
                <textarea
                  value={profile.budget_constraints || ''}
                  onChange={(e) => updateField('budget_constraints', e.target.value)}
                  rows={2}
                  placeholder={t('admin.strategicProfile.budgetConstraintsPlaceholder', {
                    defaultValue:
                      'e.g., Max 500k EUR/year for digital initiatives; IT modernization capped at 200k',
                  })}
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('admin.strategicProfile.timelineConstraints', {
                    defaultValue: 'Timeline Constraints',
                  })}
                </label>
                <p className="text-xs text-c-text-muted mb-2">
                  {t('admin.strategicProfile.timelineConstraintsHint', {
                    defaultValue:
                      'Key deadlines or time pressures affecting strategic decisions — e.g., regulatory deadlines, board milestones, contract renewals.',
                  })}
                </p>
                <textarea
                  value={profile.timeline_constraints || ''}
                  onChange={(e) => updateField('timeline_constraints', e.target.value)}
                  rows={2}
                  placeholder={t('admin.strategicProfile.timelineConstraintsPlaceholder', {
                    defaultValue:
                      'e.g., DORA compliance by Q1 2027; ERP migration must finish before license renewal in Oct 2026',
                  })}
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)] focus:outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end gap-3 pt-4 border-t border-c-border-subtle dark:border-navy-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-c-accent hover:bg-c-accent text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Save Strategic Profile
        </button>
      </div>
    </div>
  );
};

export default OrganizationProfileForm;
