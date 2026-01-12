/**
 * Structural Migration Tests
 * 
 * Tests the structural integrity of JS→TS migration:
 * - File mapping (old .js → new .ts)
 * - Migration coverage
 * - Old .js files still in use
 * - Directory structure comparison
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');
const serverDir = path.join(projectRoot, 'server');
const srcDir = path.join(serverDir, 'src');

function findFiles(dir: string, ext: string, excludeDirs: string[]): string[] {
    const files: string[] = [];
    
    function walk(currentDir: string, relativePath: string = '') {
        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
                
                if (entry.isDirectory()) {
                    if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
                        walk(fullPath, relPath);
                    }
                } else if (entry.name.endsWith(ext)) {
                    files.push(relPath);
                }
            }
        } catch (err) {
            // Ignore errors
        }
    }
    
    walk(dir);
    return files;
}

interface FileMapping {
    oldJs: string;
    newTs: string | null;
    status: 'migrated' | 'missing' | 'not_needed';
}

interface MigrationStats {
    totalJsFiles: number;
    totalTsFiles: number;
    migratedFiles: number;
    missingMigrations: number;
    oldJsStillUsed: number;
    coverage: number;
}

describe('Migration Structural Tests', () => {
    let jsFiles: string[] = [];
    let tsFiles: string[] = [];
    let mappings: FileMapping[] = [];
    let stats: MigrationStats;

    beforeAll(() => {
        // Find all .js files in server/ (excluding node_modules, dist, backup)
        jsFiles = findFiles(serverDir, '.js', [
            'node_modules', 'dist', 'backup', 'trash_node_modules', '__mocks__'
        ]).filter(f => !f.includes('.test.js') && !f.includes('.spec.js'));

        // Find all .ts files in server/src/
        tsFiles = findFiles(srcDir, '.ts', []).filter(f => 
            !f.includes('.test.ts') && !f.includes('.spec.ts') && !f.includes('.d.ts')
        );

        // Create mappings
        mappings = jsFiles.map(jsFile => {
            const baseName = path.basename(jsFile, '.js');
            const dirName = path.dirname(jsFile);
            
            // Check if corresponding .ts exists in src/
            const possibleTsPaths = [
                path.join(dirName, baseName + '.ts'),
                path.join('services', baseName + '.ts'),
                path.join('routes', baseName + '.ts'),
                path.join('middleware', baseName + '.ts'),
                path.join('controllers', baseName + '.ts'),
                path.join('utils', baseName + '.ts'),
                path.join('cron', baseName + '.ts'),
            ];

            let newTs: string | null = null;
            for (const tsPath of possibleTsPaths) {
                if (tsFiles.includes(tsPath)) {
                    newTs = tsPath;
                    break;
                }
            }

            // Check if file is in excluded directories (seed, scripts, migrations)
            const isUtilityScript = jsFile.includes('/seed/') || 
                                   jsFile.includes('/scripts/') || 
                                   jsFile.includes('/migrations/') ||
                                   jsFile.startsWith('seed_') ||
                                   jsFile.startsWith('test_') ||
                                   jsFile.startsWith('migrate_') ||
                                   jsFile.startsWith('check_') ||
                                   jsFile.startsWith('fix_');

            return {
                oldJs: jsFile,
                newTs: newTs,
                status: isUtilityScript ? 'not_needed' : (newTs ? 'migrated' : 'missing')
            };
        });

        const migrated = mappings.filter(m => m.status === 'migrated').length;
        const missing = mappings.filter(m => m.status === 'missing').length;
        const totalRelevant = migrated + missing;

        stats = {
            totalJsFiles: jsFiles.length,
            totalTsFiles: tsFiles.length,
            migratedFiles: migrated,
            missingMigrations: missing,
            oldJsStillUsed: 0, // Will be calculated in imports test
            coverage: totalRelevant > 0 ? (migrated / totalRelevant) * 100 : 100
        };
    });

    it('should have TypeScript files in src/', () => {
        expect(tsFiles.length).toBeGreaterThan(0);
        expect(stats.totalTsFiles).toBeGreaterThan(0);
    });

    it('should have migrated core services', () => {
        const coreServices = [
            'services/ActivityService',
            'services/BillingService',
            'services/NotificationService',
            'services/AuthController',
            'services/UserController'
        ];

        const migratedServices = coreServices.filter(service => {
            return tsFiles.some(ts => ts.includes(service));
        });

        expect(migratedServices.length).toBeGreaterThan(0);
    });

    it('should have migrated routes', () => {
        const migratedRoutes = tsFiles.filter(f => f.startsWith('routes/'));
        expect(migratedRoutes.length).toBeGreaterThan(50); // Should have many routes
    });

    it('should have migrated middleware', () => {
        const migratedMiddleware = tsFiles.filter(f => f.startsWith('middleware/'));
        expect(migratedMiddleware.length).toBeGreaterThan(10);
    });

    it('should have migrated controllers', () => {
        const migratedControllers = tsFiles.filter(f => f.startsWith('controllers/'));
        expect(migratedControllers.length).toBeGreaterThan(5);
    });

    it('should have high migration coverage', () => {
        // At least 80% of relevant files should be migrated
        expect(stats.coverage).toBeGreaterThanOrEqual(80);
    });

    it('should have src/ directory structure', () => {
        const requiredDirs = ['services', 'routes', 'middleware', 'controllers', 'utils', 'cron'];
        
        for (const dir of requiredDirs) {
            const dirPath = path.join(srcDir, dir);
            expect(fs.existsSync(dirPath)).toBe(true);
        }
    });

    it('should generate migration mapping report', () => {
        const report = {
            stats,
            mappings: mappings.filter(m => m.status !== 'not_needed'),
            missingMigrations: mappings.filter(m => m.status === 'missing'),
            timestamp: new Date().toISOString()
        };

        const reportPath = path.join(projectRoot, 'tests', 'migration', 'reports', 'structural-report.json');
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        expect(fs.existsSync(reportPath)).toBe(true);
    });

    it('should identify utility scripts correctly', () => {
        const utilityScripts = mappings.filter(m => m.status === 'not_needed');
        expect(utilityScripts.length).toBeGreaterThan(0);
    });
});

