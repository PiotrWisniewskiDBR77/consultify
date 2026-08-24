/**
 * organizationProfileTaxonomy — JEDNO źródło taksonomii profilu organizacji.
 *
 * Wyodrębnione 2026-08-24 z `OrganizationProfileModule.tsx` (czysty MOVE, zero
 * zmian wartości), żeby redesign v1 ekranu „Tożsamość i model działania"
 * (`components/Organization/redesign/`) i dotychczasowy moduł profilu czytały
 * TE SAME listy i te same reguły warunkowej widoczności §11.4. Duplikat
 * taksonomii = dwa źródła prawdy — dokładnie ta pułapka, przed którą ostrzega
 * CLAUDE.md.
 */
import { BarChart3, Briefcase, Building2, Cpu, Factory, Globe } from 'lucide-react';
import React from 'react';

export type OrganizationType =
  | 'MANUFACTURING'
  | 'SERVICES'
  | 'TECHNOLOGY'
  | 'PUBLIC_SECTOR'
  | 'NONPROFIT'
  | 'OTHER'
  | '';

export interface OrgProfile {
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

export type ProfileArea =
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

export const EMPTY_PROFILE: OrgProfile = {
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

export const ORG_TYPES: Array<{
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

export const INDUSTRIES = [
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

export const COMPANY_SIZES = [
  { value: 'STARTUP', label: 'Startup (< 50)', max: 50 },
  { value: 'SMB', label: 'SMB (50-250)', max: 250 },
  { value: 'MID_MARKET', label: 'Mid-Market (250-1000)', max: 1000 },
  { value: 'ENTERPRISE', label: 'Enterprise (1000+)', max: Infinity },
];

export const GROWTH_STAGES = [
  { value: 'STARTUP', label: 'Startup' },
  { value: 'SCALE_UP', label: 'Scale-up' },
  { value: 'MATURE', label: 'Mature' },
  { value: 'TURNAROUND', label: 'Turnaround' },
];

export const COMPETITIVE_POSITIONS = [
  { value: 'LEADER', label: 'Market Leader' },
  { value: 'CHALLENGER', label: 'Challenger' },
  { value: 'FOLLOWER', label: 'Follower' },
  { value: 'NICHE', label: 'Niche Player' },
];

export const RISK_APPETITES = [
  { value: 'CONSERVATIVE', label: 'Conservative' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'AGGRESSIVE', label: 'Aggressive' },
];

export const CLOUD_LEVELS = ['NONE', 'EXPLORING', 'PARTIAL', 'CLOUD_FIRST', 'CLOUD_NATIVE'];

export const REGULATIONS = [
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

export const REVENUE_MODELS = [
  'Subscription / SaaS',
  'Project-based',
  'Product sales',
  'Managed services',
  'Licensing',
  'Grant-funded',
  'Mixed / Hybrid',
];

export const DELIVERY_MODELS = [
  'Projects',
  'Products',
  'Managed services',
  'Platform / Marketplace',
  'Consulting engagements',
  'Mixed',
];

export const CORE_SYSTEMS_OPTIONS = [
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

export const PRODUCTION_ARCHETYPES = [
  { value: 'DISCRETE', label: 'Discrete Manufacturing' },
  { value: 'PROCESS', label: 'Process Manufacturing' },
  { value: 'HYBRID', label: 'Hybrid' },
];

export const SHIFT_PATTERNS = [
  { value: 'SINGLE', label: 'Single Shift' },
  { value: 'DOUBLE', label: 'Double Shift' },
  { value: 'TRIPLE', label: 'Triple Shift' },
  { value: 'CONTINUOUS', label: 'Continuous (24/7)' },
];

export const AUTOMATION_LEVELS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'SEMI_AUTOMATED', label: 'Semi-Automated' },
  { value: 'FULLY_AUTOMATED', label: 'Fully Automated' },
];

export const COMMUNICATION_STYLES = [
  { value: 'FORMAL', label: 'Formal' },
  { value: 'BUSINESS_CASUAL', label: 'Business Casual' },
  { value: 'CASUAL', label: 'Casual / Startup' },
  { value: 'TECHNICAL', label: 'Technical / Engineering' },
];

export const JARGON_LEVELS = [
  { value: 'NONE', label: 'Plain language' },
  { value: 'MODERATE', label: 'Moderate industry terms' },
  { value: 'HEAVY', label: 'Heavy industry jargon' },
];

export const optionKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_');

// ─── Conditional section visibility per §11.4 ───

export function showProductionSection(orgType: OrganizationType): boolean {
  return orgType === 'MANUFACTURING';
}
export function showDeliveryModel(orgType: OrganizationType): boolean {
  return ['SERVICES', 'TECHNOLOGY', 'PUBLIC_SECTOR'].includes(orgType);
}
export function showRevenueModel(orgType: OrganizationType): boolean {
  return ['SERVICES', 'TECHNOLOGY', 'PUBLIC_SECTOR', 'NONPROFIT'].includes(orgType);
}
export function showCoreSystems(orgType: OrganizationType): boolean {
  return ['MANUFACTURING', 'SERVICES', 'TECHNOLOGY', 'PUBLIC_SECTOR'].includes(orgType);
}
export function showOperatingSection(orgType: OrganizationType): boolean {
  return Boolean(orgType);
}

// ─── Kompletność profilu (CAŁEGO, nie pojedynczego ekranu) ───
// Wyodrębnione razem z taksonomią: wartość leci do API jako
// `profile_completeness`, więc stary moduł i redesign MUSZĄ liczyć ją tak samo.
export function computeCompleteness(p: OrgProfile): number {
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
