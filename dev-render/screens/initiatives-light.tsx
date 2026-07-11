/**
 * Mock host for <InitiativesLightShell> — the Initiatives module light shell.
 *
 * Reuses the REAL component (no re-implementation) and feeds it realistic
 * DBR77 scale-up numbers shaped like the real engine contracts:
 *   - initiatives: `PortfolioInitiativeLite[]` — mixes source types (idea /
 *     assessment / interview / audit, mirrors `InitiativeSourceLink.tsx`
 *     labels), statuses (draft/planning/executing/blocked/done, condensed
 *     from `InitiativeStatus`), results (mirrors `InitiativeKPI` on-target
 *     shape) and stakeholders (RACI, mirrors `StakeholdersSection.tsx`).
 * A few initiative names are reused from `initiativesDemoData.ts` (Knowledge
 * Hub Rollout, Supplier Onboarding Portal, Warehouse Automation Pilot,
 * Margin Leakage Recovery Sprint, Field Service Dispatch Redesign) so the
 * portfolio stays consistent with the rest of the demo dataset.
 */
import React from 'react';

import InitiativesLightShell, {
  type PortfolioInitiativeLite,
} from '../../src/components/Initiatives/InitiativesLightShell';

const INITIATIVES: PortfolioInitiativeLite[] = [
  {
    id: 'init-khr',
    name: 'Knowledge Hub Rollout',
    axis: 'Ludzie i kompetencje',
    status: 'executing',
    priority: 'HIGH',
    progress: 62,
    sourceType: 'assessment',
    sourceLabel: 'Digital Readiness — Oś 5 (Ludzie)',
    ownerName: 'Alex Chen',
    budget: 340_000,
    expectedRoi: 2.1,
    results: [
      { name: 'Owner ramp-up time', unit: 'dni', current: 6, target: 3, onTarget: false },
      { name: 'Template adoption', unit: '%', current: 54, target: 80, onTarget: false },
    ],
    stakeholders: [
      { name: 'Alex Chen', role: 'accountable' },
      { name: 'Lena Meyer', role: 'responsible' },
      { name: 'Marta Gomez', role: 'consulted' },
    ],
  },
  {
    id: 'init-sop',
    name: 'Supplier Onboarding Portal',
    axis: 'Procesy',
    status: 'planning',
    priority: 'MEDIUM',
    progress: 28,
    sourceType: 'interview',
    sourceLabel: 'Interview Insight — Zakupy',
    ownerName: 'Marta Gomez',
    budget: 210_000,
    expectedRoi: 1.6,
    results: [
      { name: 'Activation lead time', unit: 'dni', current: 26, target: 17, onTarget: false },
      { name: 'Incomplete submissions', unit: '%', current: 36, target: 15, onTarget: false },
    ],
    stakeholders: [
      { name: 'Marta Gomez', role: 'accountable' },
      { name: 'Omar Haddad', role: 'informed' },
    ],
  },
  {
    id: 'init-wap',
    name: 'Warehouse Automation Pilot',
    axis: 'Technologia',
    status: 'executing',
    priority: 'CRITICAL',
    progress: 71,
    sourceType: 'assessment',
    sourceLabel: 'Digital Readiness — Oś 4 (Dane)',
    ownerName: 'Elaine Porter',
    budget: 890_000,
    expectedRoi: 3.4,
    results: [
      { name: 'Picks per labor hour', unit: 'pph', current: 84, target: 92, onTarget: false },
      { name: 'Exception recovery time', unit: 'min', current: 47, target: 30, onTarget: false },
    ],
    stakeholders: [
      { name: 'Elaine Porter', role: 'accountable' },
      { name: 'Alex Chen', role: 'responsible' },
      { name: 'Lena Meyer', role: 'consulted' },
      { name: 'Omar Haddad', role: 'informed' },
    ],
  },
  {
    id: 'init-mlrs',
    name: 'Margin Leakage Recovery Sprint',
    axis: 'Finanse',
    status: 'blocked',
    priority: 'CRITICAL',
    progress: 34,
    sourceType: 'audit',
    sourceLabel: 'Audit Readout — Finanse Q1',
    ownerName: 'Omar Haddad',
    budget: 120_000,
    expectedRoi: 4.8,
    results: [
      { name: 'Recovered margin', unit: 'kEUR', current: 96, target: 420, onTarget: false },
      { name: 'Weekly control adherence', unit: '%', current: 55, target: 90, onTarget: false },
    ],
    stakeholders: [
      { name: 'Omar Haddad', role: 'accountable' },
      { name: 'Marta Gomez', role: 'responsible' },
    ],
  },
  {
    id: 'init-fsdr',
    name: 'Field Service Dispatch Redesign',
    axis: 'Procesy',
    status: 'done',
    priority: 'HIGH',
    progress: 100,
    sourceType: 'interview',
    sourceLabel: 'Interview Insight — Serwis terenowy',
    ownerName: 'Lena Meyer',
    budget: 175_000,
    expectedRoi: 2.9,
    results: [
      { name: 'Idle technician time', unit: '%', current: 12, target: 12, onTarget: true },
      { name: 'First-time-right rate', unit: '%', current: 81, target: 80, onTarget: true },
    ],
    stakeholders: [
      { name: 'Lena Meyer', role: 'accountable' },
      { name: 'Elaine Porter', role: 'informed' },
    ],
  },
  {
    id: 'init-crm',
    name: 'CRM Data Hygiene Initiative',
    axis: 'Dane',
    status: 'draft',
    priority: 'MEDIUM',
    progress: 8,
    sourceType: 'idea',
    sourceLabel: 'Idea Workspace — Mind Map „Dane klienckie"',
    ownerName: 'Alex Chen',
    budget: 65_000,
    expectedRoi: 1.2,
    results: [],
    stakeholders: [{ name: 'Alex Chen', role: 'responsible' }],
  },
  {
    id: 'init-onb',
    name: 'New Hire Onboarding Automation',
    axis: 'Ludzie i kompetencje',
    status: 'planning',
    priority: 'LOW',
    progress: 15,
    sourceType: 'idea',
    sourceLabel: 'Idea Workspace — Tabela „Braki procesowe HR"',
    ownerName: 'Lena Meyer',
    budget: 48_000,
    expectedRoi: 0.9,
    results: [{ name: 'Time-to-productive', unit: 'dni', current: 21, target: 14, onTarget: false }],
    stakeholders: [
      { name: 'Lena Meyer', role: 'accountable' },
      { name: 'Marta Gomez', role: 'consulted' },
    ],
  },
];

export function InitiativesLightScreen(): React.ReactElement {
  const noop = () => {};
  return (
    <InitiativesLightShell
      portfolioName="DBR77 Sp. z o.o. — Portfolio inicjatyw"
      currency="PLN"
      initiatives={INITIATIVES}
      lastUpdatedLabel="Zaktualizowano dziś, 08:15 · sync silnika portfolio"
      onCreateInitiative={noop}
      onOpenChat={noop}
    />
  );
}

export default InitiativesLightScreen;
