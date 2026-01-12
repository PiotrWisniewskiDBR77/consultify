export default MetricsAggregator;
declare namespace MetricsAggregator {
    export { METRIC_KEYS };
    export { WARNING_SEVERITY };
    export function buildDailySnapshots(date?: string): Promise<{
        success: boolean;
        snapshotsCreated: number;
    }>;
    export function _upsertSnapshot(snapshotDate: any, metricKey: any, metricValue: any, dimensions?: {}): Promise<any>;
    export function getFunnel(startEvent: string, endEvent: string, filters?: Object): Promise<{
        startCount: number;
        endCount: number;
        conversionRate: number;
    }>;
    export function getFunnelMetric(startEvent: string, endEvent: string, options?: {
        days?: number | undefined;
    }): Promise<Object>;
    export function getCohortAnalysis(cohortType?: string, options?: Object): Promise<any[]>;
    export function getConversionMetrics(options?: Object): Promise<Object>;
    export function getAverageDaysToUpgrade(options?: Object): Promise<number>;
    export function getTrialExpiryRate(options?: Object): Promise<number>;
    export function getEarlyWarnings(): Promise<any[]>;
    export function _getTrialsAtRisk(): Promise<any>;
    export function _getExpiredNoAction(): Promise<any>;
    export function _getHelpStuck(): Promise<any>;
    export function _getPartnerLowConversion(): Promise<any>;
    export function getPartnerPerformance(options?: Object): Promise<any[]>;
    export function getHelpEffectiveness(options?: Object): Promise<Object>;
    export function getSnapshots(metricKey: string, options?: Object): Promise<any[]>;
    export function getOverview(): Promise<Object>;
    export function getOrganizationMetrics(organizationId: string): Promise<Object>;
    export function checkOrganizationWarnings(organizationId: string): Promise<any[]>;
}
declare namespace METRIC_KEYS {
    let FUNNEL_DEMO_TO_TRIAL: string;
    let FUNNEL_TRIAL_TO_PAID: string;
    let FUNNEL_HELP_COMPLETION: string;
    let FUNNEL_ATTRIBUTION_CONVERSION: string;
    let AVG_DAYS_TO_UPGRADE: string;
    let TRIAL_EXPIRY_RATE: string;
    let INVITE_ACCEPTANCE_RATE: string;
    let PARTNER_REVENUE: string;
    let PARTNER_CONVERSION: string;
    let HELP_EFFECTIVENESS: string;
    let PLAYBOOK_COMPLETION: string;
}
declare namespace WARNING_SEVERITY {
    let LOW: string;
    let MEDIUM: string;
    let HIGH: string;
    let CRITICAL: string;
}
//# sourceMappingURL=metricsAggregator.d.ts.map