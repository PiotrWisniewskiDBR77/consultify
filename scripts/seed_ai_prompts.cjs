const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, '../server/consultify.db');
const db = new sqlite3.Database(dbPath);

const defaults = [
    {
        key: 'INITIATIVE_GENERATOR',
        description: 'Generates strategic initiatives from a report.',
        content: 'You are a Senior Strategy Consultant. Analyze the provided report gaps and propose 3 specific, actionable initiatives. For each, strictly follow this JSON format: { title, difficulty (S/M/L), description, impact }.'
    },
    {
        key: 'TASK_COACH',
        description: 'Provides advice on breakdown and blockers.',
        content: 'You are an Agile PMO Coach. Help the user break down this task into sub-tasks. Be concise, action-oriented, and focus on immediate next steps.'
    },
    {
        key: 'REPORT_SYNTHESIS',
        description: 'Synthesizes assessment data into executive summary.',
        content: 'You are a c-level Executive Assistant. Summarize this assessment data into a 3-paragraph Executive Summary. Focus on Risks, Opportunities, and a Call to Action.'
    },
    {
        key: 'GLOBAL_CHAT',
        description: 'Main AI Consultant persona for general chat.',
        content: 'You are Consultify AI, an expert Digital Transformation Consultant. Your role is to guide the user through strategic discovery and provide actionable insights. Be concise, professional, and solution-oriented.'
    },
    {
        key: 'MAGIC_WAND',
        description: 'Form field suggestion assistant.',
        content: 'You are a helpful UI assistant. Suggest a concise, professional value for the following form field based on the project context.'
    }
];

db.serialize(() => {
    console.log('Seeding AI System Prompts...');

    // Force Schema Reset to ensure correctness
    db.run("DROP TABLE IF EXISTS ai_system_prompts");

    db.run(`CREATE TABLE ai_system_prompts (
            id TEXT PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            description TEXT,
            content TEXT NOT NULL,
            context_config TEXT DEFAULT '{}',
            is_active INTEGER DEFAULT 1,
            version INTEGER DEFAULT 1,
            updated_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
        )`, (err) => {
        if (err) {
            console.error('Failed to create table:', err.message);
            process.exit(1);
        }
        console.log('Table ai_system_prompts created.');

        // Insert defaults
        const stmt = db.prepare("INSERT INTO ai_system_prompts (id, key, description, content) VALUES (?, ?, ?, ?)");

        defaults.forEach(p => {
            stmt.run(uuidv4(), p.key, p.description, p.content, (err) => {
                if (err) console.error(`Failed to insert ${p.key}:`, err.message);
                else console.log(`Seeded: ${p.key}`);
            });
        });

        stmt.finalize(() => {
            console.log('Seeding complete.');
            db.close();
        });
    });
});
