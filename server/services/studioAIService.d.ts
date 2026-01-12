export default studioAIServiceInstance;
declare const studioAIServiceInstance: StudioAIService;
declare class StudioAIService {
    modelRouter: ModelRouter;
    /**
     * Generate a new diagram from text description
     *
     * @param {string} prompt - User's description of the diagram
     * @param {string} diagramType - Type of diagram to generate
     * @param {string} userId - User ID for billing
     * @param {string} organizationId - Organization ID for billing
     * @returns {Promise<Object>} Generated nodes and edges
     */
    generateDiagram(prompt: string, diagramType: string | undefined, userId: string, organizationId: string): Promise<Object>;
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
    modifyDiagram(prompt: string, currentNodes: any[], currentEdges: any[], userId: string, organizationId: string): Promise<Object>;
    /**
     * Classify user intent from message
     *
     * @param {string} message - User message
     * @returns {Promise<Object>} Intent classification
     */
    classifyIntent(message: string): Promise<Object>;
    /**
     * Process a chat message and return appropriate response
     *
     * @param {string} message - User's chat message
     * @param {Object} context - Current diagram context
     * @param {string} userId - User ID
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>} Response with text and optional diagram updates
     */
    processMessage(message: string, context: Object, userId: string, organizationId: string): Promise<Object>;
    /**
     * Detect diagram type from message
     */
    detectDiagramType(message: any): "org_chart" | "mindmap" | "raci" | "swimlane" | "process_flow";
    /**
     * Describe changes made to diagram
     */
    describeChanges(changes: any): string;
    /**
     * Explain the current diagram
     */
    explainDiagram(context: any, userId: any, organizationId: any): Promise<string>;
    /**
     * Suggest optimizations for a diagram
     */
    suggestOptimizations(nodes: any, edges: any, diagramType?: string): Promise<({
        type: string;
        message: string;
        nodeIds: any;
    } | {
        type: string;
        message: string;
        nodeIds?: undefined;
    })[]>;
    /**
     * Update AI session with new message
     */
    updateSession(documentId: any, role: any, content: any, intent?: null): Promise<void>;
}
import { ModelRouter } from './ai/modelRouter.js';
//# sourceMappingURL=studioAIService.d.ts.map