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
