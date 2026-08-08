/**
 * AgentPlanWorkspace — composes the manifest launcher + the plan panel (HP-4).
 *
 * Doctrine (panel-Teresy-zawsze-po-prawej, #56): a single right-hand dock.
 * Before a plan exists it shows the "pick one of 31 agents" launcher
 * (AgentManifestLauncher.tsx); once a plan is created it swaps to the real
 * progress panel (AgentPlanPanel.tsx) — same `ArtifactRightPanel` shell in
 * both states, so there is no layout jump.
 *
 * This is the only entry point that should render the agent-plan UI as one
 * coherent surface; it is NOT yet mounted anywhere in the app shell (see
 * agentPlanFlag.ts header) — chat→plan wiring is a separate, smaller task
 * (concept §2 "Minimalna zmiana w czacie").
 */
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ArtifactRightPanel } from '@/components/standard/ArtifactRightPanel';

import { AgentManifestLauncher } from './AgentManifestLauncher';
import { AgentPlanPanel } from './AgentPlanPanel';

export interface AgentPlanWorkspaceProps {
  /** Pre-existing plan to resume into (e.g. a link from chat's "See plan ->" card). */
  initialPlanId?: string;
  onClose?: () => void;
}

export const AgentPlanWorkspace: React.FC<AgentPlanWorkspaceProps> = ({
  initialPlanId,
  onClose,
}) => {
  const { t } = useTranslation();
  const [planId, setPlanId] = useState<string | null>(initialPlanId ?? null);

  const handlePlanCreated = useCallback((newPlanId: string) => {
    setPlanId(newPlanId);
  }, []);

  const handleBackToLauncher = useCallback(() => {
    setPlanId(null);
  }, []);

  if (!planId) {
    return (
      <ArtifactRightPanel
        ariaLabel={t('agentPlan.launcher.panelName', 'Agent launcher')}
        sections={[
          {
            id: 'launcher',
            label: t('agentPlan.launcher.section', 'Agents'),
            collapsible: false,
            children: <AgentManifestLauncher onPlanCreated={handlePlanCreated} />,
          },
        ]}
      />
    );
  }

  return <AgentPlanPanel planId={planId} onClose={onClose ?? handleBackToLauncher} />;
};

export default AgentPlanWorkspace;
