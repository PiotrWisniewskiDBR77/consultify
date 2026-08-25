import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileClock,
  FileText,
  Gauge,
  Globe,
  KeyRound,
  Lock,
  Network,
  Receipt,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  Users,
  WalletCards,
} from 'lucide-react';

import type { DomainNavigationModule } from '../settings/shared/DomainNavigation';

export type AdminDomain = 'team' | 'billing' | 'ai' | 'security' | 'audit' | 'command' | 'health';
export type AdminScreen =
  | 'members'
  | 'invitations'
  | 'roles-permissions'
  | 'teams'
  | 'guests-external'
  | 'access-requests'
  | 'access-reviews'
  | 'ownership'
  | 'overview'
  | 'plan-limits'
  | 'usage-costs'
  | 'payment-methods'
  | 'invoices'
  | 'seats-licences'
  | 'billing-details'
  | 'budgets-alerts'
  | 'plan-history'
  | 'policy-autonomy'
  | 'personas'
  | 'models-providers'
  | 'ai-limits-budgets'
  | 'data-privacy'
  | 'quality-evaluations'
  | 'ai-incidents'
  | 'configuration-versions'
  | 'ai-operations'
  | 'ai-audit'
  | 'security-policy'
  | 'sso'
  | 'scim-lifecycle'
  | 'sessions'
  | 'api-access'
  | 'domains'
  | 'service-accounts'
  | 'security-alerts'
  | 'break-glass'
  | 'risk-summary'
  | 'events'
  | 'high-risk-changes'
  | 'compliance-evidence'
  | 'retention-export'
  | 'integrity'
  | 'legal-hold'
  | 'export-history'
  | 'attention-queue'
  | 'agent-trace'
  | 'audit'
  | 'dlp'
  | 'residency'
  | 'retention'
  | 'ai-policy'
  | 'benchmark'
  | 'cost-capacity'
  | 'organization-defaults'
  | 'service-status'
  | 'dependencies'
  | 'diagnostics'
  | 'incident-history'
  | 'queues-jobs'
  | 'sla-slo'
  | 'platform-operations';

export interface AdminLocation {
  domain: AdminDomain;
  screen: AdminScreen;
}

const c = (id: AdminScreen, label: string, icon = FileText) => ({ id, label, icon });

export const ADMIN_DOMAINS: DomainNavigationModule<AdminDomain, AdminScreen>[] = [
  {
    id: 'team',
    label: 'Zespół i dostęp',
    children: [
      c('members', 'Użytkownicy', Users),
      c('invitations', 'Zaproszenia', UserCheck),
      c('roles-permissions', 'Role i uprawnienia', ShieldCheck),
      c('teams', 'Zespoły', Users),
      c('guests-external', 'Goście i dostęp zewnętrzny', Network),
      c('access-requests', 'Wnioski o dostęp', FileClock),
      c('access-reviews', 'Przeglądy dostępów', UserCheck),
      c('ownership', 'Własność', Building2),
    ],
  },
  {
    id: 'billing',
    label: 'Rozliczenia i plany',
    children: [
      c('overview', 'Przegląd', Gauge),
      c('plan-limits', 'Plan i limity', CreditCard),
      c('usage-costs', 'Wykorzystanie i koszty', Activity),
      c('payment-methods', 'Metody płatności', WalletCards),
      c('invoices', 'Faktury', Receipt),
      c('seats-licences', 'Miejsca i licencje', Users),
      c('billing-details', 'Dane rozliczeniowe', Building2),
      c('budgets-alerts', 'Budżety i alerty', AlertTriangle),
      c('plan-history', 'Historia zmian planu', FileClock),
    ],
  },
  {
    id: 'ai',
    label: 'Sterowanie AI',
    children: [
      c('policy-autonomy', 'Polityka i autonomia', ShieldCheck),
      c('personas', 'Persony', Bot),
      c('models-providers', 'Modele i dostawcy', Sparkles),
      c('ai-limits-budgets', 'Limity i budżety', SlidersHorizontal),
      c('data-privacy', 'Dane i prywatność', ShieldCheck),
      c('quality-evaluations', 'Ewaluacje jakości', Activity),
      c('ai-incidents', 'Incydenty AI', AlertTriangle),
      c('configuration-versions', 'Wersje konfiguracji', FileClock),
      c('ai-operations', 'Operacje AI', SlidersHorizontal),
      c('ai-audit', 'Audyt AI', ScrollText),
    ],
  },
  {
    id: 'security',
    label: 'Bezpieczeństwo i tożsamość',
    children: [
      c('security-policy', 'Polityka bezpieczeństwa', ShieldCheck),
      c('sso', 'SSO', KeyRound),
      c('scim-lifecycle', 'SCIM i cykl życia', Users),
      c('sessions', 'Sesje', Activity),
      c('api-access', 'Dostęp API', KeyRound),
      c('domains', 'Domeny', Network),
      c('service-accounts', 'Konta usługowe', Bot),
      c('security-alerts', 'Alerty bezpieczeństwa', AlertTriangle),
      c('break-glass', 'Break-glass', KeyRound),
      c('risk-summary', 'Podsumowanie ryzyka', Gauge),
    ],
  },
  {
    id: 'audit',
    label: 'Dziennik audytu',
    children: [
      c('events', 'Zdarzenia', ScrollText),
      c('high-risk-changes', 'Zmiany wysokiego ryzyka', AlertTriangle),
      c('compliance-evidence', 'Dowody zgodności', ShieldCheck),
      c('retention-export', 'Retencja i eksport', FileText),
      c('integrity', 'Integralność', ShieldCheck),
      c('legal-hold', 'Legal hold', FileClock),
      c('export-history', 'Historia eksportów', FileClock),
    ],
  },
  {
    id: 'command',
    label: 'Centrum administracyjne',
    children: [
      c('overview', 'Przegląd', Gauge),
      c('attention-queue', 'Kolejka uwagi', AlertTriangle),
      c('cost-capacity', 'Koszt i pojemność', Activity),
      c('organization-defaults', 'Ustawienia domyślne organizacji', SlidersHorizontal),
      c('agent-trace', 'Ślad agentów', Bot),
      c('audit', 'Audyt SOC2', ScrollText),
      c('dlp', 'DLP', Lock),
      c('residency', 'Rezydencja danych', Globe),
      c('retention', 'Retencja', Clock),
      c('ai-policy', 'Polityka AI', Sparkles),
      c('benchmark', 'Benchmark konsultingowy', ClipboardCheck),
    ],
  },
  {
    id: 'health',
    label: 'Stan systemu',
    children: [
      c('service-status', 'Stan usług', Activity),
      c('dependencies', 'Zależności', Network),
      c('diagnostics', 'Diagnostyka', SlidersHorizontal),
      c('incident-history', 'Historia incydentów', AlertTriangle),
      c('queues-jobs', 'Kolejki i zadania', FileClock),
      c('sla-slo', 'SLA / SLO', Gauge),
      c('platform-operations', 'Operacje platformowe', KeyRound),
    ],
  },
];

export const ADMIN_DEFAULTS: Record<AdminDomain, AdminScreen> = {
  team: 'members',
  billing: 'overview',
  ai: 'policy-autonomy',
  security: 'security-policy',
  audit: 'events',
  command: 'overview',
  health: 'service-status',
};

const ADMIN_DOMAIN_EN: Record<AdminDomain, string> = {
  team: 'Team & Access',
  billing: 'Billing & Plans',
  ai: 'AI Control',
  security: 'Security & Identity',
  audit: 'Audit Log',
  command: 'Admin Command Center',
  health: 'System Health',
};

const ADMIN_SCREEN_EN: Partial<Record<AdminScreen, string>> = {
  members: 'Members',
  invitations: 'Invitations',
  'roles-permissions': 'Roles & Permissions',
  teams: 'Teams',
  'guests-external': 'Guests & External Access',
  'access-requests': 'Access Requests',
  'access-reviews': 'Access Reviews',
  ownership: 'Ownership',
  overview: 'Overview',
  'plan-limits': 'Plan & Limits',
  'usage-costs': 'Usage & Costs',
  'payment-methods': 'Payment Methods',
  invoices: 'Invoices',
  'seats-licences': 'Seats & Licences',
  'billing-details': 'Billing Details',
  'budgets-alerts': 'Budgets & Alerts',
  'plan-history': 'Plan Change History',
  'policy-autonomy': 'Policy & Autonomy',
  personas: 'Personas',
  'models-providers': 'Models & Providers',
  'ai-limits-budgets': 'Limits & Budgets',
  'data-privacy': 'Data & Privacy',
  'quality-evaluations': 'Quality Evaluations',
  'ai-incidents': 'AI Incidents',
  'configuration-versions': 'Configuration Versions',
  'organization-defaults': 'Organization Defaults',
  'ai-operations': 'AI Operations',
  'ai-audit': 'AI Audit',
  'security-policy': 'Security Policy',
  sso: 'SSO',
  'scim-lifecycle': 'SCIM & Lifecycle',
  sessions: 'Sessions',
  'api-access': 'API Access',
  domains: 'Domains',
  'service-accounts': 'Service Accounts',
  'security-alerts': 'Security Alerts',
  'break-glass': 'Break-glass',
  'risk-summary': 'Risk Summary',
  events: 'Events',
  'high-risk-changes': 'High-risk Changes',
  'compliance-evidence': 'Compliance Evidence',
  'retention-export': 'Retention & Export',
  integrity: 'Integrity',
  'legal-hold': 'Legal Hold',
  'export-history': 'Export History',
  'attention-queue': 'Attention Queue',
  'cost-capacity': 'Cost & Capacity',
  'agent-trace': 'Agent Trace',
  audit: 'SOC2 Audit',
  dlp: 'DLP',
  residency: 'Data Residency',
  retention: 'Retention',
  'ai-policy': 'AI Policy',
  benchmark: 'Consulting Benchmark',
  'service-status': 'Service Status',
  dependencies: 'Dependencies',
  diagnostics: 'Diagnostics',
  'incident-history': 'Incident History',
  'queues-jobs': 'Queues & Jobs',
  'sla-slo': 'SLA / SLO',
  'platform-operations': 'Platform Operations',
};

export function getAdminDomains(language?: string) {
  if (language?.toLowerCase().startsWith('pl')) return ADMIN_DOMAINS;
  return ADMIN_DOMAINS.map((domain) => ({
    ...domain,
    label: ADMIN_DOMAIN_EN[domain.id],
    children: domain.children.map((screen) => ({
      ...screen,
      label: ADMIN_SCREEN_EN[screen.id] || screen.label,
    })),
  }));
}
