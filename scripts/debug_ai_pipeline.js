/**
 * Debug script to test AI Pipeline directly
 */
const { AIPipeline } = require('../server/services/ai/aiPipeline');

async function test() {
    console.log('--- AI Pipeline Debug ---');
    const pipeline = new AIPipeline();
    
    const request = {
        type: 'chat',
        userId: '5adb0b59-3130-4f50-bae5-77a9bbc84d5d', // DBR77
        organizationId: 'default-org',
        prompt: 'halo',
        capability: 'chat',
        stream: false
    };

    console.log('Processing request...');
    try {
        const response = await pipeline.process(request);
        console.log('Response received:', JSON.stringify(response, null, 2));
    } catch (error) {
        console.error('Pipeline failed:', error);
    }
}

test();

