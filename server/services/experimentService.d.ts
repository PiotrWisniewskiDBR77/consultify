export default ExperimentService;
declare namespace ExperimentService {
    /**
     * Get user variant for an experiment.
     * Assigns one if not present.
     */
    function getUserVariant(userId: any, experimentId: any): Promise<any>;
    function assignVariant(variants: any, weights: any): any;
    /**
     * Get all active experiments for user
     */
    function getAllUserExperiments(userId: any): Promise<{}>;
}
//# sourceMappingURL=experimentService.d.ts.map