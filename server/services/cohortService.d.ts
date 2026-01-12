/**
 * Cohort Analysis Service
 *
 * Tracks user retention by sign-up cohort (weekly).
 */
export interface RetentionRow {
    week_start: string;
    cohort_size: number;
    week_0: number;
    week_1: number;
    week_2: number;
    week_4: number;
}
export interface CohortServiceInterface {
    getRetentionMatrix: () => Promise<RetentionRow[]>;
}
declare const CohortService: CohortServiceInterface;
export default CohortService;
//# sourceMappingURL=cohortService.d.ts.map