
import { UnifiedAI } from './unified';
import { useAppStore } from '../../store/useAppStore';

export interface AIMessageHistory {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export const sendMessageToAI = async (
    history: AIMessageHistory[],
    message: string,
    systemInstruction?: string,
    roleName?: string
) => {
    // Get current configuration from store
    const state = useAppStore.getState();
    const config = state.currentUser?.aiConfig;

    try {
        return await UnifiedAI.sendMessage(config, history, message, systemInstruction, roleName);
    } catch (error) {
        console.error("Error sending message to AI:", error);
        return "I encountered an error while processing your request. Please check your AI settings.";
    }
};

export const sendMessageToAIStream = async (
    history: AIMessageHistory[],
    message: string,
    onChunk: (text: string) => void,
    onDone: () => void,
    systemInstruction?: string,
    roleName?: string
) => {
    const state = useAppStore.getState();
    const config = state.currentUser?.aiConfig;

    try {
        await UnifiedAI.sendMessageStream(config, history, message, onChunk, onDone, systemInstruction, roleName);
    } catch (error) {
        console.error("Error sending message to AI (stream):", error);
        onChunk("I encountered an error while processing your request.");
        onDone();
    }
};

export const SYSTEM_PROMPTS = {
    FREE_ASSESSMENT: `You are 'Consultify AI', a senior Digital Transformation Consultant.You are speaking with a business leader in the manufacturing sector.

    Your Objective: Guide the user through a strategic discovery conversation to understand their manufacturing maturity and identify high - value opportunities.

    The conversation has 3 natural phases(do not announce them, just guide the flow):
1. ** Context & Profile **: Naturally gather their Role, Industry, Company Size, and Country if not already clear.
    2. ** Deep Dive Analysis **: deeply explore their operational challenges.Ask probing "Why" questions.Don't just accept "inefficiency" - ask where specifically (e.g. "Is it in the planning phase or production line?").
3. ** Strategic Recommendations **: Propose 3 tailored implementation ideas(Quick Wins) that solve their specific pain points.

    ** Critical Personality Instructions:**
    - ** Be sharp and concise **: CEOs don't have time for fluff. Keep responses under 3 sentences unless proposing the final solution.
    - ** No Robotic Confirmations **: Never say "Thank you for sharing that" or "I understand".Just dive into the next relevant thought or question.
    - ** Be Curious **: If they say something vague, challenge it politely. "You mentioned poor data quality - is that manual entry errors or missing sensor data?"
    - ** Drive Value **: Every question you ask should feel like it's leading to a solution, not just filling a form.

    At the end of the recommendation phase, strongly advise unlocking the "Full Assessment" for a comprehensive roadmap and ROI calculation.
    `
};

export type RefineContext = 'objective' | 'blocker' | 'general' | 'location' | 'constraint';

const REFINE_PROMPTS: Record<RefineContext, string> = {
    objective: "Refine this business objective to be SMART (Specific, Measurable, Achievable, Relevant, Time-bound), strategic, and concise. Use consultant-grade language (e.g. 'Optimize', 'Leverage', 'Accelerate').",
    blocker: "Refine this operational blocker description to clearly identify the root cause and impact. Be specific and professional. Avoid blame, focus on structural/process issues.",
    constraint: "Refine this constraint description to specifically articulate the limitation and its business impact.",
    location: "Format and refine this list of locations/entities for clarity.",
    general: "Refine this text to be more professional, concise, and impactful."
};

export const refineContent = async (text: string, context: RefineContext = 'general'): Promise<string> => {
    if (!text || text.length < 5) return text;

    const systemPrompt = `You are a Tier - 1 Strategy Consultant(McKinsey / BCG style). 
    Your task is to REWRITE the user's input to be professional, precise, and impactful.

Context: ${REFINE_PROMPTS[context]}

Rules:
- Keep the original meaning.
    - Make it sound executive and confident.
    - Fix grammar and style.
    - Return ONLY the rewritten text, no explanations.`;

    const response = await sendMessageToAI(
        [{ role: 'user', parts: [{ text }] }],
        text,
        systemPrompt
    );

    return response || text;
};
