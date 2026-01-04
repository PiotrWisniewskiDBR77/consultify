
const { AIPipeline } = require('./services/ai/aiPipeline.js');

// Mock dependencies if needed, or rely on real ones if they are safe.
// Since my classes use `require`, I can mock them by manipulating `require.cache` or simpler: just run integration test if DB is safe.
// The DB calls in `PromptAssembler` might fail if DB connection isn't set up in isolated script.
// I should mock the DB or the components.

// Let's mock the component instances on the pipeline if possible, or subclass.
// But AIPipeline instantiates them in constructor: `this.gateway = new AIGateway();`
// I can overwrite them after instantiation.

async function verify() {
    console.log("Starting Verification...");

    try {
        const pipeline = new AIPipeline();

        // 1. Mock Gateway
        pipeline.gateway.process = async () => { console.log("Gateway: Checked"); };

        // 2. Mock Context
        pipeline.contextBuilder.build = async ({ userId }) => {
            console.log("Context: Built");
            return { user: { id: userId }, timestamp: new Date().toISOString() };
        };

        // 3. Mock Assembler
        pipeline.promptAssembler.build = async ({ request }) => {
            console.log("Assembler: Built");
            return {
                systemPrompt: "System Mock",
                messages: [...(request.messages || [])]
            };
        };

        // 4. Mock Router
        pipeline.modelRouter.select = async () => {
            console.log("Router: Selected");
            return {
                id: 'mock-model',
                provider: 'openai',
                tier: 'STANDARD'
            };
        };

        // 5. Mock LLM Service
        pipeline.llmService.call = async () => {
            console.log("LLM: Called");
            return {
                content: "Verification Success",
                usage: { total_tokens: 10 }
            };
        };

        // Run Logic
        const response = await pipeline.process({
            type: 'chat',
            userId: 'test-user',
            organizationId: 'test-org',
            capability: 'chat',
            messages: [{ role: 'user', content: 'Test' }]
        });

        if (response.content === "Verification Success") {
            console.log("✅ Verification PASSED");
        } else {
            console.error("❌ Verification FAILED: Unexpected content", response);
            process.exit(1);
        }

    } catch (err) {
        console.error("❌ Verification CRASHED:", err);
        process.exit(1);
    }
}

verify();
