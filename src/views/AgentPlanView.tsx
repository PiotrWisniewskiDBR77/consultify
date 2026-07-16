/**
 * AgentPlanView (HP-4 F3, Harvey-Parity) — page-level entry point for
 * AgentPlanWorkspace (src/components/AIChat/AgentPlanWorkspace.tsx).
 *
 * Problem this closes: the HP-4 engine (PlanBuilder, /api/ai/agent-plan,
 * AgentManifestLauncher, AgentPlanPanel) was fully wired end-to-end but no
 * real screen rendered AgentPlanWorkspace — a user had no way to reach it.
 * This is the SMALLEST addition that gives an entry: a dedicated route
 * (`/agent-plan`, see routeConfig.ts + AppRoutes.tsx) + sidebar item
 * (menuConfig.ts), both gated by `isAgentPlanEnabled()`. It does NOT touch
 * the chat send/stream pipeline (UnifiedChatPanel.tsx) at all — chat→plan
 * wiring (detecting "run agent" intent inside a conversation) stays a
 * separate, later task per the concept doc.
 *
 * Powierzchnia wizualnie nowa → gejtowana `isAgentPlanEnabled()` (default
 * OFF, reguła #7/#9 CLAUDE.md). Self-gates (returns null) in addition to the
 * route-level redirect in AppRoutes.tsx, mirroring ClientDocumentsVault.
 *
 * Layout: intro copy on the left, AgentPlanWorkspace docked on the right
 * (doktryna panel-Teresy-zawsze-po-prawej, #56) — same ArtifactRightPanel
 * shell used everywhere else for artifact side panels.
 */
import { Bot } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { AgentPlanWorkspace } from '@/components/AIChat/AgentPlanWorkspace';
import { isAgentPlanEnabled } from '@/utils/agentPlanFlag';

export const AgentPlanView: React.FC = () => {
  const { t } = useTranslation();

  if (!isAgentPlanEnabled()) return null;

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col justify-center lg:max-w-xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-c-surface-raised text-c-text-muted">
          <Bot size={22} />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-c-text">
          {t('agentPlan.view.title', 'Run agent')}
        </h1>
        <p className="text-sm text-c-text-muted">
          {t(
            'agentPlan.view.body',
            'Pick a ready-made agent from the catalog and launch it as a background plan. Steps that need your sign-off wait in the Approvals section until you confirm them.'
          )}
        </p>
      </div>
      <div className="shrink-0">
        <AgentPlanWorkspace />
      </div>
    </div>
  );
};

export default AgentPlanView;
