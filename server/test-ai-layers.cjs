require('dotenv').config();
const AiService = require('./services/aiService');
const db = require('./database');

// Tiny delay to let DB connect
setTimeout(async () => {
    console.log("=== STARTING AI LAYERS TEST ===");

    // Mock Data
    const mockDiagnosisInput = "We have basic CRM but manufacturing is still paper based. We track OEE manually.";
    const mockAxis = "Digital Processes";

    // MOCK LLM CALL
    AiService.callLLM = async (prompt, system) => {
        console.log("   [MOCK LLM] Prompt received. System:", system.substring(0, 50) + "...");

        if (system.includes("diagnosing")) {
            return JSON.stringify({
                level: 2,
                justification: "Paper based processes matching Level 2.",
                gaps: ["Lack of automation", "Manual tracking"]
            });
        }
        if (system.includes("transformation portfolio")) {
            return JSON.stringify([
                {
                    title: "Implement MES",
                    description: "Deploy Manufacturing Execution System",
                    axis: "Digital Processes",
                    horizon: "Medium-term",
                    bundle: "Digital Foundation",
                    estimatedCost: "High",
                    impact: "High"
                },
                {
                    title: "Digital Culture Workshop",
                    description: "Leadership training",
                    axis: "Culture",
                    horizon: "Short-term",
                    bundle: "Cultural Transformation",
                    estimatedCost: "Low",
                    impact: "High"
                }
            ]);
        }
        if (system.includes("architecting a 3-year")) {
            return JSON.stringify({
                year1: { q1: ["Digital Culture Workshop"], q2: [], q3: [], q4: [] },
                year2: { q1: ["Implement MES"], q2: [], q3: [], q4: [] },
                year3: {}
            });
        }
        if (system.includes("Estimate the ROI")) {
            return JSON.stringify({
                totalCapex: 500000,
                annualOpex: 50000,
                roi: 150,
                paybackPeriodMonths: 18
            });
        }
        return "Generic Response";
    };

    try {
        // 1. Test Diagnosis
        console.log("\n--- Testing Layer 1: Diagnosis ---");
        const diagnosis = await AiService.diagnose(mockAxis, mockDiagnosisInput);
        console.log("Diagnosis Result:", JSON.stringify(diagnosis, null, 2));

        // 2. Test Recommendation
        console.log("\n--- Testing Layer 2: Recommendations ---");
        // Mock a full report for better context
        const fullReport = {
            processes: diagnosis.level || 2,
            culture: 2,
            data: 1,
            security: 1
        };
        const initiatives = await AiService.generateInitiatives(fullReport);
        console.log(`Generated ${initiatives.length} initiatives.`);
        console.log("First Initiative:", initiatives[0]);

        // 3. Test Roadmap
        console.log("\n--- Testing Layer 3: Roadmap ---");
        const roadmap = await AiService.buildRoadmap(initiatives);
        console.log("Roadmap Year 1 Q1:", roadmap.year1?.q1);

        // 4. Test Simulation
        console.log("\n--- Testing Layer 4: Simulation ---");
        const simulation = await AiService.simulateEconomics(initiatives);
        console.log("Simulation:", simulation);

    } catch (e) {
        console.error("TEST FAILED:", e);
    }

    // Exit roughly
    setTimeout(() => process.exit(0), 1000);

}, 1000);
