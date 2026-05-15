import type { NodeProps } from 'reactflow';

import { KPIBadgeNode, ProgressNode, ScoreNode } from '../../IdeaMetricNodes';
import { SummaryCardNode } from '../../IdeaSummaryCardNode';
import { FrameNode } from './FrameNode';
import { GroupNode } from './GroupNode';
import { ImageNode } from './ImageNode';
import { LabeledEdge } from './LabeledEdge';
import { LinkNode } from './LinkNode';
import { ShapeNode } from './ShapeNode';
import { StickyNoteNode } from './StickyNoteNode';
import { TextBlockNode } from './TextBlockNode';

type RFNodeTypes = Record<string, React.ComponentType<NodeProps<any>>>;

export const whiteboardNodeTypes: RFNodeTypes = {
  stickyNote: StickyNoteNode,
  textBlock: TextBlockNode,
  groupNode: GroupNode,
  shapeNode: ShapeNode,
  frameNode: FrameNode,
  imageNode: ImageNode,
  linkNode: LinkNode,
  summaryCard: SummaryCardNode,
  kpiBadge: KPIBadgeNode,
  scoreNode: ScoreNode,
  progressNode: ProgressNode,
};

export const whiteboardEdgeTypes = {
  labeled: LabeledEdge,
};
