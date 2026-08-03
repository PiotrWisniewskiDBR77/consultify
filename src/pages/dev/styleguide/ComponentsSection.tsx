/**
 * ComponentsSection — VF0-11 living style guide, "Components" tab.
 *
 * Renders the REAL `src/components/standard/*` facades with representative
 * mock props — no re-implementation. Data/patterns mirror the existing
 * dev-render hosts (`dev-render/screens/standard-grid-card.tsx`,
 * `standard-kanban-card.tsx`) so this page stays consistent with the
 * established no-login harness convention.
 */
import {
  Calendar,
  DollarSign,
  Download,
  ExternalLink,
  Flag,
  Layers,
  TrendingUp,
} from 'lucide-react';
import React, { useState } from 'react';

import {
  StandardGridCard,
  type StandardGridCard as StandardGridCardData,
  StandardKanban,
  StandardKanbanCard,
  type StandardKanbanCard as StandardKanbanCardData,
  type StandardKanbanColumn,
  StandardModuleBar,
  StandardPreview,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
// Not re-exported from the standard/ barrel (index.ts) yet — import directly.
import { ArtifactApprovalStatusBar } from '@/components/standard/ArtifactApprovalStatusBar';
import { ArtifactRightPanel } from '@/components/standard/ArtifactRightPanel';
import { EvidencePanelSection } from '@/components/standard/EvidencePanelSection';
import { IdeaRightPanel } from '@/components/standard/IdeaRightPanel';

const SectionHeading: React.FC<{ children: React.ReactNode; note?: string }> = ({
  children,
  note,
}) => (
  <div className="mb-3 mt-10 first:mt-0">
    <h3 className="text-sm font-semibold text-c-text">{children}</h3>
    {note ? <p className="mt-0.5 max-w-2xl text-xs text-c-text-muted">{note}</p> : null}
  </div>
);

// ── StandardModuleBar ───────────────────────────────────────────────────────

const ModuleBarDemo: React.FC = () => {
  const [tab, setTab] = useState('list');
  const [chip, setChip] = useState<string | null>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div className="rounded-token-md border border-c-border-subtle bg-c-surface">
      <StandardModuleBar
        breadcrumbs={[{ label: 'Tools' }, { label: 'Licensed' }]}
        tabs={[
          { id: 'list', label: 'Lista' },
          { id: 'reports', label: 'Raporty' },
        ]}
        activeTab={tab}
        onTabChange={setTab}
        onSearch={() => {}}
        primaryCta={{ label: 'Nowy', onClick: () => {} }}
        viewModes={['table', 'grid', 'kanban']}
        viewMode="table"
        onViewModeChange={() => {}}
        chips={[
          { id: 'all', label: 'Wszystkie', count: 24 },
          { id: 'mine', label: 'Moje', count: 6 },
          { id: 'blocked', label: 'Zablokowane', count: 0, dot: 'bg-c-danger' },
        ]}
        activeChip={chip}
        onChipChange={setChip}
        bulk={
          selected.size > 0
            ? {
                count: selected.size,
                actions: [
                  { id: 'archive', label: 'Archiwizuj', onClick: () => {} },
                  { id: 'delete', label: 'Usuń', onClick: () => {}, variant: 'danger' },
                ],
                onClear: () => setSelected(new Set()),
              }
            : null
        }
      />
      <div className="flex items-center gap-2 px-4 py-2 text-[11px] text-c-text-muted">
        Demo:{' '}
        <button
          type="button"
          className="rounded-token-xs border border-c-border px-2 py-0.5 hover:bg-c-surface-raised"
          onClick={() => setSelected((s) => (s.size ? new Set() : new Set(['r1', 'r2'])))}
        >
          {selected.size ? 'Wyczyść zaznaczenie' : 'Zaznacz 2 wiersze (pokaż tryb bulk Menu 3)'}
        </button>
      </div>
    </div>
  );
};

// ── StandardTable + StandardPreview ─────────────────────────────────────────

const TABLE_COLUMNS: TableColumn[] = [
  { id: 'title', label: 'Nazwa', filterable: false, sortable: true },
  {
    id: 'status',
    label: 'Status',
    filterable: true,
    sortable: true,
    filterOptions: [
      { value: 'EXECUTING', label: 'Executing' },
      { value: 'BLOCKED', label: 'Blocked' },
      { value: 'DONE', label: 'Done' },
    ],
  },
  { id: 'owner', label: 'Właściciel' },
  { id: 'updated', label: 'Zaktualizowano' },
];

const TABLE_ROWS: TableRow[] = [
  {
    id: 'r1',
    title: 'Wdrożenie CRM dla zespołu sprzedaży B2B',
    status: 'EXECUTING',
    owner: 'Anna Kowalska',
    updated: '3 dni temu',
  },
  {
    id: 'r2',
    title: 'Integracja płatności — zależność od dostawcy',
    status: 'BLOCKED',
    owner: 'Piotr Wiśniewski',
    updated: '5 h temu',
  },
  {
    id: 'r3',
    title: 'Onboarding 30 konsultantów do nowego procesu',
    status: 'DONE',
    owner: 'Marek Zieliński',
    updated: '2 tyg. temu',
  },
];

const TableAndPreviewDemo: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>('r1');
  const selectedRow = TABLE_ROWS.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex gap-3">
      <div className="h-[420px] min-w-0 flex-1 rounded-token-md border border-c-border-subtle bg-c-surface">
        <StandardTable
          columns={TABLE_COLUMNS}
          data={TABLE_ROWS}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          rowMenu={() => ({
            primary: [{ id: 'open', label: 'Otwórz', onClick: () => {} }],
            destructive: { onClick: () => {} },
          })}
        />
      </div>
      <div
        className="h-[420px] shrink-0 overflow-y-auto rounded-token-md bg-c-surface-raised p-3"
        style={{ width: 'clamp(340px, 28%, 480px)' }}
      >
        {selectedRow ? (
          <div className="rounded-token-xl border border-c-border/70 bg-c-surface/70 backdrop-blur">
            <StandardPreview
              title={String(selectedRow.title)}
              onClose={() => setSelectedId(null)}
              onOpenFull={() => {}}
              meta={{
                pills: [
                  { label: 'Status', value: String(selectedRow.status), tone: 'info' },
                  { label: 'Właściciel', value: String(selectedRow.owner) },
                ],
                trailing: (
                  <span className="text-xs text-c-text-muted">{String(selectedRow.updated)}</span>
                ),
              }}
              details={{ text: 'Krótki opis rekordu z tabeli — treść details sekcji.' }}
              relations={[]}
              actions={{
                resolutions: [
                  {
                    id: 'approve',
                    variant: 'positive',
                    label: 'Zatwierdź',
                    shortcut: 'A',
                    onClick: () => {},
                  },
                  {
                    id: 'reject',
                    variant: 'destructive',
                    label: 'Odrzuć',
                    shortcut: 'R',
                    onClick: () => {},
                  },
                ],
                informational: [
                  {
                    id: 'info',
                    variant: 'neutral',
                    label: 'Więcej informacji',
                    shortcut: 'I',
                    onClick: () => {},
                  },
                ],
              }}
            />
          </div>
        ) : (
          <p className="p-4 text-xs text-c-text-muted">Kliknij wiersz, by zobaczyć podgląd.</p>
        )}
      </div>
    </div>
  );
};

// ── StandardGridCard ─────────────────────────────────────────────────────────

const GRID_CARDS: StandardGridCardData[] = [
  {
    id: 'p1',
    title: 'Wdrożenie CRM dla zespołu sprzedaży B2B',
    subtitle: 'Digital Sales',
    statusLabel: 'EXECUTING',
    statusTone: 'info',
    accentColorVar: 'var(--c-tag-2)',
    chips: [{ id: 'priority', label: 'HIGH', tone: 'warning' }],
    progress: 62,
    metrics: [
      { id: 'budget', icon: DollarSign, label: '$420K' },
      { id: 'roi', icon: TrendingUp, label: '2.3x ROI', tone: 'success' },
      { id: 'quarter', icon: Calendar, label: 'Q3 2026' },
    ],
    ownerInitials: 'AK',
    ownerName: 'Anna Kowalska',
  },
  {
    id: 'r2',
    title: 'Raport due diligence — akwizycja SIRI',
    description: 'Ocena dojrzałości cyfrowej 4 zakładów produkcyjnych.',
    statusLabel: 'Approved',
    statusTone: 'success',
    accentColorVar: 'var(--c-tag-1)',
    chips: [{ id: 'type', label: 'SIRI' }],
    progress: 100,
    footerRight: '3 dni temu',
    rowMenuActions: [
      { id: 'open', label: 'Otwórz', onClick: () => {} },
      { id: 'duplicate', label: 'Duplikuj', onClick: () => {} },
      { id: 'delete', label: 'Usuń', onClick: () => {}, variant: 'danger' },
    ],
  },
  {
    id: 'p3',
    title: 'Integracja płatności — zależność od dostawcy',
    subtitle: 'Payments',
    statusLabel: 'BLOCKED',
    statusTone: 'danger',
    accentColorVar: 'var(--c-tag-4)',
    urgency: 'critical',
    chips: [{ id: 'priority', label: 'CRITICAL', tone: 'danger' }],
    progress: 18,
    metrics: [{ id: 'budget', icon: DollarSign, label: '$1.1M' }],
    ownerInitials: 'PW',
    ownerName: 'Piotr Wiśniewski',
  },
  {
    id: 'd4',
    title: 'Deck: Strategia AI 2027-2030 — Zarząd',
    statusLabel: 'Draft',
    statusTone: 'neutral',
    accentColorVar: 'var(--c-tag-9)',
    urgency: 'pending',
    chips: [{ id: 'type', label: 'Deck' }],
    progress: 40,
    footerRight: '5 h temu',
    customFooterActions: (
      <div className="flex items-center gap-1">
        <button
          className="rounded p-1 text-c-text-muted hover:bg-c-surface-raised hover:text-c-text"
          title="Export"
        >
          <Download size={12} />
        </button>
        <button
          className="rounded p-1 text-c-text-muted hover:bg-c-surface-raised hover:text-c-text"
          title="Otwórz źródło"
        >
          <ExternalLink size={12} />
        </button>
      </div>
    ),
  },
];

// ── StandardKanban + StandardKanbanCard ─────────────────────────────────────

const KANBAN_COLUMNS: StandardKanbanColumn[] = [
  { id: 'scheduled', label: 'Zaplanowane', tone: 'info' },
  { id: 'executing', label: 'W realizacji', tone: 'accent' },
  { id: 'blocked', label: 'Zablokowane', tone: 'danger' },
  { id: 'done', label: 'Zakończone', tone: 'success' },
];

const KANBAN_CARDS: StandardKanbanCardData[] = [
  {
    id: 'i1',
    columnId: 'scheduled',
    title: 'Wdrożenie CRM dla zespołu sprzedaży B2B',
    description: 'Migracja z arkuszy do jednego źródła prawdy o lejku.',
    chips: [{ id: 'p', label: 'MEDIUM', tone: 'info', icon: Flag }],
    projectLabel: 'Digital Sales',
    dueLabel: 'Termin: 30 lip',
    ownerInitials: 'AK',
    ownerName: 'Anna Kowalska',
    urgency: 'none',
  },
  {
    id: 'i2',
    columnId: 'executing',
    title: 'Standaryzacja raportów zarządczych KPI',
    chips: [
      { id: 'p', label: 'HIGH', tone: 'warning', icon: Flag },
      { id: 't', label: 'Ops', tone: 'neutral', icon: Layers },
    ],
    dueLabel: 'Termin: 18 lip',
    ownerInitials: 'PW',
    urgency: 'pending',
  },
  {
    id: 'i3',
    columnId: 'blocked',
    title: 'Integracja płatności — zależność od dostawcy',
    chips: [{ id: 'p', label: 'CRITICAL', tone: 'danger', icon: Flag }],
    dueLabel: 'Zaległe: 5 lip',
    dueOverdue: true,
    urgency: 'critical',
  },
  {
    id: 'i4',
    columnId: 'done',
    title: 'Onboarding 30 konsultantów do nowego procesu',
    chips: [{ id: 'h', label: 'Done', tone: 'success' }],
    ownerInitials: 'MZ',
    urgency: 'none',
  },
];

const KanbanDemo: React.FC = () => {
  const [board, setBoard] = useState(KANBAN_CARDS);
  return (
    <div className="h-[380px] rounded-token-md border border-c-border-subtle bg-c-surface">
      <StandardKanban
        columns={KANBAN_COLUMNS}
        cards={(colId) => board.filter((c) => c.columnId === colId)}
        onCardClick={() => {}}
        onDrop={(cardId, colId) =>
          setBoard((prev) => prev.map((c) => (c.id === cardId ? { ...c, columnId: colId } : c)))
        }
      />
    </div>
  );
};

// ── ArtifactRightPanel (SPEC-A shell — reguła #6) ───────────────────────────

const ArtifactRightPanelDemo: React.FC = () => (
  <div className="h-[420px] overflow-hidden rounded-token-md border border-c-border-subtle">
    <ArtifactRightPanel
      ariaLabel="Demo panel artefaktu"
      sections={[
        {
          id: 'actions',
          label: 'Akcje',
          children: (
            <div className="flex flex-wrap gap-2">
              <button className="rounded-token-md border border-c-border px-3 py-1.5 text-xs">
                Zatwierdź
              </button>
              <button className="rounded-token-md border border-c-border px-3 py-1.5 text-xs">
                Eksportuj
              </button>
            </div>
          ),
        },
        {
          id: 'properties',
          label: 'Właściwości',
          badge: 3,
          children: (
            <div className="space-y-2 text-xs text-c-text-secondary">
              <div>Status: Draft</div>
              <div>Właściciel: Anna Kowalska</div>
              <div>Termin: 30 lip 2026</div>
            </div>
          ),
        },
        {
          id: 'relations',
          label: 'Powiązania',
          isEmpty: true,
          emptyLabel: 'Brak powiązanych obiektów.',
          children: null,
        },
        {
          id: 'comments',
          label: 'Komentarze',
          badge: 0,
          children: <p className="text-xs italic text-c-text-muted">Brak komentarzy.</p>,
        },
        {
          id: 'history',
          label: 'Historia',
          defaultOpen: false,
          children: (
            <p className="text-xs text-c-text-muted">Utworzono przez Teresę · 2 dni temu</p>
          ),
        },
      ]}
    />
  </div>
);

// ── IdeaRightPanel (D17: "everything uses the Teresa panel on the right") ──

const IdeaRightPanelDemo: React.FC = () => (
  <div className="h-[420px] overflow-hidden rounded-token-md border border-c-border-subtle">
    <IdeaRightPanel
      isPolish
      propertiesContent={
        <div className="space-y-2 text-xs text-c-text-secondary">
          <div>Typ: Mind Map</div>
          <div>Widoczność: Zespół</div>
        </div>
      }
      relationsContent={
        <p className="text-xs text-c-text-muted">3 powiązane notatki, 1 initiative.</p>
      }
      teresaContent={
        <p className="text-xs text-c-text-muted">Komendy + strumień sugestii Teresy.</p>
      }
      onExport={() => {}}
      onConvert={() => {}}
    />
  </div>
);

// ── EvidencePanelSection / ArtifactApprovalStatusBar (HP-8/HP-17) ──────────
// Both are self-fetching (real `Api`/`fetch` calls on mount — no mocking
// here, per the VF0-11 guard "no reimplementation"). Outside a logged-in
// session these calls 401 and the components render their own built-in
// error affordance — which is itself a live demonstration of their error
// handling, not a broken demo.

const LiveFetchNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-2 text-[11px] text-c-text-muted">{children}</p>
);

export const ComponentsSection: React.FC = () => {
  return (
    <div>
      <SectionHeading note="Menu 1 (breadcrumb opcjonalny) + Menu 2 (pigułki/CTA/widoki) + Menu 3 (chipy / bulk / taby) — jedna fasada, trzy tryby wymienne w tym samym pasku.">
        StandardModuleBar
      </SectionHeading>
      <ModuleBarDemo />

      <SectionHeading note="Tabela + Podgląd (6 bloków: header/meta/details/AI/relations/akcje) — kliknij wiersz.">
        StandardTable + StandardPreview
      </SectionHeading>
      <TableAndPreviewDemo />

      <SectionHeading note="Karta grid/kafelkowa: bez kebaba, z kebabem (RowActionsMenu), pilność critical (pasek+tint), customFooterActions.">
        StandardGridCard
      </SectionHeading>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GRID_CARDS.map((card) => (
          <StandardGridCard key={card.id} card={card} onClick={() => {}} />
        ))}
      </div>

      <SectionHeading note="Kolumny-strefy (bez tła/obrysu) + DnD natywne — przeciągnij kartę między kolumnami. Poniżej: karta samodzielna (wariant dnd-kit, widoczny uchwyt).">
        StandardKanban + StandardKanbanCard
      </SectionHeading>
      <KanbanDemo />
      <div className="mt-3 w-[280px]">
        <StandardKanbanCard
          card={KANBAN_CARDS[2]}
          dragHandleProps={{ role: 'button', 'aria-label': 'Przeciągnij' }}
          onClick={() => {}}
        />
      </div>

      <SectionHeading note="SPEC-A powłoka wspólna (§10.2/§11.2) — accordion w stałej kolejności n-Type: Akcje·Właściwości·Powiązania·Źródła i założenia·[Rezultaty]·Komentarze·Historia.">
        ArtifactRightPanel
      </SectionHeading>
      <ArtifactRightPanelDemo />

      <SectionHeading note="D17 (07-12): 'wszystko korzysta z panelu Teresy — nigdy nie ma innego'. Trzy karty w stałej kolejności: Właściwości · Kontekst · Teresa (sama Teresa jest kartą, nie osobnym bytem).">
        IdeaRightPanel
      </SectionHeading>
      <IdeaRightPanelDemo />

      <SectionHeading note="HP-8/HP-17 — samowystarczalne (własny fetch/loading/error). Bez sesji zalogowanej pokażą swój wbudowany stan błędu zamiast danych — to jest prawdziwe zachowanie, nie placeholder.">
        EvidencePanelSection + ArtifactApprovalStatusBar
      </SectionHeading>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-token-md border border-c-border-subtle bg-c-surface p-4">
          <LiveFetchNote>
            Sekcja „Źródła i założenia" (ArtifactRightPanel slot) — realny fetch
            `fetchEvidenceEnvelope('insight', 'demo-id')`.
          </LiveFetchNote>
          <EvidencePanelSection artifactType="insight" artifactId="demo-id" isPolish />
        </div>
        <div className="rounded-token-md border border-c-border-subtle bg-c-surface p-4">
          <LiveFetchNote>
            Pasek statusu HP-7 (draft→review→approved/rejected) — realny fetch
            `getArtifactApprovalState('insight', 'demo-id')`.
          </LiveFetchNote>
          <ArtifactApprovalStatusBar artifactType="insight" artifactId="demo-id" canReview />
        </div>
      </div>
    </div>
  );
};

export default ComponentsSection;
