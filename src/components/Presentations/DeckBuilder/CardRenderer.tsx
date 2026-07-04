import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

import type { CardBlock, CuratedColorSet, DeckCard } from '../wizard/types';
import { CURATED_COLOR_SETS } from '../wizard/types';
import { AnimatedBlock, AnimatedCard } from './AnimatedBlock';
import { ArtifactEmbedBlock } from './blocks/ArtifactEmbedBlock';
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
import {
  assignBlocksToRegions,
  selectLayout,
  verticalFillMode,
  type VerticalFillMode,
} from './layouts/LayoutEngine';
import { BlockSourceBadge, CardSourceFooter } from './SourceTraceability';

interface CardRendererProps {
  card: DeckCard;
  colorSetId?: string;
  isActive?: boolean;
  scale?: number;
  animationsEnabled?: boolean;
  recentLayoutIds?: string[];
  onBlockClick?: (blockId: string) => void;
  onSourceClick?: (ref: {
    artifact_id: string;
    artifact_type: string;
    artifact_name: string;
  }) => void;
}

const BLOCK_COMPONENTS: Record<string, React.FC<{ block: CardBlock; theme: CuratedColorSet }>> = {
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
}) => {
  const navigate = useNavigate();
  const theme = CURATED_COLOR_SETS.find((c) => c.id === colorSetId) || CURATED_COLOR_SETS[1];

  const bgStyle = getBackgroundStyle(card, theme);

  const layout = useMemo(() => {
    if (card.blocks.length === 0) return null;
    return selectLayout(card, recentLayoutIds);
  }, [card, recentLayoutIds]);

  const regionMap = useMemo(() => {
    if (!layout || card.blocks.length === 0) return null;
    // STEP 1b — pass B1's composition so the AI's area assignment is honoured;
    // absent → byte-identical to the prior preferred-block-type heuristic.
    return assignBlocksToRegions(card.blocks, layout, card.composition);
  }, [layout, card.blocks, card.composition]);

  const useGridLayout = layout && regionMap && layout.regions.length > 1;

  // W7 FILL-CANVAS — for the single-region stacked path, decide how the blocks
  // distribute down the canvas (top / center / space-between) so sparse content
  // is not glued to the top with a dead bottom.
  const stackedFillMode = useMemo(
    () =>
      card.blocks.length
        ? verticalFillMode(
            card.blocks as { type: string; content?: Record<string, unknown> }[],
            undefined,
            card.intent
          )
        : 'top',
    [card.blocks, card.intent]
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

  const renderBlockItem = (rawBlock: CardBlock, blockIndex: number) => {
    const Component = BLOCK_COMPONENTS[rawBlock.type];
    if (!Component) return null;
    // Display-time safeguard: decks stored before the server-side polish
    // (polishDeckText) may carry raw `##`/`[Fact: …]`/`Data gap:` tokens.
    const block = sanitizeDeckBlock(rawBlock);
    return (
      <AnimatedBlock
        key={block.block_id}
        blockType={block.type}
        index={blockIndex}
        animationsEnabled={animationsEnabled}
        blockStagger={card.animations.block_stagger}
      >
        <div
          onClick={() => onBlockClick?.(block.block_id)}
          className="relative group cursor-pointer"
        >
          <Component block={block} theme={theme} />
          {block.source_ref && (
            <BlockSourceBadge
              sourceRef={block.source_ref}
              isRefreshable={block.is_refreshable ?? false}
            />
          )}
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
              className="text-lg font-semibold opacity-60"
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
                  style={{ gridArea: region.gridArea, justifyContent: justifyFor(regionFill) }}
                  className="flex flex-col gap-2 overflow-hidden"
                >
                  {blocksInRegion.map((block, idx) => renderBlockItem(block as CardBlock, idx))}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="flex-1 flex flex-col gap-3"
            style={{ justifyContent: justifyFor(stackedFillMode) }}
          >
            {card.blocks
              .sort((a, b) => a.position.order - b.position.order)
              .map((block, blockIndex) => renderBlockItem(block, blockIndex))}
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

function getBackgroundStyle(card: DeckCard, theme: CuratedColorSet): React.CSSProperties {
  switch (card.background.type) {
    case 'color':
      return { backgroundColor: card.background.value || theme.colors.background };
    case 'gradient':
      return {
        background:
          card.background.value ||
          `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
      };
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
