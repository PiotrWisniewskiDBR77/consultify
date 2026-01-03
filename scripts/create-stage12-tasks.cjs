/**
 * Create Stage 12 Tasks Script
 * 
 * Creates initiative and tasks for ETAP 12: Finalizacja i Cleanup
 * from the TypeScript migration plan
 * 
 * Run with: node scripts/create-stage12-tasks.cjs
 */

const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'server', 'consultify.db');
console.log('Database path:', DB_PATH);
const db = new sqlite3.Database(DB_PATH);

// Helper for promises
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
    });
});

async function createStage12Tasks() {
    console.log('🚀 Creating Stage 12 Initiative and Tasks...\n');

    try {
        // Get first organization and user
        const org = await dbGet('SELECT id FROM organizations LIMIT 1');
        if (!org) {
            console.log('❌ No organizations found. Please create an organization first.');
            return;
        }
        const orgId = org.id;

        const user = await dbGet('SELECT id FROM users WHERE organization_id = ? LIMIT 1', [orgId]);
        if (!user) {
            console.log('❌ No users found for organization. Please create a user first.');
            return;
        }
        const userId = user.id;

        console.log(`📦 Using organization: ${orgId}`);
        console.log(`👤 Using user: ${userId}\n`);

        // Find or create a project for TypeScript migration
        let project = await dbGet(
            'SELECT id FROM projects WHERE organization_id = ? AND (name LIKE ? OR name LIKE ?) LIMIT 1',
            [orgId, '%TypeScript%', '%Migration%']
        );

        if (!project) {
            // Try to get any project
            project = await dbGet('SELECT id FROM projects WHERE organization_id = ? LIMIT 1', [orgId]);
            
            if (!project) {
                // Create a new project
                const projectId = uuidv4();
                const now = new Date().toISOString();
                await dbRun(
                    `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [projectId, orgId, 'Backend TypeScript Migration', 'active', userId, now]
                );
                project = { id: projectId };
                console.log(`✅ Created new project: ${projectId}`);
            } else {
                console.log(`✅ Using existing project: ${project.id}`);
            }
        } else {
            console.log(`✅ Found TypeScript migration project: ${project.id}`);
        }

        const projectId = project.id;
        const now = new Date().toISOString();

        // Create Initiative for Stage 12
        const initiativeId = uuidv4();
        await dbRun(
            `INSERT INTO initiatives (
                id, organization_id, project_id, title, summary, status,
                axis, business_value, confidence_level,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                initiativeId,
                orgId,
                projectId,
                'ETAP 12: Finalizacja i Cleanup',
                'Kompletny plan finalizacji migracji TypeScript backendu oraz budowy systemu testów osiągającego 95% pokrycia i 98% przechodzących testów. Plan obejmuje dokończenie migracji wszystkich pozostałych komponentów, utworzenie kompleksowych testów oraz optymalizację jakości kodu.',
                'planning',
                'transformational',
                'High',
                'high',
                now,
                now
            ]
        );
        console.log(`✅ Created initiative: ${initiativeId}\n`);

        // Define Stage 12 tasks
        const stage12Tasks = [
            {
                title: 'ETAP 12.1: Weryfikacja kompletności migracji',
                description: `Sprawdzenie czy wszystkie pliki JS zostały zmigrowane:
- Weryfikacja czy wszystkie routes działają
- Weryfikacja czy wszystkie services działają
- Weryfikacja czy wszystkie cron jobs działają
- Weryfikacja czy entry point działa poprawnie
- Raport weryfikacji kompletności
- Lista pozostałych plików JS (jeśli jakieś)`,
                priority: 'high',
                status: 'todo'
            },
            {
                title: 'ETAP 12.2: Usunięcie backward compatibility',
                description: `Przejście na pełny ES modules:
- Usunięcie CommonJS require() z TypeScript files
- Usunięcie createRequire() helpers
- Aktualizacja wszystkich imports do ES modules
- Weryfikacja że wszystko działa
- Usunięcie starych plików JS (po weryfikacji)`,
                priority: 'high',
                status: 'todo'
            },
            {
                title: 'ETAP 12.3: Optymalizacja build i performance',
                description: `Poprawa czasu build i wydajności:
- Optymalizacja tsconfig.json
- Optymalizacja build process
- Optymalizacja bundle size
- Weryfikacja build time
- Performance testing`,
                priority: 'medium',
                status: 'todo'
            },
            {
                title: 'ETAP 12.4: Dokumentacja finalna',
                description: `Aktualizacja wszystkich dokumentów:
- Aktualizacja README.md
- Aktualizacja dokumentacji API
- Aktualizacja dokumentacji deployment
- Utworzenie migration guide
- Utworzenie testing guide`,
                priority: 'medium',
                status: 'todo'
            },
            {
                title: 'ETAP 12.5: Production deployment i monitoring',
                description: `Wdrożenie na produkcję z monitoringiem:
- Testy na środowisku staging
- Weryfikacja performance
- Weryfikacja bezpieczeństwa
- Deployment na production
- Monitoring i alerting
- Rollback plan (jeśli potrzebny)`,
                priority: 'high',
                status: 'todo'
            }
        ];

        // Create tasks
        console.log('📋 Creating tasks...\n');
        for (const taskData of stage12Tasks) {
            const taskId = uuidv4();
            await dbRun(
                `INSERT INTO tasks (
                    id, project_id, organization_id, initiative_id, title, description,
                    status, priority, reporter_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    taskId,
                    projectId,
                    orgId,
                    initiativeId,
                    taskData.title,
                    taskData.description,
                    taskData.status,
                    taskData.priority,
                    userId,
                    now,
                    now
                ]
            );
            console.log(`  ✅ Created task: ${taskData.title}`);
        }

        console.log(`\n✅ Successfully created initiative and ${stage12Tasks.length} tasks!`);
        console.log(`\n📊 Summary:`);
        console.log(`   Initiative ID: ${initiativeId}`);
        console.log(`   Project ID: ${projectId}`);
        console.log(`   Tasks created: ${stage12Tasks.length}`);

        // Update plan document
        const planPath = '/Users/piotrwisniewski/.cursor/plans/backend_typescript_migration_-_finalizacja_i_system_testów_95%_6cf370fd.plan.md';
        if (fs.existsSync(planPath)) {
            console.log(`\n📝 Updating plan document...`);
            let planContent = fs.readFileSync(planPath, 'utf8');
            
            // Mark Stage 12 tasks as completed
            const stage12Ids = [
                'stage12-verification',
                'stage12-cleanup',
                'stage12-optimization',
                'stage12-documentation',
                'stage12-deployment'
            ];

            stage12Ids.forEach(id => {
                planContent = planContent.replace(
                    new RegExp(`(id: ${id}[\\s\\S]*?status: )pending`, 'g'),
                    `$1completed`
                );
            });

            fs.writeFileSync(planPath, planContent, 'utf8');
            console.log(`✅ Plan document updated!`);
        } else {
            console.log(`⚠️  Plan document not found at: ${planPath}`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        db.close();
    }
}

// Run the script
createStage12Tasks()
    .then(() => {
        console.log('\n✨ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Failed:', error);
        process.exit(1);
    });



