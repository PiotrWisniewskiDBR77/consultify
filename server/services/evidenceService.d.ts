export default EvidenceService;
declare namespace EvidenceService {
    function addEvidence(scoreId: string, data: Object, userId: string): Promise<Object>;
    function uploadEvidenceFile(scoreId: string, file: Object, metadata: Object | undefined, userId: string): Promise<Object>;
    function getEvidence(evidenceId: any): Promise<any>;
    function getEvidenceForScore(scoreId: any, options?: {}): Promise<any>;
    function getEvidenceForAnalysis(analysisId: any): Promise<any>;
    function updateEvidence(evidenceId: any, updates: any): Promise<any>;
    function deleteEvidence(evidenceId: any): Promise<boolean>;
    function verifyEvidence(evidenceId: any, userId: any): Promise<any>;
    function unverifyEvidence(evidenceId: any): Promise<any>;
    function getVerificationStats(analysisId: any): Promise<any>;
    function getCategories(): {
        id: string;
        name: string;
        nameEn: string;
    }[];
    function deleteEvidenceForScore(scoreId: any): Promise<any>;
    function copyEvidenceToScore(fromScoreId: any, toScoreId: any, userId: any): Promise<any[]>;
    function getEvidenceCountsForAnalysis(analysisId: any): Promise<any>;
}
//# sourceMappingURL=evidenceService.d.ts.map