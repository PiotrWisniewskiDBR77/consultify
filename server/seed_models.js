const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, 'consultify.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
        process.exit(1);
    }
    console.log('Connected to the SQLite database.');
});

const providers = [
    {
        name: 'OpenAI GPT-4o',
        provider: 'openai',
        model_id: 'gpt-4o',
        endpoint: 'https://api.openai.com/v1',
        cost_per_1k: 0.03, // Approx blended
        key_placeholder: 'sk-placeholder'
    },
    {
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        model_id: 'claude-3-5-sonnet-20240620',
        endpoint: 'https://api.anthropic.com/v1',
        cost_per_1k: 0.015,
        key_placeholder: 'sk-ant-placeholder'
    },
    {
        name: 'Google Gemini 1.5 Pro',
        provider: 'google',
        model_id: 'gemini-1.5-pro',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        cost_per_1k: 0.007, // Approx
        key_placeholder: 'AIza-placeholder'
    },
    {
        name: 'Ollama (Local)',
        provider: 'local',
        model_id: 'llama3',
        endpoint: 'http://localhost:11434',
        cost_per_1k: 0,
        key_placeholder: 'not-needed'
    }
];

db.serialize(() => {
    const insert = db.prepare(`
        INSERT INTO llm_providers (
            id, name, provider, api_key, endpoint, model_id, 
            cost_per_1k, is_active, visibility, is_default
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'public', ?)
    `);

    providers.forEach((p, index) => {
        const id = uuidv4();
        const isDefault = index === 0 ? 1 : 0; // Make first one default

        insert.run(
            id, p.name, p.provider, p.key_placeholder, p.endpoint, p.model_id,
            p.cost_per_1k, isDefault,
            (err) => {
                if (err) console.error(`Failed to insert ${p.name}:`, err.message);
                else console.log(`Inserted ${p.name}`);
            }
        );
    });

    insert.finalize(() => {
        console.log('Seeding complete.');
        db.close();
    });
});
