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

/**
 * Przenieś stan warsztatu z identyfikatora roboczego na prawdziwy (po zapisie
 * Idei na serwerze).
 *
 * ★ `fallback` NIE JEST OZDOBNIKIEM — bez niego wybór narzędzia ginie (IDE-027).
 * `patchIdeaWorkspaceState` ma strażnika „bez zmian", który NIE ZAKŁADA wpisu,
 * gdy łatka jest równa stanowi domyślnemu. Dla świeżej Idei z wybranym Procesem
 * łatka `{activeTool:'process_flow', activePanel:'tools', …}` jest co do joty
 * równa domyślnemu stanowi wyliczonemu z `data.initialTool` — więc strażnik
 * ją odrzuca i pod `new-idea-<ts>` NIE MA ŻADNEGO WPISU. Wtedy `current[fromId]`
 * jest puste, przeniesienie było ciche, a po podmianie identyfikatora stan
 * odtwarzał się z dokumentu, któremu `handleDocumentSaved` właśnie wyczyścił
 * `data` rekordem z serwera (bez `initialTool`) → 'mindmap'.
 *
 * Dlatego przy braku wpisu przenosimy STAN WYLICZONY, a nie nic.
 */
export function moveIdeaWorkspaceState(
  current: Record<string, IdeaWorkspaceHubState>,
  fromId: string,
  toId: string,
  fallback?: IdeaWorkspaceHubState | null
): Record<string, IdeaWorkspaceHubState> {
  if (fromId === toId) return current;
  const przenoszony = current[fromId] || fallback;
  if (!przenoszony) return current;
  const next = { ...current, [toId]: przenoszony };
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
