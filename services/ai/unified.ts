import { AIProviderConfig, AIMessageHistory } from '../../types';
import { Api } from '../api';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const UnifiedAI = {
    sendMessage: async (
        config: AIProviderConfig | undefined,
        history: AIMessageHistory[],
        message: string,
        systemInstruction?: string
    ): Promise<string> => {
        const provider = config?.provider || 'system';

        // Send message via configured provider

        // --- 1. SYSTEM (Backend Proxy) ---
        if (provider === 'system') {
            // Note: Api.chatWithSystemAI needs to be implemented or we reuse existing endpoints
            // Existing endpoint seems to be managed via server/routes/ai.js -> POST /chat or similar
            // Looking at api.ts might be needed, but assuming standard POST structure for now.
            // We'll use a generic endpoint that the backend handles.
            return Api.chatWithAI(message, history, systemInstruction);
        }

        // --- 2. GOOGLE GEMINI (Client Side) ---
        if (provider === 'gemini') {
            if (!config?.apiKey) throw new Error("Missing API Key for Gemini");

            try {
                const genAI = new GoogleGenerativeAI(config.apiKey);
                const model = genAI.getGenerativeModel({ model: config.modelId || "gemini-1.5-flash" });

                const chat = model.startChat({
                    history: history, // Type match might need adjustment if SDK differs slightly
                    generationConfig: { maxOutputTokens: 1000 },
                    systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
                });

                const result = await chat.sendMessage(message);
                const response = await result.response;
                return response.text();
            } catch (error: any) {
                throw new Error(`Gemini Error: ${error.message}`);
            }
        }

        // --- 3. OPENAI (Client Side) ---
        if (provider === 'openai') {
            if (!config?.apiKey) throw new Error("Missing API Key for OpenAI");
            try {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify({
                        model: config.modelId || "gpt-4-turbo",
                        messages: [
                            ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
                            ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
                            { role: "user", content: message }
                        ]
                    })
                });

                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                return data.choices[0].message.content;
            } catch (error: any) {
                return `OpenAI Error: ${error.message}`;
            }
        }

        // --- 4. OLLAMA (Local) ---
        if (provider === 'ollama') {
            const endpoint = config?.endpoint || "http://localhost:11434";
            const modelId = config?.modelId || "llama3";

            try {
                const response = await fetch(`${endpoint}/api/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: modelId,
                        messages: [
                            ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
                            ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
                            { role: "user", content: message }
                        ],
                        stream: false
                    })
                });
                const data = await response.json();
                return data.message.content;
            } catch (error: any) {
                return `Ollama Error: Is it running at ${endpoint}? ${error.message}`;
            }
        }

        return "Unknown Provider";
    },

    sendMessageStream: async (
        config: AIProviderConfig | undefined,
        history: AIMessageHistory[],
        message: string,
        onChunk: (text: string) => void,
        onDone: () => void,
        systemInstruction?: string
    ): Promise<void> => {
        const provider = config?.provider || 'system';

        if (provider === 'system') {
            return Api.chatWithAIStream(message, history, onChunk, onDone, systemInstruction);
        }

        // For CLIENT-SIDE providers (Gemini/OpenAI), we can implement streaming here too if needed.
        // For now, let's just fallback to non-streaming for them or implement basic logic.
        if (provider === 'gemini') {
            if (!config?.apiKey) throw new Error("Missing API Key for Gemini");
            try {
                const genAI = new GoogleGenerativeAI(config.apiKey);
                const model = genAI.getGenerativeModel({ model: config.modelId || "gemini-1.5-flash" });
                const chat = model.startChat({
                    history: history,
                    generationConfig: { maxOutputTokens: 1000 },
                    systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
                });
                const result = await chat.sendMessageStream(message);
                for await (const chunk of result.stream) {
                    onChunk(chunk.text());
                }
                onDone();
            } catch (e: any) {
                console.error("Gemini Stream Error", e);
                onDone();
            }
            return;
        }

        // Fallback for others
        const fullResponse = await UnifiedAI.sendMessage(config, history, message, systemInstruction);
        onChunk(fullResponse);
        onDone();
    }
};
