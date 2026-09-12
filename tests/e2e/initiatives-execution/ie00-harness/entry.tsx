import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '@/providers/AppProviders';
import { Toaster } from 'react-hot-toast';
import '@/i18n';
import '@/index.css';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { InitiativesHub } from '@/components/Initiatives/InitiativesHub';
import { InitiativeDocumentView } from '@/components/Initiatives/InitiativeDocumentView';
import { DecisionsPanelContent } from '@/components/MyWork/DecisionsPanelContent';

// Real presenters and real Gateway/JWT/PG. The harness supplies no API responses.
const user = await Api.getMe();
if (!user) throw new Error('Real authenticated local actor required');
useAppStore.setState({ currentUser: user, isAuthenticated: true });
const params = new URLSearchParams(location.search);
const initiativeId = params.get('initiativeId') || 'initiative-definition-1';
createRoot(document.getElementById('root')!).render(
  <AppProviders>
    <div className="h-screen bg-c-bg text-c-text">
      <Toaster />
      {params.get('view') === 'hub' ? (
        <InitiativesHub />
      ) : params.get('view') === 'decisions' ? (
        <DecisionsPanelContent
          viewMode="all"
          searchQuery=""
          onCountsChange={() => {}}
          onDecisionClick={(id) => {
            (window as any).__ie00GenericDecisionOpens = [
              ...((window as any).__ie00GenericDecisionOpens || []),
              id,
            ];
          }}
        />
      ) : (
        <InitiativeDocumentView initiativeId={initiativeId} sourceModule="initiatives" />
      )}
    </div>
  </AppProviders>
);
