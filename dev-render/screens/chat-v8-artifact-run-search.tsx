/** Dyżur 315: real V8ArtifactRunControl, opened under its real providers. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { V8ArtifactRunControl } from '../../src/components/AIChat/V8ArtifactRunControl';
import { V8Provider } from '../../src/providers/V8Provider';
import { V8AdminApi } from '../../src/services/api/v8';
import { useAppStore } from '../../src/store/useAppStore';

(V8AdminApi as any).getFlags = async () => ({ chat: true });
useAppStore.setState({ currentUser: { id: 'owner-315', isAuthenticated: true } as any });
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const Inner: React.FC = () => {
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="v8-artifact-run-button"]')?.click();
    }, 300);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main className="flex min-h-screen justify-end bg-c-bg p-10 text-c-text">
      <V8ArtifactRunControl
        conversationId="conversation-315"
        defaultGoal="Przygotuj raport decyzji"
        snapshotContext={{ workspaceId: 'workspace-315' }}
      />
    </main>
  );
};

const Screen: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      <V8Provider>
        <Inner />
      </V8Provider>
    </MemoryRouter>
  </QueryClientProvider>
);

export default Screen;
