export default KnowledgeService;
declare namespace KnowledgeService {
    function setDependencies(newDeps?: {}): void;
    function addCandidate(content: any, reasoning: any, source: any, relatedAxis?: null, originContext?: string): Promise<any>;
    function getCandidates(status?: string): Promise<any>;
    function updateCandidateStatus(id: any, status: any, adminComment?: string): Promise<any>;
    function updateCandidate(id: any, updates: any): Promise<any>;
    function linkIdeaToProject(ideaId: any, projectId: any, notes?: string): Promise<any>;
    function getApprovedIdeas(filters?: {}): Promise<any>;
    function getIdeasByCategory(category: any): Promise<any>;
    function getIdeasByProject(projectId: any): Promise<any>;
    function addStrategy(title: any, description: any, createdBy?: string, options?: {}): Promise<any>;
    function updateStrategy(id: any, updates: any): Promise<any>;
    function linkStrategyToDocument(strategyId: any, docId: any): Promise<any>;
    function linkStrategyToIdea(strategyId: any, ideaId: any): Promise<any>;
    function unlinkStrategyFromDocument(strategyId: any, docId: any): Promise<any>;
    function unlinkStrategyFromIdea(strategyId: any, ideaId: any): Promise<any>;
    function updateStrategyProgress(strategyId: any, percentage: any): Promise<any>;
    function getStrategyWithRelated(strategyId: any): Promise<any>;
    function getActiveStrategies(): Promise<any>;
    function getAllStrategies(): Promise<any>;
    function toggleStrategy(id: any, isActive: any): Promise<any>;
    function setClientContext(orgId: any, key: any, value: any, source?: string, confidence?: number): Promise<any>;
    function getClientContext(orgId: any): Promise<any>;
    function addDocument(filename: any, filepath: any, orgId: any, projectId: any, size: any, category?: null, tags?: any[]): Promise<any>;
    function updateDocument(docId: any, updates: any): Promise<any>;
    function getDocumentsByCategory(orgId: any, category: any): Promise<any>;
    function getDocumentsByStrategy(strategyId: any): Promise<any>;
    function getDocuments(orgId: any, userId?: null, userRole?: string): Promise<any>;
    function processDocument(docId: any, text: any): Promise<any>;
    function deleteDocument(docId: any, orgId: any): Promise<any>;
}
//# sourceMappingURL=knowledgeService.d.ts.map