const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, '../consultify.db');
const db = new sqlite3.Database(dbPath);

const roles = [
    {
        key: 'ANALYST',
        desc: 'Generates, counts, benchmarks',
        content: "You are an Expert Digital Analyst. Your mode is 'GENERATOR & BENCHMARKER'. You deal in facts, data, and calculations. You DO NOT fluff. You DO NOT suggest strategy yet. You output tables, metrics, and comparisons against industry standards. If data is missing, you state it clearly."
    },
    {
        key: 'PARTNER',
        desc: 'Suggests, simplifies, warns',
        content: "You are a Strategic Partner. Your mode is 'SUGGESTER & SIMPLIFIER'. You take complex data and make it simple. You serve as a sounding board. You proactively suggest 80/20 solutions. You warn about risks but propose mitigations. Your tone is collaborative and solution-oriented."
    },
    {
        key: 'GATEKEEPER',
        desc: 'Blocks bullshit, forces decisions',
        content: "You are a Strict Gatekeeper. Your mode is 'BLOCKER & DECISION FORCER'. You have zero tolerance for corporate fluff or buzzwords. If an initiative is vague, you REJECT it. You force the user to make a binary decision (Go/No-Go). You demand clear 'Definition of Done'. You are professional but uncompromising."
    }
];

db.serialize(() => {
    const stmt = db.prepare("INSERT OR REPLACE INTO system_prompts (id, key, description, content, updated_by) VALUES ((SELECT id FROM system_prompts WHERE key = ?), ?, ?, ?, 'system_seed')");

    // If id is null (fallback for new insert), we need to handle it.
    // Actually REPLACE INTO works on Primary Key. We want to update on KEY unique constraint or Insert.
    // SQLite UPSERT syntax:

    roles.forEach(role => {
        console.log(`Seeding role: ${role.key}`);

        // Check if exists
        db.get("SELECT id FROM system_prompts WHERE key = ?", [role.key], (err, row) => {
            if (row) {
                // Update
                db.run("UPDATE system_prompts SET content = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?", [role.content, role.desc, role.key], (err) => {
                    if (err) console.error("Update failed", err);
                    else console.log(`Updated ${role.key}`);
                });
            } else {
                // Insert
                db.run("INSERT INTO system_prompts (id, key, description, content, updated_by) VALUES (?, ?, ?, ?, ?)", [uuidv4(), role.key, role.desc, role.content, 'system_seed'], (err) => {
                    if (err) console.error("Insert failed", err);
                    else console.log(`Inserted ${role.key}`);
                });
            }
        });
    });
});
