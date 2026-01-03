/**
 * Tool Registry - Connects handlers to MCP Server
 */

import { mcpServer } from '../mcpServer.js';
import { getProjectDetails } from './getProjectDetails.js';
import { searchKnowledgeBase } from './searchKnowledgeBase.js';
import { calculateRoiDraft } from './calculateRoiDraft.js';
import { createInitiative } from './createInitiative.js';
import { updateAssessmentScore } from './updateAssessmentScore.js';

export function registerAllTools(): void {
    mcpServer.registerHandler('get_project_details', getProjectDetails);
    mcpServer.registerHandler('search_knowledge_base', searchKnowledgeBase);
    mcpServer.registerHandler('calculate_roi_draft', calculateRoiDraft);
    mcpServer.registerHandler('create_initiative', createInitiative);
    mcpServer.registerHandler('update_assessment_score', updateAssessmentScore);

    console.log('[MCP] Registered tools:',
        Array.from(mcpServer.tools.keys()).join(', ')
    );
}

registerAllTools();

export default { registerAllTools };
