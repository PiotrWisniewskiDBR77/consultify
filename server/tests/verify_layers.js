const AiService = require('../services/aiService');
const FinancialService = require('../services/financialService');

// Mock specific parts if needed, but we want integration test
// We need to mock DB for callLLM if we don't have a real DB connection, 
// OR we can just test the parts that don't depend on DB if we mock AiService.callLLM
// However, AiService is complex. Let's try to load it. 
// Note: It requires `../database`. If that tries to connect effectively, we might need to handle it.
// For this script, let's mock the `callLLM` to return deterministic JSONs so we test the LOGIC around it,
// AND we test the `FinancialService` directly.

// Mock AI Service LLM Call for deterministic testing without wasting tokens or needing keys
AiService.callLLM = async (prompt, systemInstruction) => {
    console.log(`[Mock LLM] Prompt: ${prompt.substring(0, 50)}...`);

    // 1. Diagnosis Mock
    if (systemInstruction.includes("diagnosing")) {
        return JSON.stringify({
            level: 2,
            justification: "User mentioned usage of Excel which matches Level 2 definition.",
            gaps: ["Lack of automation", "No integrated system"]
        });
    }

    // 2. Initiatives Mock
    if (systemInstruction.includes("transformation portfolio")) {
        return JSON.stringify([
            { title: "Implement CRM", complexity: "Medium", priority: "High", axis: "Sales" }
        ]);
    }

    return "{}";
};

async function runTests() {
    console.log("=== TEST 1: Financial Service (Deterministic) ===");
    const costTest = FinancialService.estimateCost('High');
    console.log("High Complexity Cost:", costTest.cost === 75000 ? "PASS" : "FAIL", costTest.cost);

    const benefitTest = FinancialService.estimateBenefit('High', 75000);
    console.log("High Priority Benefit:", benefitTest.benefit === 187500 ? "PASS" : "FAIL", benefitTest.benefit); // 75000 * 2.5 = 187500

    console.log("\n=== TEST 2: AI Diagnosis Layer (Integration) ===");
    const diagResult = await AiService.diagnose('Sales processes', 'We use Excel sheets');
    console.log("Diagnosis Level:", diagResult.level === 2 ? "PASS" : "FAIL");
    console.log("Diagnosis Justification:", diagResult.justification);

    console.log("\n=== TEST 3: AI Simulation Layer (Financials) ===");
    const initiatives = [
        { title: "Big Project", complexity: "High", priority: "High" },
        { title: "Small Win", complexity: "Low", priority: "Low" } // Cost 5000, Ben 6000 (1.2x)
    ];

    const simulation = await AiService.simulateEconomics(initiatives);
    console.log("Total CAPEX:", simulation.totalCapex === 80000 ? "PASS" : "FAIL", `(${simulation.totalCapex})`); // 75k + 5k
    console.log("Total Benefit:", simulation.annualBenefit === 193500 ? "PASS" : "FAIL", `(${simulation.annualBenefit})`); // 187500 + 6000
    console.log("ROI Calculated:", simulation.roi > 0 ? "PASS" : "FAIL", `${simulation.roi}%`);

    console.log("\n=== TESTS COMPLETED ===");
}

runTests().catch(console.error);
