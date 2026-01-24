/**
 * SEED: DBR77 Final Data Completion
 * 
 * Adds missing data for:
 * - Rapid Lean Assessments (Lean 4.0)
 * - ADKAR Assessments (Change Management)
 * - Project KPIs with historical values
 * - Initiative KPIs linked to initiatives
 * - KPI Measurements with trend data
 * 
 * Run: node server/seed/seed_dbr77_final_completion.js
 */

import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'consultinity.db');
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const ORG_ID = 'org-dbr77-system';
const USER_ID = 'user-dbr77-admin';

// ============================================
// RAPID LEAN ASSESSMENTS (Lean 4.0)
// ============================================
const rapidLeanAssessments = [
    {
        id: 'rla-dbr77-01',
        project_id: 'project-dbr77-opex',
        value_stream_score: 3.8,
        waste_elimination_score: 3.2,
        flow_pull_score: 2.9,
        quality_source_score: 3.5,
        continuous_improvement_score: 3.4,
        visual_management_score: 3.0,
        overall_score: 3.30,
        industry_benchmark: 3.5,
        ai_recommendations: JSON.stringify([
            'Focus on implementing pull systems to improve flow',
            'Strengthen visual management with digital dashboards',
            'Increase kaizen event frequency to monthly cycles'
        ]),
        top_gaps: JSON.stringify([
            { area: 'Flow & Pull', gap: 0.6, priority: 'HIGH' },
            { area: 'Visual Management', gap: 0.5, priority: 'MEDIUM' },
            { area: 'Waste Elimination', gap: 0.3, priority: 'MEDIUM' }
        ])
    },
    {
        id: 'rla-dbr77-02',
        project_id: 'project-dbr77-smart',
        value_stream_score: 3.5,
        waste_elimination_score: 3.0,
        flow_pull_score: 2.8,
        quality_source_score: 3.8,
        continuous_improvement_score: 3.2,
        visual_management_score: 3.6,
        overall_score: 3.32,
        industry_benchmark: 3.5,
        ai_recommendations: JSON.stringify([
            'Integrate IoT sensors with Lean metrics dashboards',
            'Implement real-time flow monitoring for bottleneck detection',
            'Deploy AI-assisted quality inspection at source'
        ]),
        top_gaps: JSON.stringify([
            { area: 'Flow & Pull', gap: 0.7, priority: 'HIGH' },
            { area: 'Waste Elimination', gap: 0.5, priority: 'MEDIUM' }
        ])
    },
    {
        id: 'rla-dbr77-03',
        project_id: 'project-dbr77-dt2025',
        value_stream_score: 4.0,
        waste_elimination_score: 3.8,
        flow_pull_score: 3.5,
        quality_source_score: 4.0,
        continuous_improvement_score: 3.9,
        visual_management_score: 4.2,
        overall_score: 3.90,
        industry_benchmark: 3.5,
        ai_recommendations: JSON.stringify([
            'Share best practices from DT2025 across other projects',
            'Implement predictive analytics for continuous improvement',
            'Expand visual management to external stakeholders'
        ]),
        top_gaps: JSON.stringify([
            { area: 'Flow & Pull', gap: 0.2, priority: 'LOW' }
        ])
    }
];

// ============================================
// ADKAR ASSESSMENTS (Change Management)
// ============================================
const adkarAssessments = [
    {
        id: 'adkar-dbr77-01',
        project_id: 'project-dbr77-dt2025',
        awareness_score: 4.2,
        desire_score: 3.8,
        knowledge_score: 3.5,
        ability_score: 3.2,
        reinforcement_score: 3.0,
        overall_score: 3.54,
        ai_recommendations: JSON.stringify([
            'Increase hands-on training sessions to improve ability scores',
            'Implement recognition program for change champions',
            'Create reinforcement mechanisms through performance reviews'
        ]),
        questionnaire_responses: JSON.stringify({
            completedBy: 85,
            departments: ['IT', 'Operations', 'Finance', 'HR', 'Sales'],
            avgCompletionTime: '12 minutes'
        })
    },
    {
        id: 'adkar-dbr77-02',
        project_id: 'project-dbr77-cx',
        awareness_score: 3.9,
        desire_score: 4.0,
        knowledge_score: 3.6,
        ability_score: 3.0,
        reinforcement_score: 2.8,
        overall_score: 3.46,
        ai_recommendations: JSON.stringify([
            'Focus on skill development for new CRM tools',
            'Create peer mentoring program for customer-facing staff',
            'Develop reinforcement metrics tied to customer satisfaction'
        ]),
        questionnaire_responses: JSON.stringify({
            completedBy: 72,
            departments: ['Sales', 'Customer Service', 'Marketing'],
            avgCompletionTime: '10 minutes'
        })
    },
    {
        id: 'adkar-dbr77-03',
        project_id: 'project-dbr77-smart',
        awareness_score: 3.5,
        desire_score: 3.2,
        knowledge_score: 2.8,
        ability_score: 2.5,
        reinforcement_score: 2.2,
        overall_score: 2.84,
        ai_recommendations: JSON.stringify([
            'Launch comprehensive Industry 4.0 awareness campaign',
            'Address resistance through involvement in pilot selection',
            'Develop specialized technical training curriculum',
            'Create early wins showcase to build momentum'
        ]),
        questionnaire_responses: JSON.stringify({
            completedBy: 45,
            departments: ['Production', 'Maintenance', 'Quality'],
            avgCompletionTime: '15 minutes'
        })
    }
];

// ============================================
// PROJECT KPIs with historical values
// ============================================
const projectKPIs = [
    // Digital Transformation 2025
    { project_id: 'project-dbr77-dt2025', name: 'Process Automation Rate', category: 'Operational', target_value: 60, current_value: 42, baseline_value: 15, unit: '%', trend: 'IMPROVING' },
    { project_id: 'project-dbr77-dt2025', name: 'Cloud Migration Progress', category: 'Technology', target_value: 80, current_value: 55, baseline_value: 0, unit: '%', trend: 'IMPROVING' },
    { project_id: 'project-dbr77-dt2025', name: 'Cost Savings Realized', category: 'Financial', target_value: 2000000, current_value: 850000, baseline_value: 0, unit: 'EUR', trend: 'IMPROVING' },
    { project_id: 'project-dbr77-dt2025', name: 'Digital Skills Index', category: 'People', target_value: 4.0, current_value: 3.2, baseline_value: 2.5, unit: 'points', trend: 'STABLE' },

    // Customer Experience
    { project_id: 'project-dbr77-cx', name: 'Net Promoter Score', category: 'Customer', target_value: 50, current_value: 32, baseline_value: 18, unit: 'points', trend: 'IMPROVING' },
    { project_id: 'project-dbr77-cx', name: 'First Contact Resolution', category: 'Customer', target_value: 85, current_value: 68, baseline_value: 55, unit: '%', trend: 'IMPROVING' },
    { project_id: 'project-dbr77-cx', name: 'Digital Channel Adoption', category: 'Customer', target_value: 70, current_value: 48, baseline_value: 25, unit: '%', trend: 'IMPROVING' },
    { project_id: 'project-dbr77-cx', name: 'Customer Effort Score', category: 'Customer', target_value: 2.0, current_value: 3.2, baseline_value: 4.5, unit: 'points', trend: 'IMPROVING' },

    // Operational Excellence
    { project_id: 'project-dbr77-opex', name: 'Cycle Time Reduction', category: 'Operational', target_value: 40, current_value: 18, baseline_value: 0, unit: '%', trend: 'STABLE' },
    { project_id: 'project-dbr77-opex', name: 'First Time Right Rate', category: 'Operational', target_value: 95, current_value: 82, baseline_value: 75, unit: '%', trend: 'IMPROVING' },
    { project_id: 'project-dbr77-opex', name: 'Waste Reduction', category: 'Operational', target_value: 30, current_value: 12, baseline_value: 0, unit: '%', trend: 'STABLE' },

    // Smart Factory
    { project_id: 'project-dbr77-smart', name: 'IoT Sensor Deployment', category: 'Technology', target_value: 2000, current_value: 450, baseline_value: 0, unit: 'sensors', trend: 'IMPROVING' },
    { project_id: 'project-dbr77-smart', name: 'Equipment Uptime', category: 'Operational', target_value: 95, current_value: 88, baseline_value: 82, unit: '%', trend: 'IMPROVING' },
    { project_id: 'project-dbr77-smart', name: 'Predictive Maintenance Accuracy', category: 'Technology', target_value: 90, current_value: 0, baseline_value: 0, unit: '%', trend: 'STABLE' }
];

// ============================================
// INITIATIVE KPIs
// ============================================
const initiativeKPIs = [
    { name: 'Bot Deployment Count', target_value: 50, unit: 'bots', is_primary: 1 },
    { name: 'Automation Savings', target_value: 450000, unit: 'EUR', is_primary: 1 },
    { name: 'Process Error Rate', target_value: 0.5, unit: '%', is_primary: 0 },
    { name: 'User Adoption Rate', target_value: 90, unit: '%', is_primary: 0 },
    { name: 'Workload Migration', target_value: 80, unit: '%', is_primary: 1 },
    { name: 'Infrastructure Cost Reduction', target_value: 35, unit: '%', is_primary: 0 },
    { name: 'Deployment Frequency', target_value: 10, unit: 'per week', is_primary: 0 },
    { name: 'Chatbot Deflection Rate', target_value: 70, unit: '%', is_primary: 1 },
    { name: 'Query Resolution Time', target_value: 30, unit: 'seconds', is_primary: 0 },
    { name: 'Customer Satisfaction', target_value: 4.5, unit: 'rating', is_primary: 0 }
];

// ============================================
// SEED EXECUTION
// ============================================
async function seed() {
    console.log('🚀 Starting DBR77 Final Completion Seed...\n');

    try {
        // 1. Rapid Lean Assessments
        console.log('🔷 Inserting Rapid Lean Assessments...');
        for (const a of rapidLeanAssessments) {
            await run(`
                INSERT OR REPLACE INTO rapid_lean_assessments (
                    id, organization_id, project_id, assessment_date,
                    value_stream_score, waste_elimination_score, flow_pull_score,
                    quality_source_score, continuous_improvement_score, visual_management_score,
                    overall_score, industry_benchmark, ai_recommendations, top_gaps,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [
                a.id, ORG_ID, a.project_id,
                a.value_stream_score, a.waste_elimination_score, a.flow_pull_score,
                a.quality_source_score, a.continuous_improvement_score, a.visual_management_score,
                a.overall_score, a.industry_benchmark, a.ai_recommendations, a.top_gaps,
                USER_ID
            ]);
        }
        console.log(`   ✅ ${rapidLeanAssessments.length} Rapid Lean assessments`);

        // 2. ADKAR Assessments
        console.log('🟣 Inserting ADKAR Assessments...');
        for (const a of adkarAssessments) {
            await run(`
                INSERT OR REPLACE INTO adkar_assessments (
                    id, organization_id, project_id, assessment_date,
                    awareness_score, desire_score, knowledge_score, ability_score, reinforcement_score,
                    overall_score, ai_recommendations, questionnaire_responses,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [
                a.id, ORG_ID, a.project_id,
                a.awareness_score, a.desire_score, a.knowledge_score, a.ability_score, a.reinforcement_score,
                a.overall_score, a.ai_recommendations, a.questionnaire_responses,
                USER_ID
            ]);
        }
        console.log(`   ✅ ${adkarAssessments.length} ADKAR assessments`);

        // 3. Project KPIs
        console.log('📊 Inserting Project KPIs...');
        for (const k of projectKPIs) {
            const historicalValues = [];
            const baseValue = k.baseline_value;
            const currentValue = k.current_value;
            const months = 6;

            for (let i = 0; i < months; i++) {
                const progress = i / months;
                const value = baseValue + (currentValue - baseValue) * progress;
                const date = new Date();
                date.setMonth(date.getMonth() - (months - i));
                historicalValues.push({
                    date: date.toISOString().split('T')[0],
                    value: Math.round(value * 100) / 100
                });
            }

            await run(`
                INSERT OR REPLACE INTO project_kpis (
                    id, project_id, name, category, target_value, current_value, baseline_value,
                    unit, trend, historical_values, green_threshold, amber_threshold, owner_id,
                    status, created_at, last_updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now'), datetime('now'))
            `, [
                uuidv4(), k.project_id, k.name, k.category, k.target_value, k.current_value, k.baseline_value,
                k.unit, k.trend, JSON.stringify(historicalValues), k.target_value * 0.9, k.target_value * 0.7, USER_ID
            ]);
        }
        console.log(`   ✅ ${projectKPIs.length} Project KPIs with historical data`);

        // 4. Initiative KPIs - link to actual initiatives
        console.log('🎯 Inserting Initiative KPIs...');
        const initiatives = await all(`SELECT id FROM initiatives WHERE organization_id = ? LIMIT 10`, [ORG_ID]);

        let initiativeKPICount = 0;
        for (let i = 0; i < Math.min(initiatives.length, initiativeKPIs.length); i++) {
            const kpi = initiativeKPIs[i];
            const initiative = initiatives[i];

            await run(`
                INSERT OR REPLACE INTO initiative_kpis (
                    id, initiative_id, name, description, target_value, unit,
                    measurement_frequency, is_primary, sort_order, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'MONTHLY', ?, ?, datetime('now'), datetime('now'))
            `, [
                uuidv4(), initiative.id, kpi.name, `KPI tracking for ${kpi.name}`,
                kpi.target_value, kpi.unit, kpi.is_primary, i
            ]);
            initiativeKPICount++;
        }
        console.log(`   ✅ ${initiativeKPICount} Initiative KPIs`);

        // 5. KPI Measurements - add historical measurements
        console.log('📈 Inserting KPI Measurements...');
        const kpiDefs = await all(`SELECT id, name, code, default_target FROM kpi_definitions WHERE organization_id = ?`, [ORG_ID]);

        let measurementCount = 0;
        for (const kpi of kpiDefs) {
            // Add measurements for last 6 months
            for (let month = 5; month >= 0; month--) {
                const date = new Date();
                date.setMonth(date.getMonth() - month);

                // Generate realistic value trend
                const targetValue = kpi.default_target || 100;
                const progress = (6 - month) / 6;
                const baseValue = targetValue * 0.5;
                const currentValue = baseValue + (targetValue - baseValue) * progress * (0.8 + Math.random() * 0.4);

                await run(`
                    INSERT INTO kpi_measurements (
                        id, kpi_id, value, measured_at, notes, created_by, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                `, [
                    uuidv4(), kpi.id, Math.round(currentValue * 100) / 100,
                    date.toISOString(), `Monthly measurement for ${kpi.name}`, USER_ID
                ]);
                measurementCount++;
            }
        }
        console.log(`   ✅ ${measurementCount} KPI Measurements (${kpiDefs.length} KPIs × 6 months)`);

        console.log('\n✨ DBR77 Final Completion Seed finished successfully!');
        console.log('\n📈 Summary:');
        console.log(`   - Rapid Lean Assessments: ${rapidLeanAssessments.length}`);
        console.log(`   - ADKAR Assessments: ${adkarAssessments.length}`);
        console.log(`   - Project KPIs: ${projectKPIs.length}`);
        console.log(`   - Initiative KPIs: ${initiativeKPICount}`);
        console.log(`   - KPI Measurements: ${measurementCount}`);

    } catch (error) {
        console.error('❌ Error during seed:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

seed();
