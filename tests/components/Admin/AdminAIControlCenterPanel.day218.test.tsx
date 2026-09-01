import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminAIControlCenterPanel } from '@/components/Admin/AdminAIControlCenterPanel';
import type { OrgContextPolicy } from '../../../server/src/services/ai/contextGovernance';
import type { PolicySummary } from '../../../server/src/services/aiPolicyEngine';

const { getAdminAISummary } = vi.hoisted(() => ({ getAdminAISummary: vi.fn() }));

vi.mock('@/services/api', () => ({ Api: { getAdminAISummary } }));
vi.mock('@/views/admin/AIModule', () => ({ AIModule: () => <div>AI module</div> }));
vi.mock('@/views/admin/OrgAISettingsView', () => ({ OrgAISettingsView: () => <div>Settings</div> }));
vi.mock('react-hot-toast', () => ({ toast: { error: vi.fn() } }));

type Expect<T extends true> = T;
type HasLegacyPolicySummaryFields = Extract<
  keyof PolicySummary,
  'policyLevel' | 'modelCount' | 'budgetStatus'
> extends never
  ? false
  : true;
type HasLegacyContextFields = Extract<
  keyof OrgContextPolicy,
  'defaultSensitivity' | 'allowExternalContext'
> extends never
  ? false
  : true;
type _PolicySummaryContract = Expect<HasLegacyPolicySummaryFields extends false ? true : false>;
type _ContextPolicyContract = Expect<HasLegacyContextFields extends false ? true : false>;

describe('AdminAIControlCenterPanel day218 honest policy states', () => {
  beforeEach(() => getAdminAISummary.mockReset());

  it('renders real governance, audit, internet, context and LLM policy values', async () => {
    getAdminAISummary.mockResolvedValue({
      summary: {
        governanceSummary: {
          currentLevel: 'PROACTIVE',
          internetEnabled: true,
          auditRequired: true,
        },
        contextPolicy: { piiRedaction: 'on' },
        llmPolicy: { review_state: 'APPROVED' },
        statuses: { governance: 'ok', context: 'ok', llm: 'ok' },
      },
    });

    render(<AdminAIControlCenterPanel />);

    expect(await screen.findByText('PROACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Internet enabled')).toBeInTheDocument();
    expect(screen.getByText('Audit: {{status}}')).toBeInTheDocument();
    expect(screen.getByText('on')).toBeInTheDocument();
    expect(screen.getByText('Review state: {{state}}')).toBeInTheDocument();
    expect(screen.getByText('External context: {{status}}')).toBeInTheDocument();
  });

  it('keeps an empty LLM policy distinct from a failed check', async () => {
    getAdminAISummary.mockResolvedValue({
      summary: {
        governanceSummary: {
          currentLevel: 'ADVISORY',
          internetEnabled: false,
          auditRequired: false,
        },
        contextPolicy: { piiRedaction: 'inherit' },
        llmPolicy: null,
        statuses: { governance: 'ok', context: 'ok', llm: 'ok' },
      },
    });

    render(<AdminAIControlCenterPanel />);

    expect(await screen.findByText('Review state: {{state}}')).toBeInTheDocument();
    expect(screen.queryByText('Unavailable (check failed)')).not.toBeInTheDocument();
  });

  it('renders a visually explicit unavailable state when the summary request fails', async () => {
    getAdminAISummary.mockResolvedValue({
      summary: {
        statuses: { governance: 'unavailable', context: 'unavailable', llm: 'unavailable' },
      },
    });

    render(<AdminAIControlCenterPanel />);

    await waitFor(() =>
      expect(screen.getAllByText('Unavailable (check failed)').length).toBeGreaterThanOrEqual(3)
    );
  });
});
