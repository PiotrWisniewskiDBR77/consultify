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

import type {
  DomainNavigationChild,
  DomainNavigationModule,
} from '../settings/shared/DomainNavigation';

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

/**
 * Etykieta ekranu = KLUCZ i18n + angielski `defaultValue`.
 *
 * Do 09.09 ten plik trzymał DWA równoległe słowniki napisów (`ADMIN_DOMAINS`
 * po polsku i `ADMIN_SCREEN_EN`/`ADMIN_DOMAIN_EN` po angielsku) i przełączał
 * je funkcją `getAdminDomains(language)`. Żaden z nich nie przechodził przez
 * i18n, więc 136 napisów całego menu panelu było poza tłumaczeniami — i poza
 * zasięgiem przyrządu pomiarowego, bo to plik `.ts`, a nie `.tsx`.
 * Teraz jest jedno źródło: klucz + angielski default (reguła §2.3 PLAN.md),
 * polski wyłącznie w `public/locales/pl/translation.json`.
 */
const c = (id: AdminScreen, labelKey: string, label: string, icon = FileText) => ({
  id,
  labelKey,
  label,
  icon,
});

/** Wpis nawigacji nosi KLUCZ i18n obok angielskiego napisu domyślnego. */
export type AdminNavScreen = DomainNavigationChild<AdminScreen> & { labelKey: string };
export type AdminNavDomain = Omit<
  DomainNavigationModule<AdminDomain, AdminScreen>,
  'children'
> & { labelKey: string; children: AdminNavScreen[] };

export const ADMIN_DOMAINS: AdminNavDomain[] = [
  {
    id: 'team',
    labelKey: 'admin.nav.domain.team',
    label: 'Team & Access',
    children: [
      c('members', 'admin.nav.screen.members', 'Members', Users),
      c('invitations', 'admin.nav.screen.invitations', 'Invitations', UserCheck),
      c('roles-permissions', 'admin.nav.screen.roles-permissions', 'Roles & Permissions', ShieldCheck),
      c('teams', 'admin.nav.screen.teams', 'Teams', Users),
      c('guests-external', 'admin.nav.screen.guests-external', 'Guests & External Access', Network),
      c('access-requests', 'admin.nav.screen.access-requests', 'Access Requests', FileClock),
      c('access-reviews', 'admin.nav.screen.access-reviews', 'Access Reviews', UserCheck),
      c('ownership', 'admin.nav.screen.ownership', 'Ownership', Building2),
    ],
  },
  {
    id: 'billing',
    labelKey: 'admin.nav.domain.billing',
    label: 'Billing & Plans',
    children: [
      c('overview', 'admin.nav.screen.overview', 'Overview', Gauge),
      c('plan-limits', 'admin.nav.screen.plan-limits', 'Plan & Limits', CreditCard),
      c('usage-costs', 'admin.nav.screen.usage-costs', 'Usage & Costs', Activity),
      c('payment-methods', 'admin.nav.screen.payment-methods', 'Payment Methods', WalletCards),
      c('invoices', 'admin.nav.screen.invoices', 'Invoices', Receipt),
      c('seats-licences', 'admin.nav.screen.seats-licences', 'Seats & Licences', Users),
      c('billing-details', 'admin.nav.screen.billing-details', 'Billing Details', Building2),
      c('budgets-alerts', 'admin.nav.screen.budgets-alerts', 'Budgets & Alerts', AlertTriangle),
      c('plan-history', 'admin.nav.screen.plan-history', 'Plan Change History', FileClock),
    ],
  },
  {
    id: 'ai',
    labelKey: 'admin.nav.domain.ai',
    label: 'AI Control',
    children: [
      c('policy-autonomy', 'admin.nav.screen.policy-autonomy', 'Policy & Autonomy', ShieldCheck),
      c('personas', 'admin.nav.screen.personas', 'Personas', Bot),
      c('models-providers', 'admin.nav.screen.models-providers', 'Models & Providers', Sparkles),
      c('ai-limits-budgets', 'admin.nav.screen.ai-limits-budgets', 'Limits & Budgets', SlidersHorizontal),
      c('data-privacy', 'admin.nav.screen.data-privacy', 'Data & Privacy', ShieldCheck),
      c('quality-evaluations', 'admin.nav.screen.quality-evaluations', 'Quality Evaluations', Activity),
      c('ai-incidents', 'admin.nav.screen.ai-incidents', 'AI Incidents', AlertTriangle),
      c('configuration-versions', 'admin.nav.screen.configuration-versions', 'Configuration Versions', FileClock),
      c('ai-operations', 'admin.nav.screen.ai-operations', 'AI Operations', SlidersHorizontal),
      c('ai-audit', 'admin.nav.screen.ai-audit', 'AI Audit', ScrollText),
    ],
  },
  {
    id: 'security',
    labelKey: 'admin.nav.domain.security',
    label: 'Security & Identity',
    children: [
      c('security-policy', 'admin.nav.screen.security-policy', 'Security Policy', ShieldCheck),
      c('sso', 'admin.nav.screen.sso', 'SSO', KeyRound),
      c('scim-lifecycle', 'admin.nav.screen.scim-lifecycle', 'SCIM & Lifecycle', Users),
      c('sessions', 'admin.nav.screen.sessions', 'Sessions', Activity),
      c('api-access', 'admin.nav.screen.api-access', 'API Access', KeyRound),
      c('domains', 'admin.nav.screen.domains', 'Domains', Network),
      c('service-accounts', 'admin.nav.screen.service-accounts', 'Service Accounts', Bot),
      c('security-alerts', 'admin.nav.screen.security-alerts', 'Security Alerts', AlertTriangle),
      c('break-glass', 'admin.nav.screen.break-glass', 'Break-glass', KeyRound),
      c('risk-summary', 'admin.nav.screen.risk-summary', 'Risk Summary', Gauge),
    ],
  },
  {
    id: 'audit',
    labelKey: 'admin.nav.domain.audit',
    label: 'Audit Log',
    children: [
      c('events', 'admin.nav.screen.events', 'Events', ScrollText),
      c('high-risk-changes', 'admin.nav.screen.high-risk-changes', 'High-risk Changes', AlertTriangle),
      c('compliance-evidence', 'admin.nav.screen.compliance-evidence', 'Compliance Evidence', ShieldCheck),
      c('retention-export', 'admin.nav.screen.retention-export', 'Retention & Export', FileText),
      c('integrity', 'admin.nav.screen.integrity', 'Integrity', ShieldCheck),
      c('legal-hold', 'admin.nav.screen.legal-hold', 'Legal Hold', FileClock),
      c('export-history', 'admin.nav.screen.export-history', 'Export History', FileClock),
    ],
  },
  {
    id: 'command',
    labelKey: 'admin.nav.domain.command',
    label: 'Admin Command Center',
    children: [
      c('overview', 'admin.nav.screen.overview', 'Overview', Gauge),
      c('attention-queue', 'admin.nav.screen.attention-queue', 'Attention Queue', AlertTriangle),
      c('cost-capacity', 'admin.nav.screen.cost-capacity', 'Cost & Capacity', Activity),
      c('organization-defaults', 'admin.nav.screen.organization-defaults', 'Organization Defaults', SlidersHorizontal),
      c('agent-trace', 'admin.nav.screen.agent-trace', 'Agent Trace', Bot),
      c('audit', 'admin.nav.screen.audit', 'SOC2 Audit', ScrollText),
      c('dlp', 'admin.nav.screen.dlp', 'DLP', Lock),
      c('residency', 'admin.nav.screen.residency', 'Data Residency', Globe),
      c('retention', 'admin.nav.screen.retention', 'Retention', Clock),
      c('ai-policy', 'admin.nav.screen.ai-policy', 'AI Policy', Sparkles),
      c('benchmark', 'admin.nav.screen.benchmark', 'Consulting Benchmark', ClipboardCheck),
    ],
  },
  {
    id: 'health',
    labelKey: 'admin.nav.domain.health',
    label: 'System Health',
    children: [
      c('service-status', 'admin.nav.screen.service-status', 'Service Status', Activity),
      c('dependencies', 'admin.nav.screen.dependencies', 'Dependencies', Network),
      c('diagnostics', 'admin.nav.screen.diagnostics', 'Diagnostics', SlidersHorizontal),
      c('incident-history', 'admin.nav.screen.incident-history', 'Incident History', AlertTriangle),
      c('queues-jobs', 'admin.nav.screen.queues-jobs', 'Queues & Jobs', FileClock),
      c('sla-slo', 'admin.nav.screen.sla-slo', 'SLA / SLO', Gauge),
      c('platform-operations', 'admin.nav.screen.platform-operations', 'Platform Operations', KeyRound),
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

type AdminLabelTranslator = (key: string, defaultValue: string) => string;

/**
 * Jedyne wejście do etykiet menu panelu. Przyjmuje tłumacza (`t`), nie kod
 * języka: nazwy mają iść przez i18n, a nie przez `if (język === 'pl')`.
 */
export function getAdminDomains(t: AdminLabelTranslator) {
  return ADMIN_DOMAINS.map((domain) => ({
    ...domain,
    label: t(domain.labelKey, domain.label),
    children: domain.children.map((screen) => ({
      ...screen,
      label: t(screen.labelKey, screen.label),
    })),
  }));
}
