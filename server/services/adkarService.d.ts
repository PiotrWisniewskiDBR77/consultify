export default ADKARService;
declare class ADKARService {
    /**
     * Calculate ADKAR scores
     * @param {Object} responses - Question responses (1-5 scale)
     * @returns {Object} Calculated scores
     */
    static calculateScores(responses: Object): Object;
    /**
     * Identify weakest dimensions (change readiness gaps)
     * @param {Object} scores - Dimension scores
     * @param {number} threshold - Gap threshold
     * @returns {Array} Weakest dimensions
     */
    static identifyGaps(scores: Object, threshold?: number): any[];
    /**
     * Generate change readiness recommendations
     * @param {Object} scores - Assessment scores
     * @returns {Array} Recommendations
     */
    static generateRecommendations(scores: Object): any[];
    /**
     * Create ADKAR assessment
     * @param {Object} data - Assessment data
     * @returns {Promise<Object>} Created assessment
     */
    static createAssessment(data: Object): Promise<Object>;
    /**
     * Get ADKAR assessment by ID
     */
    static getAssessment(assessmentId: any): Promise<any>;
}
//# sourceMappingURL=adkarService.d.ts.map