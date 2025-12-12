const AiService = require('./services/aiService');
const db = require('./database');

const userId = 'user-dbr77-admin';
const providerId = 'bce30987-1030-43e3-b89b-0400f76041e3';

const history = [
    { role: 'assistant', content: "Let's define your Strategic Goals. What is the #1 priority?" },
    { role: 'user', content: "Efficiency & Cost" },
    { role: 'assistant', content: "Now, the Challenges Map. What is hurting you the most right now?" },
    { role: 'user', content: "dawaj" },
    { role: 'assistant', content: "Now, the Challenges Map. What is hurting you the most right now?" },
    { role: 'user', content: "dawaj" },
    { role: 'assistant', content: "Let's define your Strategic Goals. (Loop?)" }
];

async function test() {
    console.log("Testing Qwen with HISTORY...");
    try {
        const response = await AiService.callLLM("a pogadaj", "You are helpful", history, providerId, userId);
        console.log("Response:", response);
    } catch (error) {
        console.error("Error:", error);
    }
}

test();
