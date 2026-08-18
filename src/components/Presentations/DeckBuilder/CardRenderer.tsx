import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

import type { CardBlock, CuratedColorSet, DeckCard } from '../wizard/types';
import { CURATED_COLOR_SETS } from '../wizard/types';
import { AnimatedBlock, AnimatedCard } from './AnimatedBlock';
import { canMoveBlock } from './blockOps';
import { ArtifactEmbedBlock } from './blocks/ArtifactEmbedBlock';
import type { BlockDensity } from './blocks/blockDensity';
import { BulletListBlock } from './blocks/BulletListBlock';
import { CalloutBlock } from './blocks/CalloutBlock';
import { ChartBlock } from './blocks/ChartBlock';
import { DividerBlock } from './blocks/DividerBlock';
import { HeadingBlock } from './blocks/HeadingBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { KpiWidgetBlock } from './blocks/KpiWidgetBlock';
import { MetricStripBlock } from './blocks/MetricStripBlock';
import { ParagraphBlock } from './blocks/ParagraphBlock';
import { SmartDiagramBlock } from './blocks/SmartDiagramBlock';
import { SmartLayoutBlock } from './blocks/SmartLayoutBlock';
import { TableBlock } from './blocks/TableBlock';
import { TimelineBlock } from './blocks/TimelineBlock';
import { sanitizeDeckBlock, sanitizeDeckDisplayText } from './deckTextSanitizer';
import { EditableBlock } from './EditableBlock';
import {
  assignBlocksToRegions,
  blockDensityFor,
  selectLayout,
  type VerticalFillMode,
  verticalFillMode,
} from './layouts/LayoutEngine';
import { blockFrameStyle, blockGeometryStyle } from './manualEditing';
import { normalizeGeometry, patchGeometry, type BlockGeometry } from './geometryOps';
import { BlockSourceBadge, CardSourceFooter } from './SourceTraceability';

interface CardRendererProps {
  card: DeckCard;
  colorSetId?: string;
  isActive?: boolean;
  scale?: number;
  animationsEnabled?: boolean;
  recentLayoutIds?: string[];
  onBlockClick?: (blockId: string, additive?: boolean) => void;
  onSourceClick?: (ref: {
    artifact_id: string;
    artifact_type: string;
    artifact_name: string;
  }) => void;
  /**
   * Fala 1 (manual mode) — gdy TAK, bloki renderują się przez `EditableBlock`
   * (zaznaczenie, inline-edycja TipTap, usuń/duplikuj/przenieś). Domyślnie
   * WYŁĄCZONE, żeby miniaturki (`SlideSorter`), `PresentMode` i publiczne
   * podglądy (`SharedPresentationView`, `CanvasPresentationView`) zostały
   * bajt w bajt takie jak dziś — patrz SPEC §2.3.
   */
  editable?: boolean;
  selectedBlockId?: string | null;
  selectedBlockIds?: string[];
  onBlockUpdate?: (blockId: string, updates: Partial<CardBlock>) => void;
  onBlockDelete?: (blockId: string) => void;
  onBlockDuplicate?: (blockId: string) => void;
  onBlockMove?: (blockId: string, direction: 'up' | 'down') => void;
  onBlockRefresh?: (blockId: string) => void;
  onBlockReplaceImage?: (blockId: string) => void;
}

const FreeformBlockFrame: React.FC<{
  geometry: BlockGeometry;
  selected: boolean;
  onCommit: (geometry: BlockGeometry) => void;
  children: React.ReactNode;
}> = ({ geometry, selected, onCommit, children }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<BlockGeometry | null>(null);
  const visible = draft ?? geometry;

  const startPointer = (
    event: React.PointerEvent<HTMLButtonElement>,
    mode: 'move' | 'resize' | 'rotate'
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const frame = frameRef.current;
    const surface = frame?.parentElement;
    if (!frame || !surface) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = geometry;
    const origin = { x: event.clientX, y: event.clientY };
    const surfaceRect = surface.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    let latest = start;
    const move = (pointer: PointerEvent) => {
      if (mode === 'rotate') {
        const centerX = frameRect.left + frameRect.width / 2;
        const centerY = frameRect.top + frameRect.height / 2;
        const angle =
          (Math.atan2(pointer.clientY - centerY, pointer.clientX - centerX) * 180) / Math.PI;
        latest = patchGeometry(start, { rotation: Math.round(angle + 90) });
      } else {
        const dx = ((pointer.clientX - origin.x) / surfaceRect.width) * 100;
        const dy = ((pointer.clientY - origin.y) / surfaceRect.height) * 100;
        latest =
          mode === 'move'
            ? patchGeometry(start, { x: start.x + dx, y: start.y + dy })
            : normalizeGeometry({ ...start, width: start.width + dx, height: start.height + dy });
      }
      setDraft(latest);
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      setDraft(null);
      if (latest !== start) onCommit(latest);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
  };

  const keyboardMove = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const delta = event.shiftKey ? 5 : 1;
    const patch: Partial<BlockGeometry> = {};
    if (event.key === 'ArrowLeft') patch.x = visible.x - delta;
    if (event.key === 'ArrowRight') patch.x = visible.x + delta;
    if (event.key === 'ArrowUp') patch.y = visible.y - delta;
    if (event.key === 'ArrowDown') patch.y = visible.y + delta;
    if (Object.keys(patch).length === 0) return;
    event.preventDefault();
    onCommit(patchGeometry(visible, patch));
  };

  return (
    <div ref={frameRef} style={blockGeometryStyle(visible)}>
      {children}
      {selected && (
        <>
          <button
            type="button"
            aria-label="Move selected block"
            title="Drag to move; arrow keys move by 1%, Shift by 5%"
            onPointerDown={(event) => startPointer(event, 'move')}
            onKeyDown={keyboardMove}
            className="absolute left-1/2 top-0 z-20 h-4 w-10 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border border-c-focus bg-c-surface shadow"
          />
          <button
            type="button"
            aria-label="Rotate selected block"
            title="Drag to rotate"
            onPointerDown={(event) => startPointer(event, 'rotate')}
            className="absolute left-1/2 -top-6 z-20 h-3 w-3 -translate-x-1/2 cursor-crosshair rounded-full border-2 border-c-focus bg-c-surface shadow"
          />
          <button
            type="button"
            aria-label="Resize selected block"
            title="Drag to resize"
            onPointerDown={(event) => startPointer(event, 'resize')}
            className="absolute -bottom-1.5 -right-1.5 z-20 h-3 w-3 cursor-se-resize rounded-sm border border-c-focus bg-c-surface shadow"
          />
        </>
      )}
    </div>
  );
};

const BLOCK_COMPONENTS: Record<
  string,
  React.FC<{ block: CardBlock; theme: CuratedColorSet; density?: BlockDensity }>
> = {
  heading: HeadingBlock,
  paragraph: ParagraphBlock,
  bullet_list: BulletListBlock,
  numbered_list: BulletListBlock,
  table: TableBlock,
  chart: ChartBlock,
  image: ImageBlock,
  kpi_widget: KpiWidgetBlock,
  metric_strip: MetricStripBlock,
  smart_layout: SmartLayoutBlock,
  smart_diagram: SmartDiagramBlock,
  callout: CalloutBlock,
  quote_block: CalloutBlock,
  timeline_block: TimelineBlock,
  artifact_embed: ArtifactEmbedBlock,
  divider: DividerBlock,
  icon_row: DividerBlock,
};

export const CardRenderer: React.FC<CardRendererProps> = ({
  card,
  colorSetId,
  isActive,
  scale = 1,
  animationsEnabled = true,
  recentLayoutIds = [],
  onBlockClick,
  onSourceClick,
  editable = false,
  selectedBlockId = null,
  selectedBlockIds,
  onBlockUpdate,
  onBlockDelete,
  onBlockDuplicate,
  onBlockMove,
  onBlockRefresh,
  onBlockReplaceImage,
}) => {
  const navigate = useNavigate();
  const deckTheme = CURATED_COLOR_SETS.find((c) => c.id === colorSetId) || CURATED_COLOR_SETS[1];

  const bgStyle = getBackgroundStyle(card, deckTheme);
  // Tło karty (nie motyw aplikacji) decyduje o kolorze tekstu — patrz komentarz
  // przy `themeForCard`. Dla kart jasnych zwraca dokładnie `deckTheme`.
  const theme = useMemo(() => themeForCard(card, deckTheme), [card, deckTheme]);
  const structuredBlocks = useMemo(
    () => card.blocks.filter((block) => !block.geometry),
    [card.blocks]
  );

  const layout = useMemo(() => {
    if (structuredBlocks.length === 0) return null;
    return selectLayout({ ...card, blocks: structuredBlocks }, recentLayoutIds);
  }, [card, recentLayoutIds, structuredBlocks]);

  const regionMap = useMemo(() => {
    if (!layout || structuredBlocks.length === 0) return null;
    // STEP 1b — pass B1's composition so the AI's area assignment is honoured;
    // absent → byte-identical to the prior preferred-block-type heuristic.
    return assignBlocksToRegions(structuredBlocks, layout, card.composition);
  }, [layout, structuredBlocks, card.composition]);

  const useGridLayout = layout && regionMap && layout.regions.length > 1;

  // W7 FILL-CANVAS — for the single-region stacked path, decide how the blocks
  // distribute down the canvas (top / center / space-between) so sparse content
  // is not glued to the top with a dead bottom.
  const stackedFillMode = useMemo(
    () =>
      structuredBlocks.length
        ? verticalFillMode(
            structuredBlocks as { type: string; content?: Record<string, unknown> }[],
            undefined,
            card.intent
          )
        : 'top',
    [structuredBlocks, card.intent]
  );

  const handleSourceClick = (ref: {
    artifact_id: string;
    artifact_type: string;
    artifact_name: string;
  }) => {
    if (onSourceClick) {
      onSourceClick(ref);
      return;
    }

    const artifactType = String(ref.artifact_type || '').toLowerCase();
    const artifactId = String(ref.artifact_id || '').trim();
    if (!artifactId) return;

    if (artifactType === 'initiative') {
      navigate(`${ROUTES.INITIATIVES}?open=${encodeURIComponent(artifactId)}&mode=doc`);
      return;
    }

    if (artifactType === 'financial_analysis') {
      navigate(`${ROUTES.ECONOMICS}?initiativeId=${encodeURIComponent(artifactId)}`);
      return;
    }

    if (artifactType === 'report') {
      navigate(`${ROUTES.REPORTS.BUILDER}/${encodeURIComponent(artifactId)}`);
      return;
    }

    if (artifactType === 'tool_session') {
      navigate(
        `${ROUTES.DISCOVERY_TOOLS.ROOT}?artifact=${encodeURIComponent(`tool:${artifactId}`)}`
      );
      return;
    }

    if (artifactType === 'note') {
      navigate(ROUTES.MY_WORK);
    }
  };

  const renderBlockItem = (
    rawBlock: CardBlock,
    blockIndex: number,
    regionSiblings?: CardBlock[]
  ) => {
    const Component = BLOCK_COMPONENTS[rawBlock.type];
    if (!Component) return null;
    // Display-time safeguard: decks stored before the server-side polish
    // (polishDeckText) may carry raw `##`/`[Fact: …]`/`Data gap:` tokens.
    // GROW-CONTENT — dominant blocks in their region render at 'hero' density.
    // Compute on the RAW block so self-exclusion (`b !== block`) matches by
    // reference against `regionSiblings` (which holds the raw blocks); sanitize
    // only rewrites text, never the `type`/`content` shape density reads.
    const density = blockDensityFor(rawBlock, regionSiblings ?? card.blocks, {
      intent: card.intent,
      variant: card.composition?.layoutVariantId,
    });
    const block = sanitizeDeckBlock(rawBlock);
    const blockBody = (
      <div style={blockFrameStyle(block.style_overrides)} data-block-frame={block.block_id}>
        <Component block={block} theme={theme} density={density} />
        {block.source_ref && (
          <BlockSourceBadge
            sourceRef={block.source_ref}
            isRefreshable={block.is_refreshable ?? false}
          />
        )}
      </div>
    );

    // Fala 1 (manual mode) — EditableBlock adds selection ring, floating
    // toolbar (move/duplicate/delete/refresh) and inline TipTap text editing.
    // Operations read/write ONLY `card.blocks` via the raw (unsanitized)
    // block_id — the model stays a sequence of blocks (SPEC §2.1), never x/y.
    if (editable) {
      const isBlockSelected = (
        selectedBlockIds ?? (selectedBlockId ? [selectedBlockId] : [])
      ).includes(block.block_id);
      const editableNode = (
        <AnimatedBlock
          key={`${block.block_id}-${blockIndex}`}
          blockType={block.type}
          index={blockIndex}
          animationsEnabled={animationsEnabled}
          blockStagger={card.animations.block_stagger}
        >
          <EditableBlock
            block={block}
            isSelected={isBlockSelected}
            onSelect={(additive) => onBlockClick?.(block.block_id, additive)}
            onUpdate={(updates) => onBlockUpdate?.(block.block_id, updates)}
            onDelete={() => onBlockDelete?.(block.block_id)}
            onDuplicate={() => onBlockDuplicate?.(block.block_id)}
            onRefresh={block.is_refreshable ? () => onBlockRefresh?.(block.block_id) : undefined}
            onReplaceImage={
              block.type === 'image' ? () => onBlockReplaceImage?.(block.block_id) : undefined
            }
            onMoveUp={() => onBlockMove?.(block.block_id, 'up')}
            onMoveDown={() => onBlockMove?.(block.block_id, 'down')}
            canMoveUp={canMoveBlock(card.blocks, block.block_id, 'up')}
            canMoveDown={canMoveBlock(card.blocks, block.block_id, 'down')}
          >
            {blockBody}
          </EditableBlock>
        </AnimatedBlock>
      );
      return block.geometry ? (
        <FreeformBlockFrame
          key={`${block.block_id}-${blockIndex}`}
          geometry={block.geometry}
          selected={isBlockSelected}
          onCommit={(geometry) => onBlockUpdate?.(block.block_id, { geometry })}
        >
          {editableNode}
        </FreeformBlockFrame>
      ) : (
        editableNode
      );
    }

    return (
      <AnimatedBlock
        key={`${block.block_id}-${blockIndex}`}
        blockType={block.type}
        index={blockIndex}
        animationsEnabled={animationsEnabled}
        blockStagger={card.animations.block_stagger}
      >
        <div
          onClick={() => onBlockClick?.(block.block_id)}
          className="relative group cursor-pointer"
        >
          {blockBody}
          <div className="absolute inset-0 rounded border-2 border-transparent group-hover:border-c-border-strong transition-colors pointer-events-none" />
        </div>
      </AnimatedBlock>
    );
  };

  const cardContent = (
    <div
      className={`relative rounded-xl overflow-hidden shadow-lg transition-shadow ${
        isActive ? 'ring-2 ring-c-focus-solid shadow-xl' : 'shadow-md'
      }`}
      style={{
        aspectRatio: '16/9',
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top left',
        ...bgStyle,
      }}
    >
      <div className="absolute inset-0 p-8 flex flex-col overflow-hidden">
        {card.blocks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p
              className="text-lg font-semibold"
              style={{ color: theme.colors.textPrimary }}
            >
              {sanitizeDeckDisplayText(card.title)}
            </p>
          </div>
        ) : useGridLayout ? (
          <div
            className="flex-1 gap-3"
            style={{
              display: 'grid',
              gridTemplateAreas: layout.gridTemplate,
              gridTemplateColumns: layout.gridTemplateColumns,
              gridTemplateRows: layout.gridTemplateRows,
            }}
          >
            {layout.regions.map((region) => {
              const blocksInRegion = regionMap.get(region.area) || [];
              // W7 FILL-CANVAS — per-region vertical distribution so a tall
              // region with light content breathes instead of top-clustering.
              const regionFill = verticalFillMode(
                blocksInRegion as { type: string; content?: Record<string, unknown> }[],
                undefined,
                card.intent
              );
              return (
                <div
                  key={region.area}
                  style={{
                    gridArea: region.gridArea,
                    justifyContent: justifyFor(card.content_alignment || regionFill),
                  }}
                  className="flex flex-col gap-2 overflow-hidden"
                >
                  {blocksInRegion.map((block, idx) =>
                    renderBlockItem(block as CardBlock, idx, blocksInRegion as CardBlock[])
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="flex-1 flex flex-col gap-3"
            style={{ justifyContent: justifyFor(card.content_alignment || stackedFillMode) }}
          >
            {[...structuredBlocks]
              .sort((a, b) => (a.position?.order ?? 0) - (b.position?.order ?? 0))
              .map((block, blockIndex) => renderBlockItem(block, blockIndex))}
          </div>
        )}

        {card.blocks.some((block) => block.geometry) && (
          <div className="absolute inset-8 pointer-events-none">
            {card.blocks
              .filter((block) => block.geometry)
              .map((block, index) => (
                <div key={`${block.block_id}-${index}`} className="pointer-events-auto">
                  {renderBlockItem(block, index)}
                </div>
              ))}
          </div>
        )}

        {/* Source Traceability Footer */}
        {card.source_refs.length > 0 && scale === 1 && (
          <CardSourceFooter sourceRefs={card.source_refs} onClickSource={handleSourceClick} />
        )}
      </div>
    </div>
  );

  return (
    <AnimatedCard
      entrance={card.animations.entrance}
      animationsEnabled={animationsEnabled && scale === 1}
    >
      {cardContent}
    </AnimatedCard>
  );
};

/** W7 FILL-CANVAS — map a VerticalFillMode to a flex `justify-content` value. */
function justifyFor(mode: VerticalFillMode): React.CSSProperties['justifyContent'] {
  switch (mode) {
    case 'center':
      return 'center';
    case 'space-between':
      return 'space-between';
    default:
      return 'flex-start';
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * CZYTELNOŚĆ TEKSTU NA WŁASNYM TLE SLAJDU
 *
 * Slajd to artefakt marki: jego kolory NIE mogą iść za motywem aplikacji
 * (`c-*`), bo wtedy eksport/prezentacja wyglądałyby inaczej niż podgląd —
 * a biały tekst z ciemnego motywu zniknąłby na białym slajdzie.
 * Kolor tekstu musi natomiast wynikać z TŁA SAMEGO SLAJDU: motyw niesie
 * `textPrimary` dobrany pod jasną kartę (#0F172A), więc gdy karta dostaje
 * ciemne tło (np. `{type:'gradient'}` — ustawiane produkcyjnie przez
 * presentationAgentEditService przy „popraw styl"), ciemny tekst na ciemnym
 * tle staje się nieczytelny w OBU motywach aplikacji (audyt wyłapywał to
 * tylko w ciemnym, bo skan czyta backgroundColor, a gradient siedzi w
 * background-image). Poniższe wyliczenie odwraca WYŁĄCZNIE role tekstowe
 * i tylko dla kart z ciemnym tłem — karty jasne zostają bajt w bajt.
 * ────────────────────────────────────────────────────────────────────────── */

/** Tekst dla ciemnej powierzchni slajdu — stałe (nie `c-*`: slajd nie zmienia się z motywem apki). */
const SLIDE_TEXT_ON_DARK = {
  primary: '#F8FAFC',
  secondary: '#CBD5E1',
  heading: '#FFFFFF',
} as const;

/** Względna luminancja WCAG dla #rgb / #rrggbb. Zwraca null dla nierozpoznanego zapisu. */
function relativeLuminance(hex: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const chan = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

/**
 * Czy tło karty jest ciemne? `null` = nie da się ustalić (obrazek, nieznany
 * zapis koloru) — wtedy niczego nie zmieniamy.
 */
function isDarkCardBackground(card: DeckCard, theme: CuratedColorSet): boolean | null {
  const value = (card.background.value || '').trim();
  switch (card.background.type) {
    case 'color': {
      const l = relativeLuminance(value || theme.colors.background);
      return l === null ? null : l < 0.4;
    }
    case 'gradient': {
      const stops = (value || `${theme.colors.primary} ${theme.colors.secondary}`).match(
        /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi
      );
      if (!stops?.length) return null;
      const lums = stops.map(relativeLuminance).filter((l): l is number => l !== null);
      if (!lums.length) return null;
      // Najjaśniejszy przystanek decyduje: jeśli NAWET on jest ciemny, cała
      // powierzchnia jest ciemna i ciemny tekst nie ma się gdzie obronić.
      return Math.max(...lums) < 0.4;
    }
    case 'image':
      return null; // nie zgadujemy zawartości obrazka
    default: {
      const l = relativeLuminance(theme.colors.surface);
      return l === null ? null : l < 0.4;
    }
  }
}

/**
 * Motyw przekazywany blokom: identyczny z motywem decka, chyba że karta ma
 * ciemne własne tło — wtedy podmienione są TYLKO role tekstowe.
 */
function themeForCard(card: DeckCard, theme: CuratedColorSet): CuratedColorSet {
  if (isDarkCardBackground(card, theme) !== true) return theme;
  /** Podmieniamy tylko rolę, która sama jest ciemna — jasną zostawiamy nietkniętą. */
  const jasniej = (rola: string, zamiennik: string): string => {
    const l = relativeLuminance(rola);
    return l !== null && l < 0.4 ? zamiennik : rola;
  };
  const { textPrimary, textSecondary, heading } = theme.colors;
  const podmiana = {
    textPrimary: jasniej(textPrimary, SLIDE_TEXT_ON_DARK.primary),
    textSecondary: jasniej(textSecondary, SLIDE_TEXT_ON_DARK.secondary),
    // Nagłówek na ciemnej karcie: crimson #A51C30 na navy gradiencie był
    // nieczytelny (marka nie jest warta niewidocznego tytułu okładki).
    heading: jasniej(heading, SLIDE_TEXT_ON_DARK.heading),
  };
  if (
    podmiana.textPrimary === textPrimary &&
    podmiana.textSecondary === textSecondary &&
    podmiana.heading === heading
  ) {
    return theme; // motyw już jest jasnotekstowy — zero zmian
  }
  return { ...theme, colors: { ...theme.colors, ...podmiana } };
}

function getBackgroundStyle(card: DeckCard, theme: CuratedColorSet): React.CSSProperties {
  switch (card.background.type) {
    case 'color':
      return { backgroundColor: card.background.value || theme.colors.background };
    case 'gradient': {
      const gradient =
        card.background.value ||
        `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`;
      // Pierwszy przystanek gradientu jako JAWNY `background-color` pod spodem.
      // Wizualnie nic nie zmienia (gradient zamalowuje całą powierzchnię), ale
      // karta przestaje być „przezroczysta" dla wszystkiego, co czyta wyłącznie
      // `background-color`: skanów kontrastu, druku bez grafik i eksportu.
      // Bez tego jasny tekst slajdu wyglądał na postawiony na tle APLIKACJI.
      const first = gradient.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i)?.[0];
      // Kolejność kluczy jest istotna: skrót `background` zeruje `background-color`,
      // więc jawny kolor MUSI być ustawiany po nim.
      return first ? { background: gradient, backgroundColor: first } : { background: gradient };
    }
    case 'image':
      return {
        backgroundImage: `url(${card.background.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    default:
      return { backgroundColor: theme.colors.surface };
  }
}
