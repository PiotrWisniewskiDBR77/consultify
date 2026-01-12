
import { getDatabase, getDatabaseAsync } from '../server/src/database/Database.js';
import redisClient from '../server/utils/redisClient.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(color: string, message: string) {
    console.log(`${color}${message}${RESET}`);
}

function exit(code: number) {
    process.exit(code);
}

async function verify() {
    console.log('================================================');
    console.log('       SYSTEM INTEGRITY VERIFICATION');
    console.log('       Phase 1: DB & Cache Connectivity');
    console.log('================================================');

    // 1. Environment Check
    console.log('\n[1] Environment Variables Report:');
    console.log(`    NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`    MOCK_DB: ${process.env.MOCK_DB}`);
    console.log(`    REDIS_URL: ${process.env.REDIS_URL || '(Not Set)'}`);

    if (process.env.MOCK_DB === 'true') {
        log(RED, '❌ FAIL: MOCK_DB is set to true. This script requires a REAL database connection.');
        exit(1);
    }

    // 2. Database Verification
    console.log('\n[2] Database Verification:');

    // Test getDatabase() (Sync/Hybrid)
    console.log('    Testing getDatabase() (Sync)...');
    const dbSync = getDatabase();

    // Check for Mock properties
    const isMockSync = '_mockData' in dbSync || (dbSync as any).constructor.name === 'Object'; // MockDatabase interface has _mockData, basic object vs class instance

    if (isMockSync) {
        // Special case: Sync might return mock initially if async init is required
        log(YELLOW, '    ⚠️  getDatabase() returned a Mock-like object. This might be expected if async init is pending.');
    } else {
        log(GREEN, '    ✅ getDatabase() returned what appears to be a real instance.');
    }

    // Test getDatabaseAsync()
    console.log('    Testing getDatabaseAsync()...');
    const dbAsync = await getDatabaseAsync();

    const isMockAsync = '_mockData' in dbAsync;

    if (isMockAsync) {
        log(RED, '❌ FAIL: getDatabaseAsync() resolved to a Mock Database!');
        // log(RED, JSON.stringify(dbAsync, null, 2));
        exit(1);
    } else {
        log(GREEN, '    ✅ getDatabaseAsync() returned a real instance.');
    }

    // Run a query
    try {
        console.log('    Running connectivity query (SELECT 1)...');
        // Determine dialect implicitly by trying syntax or just generic SELECT 1
        // SQLite: SELECT 1
        // Postgres: SELECT 1
        // We can check dbAsync constructor name or use a table check

        // Note: Database interface in DbPromise is: all, get, run, exec.
        // It doesn't strictly match IDatabase which might vary.
        // But getDatabaseAsync returns IDatabase.

        // Let's try to query sqlite_master (SQLite) or information_schema (Postgres)
        // Or just SELECT 1.

        await new Promise<void>((resolve, reject) => {
            dbAsync.get('SELECT 1 as result', [], (err: Error | null, row: any) => {
                if (err) {
                    reject(err);
                } else {
                    if (row && row.result === 1) {
                        resolve();
                    } else {
                        reject(new Error(`Unexpected result: ${JSON.stringify(row)}`));
                    }
                }
            });
        });

        log(GREEN, '    ✅ Connectivity Query Success (SELECT 1)');

        // Check dialect
        await new Promise<void>((resolve, reject) => {
            // Try sqlite specific
            dbAsync.get("SELECT sqlite_version() as v", [], (err, row: any) => {
                if (!err && row && row.v) {
                    log(GREEN, `    ℹ️  Database Dialect: SQLite (Version: ${row.v})`);
                }
                resolve();
            });
        });

    } catch (e: any) {
        log(RED, `❌ FAIL: Database Query Failed: ${e.message}`);
        exit(1);
    }

    // 3. Redis Verification
    console.log('\n[3] Redis Verification:');

    if (!redisClient) {
        log(RED, '❌ FAIL: redisClient is undefined');
        exit(1);
    }

    // Check if it's the mock client
    // The mock client in redisClient.js is a plain object created via createMockClient()
    // It has hardcoded checks.
    const isMockRedis = redisClient.constructor.name === 'Object';

    if (isMockRedis) {
        log(RED, '❌ FAIL: redisClient appears to be the MOCK client (Plain Object).');
        log(YELLOW, '    Explanation: redisClient.js falls back to mock if REDIS_URL is missing or connection fails.');
        exit(1);
    } else {
        log(GREEN, '    ✅ redisClient appears to be a real RedisClient instance.');
    }

    // Active Check
    if (!redisClient.isOpen) {
        log(RED, '❌ FAIL: Redis client is NOT open.');
        exit(1);
    }

    console.log('    Testing Redis SET/GET...');
    const testKey = 'verify_db_connection_test_' + Date.now();
    try {
        await redisClient.set(testKey, 'PASSED', { EX: 10 });
        const val = await redisClient.get(testKey);

        if (val === 'PASSED') {
            log(GREEN, '    ✅ Redis Read/Write Success');
        } else {
            log(RED, `❌ FAIL: Redis Read/Write mismatch. Got: ${val}`);
            exit(1);
        }
    } catch (e: any) {
        log(RED, `❌ FAIL: Redis Operation Failed: ${e.message}`);
        exit(1);
    }

    console.log('\n================================================');
    log(GREEN, '✅✅ SYSTEM INTEGRITY VERIFIED: DB & CACHE ARE ONLINE AND REAL ✅✅');
    console.log('================================================');
    exit(0);
}

verify().catch(e => {
    console.error(e);
    exit(1);
});
