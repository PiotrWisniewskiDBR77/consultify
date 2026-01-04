declare namespace _default {
    export { STATUS };
    export { SEVERITY };
    export { getSystemStatus };
    export { getIncidents };
    export { getMaintenanceSchedule };
    export { getUptimeStats };
    export { subscribeToUpdates };
    export { createIncident };
    export { updateIncident };
    export { checkDatabaseHealth };
    export { checkAIHealth };
    export { checkAPIHealth };
    export { checkStorageHealth };
    export { checkEmailHealth };
}
export default _default;
export namespace STATUS {
    let OPERATIONAL: string;
    let DEGRADED: string;
    let PARTIAL_OUTAGE: string;
    let MAJOR_OUTAGE: string;
    let MAINTENANCE: string;
}
export namespace SEVERITY {
    let MINOR: string;
    let MAJOR: string;
    let CRITICAL: string;
}
/**
 * Get overall system status
 */
export function getSystemStatus(): Promise<{
    status: string;
    services: {
        database: {
            service: string;
            status: string;
            latency: number;
            lastCheck: string;
            error?: undefined;
        } | {
            service: string;
            status: string;
            error: any;
            lastCheck: string;
            latency?: undefined;
        };
        ai: {
            service: string;
            status: string;
            providers: {
                openai: {
                    status: string;
                    latency: number;
                };
                anthropic: {
                    status: string;
                    latency: number;
                };
                google: {
                    status: string;
                    latency: number;
                };
            };
            lastCheck: string;
        };
        api: {
            service: string;
            status: string;
            uptime: number;
            memoryUsage: NodeJS.MemoryUsage;
            lastCheck: string;
        };
        storage: {
            service: string;
            status: string;
            usedPercent: number;
            lastCheck: string;
        };
        email: {
            service: string;
            status: string;
            lastCheck: string;
        };
    };
    timestamp: string;
}>;
/**
 * Get recent incidents
 */
export function getIncidents(limit?: number): Promise<{
    id: string;
    title: string;
    description: string;
    severity: string;
    status: string;
    createdAt: string;
    resolvedAt: string;
    updates: {
        message: string;
        timestamp: string;
    }[];
}[]>;
/**
 * Get upcoming maintenance windows
 */
export function getMaintenanceSchedule(): Promise<{
    id: string;
    title: string;
    description: string;
    scheduledStart: string;
    scheduledEnd: string;
    affectedServices: string[];
    status: string;
}[]>;
/**
 * Get uptime statistics
 */
export function getUptimeStats(days?: number): Promise<{
    overall: number;
    services: {
        api: number;
        database: number;
        ai: number;
        storage: number;
        email: number;
    };
    period: string;
}>;
/**
 * Subscribe to status updates
 */
export function subscribeToUpdates(email: any): Promise<{
    success: boolean;
}>;
/**
 * Create new incident
 */
export function createIncident(data: any): Promise<{
    id: string;
    title: any;
    description: any;
    severity: any;
    affectedServices: any;
    status: string;
    createdAt: string;
    updates: {
        message: string;
        timestamp: string;
    }[];
}>;
/**
 * Update incident status
 */
export function updateIncident(incidentId: any, update: any): Promise<{
    success: boolean;
}>;
/**
 * Check database health
 */
export function checkDatabaseHealth(): Promise<{
    service: string;
    status: string;
    latency: number;
    lastCheck: string;
    error?: undefined;
} | {
    service: string;
    status: string;
    error: any;
    lastCheck: string;
    latency?: undefined;
}>;
/**
 * Check AI service health
 */
export function checkAIHealth(): Promise<{
    service: string;
    status: string;
    providers: {
        openai: {
            status: string;
            latency: number;
        };
        anthropic: {
            status: string;
            latency: number;
        };
        google: {
            status: string;
            latency: number;
        };
    };
    lastCheck: string;
}>;
/**
 * Check API health
 */
export function checkAPIHealth(): Promise<{
    service: string;
    status: string;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    lastCheck: string;
}>;
/**
 * Check storage health
 */
export function checkStorageHealth(): Promise<{
    service: string;
    status: string;
    usedPercent: number;
    lastCheck: string;
}>;
/**
 * Check email service health
 */
export function checkEmailHealth(): Promise<{
    service: string;
    status: string;
    lastCheck: string;
}>;
//# sourceMappingURL=statusService.d.ts.map