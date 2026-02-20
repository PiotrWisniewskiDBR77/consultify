/**
 * Onboarding Playbooks seed (T068)
 *
 * Stored as translation keys so the client can render i18n copy (PL/EN).
 * DB is the source of truth, but API self-heals and seeds if missing.
 */

export type HelpPlaybookSeed = {
  id: string;
  key: string;
  titleKey: string;
  descriptionKey: string;
  targetRole: string;
  targetOrgType: string;
  priority: number;
  status: 'draft' | 'published' | 'archived';
};

export type HelpPlaybookStepSeed = {
  id: string;
  playbookKey: string;
  stepOrder: number;
  titleKey: string;
  contentKey: string;
  whatYouGetKey?: string | null;
  expectedTimeMinutes?: number | null;
  uiTarget?: string | null;
  actionType: 'INFO' | 'CTA' | 'LINK';
  actionPayload: Record<string, unknown>;
};

export const HELP_PLAYBOOK_SEED: HelpPlaybookSeed[] = [
  {
    id: 'hp_first_30_min_owner_trial',
    key: 'first-30-min',
    titleKey: 'help.onboarding.playbooks.first30.title',
    descriptionKey: 'help.onboarding.playbooks.first30.description',
    targetRole: 'OWNER_TRIAL',
    targetOrgType: 'any',
    priority: 100,
    status: 'published',
  },
  {
    id: 'hp_consultant_quickstart',
    key: 'consultant-quickstart',
    titleKey: 'help.onboarding.playbooks.consultant.title',
    descriptionKey: 'help.onboarding.playbooks.consultant.description',
    targetRole: 'CONSULTANT',
    targetOrgType: 'any',
    priority: 80,
    status: 'published',
  },
  {
    id: 'hp_pmo_quickstart',
    key: 'pmo-quickstart',
    titleKey: 'help.onboarding.playbooks.pmo.title',
    descriptionKey: 'help.onboarding.playbooks.pmo.description',
    targetRole: 'PMO',
    targetOrgType: 'any',
    priority: 70,
    status: 'published',
  },
];

export const HELP_PLAYBOOK_STEPS_SEED: HelpPlaybookStepSeed[] = [
  // ------------------------------------------------------------
  // First 30 minutes (Owner / Trial)
  // ------------------------------------------------------------
  {
    id: 'hp_first30_s1',
    playbookKey: 'first-30-min',
    stepOrder: 1,
    titleKey: 'help.onboarding.playbooks.first30.steps.1.title',
    contentKey: 'help.onboarding.playbooks.first30.steps.1.content',
    whatYouGetKey: 'help.onboarding.playbooks.first30.steps.1.whatYouGet',
    expectedTimeMinutes: 2,
    uiTarget: 'dashboard',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'DASHBOARD_OVERVIEW',
      labelKey: 'help.onboarding.cta.openDashboard',
    },
  },
  {
    id: 'hp_first30_s2',
    playbookKey: 'first-30-min',
    stepOrder: 2,
    titleKey: 'help.onboarding.playbooks.first30.steps.2.title',
    contentKey: 'help.onboarding.playbooks.first30.steps.2.content',
    whatYouGetKey: 'help.onboarding.playbooks.first30.steps.2.whatYouGet',
    expectedTimeMinutes: 5,
    uiTarget: 'assessment',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'ASSESSMENT_SUMMARY',
      labelKey: 'help.onboarding.cta.runAssessment',
    },
  },
  {
    id: 'hp_first30_s3',
    playbookKey: 'first-30-min',
    stepOrder: 3,
    titleKey: 'help.onboarding.playbooks.first30.steps.3.title',
    contentKey: 'help.onboarding.playbooks.first30.steps.3.content',
    whatYouGetKey: 'help.onboarding.playbooks.first30.steps.3.whatYouGet',
    expectedTimeMinutes: 4,
    uiTarget: 'initiatives',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'FULL_STEP2_INITIATIVES',
      labelKey: 'help.onboarding.cta.openInitiatives',
    },
  },
  {
    id: 'hp_first30_s4',
    playbookKey: 'first-30-min',
    stepOrder: 4,
    titleKey: 'help.onboarding.playbooks.first30.steps.4.title',
    contentKey: 'help.onboarding.playbooks.first30.steps.4.content',
    whatYouGetKey: 'help.onboarding.playbooks.first30.steps.4.whatYouGet',
    expectedTimeMinutes: 4,
    uiTarget: 'roadmap',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'PORTFOLIO_ROADMAP',
      labelKey: 'help.onboarding.cta.openRoadmap',
    },
  },
  {
    id: 'hp_first30_s5',
    playbookKey: 'first-30-min',
    stepOrder: 5,
    titleKey: 'help.onboarding.playbooks.first30.steps.5.title',
    contentKey: 'help.onboarding.playbooks.first30.steps.5.content',
    whatYouGetKey: 'help.onboarding.playbooks.first30.steps.5.whatYouGet',
    expectedTimeMinutes: 6,
    uiTarget: 'reports',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'FULL_STEP6_REPORTS',
      labelKey: 'help.onboarding.cta.openReports',
    },
  },

  // ------------------------------------------------------------
  // Consultant quickstart
  // ------------------------------------------------------------
  {
    id: 'hp_consultant_s1',
    playbookKey: 'consultant-quickstart',
    stepOrder: 1,
    titleKey: 'help.onboarding.playbooks.consultant.steps.1.title',
    contentKey: 'help.onboarding.playbooks.consultant.steps.1.content',
    whatYouGetKey: 'help.onboarding.playbooks.consultant.steps.1.whatYouGet',
    expectedTimeMinutes: 4,
    uiTarget: 'discovery',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'INTERVIEW',
      labelKey: 'help.onboarding.cta.startDiscovery',
    },
  },
  {
    id: 'hp_consultant_s2',
    playbookKey: 'consultant-quickstart',
    stepOrder: 2,
    titleKey: 'help.onboarding.playbooks.consultant.steps.2.title',
    contentKey: 'help.onboarding.playbooks.consultant.steps.2.content',
    whatYouGetKey: 'help.onboarding.playbooks.consultant.steps.2.whatYouGet',
    expectedTimeMinutes: 6,
    uiTarget: 'assessment',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'ASSESSMENT_OVERVIEW',
      labelKey: 'help.onboarding.cta.openAssessmentHub',
    },
  },
  {
    id: 'hp_consultant_s3',
    playbookKey: 'consultant-quickstart',
    stepOrder: 3,
    titleKey: 'help.onboarding.playbooks.consultant.steps.3.title',
    contentKey: 'help.onboarding.playbooks.consultant.steps.3.content',
    whatYouGetKey: 'help.onboarding.playbooks.consultant.steps.3.whatYouGet',
    expectedTimeMinutes: 5,
    uiTarget: 'initiatives',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'FULL_STEP2_INITIATIVES',
      labelKey: 'help.onboarding.cta.buildBacklog',
    },
  },
  {
    id: 'hp_consultant_s4',
    playbookKey: 'consultant-quickstart',
    stepOrder: 4,
    titleKey: 'help.onboarding.playbooks.consultant.steps.4.title',
    contentKey: 'help.onboarding.playbooks.consultant.steps.4.content',
    whatYouGetKey: 'help.onboarding.playbooks.consultant.steps.4.whatYouGet',
    expectedTimeMinutes: 8,
    uiTarget: 'reporting',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'FULL_STEP6_REPORTS',
      labelKey: 'help.onboarding.cta.generateReport',
    },
  },

  // ------------------------------------------------------------
  // PMO quickstart
  // ------------------------------------------------------------
  {
    id: 'hp_pmo_s1',
    playbookKey: 'pmo-quickstart',
    stepOrder: 1,
    titleKey: 'help.onboarding.playbooks.pmo.steps.1.title',
    contentKey: 'help.onboarding.playbooks.pmo.steps.1.content',
    whatYouGetKey: 'help.onboarding.playbooks.pmo.steps.1.whatYouGet',
    expectedTimeMinutes: 3,
    uiTarget: 'dashboard',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'DASHBOARD_OVERVIEW',
      labelKey: 'help.onboarding.cta.openDashboard',
    },
  },
  {
    id: 'hp_pmo_s2',
    playbookKey: 'pmo-quickstart',
    stepOrder: 2,
    titleKey: 'help.onboarding.playbooks.pmo.steps.2.title',
    contentKey: 'help.onboarding.playbooks.pmo.steps.2.content',
    whatYouGetKey: 'help.onboarding.playbooks.pmo.steps.2.whatYouGet',
    expectedTimeMinutes: 6,
    uiTarget: 'portfolio',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'PORTFOLIO_ROADMAP',
      labelKey: 'help.onboarding.cta.organizeRoadmap',
    },
  },
  {
    id: 'hp_pmo_s3',
    playbookKey: 'pmo-quickstart',
    stepOrder: 3,
    titleKey: 'help.onboarding.playbooks.pmo.steps.3.title',
    contentKey: 'help.onboarding.playbooks.pmo.steps.3.content',
    whatYouGetKey: 'help.onboarding.playbooks.pmo.steps.3.whatYouGet',
    expectedTimeMinutes: 6,
    uiTarget: 'execution',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'IMPLEMENTATION',
      labelKey: 'help.onboarding.cta.trackExecution',
    },
  },
  {
    id: 'hp_pmo_s4',
    playbookKey: 'pmo-quickstart',
    stepOrder: 4,
    titleKey: 'help.onboarding.playbooks.pmo.steps.4.title',
    contentKey: 'help.onboarding.playbooks.pmo.steps.4.content',
    whatYouGetKey: 'help.onboarding.playbooks.pmo.steps.4.whatYouGet',
    expectedTimeMinutes: 5,
    uiTarget: 'governance',
    actionType: 'CTA',
    actionPayload: {
      kind: 'view',
      view: 'MY_WORK',
      labelKey: 'help.onboarding.cta.setupRoutines',
    },
  },
];

