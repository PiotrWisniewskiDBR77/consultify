/**
 * Tool Registry - Connects handlers to MCP Server
 */

import logger from '../../../utils/Logger.js';
import { mcpServer } from '../mcpServer.js';
import { calculateRoiDraft } from './calculateRoiDraft.js';
import { createInitiative } from './createInitiative.js';
import { generateDeliverable } from './generateDeliverable.js';
import { generateInitiative } from './generateInitiative.js';
import { getInitiative } from './getInitiativeCard.js';
import { getProjectDetails } from './getProjectDetails.js';
import { searchInsights } from './searchInsights.js';
import { searchKnowledgeBase } from './searchKnowledgeBase.js';
import { searchOrgNotes } from './searchOrgNotes.js';
import { updateAssessmentScore } from './updateAssessmentScore.js';

export function registerAllTools(): void {
  mcpServer.registerHandler('get_project_details', getProjectDetails as any);
  mcpServer.registerHandler('search_knowledge_base', searchKnowledgeBase as any);
  mcpServer.registerHandler('calculate_roi_draft', calculateRoiDraft as any);
  mcpServer.registerHandler('create_initiative', createInitiative as any);
  mcpServer.registerHandler('update_assessment_score', updateAssessmentScore as any);
  // Teresa org-content retrieval (ff_teresaRetrieval) — handlers self-gate on
  // featureFlags.ENABLE_TERESA_RETRIEVAL and return empty results when off.
  mcpServer.registerHandler('search_org_notes', searchOrgNotes as any);
  mcpServer.registerHandler('search_insights', searchInsights as any);
  mcpServer.registerHandler('get_initiative', getInitiative as any);
  // SPEC_01 kręgosłup czat→deliverable (Tryb A) — self-gate na flagę + rolę.
  mcpServer.registerHandler('generate_deliverable', generateDeliverable as any);
  // M13 Depth · C2 — Teresa creates a DRAFT initiative (reversible, no approval).
  mcpServer.registerHandler('generate_initiative', generateInitiative as any);

  logger.info('[MCP] Registered tools:', Array.from(mcpServer.tools.keys()).join(', '));
}

registerAllTools();

export default { registerAllTools };
