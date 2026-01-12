export default OrganizationEventService;
declare namespace OrganizationEventService {
    export { EVENT_TYPES };
    export function logEvent(organizationId: string, eventType: string, performedByUserId?: string | null, metadata?: Object): Promise<string>;
    export function getEventHistory(organizationId: string, limit?: number): Promise<any[]>;
    export function getEventsByType(organizationId: string, eventType: string): Promise<any[]>;
    export function countEventsByType(organizationId: string, eventType: string): Promise<number>;
}
declare namespace EVENT_TYPES {
    let DEMO_STARTED: string;
    let TRIAL_STARTED: string;
    let TRIAL_WARNING_SENT: string;
    let TRIAL_EXTENDED: string;
    let TRIAL_EXPIRED_LOCKED: string;
    let TRIAL_UPGRADED: string;
}
//# sourceMappingURL=organizationEventService.d.ts.map