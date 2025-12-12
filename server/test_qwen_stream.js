const AiService = require('./services/aiService');
const db = require('./database');

const userId = 'user-dbr77-admin';
const providerId = 'bce30987-1030-43e3-b89b-0400f76041e3'; // Qwen

async function test() {
    console.log("Testing Qwen NATIVE STREAMING...");
    try {
        const generator = AiService.streamLLM("Summarize the history of AI in 50 words.", "You are helpful", [], providerId, userId);

        console.log("Starting stream...");
        let chunkCount = 0;
        for await (const chunk of generator) {
            process.stdout.write(chunk); // Print chunks inline
            chunkCount++;
        }
        console.log(`\n\nStream finished. Chunks: ${chunkCount}`);
        if (chunkCount < 2) console.warn("WARNING: Received very few chunks (Maybe blocking?)");
        else console.log("SUCCESS: Streaming confirmed.");

    } catch (error) {
        console.error("Test Error:", error);
    }
}

test();
