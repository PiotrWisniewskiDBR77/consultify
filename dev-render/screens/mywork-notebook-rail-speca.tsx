/**
 * Dev-render: prawa szyna Notatnika w kanonie SPEC-A (DEC-69) —
 * `NotebookRightRail` po przebudowie z Work/Context tabów na accordion
 * 5-sekcyjny (Akcje·Właściwości·Powiązania·Komentarze·Historia i AI),
 * wg `mywork-notatnik-szyna-prototyp.html`.
 *
 * `NotebookContextPanel` (sekcja Powiązania) woła prawdziwe hooki danych
 * (useArtifactOutputsForInitiatives itd.) — mockujemy `Api.*` metody, które
 * te hooki i sam rail wołają, zamiast re-implementować komponent.
 */
import React from 'react';

import { NotebookRightRail } from '@/components/MyWork/notebook/NotebookRightRail';
import { Api } from '@/services/api';
import type { NotebookPage } from '@/types/myWork';

type ApiShape = Record<string, unknown>;

const installMocks = () => {
  const api = Api as unknown as ApiShape;
  api.getIdeas = async () => [];
  api.getInitiatives = async () => [
    { id: 'init-1', title: 'Standard klucza klienta (MDM)', status: 'in_progress' },
  ];
  api.getTasks = async () => [
    { id: 'task-1', title: 'Zdefiniować standard MDM', status: 'todo' },
  ];
  api.getDecisions = async () => [];
  api.getNotebookPages = async () => [];
  api.getBacklinks = async () => [];
  api.notebookSemanticSearch = async () => [];
};
installMocks();

const ACTIVE_PAGE: NotebookPage = {
  id: 'page-1',
  title: 'Warsztat 3: migracja danych',
  projectId: 'proj-1',
  visibility: 'project',
  tags: ['warsztat', 'migracja'],
  contentJson: null,
  contentText: 'Warsztat zamknął pytanie, czy migrację da się zrobić bez wcześniejszego uporządkowania klucza klienta…',
  maturity: 'growing',
  icon: null,
  summary: 'Warsztat 3 — migracja danych, ustalenia i otwarte wątpliwości.',
  status: 'active',
  pinned: false,
  convertedTo: [],
  ownerUserId: 'user-1',
  ownerDisplayName: 'Anna Kowalska',
  verificationStatus: 'unverified',
  reviewCadence: 'monthly',
  staleAt: null,
  lastReviewedAt: null,
  captureSource: 'manual',
  captureMetadata: null,
  wordCount: 1248,
  createdAt: '2026-07-30T09:00:00Z',
  updatedAt: '2026-07-30T15:04:00Z',
};

export default function MyWorkNotebookRailSpecAScreen(): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<'work' | 'context'>('work');
  return (
    <div className="flex h-screen w-screen items-stretch justify-end bg-c-bg">
      <div className="flex-1 min-w-0 flex items-center justify-center p-10 text-c-text-muted text-sm">
        (centrum: dokument Notatnika — ten harness izoluje wyłącznie prawą szynę)
      </div>
      <div className="h-full border-l border-c-border-subtle">
        <NotebookRightRail
          open
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={() => undefined}
          ownerLabel="Anna Kowalska"
          activePage={ACTIVE_PAGE}
          allPages={[ACTIVE_PAGE]}
          editor={null}
          noteTitle={ACTIVE_PAGE.title}
          noteContent={ACTIVE_PAGE.contentText}
          noteTags={ACTIVE_PAGE.tags}
          notePage={{
            id: ACTIVE_PAGE.id,
            maturity: ACTIVE_PAGE.maturity,
            summary: ACTIVE_PAGE.summary,
            updatedAt: ACTIVE_PAGE.updatedAt,
            visibility: ACTIVE_PAGE.visibility,
            projectId: ACTIVE_PAGE.projectId,
            wordCount: ACTIVE_PAGE.wordCount ?? 0,
          }}
          saveState="saved"
          onSetVisibility={() => undefined}
          onSetVerificationStatus={() => undefined}
          onSetReviewCadence={() => undefined}
          onMarkReviewed={() => undefined}
          getRelativeTime={(iso) => new Date(iso).toLocaleString('pl-PL')}
          onOpenAIChat={() => undefined}
          onExport={() => undefined}
          onShare={() => undefined}
          onToggleVersionHistory={() => undefined}
          receiptCapableActionIds={[
            'retry-save',
            'load-theirs',
            'keep-mine',
            'visibility-private',
            'visibility-project',
            'verification-status',
            'review-cadence',
            'mark-reviewed',
          ]}
        />
      </div>
    </div>
  );
}
