/**
 * Type declarations for 'prom-client' module
 */

declare module 'prom-client' {
    export class Registry {
        register(metric: any): void;
        getMetricsAsArray(): Promise<any[]>;
        getSingleMetric(name: string): any;
        [key: string]: any;
    }

    export class Counter {
        constructor(config: { name: string; help: string; labelNames?: string[]; registers?: Registry[] });
        inc(labels?: Record<string, string>, value?: number): void;
        [key: string]: any;
    }

    export class Gauge {
        constructor(config: { name: string; help: string; labelNames?: string[]; registers?: Registry[] });
        set(labels: Record<string, string>, value: number): void;
        [key: string]: any;
    }

    export class Histogram {
        constructor(config: { name: string; help: string; labelNames?: string[]; buckets?: number[]; registers?: Registry[] });
        observe(labels: Record<string, string>, value: number): void;
        [key: string]: any;
    }

    export const register: Registry;
    export function collectDefaultMetrics(config?: any): void;
}
