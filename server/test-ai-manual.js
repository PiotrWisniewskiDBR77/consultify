const AiService = require('./services/aiService');
const db = require('./database');

async function testAi() {
    console.log("Starting AI Test...");

    // Give DB a moment to connect
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        console.log("Sending 'Hello' to AI Service (Default Provider)...");
        const response = await AiService.callLLM("Hello! Just checking if you work. Reply with 'I work'.");
        console.log("AI Response:", response);
    } catch (error) {
        console.error("AI Test Failed:", error.message);
        if (error.statusText) console.error("Status Text:", error.statusText);
    }
}

testAi();
