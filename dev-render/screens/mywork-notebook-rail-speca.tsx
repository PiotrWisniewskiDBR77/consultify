/**
 * Dev-render: prawa szyna Notatnika w kanonie SPEC-A (DEC-69) —
 * `NotebookRightRail` po przebudowie z Work/Context tabów na accordion
 * 5-sekcyjny (Akcje·Właściwości·Powiązania·Komentarze·Historia i AI),
 * wg `mywork-notatnik-szyna-prototyp.html`.
 *
 * `NotebookContextPanel` (sekcja Powiązania) woła prawdziwe hooki danych
 * (useArtifactOutputsForInitiatives itd.) — mockujemy `Api.*` metody, które
 * te hooki i sam rail wołają, zamiast re-implementować komponent.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ★ 2026-09-01 — ODTWORZONE otoczenie produkcyjne centrum (audyt przyrządu,
 * Kategoria 1).
 *
 * Ten ekran wcześniej montował szynę SAMĄ obok pustego placeholdera-napisu
 * ("centrum: dokument Notatnika…") — 2/3 kadru puste. Produkcja
 * (`NotebookContent.tsx:4256-4273`) zawsze montuje szynę OBOK edytora
 * notatki, nigdy obok pustki. `NotebookContent` sam jest zbyt stanowy, żeby
 * zamontować 1:1 (edytor Tiptap, API calls) — więc centrum tego ekranu
 * odtwarza TĘ SAMĄ szkieletową strukturę (ikona+tytuł+4 linie treści w
 * `rounded-2xl border border-c-border-subtle bg-c-surface-raised`), którą
 * production sam renderuje jako stan ładowania notatki
 * (`NotebookContent.tsx:3260-3274`, `aria-hidden`) — te same klasy layoutu
 * co realny kod produkcyjny (bez `animate-pulse`, bo ten ekran robi
 * statyczny zrzut, nie żywy podgląd). Zewnętrzny wiersz
 * (`flex-1 flex min-w-0 gap-1.5 overflow-hidden`) to byte-for-byte kopia
 * `NotebookContent.tsx:3231`.
 * ─────────────────────────────────────────────────────────────────────────
 */
import React from 'react';

import { NotebookRightRail } from '@/components/MyWork/notebook/NotebookRightRail';
import { NOTEBOOK_SPEC_A_SHELL_FLAG_KEYS } from '@/components/MyWork/notebook/notebookSpecAShellFlag';
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

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const mockedRead = [
      '/api/my-work/my-ideas/suggest?',
      '/api/initiatives?',
      '/api/my-work/tasks?',
      '/api/decisions?',
      '/api/my-work/link-graph/backlinks?',
    ].some((path) => url.includes(path));
    if (mockedRead) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input, init);
  };
};
installMocks();

const ACTIVE_PAGE: NotebookPage = {
  id: 'page-1',
  title: 'Warsztat 3: migracja danych',
  projectId: 'proj-1',
  visibility: 'project',
  tags: ['warsztat', 'migracja'],
  contentJson: null,
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

export default function MyWorkNotebookRailSpecAScreen({
  specA = true,
}: {
  /**
   * Naprawa (2026-08-30, domknięcie próbki ArtifactRightPanel): ten ekran
   * nazywa się „rail-speca" ale bez tego forsowania renderował STARY panel —
   * flaga `ff_notebookSpecAShell` jest domyślnie OFF i harness jej nigdy nie
   * ustawiał, więc `?screen=mywork-notebook-rail-speca` bez ręcznie dopisanego
   * `&ff_notebookSpecAShell=1` pokazywał dokładnie to, czego nazwa przeczy.
   * Domyślnie `true` (ekran pokazuje to, co obiecuje nazwa); `specA={false}`
   * daje STARĄ ścieżkę do porównania PRZED/PO w tym samym pliku ekranu.
   */
  specA?: boolean;
} = {}): React.ReactElement {
  // Synchronicznie w ciele renderu (nie w efekcie) — `NotebookRightRail`
  // czyta flagę PODCZAS własnego renderu (patrz `isNotebookSpecAShellEnabled`),
  // więc localStorage musi być ustawiony ZANIM dziecko się wyrenderuje, nie
  // dopiero po commit (efekt spóźniłby się o jedną klatkę).
  try {
    if (specA) {
      window.localStorage.setItem(NOTEBOOK_SPEC_A_SHELL_FLAG_KEYS.localStorage, '1');
    } else {
      window.localStorage.removeItem(NOTEBOOK_SPEC_A_SHELL_FLAG_KEYS.localStorage);
    }
  } catch {
    // localStorage niedostępny (np. prywatna karta) — flaga zostaje na domyślnym OFF.
  }
  const [activeTab, setActiveTab] = React.useState<'work' | 'context'>('work');
  return (
    <div className="flex h-screen w-screen items-stretch bg-c-bg p-3">
      {/* NotebookContent.tsx:3231 — byte-for-byte wrapper wokół [edytor, graf, szyna] */}
      <div className="flex-1 flex min-w-0 gap-1.5 overflow-hidden">
        {/* Statyczna treść tej samej notatki co ACTIVE_PAGE. Harness nie montuje
            stanowego edytora Tiptap, ale odbiór pokazuje dokument, nie loader. */}
        <div className="flex-1 min-w-0 flex flex-col rounded-2xl border border-c-border-subtle overflow-hidden bg-c-surface-raised">
          <div className="flex-1 overflow-y-auto bg-c-surface">
            <article className="mx-auto max-w-3xl px-10 py-12 text-c-text">
              <p className="text-xs font-semibold uppercase tracking-wider text-c-text-muted">Notatnik projektu</p>
              <h1 className="mt-2 text-3xl font-semibold">Warsztat 3: migracja danych</h1>
              <p className="mt-3 text-sm text-c-text-secondary">30 lipca 2026 · Anna Kowalska</p>
              <div className="mt-10 space-y-6 text-[15px] leading-7">
                <section>
                  <h2 className="text-lg font-semibold">Ustalenia</h2>
                  <p className="mt-2">Migracja wymaga jednego klucza klienta (MDM) przed importem danych historycznych. Zespół uzgodnił walidację duplikatów i próbny przebieg na kopii danych.</p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold">Otwarte pytania</h2>
                  <p className="mt-2">Do potwierdzenia pozostają właściciel mapowania rekordów sprzed 2024 roku oraz kryterium akceptacji raportu rozbieżności.</p>
                </section>
                <section>
                  <h2 className="text-lg font-semibold">Następne kroki</h2>
                  <p className="mt-2">Anna przygotuje próbkę danych, a zespół wdrożeniowy zweryfikuje mapowanie i zapisze decyzję o gotowości do migracji.</p>
                </section>
              </div>
            </article>
          </div>
        </div>
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
