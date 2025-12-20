/**
 * Seed Demo Template
 * 
 * Run this script to insert the default demo template into the database.
 * Usage: node server/seed/seedDemoTemplate.js
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_DEMO_TEMPLATE = {
    id: 'demo-template-default',
    name: 'Digital Transformation Demo',
    description: 'Sample project showcasing the SCMS platform capabilities for digital transformation initiatives.',
    seed_data_json: JSON.stringify({
        project: {
            name: 'Digital Transformation Program',
            status: 'active',
            governance_model: 'STANDARD',
            current_phase: 'Roadmap'
        },
        initiatives: [
            {
                name: 'Process Automation Initiative',
                summary: 'Automate repetitive business processes to improve efficiency and reduce manual errors.',
                status: 'IN_PROGRESS',
                priority: 'HIGH',
                tasks: [
                    { title: 'Current State Analysis', description: 'Document existing processes and identify automation opportunities.', status: 'done', priority: 'high' },
                    { title: 'Technology Selection', description: 'Evaluate RPA and workflow automation tools.', status: 'done', priority: 'high' },
                    { title: 'Pilot Implementation', description: 'Implement automation in the finance department.', status: 'in_progress', priority: 'high' },
                    { title: 'User Training', description: 'Train staff on new automated workflows.', status: 'todo', priority: 'medium' },
                    { title: 'Full Rollout', description: 'Extend automation to all departments.', status: 'todo', priority: 'medium' }
                ]
            },
            {
                name: 'Data Analytics Platform',
                summary: 'Implement a modern data analytics platform for real-time business intelligence.',
                status: 'DRAFT',
                priority: 'MEDIUM',
                tasks: [
                    { title: 'Requirements Gathering', description: 'Collect analytics requirements from stakeholders.', status: 'in_progress', priority: 'high' },
                    { title: 'Data Architecture Design', description: 'Design the data warehouse and ETL pipelines.', status: 'todo', priority: 'high' },
                    { title: 'BI Tool Selection', description: 'Evaluate and select business intelligence tools.', status: 'todo', priority: 'medium' }
                ]
            },
            {
                name: 'Customer Experience Enhancement',
                summary: 'Improve customer-facing digital channels for better engagement and satisfaction.',
                status: 'DRAFT',
                priority: 'LOW',
                tasks: [
                    { title: 'Customer Journey Mapping', description: 'Map current customer journeys across all touchpoints.', status: 'todo', priority: 'high' },
                    { title: 'UX Research', description: 'Conduct user research to identify pain points.', status: 'todo', priority: 'medium' }
                ]
            }
        ]
    }),
    is_active: 1
};

const seedDemoTemplate = async () => {
    console.log('[SeedDemoTemplate] Starting demo template seeding...');

    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR REPLACE INTO demo_templates (id, name, description, seed_data_json, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [
                DEFAULT_DEMO_TEMPLATE.id,
                DEFAULT_DEMO_TEMPLATE.name,
                DEFAULT_DEMO_TEMPLATE.description,
                DEFAULT_DEMO_TEMPLATE.seed_data_json,
                DEFAULT_DEMO_TEMPLATE.is_active
            ],
            function (err) {
                if (err) {
                    console.error('[SeedDemoTemplate] Error:', err);
                    return reject(err);
                }
                console.log(`[SeedDemoTemplate] Demo template seeded successfully: ${DEFAULT_DEMO_TEMPLATE.name}`);
                resolve();
            }
        );
    });
};

// Run if called directly
if (require.main === module) {
    db.initPromise.then(() => {
        seedDemoTemplate()
            .then(() => {
                console.log('[SeedDemoTemplate] Done!');
                process.exit(0);
            })
            .catch((err) => {
                console.error('[SeedDemoTemplate] Failed:', err);
                process.exit(1);
            });
    });
}

module.exports = { seedDemoTemplate, DEFAULT_DEMO_TEMPLATE };
