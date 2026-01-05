/**
 * Studio Templates Seed
 * 
 * Pre-built templates for Consultify Studio.
 * Run with: node server/seed/studioTemplates.js
 */

import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

// Helper functions
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});

// Template definitions
const TEMPLATES = [
    // =====================
    // PROCESS FLOW TEMPLATES
    // =====================
    {
        name: 'Simple Process Flow',
        description: 'Basic linear process with start, steps, and end',
        category: 'process_flow',
        icon: 'workflow',
        is_public: true,
        is_featured: true,
        tags: ['basic', 'linear', 'beginner'],
        nodes: [
            { id: 'start-1', type: 'startEnd', position: { x: 50, y: 100 }, data: { label: 'Start', isStart: true } },
            { id: 'step-1', type: 'processStep', position: { x: 250, y: 100 }, data: { label: 'Step 1', description: 'First action' } },
            { id: 'step-2', type: 'processStep', position: { x: 500, y: 100 }, data: { label: 'Step 2', description: 'Second action' } },
            { id: 'step-3', type: 'processStep', position: { x: 750, y: 100 }, data: { label: 'Step 3', description: 'Third action' } },
            { id: 'end-1', type: 'startEnd', position: { x: 1000, y: 100 }, data: { label: 'End', isStart: false } }
        ],
        edges: [
            { id: 'e1', source: 'start-1', target: 'step-1', type: 'smoothstep' },
            { id: 'e2', source: 'step-1', target: 'step-2', type: 'smoothstep' },
            { id: 'e3', source: 'step-2', target: 'step-3', type: 'smoothstep' },
            { id: 'e4', source: 'step-3', target: 'end-1', type: 'smoothstep' }
        ]
    },
    {
        name: 'Approval Workflow',
        description: 'Process with decision points for approvals',
        category: 'process_flow',
        icon: 'check-circle',
        is_public: true,
        is_featured: true,
        tags: ['approval', 'decision', 'workflow'],
        nodes: [
            { id: 'start', type: 'startEnd', position: { x: 50, y: 150 }, data: { label: 'Request Submitted', isStart: true } },
            { id: 'review', type: 'processStep', position: { x: 250, y: 150 }, data: { label: 'Manager Review', description: 'Initial review' } },
            { id: 'decision1', type: 'decision', position: { x: 480, y: 85 }, data: { label: 'Approved?', yesLabel: 'Yes', noLabel: 'No' } },
            { id: 'revise', type: 'processStep', position: { x: 480, y: 300 }, data: { label: 'Revise Request', description: 'Make changes' } },
            { id: 'final', type: 'processStep', position: { x: 700, y: 150 }, data: { label: 'Final Approval', description: 'Director approval' } },
            { id: 'decision2', type: 'decision', position: { x: 930, y: 85 }, data: { label: 'Approved?', yesLabel: 'Yes', noLabel: 'No' } },
            { id: 'approved', type: 'startEnd', position: { x: 1150, y: 100 }, data: { label: 'Approved', isStart: false } },
            { id: 'rejected', type: 'startEnd', position: { x: 1150, y: 250 }, data: { label: 'Rejected', isStart: false } }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'review', type: 'smoothstep' },
            { id: 'e2', source: 'review', target: 'decision1', type: 'smoothstep' },
            { id: 'e3', source: 'decision1', target: 'final', sourceHandle: 'yes', type: 'smoothstep', label: 'Yes' },
            { id: 'e4', source: 'decision1', target: 'revise', sourceHandle: 'no', type: 'smoothstep', label: 'No' },
            { id: 'e5', source: 'revise', target: 'review', type: 'smoothstep' },
            { id: 'e6', source: 'final', target: 'decision2', type: 'smoothstep' },
            { id: 'e7', source: 'decision2', target: 'approved', sourceHandle: 'yes', type: 'smoothstep', label: 'Yes' },
            { id: 'e8', source: 'decision2', target: 'rejected', sourceHandle: 'no', type: 'smoothstep', label: 'No' }
        ]
    },
    {
        name: 'Onboarding Process',
        description: 'Employee onboarding workflow template',
        category: 'process_flow',
        icon: 'user-plus',
        is_public: true,
        is_featured: false,
        tags: ['hr', 'onboarding', 'employee'],
        nodes: [
            { id: 'start', type: 'startEnd', position: { x: 50, y: 100 }, data: { label: 'New Hire', isStart: true } },
            { id: 'docs', type: 'processStep', position: { x: 250, y: 100 }, data: { label: 'Paperwork', description: 'Complete HR documents' } },
            { id: 'it', type: 'processStep', position: { x: 500, y: 100 }, data: { label: 'IT Setup', description: 'Equipment & accounts' } },
            { id: 'training', type: 'processStep', position: { x: 750, y: 100 }, data: { label: 'Training', description: 'Initial training' } },
            { id: 'mentor', type: 'processStep', position: { x: 1000, y: 100 }, data: { label: 'Mentor Assignment', description: 'Assign buddy' } },
            { id: 'end', type: 'startEnd', position: { x: 1250, y: 100 }, data: { label: 'Onboarded', isStart: false } }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'docs', type: 'smoothstep' },
            { id: 'e2', source: 'docs', target: 'it', type: 'smoothstep' },
            { id: 'e3', source: 'it', target: 'training', type: 'smoothstep' },
            { id: 'e4', source: 'training', target: 'mentor', type: 'smoothstep' },
            { id: 'e5', source: 'mentor', target: 'end', type: 'smoothstep' }
        ]
    },

    // =====================
    // ORG CHART TEMPLATES
    // =====================
    {
        name: 'Simple Org Chart',
        description: 'Basic 3-level organization hierarchy',
        category: 'org_chart',
        icon: 'users',
        is_public: true,
        is_featured: true,
        tags: ['organization', 'hierarchy', 'team'],
        nodes: [
            { id: 'ceo', type: 'orgUnit', position: { x: 350, y: 50 }, data: { label: 'CEO', role: 'Chief Executive', type: 'person' } },
            { id: 'cto', type: 'orgUnit', position: { x: 100, y: 200 }, data: { label: 'CTO', role: 'Technology', type: 'person' } },
            { id: 'cfo', type: 'orgUnit', position: { x: 350, y: 200 }, data: { label: 'CFO', role: 'Finance', type: 'person' } },
            { id: 'coo', type: 'orgUnit', position: { x: 600, y: 200 }, data: { label: 'COO', role: 'Operations', type: 'person' } },
            { id: 'eng', type: 'orgUnit', position: { x: 0, y: 350 }, data: { label: 'Engineering', type: 'department' } },
            { id: 'prod', type: 'orgUnit', position: { x: 200, y: 350 }, data: { label: 'Product', type: 'department' } },
            { id: 'fin', type: 'orgUnit', position: { x: 350, y: 350 }, data: { label: 'Finance', type: 'department' } },
            { id: 'ops', type: 'orgUnit', position: { x: 500, y: 350 }, data: { label: 'Operations', type: 'department' } },
            { id: 'hr', type: 'orgUnit', position: { x: 700, y: 350 }, data: { label: 'HR', type: 'department' } }
        ],
        edges: [
            { id: 'e1', source: 'ceo', target: 'cto', type: 'smoothstep' },
            { id: 'e2', source: 'ceo', target: 'cfo', type: 'smoothstep' },
            { id: 'e3', source: 'ceo', target: 'coo', type: 'smoothstep' },
            { id: 'e4', source: 'cto', target: 'eng', type: 'smoothstep' },
            { id: 'e5', source: 'cto', target: 'prod', type: 'smoothstep' },
            { id: 'e6', source: 'cfo', target: 'fin', type: 'smoothstep' },
            { id: 'e7', source: 'coo', target: 'ops', type: 'smoothstep' },
            { id: 'e8', source: 'coo', target: 'hr', type: 'smoothstep' }
        ]
    },

    // =====================
    // MINDMAP TEMPLATES
    // =====================
    {
        name: 'Project Brainstorm',
        description: 'Mind map template for project brainstorming',
        category: 'mindmap',
        icon: 'brain',
        is_public: true,
        is_featured: true,
        tags: ['brainstorm', 'ideas', 'planning'],
        nodes: [
            { id: 'center', type: 'mindmapNode', position: { x: 350, y: 200 }, data: { label: 'Project Idea', level: 0, color: 'blue' } },
            { id: 'goals', type: 'mindmapNode', position: { x: 100, y: 100 }, data: { label: 'Goals', level: 1, color: 'green' } },
            { id: 'resources', type: 'mindmapNode', position: { x: 600, y: 100 }, data: { label: 'Resources', level: 1, color: 'amber' } },
            { id: 'risks', type: 'mindmapNode', position: { x: 100, y: 300 }, data: { label: 'Risks', level: 1, color: 'red' } },
            { id: 'timeline', type: 'mindmapNode', position: { x: 600, y: 300 }, data: { label: 'Timeline', level: 1, color: 'purple' } },
            { id: 'goal1', type: 'mindmapNode', position: { x: -50, y: 50 }, data: { label: 'Goal 1', level: 2, color: 'green' } },
            { id: 'goal2', type: 'mindmapNode', position: { x: -50, y: 150 }, data: { label: 'Goal 2', level: 2, color: 'green' } },
            { id: 'res1', type: 'mindmapNode', position: { x: 750, y: 50 }, data: { label: 'Team', level: 2, color: 'amber' } },
            { id: 'res2', type: 'mindmapNode', position: { x: 750, y: 150 }, data: { label: 'Budget', level: 2, color: 'amber' } }
        ],
        edges: [
            { id: 'e1', source: 'center', target: 'goals', type: 'smoothstep' },
            { id: 'e2', source: 'center', target: 'resources', type: 'smoothstep' },
            { id: 'e3', source: 'center', target: 'risks', type: 'smoothstep' },
            { id: 'e4', source: 'center', target: 'timeline', type: 'smoothstep' },
            { id: 'e5', source: 'goals', target: 'goal1', type: 'smoothstep' },
            { id: 'e6', source: 'goals', target: 'goal2', type: 'smoothstep' },
            { id: 'e7', source: 'resources', target: 'res1', type: 'smoothstep' },
            { id: 'e8', source: 'resources', target: 'res2', type: 'smoothstep' }
        ]
    },

    // =====================
    // RACI TEMPLATES
    // =====================
    {
        name: 'RACI Matrix',
        description: 'Responsibility assignment matrix template',
        category: 'raci',
        icon: 'table',
        is_public: true,
        is_featured: true,
        tags: ['responsibility', 'matrix', 'roles'],
        nodes: [
            // Headers - Roles
            { id: 'h-pm', type: 'raciCell', position: { x: 150, y: 0 }, data: { isHeader: true, headerType: 'role', role: 'PM' } },
            { id: 'h-dev', type: 'raciCell', position: { x: 300, y: 0 }, data: { isHeader: true, headerType: 'role', role: 'Dev' } },
            { id: 'h-qa', type: 'raciCell', position: { x: 450, y: 0 }, data: { isHeader: true, headerType: 'role', role: 'QA' } },
            { id: 'h-lead', type: 'raciCell', position: { x: 600, y: 0 }, data: { isHeader: true, headerType: 'role', role: 'Lead' } },
            // Headers - Tasks
            { id: 'h-t1', type: 'raciCell', position: { x: 0, y: 80 }, data: { isHeader: true, headerType: 'task', task: 'Planning' } },
            { id: 'h-t2', type: 'raciCell', position: { x: 0, y: 160 }, data: { isHeader: true, headerType: 'task', task: 'Development' } },
            { id: 'h-t3', type: 'raciCell', position: { x: 0, y: 240 }, data: { isHeader: true, headerType: 'task', task: 'Testing' } },
            { id: 'h-t4', type: 'raciCell', position: { x: 0, y: 320 }, data: { isHeader: true, headerType: 'task', task: 'Deployment' } },
            // RACI Cells - Planning row
            { id: 'c-1-1', type: 'raciCell', position: { x: 150, y: 80 }, data: { value: 'R' } },
            { id: 'c-1-2', type: 'raciCell', position: { x: 300, y: 80 }, data: { value: 'C' } },
            { id: 'c-1-3', type: 'raciCell', position: { x: 450, y: 80 }, data: { value: 'I' } },
            { id: 'c-1-4', type: 'raciCell', position: { x: 600, y: 80 }, data: { value: 'A' } },
            // RACI Cells - Development row
            { id: 'c-2-1', type: 'raciCell', position: { x: 150, y: 160 }, data: { value: 'C' } },
            { id: 'c-2-2', type: 'raciCell', position: { x: 300, y: 160 }, data: { value: 'R' } },
            { id: 'c-2-3', type: 'raciCell', position: { x: 450, y: 160 }, data: { value: 'I' } },
            { id: 'c-2-4', type: 'raciCell', position: { x: 600, y: 160 }, data: { value: 'A' } },
            // RACI Cells - Testing row
            { id: 'c-3-1', type: 'raciCell', position: { x: 150, y: 240 }, data: { value: 'I' } },
            { id: 'c-3-2', type: 'raciCell', position: { x: 300, y: 240 }, data: { value: 'C' } },
            { id: 'c-3-3', type: 'raciCell', position: { x: 450, y: 240 }, data: { value: 'R' } },
            { id: 'c-3-4', type: 'raciCell', position: { x: 600, y: 240 }, data: { value: 'A' } },
            // RACI Cells - Deployment row
            { id: 'c-4-1', type: 'raciCell', position: { x: 150, y: 320 }, data: { value: 'R' } },
            { id: 'c-4-2', type: 'raciCell', position: { x: 300, y: 320 }, data: { value: 'C' } },
            { id: 'c-4-3', type: 'raciCell', position: { x: 450, y: 320 }, data: { value: 'C' } },
            { id: 'c-4-4', type: 'raciCell', position: { x: 600, y: 320 }, data: { value: 'A' } }
        ],
        edges: []
    },

    // =====================
    // SWIMLANE TEMPLATES
    // =====================
    {
        name: 'Cross-Functional Process',
        description: 'Swimlane diagram for cross-department processes',
        category: 'swimlane',
        icon: 'columns',
        is_public: true,
        is_featured: false,
        tags: ['swimlane', 'departments', 'cross-functional'],
        nodes: [
            // Swimlanes
            { id: 'lane-sales', type: 'swimlane', position: { x: 0, y: 0 }, data: { label: 'Sales', color: 'blue' }, style: { width: 800, height: 120 } },
            { id: 'lane-ops', type: 'swimlane', position: { x: 0, y: 140 }, data: { label: 'Operations', color: 'green' }, style: { width: 800, height: 120 } },
            { id: 'lane-fin', type: 'swimlane', position: { x: 0, y: 280 }, data: { label: 'Finance', color: 'amber' }, style: { width: 800, height: 120 } },
            // Process steps
            { id: 'start', type: 'startEnd', position: { x: 100, y: 50 }, data: { label: 'Order', isStart: true } },
            { id: 's1', type: 'processStep', position: { x: 250, y: 50 }, data: { label: 'Process Order' } },
            { id: 's2', type: 'processStep', position: { x: 250, y: 190 }, data: { label: 'Fulfill Order' } },
            { id: 's3', type: 'processStep', position: { x: 450, y: 190 }, data: { label: 'Ship Order' } },
            { id: 's4', type: 'processStep', position: { x: 450, y: 330 }, data: { label: 'Generate Invoice' } },
            { id: 's5', type: 'processStep', position: { x: 650, y: 330 }, data: { label: 'Collect Payment' } },
            { id: 'end', type: 'startEnd', position: { x: 650, y: 50 }, data: { label: 'Complete', isStart: false } }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 's1', type: 'smoothstep' },
            { id: 'e2', source: 's1', target: 's2', type: 'smoothstep' },
            { id: 'e3', source: 's2', target: 's3', type: 'smoothstep' },
            { id: 'e4', source: 's3', target: 's4', type: 'smoothstep' },
            { id: 'e5', source: 's4', target: 's5', type: 'smoothstep' },
            { id: 'e6', source: 's5', target: 'end', type: 'smoothstep' }
        ]
    }
];

// Seed function
async function seedTemplates() {
    console.log('🎨 Seeding Studio templates...');

    try {
        // Check if templates table exists
        const tableCheck = await new Promise((resolve, reject) => {
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='studio_templates'", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!tableCheck) {
            console.log('⚠️  studio_templates table does not exist. Run migrations first.');
            return;
        }

        // Check for existing templates
        const existing = await dbAll('SELECT id, name FROM studio_templates WHERE organization_id IS NULL');
        console.log(`📋 Found ${existing.length} existing system templates`);

        // Insert/Update templates
        for (const template of TEMPLATES) {
            const existingTemplate = existing.find(t => t.name === template.name);
            
            if (existingTemplate) {
                console.log(`  ⏭️  Skipping "${template.name}" (already exists)`);
                continue;
            }

            const id = uuidv4();
            const now = new Date().toISOString();

            await dbRun(`
                INSERT INTO studio_templates (
                    id, organization_id, name, description, category, icon,
                    nodes_json, edges_json, default_viewport_json,
                    tags_json, is_public, is_featured, usage_count,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id,
                null, // organization_id (null for system templates)
                template.name,
                template.description,
                template.category,
                template.icon,
                JSON.stringify(template.nodes),
                JSON.stringify(template.edges),
                JSON.stringify({ x: 0, y: 0, zoom: 1 }),
                JSON.stringify(template.tags),
                template.is_public ? 1 : 0,
                template.is_featured ? 1 : 0,
                0,
                now,
                now
            ]);

            console.log(`  ✅ Created "${template.name}" (${template.category})`);
        }

        console.log('\n✨ Studio templates seeded successfully!');
    } catch (error) {
        console.error('❌ Error seeding templates:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    // Wait for DB initialization
    setTimeout(() => {
        seedTemplates()
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    }, 1000);
}

export {
seedTemplates, TEMPLATES
};

export default { seedTemplates, TEMPLATES };

















