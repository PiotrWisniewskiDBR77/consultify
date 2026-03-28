import type { WorkspacePanelKey } from '@/components/shared/WorkspacePanelStrip';

import type { CanvasToolType, IdeaWorkspaceSelection } from './ideaSelectionTypes';
import { EMPTY_SELECTION } from './ideaSelectionTypes';

export interface IdeaWorkspaceDocSeed {
  id: string;
  data?: {
    isNew?: boolean;
    initialTool?: CanvasToolType;
  } | null;
}

export interface IdeaWorkspaceHubState {
  activeTool: CanvasToolType;
  activePanel: WorkspacePanelKey;
  selection: IdeaWorkspaceSelection;
  locked: boolean;
}

export function createDefaultIdeaWorkspaceState(
  doc?: IdeaWorkspaceDocSeed | null
): IdeaWorkspaceHubState {
  const initialTool = doc?.data?.initialTool || 'mindmap';
  const isNew = Boolean(doc?.data?.isNew || String(doc?.id || '').startsWith('new-idea-'));

  return {
    activeTool: initialTool,
    activePanel: isNew ? 'tools' : null,
    selection: EMPTY_SELECTION,
    locked: true,
  };
}

export function patchIdeaWorkspaceState(
  current: Record<string, IdeaWorkspaceHubState>,
  doc: IdeaWorkspaceDocSeed,
  patch: Partial<IdeaWorkspaceHubState>
): Record<string, IdeaWorkspaceHubState> {
  const previous = current[doc.id] || createDefaultIdeaWorkspaceState(doc);
  const nextState = {
    ...previous,
    ...patch,
  };

  if (
    previous.activeTool === nextState.activeTool &&
    previous.activePanel === nextState.activePanel &&
    previous.locked === nextState.locked &&
    previous.selection === nextState.selection
  ) {
    return current;
  }

  return {
    ...current,
    [doc.id]: nextState,
  };
}

export function moveIdeaWorkspaceState(
  current: Record<string, IdeaWorkspaceHubState>,
  fromId: string,
  toId: string
): Record<string, IdeaWorkspaceHubState> {
  if (!current[fromId] || fromId === toId) return current;
  const next = { ...current, [toId]: current[fromId] };
  delete next[fromId];
  return next;
}

export function removeIdeaWorkspaceState(
  current: Record<string, IdeaWorkspaceHubState>,
  docId: string
): Record<string, IdeaWorkspaceHubState> {
  if (!current[docId]) return current;
  const next = { ...current };
  delete next[docId];
  return next;
}
