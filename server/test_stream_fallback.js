const AiService = require('./services/aiService');
const db = require('./database');

// User 2 (Piotr)
const userId = 2;

// Mock what streamLLM does
async function test() {
    console.log("Testing streamLLM fallback logic...");
    try {
        // providerId null -> triggers logic to find default (Qwen)
        const generator = AiService.streamLLM("Hello Qwen via Stream logic", "You are helpful", [], null, userId);

        console.log("Generator created. Starting iteration...");
        for await (const chunk of generator) {
            console.log("RECEIVED CHUNK:", chunk);
        }
        console.log("Stream finished.");

    } catch (error) {
        console.error("Test Error:", error);
    }
}

test();
