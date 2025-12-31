/**
 * Portfolio Demo Seed
 * 
 * Creates comprehensive English test data for Portfolio & Roadmap module.
 * Includes initiatives across all statuses, roadmap waves, and dependencies.
 */

const db = require('../database');
const queryHelpers = require('../utils/queryHelpers');
const { v4: uuidv4 } = require('uuid');

// ============================================
// INITIATIVE DATA
// ============================================

const INITIATIVES = [
    // DRAFT status
    { 
        name: 'ERP System Modernization', 
        status: 'DRAFT', 
        priority: 'HIGH', 
        axis: 'processes', 
        budget: 750000,
        summary: 'Complete overhaul of legacy ERP system with cloud-native architecture and modern UX.',
        targetQuarter: 'Q2 2025'
    },
    { 
        name: 'Blockchain Supply Chain Pilot', 
        status: 'DRAFT', 
        priority: 'MEDIUM', 
        axis: 'processes', 
        budget: 280000,
        summary: 'Implement blockchain-based traceability for critical supply chain components.',
        targetQuarter: 'Q4 2025'
    },
    
    // PLANNING status
    { 
        name: 'Cloud Infrastructure Migration', 
        status: 'PLANNING', 
        priority: 'CRITICAL', 
        axis: 'processes', 
        budget: 1200000,
        summary: 'Migrate on-premise infrastructure to multi-cloud environment (AWS + Azure).',
        targetQuarter: 'Q1 2025',
        progress: 15
    },
    { 
        name: 'IoT Factory Floor Integration', 
        status: 'PLANNING', 
        priority: 'HIGH', 
        axis: 'digitalProducts', 
        budget: 450000,
        summary: 'Deploy 500+ sensors across production lines for real-time monitoring.',
        targetQuarter: 'Q2 2025',
        progress: 10
    },
    
    // REVIEW status
    { 
        name: 'Customer Data Platform', 
        status: 'REVIEW', 
        priority: 'HIGH', 
        axis: 'dataManagement', 
        budget: 450000,
        summary: 'Unified customer data platform for 360° view across all touchpoints.',
        targetQuarter: 'Q1 2025',
        progress: 25
    },
    { 
        name: 'Digital Product Catalog', 
        status: 'REVIEW', 
        priority: 'MEDIUM', 
        axis: 'digitalProducts', 
        budget: 180000,
        summary: 'Interactive 3D product catalog with AR visualization capabilities.',
        targetQuarter: 'Q2 2025',
        progress: 20
    },
    
    // APPROVED status
    { 
        name: 'AI-Powered Demand Forecasting', 
        status: 'APPROVED', 
        priority: 'HIGH', 
        axis: 'aiMaturity', 
        budget: 380000,
        summary: 'Machine learning model for demand prediction with 95%+ accuracy target.',
        targetQuarter: 'Q1 2025',
        progress: 35,
        expectedRoi: 2.8
    },
    { 
        name: 'Predictive Maintenance System', 
        status: 'APPROVED', 
        priority: 'CRITICAL', 
        axis: 'aiMaturity', 
        budget: 520000,
        summary: 'AI-based equipment failure prediction reducing downtime by 40%.',
        targetQuarter: 'Q1 2025',
        progress: 30,
        expectedRoi: 3.2
    },
    { 
        name: 'Automated Quality Control', 
        status: 'APPROVED', 
        priority: 'HIGH', 
        axis: 'processes', 
        budget: 290000,
        summary: 'Computer vision system for real-time quality inspection on production lines.',
        targetQuarter: 'Q2 2025',
        progress: 25,
        expectedRoi: 2.1
    },
    
    // EXECUTING status
    { 
        name: 'Digital Twin Manufacturing', 
        status: 'EXECUTING', 
        priority: 'MEDIUM', 
        axis: 'digitalProducts', 
        budget: 520000,
        summary: 'Virtual replica of production facility for simulation and optimization.',
        targetQuarter: 'Q1 2025',
        progress: 65,
        expectedRoi: 2.5
    },
    { 
        name: 'Zero Trust Security Implementation', 
        status: 'EXECUTING', 
        priority: 'CRITICAL', 
        axis: 'cybersecurity', 
        budget: 680000,
        summary: 'Enterprise-wide zero trust architecture with identity-based access controls.',
        targetQuarter: 'Q1 2025',
        progress: 55,
        expectedRoi: 1.8
    },
    { 
        name: 'Employee Digital Skills Program', 
        status: 'EXECUTING', 
        priority: 'HIGH', 
        axis: 'culture', 
        budget: 150000,
        summary: 'Comprehensive training program for digital literacy across all departments.',
        targetQuarter: 'Q1 2025',
        progress: 70,
        expectedRoi: 2.0
    },
    { 
        name: 'Data Lake Implementation', 
        status: 'EXECUTING', 
        priority: 'HIGH', 
        axis: 'dataManagement', 
        budget: 420000,
        summary: 'Centralized data lake for all structured and unstructured enterprise data.',
        targetQuarter: 'Q1 2025',
        progress: 45,
        expectedRoi: 2.3
    },
    
    // DONE status
    { 
        name: 'API Gateway Deployment', 
        status: 'DONE', 
        priority: 'HIGH', 
        axis: 'processes', 
        budget: 180000,
        summary: 'Centralized API management platform for internal and external integrations.',
        targetQuarter: 'Q4 2024',
        progress: 100,
        expectedRoi: 2.5
    },
    { 
        name: 'DevOps Pipeline Modernization', 
        status: 'DONE', 
        priority: 'MEDIUM', 
        axis: 'processes', 
        budget: 220000,
        summary: 'CI/CD pipeline with automated testing and deployment to reduce cycle time.',
        targetQuarter: 'Q4 2024',
        progress: 100,
        expectedRoi: 3.0
    },
    
    // BLOCKED status
    { 
        name: 'Autonomous Logistics Robots', 
        status: 'BLOCKED', 
        priority: 'HIGH', 
        axis: 'digitalProducts', 
        budget: 890000,
        summary: 'Autonomous mobile robots for warehouse and intra-facility logistics.',
        targetQuarter: 'Q3 2025',
        progress: 20
    },
    
    // Additional initiatives for variety
    { 
        name: 'Customer Service Chatbot', 
        status: 'PLANNING', 
        priority: 'MEDIUM', 
        axis: 'aiMaturity', 
        budget: 120000,
        summary: 'AI chatbot for 24/7 customer support with natural language understanding.',
        targetQuarter: 'Q3 2025',
        progress: 5,
        expectedRoi: 4.0
    },
    { 
        name: 'Subscription Business Model', 
        status: 'REVIEW', 
        priority: 'HIGH', 
        axis: 'businessModels', 
        budget: 350000,
        summary: 'Transform product-centric model to subscription-based recurring revenue.',
        targetQuarter: 'Q2 2025',
        progress: 15,
        expectedRoi: 2.8
    },
    { 
        name: 'Real-time Analytics Dashboard', 
        status: 'APPROVED', 
        priority: 'MEDIUM', 
        axis: 'dataManagement', 
        budget: 95000,
        summary: 'Executive dashboard with real-time KPIs and predictive insights.',
        targetQuarter: 'Q2 2025',
        progress: 10,
        expectedRoi: 1.5
    },
    { 
        name: 'Agile Transformation Program', 
        status: 'EXECUTING', 
        priority: 'HIGH', 
        axis: 'culture', 
        budget: 280000,
        summary: 'Enterprise-wide agile adoption with coaching and methodology training.',
        targetQuarter: 'Q1 2025',
        progress: 50,
        expectedRoi: 2.2
    }
];

// ============================================
// ROADMAP WAVES
// ============================================

const ROADMAP_WAVES = [
    { name: 'Foundation Phase', quarter: 'Q1 2025', sortOrder: 1, status: 'active' },
    { name: 'Core Systems', quarter: 'Q2 2025', sortOrder: 2, status: 'planned' },
    { name: 'Integration Phase', quarter: 'Q3 2025', sortOrder: 3, status: 'planned' },
    { name: 'AI & Analytics', quarter: 'Q4 2025', sortOrder: 4, status: 'planned' },
    { name: 'Optimization', quarter: 'Q1 2026', sortOrder: 5, status: 'planned' }
];

// ============================================
// DEPENDENCIES (by name, will be resolved to IDs)
// ============================================

const DEPENDENCIES = [
    { from: 'Cloud Infrastructure Migration', to: 'AI-Powered Demand Forecasting', type: 'FINISH_TO_START' },
    { from: 'Cloud Infrastructure Migration', to: 'Data Lake Implementation', type: 'FINISH_TO_START' },
    { from: 'Customer Data Platform', to: 'AI-Powered Demand Forecasting', type: 'FINISH_TO_START' },
    { from: 'Data Lake Implementation', to: 'Real-time Analytics Dashboard', type: 'FINISH_TO_START' },
    { from: 'Zero Trust Security Implementation', to: 'Customer Data Platform', type: 'START_TO_START' },
    { from: 'IoT Factory Floor Integration', to: 'Digital Twin Manufacturing', type: 'FINISH_TO_START' },
    { from: 'API Gateway Deployment', to: 'Customer Service Chatbot', type: 'FINISH_TO_START' }
];

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function seedPortfolioDemo() {
    console.log('\n🚀 Starting Portfolio Demo Seed...\n');
    
    try {
        // Get first project and organization
        const project = await queryHelpers.queryOne(`
            SELECT p.id, p.name, p.organization_id, o.name as org_name
            FROM projects p
            JOIN organizations o ON p.organization_id = o.id
            LIMIT 1
        `);
        
        if (!project) {
            console.error('❌ No project found. Please run basic seed first.');
            return;
        }
        
        console.log(`📁 Using project: ${project.name} (${project.org_name})`);
        
        // Get users from organization for assignment
        const users = await queryHelpers.queryAll(`
            SELECT id, first_name, last_name, email 
            FROM users 
            WHERE organization_id = ?
            LIMIT 10
        `, [project.organization_id]);
        
        if (users.length === 0) {
            console.error('❌ No users found in organization.');
            return;
        }
        
        console.log(`👥 Found ${users.length} users for assignment\n`);
        
        // Create initiatives
        console.log('📋 Creating initiatives...');
        const initiativeMap = new Map(); // name -> id
        
        for (const init of INITIATIVES) {
            const id = uuidv4();
            const ownerBusiness = users[Math.floor(Math.random() * users.length)];
            const ownerExecution = users[Math.floor(Math.random() * users.length)];
            
            await queryHelpers.queryRun(`
                INSERT INTO initiatives (
                    id, project_id, organization_id, name, summary, axis, status, priority,
                    progress, cost_capex, expected_roi, target_quarter,
                    owner_business_id, owner_execution_id,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                id,
                project.id,
                project.organization_id,
                init.name,
                init.summary,
                init.axis,
                init.status,
                init.priority,
                init.progress || 0,
                init.budget,
                init.expectedRoi || null,
                init.targetQuarter,
                ownerBusiness.id,
                ownerExecution.id
            ]);
            
            initiativeMap.set(init.name, id);
            console.log(`  ✅ ${init.status.padEnd(10)} | ${init.name}`);
        }
        
        console.log(`\n✅ Created ${INITIATIVES.length} initiatives\n`);
        
        // Create roadmap if it doesn't exist
        let roadmap = await queryHelpers.queryOne(`
            SELECT id FROM roadmaps WHERE project_id = ? LIMIT 1
        `, [project.id]);
        
        if (!roadmap) {
            const roadmapId = uuidv4();
            await queryHelpers.queryRun(`
                INSERT INTO roadmaps (id, project_id, name, status, created_at, updated_at)
                VALUES (?, ?, ?, 'active', datetime('now'), datetime('now'))
            `, [roadmapId, project.id, 'Digital Transformation Roadmap 2025']);
            roadmap = { id: roadmapId };
            console.log('📅 Created roadmap: Digital Transformation Roadmap 2025');
        }
        
        // Create roadmap waves
        console.log('\n🌊 Creating roadmap waves...');
        for (const wave of ROADMAP_WAVES) {
            const waveId = uuidv4();
            await queryHelpers.queryRun(`
                INSERT OR IGNORE INTO roadmap_waves (
                    id, project_id, name, sort_order, status, 
                    created_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))
            `, [waveId, project.id, wave.name, wave.sortOrder, wave.status]);
            console.log(`  ✅ ${wave.name} (${wave.quarter})`);
        }
        
        // Create dependencies
        console.log('\n🔗 Creating initiative dependencies...');
        let depsCreated = 0;
        for (const dep of DEPENDENCIES) {
            const fromId = initiativeMap.get(dep.from);
            const toId = initiativeMap.get(dep.to);
            
            if (fromId && toId) {
                await queryHelpers.queryRun(`
                    INSERT OR IGNORE INTO initiative_dependencies (
                        id, from_initiative_id, to_initiative_id, type, is_satisfied, created_at
                    ) VALUES (?, ?, ?, ?, 0, datetime('now'))
                `, [uuidv4(), fromId, toId, dep.type]);
                depsCreated++;
                console.log(`  ✅ ${dep.from} → ${dep.to}`);
            }
        }
        console.log(`\n✅ Created ${depsCreated} dependencies\n`);
        
        // Summary statistics
        const stats = await queryHelpers.queryOne(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as draft,
                SUM(CASE WHEN status = 'PLANNING' THEN 1 ELSE 0 END) as planning,
                SUM(CASE WHEN status = 'REVIEW' THEN 1 ELSE 0 END) as review,
                SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'EXECUTING' THEN 1 ELSE 0 END) as executing,
                SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as done,
                SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked,
                SUM(cost_capex) as total_budget
            FROM initiatives 
            WHERE project_id = ?
        `, [project.id]);
        
        console.log('📊 Portfolio Summary:');
        console.log('━'.repeat(40));
        console.log(`  Total Initiatives: ${stats.total}`);
        console.log(`  Draft:     ${stats.draft}`);
        console.log(`  Planning:  ${stats.planning}`);
        console.log(`  Review:    ${stats.review}`);
        console.log(`  Approved:  ${stats.approved}`);
        console.log(`  Executing: ${stats.executing}`);
        console.log(`  Done:      ${stats.done}`);
        console.log(`  Blocked:   ${stats.blocked}`);
        console.log(`  Total Budget: $${(stats.total_budget / 1000000).toFixed(2)}M`);
        console.log('━'.repeat(40));
        
        console.log('\n🎉 Portfolio Demo Seed completed successfully!\n');
        
    } catch (error) {
        console.error('❌ Seed failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    seedPortfolioDemo()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { seedPortfolioDemo };

