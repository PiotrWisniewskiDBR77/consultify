/**
 * Shared types for Ideas list and table components.
 *
 * Extracted from MyIdeasListContent to break the circular dependency
 * between MyIdeasListContent and IdeasTableContent.
 */

import type { IdeaStageV5 } from './ideaEntryTypes';

export type IdeaStage = 'spark' | 'incubating' | 'shaping' | 'ready' | 'promoted';

export type MyIdea = {
  id: string;
  title: string;
  name?: string | null;
  body?: string | null;
  seedText?: string | null;
  seed_text?: string | null;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  sourceType?: string | null;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
  stage?: IdeaStage;
  stageV5?: IdeaStageV5;
  potential?: string | null;
  complexity?: string | null;
  aiExpansion?: string | null;
  promotedTo?: string | null;
  area?: string | null;
  priority?: number | null;
  branch?: string | null;
  mapItems?: number | null;
  mapNodes?: number | null;
  mapEdges?: number | null;
  openMap?: boolean;
  preferredTool?: string | null;
};

export type IdeasViewMode = 'table' | 'grid' | 'garden';

export type IdeasBulkBarPayload = {
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  selectAllVisible: () => void;
  clearSelection: () => void;
  convert: () => void;
  tag: () => void;
  deleteSelected: () => void;
};

export type SortField = 'title' | 'stage' | 'tool' | 'date' | 'tags';
export type SortDir = 'asc' | 'desc';

/**
 * S1-U1 — home-shell state (folders + starred + recents) published UP to the
 * hub so the Command Row (Menu 3) absorbs it as dropdown chips instead of
 * rendering 3-4 extra rows above the table.
 */
export type IdeasHomeShellPayload = {
  foldersAvailable: boolean;
  folders: Array<{ id: string; name: string }>;
  activeFolderId: string | null;
  /** Number of currently starred ideas (chip hidden when 0 and toggle off). */
  starredCount: number;
  showStarredOnly: boolean;
  recents: Array<{ id: string; title: string }>;
  selectFolder: (folderId: string | null) => void;
  createFolder: () => void;
  deleteFolder: (folderId: string) => void;
  toggleStarredOnly: () => void;
  openRecent: (ideaId: string) => void;
};
