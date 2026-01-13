#!/usr/bin/env ts-node
/**
 * TechnoLex Demo Data Seeder
 * Seeds the complete multilingual demo dataset for TechnoLex Industries
 * 
 * Usage:
 *   npx ts-node server/seeds/demo/technolex/seed-demo.ts
 *   npm run seed:demo
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SeedContext {
    organizationId: string;
    projectId: string;
    userIds: Map<string, string>;
    initiativeIds: Map<string, string>;
    taskIds: Map<string, string>;
}

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};

const log = {
    info: (msg: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
    success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    step: (msg: string) => console.log(`${colors.dim}  → ${msg}${colors.reset}`),
};

async function loadJsonFile<T>(filename: string): Promise<T> {
    const filePath = path.join(__dirname, 'base', filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
}

async function loadTranslations(locale: string): Promise<any> {
    const filePath = path.join(__dirname, 'translations', `${locale}.json`);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
}

class TechnoLexSeeder {
    private db: any;
    private context: SeedContext;

    constructor(database: any) {
        this.db = database;
        this.context = {
            organizationId: '',
            projectId: '',
            userIds: new Map(),
            initiativeIds: new Map(),
            taskIds: new Map(),
        };
    }

    async seed(): Promise<void> {
        console.log('\n🏭 TechnoLex Industries Demo Data Seeder\n');

        try {
            // Phase 1: Organization and Project
            await this.seedOrganization();

            // Phase 2: Users
            await this.seedUsers();

            // Phase 3: Initiatives and Tasks
            await this.seedInitiatives();

            // Phase 4: Assessments
            await this.seedAssessments();

            // Phase 5: Roadmap
            await this.seedRoadmap();

            // Phase 6: Translations
            await this.seedTranslations();

            console.log('\n✅ TechnoLex demo data seeded successfully!\n');
        } catch (error: any) {
            console.error('❌ Seeding failed:', error.message);
            throw error;
        }
    }

    private async seedOrganization(): Promise<void> {
        log.info('Seeding organization...');

        const orgData = await loadJsonFile<any>('organization.json');
        const org = orgData.organization;
        const project = orgData.project;

        const orgId = uuidv4();
        this.context.organizationId = orgId;

        // Insert organization
        await this.db.run(`
      INSERT INTO organizations (id, name, slug, industry, size, website, headquarters, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [orgId, org.name, org.slug, org.industry, org.size, org.website, org.headquarters]);

        log.step(`Created organization: ${org.name}`);

        // Insert project
        const projectId = uuidv4();
        this.context.projectId = projectId;

        await this.db.run(`
      INSERT INTO projects (id, name, code, description, organization_id, status, current_phase, start_date, target_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [projectId, project.name, project.code, project.description, orgId, project.status, project.current_phase, project.start_date, project.target_date]);

        log.step(`Created project: ${project.name}`);

        // Seed challenges
        for (const challenge of orgData.challenges) {
            await this.db.run(`
        INSERT INTO organization_challenges (id, organization_id, title, description, impact, category, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [uuidv4(), orgId, challenge.title, challenge.description, challenge.impact, challenge.category]);
        }
        log.step(`Created ${orgData.challenges.length} challenges`);

        // Seed goals
        for (const goal of orgData.goals) {
            await this.db.run(`
        INSERT INTO organization_goals (id, organization_id, title, description, target_date, priority, kpi, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [uuidv4(), orgId, goal.title, goal.description, goal.target_date, goal.priority, goal.kpi]);
        }
        log.step(`Created ${orgData.goals.length} goals`);

        log.success('Organization seeded');
    }

    private async seedUsers(): Promise<void> {
        log.info('Seeding users...');

        const userData = await loadJsonFile<any>('users.json');

        for (const user of userData.users) {
            const userId = uuidv4();
            this.context.userIds.set(user.id, userId);

            await this.db.run(`
        INSERT INTO users (id, email, first_name, last_name, role, job_title, department, organization_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [userId, user.email, user.first_name, user.last_name, user.role, user.job_title, user.department, this.context.organizationId]);

            log.step(`Created user: ${user.first_name} ${user.last_name} (${user.job_title})`);
        }

        log.success(`Seeded ${userData.users.length} users`);
    }

    private async seedInitiatives(): Promise<void> {
        log.info('Seeding initiatives...');

        const initData = await loadJsonFile<any>('initiatives.json');
        let taskCount = 0;

        for (const init of initData.initiatives) {
            const initId = uuidv4();
            this.context.initiativeIds.set(init.id, initId);

            const ownerId = this.context.userIds.get(init.owner_id) || null;
            const sponsorId = this.context.userIds.get(init.sponsor_id) || null;

            await this.db.run(`
        INSERT INTO initiatives (id, name, summary, description, status, priority, progress, owner_id, sponsor_id, project_id, start_date, target_date, budget, budget_spent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [initId, init.name, init.summary, init.description, init.status, init.priority, init.progress, ownerId, sponsorId, this.context.projectId, init.start_date, init.target_date, init.budget, init.budget_spent]);

            log.step(`Created initiative: ${init.name}`);

            // Seed tasks
            for (const task of init.tasks || []) {
                const taskId = uuidv4();
                this.context.taskIds.set(task.id, taskId);

                const assigneeId = this.context.userIds.get(task.assignee_id) || null;

                await this.db.run(`
          INSERT INTO tasks (id, title, description, status, priority, initiative_id, assignee_id, due_date, effort_hours, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [taskId, task.title, task.description, task.status, task.priority, initId, assigneeId, task.due_date, task.effort_hours]);

                taskCount++;
            }
        }

        log.success(`Seeded ${initData.initiatives.length} initiatives with ${taskCount} tasks`);
    }

    private async seedAssessments(): Promise<void> {
        log.info('Seeding assessments...');

        const assessData = await loadJsonFile<any>('assessments.json');

        for (const assessment of assessData.assessments) {
            const assessId = uuidv4();
            const assessorId = this.context.userIds.get(assessment.assessor_id) || null;

            await this.db.run(`
        INSERT INTO assessments (id, project_id, framework, overall_score, target_score, assessor_id, assessment_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [assessId, this.context.projectId, assessment.framework, assessment.overall_score, assessment.target_score, assessorId, assessment.assessment_date]);

            for (const axis of assessment.axes) {
                await this.db.run(`
          INSERT INTO assessment_axes (id, assessment_id, name, description, actual_score, target_score, weight, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [uuidv4(), assessId, axis.name, axis.description, axis.actual_score, axis.target_score, axis.weight]);
            }

            log.step(`Created ${assessment.framework} assessment with ${assessment.axes.length} axes`);
        }

        log.success('Assessments seeded');
    }

    private async seedRoadmap(): Promise<void> {
        log.info('Seeding roadmap...');

        const roadmapData = await loadJsonFile<any>('roadmap.json');
        const roadmap = roadmapData.roadmap;

        // Seed phases
        for (const phase of roadmap.phases) {
            await this.db.run(`
        INSERT INTO roadmap_phases (id, project_id, name, description, start_date, end_date, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [uuidv4(), this.context.projectId, phase.name, phase.description, phase.start_date, phase.end_date, phase.status]);
        }
        log.step(`Created ${roadmap.phases.length} phases`);

        // Seed milestones
        for (const ms of roadmap.milestones) {
            await this.db.run(`
        INSERT INTO roadmap_milestones (id, project_id, name, description, date, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [uuidv4(), this.context.projectId, ms.name, ms.description, ms.date, ms.status]);
        }
        log.step(`Created ${roadmap.milestones.length} milestones`);

        log.success('Roadmap seeded');
    }

    private async seedTranslations(): Promise<void> {
        log.info('Seeding translations...');

        const locales = ['pl', 'de', 'es', 'ar', 'ja'];
        let translationCount = 0;

        for (const locale of locales) {
            const translations = await loadTranslations(locale);
            if (!translations) {
                log.warn(`No translations found for ${locale}`);
                continue;
            }

            // Seed initiative translations
            if (translations.translations?.initiatives) {
                for (const [initRef, trans] of Object.entries(translations.translations.initiatives) as any) {
                    const initId = this.context.initiativeIds.get(initRef);
                    if (!initId) continue;

                    for (const [field, value] of Object.entries(trans as Record<string, string>)) {
                        await this.db.run(`
              INSERT OR REPLACE INTO entity_translations (id, entity_type, entity_id, field_name, locale, translated_value, is_machine_translated, created_at)
              VALUES (?, 'initiative', ?, ?, ?, ?, 0, datetime('now'))
            `, [uuidv4(), initId, field, locale, value]);
                        translationCount++;
                    }
                }
            }

            // Seed task translations
            if (translations.translations?.tasks) {
                for (const [taskRef, trans] of Object.entries(translations.translations.tasks) as any) {
                    const taskId = this.context.taskIds.get(taskRef);
                    if (!taskId) continue;

                    for (const [field, value] of Object.entries(trans as Record<string, string>)) {
                        await this.db.run(`
              INSERT OR REPLACE INTO entity_translations (id, entity_type, entity_id, field_name, locale, translated_value, is_machine_translated, created_at)
              VALUES (?, 'task', ?, ?, ?, ?, 0, datetime('now'))
            `, [uuidv4(), taskId, field, locale, value]);
                        translationCount++;
                    }
                }
            }

            log.step(`Processed ${locale} translations`);
        }

        log.success(`Seeded ${translationCount} translations`);
    }
}

// Main execution
async function main() {
    // This would normally import the actual database connection
    // For now, we provide a mock/placeholder
    console.log('🚀 Starting TechnoLex demo seeder...');
    console.log('📁 Data files location:', __dirname);

    // Validate all JSON files
    const files = ['organization.json', 'users.json', 'initiatives.json', 'assessments.json', 'roadmap.json'];
    for (const file of files) {
        try {
            await loadJsonFile(file);
            console.log(`  ✓ ${file} validated`);
        } catch (error: any) {
            console.error(`  ✗ ${file} invalid: ${error.message}`);
            process.exit(1);
        }
    }

    console.log('\n📊 Demo data summary:');
    const org = await loadJsonFile<any>('organization.json');
    const users = await loadJsonFile<any>('users.json');
    const initiatives = await loadJsonFile<any>('initiatives.json');

    console.log(`  • Organization: ${org.organization.name}`);
    console.log(`  • Project: ${org.project.name}`);
    console.log(`  • Users: ${users.users.length}`);
    console.log(`  • Initiatives: ${initiatives.initiatives.length}`);
    console.log(`  • Tasks: ${initiatives.initiatives.reduce((sum: number, i: any) => sum + (i.tasks?.length || 0), 0)}`);
    console.log(`  • Challenges: ${org.challenges.length}`);
    console.log(`  • Goals: ${org.goals.length}`);
    console.log(`  • Megatrends: ${org.megatrends.length}`);

    console.log('\n✅ All data files validated. Ready for seeding.');
    console.log('   To seed database, import this module and call seeder.seed(db)');
}

export { TechnoLexSeeder };
export default main;

// Run if executed directly
main().catch(console.error);
