import { sendMessageToAI, AIMessageHistory } from './gemini';
import { FullInitiative, CompanyProfile, FullSession } from '../../types';

/**
 * AI Agent Service
 * Responsible for "Deep Generation" - turning skeletal structures into expert content.
 */

export const Agent = {

    /**
     * Enriches a skeletal initiative with a professional business case, risks, and milestones.
     * This corresponds to the work a Senior Consultant would do.
     */
    enrichInitiativeWithAI: async (
        initiative: FullInitiative,
        profile: Partial<CompanyProfile>,
        fullSessionResponse: FullSession
    ): Promise<Partial<FullInitiative>> => {

        // Construct the "Senior Consultant" prompt
        const context = `
      CONTEXT:
      You are an expert Digital Transformation Architect working for ${profile.name || "a Client"}, a ${profile.industry || "Company"} in ${profile.country || "the Global Market"}.
      
      TASK:
      The client has identified a high-level initiative: "${initiative.name}".
      Currently, the description is generic: "${initiative.description}".
      
      YOUR JOB:
       Rewrite this into a comprehensive "Business Case" ready for a CFO/CEO decision. 
       You MUST generate specific, realistic content based on the industry best practices.
      
      OUTPUT FORMAT:
      Return ONLY a raw JSON object (no markdown, no backticks) with the following structure:
      {
        "description": "2-3 sentences executive summary of what we are doing.",
        "problemStatement": "What specifically is broken? (e.g., 'Current manual inventory tracking leads to 15% stockouts'). Avoid generic text.",
        "businessValue": "High" | "Medium" | "Low",
        "deliverables": ["List of 3-5 concrete outputs, e.g., 'Automated Dashboard', 'New CRM Schema'"],
        "keyRisks": [
           { "risk": "Specific failure mode", "mitigation": "Specific solution", "metric": "Medium" }
        ],
        "milestones": [
           { "name": "Phase 1 Name", "date": "2024-Q2", "status": "pending" }
        ]
      }
    `;

        try {
            // We send this as a "User" message to trigger the specific response. 
            // In a real agent system, we might have a dedicated system prompt for "Generator".
            const history: AIMessageHistory[] = []; // Stateless call for this specific task

            const responseText = await sendMessageToAI(history, context);

            // Sanitization: Remove markdown code blocks if the model adds them
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

            const generatedData = JSON.parse(cleanJson);

            return generatedData;

        } catch (error) {
            console.error("AI Agent failed to enrich initiative:", error);
            // Fallback: Return empty or partial to avoid breaking the UI
            return {};
        }
    },

    /**
     * Proactively analyzes the entire session state to find risks, opportunities, and anomalies.
     * This powers the "Morning Briefing" on the dashboard.
     */
    analyzeSessionForInsights: async (
        session: FullSession,
        companyName: string
    ): Promise<{ type: 'risk' | 'opportunity' | 'anomaly', text: string, impact: string }[]> => {

        const context = `
            ACT AS: Chief Strategy Officer (Artificial Intelligence).
            
            CLIENT: ${companyName}
            DATA SUMMARY:
            - Initiatives: ${session.initiatives?.length || 0} active.
            - ROI Projection: ${session.economics?.overallROI || 0}%.
            - Key Weakness (Assessment): [AI to infer from low scores if available].
            
            TASK:
            Analyze the implicit connections in the data. Find 3 CRITICAL insights that a human might miss.
            - Is there a mismatch between budget and ambition?
            - Is there a "Fast Track" opportunity?
            - Is there a hidden risk in the timeline?
            
            OUTPUT FORMAT:
            Return ONLY a raw JSON array:
            [
              { "type": "risk", "text": "Short description of the risk", "impact": "High" },
              { "type": "opportunity", "text": "Short description of the win", "impact": "Medium" }
            ]
            Max 3 items. Be concise.
        `;

        try {
            const history: AIMessageHistory[] = [];
            const responseText = await sendMessageToAI(history, context);
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            console.error("AI Insight Analysis failed", e);
            return [];
        }
    },

    /**
     * Conducts an interactive interview for a specific assessment axis.
     * It asks the next question based on chat history or concludes with a score.
     */
    conductAssessmentInterview: async (
        axis: string,
        chatHistory: { role: 'user' | 'model', text: string }[],
        language: string = 'en'
    ): Promise<{
        nextQuestion?: string;
        conclusion?: { score: number; reasoning: string };
        isFinished: boolean;
    }> => {

        const context = `
            ACT AS: specialized Auditor for Digital Maturity in "${axis}".
            LANGUAGE: ${language === 'pl' ? 'Polish' : 'English'}.
            
            GOAL: Determine the maturity score (1.0 - 5.0) for this specific axis.
            
            PROCESS:
            1. Short, concise questions (one at a time).
            2. Adapt to user answers.
            3. After 3-4 exchanges, CONCLUDE.
            
            HISTORY:
            ${chatHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n')}
            
            INSTRUCTION:
            If you have enough info, return a JSON with "conclusion".
            If not, return a JSON with "nextQuestion".
            
            OUTPUT FORMAT (JSON ONLY):
            EITHER:
            { "isFinished": false, "nextQuestion": "Your next question here?" }
            OR:
            { "isFinished": true, "conclusion": { "score": 3.5, "reasoning": "User has basics but lacks automation." } }
        `;

        try {
            // We pass empty history to sending function because we injected history into the prompt context manually 
            // to have tighter control over the "system" instructions.
            const responseText = await sendMessageToAI([], context);
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            console.error("AI Interview failed", e);
            // Fallback
            return { isFinished: false, nextQuestion: "Could you elaborate on your current processes?" };
        }
    }
};
