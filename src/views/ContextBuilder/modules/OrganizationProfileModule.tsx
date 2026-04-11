/**
 * OrganizationProfileModule — Unified canonical organization profile.
 * P30-D: Replaces split-brain CompanyProfileModule (localStorage) + OrganizationProfileForm (admin).
 * All data persists through API to P30 SSOT.
 * Teresa AI guidance helps users complete their profile.
 */
import {
  AlertCircle,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Factory,
  Globe,
  Loader2,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';

type OrganizationType = 'MANUFACTURING' | 'SERVICES' | 'TECHNOLOGY' | 'PUBLIC_SECTOR' | 'NONPROFIT' | 'OTHER' | '';

interface OrgProfile {
  name: string;
  organization_type: OrganizationType;
  industry: string;
  industry_code: string;
  industry_subsector: string;
  companySize: string;
  employee_count: number | null;
  annual_revenue: number | null;
  founding_year: number | null;
  headquarters_country: string;
  currency: string;
  revenue_model: string;
  delivery_model: string;
  core_systems: string[];
  strategic_priorities: string[];
  competitive_position: string;
  growth_stage: string;
  mission_statement: string;
  vision_statement: string;
  digital_maturity_overall: number | null;
  technology_stack: string[];
  cloud_adoption_level: string;
  digital_budget_percent: number | null;
  primary_markets: string[];
  customer_segments: string[];
  key_competitors: string[];
  market_share_estimate: number | null;
  regulatory_environment: string[];
  risk_appetite: string;
  budget_constraints: string;
  timeline_constraints: string;
  description: string;
  website: string;
}

const EMPTY_PROFILE: OrgProfile = {
  name: '',
  organization_type: '',
  industry: '',
  industry_code: '',
  industry_subsector: '',
  companySize: '',
  employee_count: null,
  annual_revenue: null,
  founding_year: null,
  headquarters_country: '',
  currency: 'USD',
  revenue_model: '',
  delivery_model: '',
  core_systems: [],
  strategic_priorities: [],
  competitive_position: '',
  growth_stage: '',
  mission_statement: '',
  vision_statement: '',
  digital_maturity_overall: null,
  technology_stack: [],
  cloud_adoption_level: '',
  digital_budget_percent: null,
  primary_markets: [],
  customer_segments: [],
  key_competitors: [],
  market_share_estimate: null,
  regulatory_environment: [],
  risk_appetite: '',
  budget_constraints: '',
  timeline_constraints: '',
  description: '',
  website: '',
};

const ORG_TYPES: Array<{ value: OrganizationType; label: string; icon: React.ReactNode; hint: string }> = [
  { value: 'MANUFACTURING', label: 'Manufacturing', icon: <Factory size={20} />, hint: 'Production, assembly, process industry' },
  { value: 'SERVICES', label: 'Professional Services', icon: <Briefcase size={20} />, hint: 'Consulting, legal, accounting, staffing' },
  { value: 'TECHNOLOGY', label: 'Technology', icon: <Cpu size={20} />, hint: 'Software, SaaS, hardware, IT services' },
  { value: 'PUBLIC_SECTOR', label: 'Public Sector', icon: <Building2 size={20} />, hint: 'Government, education, healthcare' },
  { value: 'NONPROFIT', label: 'Nonprofit / NGO', icon: <Globe size={20} />, hint: 'Foundations, associations, social enterprises' },
  { value: 'OTHER', label: 'Other', icon: <BarChart3 size={20} />, hint: 'Retail, real estate, energy, transport, etc.' },
];

const INDUSTRIES = [
  'Technology', 'Financial Services', 'Healthcare', 'Manufacturing', 'Industrial',
  'Consumer', 'Energy', 'Telecommunications', 'Real Estate', 'Transportation & Logistics',
  'Education', 'Government', 'Retail & E-commerce', 'Media & Entertainment',
  'Agriculture', 'Construction', 'Hospitality', 'Professional Services', 'Other',
];

const COMPANY_SIZES = [
  { value: 'STARTUP', label: 'Startup (< 50)' },
  { value: 'SMB', label: 'SMB (50-250)' },
  { value: 'MID_MARKET', label: 'Mid-Market (250-1000)' },
  { value: 'ENTERPRISE', label: 'Enterprise (1000+)' },
];

const GROWTH_STAGES = [
  { value: 'STARTUP', label: 'Startup' },
  { value: 'SCALE_UP', label: 'Scale-up' },
  { value: 'MATURE', label: 'Mature' },
  { value: 'TURNAROUND', label: 'Turnaround' },
];

const COMPETITIVE_POSITIONS = [
  { value: 'LEADER', label: 'Market Leader' },
  { value: 'CHALLENGER', label: 'Challenger' },
  { value: 'FOLLOWER', label: 'Follower' },
  { value: 'NICHE', label: 'Niche Player' },
];

const RISK_APPETITES = [
  { value: 'CONSERVATIVE', label: 'Conservative' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'AGGRESSIVE', label: 'Aggressive' },
];

const CLOUD_LEVELS = ['NONE', 'EXPLORING', 'PARTIAL', 'CLOUD_FIRST', 'CLOUD_NATIVE'];

const REGULATIONS = ['GDPR', 'HIPAA', 'SOX', 'PCI-DSS', 'ISO 27001', 'SOC 2', 'CCPA', 'DORA', 'NIS2', 'ISO 9001', 'ISO 14001', 'IATF 16949'];

const REVENUE_MODELS = ['Subscription / SaaS', 'Project-based', 'Product sales', 'Managed services', 'Licensing', 'Grant-funded', 'Mixed / Hybrid'];

const DELIVERY_MODELS = ['Projects', 'Products', 'Managed services', 'Platform / Marketplace', 'Consulting engagements', 'Mixed'];

const CORE_SYSTEMS_OPTIONS = ['SAP ERP', 'Oracle ERP', 'Microsoft Dynamics', 'Salesforce CRM', 'HubSpot CRM', 'MES / SCADA', 'PLM / PDM', 'ServiceNow', 'Jira / Confluence', 'Custom / In-house'];

const CommaInput: React.FC<{
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const display = editing ? text : (value || []).join(', ');
  return (
    <input
      type="text"
      value={display}
      onFocus={() => { setEditing(true); setText((value || []).join(', ')); }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { setEditing(false); onChange(text.split(',').map(s => s.trim()).filter(Boolean)); }}
      placeholder={placeholder}
      className={className}
    />
  );
};

function computeCompleteness(p: OrgProfile): number {
  const checks = [
    p.organization_type, p.industry, p.companySize, p.headquarters_country,
    p.strategic_priorities.length > 0, p.competitive_position, p.growth_stage,
    p.technology_stack.length > 0, p.mission_statement, p.description,
    p.employee_count, p.risk_appetite, p.regulatory_environment.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getTeresaGuidance(p: OrgProfile, completeness: number): { message: string; field: string } | null {
  if (!p.organization_type) return { message: 'Start by selecting your organization type — this helps me show you the right questions.', field: 'organization_type' };
  if (!p.industry) return { message: 'Which industry are you in? This is key for benchmarking and competitive analysis.', field: 'industry' };
  if (!p.companySize) return { message: 'What is your company size? This helps calibrate recommendations to your scale.', field: 'company' };
  if (p.strategic_priorities.length === 0) return { message: 'Add your strategic priorities — AI uses them to align every recommendation with your goals.', field: 'strategic' };
  if (!p.mission_statement) return { message: 'A mission statement helps AI maintain consistency across all generated content.', field: 'strategic' };
  if (p.technology_stack.length === 0) return { message: 'List your technology stack — Assessment and Tool recommendations improve significantly with this.', field: 'digital' };
  if (p.regulatory_environment.length === 0) return { message: 'Select applicable regulations — AI will avoid suggesting non-compliant solutions.', field: 'constraints' };
  if (completeness < 80) return { message: `Your profile is ${completeness}% complete. The more context you provide, the better AI can help you.`, field: '' };
  return null;
}

const inputCls = 'w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5';

export const OrganizationProfileModule: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, currentOrganization } = useAppStore();
  const orgId = currentOrganization?.id || currentUser?.organizationId;

  const [profile, setProfile] = useState<OrgProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    type: true, identity: false, operating: false, strategic: false,
    digital: false, market: false, people: false, constraints: false,
  });
  const [showTeresa, setShowTeresa] = useState(true);

  const completeness = useMemo(() => computeCompleteness(profile), [profile]);
  const teresaHint = useMemo(() => showTeresa ? getTeresaGuidance(profile, completeness) : null, [profile, completeness, showTeresa]);

  const update = useCallback(<K extends keyof OrgProfile>(field: K, value: OrgProfile[K]) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await Api.get(`/organization-profiles/${orgId}`);
        if (res.exists && res.profile) {
          setProfile(prev => ({
            ...prev,
            ...res.profile,
            strategic_priorities: Array.isArray(res.profile.strategic_priorities) ? res.profile.strategic_priorities : [],
            technology_stack: Array.isArray(res.profile.technology_stack) ? res.profile.technology_stack : [],
            core_systems: Array.isArray(res.profile.core_systems) ? res.profile.core_systems : [],
            primary_markets: Array.isArray(res.profile.primary_markets) ? res.profile.primary_markets : [],
            customer_segments: Array.isArray(res.profile.customer_segments) ? res.profile.customer_segments : [],
            key_competitors: Array.isArray(res.profile.key_competitors) ? res.profile.key_competitors : [],
            regulatory_environment: Array.isArray(res.profile.regulatory_environment) ? res.profile.regulatory_environment : [],
          }));
          if (res.profile.organization_type) {
            setExpandedSections(prev => ({ ...prev, type: false, identity: true }));
          }
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      await Api.put(`/organization-profiles/${orgId}`, profile);
      toast.success(t('organization.profileSaved', 'Profile saved'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const isManufacturing = profile.organization_type === 'MANUFACTURING';
  const needsDeliveryModel = ['SERVICES', 'TECHNOLOGY', 'PUBLIC_SECTOR'].includes(profile.organization_type);
  const needsRevenueModel = ['SERVICES', 'TECHNOLOGY', 'PUBLIC_SECTOR', 'NONPROFIT'].includes(profile.organization_type);

  const SectionHeader: React.FC<{
    id: string; title: string; icon: React.ReactNode; pct?: number;
  }> = ({ id, title, icon, pct }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-950 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="text-purple-500">{icon}</div>
        <span className="font-semibold text-navy-900 dark:text-white text-sm">{title}</span>
        {pct !== undefined && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${pct >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : pct >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
            {pct}%
          </span>
        )}
      </div>
      {expandedSections[id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Building2 className="text-purple-500" size={22} />
            {t('organization.profile.title', 'Organization Profile')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {t('organization.profile.subtitle', 'Define your organization context for AI-powered insights')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400">Completeness</div>
            <div className="text-lg font-bold text-navy-900 dark:text-white">{completeness}%</div>
          </div>
          <div className="w-12 h-12 relative">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle cx="24" cy="24" r="20" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="3" fill="none" />
              <circle cx="24" cy="24" r="20" className="stroke-purple-500" strokeWidth="3" fill="none" strokeDasharray={`${completeness * 1.26} 126`} strokeLinecap="round" />
            </svg>
            {completeness >= 80 && <CheckCircle className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green-500" size={18} />}
          </div>
        </div>
      </div>

      {/* Teresa AI Guidance */}
      {teresaHint && (
        <div className="bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-navy-900 border border-purple-100 dark:border-purple-800/50 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg text-purple-600 shrink-0">
            <Bot size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-navy-900 dark:text-white flex items-center gap-2">
              Teresa
              <span className="text-[10px] font-normal px-1.5 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 rounded-full">AI Guide</span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{teresaHint.message}</p>
          </div>
          <button onClick={() => {
            if (teresaHint.field) {
              setExpandedSections(prev => ({ ...prev, [teresaHint.field]: true }));
            }
          }} className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors shrink-0">
            Go
          </button>
          <button onClick={() => setShowTeresa(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1">
            <span className="sr-only">Dismiss</span>×
          </button>
        </div>
      )}

      {/* Save bar */}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {t('common.save', 'Save')}
        </button>
      </div>

      <div className="space-y-3">
        {/* Section 1: Organization Type */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <SectionHeader id="type" title="Organization Type" icon={<Building2 size={18} />} />
          {expandedSections.type && (
            <div className="p-5 border-t border-slate-200 dark:border-navy-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Select the type that best describes your organization. This determines which questions are most relevant.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ORG_TYPES.map(ot => (
                  <label key={ot.value} className="relative cursor-pointer group">
                    <input type="radio" name="orgType" className="peer sr-only" checked={profile.organization_type === ot.value} onChange={() => {
                      update('organization_type', ot.value);
                      setExpandedSections(prev => ({ ...prev, type: false, identity: true }));
                    }} />
                    <div className="h-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-navy-950/50 hover:border-purple-300 transition-all flex flex-col items-center text-center peer-checked:ring-2 peer-checked:ring-purple-500 peer-checked:border-transparent peer-checked:bg-white dark:peer-checked:bg-navy-800">
                      <div className="text-slate-500 dark:text-slate-400 mb-2 peer-checked:text-purple-600">{ot.icon}</div>
                      <div className="font-semibold text-sm text-navy-900 dark:text-white">{ot.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{ot.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Identity & Scale */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <SectionHeader id="identity" title="Identity & Scale" icon={<Briefcase size={18} />} />
          {expandedSections.identity && (
            <div className="p-5 border-t border-slate-200 dark:border-navy-700 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Industry *</label>
                  <select value={profile.industry} onChange={e => update('industry', e.target.value)} className={inputCls}>
                    <option value="">Select Industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Sub-Industry</label>
                  <input type="text" value={profile.industry_subsector} onChange={e => update('industry_subsector', e.target.value)} placeholder="e.g., Automotive Parts, Fintech" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Industry Code</label>
                  <input type="text" value={profile.industry_code} onChange={e => update('industry_code', e.target.value)} placeholder="e.g., PKD 25.11.Z, NAICS 5112" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Company Size *</label>
                  <select value={profile.companySize} onChange={e => update('companySize', e.target.value)} className={inputCls}>
                    <option value="">Select Size</option>
                    {COMPANY_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Employee Count</label>
                  <input type="number" value={profile.employee_count ?? ''} onChange={e => update('employee_count', e.target.value ? parseInt(e.target.value) : null)} placeholder="e.g., 500" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Annual Revenue</label>
                  <input type="number" value={profile.annual_revenue ?? ''} onChange={e => update('annual_revenue', e.target.value ? parseFloat(e.target.value) : null)} placeholder="e.g., 50000000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Founding Year</label>
                  <input type="number" value={profile.founding_year ?? ''} onChange={e => update('founding_year', e.target.value ? parseInt(e.target.value) : null)} placeholder="e.g., 2010" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Headquarters Country</label>
                  <input type="text" value={profile.headquarters_country} onChange={e => update('headquarters_country', e.target.value)} placeholder="e.g., Poland" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={profile.description} onChange={e => update('description', e.target.value)} rows={2} placeholder="Brief description of your organization" className={inputCls + ' resize-none'} />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Operating Model (conditional) */}
        {(isManufacturing || needsDeliveryModel || needsRevenueModel) && (
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <SectionHeader id="operating" title="Operating Model" icon={<Factory size={18} />} />
            {expandedSections.operating && (
              <div className="p-5 border-t border-slate-200 dark:border-navy-700 space-y-4">
                {needsDeliveryModel && (
                  <div>
                    <label className={labelCls}>Delivery Model</label>
                    <select value={profile.delivery_model} onChange={e => update('delivery_model', e.target.value)} className={inputCls}>
                      <option value="">Select...</option>
                      {DELIVERY_MODELS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
                {needsRevenueModel && (
                  <div>
                    <label className={labelCls}>Revenue / Funding Model</label>
                    <select value={profile.revenue_model} onChange={e => update('revenue_model', e.target.value)} className={inputCls}>
                      <option value="">Select...</option>
                      {REVENUE_MODELS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className={labelCls}>Core Systems</label>
                  <div className="flex flex-wrap gap-2">
                    {CORE_SYSTEMS_OPTIONS.map(sys => (
                      <button key={sys} onClick={() => {
                        const cur = profile.core_systems;
                        update('core_systems', cur.includes(sys) ? cur.filter(s => s !== sys) : [...cur, sys]);
                      }} className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${profile.core_systems.includes(sys) ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500/30 dark:text-purple-300' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-navy-950 dark:border-navy-700 dark:text-slate-400 hover:border-purple-300'}`}>
                        {sys}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Strategic Position */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <SectionHeader id="strategic" title="Strategic Position" icon={<Target size={18} />} />
          {expandedSections.strategic && (
            <div className="p-5 border-t border-slate-200 dark:border-navy-700 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Competitive Position</label>
                  <select value={profile.competitive_position} onChange={e => update('competitive_position', e.target.value)} className={inputCls}>
                    <option value="">Select...</option>
                    {COMPETITIVE_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Growth Stage</label>
                  <select value={profile.growth_stage} onChange={e => update('growth_stage', e.target.value)} className={inputCls}>
                    <option value="">Select...</option>
                    {GROWTH_STAGES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Strategic Priorities</label>
                <CommaInput value={profile.strategic_priorities} onChange={v => update('strategic_priorities', v)} placeholder="e.g., Digital transformation, Cost optimization, Growth" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Mission Statement</label>
                <textarea value={profile.mission_statement} onChange={e => update('mission_statement', e.target.value)} rows={2} placeholder="What is your organization's mission?" className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className={labelCls}>Vision Statement</label>
                <textarea value={profile.vision_statement} onChange={e => update('vision_statement', e.target.value)} rows={2} placeholder="Where do you see the organization in 3-5 years?" className={inputCls + ' resize-none'} />
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Digital & Technology */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <SectionHeader id="digital" title="Digital & Technology" icon={<Cpu size={18} />} />
          {expandedSections.digital && (
            <div className="p-5 border-t border-slate-200 dark:border-navy-700 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Digital Maturity (1-7)</label>
                  <input type="number" min={1} max={7} step={0.1} value={profile.digital_maturity_overall ?? ''} onChange={e => update('digital_maturity_overall', e.target.value ? parseFloat(e.target.value) : null)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Cloud Adoption</label>
                  <select value={profile.cloud_adoption_level} onChange={e => update('cloud_adoption_level', e.target.value)} className={inputCls}>
                    <option value="">Select...</option>
                    {CLOUD_LEVELS.map(l => <option key={l} value={l}>{l.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Technology Stack</label>
                <CommaInput value={profile.technology_stack} onChange={v => update('technology_stack', v)} placeholder="e.g., AWS, React, Python, SAP" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Digital Budget (% of IT spend)</label>
                <input type="number" min={0} max={100} value={profile.digital_budget_percent ?? ''} onChange={e => update('digital_budget_percent', e.target.value ? parseFloat(e.target.value) : null)} className={inputCls} />
              </div>
            </div>
          )}
        </div>

        {/* Section 6: Market & Competition */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <SectionHeader id="market" title="Market & Competition" icon={<TrendingUp size={18} />} />
          {expandedSections.market && (
            <div className="p-5 border-t border-slate-200 dark:border-navy-700 space-y-4">
              <div>
                <label className={labelCls}>Primary Markets</label>
                <CommaInput value={profile.primary_markets} onChange={v => update('primary_markets', v)} placeholder="e.g., Poland, DACH, CEE" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Customer Segments</label>
                <CommaInput value={profile.customer_segments} onChange={v => update('customer_segments', v)} placeholder="e.g., B2B Enterprise, SMB, Consumer" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Key Competitors</label>
                <CommaInput value={profile.key_competitors} onChange={v => update('key_competitors', v)} placeholder="e.g., Competitor A, Competitor B" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Market Share (%)</label>
                <input type="number" min={0} max={100} value={profile.market_share_estimate ?? ''} onChange={e => update('market_share_estimate', e.target.value ? parseFloat(e.target.value) : null)} className={inputCls} />
              </div>
            </div>
          )}
        </div>

        {/* Section 7: Constraints & Risk */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <SectionHeader id="constraints" title="Constraints & Risk" icon={<Shield size={18} />} />
          {expandedSections.constraints && (
            <div className="p-5 border-t border-slate-200 dark:border-navy-700 space-y-4">
              <div>
                <label className={labelCls}>Regulatory Environment</label>
                <div className="flex flex-wrap gap-2">
                  {REGULATIONS.map(reg => (
                    <button key={reg} onClick={() => {
                      const cur = profile.regulatory_environment;
                      update('regulatory_environment', cur.includes(reg) ? cur.filter(r => r !== reg) : [...cur, reg]);
                    }} className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${profile.regulatory_environment.includes(reg) ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500/30 dark:text-purple-300' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-navy-950 dark:border-navy-700 dark:text-slate-400 hover:border-purple-300'}`}>
                      {reg}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Risk Appetite</label>
                <div className="flex gap-3">
                  {RISK_APPETITES.map(r => (
                    <button key={r.value} onClick={() => update('risk_appetite', r.value)} className={`flex-1 p-3 rounded-lg border text-center text-sm transition-colors ${profile.risk_appetite === r.value ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500/30 dark:text-purple-300' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-navy-950 dark:border-navy-700 dark:text-slate-400 hover:border-purple-300'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Budget Constraints</label>
                <textarea value={profile.budget_constraints} onChange={e => update('budget_constraints', e.target.value)} rows={2} placeholder="e.g., Max 500k EUR/year for digital initiatives" className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className={labelCls}>Timeline Constraints</label>
                <textarea value={profile.timeline_constraints} onChange={e => update('timeline_constraints', e.target.value)} rows={2} placeholder="e.g., DORA compliance by Q1 2027" className={inputCls + ' resize-none'} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom save */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-navy-700">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {t('common.saveProfile', 'Save Profile')}
        </button>
      </div>
    </div>
  );
};

export default OrganizationProfileModule;
