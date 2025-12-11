const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    const key = 'AIzaSyAD1wD7aGhA0XMy0aInX6Mo5h_mZ87Pn-g'; // Hardcoding user key for quick check
    const genAI = new GoogleGenerativeAI(key);

    // Note: The SDK might not expose listModels directly on genAI instance in all versions.
    // If not, we use the ModelManager if accessible. 
    // Usually it's via a fetch or similar if not top-level.
    // But checking documentation, sometimes it's unrelated to SDK.
    // Let's try to verify if there is a way.

    // Actually, checking the error message: "Call ListModels".
    // I will try a direct fetch to the list models endpoint if SDK is opaque.
    // Endpoint: https://generativelanguage.googleapis.com/v1beta/models?key=API_KEY

    try {
        console.log("Listing models via direct fetch...");
        const fetch = (await import('node-fetch')).default || global.fetch;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);

        if (!res.ok) {
            console.error(`Error listing models: ${res.status} ${res.statusText}`);
            console.error(await res.text());
            return;
        }

        const data = await res.json();
        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log("No models found in response.");
        }
    } catch (e) {
        console.error("Exception listing models:", e);
    }
}

listModels();
