export default MetricsPersistenceService;
declare namespace MetricsPersistenceService {
    /**
     * Takes a snapshot of current in-memory metrics and saves to DB.
     * Optionally resets the in-memory counters after saving.
     */
    function saveSnapshot(reset?: boolean, dbInstance?: null): Promise<boolean>;
    /**
     * Retrieves historical metrics for charting
     * @param {number} days - Number of days to look back
     */
    function getHistory(days?: number, dbInstance?: null): Promise<any>;
}
//# sourceMappingURL=metricsPersistenceService.d.ts.map