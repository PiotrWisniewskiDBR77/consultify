/**
 * Database Configuration
 *
 * Supports both SQLite (development) and PostgreSQL (production)
 * Switch by setting DATABASE_URL environment variable
 */
declare const config: {
    type: string;
    sqlite: {
        path: string;
        options: {
            verbose: boolean;
        };
    };
    postgres: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
        ssl: boolean | {
            rejectUnauthorized: boolean;
        };
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
    } | null;
    debug: boolean;
    logQueries: boolean;
};
export default config;
//# sourceMappingURL=database.config.d.ts.map