const AiService = require('./services/aiService');
const db = require('./database');

// Mock a user ID that we know exists (e.g. 2 for Piotr)
const userId = 'user-dbr77-admin';
const providerId = 'bce30987-1030-43e3-b89b-0400f76041e3'; // Qwen ID from DB

async function test() {
    console.log("Testing REAL Qwen Connection...");
    try {
        const response = await AiService.callLLM("Hello Qwen, are you there?", "You are a helpful assistant.", [], providerId, userId);
        console.log("Response:", response);
    } catch (error) {
        console.error("Error:", error);
    }
}

test();
