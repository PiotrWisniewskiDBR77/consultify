const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

async function checkOpenAI() {
    console.log("Checking OpenAI Provider...");
    db.get("SELECT api_key, model_id, is_active FROM llm_providers WHERE provider = 'openai'", (err, row) => {
        if (err || !row) {
            console.error("OpenAI not found or DB error:", err);
            return;
        }

        console.log(`OpenAI Active: ${row.is_active}`);
        console.log(`Model ID: ${row.model_id}`);
        console.log(`Key Length: ${row.api_key ? row.api_key.length : 0}`);
        console.log(`Key Prefix: ${row.api_key ? row.api_key.substring(0, 7) : 'N/A'}`);
    });
}

checkOpenAI();
