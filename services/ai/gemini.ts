import { GoogleGenerativeAI, Content } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

export const initializeGemini = () => {
    if (!API_KEY) {
        console.warn("Missing VITE_GOOGLE_API_KEY - AI features will not work.");
        return;
    }
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
};

export interface AIMessageHistory {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export const sendMessageToAI = async (
    history: AIMessageHistory[],
    message: string,
    systemInstruction?: string
) => {
    if (!model) initializeGemini();

    if (!model) {
        // Fallback for missing key to prevent crash, though UI should handle it
        return "I'm sorry, but I cannot process your request right now (Missing API Key).";
    }

    try {
        // Start chat with history
        // Note: Gemini 1.5 Flash supports system instructions via startChat or getGenerativeModel, 
        // but for simple chat history, we pass it in startChat if supported or prepend to history.
        // For now, prompt engineering in history is safer across versions.

        let chatHistory = [...history];

        // If system instruction is provided and it's a new chat, we might want to prepend it as a 'user' message or use the systemInstruction param if creating model.
        // But since model is singleton here, we can just rely on the ongoing conversation context.
        // A common pattern is to just start the chat.

        const chat = model.startChat({
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: 800,
            },
            systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error sending message to Gemini:", error);
        return "I encountered an error while processing your request. Please try again.";
    }
};

export const SYSTEM_PROMPTS = {
    FREE_ASSESSMENT: `You are an expert Digital Transformation Consultant named 'Consultify AI'. 
    Your goal is to conduct a 3-step assessment interview with a manufacturing company representative.
    
    Structure:
    1. **Profile**: Gather key info (Role, Industry, Size, Country) if not already known.
    2. **Challenges**: Identify the main pain point (Processes, Data, Culture, Automation). Dig deeper into specific issues.
    3. **Recommendations**: Propose 3 high-impact "Quick Wins" tailored to their situation.
    
    Tone: Professional, concise, consultative, and encouraging.
    
    Important instructions:
    - Do NOT give long lectures. Keep responses short (under 3 sentences usually).
    - Ask ONE question at a time.
    - If the user provides short answers, ask for clarification to ensure high-quality advice.
    - When you have enough info for a step, explicitly transition to the next step.
    - At the end of Step 3, suggest they unlock the FULL Assessment for a deep dive.
    `
};
