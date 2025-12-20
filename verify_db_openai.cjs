const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fetch = require('node-fetch');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

async function checkOpenAIfromDB() {

    // ESM fix
    const nodeFetch = await import('node-fetch');
    const fetch = nodeFetch.default;

    db.get("SELECT api_key FROM llm_providers WHERE provider = 'openai'", async (err, row) => {
        if (err || !row) return console.log("No key");

        console.log(`Testing DB Key: ${row.api_key.substring(0, 10)}...`);
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${row.api_key}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{ role: "user", content: "Hello" }],
                max_tokens: 5
            })
        });

        console.log(`Status: ${res.status} ${res.statusText}`);
    });
}

checkOpenAIfromDB();
