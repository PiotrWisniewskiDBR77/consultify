import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../../../public/locales/en/translation.json';
import pl from '../../../public/locales/pl/translation.json';
import {
  buildReportMarkdown,
  enrichExecutionReport,
} from '../../../src/components/Execution/executionReports';

async function translator(language: 'en' | 'pl') {
  const instance = i18next.createInstance();
  await instance.init({
    lng: language,
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      pl: { translation: pl },
    },
    interpolation: { escapeValue: false },
  });
  return instance.t.bind(instance);
}

describe('K6 bilingual object labels', () => {
  it('renders the explicit My Approvals and onboarding defects in English and Polish', async () => {
    const enT = await translator('en');
    const plT = await translator('pl');

    expect(enT('myWork.approvals.overdue')).toBe('Overdue');
    expect(plT('myWork.approvals.overdue')).toBe('Po terminie');
    expect(enT('myWork.approvals.emptyTitle')).toBe('No approvals found');
    expect(plT('myWork.approvals.emptyTitle')).toBe('Brak zatwierdzeń');
    expect(enT('onboarding.enterpriseWizard.progress', { current: 3, total: 4 })).toBe(
      'Step 3 of 4'
    );
    expect(plT('onboarding.enterpriseWizard.progress', { current: 3, total: 4 })).toBe(
      'Krok 3 z 4'
    );
  });

  it('interpolates real execution object labels without exposing placeholders', async () => {
    const enT = await translator('en');
    const plT = await translator('pl');

    expect(enT('execution.managementTable.criticalCount', { count: 2 })).toBe('2 critical');
    expect(plT('execution.managementTable.criticalCount', { count: 2 })).toBe('Krytyczne: 2');
    expect(enT('execution.rollout.closure.derived.handover', { name: 'ERP' })).toBe(
      'Handover: transfer ERP deliverables to operations'
    );
    expect(plT('execution.rollout.closure.derived.handover', { name: 'ERP' })).toBe(
      'Przekazanie: przekaż rezultaty inicjatywy ERP do operacji'
    );
  });

  it('translates every visible fallback report title into real English and Polish copy', async () => {
    const enT = await translator('en');
    const plT = await translator('pl');
    const keys = [
      'weeklyExecutionPack',
      'monthlyPmoReview',
      'programHealthSummary',
      'blockersRecoveryReport',
      'milestoneSlippageReport',
      'capacityUtilizationReport',
      'budgetVarianceReport',
      'decisionBacklogApprovalAging',
      'crossInitiativeDependencyReport',
      'deliveryConfidenceReport',
      'sponsorReadyOnePager',
    ];

    for (const key of keys) {
      const path = `execution.reports.catalog.${key}`;
      expect(enT(path)).not.toBe(path);
      expect(plT(path)).not.toBe(path);
      expect(plT(path)).not.toBe(enT(path));
    }
  });

  it('builds the Polish executive readout and hygiene labels without English leakage', async () => {
    await i18next.init({
      lng: 'pl',
      fallbackLng: 'en',
      resources: { en: { translation: en }, pl: { translation: pl } },
      interpolation: { escapeValue: false },
    });

    const report = enrichExecutionReport(
      {
        id: 'weekly',
        title: 'Tygodniowy pakiet realizacji',
        audience: 'PMO',
        cadence: 'Tygodniowo',
        scope: 'Portfel',
        dataSources: ['Inicjatywy'],
        sections: ['Stan'],
        ragLogic: 'Stan bieżący',
        followUpActions: [],
        icon: null,
        highlights: [],
      },
      {
        initiatives: [{ id: 'i1', name: 'ERP', status: 'BLOCKED', progress: 20 }],
        tasks: [{ id: 't1', title: 'Plan', status: 'TODO' }],
        decisions: [],
        blocked: [{ id: 'i1', name: 'ERP' }],
        riskSignals: [],
        delaySignals: [],
        overdueDecisions: [],
        missingDates: [{ id: 'i1', name: 'ERP' }],
        dueSoonTasks: [],
        overspendSignals: [{}],
        nextMilestones: [],
        priorityAlerts: [],
        timelineWarnings: [],
        capacityAlerts: [],
        capacityTimeline: [],
        progressPercent: 20,
        totalInitiatives: 1,
      }
    );

    const markdown = buildReportMarkdown(report, 'amber');
    expect(report.aiExecutiveReadout).toHaveLength(5);
    expect(report.aiExecutiveReadout.join(' ')).toContain('Stan budżetu oszacowano');
    expect(report.aiExecutiveReadout.join(' ')).not.toMatch(
      /Budget posture|Forecast quality|Blocked work|Progress baseline/
    );
    expect(markdown).toContain('## Omówienie zarządcze AI');

    const plT = await translator('pl');
    expect(plT('executionReports.doc.initiativesWithoutDates')).toBe('Inicjatywy bez dat');
    expect(plT('executionReports.doc.tasksWithoutDueDate')).toBe('Zadania bez terminu');
    expect(plT('executionReports.doc.daysOverdue', { count: 3 })).toBe('3 dni po terminie');
  });
});
