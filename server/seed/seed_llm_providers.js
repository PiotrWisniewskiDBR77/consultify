import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

dotenv.config({ path: path.join(__dirname, '../.env') });

const sqlite3 = require('sqlite3').verbose();
const dbPath = path.resolve(__dirname, '../consultinity.db');
const db = new sqlite3.Database(dbPath);

const providers = [
    {
        name: 'Gemini 1.5 Flash',
        provider: 'gemini',
        model_id: 'gemini-1.5-flash',
        api_key: process.env.GEMINI_API_KEY,
        is_active: 1,
        is_default: 1,
        cost_per_1k: 0.00,
        visibility: 'public'
    },
    {
        name: 'GPT-4o',
        provider: 'openai',
        model_id: 'gpt-4o',
        api_key: process.env.OPENAI_API_KEY,
        is_active: 1,
        is_default: 0,
        cost_per_1k: 0.03,
        visibility: 'public'
    },
    {
        name: 'Qwen Turbo',
        provider: 'qwen',
        model_id: 'qwen-turbo',
        api_key: process.env.QWEN_API_KEY,
        is_active: 1,
        is_default: 0,
        cost_per_1k: 0.01,
        visibility: 'public'
    },
    {
        name: 'Zhipu GLM-4',
        provider: 'z_ai',
        model_id: 'glm-4',
        api_key: process.env.ZAI_API_KEY,
        is_active: 1,
        is_default: 0,
        cost_per_1k: 0.05,
        visibility: 'public'
    }
].filter(p => p.api_key);

console.log(`Seeding ${providers.length} providers...`);

db.serialize(() => {
    // We assume table exists as per schema check
    const stmt = db.prepare(`INSERT OR REPLACE INTO llm_providers (id, name, provider, model_id, api_key, is_active, is_default, cost_per_1k, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    providers.forEach(p => {
        db.run("DELETE FROM llm_providers WHERE provider = ? AND model_id = ?", [p.provider, p.model_id], (err) => {
            if (!err) {
                const newId = uuidv4();
                stmt.run(newId, p.name, p.provider, p.model_id, p.api_key, p.is_active, p.is_default, p.cost_per_1k, p.visibility, (err) => {
                    if (err) console.error(`Error seeding ${p.name}:`, err.message);
                    else console.log(`Seeded ${p.name}`);
                });
            }
        });
    });

    // Wait a bit for asyncs (lazy way)
    setTimeout(() => {
        stmt.finalize();
        console.log('Seeding initiated.');
    }, 1000);
});
