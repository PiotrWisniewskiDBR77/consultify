/**
 * JEZYK-CRIMSON-3 (09.09) — dowod wzrokiem dla DBR77ReportTemplate.tsx
 * (etykiety "AUTOMATYZUJ"/"Stanowisk", linie ~219/~392).
 *
 * STOP zmierzony przy tej paczce: metoda DBR77 Lean 4.0 ma
 * `status: 'coming_soon'` w src/services/frameworkRegistry.ts (Decision D-B:
 * "beta placeholder in v1 — shown honestly as coming soon and NOT startable
 * until the structure/report are wired"). Nie da sie wygenerowac tego raportu
 * przez zadna zywa sciezke nawigacji aplikacji — dlatego harness montuje
 * <DBR77ReportTemplate> STANDALONE z reczna atrapa danych (ksztalt
 * DBR77AssessmentData z src/types/core.ts), zgodnie z CLAUDE.md #7
 * ("dev-render/harness z mock-danymi, bez logowania Piotra").
 *
 * URL: ?screen=assessment-dbr77-report&lang=pl|en&theme=light|dark
 */
import React from 'react';

import { DBR77ReportTemplate } from '../../src/components/assessment/reports/templates/DBR77ReportTemplate';
import type { DBR77AssessmentData } from '../../src/types';

const MOCK_DATA: DBR77AssessmentData = {
  processes: [
    {
      id: 'proc-1',
      name: 'Obsluga zamowien',
      department: 'Sprzedaz',
      category: 'VALUE_STREAM',
      currentState: {
        cycleTime: 45,
        taktTime: 30,
        leadTime: 120,
        wip: 8,
        defectRate: 4,
        oee: 62,
        valueAddedRatio: 0.55,
      },
      leanAssessment: {
        wasteIdentified: ['TRANSPORTATION', 'WAITING'],
        wasteImpact: { TRANSPORTATION: 2, WAITING: 3 },
        fiveSLevel: 3,
        standardWorkDefined: true,
        visualManagement: 3,
        continuousFlow: 2,
      },
      automationPotential: {
        feasibility: 4,
        roi: 180,
        complexity: 'MEDIUM',
        recommendedTechnologies: ['RPA'],
        estimatedSavings: 120000,
        implementationTime: 6,
      },
      priority: 1,
    },
  ],
  workstations: [
    {
      id: 'ws-1',
      name: 'Stanowisko pakowania',
      department: 'Logistyka',
      headcount: 6,
      currentState: {
        tasksPerDay: 80,
        avgTaskTime: 6,
        errorRate: 2,
        overtimeHours: 5,
        skillLevel: 2,
        digitalMaturity: 2,
      },
      leanAssessment: {
        workplaceOrganization: 4,
        standardizedWork: true,
        wasteInRole: ['MOTION'],
        wasteImpact: { MOTION: 2 },
        crossTraining: 3,
        kaizen: 2,
      },
      automationPotential: {
        taskAutomationPercent: 65,
        augmentationPercent: 20,
        roleEvolution: 'TRANSFORM',
        retrainingNeeded: true,
        newSkillsRequired: ['Obsluga cobotow'],
        estimatedSavings: 80000,
        recommendedTechnologies: ['RPA'],
      },
      priority: 1,
    },
  ],
  managementPractices: {
    dailyManagement: {
      tieredMeetings: true,
      visualBoards: 3,
      kpiTracking: 4,
      problemSolving: 'A3',
      gembaWalks: 2,
    },
    continuousImprovement: {
      kaizenEvents: 4,
      suggestionSystem: true,
      pdcaCycles: 3,
      rootCauseAnalysis: 3,
    },
    peopleDevelopment: {
      trainingHoursPerYear: 16,
      multiSkilling: 2,
      coachingCulture: 3,
    },
  },
  summary: {
    totalProcesses: 1,
    totalWorkstations: 1,
    totalHeadcount: 6,
    avgLeanMaturity: 3.2,
    avgAutomationPotential: 58,
    totalEstimatedSavings: 200000,
    topWastes: ['TRANSPORTATION', 'WAITING', 'MOTION'],
  },
  metadata: {
    assessmentDate: '2026-09-09',
    version: '1.0',
    assessor: 'audyt@dbr77.local',
  },
};

export default function AssessmentDbr77ReportScreen(): React.ReactElement {
  return (
    <div className="min-h-screen bg-c-bg">
      <DBR77ReportTemplate
        data={MOCK_DATA}
        organizationName="Atelier Toys"
        assessmentDate="2026-09-09"
      />
    </div>
  );
}
