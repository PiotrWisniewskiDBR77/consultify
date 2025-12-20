const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

async function testGemini() {
    console.log("Fetching API Key from DB...");
    db.get("SELECT api_key FROM llm_providers WHERE provider = 'gemini'", async (err, row) => {
        if (err || !row || !row.api_key) {
            console.error("No Gemini API Key found.");
            return;
        }

        const apiKey = row.api_key;
        console.log("Key Prefix:", apiKey.substring(0, 4));

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const modelName = 'gemini-2.0-flash';
            console.log(`Testing model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });

            const result = await model.generateContent("Hello?");
            const response = await result.response;
            console.log("Response:", response.text());
        } catch (error) {
            console.error("Gemini Error:", error);
        }
    });
}

testGemini();
