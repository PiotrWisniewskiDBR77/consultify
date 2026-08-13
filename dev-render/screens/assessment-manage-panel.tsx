/**
 * ODBIÓR — AssessmentManagePanel (Assessment → sesja → zakładka „Manage")
 *
 * TRIADA verification harness for the manage/ surfaces fixed in this pass:
 * WorkflowStagesTable (gate accent colors), TeamManagementPanel (role badge
 * colors + focus rings + active-tab pigułka), InitiativesManagementPanel /
 * ReportsManagementPanel (checkboxes/focus rings/avatars). Mounts the REAL
 * <AssessmentManagePanel> inside AppProviders with Api.get/post/put stubbed
 * for the /assessment-workflow-v2/:id/* surface it calls on mount.
 *
 * URL params: &tab=workflow|team|reports|initiatives|logs &theme=light|dark
 */
import React from 'react';

import { AssessmentManagePanel } from '../../src/components/assessment/manage/AssessmentManagePanel';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

const ASSESSMENT_ID = 'assess-manage-1';

const MOCK_ROLES = [
  {
    id: 'role-1',
    assessmentId: ASSESSMENT_ID,
    userId: 'user-piotr-demo',
    organizationId: 'org-demo',
    role: 'manager',
    canEdit: true,
    canApprove: true,
    canManageTeam: true,
    canChangeStatus: true,
    userName: 'Piotr Wiśniewski',
    userEmail: 'piotr@demo.pl',
  },
  {
    id: 'role-2',
    assessmentId: ASSESSMENT_ID,
    userId: 'user-anna-demo',
    organizationId: 'org-demo',
    role: 'admin',
    canEdit: true,
    canApprove: true,
    userName: 'Anna Kowalska',
    userEmail: 'anna@demo.pl',
  },
  {
    id: 'role-3',
    assessmentId: ASSESSMENT_ID,
    userId: 'user-jan-demo',
    organizationId: 'org-demo',
    role: 'editor',
    canEdit: true,
    userName: 'Jan Nowak',
    userEmail: 'jan@demo.pl',
  },
  {
    id: 'role-4',
    assessmentId: ASSESSMENT_ID,
    userId: 'user-ola-demo',
    organizationId: 'org-demo',
    role: 'viewer',
    userName: 'Ola Zielińska',
    userEmail: 'ola@demo.pl',
  },
];

const MOCK_ELIGIBILITY = {
  assessment: {
    id: ASSESSMENT_ID,
    type: 'DRD',
    status: 'IN_REVIEW',
    completionPercent: 82,
    confidenceAvg: 3.4,
  },
  roleInfo: {
    role: 'manager',
    permissions: {
      canManageTeam: true,
      canManage: true,
      canEdit: true,
      canApprove: true,
      canChangeStatus: true,
      canGenerateReport: true,
      canGenerateInitiatives: true,
    },
    assignedAreas: null,
    isOwner: true,
  },
  checks: [
    {
      key: 'completion',
      label: 'Definition of Done (DoD)',
      pass: true,
      severity: 'blocking' as const,
    },
    {
      key: 'confidence',
      label: 'Average confidence ≥ 3',
      pass: true,
      severity: 'warning' as const,
    },
  ],
  actions: {},
};

const MOCK_ASSESSMENT = {
  id: ASSESSMENT_ID,
  status: 'in_review',
  updated_at: '2026-08-10T09:00:00Z',
  completion_percent: 82,
  contextSnapshot: {},
};

const MOCK_GATE_DECISIONS = [
  {
    id: 'gate-1',
    gateType: 'REQUEST_REVIEW',
    fromStatus: 'DRAFT',
    toStatus: 'IN_REVIEW',
    approverRole: 'manager',
    assigneeId: 'user-piotr-demo',
    assigneeName: 'Piotr Wiśniewski',
    assigneeEmail: 'piotr@demo.pl',
    status: 'APPROVED',
    requestedAt: '2026-08-08T09:00:00Z',
    decidedAt: '2026-08-08T14:00:00Z',
  },
  {
    id: 'gate-2',
    gateType: 'APPROVE_REPORT',
    fromStatus: 'IN_REVIEW',
    toStatus: 'AWAITING_APPROVAL',
    approverRole: 'admin',
    assigneeId: 'user-anna-demo',
    assigneeName: 'Anna Kowalska',
    assigneeEmail: 'anna@demo.pl',
    status: 'PENDING',
    requestedAt: '2026-08-11T09:00:00Z',
  },
];

Api.get = (async (url: string) => {
  if (url === `/assessment-workflow-v2/${ASSESSMENT_ID}/roles`) return { roles: MOCK_ROLES };
  if (url === `/assessment-workflow-v2/${ASSESSMENT_ID}/access-requests`) return { requests: [] };
  if (url === `/assessment-workflow-v2/${ASSESSMENT_ID}`) return MOCK_ASSESSMENT;
  if (url === `/assessment-workflow-v2/${ASSESSMENT_ID}/eligibility`) return MOCK_ELIGIBILITY;
  if (url === `/assessment-workflow-v2/${ASSESSMENT_ID}/generated-initiatives`)
    return { initiatives: [] };
  if (url === `/assessment-workflow-v2/${ASSESSMENT_ID}/initiative-batches`)
    return {
      batches: [
        {
          id: 'batch-1',
          methodologyId: 'impact-feasibility',
          initiativesCount: 4,
          provenance: {},
        },
      ],
    };
  if (url === `/assessment-workflow-v2/${ASSESSMENT_ID}/gate-decisions`)
    return { decisions: MOCK_GATE_DECISIONS };
  if (url.startsWith(`/assessment-workflow-v2/${ASSESSMENT_ID}/users`)) return { users: [] };
  return {};
}) as typeof Api.get;

export function AssessmentManagePanelScreen(): React.ReactElement {
  const initialTab = new URLSearchParams(window.location.search).get('tab') || 'workflow';
  return (
    <AppProviders>
      <div style={{ height: '100vh', overflow: 'auto' }} className="p-4 bg-c-bg">
        <AssessmentManagePanel
          assessmentId={ASSESSMENT_ID}
          assessmentName="DBR77 · Digital Readiness Diagnosis — Grupa"
          initialTab={initialTab as any}
        />
      </div>
    </AppProviders>
  );
}

export default AssessmentManagePanelScreen;
