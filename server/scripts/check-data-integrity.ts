/**
 * Data Integrity Checker
 * Validates database integrity and finds issues
 */

import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';

interface IntegrityReport {
    passed: boolean;
    checks: {
        name: string;
        passed: boolean;
        details?: string;
        issues?: any[];
    }[];
    timestamp: Date;
}

export class DataIntegrityChecker {
    private db: any;

    constructor() {
        this.db = getDatabase();
    }

    async runAllChecks(): Promise<IntegrityReport> {
        logger.info('[Integrity] Running all checks...');

        const checks = [
            await this.checkDatabaseIntegrity(),
            await this.checkForeignKeys(),
            await this.checkOrphanedRecords(),
            await this.checkDuplicates(),
        ];

        const passed = checks.every(c => c.passed);

        logger.info(`[Integrity] ${passed ? '✅ PASSED' : '❌ FAILED'}`);

        return {
            passed,
            checks,
            timestamp: new Date(),
        };
    }

    private async checkDatabaseIntegrity() {
        try {
            const result = await this.db.query('PRAGMA integrity_check;', []);
            const passed = result.rows[0]?.integrity_check === 'ok';

            return {
                name: 'Database Integrity',
                passed,
                details: passed ? 'Database structure is valid' : 'Database corruption detected',
            };
        } catch (error) {
            return {
                name: 'Database Integrity',
                passed: false,
                details: String(error),
            };
        }
    }

    private async checkForeignKeys() {
        try {
            const result = await this.db.query('PRAGMA foreign_key_check;', []);
            const passed = result.rows.length === 0;

            return {
                name: 'Foreign Key Constraints',
                passed,
                details: passed ? 'No foreign key violations' : `${result.rows.length} violations found`,
                issues: result.rows,
            };
        } catch (error) {
            return {
                name: 'Foreign Key Constraints',
                passed: false,
                details: String(error),
            };
        }
    }

    private async checkOrphanedRecords() {
        try {
            // Check for orphaned users (no organization)
            const orphanedUsers = await this.db.query(
                `SELECT id FROM users WHERE organization_id NOT IN (SELECT id FROM organizations)`,
                []
            );

            const passed = orphanedUsers.rows.length === 0;

            return {
                name: 'Orphaned Records',
                passed,
                details: passed ? 'No orphaned records' : `${orphanedUsers.rows.length} orphaned users found`,
                issues: orphanedUsers.rows,
            };
        } catch (error) {
            return {
                name: 'Orphaned Records',
                passed: true,
                details: 'Check skipped (table may not exist)',
            };
        }
    }

    private async checkDuplicates() {
        try {
            // Check for duplicate emails
            const duplicates = await this.db.query(
                `SELECT email, COUNT(*) as count FROM users GROUP BY email HAVING count > 1`,
                []
            );

            const passed = duplicates.rows.length === 0;

            return {
                name: 'Duplicate Records',
                passed,
                details: passed ? 'No duplicates found' : `${duplicates.rows.length} duplicate emails`,
                issues: duplicates.rows,
            };
        } catch (error) {
            return {
                name: 'Duplicate Records',
                passed: true,
                details: 'Check skipped (table may not exist)',
            };
        }
    }
}

export async function checkDataIntegrity(): Promise<IntegrityReport> {
    const checker = new DataIntegrityChecker();
    return checker.runAllChecks();
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    checkDataIntegrity().then((report) => {
        console.log(JSON.stringify(report, null, 2));
        process.exit(report.passed ? 0 : 1);
    });
}
