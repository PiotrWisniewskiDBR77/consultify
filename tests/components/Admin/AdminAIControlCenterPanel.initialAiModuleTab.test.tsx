/**
 * @vitest-environment jsdom
 *
 * Admin komplet 55, Fala 1 — verifies AdminAIControlCenterPanel opens
 * straight into "AI operations" (skipping the default "Governance settings"
 * tab) and forwards the requested AIModule sub-tab, whenever
 * AdminSettingsModule points it at a WIRE_ONLY AI screen (models-providers,
 * ai-limits-budgets, data-privacy, ai-operations, ai-audit).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AdminAIControlCenterPanel } from '@/components/Admin/AdminAIControlCenterPanel';

vi.mock('@/services/api', () => ({
  Api: {
    getAdminAISummary: vi.fn().mockResolvedValue({ summary: {} }),
  },
}));

vi.mock('@/views/admin/OrgAISettingsView', () => ({
  OrgAISettingsView: () => <div data-testid="panel-settings">settings</div>,
}));

vi.mock('@/views/admin/AIModule', () => ({
  AIModule: ({ initialTab }: { initialTab?: string }) => (
    <div data-testid="panel-ai-module" data-initial-tab={initialTab}>
      ai-module
    </div>
  ),
}));

describe('AdminAIControlCenterPanel initialAiModuleTab', () => {
  it('defaults to Governance settings when no tab is requested', async () => {
    render(<AdminAIControlCenterPanel />);
    expect(await screen.findByTestId('panel-settings')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-ai-module')).not.toBeInTheDocument();
  });

  it('opens on AI operations and forwards the requested sub-tab', async () => {
    render(<AdminAIControlCenterPanel initialAiModuleTab="models-providers" />);
    const panel = await screen.findByTestId('panel-ai-module');
    expect(screen.queryByTestId('panel-settings')).not.toBeInTheDocument();
    expect(panel).toHaveAttribute('data-initial-tab', 'models-providers');
  });
});
