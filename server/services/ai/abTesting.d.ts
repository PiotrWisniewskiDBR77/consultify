declare namespace _default {
    export { ABTestingService };
    export { abTestingService };
    export { abTestingService as abTesting };
}
export default _default;
export class ABTestingService {
    activeExperiments: Map<any, any>;
    cacheRefreshInterval: number;
    lastRefresh: number;
    /**
     * Create a new A/B test experiment
     */
    createExperiment(config: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        name: any;
        status: string;
    }>;
    /**
     * Start an experiment
     */
    startExperiment(experimentId: any, userId: any): Promise<{
        success: boolean;
    }>;
    /**
     * Stop an experiment
     */
    stopExperiment(experimentId: any, reason?: string): Promise<{
        success: boolean;
    }>;
    /**
     * Get variant for a user/session
     */
    getVariant(promptId: any, userId: any): Promise<{
        experimentId: any;
        variantIndex: number;
        variant: any;
    } | null>;
    /**
     * Deterministic variant assignment
     */
    assignVariant(userId: any, experiment: any): {
        index: number;
        data: any;
    };
    /**
     * Simple hash function
     */
    simpleHash(str: any): number;
    /**
     * Record variant assignment
     */
    recordAssignment(experimentId: any, userId: any, variantIndex: any): Promise<void>;
    /**
     * Record experiment outcome/event
     */
    recordOutcome(experimentId: any, userId: any, metric: any, value: any): Promise<void>;
    /**
     * Get experiment statistics
     */
    getExperimentStats(experimentId: any): Promise<{
        experiment: {
            id: any;
            name: any;
            status: any;
            startedAt: any;
            primaryMetric: any;
        };
        variants: any;
        analysis: {
            isSignificant: boolean;
            message: string;
            controlMean?: undefined;
            treatmentMean?: undefined;
            zScore?: undefined;
            requiredZ?: undefined;
            lift?: undefined;
            winner?: undefined;
        } | {
            isSignificant: boolean;
            message: string;
            controlMean: any;
            treatmentMean: any;
            zScore?: undefined;
            requiredZ?: undefined;
            lift?: undefined;
            winner?: undefined;
        } | {
            isSignificant: boolean;
            zScore: number;
            requiredZ: number;
            controlMean: any;
            treatmentMean: any;
            lift: number;
            winner: number | null;
            message: string;
        };
        minSampleSize: any;
        totalSamples: unknown;
    }>;
    /**
     * Calculate statistical significance
     */
    calculateStats(outcomes: any, confidenceLevel: any): {
        isSignificant: boolean;
        message: string;
        controlMean?: undefined;
        treatmentMean?: undefined;
        zScore?: undefined;
        requiredZ?: undefined;
        lift?: undefined;
        winner?: undefined;
    } | {
        isSignificant: boolean;
        message: string;
        controlMean: any;
        treatmentMean: any;
        zScore?: undefined;
        requiredZ?: undefined;
        lift?: undefined;
        winner?: undefined;
    } | {
        isSignificant: boolean;
        zScore: number;
        requiredZ: number;
        controlMean: any;
        treatmentMean: any;
        lift: number;
        winner: number | null;
        message: string;
    };
    /**
     * Check if experiment should be concluded
     */
    checkExperimentConclusion(experimentId: any): Promise<boolean>;
    /**
     * Get single experiment
     */
    getExperiment(experimentId: any): Promise<unknown>;
    /**
     * List experiments
     */
    listExperiments(filters?: {}): Promise<unknown[]>;
    /**
     * Refresh active experiments cache
     */
    refreshActiveExperiments(): Promise<void>;
}
export const abTestingService: ABTestingService;
//# sourceMappingURL=abTesting.d.ts.map