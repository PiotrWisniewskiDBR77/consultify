/**
 * Tool Registry - Connects handlers to MCP Server
 */

import logger from '../../../utils/Logger.js';
import { mcpServer } from '../mcpServer.js';
import { calculateRoiDraft } from './calculateRoiDraft.js';
import { createInitiative } from './createInitiative.js';
import { getProjectDetails } from './getProjectDetails.js';
import { searchKnowledgeBase } from './searchKnowledgeBase.js';
import { updateAssessmentScore } from './updateAssessmentScore.js';

export function registerAllTools(): void {
  mcpServer.registerHandler('get_project_details', getProjectDetails as any);
  mcpServer.registerHandler('search_knowledge_base', searchKnowledgeBase as any);
  mcpServer.registerHandler('calculate_roi_draft', calculateRoiDraft as any);
  mcpServer.registerHandler('create_initiative', createInitiative as any);
  mcpServer.registerHandler('update_assessment_score', updateAssessmentScore as any);

  logger.info('[MCP] Registered tools:', Array.from(mcpServer.tools.keys()).join(', '));
}

registerAllTools();

export default { registerAllTools };
