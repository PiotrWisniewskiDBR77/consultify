/**
 * Tool Registry - Connects handlers to MCP Server
 */

const { mcpServer } = require('../mcpServer');
const { getProjectDetails } = require('./getProjectDetails');
const { searchKnowledgeBase } = require('./searchKnowledgeBase');
const { calculateRoiDraft } = require('./calculateRoiDraft');
const { createInitiative } = require('./createInitiative');
const { updateAssessmentScore } = require('./updateAssessmentScore');

// Register all tool handlers
function registerAllTools() {
    mcpServer.registerHandler('get_project_details', getProjectDetails);
    mcpServer.registerHandler('search_knowledge_base', searchKnowledgeBase);
    mcpServer.registerHandler('calculate_roi_draft', calculateRoiDraft);
    mcpServer.registerHandler('create_initiative', createInitiative);
    mcpServer.registerHandler('update_assessment_score', updateAssessmentScore);

    console.log('[MCP] Registered tools:',
        Array.from(mcpServer.tools.keys()).join(', ')
    );
}

// Auto-register on import
registerAllTools();

module.exports = { registerAllTools };
