/**
 * First-run onboarding configuration (X4 / decision D22).
 *
 * Maps the five primary onboarding roles to the entry door (route) the user
 * lands on after completing the flow, and to the lucide icon used in the role
 * picker. Text lives in i18n under `firstRun.role.options.*` — only stable,
 * non-translatable data lives here.
 */
import {
  ClipboardCheck,
  Compass,
  LineChart,
  type LucideIcon,
  MessageSquare,
  Mic,
} from 'lucide-react';

import { ROUTES } from '../../routes/routeConfig';

export type FirstRunRole = 'chat' | 'tools' | 'assessment' | 'interview' | 'financial';

export interface FirstRunRoleOption {
  id: FirstRunRole;
  /** i18n suffix under `firstRun.role.options.<id>.{title,description}` */
  i18nKey: FirstRunRole;
  icon: LucideIcon;
  /** Entry door the user lands on after finishing the flow. */
  route: string;
  /** English fallback title (shown if the i18n key is missing). */
  title: string;
  /** English fallback description. */
  description: string;
}

export const FIRST_RUN_ROLES: FirstRunRoleOption[] = [
  {
    id: 'chat',
    i18nKey: 'chat',
    icon: MessageSquare,
    route: ROUTES.AI_CHAT,
    title: 'Think through a decision with Teresa',
    description: 'Talk to your AI co-thinker and structure a strategic decision or open question.',
  },
  {
    id: 'tools',
    i18nKey: 'tools',
    icon: Compass,
    route: ROUTES.DISCOVERY_TOOLS.ROOT,
    title: 'Explore the discovery tools',
    description:
      'Strategic, operational, digital and process-automation workspaces for structured analysis.',
  },
  {
    id: 'assessment',
    i18nKey: 'assessment',
    icon: ClipboardCheck,
    route: ROUTES.ASSESSMENT.ROOT,
    title: 'Run a maturity assessment',
    description: 'DRD, SIRI, ADMA, CMMI or Lean — assess where the organization stands today.',
  },
  {
    id: 'interview',
    i18nKey: 'interview',
    icon: Mic,
    route: ROUTES.INTERVIEW,
    title: 'Run a discovery interview',
    description: 'Capture stakeholder perspectives with a guided, AI-assisted interview.',
  },
  {
    id: 'financial',
    i18nKey: 'financial',
    icon: LineChart,
    route: ROUTES.FINANCE,
    title: 'Build a financial model',
    description: 'Model the economics of an initiative — costs, returns and scenarios.',
  },
];

/** Default entry door when no role is chosen (skip). */
export const DEFAULT_ENTRY_ROUTE = ROUTES.AI_CHAT;

export const routeForRole = (role: FirstRunRole | null): string => {
  const match = FIRST_RUN_ROLES.find((r) => r.id === role);
  return match ? match.route : DEFAULT_ENTRY_ROUTE;
};
