const { ModelRouter } = require('./services/ai/modelRouter');

async function testLegacyRoute() {
    console.log('Testing Legacy Route...');
    const router = new ModelRouter();

    try {
        // Just call it. It will likely return a fallback or null provider config if no keys are set,
        // but we care about the RETURN STRUCTURE (providerConfig, sourceType, etc.)
        const result = await router.route('test-user-id', 'chat');

        console.log('Result:', JSON.stringify(result, null, 2));

        if (result && 'sourceType' in result && 'providerConfig' in result) {
            console.log('✅ Legacy structure preserved.');
        } else {
            console.error('❌ Legacy structure missing properties.');
        }

    } catch (e) {
        console.error('Error invoking route:', e);
    }
}

testLegacyRoute();
