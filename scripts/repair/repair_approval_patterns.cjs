/**
 * Auto-Repair: Approval Pattern Learning System
 * 
 * Repairs common issues with the HITL approval pattern system:
 * - Creates missing database table
 * - Fixes orphaned patterns (user/org deleted)
 * - Cleans up old unused patterns
 * - Rebuilds corrupted indexes
 * - Validates data integrity
 * 
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs');

// Track repairs
const repairs = {
    fixed: 0,
    warnings: 0,
    errors: 0,
    details: []
};

function recordRepair(type, description, success = true) {
    repairs.details.push({ type, description, success, timestamp: new Date().toISOString() });
    if (success) {
        repairs.fixed++;
        console.log(`✅ [${type}] ${description}`);
    } else {
        repairs.errors++;
        console.log(`❌ [${type}] ${description}`);
    }
}

function recordWarning(type, description) {
    repairs.warnings++;
    repairs.details.push({ type, description, warning: true, timestamp: new Date().toISOString() });
    console.log(`⚠️ [${type}] ${description}`);
}

// ============================================================================
// Repair Functions
// ============================================================================

async function repairDatabaseTable(db) {
    console.log('\n📦 Checking database table...\n');
    
    return new Promise((resolve) => {
        // Check if table exists
        db.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='ai_approval_patterns'`,
            async (err, row) => {
                if (err) {
                    recordRepair('TABLE', `Database error: ${err.message}`, false);
                    resolve();
                    return;
                }
                
                if (!row) {
                    // Create table
                    db.run(`CREATE TABLE IF NOT EXISTS ai_approval_patterns(
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        organization_id TEXT NOT NULL,
                        action_type TEXT NOT NULL,
                        action_signature TEXT NOT NULL,
                        payload_template TEXT,
                        decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
                        decision_count INTEGER DEFAULT 1,
                        last_decision_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        auto_apply INTEGER DEFAULT 0,
                        confidence_threshold REAL DEFAULT 0.9,
                        risk_level TEXT DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, action_type, action_signature)
                    )`, (createErr) => {
                        if (createErr) {
                            recordRepair('TABLE', `Failed to create table: ${createErr.message}`, false);
                        } else {
                            recordRepair('TABLE', 'Created ai_approval_patterns table');
                            
                            // Create indexes
                            db.run(`CREATE INDEX IF NOT EXISTS idx_approval_patterns_lookup ON ai_approval_patterns(user_id, action_type, action_signature)`);
                            db.run(`CREATE INDEX IF NOT EXISTS idx_approval_patterns_org ON ai_approval_patterns(organization_id)`);
                            db.run(`CREATE INDEX IF NOT EXISTS idx_approval_patterns_auto ON ai_approval_patterns(user_id, auto_apply, action_type)`, () => {
                                recordRepair('INDEXES', 'Created lookup indexes');
                            });
                        }
                        resolve();
                    });
                } else {
                    console.log('  ✓ Table ai_approval_patterns exists');
                    
                    // Verify indexes
                    db.all(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ai_approval_patterns'`, (idxErr, indexes) => {
                        if (indexes && indexes.length >= 3) {
                            console.log(`  ✓ ${indexes.length} indexes found`);
                        } else {
                            // Recreate missing indexes
                            db.run(`CREATE INDEX IF NOT EXISTS idx_approval_patterns_lookup ON ai_approval_patterns(user_id, action_type, action_signature)`);
                            db.run(`CREATE INDEX IF NOT EXISTS idx_approval_patterns_org ON ai_approval_patterns(organization_id)`);
                            db.run(`CREATE INDEX IF NOT EXISTS idx_approval_patterns_auto ON ai_approval_patterns(user_id, auto_apply, action_type)`, () => {
                                recordRepair('INDEXES', 'Recreated missing indexes');
                            });
                        }
                        resolve();
                    });
                }
            }
        );
    });
}

async function repairOrphanedPatterns(db) {
    console.log('\n🧹 Checking for orphaned patterns...\n');
    
    return new Promise((resolve) => {
        // Find patterns where user no longer exists
        db.all(
            `SELECT p.id, p.user_id 
             FROM ai_approval_patterns p 
             LEFT JOIN users u ON p.user_id = u.id 
             WHERE u.id IS NULL`,
            (err, orphanedByUser) => {
                if (err) {
                    recordRepair('ORPHANS', `Error checking user orphans: ${err.message}`, false);
                    resolve();
                    return;
                }
                
                if (orphanedByUser && orphanedByUser.length > 0) {
                    const ids = orphanedByUser.map(p => `'${p.id}'`).join(',');
                    db.run(`DELETE FROM ai_approval_patterns WHERE id IN (${ids})`, function(delErr) {
                        if (delErr) {
                            recordRepair('ORPHANS', `Failed to delete orphaned patterns: ${delErr.message}`, false);
                        } else {
                            recordRepair('ORPHANS', `Deleted ${this.changes} patterns with deleted users`);
                        }
                    });
                } else {
                    console.log('  ✓ No orphaned patterns by user');
                }
                
                // Find patterns where org no longer exists
                db.all(
                    `SELECT p.id, p.organization_id 
                     FROM ai_approval_patterns p 
                     LEFT JOIN organizations o ON p.organization_id = o.id 
                     WHERE o.id IS NULL`,
                    (orgErr, orphanedByOrg) => {
                        if (orgErr) {
                            recordRepair('ORPHANS', `Error checking org orphans: ${orgErr.message}`, false);
                            resolve();
                            return;
                        }
                        
                        if (orphanedByOrg && orphanedByOrg.length > 0) {
                            const ids = orphanedByOrg.map(p => `'${p.id}'`).join(',');
                            db.run(`DELETE FROM ai_approval_patterns WHERE id IN (${ids})`, function(delErr) {
                                if (delErr) {
                                    recordRepair('ORPHANS', `Failed to delete orphaned patterns: ${delErr.message}`, false);
                                } else {
                                    recordRepair('ORPHANS', `Deleted ${this.changes} patterns with deleted organizations`);
                                }
                                resolve();
                            });
                        } else {
                            console.log('  ✓ No orphaned patterns by organization');
                            resolve();
                        }
                    }
                );
            }
        );
    });
}

async function cleanupOldPatterns(db, daysOld = 180) {
    console.log(`\n🗓️ Cleaning up patterns older than ${daysOld} days (non-auto-apply only)...\n`);
    
    return new Promise((resolve) => {
        db.run(
            `DELETE FROM ai_approval_patterns 
             WHERE last_decision_at < datetime('now', '-' || ? || ' days')
             AND auto_apply = 0
             AND decision_count < 3`,
            [daysOld],
            function(err) {
                if (err) {
                    recordRepair('CLEANUP', `Error cleaning old patterns: ${err.message}`, false);
                } else if (this.changes > 0) {
                    recordRepair('CLEANUP', `Deleted ${this.changes} old, unused patterns`);
                } else {
                    console.log('  ✓ No old unused patterns to clean');
                }
                resolve();
            }
        );
    });
}

async function validateDataIntegrity(db) {
    console.log('\n🔍 Validating data integrity...\n');
    
    return new Promise((resolve) => {
        // Check for invalid decision values
        db.get(
            `SELECT COUNT(*) as count FROM ai_approval_patterns 
             WHERE decision NOT IN ('APPROVED', 'REJECTED')`,
            (err, result) => {
                if (err) {
                    recordRepair('INTEGRITY', `Error checking decision values: ${err.message}`, false);
                } else if (result.count > 0) {
                    db.run(
                        `UPDATE ai_approval_patterns SET decision = 'APPROVED' 
                         WHERE decision NOT IN ('APPROVED', 'REJECTED')`,
                        function(updateErr) {
                            if (updateErr) {
                                recordRepair('INTEGRITY', `Failed to fix invalid decisions: ${updateErr.message}`, false);
                            } else {
                                recordRepair('INTEGRITY', `Fixed ${this.changes} invalid decision values`);
                            }
                        }
                    );
                } else {
                    console.log('  ✓ All decision values valid');
                }
            }
        );
        
        // Check for invalid risk levels
        db.get(
            `SELECT COUNT(*) as count FROM ai_approval_patterns 
             WHERE risk_level NOT IN ('LOW', 'MEDIUM', 'HIGH')`,
            (err, result) => {
                if (err) {
                    recordRepair('INTEGRITY', `Error checking risk levels: ${err.message}`, false);
                } else if (result.count > 0) {
                    db.run(
                        `UPDATE ai_approval_patterns SET risk_level = 'LOW' 
                         WHERE risk_level NOT IN ('LOW', 'MEDIUM', 'HIGH')`,
                        function(updateErr) {
                            if (updateErr) {
                                recordRepair('INTEGRITY', `Failed to fix invalid risk levels: ${updateErr.message}`, false);
                            } else {
                                recordRepair('INTEGRITY', `Fixed ${this.changes} invalid risk level values`);
                            }
                        }
                    );
                } else {
                    console.log('  ✓ All risk level values valid');
                }
            }
        );
        
        // Check for negative decision counts
        db.get(
            `SELECT COUNT(*) as count FROM ai_approval_patterns WHERE decision_count < 1`,
            (err, result) => {
                if (err) {
                    recordRepair('INTEGRITY', `Error checking decision counts: ${err.message}`, false);
                } else if (result.count > 0) {
                    db.run(
                        `UPDATE ai_approval_patterns SET decision_count = 1 WHERE decision_count < 1`,
                        function(updateErr) {
                            if (updateErr) {
                                recordRepair('INTEGRITY', `Failed to fix decision counts: ${updateErr.message}`, false);
                            } else {
                                recordRepair('INTEGRITY', `Fixed ${this.changes} invalid decision counts`);
                            }
                        }
                    );
                } else {
                    console.log('  ✓ All decision counts valid');
                }
                
                resolve();
            }
        );
    });
}

async function generateStats(db) {
    console.log('\n📊 Pattern Statistics...\n');
    
    return new Promise((resolve) => {
        db.get(
            `SELECT 
                COUNT(*) as total_patterns,
                SUM(CASE WHEN auto_apply = 1 THEN 1 ELSE 0 END) as auto_enabled,
                SUM(decision_count) as total_decisions,
                SUM(CASE WHEN decision = 'APPROVED' THEN decision_count ELSE 0 END) as total_approvals,
                SUM(CASE WHEN decision = 'REJECTED' THEN decision_count ELSE 0 END) as total_rejections,
                COUNT(DISTINCT user_id) as unique_users
             FROM ai_approval_patterns`,
            (err, stats) => {
                if (err) {
                    console.log(`  Error getting stats: ${err.message}`);
                } else {
                    console.log(`  Total Patterns: ${stats.total_patterns || 0}`);
                    console.log(`  Auto-enabled: ${stats.auto_enabled || 0}`);
                    console.log(`  Total Decisions: ${stats.total_decisions || 0}`);
                    console.log(`  Approvals: ${stats.total_approvals || 0}`);
                    console.log(`  Rejections: ${stats.total_rejections || 0}`);
                    console.log(`  Unique Users: ${stats.unique_users || 0}`);
                }
                resolve();
            }
        );
    });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log('='.repeat(60));
    console.log('🔧 Auto-Repair: Approval Pattern Learning System');
    console.log('='.repeat(60));
    
    // Load database
    let db;
    try {
        db = require('../../server/database');
        
        // Wait for DB initialization
        if (db.initPromise) {
            await db.initPromise;
        }
        
        console.log('\n✓ Database connected');
    } catch (error) {
        console.error('Failed to connect to database:', error.message);
        process.exit(1);
    }
    
    // Run repairs
    await repairDatabaseTable(db);
    await repairOrphanedPatterns(db);
    await cleanupOldPatterns(db, 180);
    await validateDataIntegrity(db);
    await generateStats(db);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 Repair Summary');
    console.log('='.repeat(60));
    console.log(`✅ Fixed: ${repairs.fixed}`);
    console.log(`⚠️ Warnings: ${repairs.warnings}`);
    console.log(`❌ Errors: ${repairs.errors}`);
    
    if (repairs.details.length > 0) {
        console.log('\nDetails:');
        repairs.details.forEach(d => {
            const icon = d.warning ? '⚠️' : (d.success ? '✅' : '❌');
            console.log(`  ${icon} [${d.type}] ${d.description}`);
        });
    }
    
    // Save report
    const reportPath = path.join(__dirname, '../../reports/repair_approval_patterns_report.json');
    try {
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            repairs,
            summary: {
                fixed: repairs.fixed,
                warnings: repairs.warnings,
                errors: repairs.errors
            }
        }, null, 2));
        console.log(`\n📄 Report saved to: ${reportPath}`);
    } catch (err) {
        console.log(`\n⚠️ Could not save report: ${err.message}`);
    }
    
    // Exit
    setTimeout(() => {
        process.exit(repairs.errors > 0 ? 1 : 0);
    }, 1000);
}

main().catch(err => {
    console.error('Repair failed:', err);
    process.exit(1);
});











