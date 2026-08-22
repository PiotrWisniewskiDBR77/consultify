/**
 * OrganizationProfileModule — Unified canonical organization profile.
 * P30-D: Replaces split-brain CompanyProfileModule (localStorage) + OrganizationProfileForm (admin).
 * All data persists through API to P30 SSOT.
 * Teresa AI guidance helps users complete their profile.
 *
 * Phase 2: Conditional sections per org type, manufacturing fields, taxonomy unification
 * Phase 3: Cross-validation, completeness coaching, downstream readiness, document extraction
 */
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle,
  Cpu,
  Factory,
  FileText,
  Globe,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { SettingsHeaderActionPortal } from '../../../components/settings/SettingsHeaderActions';
import TeresaMark from '../../../components/shared/TeresaMark';
import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';

type OrganizationType =
  | 'MANUFACTURING'
  | 'SERVICES'
  | 'TECHNOLOGY'
  | 'PUBLIC_SECTOR'
  | 'NONPROFIT'
  | 'OTHER'
  | '';

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
  communication_style: string;
  industry_jargon_level: string;
  production_archetype: string;
  shift_pattern: string;
  automation_level: string;
}

type ProfileArea =
  | 'type'
  | 'identity'
  | 'production'
  | 'operating'
  | 'strategic'
  | 'digital'
  | 'market'
  | 'communication'
  | 'constraints'
  | 'document-extraction'
  | 'readiness';

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
  communication_style: '',
  industry_jargon_level: '',
  production_archetype: '',
  shift_pattern: '',
  automation_level: '',
};

// ─── Canonical Taxonomies (single source for all surfaces) ───

const ORG_TYPES: Array<{
  value: OrganizationType;
  label: string;
  icon: React.ReactNode;
  hint: string;
}> = [
  {
    value: 'MANUFACTURING',
    label: 'Manufacturing',
    icon: <Factory size={20} />,
    hint: 'Production, assembly, process industry',
  },
  {
    value: 'SERVICES',
    label: 'Professional Services',
    icon: <Briefcase size={20} />,
    hint: 'Consulting, legal, accounting, staffing',
  },
  {
    value: 'TECHNOLOGY',
    label: 'Technology',
    icon: <Cpu size={20} />,
    hint: 'Software, SaaS, hardware, IT services',
  },
  {
    value: 'PUBLIC_SECTOR',
    label: 'Public Sector',
    icon: <Building2 size={20} />,
    hint: 'Government, education, healthcare',
  },
  {
    value: 'NONPROFIT',
    label: 'Nonprofit / NGO',
    icon: <Globe size={20} />,
    hint: 'Foundations, associations, social enterprises',
  },
  {
    value: 'OTHER',
    label: 'Other',
    icon: <BarChart3 size={20} />,
    hint: 'Retail, real estate, energy, transport, etc.',
  },
];

const INDUSTRIES = [
  'Technology',
  'Financial Services',
  'Healthcare',
  'Manufacturing',
  'Industrial',
  'Consumer',
  'Energy',
  'Telecommunications',
  'Real Estate',
  'Transportation & Logistics',
  'Education',
  'Government',
  'Retail & E-commerce',
  'Media & Entertainment',
  'Agriculture',
  'Construction',
  'Hospitality',
  'Professional Services',
  'Other',
];

const COMPANY_SIZES = [
  { value: 'STARTUP', label: 'Startup (< 50)', max: 50 },
  { value: 'SMB', label: 'SMB (50-250)', max: 250 },
  { value: 'MID_MARKET', label: 'Mid-Market (250-1000)', max: 1000 },
  { value: 'ENTERPRISE', label: 'Enterprise (1000+)', max: Infinity },
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
  'ISO 9001',
  'ISO 14001',
  'IATF 16949',
];

const REVENUE_MODELS = [
  'Subscription / SaaS',
  'Project-based',
  'Product sales',
  'Managed services',
  'Licensing',
  'Grant-funded',
  'Mixed / Hybrid',
];

const DELIVERY_MODELS = [
  'Projects',
  'Products',
  'Managed services',
  'Platform / Marketplace',
  'Consulting engagements',
  'Mixed',
];

const CORE_SYSTEMS_OPTIONS = [
  'SAP ERP',
  'Oracle ERP',
  'Microsoft Dynamics',
  'Salesforce CRM',
  'HubSpot CRM',
  'MES / SCADA',
  'PLM / PDM',
  'ServiceNow',
  'Jira / Confluence',
  'Custom / In-house',
];

const PRODUCTION_ARCHETYPES = [
  { value: 'DISCRETE', label: 'Discrete Manufacturing' },
  { value: 'PROCESS', label: 'Process Manufacturing' },
  { value: 'HYBRID', label: 'Hybrid' },
];

const SHIFT_PATTERNS = [
  { value: 'SINGLE', label: 'Single Shift' },
  { value: 'DOUBLE', label: 'Double Shift' },
  { value: 'TRIPLE', label: 'Triple Shift' },
  { value: 'CONTINUOUS', label: 'Continuous (24/7)' },
];

const AUTOMATION_LEVELS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'SEMI_AUTOMATED', label: 'Semi-Automated' },
  { value: 'FULLY_AUTOMATED', label: 'Fully Automated' },
];

const COMMUNICATION_STYLES = [
  { value: 'FORMAL', label: 'Formal' },
  { value: 'BUSINESS_CASUAL', label: 'Business Casual' },
  { value: 'CASUAL', label: 'Casual / Startup' },
  { value: 'TECHNICAL', label: 'Technical / Engineering' },
];

const JARGON_LEVELS = [
  { value: 'NONE', label: 'Plain language' },
  { value: 'MODERATE', label: 'Moderate industry terms' },
  { value: 'HEAVY', label: 'Heavy industry jargon' },
];

const optionKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_');

// ─── Conditional section visibility per §11.4 ───

function showProductionSection(orgType: OrganizationType): boolean {
  return orgType === 'MANUFACTURING';
}
function showDeliveryModel(orgType: OrganizationType): boolean {
  return ['SERVICES', 'TECHNOLOGY', 'PUBLIC_SECTOR'].includes(orgType);
}
function showRevenueModel(orgType: OrganizationType): boolean {
  return ['SERVICES', 'TECHNOLOGY', 'PUBLIC_SECTOR', 'NONPROFIT'].includes(orgType);
}
function showCoreSystems(orgType: OrganizationType): boolean {
  return ['MANUFACTURING', 'SERVICES', 'TECHNOLOGY', 'PUBLIC_SECTOR'].includes(orgType);
}
function showOperatingSection(orgType: OrganizationType): boolean {
  return Boolean(orgType);
}

// ─── Cross-validation (Phase 3.1) ───

interface ValidationWarning {
  code: string;
  field: string;
  message: string;
  severity: 'warning' | 'info';
}

function crossValidate(p: OrgProfile): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (p.companySize && p.employee_count) {
    const sizeEntry = COMPANY_SIZES.find((s) => s.value === p.companySize);
    if (sizeEntry) {
      const prevMax = COMPANY_SIZES[COMPANY_SIZES.indexOf(sizeEntry) - 1]?.max ?? 0;
      if (p.employee_count > sizeEntry.max) {
        warnings.push({
          code: 'employeeAboveRange',
          field: 'identity',
          message: `Employee count (${p.employee_count}) exceeds "${sizeEntry.label}" range. Consider updating company size.`,
          severity: 'warning',
        });
      } else if (p.employee_count <= prevMax) {
        warnings.push({
          code: 'employeeBelowRange',
          field: 'identity',
          message: `Employee count (${p.employee_count}) is below "${sizeEntry.label}" range. Consider updating company size.`,
          severity: 'warning',
        });
      }
    }
  }

  if (
    p.organization_type === 'MANUFACTURING' &&
    p.industry &&
    !['Manufacturing', 'Industrial', 'Construction', 'Energy', 'Agriculture'].includes(p.industry)
  ) {
    warnings.push({
      code: 'industryTypeMismatch',
      field: 'identity',
      message: `Industry "${p.industry}" is uncommon for Manufacturing org type. If correct, keep it — AI will adapt.`,
      severity: 'info',
    });
  }

  if (p.founding_year && (p.founding_year > new Date().getFullYear() || p.founding_year < 1800)) {
    warnings.push({
      code: 'foundingYear',
      field: 'identity',
      message: `Founding year ${p.founding_year} seems unusual. Please verify.`,
      severity: 'warning',
    });
  }

  if (p.growth_stage === 'STARTUP' && p.companySize === 'ENTERPRISE') {
    warnings.push({
      code: 'startupEnterprise',
      field: 'strategic',
      message: 'Growth stage "Startup" combined with "Enterprise" size is unusual. Please verify.',
      severity: 'info',
    });
  }

  return warnings;
}

// ─── Completeness coaching (Phase 3.2) — tells user WHY each field matters ───

interface CompletenessHint {
  id: string;
  message: string;
  field: string;
  downstream: string;
}

function getTeresaGuidance(p: OrgProfile, completeness: number): CompletenessHint | null {
  if (!p.organization_type)
    return {
      id: 'organizationType',
      message:
        'Start by selecting your organization type — this helps me show you the right questions.',
      field: 'organization_type',
      downstream: 'All modules',
    };
  if (!p.industry)
    return {
      id: 'industry',
      message:
        'Which industry are you in? Assessment uses this for benchmarking and framework selection.',
      field: 'identity',
      downstream: 'Assessment, Competitive Intelligence',
    };
  if (!p.companySize)
    return {
      id: 'companySize',
      message: 'What is your company size? This calibrates recommendations to your scale.',
      field: 'identity',
      downstream: 'Assessment, Planning, Reports',
    };
  if (p.strategic_priorities.length === 0)
    return {
      id: 'strategicPriorities',
      message:
        'Add strategic priorities — AI aligns every recommendation, initiative, and report to your goals.',
      field: 'strategic',
      downstream: 'Deep Research, Initiatives, Reports',
    };
  if (!p.mission_statement)
    return {
      id: 'mission',
      message: 'A mission statement helps AI maintain consistency across all generated content.',
      field: 'strategic',
      downstream: 'Reports, Presentations, AI Chat',
    };
  if (p.technology_stack.length === 0)
    return {
      id: 'technologyStack',
      message:
        'List your tech stack — Assessment and Tool recommendations improve significantly with this.',
      field: 'digital',
      downstream: 'Assessment, Tools, Integration Planning',
    };
  if (p.regulatory_environment.length === 0)
    return {
      id: 'regulations',
      message: 'Select applicable regulations — AI will avoid suggesting non-compliant solutions.',
      field: 'constraints',
      downstream: 'Assessment, Risk Management, Initiatives',
    };
  if (!p.communication_style)
    return {
      id: 'communicationStyle',
      message:
        'Set your preferred communication style — Teresa will adapt her language to match your culture.',
      field: 'communication',
      downstream: 'All AI interactions',
    };
  if (p.organization_type === 'MANUFACTURING' && !p.production_archetype)
    return {
      id: 'productionType',
      message:
        'Select your production type — this helps Assessment evaluate Industry 4.0 readiness accurately.',
      field: 'production',
      downstream: 'Assessment, Tool Recommendations',
    };
  if (completeness < 80)
    return {
      id: 'completeness',
      message: `Your profile is ${completeness}% complete. The more context you provide, the better AI can help you.`,
      field: '',
      downstream: 'All modules',
    };
  return null;
}

// ─── Downstream readiness indicators (Phase 3.3) ───

interface ReadinessCheck {
  module: string;
  label: string;
  ready: boolean;
  missing: string[];
}

function computeDownstreamReadiness(p: OrgProfile): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  const assessmentMissing: string[] = [];
  if (!p.industry) assessmentMissing.push('industry');
  if (!p.companySize) assessmentMissing.push('company size');
  checks.push({
    module: 'assessment',
    label: 'Assessment & Benchmarking',
    ready: assessmentMissing.length === 0,
    missing: assessmentMissing,
  });

  const researchMissing: string[] = [];
  if (!p.industry) researchMissing.push('industry');
  if (p.strategic_priorities.length === 0) researchMissing.push('strategic priorities');
  checks.push({
    module: 'research',
    label: 'Deep Research',
    ready: researchMissing.length === 0,
    missing: researchMissing,
  });

  const reportsMissing: string[] = [];
  if (!p.name && !p.industry) reportsMissing.push('name or industry');
  if (!p.companySize) reportsMissing.push('company size');
  checks.push({
    module: 'reports',
    label: 'Reports & Presentations',
    ready: reportsMissing.length === 0,
    missing: reportsMissing,
  });

  const compIntelMissing: string[] = [];
  if (!p.industry) compIntelMissing.push('industry');
  if (p.key_competitors.length === 0) compIntelMissing.push('key competitors');
  checks.push({
    module: 'competitive',
    label: 'Competitive Intelligence',
    ready: compIntelMissing.length === 0,
    missing: compIntelMissing,
  });

  const aiChatMissing: string[] = [];
  if (!p.organization_type) aiChatMissing.push('organization type');
  checks.push({
    module: 'ai_chat',
    label: 'AI Chat (Teresa)',
    ready: aiChatMissing.length === 0,
    missing: aiChatMissing,
  });

  return checks;
}

// ─── Completeness calculation ───

function computeCompleteness(p: OrgProfile): number {
  const checks = [
    p.organization_type,
    p.industry,
    p.companySize,
    p.headquarters_country,
    p.strategic_priorities.length > 0,
    p.competitive_position,
    p.growth_stage,
    p.technology_stack.length > 0,
    p.mission_statement,
    p.description,
    p.employee_count,
    p.risk_appetite,
    p.regulatory_environment.length > 0,
    p.communication_style,
    p.key_competitors.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ─── Helpers ───

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
      onFocus={() => {
        setEditing(true);
        setText((value || []).join(', '));
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setEditing(false);
        onChange(
          text
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        );
      }}
      placeholder={placeholder}
      className={className}
    />
  );
};

const ChipSelector: React.FC<{
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}> = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => (
      <button
        key={opt}
        onClick={() => {
          onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
        }}
        className={`px-3 py-1.5 text-xs rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] ${value.includes(opt) ? 'bg-[var(--c-selection)] border-[var(--c-selection-border)] text-[var(--c-text)]' : 'bg-c-bg border-c-border-subtle text-c-text-secondary dark:bg-navy-950 dark:border-navy-700 dark:text-c-text-muted hover:border-[var(--c-border-strong)]'}`}
      >
        {opt}
      </button>
    ))}
  </div>
);

const inputCls =
  'w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg focus:ring-2 focus:ring-[var(--c-focus)] focus:border-[var(--c-focus-solid)] focus:outline-none text-sm';
const labelCls = 'block text-sm font-medium text-c-text-secondary mb-1.5';

// ─── Main Component ───

type ProfileScreen =
  | 'identity-scale'
  | 'operating-model'
  | 'position-direction'
  | 'technology-culture-constraints';

const PROFILE_SCREEN_AREAS: Record<ProfileScreen, ProfileArea[]> = {
  'identity-scale': ['type', 'identity'],
  'operating-model': ['production', 'operating', 'market'],
  'position-direction': ['strategic'],
  'technology-culture-constraints': ['digital', 'communication', 'constraints'],
};

export const OrganizationProfileModule: React.FC<{ screen?: ProfileScreen }> = ({ screen }) => {
  const { t } = useTranslation();
  const { currentUser, currentOrganization } = useAppStore();
  const orgId = currentOrganization?.id || currentUser?.organizationId;

  const [profile, setProfile] = useState<OrgProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [showReadiness, setShowReadiness] = useState(false);
  const [activeProfileArea, setActiveProfileArea] = useState<ProfileArea>('type');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    type: true,
    identity: true,
    production: true,
    operating: true,
    strategic: true,
    digital: true,
    market: true,
    communication: true,
    constraints: true,
  });
  const [showTeresa, setShowTeresa] = useState(true);
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [docExtractProposals, setDocExtractProposals] = useState<
    Array<{ field: string; label: string; value: string; accepted: boolean | null }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const completeness = useMemo(() => computeCompleteness(profile), [profile]);
  const teresaHint = useMemo(
    () => (showTeresa ? getTeresaGuidance(profile, completeness) : null),
    [profile, completeness, showTeresa]
  );
  const readiness = useMemo(() => computeDownstreamReadiness(profile), [profile]);

  const update = useCallback(<K extends keyof OrgProfile>(field: K, value: OrgProfile[K]) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }, []);

  const openSection = (id: string) => {
    const knownSections: ProfileArea[] = [
      'type',
      'identity',
      'production',
      'operating',
      'strategic',
      'digital',
      'market',
      'communication',
      'constraints',
    ];
    if (knownSections.includes(id as ProfileArea)) setActiveProfileArea(id as ProfileArea);
    setExpandedSections((prev) => ({ ...prev, [id]: true }));
  };

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await Api.get(`/organization-profiles/${orgId}`);
        if (res.exists && res.profile) {
          const arrayFields = [
            'strategic_priorities',
            'technology_stack',
            'core_systems',
            'primary_markets',
            'customer_segments',
            'key_competitors',
            'regulatory_environment',
          ] as const;
          const parsed: Partial<OrgProfile> = { ...res.profile };
          for (const f of arrayFields) {
            (parsed as any)[f] = Array.isArray(res.profile[f]) ? res.profile[f] : [];
          }
          setProfile((prev) => ({ ...prev, ...parsed }));
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

    const warnings = crossValidate(profile);
    setValidationWarnings(warnings);

    setSaving(true);
    try {
      await Api.put(`/organization-profiles/${orgId}`, {
        ...profile,
        profile_completeness: completeness,
      });
      const readback = await Api.get(`/organization-profiles/${orgId}`);
      const persistedCompleteness = Number(readback?.profile?.profile_completeness);
      if (!readback?.exists || !readback?.profile || persistedCompleteness !== completeness) {
        throw new Error(
          t(
            'organization.profile.readbackFailed',
            'Save request completed, but durable profile readback could not be verified.'
          )
        );
      }
      setProfile((previous) => ({ ...previous, ...readback.profile }));
      toast.success(t('organization.profile.saved', 'Profile saved'));
    } catch (err: any) {
      toast.error(err.message || t('organization.profile.saveFailed', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentExtract = async (file: File) => {
    if (!orgId) return;
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orgId', orgId);
      const res = await (Api.post as any)('/ai/extract-org-context', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.proposals && Array.isArray(res.proposals)) {
        setDocExtractProposals(res.proposals.map((p: any) => ({ ...p, accepted: null })));
        toast.success(`Teresa extracted ${res.proposals.length} field(s) from the document`);
      } else {
        toast.error(
          t(
            'organization.profile.extraction.empty',
            'No fields could be extracted from this document'
          )
        );
      }
    } catch {
      toast.error(
        t(
          'organization.profile.extraction.unavailable',
          'Document extraction is not yet configured on this server'
        )
      );
    } finally {
      setExtracting(false);
    }
  };

  const applyProposal = (idx: number, accept: boolean) => {
    setDocExtractProposals((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], accepted: accept };
      if (accept) {
        const { field, value } = next[idx];
        update(field as keyof OrgProfile, value as any);
      }
      return next;
    });
  };

  const orgType = profile.organization_type;
  const isAreaVisible = (area: ProfileArea) =>
    screen ? PROFILE_SCREEN_AREAS[screen].includes(area) : activeProfileArea === area;

  const SectionHeader: React.FC<{
    id: string;
    title: string;
    icon: React.ReactNode;
    badge?: string;
  }> = ({ title, icon, badge }) => (
    <div className="w-full flex items-center justify-between p-4 bg-c-surface-raised/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="text-primary-500">{icon}</div>
        <span className="font-semibold text-navy-900 dark:text-white text-sm">{title}</span>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {badge}
          </span>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  const readyCount = readiness.filter((r) => r.ready).length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {screen && (
        <SettingsHeaderActionPortal>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="type-control flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-white transition-colors hover:bg-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] disabled:opacity-50 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
          </button>
        </SettingsHeaderActionPortal>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Building2 className="text-primary-500" size={22} />
            {t('organization.profile.title', 'Organization Profile')}
          </h2>
          <p className="text-c-text-muted text-sm mt-0.5">
            {t(
              'organization.profile.subtitle',
              'Define your organization context for AI-powered insights'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-c-text-muted">
              {t('organization.profile.completeness', 'Completeness')}
            </div>
            <div className="text-lg font-bold text-navy-900 dark:text-white">{completeness}%</div>
          </div>
          <div className="w-12 h-12 relative">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                className="stroke-slate-200 dark:stroke-slate-700"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                className="stroke-primary-500"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${completeness * 1.26} 126`}
                strokeLinecap="round"
              />
            </svg>
            {completeness >= 80 && (
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-c-text-muted">
                DATA
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="-mt-3 text-right text-xs text-c-text-muted">
        {t(
          'organization.profile.completenessBoundary',
          'Data completeness, not decision readiness.'
        )}{' '}
        <a
          href="/organization/readiness/summary"
          className="font-medium text-[var(--c-info)] underline underline-offset-2"
        >
          {t('organization.profile.reviewReadiness', 'Review readiness')}
        </a>
      </p>

      {/* Teresa AI Guidance (Phase 3.2 — completeness coaching with downstream context) */}
      {!screen && (
        <nav aria-label={t('organization.profilePresentation.navigation')}>
          <p className="mb-2 text-xs text-c-text-muted">
            {t('organization.profilePresentation.hint')}
          </p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {(
              [
                ['type', 'type'],
                ['identity', 'identity'],
                ...(showProductionSection(orgType) ? [['production', 'production']] : []),
                ...(showOperatingSection(orgType) &&
                (showDeliveryModel(orgType) ||
                  showRevenueModel(orgType) ||
                  showCoreSystems(orgType))
                  ? [['operating', 'operating']]
                  : []),
                ['strategic', 'strategic'],
                ['digital', 'digital'],
                ['market', 'market'],
                ['communication', 'communication'],
                ['constraints', 'constraints'],
                ['document-extraction', 'documentExtraction'],
                ['readiness', 'readiness'],
              ] as Array<[ProfileArea, string]>
            ).map(([id, translationKey]) => {
              const active = activeProfileArea === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    setActiveProfileArea(id);
                    if (id === 'readiness') setShowReadiness(true);
                  }}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? 'border-[var(--c-selection-border)] bg-[var(--c-selection)] shadow-[inset_3px_0_0_var(--c-focus-solid)]'
                      : 'border-c-border-subtle bg-c-surface hover:bg-c-surface-raised'
                  }`}
                >
                  <span className="block text-sm font-semibold text-c-text">
                    {t(`organization.profilePresentation.sections.${translationKey}.label`)}
                  </span>
                  <span className="mt-1 block text-xs text-c-text-muted">
                    {t(`organization.profilePresentation.sections.${translationKey}.description`)}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {teresaHint && (
        <div className="bg-gradient-to-r from-primary-50 to-white dark:from-primary-900/20 dark:to-navy-900 border border-primary-100 dark:border-primary-800/50 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/50 rounded-lg text-primary-600 shrink-0">
            <TeresaMark size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-navy-900 dark:text-white flex items-center gap-2">
              Teresa
              <span className="text-[10px] font-normal px-1.5 py-0.5 bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-300 rounded-full">
                {t('organization.profile.aiGuide', 'AI Guide')}
              </span>
            </h4>
            <p className="text-xs text-c-text-secondary mt-1 leading-relaxed">
              {t(`organization.profile.guidance.${teresaHint.id}.message`, teresaHint.message, {
                completeness,
              })}
            </p>
            <p className="text-[10px] text-c-text-secondary mt-0.5">
              {t('organization.profile.usedBy', 'Used by:')}{' '}
              {t(
                `organization.profile.guidance.${teresaHint.id}.downstream`,
                teresaHint.downstream
              )}
            </p>
          </div>
          <button
            onClick={() => {
              if (teresaHint.field) {
                openSection(teresaHint.field);
              }
            }}
            className="px-3 py-1.5 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-xs font-medium rounded-lg hover:bg-navy-800 transition-colors shrink-0"
          >
            {t('organization.profile.go', 'Go')}
          </button>
          <button
            onClick={() => setShowTeresa(false)}
            className="text-c-text-secondary hover:text-c-text-secondary dark:hover:text-slate-300 p-1"
          >
            <span className="sr-only">{t('common.dismiss', 'Dismiss')}</span>&times;
          </button>
        </div>
      )}

      {/* Cross-validation warnings (Phase 3.1) */}
      {validationWarnings.length > 0 && (
        <div className="space-y-2">
          {validationWarnings.map((w, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${w.severity === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300' : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'}`}
            >
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                {t(`organization.profile.validation.${w.code}`, w.message, {
                  employeeCount: profile.employee_count,
                  companySize:
                    COMPANY_SIZES.find((size) => size.value === profile.companySize)?.label ?? '',
                  industry: profile.industry,
                  foundingYear: profile.founding_year,
                })}
              </span>
              <button
                onClick={() => openSection(w.field)}
                className="ml-auto text-[10px] underline shrink-0"
              >
                {t('common.fix', 'Fix')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Document extraction proposals (Phase 3.4) */}
      {activeProfileArea === 'document-extraction' && docExtractProposals.length > 0 && (
        <div className="bg-c-surface rounded-xl border border-primary-200 dark:border-primary-700 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            <Sparkles size={16} className="text-primary-500" />
            {t(
              'organization.profile.extraction.proposalsTitle',
              'Teresa extracted these fields from your document'
            )}
          </h4>
          {docExtractProposals.map((proposal, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-2 rounded-lg border ${proposal.accepted === true ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' : proposal.accepted === false ? 'bg-c-bg border-c-border-subtle dark:bg-navy-950 dark:border-navy-700 opacity-50' : 'bg-c-surface border-c-border-subtle dark:bg-navy-900 dark:border-navy-700'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-c-text-muted">{proposal.label}</div>
                <div className="text-sm text-navy-900 dark:text-white truncate">
                  {proposal.value}
                </div>
              </div>
              {proposal.accepted === null && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => applyProposal(idx, true)}
                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    {t('common.accept', 'Accept')}
                  </button>
                  <button
                    onClick={() => applyProposal(idx, false)}
                    className="px-2 py-1 bg-slate-300 text-c-text-secondary text-xs rounded hover:bg-slate-400 dark:bg-slate-600 dark:text-slate-200"
                  >
                    {t('common.reject', 'Reject')}
                  </button>
                </div>
              )}
              {proposal.accepted === true && (
                <CheckCircle size={16} className="text-green-500 shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-3 flex-wrap">
        {!screen && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t('common.save', 'Save')}
          </button>
        )}
        {activeProfileArea === 'document-extraction' && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={extracting}
            className="flex items-center gap-2 px-4 py-2 bg-c-surface border border-c-border-subtle hover:bg-c-surface-raised text-c-text-secondary rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {extracting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {t('organization.profile.extraction.action', 'Extract from document')}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.doc"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleDocumentExtract(file);
            e.target.value = '';
          }}
        />
        {activeProfileArea === 'readiness' && (
          <button
            onClick={() => setShowReadiness((prev) => !prev)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg font-medium text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] ${showReadiness ? 'bg-[var(--c-selection)] border-[var(--c-selection-border)] text-[var(--c-text)]' : 'bg-c-surface border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised'}`}
          >
            <Target size={16} />
            {t('organization.profile.readiness.label', 'Readiness')} {readyCount}/{readiness.length}
          </button>
        )}
      </div>

      {/* Downstream readiness indicators (Phase 3.3) */}
      {activeProfileArea === 'readiness' && showReadiness && (
        <div className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
          <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-3 flex items-center gap-2">
            <Target size={16} className="text-primary-500" />
            {t('organization.profile.readiness.title', 'Module Readiness')}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {readiness.map((r) => (
              <div
                key={r.module}
                className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${r.ready ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' : 'bg-c-bg border-c-border-subtle dark:bg-navy-950 dark:border-navy-700'}`}
              >
                {r.ready ? (
                  <CheckCircle size={14} className="text-green-500 shrink-0" />
                ) : (
                  <AlertCircle size={14} className="text-c-text-secondary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-xs font-medium ${r.ready ? 'text-green-700 dark:text-green-400' : 'text-c-text-secondary'}`}
                  >
                    {t(`organization.profile.readiness.modules.${r.module}.label`, r.label)}
                  </span>
                  {!r.ready && r.missing.length > 0 && (
                    <span className="text-[10px] text-c-text-secondary ml-1">
                      {t('organization.profile.readiness.needs', 'needs:')}{' '}
                      {r.missing
                        .map((item) =>
                          t(`organization.profile.readiness.fields.${optionKey(item)}`, item)
                        )
                        .join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Section 1: Organization Type */}
        <div
          hidden={!isAreaVisible('type')}
          className={
            isAreaVisible('type')
              ? 'bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden'
              : 'hidden'
          }
        >
          <SectionHeader
            id="type"
            title={t('organization.profilePresentation.sections.type.label')}
            icon={<Building2 size={18} />}
          />
          {expandedSections.type && (
            <div className="p-5 border-t border-c-border-subtle">
              <p className="text-xs text-c-text-muted mb-4">
                {t(
                  'organization.profile.typeHint',
                  'Select the type that best describes your organization. This determines which questions are most relevant.'
                )}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ORG_TYPES.map((ot) => (
                  <label key={ot.value} className="relative cursor-pointer group">
                    <input
                      type="radio"
                      name="orgType"
                      className="peer sr-only"
                      checked={profile.organization_type === ot.value}
                      onChange={() => {
                        update('organization_type', ot.value);
                        setExpandedSections((prev) => ({ ...prev, type: true, identity: true }));
                      }}
                    />
                    <div className="h-full p-3 rounded-xl border border-c-border-subtle bg-c-bg/50 dark:bg-navy-950/50 hover:border-[var(--c-border-strong)] transition-all flex flex-col items-center text-center peer-checked:ring-2 peer-checked:ring-[var(--c-focus-solid)] peer-checked:border-[var(--c-selection-border)] peer-checked:bg-[var(--c-selection)]">
                      <div className="text-c-text-muted mb-2 peer-checked:text-[var(--c-focus-solid)]">
                        {ot.icon}
                      </div>
                      <div className="font-semibold text-sm text-navy-900 dark:text-white">
                        {t(
                          `organization.profile.options.organizationType.${ot.value}.label`,
                          ot.label
                        )}
                      </div>
                      <div className="text-[10px] text-c-text-muted mt-1">
                        {t(
                          `organization.profile.options.organizationType.${ot.value}.hint`,
                          ot.hint
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Identity & Scale */}
        <div
          hidden={!isAreaVisible('identity')}
          className={
            isAreaVisible('identity')
              ? 'bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden'
              : 'hidden'
          }
        >
          <SectionHeader
            id="identity"
            title={t('organization.profilePresentation.sections.identity.label')}
            icon={<Briefcase size={18} />}
          />
          {expandedSections.identity && (
            <div className="p-5 border-t border-c-border-subtle space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('organization.profile.fields.industry')} *</label>
                  <select
                    value={profile.industry}
                    onChange={(e) => update('industry', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{t('organization.profile.selectIndustry')}</option>
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>
                        {t(`organization.profile.options.industry.${optionKey(i)}`, i)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('organization.profile.fields.subIndustry')}</label>
                  <input
                    type="text"
                    value={profile.industry_subsector}
                    onChange={(e) => update('industry_subsector', e.target.value)}
                    placeholder={t('organization.profile.placeholders.subIndustry')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t('organization.profile.fields.industryCode')}
                  </label>
                  <input
                    type="text"
                    value={profile.industry_code}
                    onChange={(e) => update('industry_code', e.target.value)}
                    placeholder={t('organization.profile.placeholders.industryCode')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t('organization.profile.fields.companySize')} *
                  </label>
                  <select
                    value={profile.companySize}
                    onChange={(e) => update('companySize', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{t('organization.profile.selectSize')}</option>
                    {COMPANY_SIZES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {t(`organization.profile.options.companySize.${s.value}`, s.label)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    {t('organization.profile.fields.employeeCount')}
                  </label>
                  <input
                    type="number"
                    value={profile.employee_count ?? ''}
                    onChange={(e) =>
                      update('employee_count', e.target.value ? parseInt(e.target.value) : null)
                    }
                    placeholder={t('organization.profile.placeholders.employeeCount')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t('organization.profile.fields.annualRevenue')}
                  </label>
                  <input
                    type="number"
                    value={profile.annual_revenue ?? ''}
                    onChange={(e) =>
                      update('annual_revenue', e.target.value ? parseFloat(e.target.value) : null)
                    }
                    placeholder={t('organization.profile.placeholders.annualRevenue')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t('organization.profile.fields.foundingYear')}
                  </label>
                  <input
                    type="number"
                    value={profile.founding_year ?? ''}
                    onChange={(e) =>
                      update('founding_year', e.target.value ? parseInt(e.target.value) : null)
                    }
                    placeholder={t('organization.profile.placeholders.foundingYear')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t('organization.profile.fields.headquartersCountry')}
                  </label>
                  <input
                    type="text"
                    value={profile.headquarters_country}
                    onChange={(e) => update('headquarters_country', e.target.value)}
                    placeholder={t('organization.profile.placeholders.headquartersCountry')}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('organization.profile.fields.description')}</label>
                <textarea
                  value={profile.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={2}
                  placeholder={t('organization.profile.placeholders.description')}
                  className={inputCls + ' resize-none'}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Production (MANUFACTURING only — §11.4) */}
        {showProductionSection(orgType) && (
          <div
            hidden={!isAreaVisible('production')}
            className={
              isAreaVisible('production')
                ? 'bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden'
                : 'hidden'
            }
          >
            <SectionHeader
              id="production"
              title={t('organization.profilePresentation.sections.production.label')}
              icon={<Factory size={18} />}
              badge={t('organization.profile.options.organizationType.MANUFACTURING.label')}
            />
            {expandedSections.production && (
              <div className="p-5 border-t border-c-border-subtle space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>
                      {t('organization.profile.fields.productionArchetype')}
                    </label>
                    <select
                      value={profile.production_archetype}
                      onChange={(e) => update('production_archetype', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">{t('organization.profile.select')}</option>
                      {PRODUCTION_ARCHETYPES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {t(
                            `organization.profile.options.productionArchetype.${p.value}`,
                            p.label
                          )}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>
                      {t('organization.profile.fields.shiftPattern')}
                    </label>
                    <select
                      value={profile.shift_pattern}
                      onChange={(e) => update('shift_pattern', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">{t('organization.profile.select')}</option>
                      {SHIFT_PATTERNS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {t(`organization.profile.options.shiftPattern.${s.value}`, s.label)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>
                      {t('organization.profile.fields.automationLevel')}
                    </label>
                    <select
                      value={profile.automation_level}
                      onChange={(e) => update('automation_level', e.target.value)}
                      className={inputCls}
                    >
                      <option value="">{t('organization.profile.select')}</option>
                      {AUTOMATION_LEVELS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {t(`organization.profile.options.automationLevel.${a.value}`, a.label)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Operating Model (conditional per §11.4) */}
        {showOperatingSection(orgType) &&
          (showDeliveryModel(orgType) || showRevenueModel(orgType) || showCoreSystems(orgType)) && (
            <div
              hidden={!isAreaVisible('operating')}
              className={
                isAreaVisible('operating')
                  ? 'bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden'
                  : 'hidden'
              }
            >
              <SectionHeader
                id="operating"
                title={t('organization.profilePresentation.sections.operating.label')}
                icon={<Factory size={18} />}
              />
              {expandedSections.operating && (
                <div className="p-5 border-t border-c-border-subtle space-y-4">
                  {showDeliveryModel(orgType) && (
                    <div>
                      <label className={labelCls}>
                        {t('organization.profile.fields.deliveryModel')}
                      </label>
                      <select
                        value={profile.delivery_model}
                        onChange={(e) => update('delivery_model', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">{t('organization.profile.select')}</option>
                        {DELIVERY_MODELS.map((d) => (
                          <option key={d} value={d}>
                            {t(`organization.profile.options.deliveryModel.${optionKey(d)}`, d)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {showRevenueModel(orgType) && (
                    <div>
                      <label className={labelCls}>
                        {orgType === 'NONPROFIT'
                          ? t('organization.profile.fields.fundingModel')
                          : t('organization.profile.fields.revenueFundingModel')}
                      </label>
                      <select
                        value={profile.revenue_model}
                        onChange={(e) => update('revenue_model', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">{t('organization.profile.select')}</option>
                        {REVENUE_MODELS.map((r) => (
                          <option key={r} value={r}>
                            {t(`organization.profile.options.revenueModel.${optionKey(r)}`, r)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {showCoreSystems(orgType) && (
                    <div>
                      <label className={labelCls}>
                        {t('organization.profile.fields.coreSystems')}
                      </label>
                      <ChipSelector
                        options={CORE_SYSTEMS_OPTIONS}
                        value={profile.core_systems}
                        onChange={(v) => update('core_systems', v)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        {/* Section 5: Strategic Position (Universal) */}
        <div
          hidden={!isAreaVisible('strategic')}
          className={
            isAreaVisible('strategic')
              ? 'bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden'
              : 'hidden'
          }
        >
          <SectionHeader
            id="strategic"
            title={t('organization.profilePresentation.sections.strategic.label')}
            icon={<Target size={18} />}
          />
          {expandedSections.strategic && (
            <div className="p-5 border-t border-c-border-subtle space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    {t('organization.profile.fields.competitivePosition')}
                  </label>
                  <select
                    value={profile.competitive_position}
                    onChange={(e) => update('competitive_position', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{t('organization.profile.select')}</option>
                    {COMPETITIVE_POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {t(`organization.profile.options.competitivePosition.${p.value}`, p.label)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('organization.profile.fields.growthStage')}</label>
                  <select
                    value={profile.growth_stage}
                    onChange={(e) => update('growth_stage', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{t('organization.profile.select')}</option>
                    {GROWTH_STAGES.map((g) => (
                      <option key={g.value} value={g.value}>
                        {t(`organization.profile.options.growthStage.${g.value}`, g.label)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>
                  {t('organization.profile.fields.strategicPriorities')}
                </label>
                <CommaInput
                  value={profile.strategic_priorities}
                  onChange={(v) => update('strategic_priorities', v)}
                  placeholder={t('organization.profile.placeholders.strategicPriorities')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('organization.profile.fields.missionStatement')}
                </label>
                <textarea
                  value={profile.mission_statement}
                  onChange={(e) => update('mission_statement', e.target.value)}
                  rows={2}
                  placeholder={t('organization.profile.placeholders.missionStatement')}
                  className={inputCls + ' resize-none'}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('organization.profile.fields.visionStatement')}
                </label>
                <textarea
                  value={profile.vision_statement}
                  onChange={(e) => update('vision_statement', e.target.value)}
                  rows={2}
                  placeholder={t('organization.profile.placeholders.visionStatement')}
                  className={inputCls + ' resize-none'}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 6: Digital & Technology (Universal) */}
        <div
          hidden={!isAreaVisible('digital')}
          className={
            isAreaVisible('digital')
              ? 'bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden'
              : 'hidden'
          }
        >
          <SectionHeader
            id="digital"
            title={t('organization.profilePresentation.sections.digital.label')}
            icon={<Cpu size={18} />}
          />
          {expandedSections.digital && (
            <div className="p-5 border-t border-c-border-subtle space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    {t('organization.profile.fields.digitalMaturity')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    step={0.1}
                    value={profile.digital_maturity_overall ?? ''}
                    onChange={(e) =>
                      update(
                        'digital_maturity_overall',
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t('organization.profile.fields.cloudAdoption')}
                  </label>
                  <select
                    value={profile.cloud_adoption_level}
                    onChange={(e) => update('cloud_adoption_level', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{t('organization.profile.select')}</option>
                    {CLOUD_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {t(`organization.profile.options.cloudAdoption.${l}`, l.replace(/_/g, ' '))}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>
                  {t('organization.profile.fields.technologyStack')}
                </label>
                <CommaInput
                  value={profile.technology_stack}
                  onChange={(v) => update('technology_stack', v)}
                  placeholder={t('organization.profile.placeholders.technologyStack')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t('organization.profile.fields.digitalBudget')}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={profile.digital_budget_percent ?? ''}
                  onChange={(e) =>
                    update(
                      'digital_budget_percent',
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 7: Market & Competition (Universal) */}
        <div
          hidden={!isAreaVisible('market')}
          className={
            isAreaVisible('market')
              ? 'bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden'
              : 'hidden'
          }
        >
          <SectionHeader
            id="market"
            title={t('organization.profilePresentation.sections.market.label')}
            icon={<TrendingUp size={18} />}
          />
          {expandedSections.market && (
            <div className="p-5 border-t border-c-border-subtle space-y-4">
              <div>
                <label className={labelCls}>
                  {t('organization.profile.fields.primaryMarkets')}
                </label>
                <CommaInput
                  value={profile.primary_markets}
                  onChange={(v) => update('primary_markets', v)}
                  placeholder={t('organization.profile.placeholders.primaryMarkets')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('organization.profile.fields.customerSegments')}
                </label>
                <CommaInput
                  value={profile.customer_segments}
                  onChange={(v) => update('customer_segments', v)}
                  placeholder={t('organization.profile.placeholders.customerSegments')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('organization.profile.fields.keyCompetitors')}
                </label>
                <CommaInput
                  value={profile.key_competitors}
                  onChange={(v) => update('key_competitors', v)}
                  placeholder={t('organization.profile.placeholders.keyCompetitors')}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t('organization.profile.fields.marketShare')}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={profile.market_share_estimate ?? ''}
                  onChange={(e) =>
                    update(
                      'market_share_estimate',
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 8: Communication & AI Preferences */}
        <div
          hidden={!isAreaVisible('communication')}
          className={
            isAreaVisible('communication')
              ? 'bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden'
              : 'hidden'
          }
        >
          <SectionHeader
            id="communication"
            title={t('organization.profilePresentation.sections.communication.label')}
            icon={<MessageSquare size={18} />}
          />
          {expandedSections.communication && (
            <div className="p-5 border-t border-c-border-subtle space-y-4">
              <p className="text-xs text-c-text-muted">
                {t(
                  'organization.profile.communicationHint',
                  "These settings help Teresa adapt her communication style to match your organization's culture."
                )}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    {t('organization.profile.fields.communicationStyle')}
                  </label>
                  <select
                    value={profile.communication_style}
                    onChange={(e) => update('communication_style', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{t('organization.profile.select')}</option>
                    {COMMUNICATION_STYLES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {t(`organization.profile.options.communicationStyle.${s.value}`, s.label)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('organization.profile.fields.jargonLevel')}</label>
                  <select
                    value={profile.industry_jargon_level}
                    onChange={(e) => update('industry_jargon_level', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{t('organization.profile.select')}</option>
                    {JARGON_LEVELS.map((j) => (
                      <option key={j.value} value={j.value}>
                        {t(`organization.profile.options.jargonLevel.${j.value}`, j.label)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 9: Constraints & Risk (Universal) */}
        <div
          hidden={!isAreaVisible('constraints')}
          className={
            isAreaVisible('constraints')
              ? 'bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden'
              : 'hidden'
          }
        >
          <SectionHeader
            id="constraints"
            title={t('organization.profilePresentation.sections.constraints.label')}
            icon={<Shield size={18} />}
          />
          {expandedSections.constraints && (
            <div className="p-5 border-t border-c-border-subtle space-y-4">
              <div>
                <label className={labelCls}>
                  {t('organization.profile.fields.regulatoryEnvironment')}
                </label>
                <ChipSelector
                  options={REGULATIONS}
                  value={profile.regulatory_environment}
                  onChange={(v) => update('regulatory_environment', v)}
                />
              </div>
              <div>
                <label className={labelCls}>{t('organization.profile.fields.riskAppetite')}</label>
                <div className="flex gap-3">
                  {RISK_APPETITES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => update('risk_appetite', r.value)}
                      className={`flex-1 p-3 rounded-lg border text-center text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] ${profile.risk_appetite === r.value ? 'bg-[var(--c-selection)] border-[var(--c-selection-border)] text-[var(--c-text)]' : 'bg-c-bg border-c-border-subtle text-c-text-secondary dark:bg-navy-950 dark:border-navy-700 dark:text-c-text-muted hover:border-[var(--c-border-strong)]'}`}
                    >
                      {t(`organization.profile.options.riskAppetite.${r.value}`, r.label)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>
                  {t('organization.profile.fields.budgetConstraints')}
                </label>
                <textarea
                  value={profile.budget_constraints}
                  onChange={(e) => update('budget_constraints', e.target.value)}
                  rows={2}
                  placeholder={t('organization.profile.placeholders.budgetConstraints')}
                  className={inputCls + ' resize-none'}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('organization.profile.fields.timelineConstraints')}
                </label>
                <textarea
                  value={profile.timeline_constraints}
                  onChange={(e) => update('timeline_constraints', e.target.value)}
                  rows={2}
                  placeholder={t('organization.profile.placeholders.timelineConstraints')}
                  className={inputCls + ' resize-none'}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationProfileModule;
