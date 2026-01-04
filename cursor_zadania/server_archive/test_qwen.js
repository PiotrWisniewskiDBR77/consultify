import AiService from './services/aiService.js';
import db from './database.js';

// Mock a user ID that we know exists (e.g. 2 for Piotr)
const userId = 2;

async function test() {
    console.log("Testing Qwen Connection via AiService...");
    try {
        const response = await AiService.callLLM("Hello, are you there?", "You are a helpful assistant.", [], null, userId);
        console.log("Response:", response);
    } catch (error) {
        console.error("Error:", error);
    }
}

test();
