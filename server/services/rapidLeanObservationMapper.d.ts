export default RapidLeanObservationMapper;
declare class RapidLeanObservationMapper {
    /**
     * Convert observations to RapidLean questionnaire responses
     * @param {Array} observations - Array of observation data from templates
     * @returns {Object} RapidLean questionnaire responses (questionId -> score)
     */
    static mapObservationsToResponses(observations: any[]): Object;
    /**
     * Get dimension from template ID
     * @param {string} templateId - Template ID
     * @returns {string} Dimension name
     */
    static getDimensionFromTemplate(templateId: string): string;
    /**
     * Map observation item to RapidLean question ID
     * @param {string} dimension - Lean dimension
     * @param {string} itemId - Observation item ID
     * @returns {string|null} RapidLean question ID
     */
    static mapToQuestionId(dimension: string, itemId: string): string | null;
    /**
     * Get all RapidLean question IDs
     * @returns {Array} All question IDs
     */
    static getAllQuestionIds(): any[];
    /**
     * Generate comprehensive report from observations
     * @param {Array} observations - All observations
     * @param {Object} assessment - Generated RapidLean assessment
     * @returns {Object} Report data
     */
    static generateObservationReport(observations: any[], assessment: Object): Object;
    /**
     * Extract key findings from observation
     * @param {Object} observation - Observation data
     * @returns {Array} Key findings
     */
    static extractKeyFindings(observation: Object): any[];
    /**
     * Generate insights from observations and assessment
     * @param {Array} observations - All observations
     * @param {Object} assessment - Assessment data
     * @returns {Object} Insights
     */
    static generateInsights(observations: any[], assessment: Object): Object;
    /**
     * Analyze notes and photos for additional scoring (AI-powered, optional)
     * @param {string} notes - Observation notes
     * @param {Array} photos - Photo URLs
     * @param {string} dimension - Lean dimension
     * @returns {number|null} Additional score (1-5) or null if not analyzed
     */
    static analyzeNotesAndPhotos(notes: string, photos: any[], dimension: string): number | null;
}
//# sourceMappingURL=rapidLeanObservationMapper.d.ts.map