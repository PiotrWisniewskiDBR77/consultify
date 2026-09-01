/**
 * Dev-render: NOTATNIK na wspólnym prawym pasie (`ArtifactRightRail`).
 *
 * Po co: CLAUDE.md #7 — właściciel nigdy nie jest pierwszym testerem
 * wizualnym. Ten harness renderuje REALNY `NotebookRightRail` (nie kopię,
 * nie prototyp) za flagą `?ff_artifact_right_rail=1`, żeby dało się zrobić
 * zrzut każdego trybu pasa PRZED tym, jak właściciel go zobaczy.
 *
 * Dowód „flaga OFF nic nie zmienia" robi się na INNYM, nietkniętym ekranie
 * (`?screen=mywork-notebook-rail-speca`) — porównanie PRZED/PO na tej samej
 * powierzchni. Ten plik służy wyłącznie wariantom z flagą ON.
 *
 * Zarejestrowany 3× ze stałym trybem startowym (`-artefakt`, `-teresa`,
 * `-struktura`), bo `scripts/dev/grafika-zrzuty.mjs` nie klika UI, a wszystkie
 * trzy tryby pod jednym `?screen=` nadpisywałyby sobie plik wyjściowy
 * (nazwa pliku = nazwa ekranu). Ten sam wzorzec, co przy prototypie
 * `prawy-pas-jedna-formula`.
 *
 * Mocki `Api.*` jak w `mywork-notebook-rail-speca` — sekcja Powiązania woła
 * prawdziwe hooki danych, więc podmieniamy metody API zamiast reimplementować
 * komponent. `contentJson` jest realnym dokumentem ProseMirror z nagłówkami,
 * żeby tryb „Struktura notatki" pokazywał prawdziwie wyliczoną treść, a nie
 * zaślepkę.
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
  api.getTasks = async () => [{ id: 'task-1', title: 'Zdefiniować standard MDM', status: 'todo' }];
  api.getDecisions = async () => [];
  api.getNotebookPages = async () => [];
  api.getBacklinks = async () => [];
  api.notebookSemanticSearch = async () => [];
};
installMocks();

const heading = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});

const CONTENT_JSON = {
  type: 'doc',
  content: [
    heading(1, 'Warsztat 3: migracja danych'),
    { type: 'paragraph', content: [{ type: 'text', text: 'Ustalenia z sesji z zespołem klienta.' }] },
    heading(2, 'Ustalenia'),
    heading(3, 'Klucz klienta (MDM)'),
    heading(3, 'Dane historyczne sprzed 2024'),
    heading(2, 'Otwarte pytania'),
    heading(2, 'Następne kroki'),
  ],
};

const ACTIVE_PAGE: NotebookPage = {
  id: 'page-1',
  title: 'Warsztat 3: migracja danych',
  projectId: 'proj-1',
  visibility: 'project',
  tags: ['warsztat', 'migracja'],
  contentJson: CONTENT_JSON,
  contentText:
    'Warsztat zamknął pytanie, czy migrację da się zrobić bez wcześniejszego uporządkowania klucza klienta…',
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

export interface PrawyPasNotatnikSystemScreenProps {
  /** Tryb pasa otwarty na starcie. Odpowiada ikonom szyny w tej kolejności. */
  tryb?: 'artefakt' | 'teresa' | 'struktura';
}

export default function PrawyPasNotatnikSystemScreen({
  tryb = 'artefakt',
}: PrawyPasNotatnikSystemScreenProps): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<'work' | 'context'>('work');
  return (
    <div className="flex h-screen w-screen items-stretch justify-end bg-c-bg">
      {/* Centrum — filler harnessu, daje prawemu pasowi realny kontekst szerokości.
          Kontener zostaje (layout), etykieta-tekst znika przy zrzutach (bramka PODPIS, 2026-09-01). */}
      <div className="flex min-w-0 flex-1 items-center justify-center p-10 text-sm text-c-text-muted">
        <span data-dev-render-chrome="true">
          (centrum: dokument Notatnika — ten harness izoluje wyłącznie prawy pas)
        </span>
      </div>
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
        onFocusAICommand={() => undefined}
        onOpenAIChat={() => undefined}
        onConvert={() => undefined}
        canConvertDeliverable
        onExport={() => undefined}
        onShare={() => undefined}
        onToggleVersionHistory={() => undefined}
        defaultRailModeId={tryb}
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
  );
}
