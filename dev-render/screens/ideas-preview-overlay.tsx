/**
 * Dev-render host dla #4b — DESKTOP PREVIEW OVERLAY w liście Ideas (My Work).
 *
 * Renderuje REALNY `<TableWithPreviewLayout desktopPreviewOverlay>` (zmieniony
 * komponent) z DOKŁADNIE tym samym gridem kart co `MyIdeasListContent`
 * (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) i realnymi prymitywami podglądu
 * (PreviewMetaCard · PreviewDetailsSection · PreviewAIHintStrip · PreviewRelations
 * · PreviewActionBar) — 6 bloków kanonu. Dane MOCKOWANE (bez store/API/logowania).
 *
 * Cel story: DOWÓD ZERO-REFLOW. Na desktopie panel podglądu ma NAKŁADAĆ się na
 * grid z prawej krawędzi (fixed/absolute overlay), a grid ma zachować pełną
 * szerokość (3 kolumny) niezależnie od tego czy podgląd jest otwarty.
 *
 * Parametry URL (poza ?theme, ?lang z harnessu):
 *   ?open=1|0      podgląd otwarty (default 1) — do zrzutu PRZED/PO
 *   ?overlay=1|0   tryb overlay (default 1); overlay=0 = stary reflow (kontrast)
 *
 * Tokeny c-* (light+dark), zero crimson na CTA, fokus c-focus (dziedziczony z
 * komponentów). Bez logowania. Motyw/lang z URL.
 */
import { Lightbulb, Sparkles, Trash2, Workflow } from 'lucide-react';
import React from 'react';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '../../src/components/shared/PreviewPane';
import { TableWithPreviewLayout } from '../../src/components/shared/TableWithPreviewLayout';
// ★ NAPRAWA (2026-08-30, dyżur 131-noc-moja-praca): obie daty w tym harnessu
// wołały `toLocaleDateString()` BEZ argumentu — bierze locale z przeglądarki
// headless (en-US), nie z języka konta, więc renderowało się `7/11/2026`
// (M/D, amerykański zapis) zamiast kanonicznego `11.07.2026`. Dokładnie ten
// mechanizm opisuje `src/utils/listDateFormat.ts` (SSOT dat list/podglądów,
// 270 takich wywołań znalezionych w przeglądzie 2026-07-27) — używam go tu.
import { formatListDate } from '../../src/utils/listDateFormat';

interface MockIdea {
  id: string;
  title: string;
  body: string;
  stage: string;
  tool: string;
  tags: string[];
  updatedAt: string;
}

const IDEAS_PL: MockIdea[] = [
  {
    id: 'i1',
    title: 'Ekspansja DE — mapa hipotez wejścia na rynek',
    body: 'Gałęzie: popyt, konkurencja, kanały sprzedaży, ryzyka regulacyjne. Priorytet: walidacja popytu w segmencie mid-market.',
    stage: 'Rośnie',
    tool: 'Mapa myśli',
    tags: ['rynek', 'DE'],
    updatedAt: '2026-07-11',
  },
  {
    id: 'i2',
    title: 'Automatyzacja onboardingu klientów',
    body: 'Skrócić time-to-value z 21 do 7 dni przez self-serve setup i szablony.',
    stage: 'Iskra',
    tool: 'Process Flow',
    tags: ['ops'],
    updatedAt: '2026-07-10',
  },
  {
    id: 'i3',
    title: 'Pakiet premium — model cenowy',
    body: 'Trzy warianty: Core / Pro / Enterprise. Test wrażliwości cenowej.',
    stage: 'Kształtuje się',
    tool: 'Tabela',
    tags: ['pricing', 'GTM'],
    updatedAt: '2026-07-09',
  },
  {
    id: 'i4',
    title: 'Program poleceń partnerskich',
    body: 'Prowizja warstwowa + współ-marketing dla top 10 partnerów.',
    stage: 'Iskra',
    tool: 'Notatnik',
    tags: ['partnerzy'],
    updatedAt: '2026-07-08',
  },
  {
    id: 'i5',
    title: 'Redukcja churnu w kohorcie Q1',
    body: 'Health score + proaktywna interwencja CS przy spadku aktywności.',
    stage: 'Gotowy',
    tool: 'Whiteboard',
    tags: ['retencja'],
    updatedAt: '2026-07-07',
  },
  {
    id: 'i6',
    title: 'Biblioteka wzorców doradczych',
    body: '~40 startowych szablonów w 7 kategoriach konsultingowych.',
    stage: 'Rośnie',
    tool: 'Prezentacja',
    tags: ['content'],
    updatedAt: '2026-07-06',
  },
];

const IDEAS_EN: MockIdea[] = IDEAS_PL.map((it, i) => ({
  ...it,
  title: [
    'DE expansion — market-entry hypothesis map',
    'Customer onboarding automation',
    'Premium tier — pricing model',
    'Partner referral program',
    'Q1 cohort churn reduction',
    'Advisory template library',
  ][i],
  stage: ['Growing', 'Spark', 'Shaping', 'Spark', 'Ready', 'Growing'][i],
  body: [
    'Branches: demand, competition, sales channels, regulatory risk. Priority: validate mid-market demand.',
    'Cut time-to-value from 21 to 7 days via self-serve setup and templates.',
    'Three tiers: Core / Pro / Enterprise. Price sensitivity test.',
    'Tiered commission + co-marketing for the top 10 partners.',
    'Health score + proactive CS intervention on activity drop.',
    '~40 starter templates across 7 consulting categories.',
  ][i],
}));

function StageBadge({ label }: { label: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-c-surface-raised px-2 py-0.5 text-[10px] font-medium text-c-text-muted">
      <Lightbulb size={9} />
      {label}
    </span>
  );
}

function ToolBadge({ label }: { label: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center rounded-full border border-c-border-subtle px-2 py-0.5 text-[10px] text-c-text-muted">
      {label}
    </span>
  );
}

export default function IdeasPreviewOverlayScreen(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const isPl = (params.get('lang') || 'pl').startsWith('pl');
  const overlay = params.get('overlay') !== '0';
  const openParam = params.get('open') !== '0';

  const ideas = isPl ? IDEAS_PL : IDEAS_EN;
  const [selectedId, setSelectedId] = React.useState<string | null>(openParam ? 'i1' : null);
  const selectedItem = ideas.find((i) => i.id === selectedId) || null;

  const renderPreview = (idea: MockIdea) => {
    const metaPills: MetaPill[] = [{ label: idea.stage }, { label: idea.tool }];
    const metaTrailing = (
      <span className="text-[11px] font-medium text-c-text-muted">
        {formatListDate(idea.updatedAt)}
      </span>
    );
    return (
      <div className="space-y-4">
        <PreviewMetaCard pills={metaPills} trailing={metaTrailing}>
          {idea.tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {idea.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-c-surface-raised px-2 py-0.5 text-[10px] text-c-text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </PreviewMetaCard>
        <PreviewDetailsSection text={idea.body} label={isPl ? 'Szczegóły' : 'Details'} />
      </div>
    );
  };

  const renderPreviewFooter = (_idea: MockIdea) => {
    const aiHints = isPl
      ? ['Dlaczego pilne?', 'Plan działania', 'Kto może pomóc?']
      : ['Why urgent?', 'Action plan', 'Who can help?'];
    const relationItems: RelationItem[] = [];
    const actionRows: ActionRow[] = [
      {
        columns: 3,
        buttons: [
          {
            label: isPl ? 'Konwertuj' : 'Convert',
            icon: Sparkles,
            onClick: () => {},
            // ★ NAPRAWA (2026-08-30): 'purple' jest @deprecated w PillColorScheme
            // (previewStyles.ts §7.3b — "Uzyj 'primary' albo 'neutral'"). Kanon
            // dopuszcza tylko 5 wariantów (TRIADA_KANON.md pkt 32); Convert to
            // rozstrzygnięcie main-CTA charakteru, więc 'primary'.
            colorScheme: 'primary',
          },
          {
            label: isPl ? 'Otwórz Flow' : 'Open Flow',
            icon: Workflow,
            onClick: () => {},
            colorScheme: 'emerald',
          },
          { label: isPl ? 'Usuń' : 'Delete', icon: Trash2, onClick: () => {}, colorScheme: 'red' },
        ],
      },
    ];
    return (
      <div className="space-y-0">
        <PreviewAIHintStrip hints={aiHints} />
        <div className="border-t border-c-border-subtle my-3" />
        <PreviewRelations
          items={relationItems}
          emptyLabel={isPl ? 'Brak powiązań' : 'No linked documents'}
        />
        <div className="border-t border-c-border-subtle my-3" />
        <PreviewActionBar rows={actionRows} />
      </div>
    );
  };

  return (
    // Produkcja: MyIdeasListContent.tsx:2012 — panel treści to `flex-1` (pełna
    // szerokość obszaru contentu), NIE kartka ograniczona do max-w-[1240px].
    <div className="min-h-screen bg-c-bg p-6">
      <div className="w-full">
        <div className="mb-3">
          <h1 className="text-lg font-semibold text-c-text">
            {isPl
              ? 'My Work → Ideas — podgląd desktop jako overlay (#4b)'
              : 'My Work → Ideas — desktop preview overlay (#4b)'}
          </h1>
          <p className="text-xs text-c-text-muted mt-0.5">
            {overlay
              ? isPl
                ? 'overlay=1 · panel nakłada się z prawej krawędzi — grid zachowuje 3 kolumny (zero reflow).'
                : 'overlay=1 · panel floats over the right edge — grid keeps 3 columns (zero reflow).'
              : isPl
                ? 'overlay=0 · STARY tryb: panel jako flex-sibling wypycha grid (reflow, kontrast).'
                : 'overlay=0 · OLD mode: flex-sibling panel pushes the grid (reflow, contrast).'}
            {' · '}
            <a
              className="underline"
              href={`?screen=ideas-preview-overlay&overlay=${overlay ? '1' : '0'}&open=${openParam ? '0' : '1'}&theme=${params.get('theme') || 'light'}&lang=${isPl ? 'pl' : 'en'}`}
            >
              {openParam
                ? isPl
                  ? 'zamknij podgląd'
                  : 'close preview'
                : isPl
                  ? 'otwórz podgląd'
                  : 'open preview'}
            </a>
          </p>
        </div>

        {/* Bounded viewport — mirrors the MyWork content pane height. */}
        <div className="h-[720px] rounded-xl border border-c-border-subtle bg-c-bg overflow-hidden">
          <TableWithPreviewLayout<MockIdea>
            selectedId={selectedId}
            selectedItem={selectedItem}
            onSelect={setSelectedId}
            previewOpen={Boolean(selectedId)}
            autoOpenPreview={false}
            desktopPreviewOverlay={overlay}
            itemIds={ideas.map((i) => i.id)}
            getItemById={(id) => ideas.find((i) => i.id === id) || null}
            renderPreview={renderPreview}
            renderPreviewFooter={renderPreviewFooter}
          >
            <div className="h-full overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ideas.map((idea) => {
                  const isSel = selectedId === idea.id;
                  return (
                    <div
                      key={idea.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(idea.id)}
                      className={[
                        'group relative cursor-pointer rounded-xl p-4 text-left',
                        'border border-c-border-subtle bg-c-surface',
                        'hover:shadow-md hover:-translate-y-px transition-all duration-150',
                        isSel ? 'ring-2 ring-c-border-strong dark:ring-white/20' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StageBadge label={idea.stage} />
                          <ToolBadge label={idea.tool} />
                        </div>
                      </div>
                      <h4 className="font-semibold text-sm text-c-text line-clamp-2 leading-snug">
                        {idea.title}
                      </h4>
                      <p className="mt-1 text-xs text-c-text-muted line-clamp-2">{idea.body}</p>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-c-text-muted border-t border-c-border-subtle mt-3 pt-3">
                        <div className="min-w-0 flex-1 flex flex-wrap gap-1">
                          {idea.tags.map((t) => (
                            <span key={t} className="text-c-text-muted">
                              #{t}
                            </span>
                          ))}
                        </div>
                        <span className="shrink-0">
                          {formatListDate(idea.updatedAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TableWithPreviewLayout>
        </div>
      </div>
    </div>
  );
}
