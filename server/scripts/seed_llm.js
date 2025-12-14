const db = require('../database');
require('dotenv').config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.error("Error: OPENAI_API_KEY not found in environment variables.");
    process.exit(1);
}

const provider = 'openai';
const modelId = 'gpt-4';
const isActive = 1;
const isDefault = 1;

const sql = `
    INSERT INTO llm_providers (provider, api_key, model_id, is_active, is_default)
    VALUES (?, ?, ?, ?, ?)
`;

db.run(sql, [provider, apiKey, modelId, isActive, isDefault], function (err) {
    if (err) {
        console.error("Error inserting provider:", err.message);
        process.exit(1);
    }
    console.log(`Successfully inserted provider: ${provider} (ID: ${this.lastID})`);
});
