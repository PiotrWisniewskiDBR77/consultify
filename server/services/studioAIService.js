/**
 * Studio AI Service
 * 
 * AI-powered diagram generation for Consultify Studio.
 * Converts natural language descriptions into React Flow nodes and edges.
 * 
 * @module server/services/studioAIService
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import PromptService from './promptService.js';
import TokenBillingService from './tokenBillingService.js';
import { ModelRouter } from './ai/modelRouter.js';
import { v4 as uuidv4 } from 'uuid';



// Helper to clean JSON from AI response
const cleanJSON = (text) => {
    if (!text) return null;
    try {
        // Remove markdown code blocks
        let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        // Find first { and last } to extract JSON
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("[StudioAI] JSON Parse Error:", e.message);
        return null;
    }
};

// Helper: Promisify db functions
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

/**
 * Diagram type configurations with default node structures
 */
const DIAGRAM_CONFIGS = {
    process_flow: {
        name: 'Process Flow',
        nodeTypes: ['processStep', 'decision', 'startEnd', 'swimlane'],
        description: 'Linear or branching process with steps and decisions'
    },
    org_chart: {
        name: 'Organization Chart',
        nodeTypes: ['orgUnit', 'role', 'team'],
        description: 'Hierarchical organization structure'
    },
    mindmap: {
        name: 'Mind Map',
        nodeTypes: ['mindmapNode', 'centralTopic'],
        description: 'Radial brainstorming diagram'
    },
    raci: {
        name: 'RACI Matrix',
        nodeTypes: ['raciHeader', 'raciCell', 'raciTask'],
        description: 'Responsibility assignment matrix'
    },
    swimlane: {
        name: 'Swimlane Diagram',
        nodeTypes: ['swimlane', 'processStep', 'decision'],
        description: 'Process flow with role/department lanes'
    },
    custom: {
        name: 'Custom Diagram',
        nodeTypes: ['textNode', 'processStep', 'decision'],
        description: 'Freeform diagram'
    }
};

/**
 * System prompts for different diagram generation modes
 */
const SYSTEM_PROMPTS = {
    generate: `You are an expert diagram designer for Consultify Studio. 
Your task is to convert natural language descriptions into React Flow diagram data.

CRITICAL RULES:
1. Output ONLY valid JSON - no explanations, no markdown outside the JSON
2. Node IDs must be unique UUIDs
3. Position nodes to avoid overlap (use grid: x += 250, y += 150)
4. Edge IDs must reference valid node IDs

OUTPUT FORMAT:
{
    "nodes": [
        {
            "id": "unique-uuid",
            "type": "processStep|decision|startEnd|textNode|mindmapNode|raciCell|orgUnit",
            "position": { "x": 0, "y": 0 },
            "data": { 
                "label": "Step Name",
                "description": "Optional description"
            }
        }
    ],
    "edges": [
        {
            "id": "edge-uuid",
            "source": "node-id-1",
            "target": "node-id-2",
            "label": "Optional edge label",
            "type": "smoothstep"
        }
    ],
    "diagramType": "process_flow|org_chart|mindmap|raci|swimlane",
    "title": "Suggested diagram title"
}

NODE TYPE RULES:
- processStep: Rectangle, for actions/tasks. Data: {label, description}
- decision: Diamond, for yes/no branches. Data: {label, yesLabel, noLabel}
- startEnd: Rounded, for start/end points. Data: {label, isStart: boolean}
- textNode: Simple text annotation. Data: {label}
- mindmapNode: Circular, for brainstorming. Data: {label, level: 0-3}
- orgUnit: Card with avatar placeholder. Data: {label, role, department}
- raciCell: Matrix cell. Data: {value: 'R'|'A'|'C'|'I'|'', task, role}

POSITIONING GUIDELINES:
- Process flows: Left to right (x increments by 250)
- Org charts: Top to bottom (y increments by 150)
- Mind maps: Radial from center
- RACI: Grid layout (header row, then tasks)`,

    modify: `You are an expert diagram editor for Consultify Studio.
Your task is to modify an existing React Flow diagram based on user instructions.

CURRENT DIAGRAM STATE will be provided.

MODIFICATION RULES:
1. Preserve existing node IDs when modifying (don't recreate)
2. Only change what the user asks for
3. Add new nodes with new UUIDs
4. Update positions if layout changes
5. Keep edge connections valid

OUTPUT FORMAT:
{
    "nodes": [...], // Complete updated nodes array
    "edges": [...], // Complete updated edges array
    "changes": {
        "added": ["node-id-1"],
        "modified": ["node-id-2"],
        "removed": ["node-id-3"]
    }
}`
};

/**
 * Intent classification for user messages
 */
const INTENT_TYPES = {
    CREATE_DIAGRAM: 'create_diagram',
    ADD_NODE: 'add_node',
    REMOVE_NODE: 'remove_node',
    MODIFY_NODE: 'modify_node',
    CONNECT_NODES: 'connect_nodes',
    CHANGE_LAYOUT: 'change_layout',
    STYLE_CHANGE: 'style_change',
    EXPLAIN: 'explain',
    UNKNOWN: 'unknown'
};

class StudioAIService {
    constructor() {
        this.modelRouter = new ModelRouter();
    }

    /**
     * Generate a new diagram from text description
     * 
     * @param {string} prompt - User's description of the diagram
     * @param {string} diagramType - Type of diagram to generate
     * @param {string} userId - User ID for billing
     * @param {string} organizationId - Organization ID for billing
     * @returns {Promise<Object>} Generated nodes and edges
     */
    async generateDiagram(prompt, diagramType = 'process_flow', userId, organizationId) {
        console.log(`[StudioAI] Generating ${diagramType} diagram from prompt: "${prompt.substring(0, 50)}..."`);

        const config = DIAGRAM_CONFIGS[diagramType] || DIAGRAM_CONFIGS.custom;

        const systemPrompt = SYSTEM_PROMPTS.generate;
        const userPrompt = `
Create a ${config.name} diagram for the following:

"${prompt}"

Diagram type: ${diagramType}
Available node types: ${config.nodeTypes.join(', ')}

Generate a complete, well-structured diagram. Position nodes clearly with no overlaps.
`;

        try {
            // Call AI through model router
            const response = await this.modelRouter.generateResponse({
                prompt: userPrompt,
                systemPrompt,
                mode: 'CREATIVE',
                maxTokens: 4000,
                temperature: 0.7,
                userId,
                organizationId
            });

            // Bill tokens
            if (response.usage) {
                await TokenBillingService.recordUsage(
                    organizationId,
                    userId,
                    response.usage.promptTokens || 0,
                    response.usage.completionTokens || 0,
                    'studio_diagram_generate',
                    { diagramType }
                );
            }

            // Parse response
            const result = cleanJSON(response.content || response.text);

            if (!result || !result.nodes) {
                throw new Error('Invalid diagram response from AI');
            }

            // Ensure all nodes have unique IDs
            result.nodes = result.nodes.map(node => ({
                ...node,
                id: node.id || uuidv4()
            }));

            // Ensure all edges have IDs and valid references
            result.edges = (result.edges || []).map(edge => ({
                ...edge,
                id: edge.id || uuidv4()
            }));

            return {
                nodes: result.nodes,
                edges: result.edges,
                diagramType: result.diagramType || diagramType,
                suggestedTitle: result.title || 'New Diagram',
                tokensUsed: response.usage?.totalTokens || 0
            };

        } catch (error) {
            console.error('[StudioAI] Generation error:', error);
            throw error;
        }
    }

    /**
     * Modify an existing diagram based on user instruction
     * 
     * @param {string} prompt - User's modification instruction
     * @param {Array} currentNodes - Current diagram nodes
     * @param {Array} currentEdges - Current diagram edges
     * @param {string} userId - User ID for billing
     * @param {string} organizationId - Organization ID for billing
     * @returns {Promise<Object>} Modified nodes and edges
     */
    async modifyDiagram(prompt, currentNodes, currentEdges, userId, organizationId) {
        console.log(`[StudioAI] Modifying diagram: "${prompt.substring(0, 50)}..."`);

        const systemPrompt = SYSTEM_PROMPTS.modify;
        const userPrompt = `
CURRENT DIAGRAM STATE:
Nodes: ${JSON.stringify(currentNodes, null, 2)}
Edges: ${JSON.stringify(currentEdges, null, 2)}

USER REQUEST:
"${prompt}"

Apply the requested changes to the diagram. Return the complete updated diagram.
`;

        try {
            const response = await this.modelRouter.generateResponse({
                prompt: userPrompt,
                systemPrompt,
                mode: 'CREATIVE',
                maxTokens: 4000,
                temperature: 0.5,
                userId,
                organizationId
            });

            // Bill tokens
            if (response.usage) {
                await TokenBillingService.recordUsage(
                    organizationId,
                    userId,
                    response.usage.promptTokens || 0,
                    response.usage.completionTokens || 0,
                    'studio_diagram_modify',
                    {}
                );
            }

            const result = cleanJSON(response.content || response.text);

            if (!result || !result.nodes) {
                throw new Error('Invalid modification response from AI');
            }

            return {
                nodes: result.nodes,
                edges: result.edges || [],
                changes: result.changes || {},
                tokensUsed: response.usage?.totalTokens || 0
            };

        } catch (error) {
            console.error('[StudioAI] Modification error:', error);
            throw error;
        }
    }

    /**
     * Classify user intent from message
     * 
     * @param {string} message - User message
     * @returns {Promise<Object>} Intent classification
     */
    async classifyIntent(message) {
        const lowerMessage = message.toLowerCase();

        // Simple rule-based classification for common patterns
        if (/^(create|make|draw|generate|build)\s/i.test(message)) {
            return { intent: INTENT_TYPES.CREATE_DIAGRAM, confidence: 0.9 };
        }
        if (/^(add|insert|include)\s/i.test(message)) {
            return { intent: INTENT_TYPES.ADD_NODE, confidence: 0.85 };
        }
        if (/^(remove|delete|drop)\s/i.test(message)) {
            return { intent: INTENT_TYPES.REMOVE_NODE, confidence: 0.85 };
        }
        if (/^(change|modify|update|edit|rename)\s/i.test(message)) {
            return { intent: INTENT_TYPES.MODIFY_NODE, confidence: 0.85 };
        }
        if (/^(connect|link|join)\s/i.test(message)) {
            return { intent: INTENT_TYPES.CONNECT_NODES, confidence: 0.85 };
        }
        if (/^(rearrange|reorganize|layout|move)\s/i.test(message)) {
            return { intent: INTENT_TYPES.CHANGE_LAYOUT, confidence: 0.8 };
        }
        if (/^(explain|what|why|how)\s/i.test(message)) {
            return { intent: INTENT_TYPES.EXPLAIN, confidence: 0.7 };
        }

        // Default: Check if it's likely a creation request
        if (lowerMessage.includes('process') ||
            lowerMessage.includes('flow') ||
            lowerMessage.includes('diagram') ||
            lowerMessage.includes('chart') ||
            lowerMessage.includes('steps')) {
            return { intent: INTENT_TYPES.CREATE_DIAGRAM, confidence: 0.6 };
        }

        return { intent: INTENT_TYPES.UNKNOWN, confidence: 0.3 };
    }

    /**
     * Process a chat message and return appropriate response
     * 
     * @param {string} message - User's chat message
     * @param {Object} context - Current diagram context
     * @param {string} userId - User ID
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>} Response with text and optional diagram updates
     */
    async processMessage(message, context, userId, organizationId) {
        const { intent, confidence } = await this.classifyIntent(message);

        let response = {
            text: '',
            diagramUpdate: null,
            intent,
            confidence
        };

        try {
            switch (intent) {
                case INTENT_TYPES.CREATE_DIAGRAM:
                    const diagramType = this.detectDiagramType(message);
                    const generated = await this.generateDiagram(message, diagramType, userId, organizationId);
                    response.text = `I've created a ${diagramType.replace('_', ' ')} diagram based on your description. ${generated.nodes.length} nodes and ${generated.edges.length} connections were generated.`;
                    response.diagramUpdate = {
                        action: 'replace',
                        nodes: generated.nodes,
                        edges: generated.edges,
                        type: generated.diagramType
                    };
                    break;

                case INTENT_TYPES.ADD_NODE:
                case INTENT_TYPES.REMOVE_NODE:
                case INTENT_TYPES.MODIFY_NODE:
                case INTENT_TYPES.CONNECT_NODES:
                case INTENT_TYPES.CHANGE_LAYOUT:
                    if (!context.nodes || context.nodes.length === 0) {
                        response.text = "There's no diagram to modify yet. Would you like me to create one first?";
                    } else {
                        const modified = await this.modifyDiagram(
                            message,
                            context.nodes,
                            context.edges || [],
                            userId,
                            organizationId
                        );
                        response.text = this.describeChanges(modified.changes);
                        response.diagramUpdate = {
                            action: 'update',
                            nodes: modified.nodes,
                            edges: modified.edges,
                            changes: modified.changes
                        };
                    }
                    break;

                case INTENT_TYPES.EXPLAIN:
                    response.text = await this.explainDiagram(context, userId, organizationId);
                    break;

                default:
                    // Try to determine if this is a diagram request
                    if (confidence < 0.5) {
                        response.text = "I'm not sure what you'd like me to do. You can:\n" +
                            "- **Create** a diagram: 'Create a process flow for...'\n" +
                            "- **Add** elements: 'Add a decision node for...'\n" +
                            "- **Modify** elements: 'Change the label of...'\n" +
                            "- **Connect** nodes: 'Connect node A to node B'\n" +
                            "What would you like to do?";
                    } else {
                        // Attempt generation anyway
                        const generated = await this.generateDiagram(message, 'process_flow', userId, organizationId);
                        response.text = `I've interpreted your request and created a diagram with ${generated.nodes.length} elements.`;
                        response.diagramUpdate = {
                            action: 'replace',
                            nodes: generated.nodes,
                            edges: generated.edges
                        };
                    }
            }
        } catch (error) {
            console.error('[StudioAI] Error processing message:', error);
            response.text = "I encountered an error processing your request. Please try rephrasing or simplifying your description.";
        }

        return response;
    }

    /**
     * Detect diagram type from message
     */
    detectDiagramType(message) {
        const lower = message.toLowerCase();

        if (lower.includes('org') && (lower.includes('chart') || lower.includes('structure'))) {
            return 'org_chart';
        }
        if (lower.includes('mindmap') || lower.includes('mind map') || lower.includes('brainstorm')) {
            return 'mindmap';
        }
        if (lower.includes('raci') || lower.includes('responsibility')) {
            return 'raci';
        }
        if (lower.includes('swimlane') || lower.includes('swim lane') || lower.includes('department')) {
            return 'swimlane';
        }
        // Default to process flow
        return 'process_flow';
    }

    /**
     * Describe changes made to diagram
     */
    describeChanges(changes) {
        if (!changes) return "I've updated the diagram based on your request.";

        const parts = [];
        if (changes.added?.length) {
            parts.push(`Added ${changes.added.length} node(s)`);
        }
        if (changes.modified?.length) {
            parts.push(`Modified ${changes.modified.length} node(s)`);
        }
        if (changes.removed?.length) {
            parts.push(`Removed ${changes.removed.length} node(s)`);
        }

        return parts.length > 0
            ? `Done! ${parts.join(', ')}.`
            : "I've updated the diagram based on your request.";
    }

    /**
     * Explain the current diagram
     */
    async explainDiagram(context, userId, organizationId) {
        if (!context.nodes || context.nodes.length === 0) {
            return "There's no diagram to explain yet. Would you like me to create one?";
        }

        const nodeCount = context.nodes.length;
        const edgeCount = context.edges?.length || 0;
        const types = [...new Set(context.nodes.map(n => n.type))];

        return `This diagram contains ${nodeCount} elements (${types.join(', ')}) with ${edgeCount} connections. ` +
            `The main elements are: ${context.nodes.slice(0, 5).map(n => n.data?.label || 'Unnamed').join(', ')}` +
            (nodeCount > 5 ? `, and ${nodeCount - 5} more.` : '.');
    }

    /**
     * Suggest optimizations for a diagram
     */
    async suggestOptimizations(nodes, edges, diagramType = 'process_flow') {
        const suggestions = [];

        // Check for disconnected nodes
        const connectedNodes = new Set([
            ...edges.map(e => e.source),
            ...edges.map(e => e.target)
        ]);
        const disconnected = nodes.filter(n => !connectedNodes.has(n.id));
        if (disconnected.length > 0) {
            suggestions.push({
                type: 'warning',
                message: `${disconnected.length} node(s) are not connected to the flow`,
                nodeIds: disconnected.map(n => n.id)
            });
        }

        // Check for nodes without labels
        const unlabeled = nodes.filter(n => !n.data?.label);
        if (unlabeled.length > 0) {
            suggestions.push({
                type: 'info',
                message: `${unlabeled.length} node(s) don't have labels`,
                nodeIds: unlabeled.map(n => n.id)
            });
        }

        // Process flow specific
        if (diagramType === 'process_flow') {
            const startNodes = nodes.filter(n => n.type === 'startEnd' && n.data?.isStart);
            const endNodes = nodes.filter(n => n.type === 'startEnd' && !n.data?.isStart);

            if (startNodes.length === 0) {
                suggestions.push({
                    type: 'warning',
                    message: 'No start node found. Consider adding one for clarity.'
                });
            }
            if (endNodes.length === 0) {
                suggestions.push({
                    type: 'warning',
                    message: 'No end node found. Consider adding one for clarity.'
                });
            }
        }

        return suggestions;
    }

    /**
     * Update AI session with new message
     */
    async updateSession(documentId, role, content, intent = null) {
        try {
            const session = await dbGet(
                'SELECT * FROM studio_ai_sessions WHERE document_id = ?',
                [documentId]
            );

            if (!session) {
                // Create session if doesn't exist
                await dbRun(`
                    INSERT INTO studio_ai_sessions (id, document_id, messages_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `, [uuidv4(), documentId, '[]', new Date().toISOString(), new Date().toISOString()]);
            }

            const messages = JSON.parse(session?.messages_json || '[]');
            messages.push({
                role,
                content,
                timestamp: new Date().toISOString(),
                intent
            });

            // Keep last 50 messages
            const trimmedMessages = messages.slice(-50);

            const intentHistory = JSON.parse(session?.intent_history_json || '[]');
            if (intent) {
                intentHistory.push({ intent, timestamp: new Date().toISOString() });
            }

            const isGeneration = role === 'assistant' && intent?.includes('CREATE');
            const isModification = role === 'assistant' && intent?.includes('MODIFY');

            await dbRun(`
                UPDATE studio_ai_sessions SET
                    messages_json = ?,
                    intent_history_json = ?,
                    total_generations = total_generations + ?,
                    total_modifications = total_modifications + ?,
                    updated_at = ?
                WHERE document_id = ?
            `, [
                JSON.stringify(trimmedMessages),
                JSON.stringify(intentHistory.slice(-100)),
                isGeneration ? 1 : 0,
                isModification ? 1 : 0,
                new Date().toISOString(),
                documentId
            ]);

        } catch (error) {
            console.error('[StudioAI] Error updating session:', error);
        }
    }
}

// Export singleton instance
const studioAIServiceInstance = new StudioAIService();
export default studioAIServiceInstance;














