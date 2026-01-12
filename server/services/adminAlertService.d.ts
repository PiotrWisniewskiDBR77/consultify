declare namespace _default {
    export { setDependencies };
    export { createAdminAlert };
    export { checkAndTriggerAlerts };
    export { sendAlert };
    export { getAlertHistory };
    export { updateAlertCooldown };
}
export default _default;
/**
 * Set dependencies (for testing)
 */
export function setDependencies(newDeps?: {}): void;
/**
 * Create admin alert configuration
 */
export function createAdminAlert(orgId: any, alertConfig: any): Promise<any>;
/**
 * Check and trigger alerts
 */
export function checkAndTriggerAlerts(orgId: any): Promise<any>;
/**
 * Send alert via configured channels
 */
export function sendAlert(alert: any): Promise<any>;
/**
 * Get alert history
 */
export function getAlertHistory(orgId: any, limit?: number): Promise<any>;
/**
 * Update alert cooldown
 */
export function updateAlertCooldown(alertId: any, cooldownHours: any): Promise<any>;
//# sourceMappingURL=adminAlertService.d.ts.map