import { z } from 'zod';

// Analysis Phase Schema (ANALYST role)
export const AnalysisSchema = z.object({
    executiveSummary: z.object({
        currentState: z.string(),
        targetState: z.string(),
        gapAnalysis: z.string()
    }),
    dimensions: z.array(z.object({
        name: z.string(),
        currentLevel: z.number(),
        targetLevel: z.number(),
        gap: z.number(),
        keyFindings: z.array(z.string())
    })),
    dataQuality: z.object({
        completeness: z.number(),
        concerns: z.array(z.string())
    })
});

// Strategy Phase Schema (STRATEGIST role)
export const StrategySchema = z.object({
    executiveSummary: z.string().describe('One-paragraph executive summary for C-level'),
    strategicRecommendations: z.array(z.object({
        priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
        title: z.string(),
        description: z.string(),
        expectedImpact: z.string(),
        timeframe: z.string()
    })),
    roadmap: z.object({
        phase1: z.object({ title: z.string(), initiatives: z.array(z.string()) }),
        phase2: z.object({ title: z.string(), initiatives: z.array(z.string()) }),
        phase3: z.object({ title: z.string(), initiatives: z.array(z.string()) })
    }),
    riskFactors: z.array(z.object({
        risk: z.string(),
        mitigation: z.string()
    }))
});
