/** Dyżur 315: real ProjectMembersModal with deterministic local API data. */
import React from 'react';

import { ProjectMembersModal } from '../../src/components/AIChat/ProjectMembersModal';
import { Api } from '../../src/services/api';
import { useChatProjectStore } from '../../src/store/useChatProjectStore';

(Api as any).getProjectMembers = async () => ({
  members: [{ user_id: 'owner-315', role: 'owner', name: 'Piotr' }],
  myRole: 'owner',
});
(Api as any).getProjectKnowledge = async () => ({
  knowledge: [],
  history: [],
  historyStatus: 'available',
});
useChatProjectStore.setState({
  projects: [{ id: 'project-315', name: 'Crimson audit', visibility: 'org' }] as any,
});

const Screen: React.FC = () => {
  React.useEffect(() => {
    const focusInvite = () =>
      document.querySelector<HTMLInputElement>('input:not([type])')?.focus();
    focusInvite();
    const timer = window.setInterval(focusInvite, 200);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <main className="min-h-screen bg-c-bg text-c-text">
      <ProjectMembersModal
        isOpen
        onClose={() => {}}
        projectId="project-315"
        projectName="Crimson audit"
      />
    </main>
  );
};

export default Screen;
