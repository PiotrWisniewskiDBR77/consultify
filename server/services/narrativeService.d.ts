export default NarrativeService;
declare namespace NarrativeService {
    function generateWeeklySummary(projectId: any): Promise<{
        projectId: any;
        type: string;
        narrative: string;
        generatedAt: string;
    }>;
    function generateExecutiveMemo(projectId: any, topic?: string): Promise<{
        projectId: any;
        type: string;
        narrative: string;
        generatedAt: string;
    }>;
    function generateProgressNarrative(projectId: any): Promise<{
        projectId: any;
        type: string;
        narrative: string;
        generatedAt: string;
    }>;
}
//# sourceMappingURL=narrativeService.d.ts.map