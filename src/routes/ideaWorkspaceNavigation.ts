import type { CanvasToolType } from '@/components/MyWork/ideaSelectionTypes';
import type { BreadcrumbSegment } from '@/layouts/MainLayout';

export const IDEA_WORKSPACE_TOOLS: readonly CanvasToolType[] = [
  'mindmap',
  'process_flow',
  'table',
  'whiteboard',
];

const TOOL_SLUGS: Record<CanvasToolType, string> = {
  mindmap: 'mindmap',
  process_flow: 'process-flow',
  table: 'table',
  whiteboard: 'whiteboard',
};

export function parseIdeaWorkspaceTool(segment?: string | null): CanvasToolType | undefined {
  switch (String(segment || '').toLowerCase()) {
    case 'mind-map':
    case 'mindmap':
      return 'mindmap';
    case 'process-flow':
    case 'process_flow':
    case 'flow':
      return 'process_flow';
    case 'table':
      return 'table';
    case 'whiteboard':
      return 'whiteboard';
    default:
      return undefined;
  }
}

export function buildIdeaWorkspacePath(ideaId: string, tool: CanvasToolType): string {
  return `/my-work/ideas/${encodeURIComponent(ideaId)}/workspace/${TOOL_SLUGS[tool]}`;
}

export function buildIdeaWorkspaceBreadcrumb(
  myWorkLabel: string,
  ideasLabel: string,
  ideaLabel: string,
  ideaId: string,
  toolLabel: string,
  tool: CanvasToolType
): BreadcrumbSegment[] {
  return [
    { label: myWorkLabel, to: '/my-work' },
    { label: ideasLabel, to: '/my-work/ideas' },
    { label: ideaLabel, to: `/my-work/ideas/${encodeURIComponent(ideaId)}` },
    { label: toolLabel, to: buildIdeaWorkspacePath(ideaId, tool) },
  ];
}
