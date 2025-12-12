const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
    console.error("GOOGLE_API_KEY not found in env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        console.log("Fetching available Gemini models...");
        // Not all SDK versions support listModels directly on client, 
        // sometimes it's via a model manager or similar. 
        // But let's try a simple model instantiation and basic run first to isolate "NotFound" vs "Auth".

        // Try 1.5 Pro
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
            const result = await model.generateContent("Hello?");
            console.log("✅ gemini-1.5-pro works: " + result.response.text());
        } catch (e) { console.log("❌ gemini-1.5-pro failed: " + e.message); }

        // Try 1.5 Flash
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent("Hello?");
            console.log("✅ gemini-1.5-flash works: " + result.response.text());
        } catch (e) { console.log("❌ gemini-1.5-flash failed: " + e.message); }

        // Try Pro Legacy
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent("Hello?");
            console.log("✅ gemini-pro works: " + result.response.text());
        } catch (e) { console.log("❌ gemini-pro failed: " + e.message); }

    } catch (error) {
        console.error("General Error:", error);
    }
}

listModels();
