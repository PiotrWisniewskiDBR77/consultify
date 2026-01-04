import axios from 'axios';
export interface SiemEvent {
    [key: string]: unknown;
}
export interface SiemLogEntry extends SiemEvent {
    source: string;
    environment: string;
    timestamp: string;
}
export interface SiemServiceInterface {
    setDependencies: (newDeps: Partial<{
        axios: typeof axios;
        enabled?: boolean;
    }>) => void;
    stream: (event: SiemEvent) => Promise<void>;
    flush: () => Promise<void>;
}
/**
 * SIEM Service (Prestige Tier)
 * Handles streaming of audit events to external security collectors.
 */
declare class SiemService implements SiemServiceInterface {
    private enabled;
    private endpoint?;
    private apiKey?;
    private buffer;
    private batchSize;
    private flushInterval;
    private _axios;
    constructor();
    /**
     * Set dependencies for testing
     */
    setDependencies(newDeps: Partial<{
        axios: typeof axios;
        enabled?: boolean;
    }>): void;
    /**
     * Stream a log entry to SIEM
     */
    stream(event: SiemEvent): Promise<void>;
    flush(): Promise<void>;
    startFlushTimer(): void;
}
declare const _default: SiemService;
export default _default;
//# sourceMappingURL=siemService.d.ts.map