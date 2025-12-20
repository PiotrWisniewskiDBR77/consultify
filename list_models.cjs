const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

async function listModels() {
    const fetch = (await import('node-fetch')).default;
    console.log("Fetching API Key from DB...");
    db.get("SELECT api_key FROM llm_providers WHERE provider = 'gemini' AND is_active = 1", async (err, row) => {
        if (err || !row || !row.api_key) {
            console.error("No Gemini API Key found.");
            return;
        }

        const apiKey = row.api_key;
        console.log("Key Prefix:", apiKey.substring(0, 4));

        try {
            console.log("Fetching models via REST...");
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const data = await response.json();

            if (!response.ok) {
                console.error("List Models Failed:", data);
                return;
            }

            console.log("Available Models:");
            if (data.models) {
                data.models.forEach(m => console.log(`- ${m.name}`));
            } else {
                console.log("No models returned (empty list).");
            }
        } catch (error) {
            console.error("Fetch Error:", error);
        }
    });
}

listModels();
