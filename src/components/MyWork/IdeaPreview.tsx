/**
 * IdeaPreview — JEDEN podgląd (preview pane) Idei dla całego My Work.
 *
 * ── ZGŁOSZENIE WŁAŚCICIELA, KTÓRE TO ZAMYKA ────────────────────────────────
 * „Tutaj ciągle zobacz Preview nie jest zgodny z wzorem" (30.08 i dwa razy
 * 01.09, ekran `idea-table`). Słowo „ciągle" było trafne: poprzednie tury
 * poprawiały KOLEJNOŚĆ stopki, a niezgodność siedziała w bloku 3.
 *
 * ── CO BYŁO NIEZGODNE (zmierzone na zrzucie, nie z opisu) ──────────────────
 * `TABLE_AND_PREVIEW_CANON.md` §7.3 pkt 3 (MUST): „bogaty domyślny szablon:
 * NIE jednolinijkowy opis. Z automatu pokazujemy kluczowe pola encji
 * (cel/zakres, kontekst, właściciel, daty, powiązania, postęp)". Podgląd Idei
 * renderował w bloku „Szczegóły" WYŁĄCZNIE `idea.body` — jedno zdanie, po
 * którym zostawało ~400 px pustki do stopki. Wzorzec kanonu (podgląd Wywiadu,
 * `InterviewSessionPreview.tsx:169` — ten sam kanon, ekran
 * `interview-preview-canon`) realizuje ten MUST przez
 * `ArtifactPropertiesTable`. Podgląd Idei tego bloku nie miał w ogóle — i to
 * jest różnica, którą widać na dwóch zrzutach obok siebie.
 *
 * ── DLACZEGO WSPÓLNY PLIK, A NIE POPRAWKA W EKRANIE (reguła 20) ────────────
 * Ideę renderują DWA pliki produkcyjne i każdy miał WŁASNĄ kopię podglądu:
 *   · `IdeasTableContent.tsx`   — widok tabeli (zgłoszony `idea-table`),
 *   · `MyIdeasListContent.tsx`  — widok listy/kart.
 * Kopie zdążyły się rozjechać: tabela dawała kolorowe pigułki etapu, lista
 * szare; tabela nie podawała ŻADNEJ akcji do kebaba bloku 3, lista podawała
 * trzy. Naprawa w jednym z nich zostawiłaby „poprawne w 1 z 2" — dokładnie ten
 * kształt, przez który zgłoszenie wracało. Oba pliki osadzają teraz ten
 * komponent; nie ma gdzie odrosnąć.
 *
 * Kolejność bloków jest kanonu, nie skilla: `TABLE_AND_PREVIEW_CANON.md` §7.0
 * mówi AI → Relations → Akcje → „Co dalej" (i wprost prostuje starszą wersję,
 * która stawiała „Co dalej" przed akcjami).
 *
 * @module components/MyWork/IdeaPreview
 */
import { ChevronDown, Copy, Edit2, Workflow } from 'lucide-react';
import React from 'react';

import {
  type ActionRow,
  type DetailsAction,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  PreviewWhatsNextCard,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import {
  ArtifactPropertiesTable,
  type ArtifactPropertyRow,
} from '@/components/standard/ArtifactPropertiesTable';
import { MetaChip } from '@/components/ui/primitives/chips';
import { formatListDate } from '@/utils/listDateFormat';

import { ConvertToOutputMenu } from './ConvertToOutputMenu';
import { IDEA_STAGE_BUCKET_LABELS } from './ideaEntryTypes';
import { formatIdeaDate, getStageMeta, getToolMeta } from './ideaPreviewMeta';
import type { CanvasToolType } from './ideaSelectionTypes';
import { getIdeaWorkspaceToolLabel } from './IdeaWorkspaceToolbar';
import type { IdeaStage, MyIdea } from './myIdeasTypes';

export interface IdeaPreviewBodyProps {
  idea: MyIdea;
  isPolish: boolean;
  /** Stan „Rozwiń/Zwiń" bloku 3 — trzyma go ekran, bo przeżywa zmianę wiersza. */
  detailsExpanded?: boolean;
  onToggleDetailsExpanded?: () => void;
  /** Edycja Idei — pozycja kebaba bloku 3 (pomijana, gdy ekran jej nie ma). */
  onEditIdea?: (idea: MyIdea) => void;
}

/**
 * Blok 2 (Meta) + blok 3 (Szczegóły z tabelą właściwości), kanon §7.3 pkt 2-3.
 */
export const IdeaPreviewBody: React.FC<IdeaPreviewBodyProps> = ({
  idea,
  isPolish,
  detailsExpanded,
  onToggleDetailsExpanded,
  onEditIdea,
}) => {
  const resolvedStage = (idea.stage || 'spark') as IdeaStage;
  const stageMeta = getStageMeta(idea.stage);
  const StageIcon = stageMeta.icon;
  const toolMeta = getToolMeta(idea.preferredTool);
  const ToolIcon = toolMeta.icon;
  const toolKey = String(idea.preferredTool || 'mindmap').toLowerCase() as CanvasToolType;

  const stageLabel = isPolish
    ? IDEA_STAGE_BUCKET_LABELS[resolvedStage].pl
    : IDEA_STAGE_BUCKET_LABELS[resolvedStage].en;
  const toolLabel = getIdeaWorkspaceToolLabel(toolKey, isPolish);

  const metaPills: MetaPill[] = [
    { label: stageLabel, className: stageMeta.badge, icon: StageIcon },
    { label: toolLabel, className: toolMeta.badge, icon: ToolIcon },
  ];

  const metaTrailing = (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <span className="text-[11px] font-medium text-c-text-muted">{formatIdeaDate(idea)}</span>
    </div>
  );

  /**
   * Kanon §7.3 pkt 3 (MUST) — „bogaty domyślny szablon", nie jednolinijkowy
   * opis. Wiersze bez wartości są POMIJANE (blok bez danych = ukryty), ale
   * cztery pierwsze ma KAŻDA Idea, więc tabela nigdy nie jest pusta i podgląd
   * nigdy nie kończy się białą dziurą po jednym zdaniu.
   */
  const wlasciwosci: ArtifactPropertyRow[] = [
    // ANTY-DUPLIKACJA: etap i narzedzie NIE wracaja tutaj — stoja juz w bloku 2
    // (pigulki meta). Tabela wlasciwosci dopowiada to, czego meta NIE mowi.
    ...(idea.area?.trim()
      ? [{ id: 'area', label: isPolish ? 'Obszar' : 'Area', value: idea.area.trim() }]
      : []),
    ...(typeof idea.priority === 'number'
      ? [
          {
            id: 'priority',
            label: isPolish ? 'Priorytet' : 'Priority',
            value: String(idea.priority),
            mono: true,
          },
        ]
      : []),
    ...(idea.potential?.trim()
      ? [
          {
            id: 'potential',
            label: isPolish ? 'Potencjał' : 'Potential',
            value: idea.potential.trim(),
          },
        ]
      : []),
    ...(idea.complexity?.trim()
      ? [
          {
            id: 'complexity',
            label: isPolish ? 'Złożoność' : 'Complexity',
            value: idea.complexity.trim(),
          },
        ]
      : []),
    ...(typeof idea.mapItems === 'number'
      ? [
          {
            id: 'map-items',
            label: isPolish ? 'Elementy' : 'Items',
            value: String(idea.mapItems),
            mono: true,
          },
        ]
      : []),
    ...(typeof idea.mapNodes === 'number'
      ? [
          {
            id: 'map-nodes',
            label: isPolish ? 'Węzły' : 'Nodes',
            value: String(idea.mapNodes),
            mono: true,
          },
        ]
      : []),
    ...(typeof idea.mapEdges === 'number'
      ? [
          {
            id: 'map-edges',
            label: isPolish ? 'Połączenia' : 'Edges',
            value: String(idea.mapEdges),
            mono: true,
          },
        ]
      : []),
    ...(idea.sourceType
      ? [
          {
            id: 'source',
            label: isPolish ? 'Źródło' : 'Source',
            value: String(idea.sourceType),
          },
        ]
      : []),
    ...(idea.confidentiality && idea.confidentiality !== 'standard'
      ? [
          {
            id: 'confidentiality',
            label: isPolish ? 'Poufność' : 'Confidentiality',
            value: idea.confidentiality,
          },
        ]
      : []),
    {
      id: 'created',
      label: isPolish ? 'Utworzono' : 'Created',
      value: idea.createdAt ? formatListDate(idea.createdAt) : '—',
      mono: true,
    },
    {
      id: 'updated',
      label: isPolish ? 'Zmieniono' : 'Updated',
      value: idea.updatedAt ? formatListDate(idea.updatedAt) : '—',
      mono: true,
    },
  ];

  /**
   * Kebab bloku 3 (§7.3 pkt 3). `PreviewDetailsSection` ma od 2026-09-01
   * wbudowane „Kopiuj" jako dno, ale własne pozycje są tu jawne — żeby oba
   * widoki Idei miały IDENTYCZNY zestaw, a nie „jeden trzy, drugi jedną".
   */
  const customActions: DetailsAction[] = [
    ...(onToggleDetailsExpanded
      ? [
          {
            id: 'toggle',
            label: detailsExpanded
              ? isPolish
                ? 'Zwiń'
                : 'Collapse'
              : isPolish
                ? 'Rozwiń'
                : 'Expand',
            icon: ChevronDown,
            onClick: onToggleDetailsExpanded,
          },
        ]
      : []),
    ...(onEditIdea
      ? [
          {
            id: 'edit',
            label: isPolish ? 'Edytuj' : 'Edit',
            icon: Edit2,
            onClick: () => onEditIdea(idea),
          },
        ]
      : []),
    {
      id: 'copy',
      label: isPolish ? 'Kopiuj treść' : 'Copy content',
      icon: Copy,
      onClick: () => {
        void navigator.clipboard?.writeText([idea.title, idea.body].filter(Boolean).join('\n\n'));
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PreviewMetaCard pills={metaPills} trailing={metaTrailing}>
        {idea.tags?.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {idea.tags.map((tag) => (
              <MetaChip key={String(tag)} label={String(tag)} />
            ))}
          </div>
        ) : null}
      </PreviewMetaCard>

      <PreviewDetailsSection
        text={idea.body || ''}
        label={isPolish ? 'Szczegóły' : 'Details'}
        expanded={detailsExpanded}
        onToggleExpanded={onToggleDetailsExpanded}
        customActions={customActions}
      >
        <div className="mt-3">
          <ArtifactPropertiesTable
            rows={wlasciwosci}
            propertyLabel={isPolish ? 'Właściwość' : 'Property'}
            valueLabel={isPolish ? 'Wartość' : 'Value'}
          />
        </div>
      </PreviewDetailsSection>
    </div>
  );
};

export interface IdeaPreviewFooterProps {
  idea: MyIdea;
  isPolish: boolean;
  onOpenIdeaInProcessFlow: (idea: MyIdea) => void;
  onConvertComplete: () => void;
}

/**
 * Stopka podglądu Idei — kanon §7.0/§7.3 pkt 4: AI → Relations → Akcje →
 * „Co dalej" (ten ostatni POZA numeracją sześciu bloków, zawsze na końcu).
 */
export const IdeaPreviewFooter: React.FC<IdeaPreviewFooterProps> = ({
  idea,
  isPolish,
  onOpenIdeaInProcessFlow,
  onConvertComplete,
}) => {
  const aiHints = isPolish
    ? ['Dlaczego pilne?', 'Plan działania', 'Kto może pomóc?']
    : ['Why urgent?', 'Action plan', 'Who can help?'];

  const relationItems: RelationItem[] = [];
  if (idea.sourceType) {
    relationItems.push({
      label: `${isPolish ? 'Źródło' : 'Source'}: ${idea.sourceType}`,
      tone: 'text-c-text-secondary',
    });
  }

  // canon §7.3b — tylko dozwolone colorScheme; create-targety idą do „Co dalej"
  // (§7.3a), Usuń żyje w kebabie wiersza (strefa danger) — NIE duplikujemy go
  // tu (§7.3 pkt 4.3, anty-duplikacja). „Otwórz Flow" jest nawigacyjne, nic nie
  // zamyka → `neutral`.
  const actionRows: ActionRow[] = [
    {
      columns: 2,
      buttons: [
        {
          label: isPolish ? 'Otwórz Flow' : 'Open Flow',
          icon: Workflow,
          onClick: () => onOpenIdeaInProcessFlow(idea),
          colorScheme: 'neutral',
        },
      ],
    },
  ];

  return (
    // canon §7.3 — karty stopki jedna pod drugą, `space-y-2.5`, bez dividerów.
    <div className="space-y-2.5">
      <PreviewAIHintStrip hints={aiHints} />

      <PreviewRelations
        items={relationItems}
        emptyLabel={isPolish ? 'Brak powiązań' : 'No linked documents'}
      />

      <PreviewActionBar rows={actionRows} />

      {/* „Co dalej" (§7.3 pkt 4.4) — POZA numeracją sześciu bloków, ZAWSZE po
          bloku 6 (Akcje). Ramka ze wspólnego `PreviewWhatsNextCard`, ta sama co
          renderuje `StandardPreview`. */}
      <PreviewWhatsNextCard isPolish={isPolish}>
        <ConvertToOutputMenu
          sourceType="idea"
          sourceId={idea.id}
          sourceTitle={idea.title || ''}
          onConvertComplete={onConvertComplete}
          variant="inline"
        />
      </PreviewWhatsNextCard>
    </div>
  );
};
