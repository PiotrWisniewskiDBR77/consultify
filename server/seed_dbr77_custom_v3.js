const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

async function seed() {
    const defaultPassword = '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const orgId = 'org-dbr77-test';

    console.log('--- Seeding DBR77 Workspace Data ---');

    // 1. Ensure Organization is Enterprise
    db.run(`INSERT OR IGNORE INTO organizations (id, name, plan, status, industry) VALUES (?, ?, ?, ?, ?)`,
        [orgId, 'DBR77', 'enterprise', 'active', 'Technology']);
    db.run(`UPDATE organizations SET plan = 'enterprise', name = 'DBR77', status = 'active' WHERE id = ?`, [orgId]);

    // 2. Projects
    const projects = [
        { id: 'proj-dbr77-001', name: 'Digital Transformation 2026', status: 'active' },
        { id: 'proj-dbr77-002', name: 'AI Supply Chain Optimization', status: 'active' },
        { id: 'proj-dbr77-003', name: 'Smart Factory Implementation', status: 'completed' }
    ];

    for (const p of projects) {
        db.run(`INSERT OR IGNORE INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)`,
            [p.id, orgId, p.name, p.status]);
    }

    // 3. Knowledge Candidates (Idea Inbox)
    const ideas = [
        { id: uuidv4(), content: 'Implement real-time predictive maintenance for CNC machines.', reasoning: 'Reduces downtime by 15% based on current analysis.', source: 'analysis', status: 'pending' },
        { id: uuidv4(), content: 'Automated warehouse sorting using vision AI.', reasoning: 'Increases throughput in logistic centers.', source: 'interaction', status: 'approved' },
        { id: uuidv4(), content: 'Standardize sensor data format across all production lines.', reasoning: 'Crucial for unified data lake integration.', source: 'manual', status: 'pending' }
    ];

    for (const idea of ideas) {
        db.run(`INSERT OR IGNORE INTO knowledge_candidates (id, content, reasoning, source, status) VALUES (?, ?, ?, ?, ?)`,
            [idea.id, idea.content, idea.reasoning, idea.source, idea.status]);
    }

    // 4. Strategic Directions
    const strategies = [
        { id: uuidv4(), title: 'AI-First Automation', description: 'Prioritize automation solutions that leverage deep learning and vision systems.', is_active: 1 },
        { id: uuidv4(), title: 'Sustainable Industry 4.0', description: 'Focus on energy-efficient manufacturing processes and waste reduction.', is_active: 1 }
    ];

    for (const s of strategies) {
        db.run(`INSERT OR IGNORE INTO global_strategies (id, title, description, is_active) VALUES (?, ?, ?, ?)`,
            [s.id, s.title, s.description, s.is_active]);
    }

    // 5. Playbook Templates
    const playbooks = [
        { id: 'pb-assess-001', name: 'Maturity Assessment Pilot', description: 'Standard workflow for running a DRD maturity assessment in a new production hall.', category: 'Assessment' },
        { id: 'pb-ops-001', name: 'Daily Operations Healthcheck', description: 'Automated status reporting and risk identification for production shifts.', category: 'Operations' }
    ];

    for (const pb of playbooks) {
        db.run(`INSERT OR IGNORE INTO ai_playbook_templates (id, key, title, description, status) VALUES (?, ?, ?, ?, ?)`,
            [pb.id, pb.id, pb.name, pb.description, 'PUBLISHED']);
    }

    // 6. Billing & Invoices
    db.run(`INSERT OR IGNORE INTO organization_billing (id, organization_id, status, billing_email) VALUES (?, ?, ?, ?)`,
        [uuidv4(), orgId, 'active', 'piotr.wisniewski@dbr77.com']);

    const invoices = [
        { id: 'inv-dbr77-001', amount: 2999.00, status: 'paid', period: '2025-12' },
        { id: 'inv-dbr77-002', amount: 2999.00, status: 'paid', period: '2026-01' }
    ];

    for (const inv of invoices) {
        db.run(`INSERT OR IGNORE INTO invoices (id, organization_id, amount_paid, status, period_start) VALUES (?, ?, ?, ?, ?)`,
            [inv.id, orgId, inv.amount, inv.status, inv.period + '-01']);
    }

    console.log('Seeding completed successfully.');
    db.close();
}

seed().catch(console.error);
