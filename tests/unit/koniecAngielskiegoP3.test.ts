import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getStatusActions, STATUS_METADATA } from '../../src/services/initiativeLifecycle';
import { InitiativeStatus } from '../../src/types';

type Locale = Record<string, unknown>;

const readLocale = (language: 'pl' | 'en'): Locale =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), `public/locales/${language}/translation.json`), 'utf8')
  ) as Locale;

const get = (source: Locale, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => (value as Locale)?.[key], source);

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });

const pl = readLocale('pl');
const en = readLocale('en');

const menu3Keys = [
  'initiatives.menu3.plan.unscheduled',
  'initiatives.menu3.plan.now',
  'initiatives.menu3.plan.next',
  'initiatives.menu3.plan.later',
  'initiatives.menu3.plan.conflicted',
  'initiatives.menu3.plan.missingDependencies',
  'initiatives.menu3.plan.needsCapacity',
  'initiatives.menu3.plan.ready',
  'initiatives.menu3.plan.published',
  'initiatives.menu3.capacity.all',
  'initiatives.menu3.capacity.critical',
  'initiatives.menu3.capacity.unknownSupply',
  'initiatives.menu3.capacity.missingDemand',
  'initiatives.menu3.capacity.skillGaps',
  'initiatives.menu3.capacity.managementLoad',
  'initiatives.menu3.capacity.budgetEnvelope',
  'initiatives.menu3.capacity.unconfirmed',
  'initiatives.menu3.capacity.resolved',
];

const valuationToolKeys = [
  'bankingValue',
  'cashForecast',
  'driverPlanner',
  'driverTree',
  'extendedRatios',
  'headcountPlanner',
  'investmentAppraisal',
  'rollingForecast',
  'valuationVisuals',
  'valueAttribution',
  'valueCapture',
  'valueLedger',
  'valueOffice',
  'varianceBridge',
  'varianceNarration',
  'evBasket',
  'monteCarlo',
  'realOptions',
  'frontier',
  'sensitivity',
  'scenarios',
].map((key) => `finance.valuation.tool.${key}`);

const profileRoleKeys = [
  'owner',
  'admin',
  'member',
  'superadmin',
  'product',
  'sales',
  'operations',
  'finance',
  'partner',
  'consultant',
].map((role) => `settings.profile.roles.${role}`);

const runtimeRepairKeys = [
  'reports.tabs.reports',
  'reports.tabs.templates',
  'reports.tabs.schedules',
  'reports.tabs.automation',
  'reports.actions.generate',
  'reports.actions.newReport',
  'reports.empty.noReports',
  'reports.empty.noReportsDesc',
  'myWork.hub.aITriage',
  'myWork.inboxContent.systemTitles.defineTargetProcess',
  'myWork.inboxContent.systemTitles.submitComplianceDocumentation',
  'myWork.inboxContent.systemTitles.fixCriticalProductionBug',
  'myWork.inboxContent.systemTitles.selectAiModelProvider',
  'myWork.inboxContent.systemTitles.finalizeApiRateLimitingPolicy',
  'myWork.inboxContent.systemTitles.launchPublicBetaDecision',
  'myWork.inboxContent.systemTitles.interviewAssignmentOverdue',
  'initiatives.kanban.notApplicable',
  'initiatives.kanban.health.green',
  'initiatives.kanban.health.amber',
  'initiatives.kanban.health.red',
  'initiatives.kanban.health.grey',
  'initiatives.fullView.overview.tasksCount',
  'initiatives.fullView.overview.keyMetrics',
  'initiatives.fullView.overview.timeline',
  'initiatives.fullView.overview.ownership',
  'common.documentTypes.initiative',
  ...['teamHandbook', 'contentCalendar', 'productRoadmap', 'issueTracker', 'projectManagement', 'crmPipeline']
    .flatMap((template) => [
      `kimi.template.system.${template}.name`,
      `kimi.template.system.${template}.description`,
    ]),
];

const auditedComponents = [
  'src/components/Initiatives/InitiativeFullView.tsx',
  'src/components/Initiatives/InitiativesHub.tsx',
  'src/components/Economics/FinanceValuePanelsSurface.tsx',
  'src/components/Execution/ExecutionTimelineView.tsx',
  'src/components/AIChat/ConversationItem.tsx',
  'src/components/AIChat/TrustBadge.tsx',
  'src/components/settings/ProfileSettings.tsx',
];

const stopList = [
  'Approve',
  'Cancel',
  'Overview',
  'Tasks',
  'Definition',
  'Economics',
  'Team',
  'History',
  'Not assigned',
  'No tasks',
  'Start Date',
  'End Date',
  'Business Owner',
  'Drop initiatives',
  'New conversation',
  'sources',
  'Unknown',
  'Initiatives',
  'Organization',
  'Audits',
  'Product',
  'Triage',
  'Summarize',
  'Build an initial',
];

describe('P3 — koniec angielskiego', () => {
  it('każdy status i każda akcja lifecycle ma rozwiązywalny klucz w PL i EN', () => {
    const statusKeys = Object.values(STATUS_METADATA).flatMap((meta) => [
      meta.labelKey,
      meta.descriptionKey,
    ]);
    const actionKeys = new Set(
      Object.values(InitiativeStatus).flatMap((status) =>
        getStatusActions(status as InitiativeStatus).map((action) => action.labelKey)
      )
    );

    expect(Object.keys(STATUS_METADATA)).toHaveLength(13);
    expect(actionKeys.size).toBe(15);
    for (const key of [...statusKeys, ...actionKeys]) {
      expect(get(pl, key), `PL: ${key}`).toBeTypeOf('string');
      expect(get(en, key), `EN: ${key}`).toBeTypeOf('string');
    }
  });

  it('Menu 3, pasek wyceny, źródła i role są kompletne oraz symetryczne', () => {
    expect(menu3Keys).toHaveLength(18);
    expect(valuationToolKeys).toHaveLength(21);
    const keys = [
      ...menu3Keys,
      ...valuationToolKeys,
      'trust.badge.sources',
      'trust.badge.noSources',
      ...profileRoleKeys,
      ...runtimeRepairKeys,
      'execution.review.roles.executionManager',
      'execution.review.roles.controlsEngineer',
    ];
    for (const key of keys) {
      expect(get(pl, key), `PL: ${key}`).toBeTypeOf('string');
      expect(get(en, key), `EN: ${key}`).toBeTypeOf('string');
    }
  });

  it('nie ma identycznych gałęzi językowych ani surowych tokenów stop-listy', () => {
    const identicalBranch = /isPolish\s*\?\s*'([^']+)'\s*:\s*'\1'/g;
    for (const root of ['src', 'server']) {
      const matches = sourceFiles(resolve(process.cwd(), root)).flatMap(
        (file) => readFileSync(file, 'utf8').match(identicalBranch) ?? []
      );
      expect(matches, root).toHaveLength(0);
    }

    const exactToken = new RegExp(
      `['\"](?:${stopList.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})['\"]`,
      'g'
    );
    for (const file of auditedComponents) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      const rawLines = source
        .split('\n')
        .filter((line) => !line.includes('t('))
        .join('\n');
      expect(rawLines.match(exactToken) ?? [], file).toHaveLength(0);
    }
  });
});
