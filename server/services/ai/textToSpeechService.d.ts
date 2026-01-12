export default textToSpeechService;
export class TextToSpeechService {
    config: {
        providers: {
            openai: {
                name: string;
                priority: number;
                voices: {
                    id: string;
                    name: string;
                    gender: string;
                    description: string;
                }[];
                models: string[];
                defaultModel: string;
                defaultVoice: string;
                maxChars: number;
                outputFormats: string[];
            };
            edge: {
                name: string;
                priority: number;
                defaultVoice: string;
                voicesByLanguage: {
                    pl: string[];
                    en: string[];
                    de: string[];
                    es: string[];
                    ja: string[];
                    ar: string[];
                    fr: string[];
                    it: string[];
                    pt: string[];
                    ru: string[];
                    zh: string[];
                    ko: string[];
                };
                maxChars: number;
            };
        };
        fallbackOrder: string[];
        defaultLanguage: string;
        defaultSpeed: number;
        cleanTextForSpeech: boolean;
    };
    openai: OpenAI | null;
    /**
     * Initialize OpenAI client
     */
    _initOpenAI(): void;
    /**
     * Main synthesis method with automatic fallback
     *
     * @param {string} text - Text to convert to speech
     * @param {Object} options - Synthesis options
     * @param {string} options.language - Language code (e.g., 'pl', 'en')
     * @param {string} options.provider - Force specific provider
     * @param {string} options.voice - Voice ID
     * @param {number} options.speed - Speech speed (0.25 - 4.0)
     * @param {string} options.model - TTS model (for OpenAI)
     * @param {string} options.format - Output format (mp3, opus, etc.)
     * @returns {Promise<Object>} Audio result with buffer and metadata
     */
    synthesize(text: string, options?: {
        language: string;
        provider: string;
        voice: string;
        speed: number;
        model: string;
        format: string;
    }): Promise<Object>;
    /**
     * Stream synthesis for real-time playback
     *
     * @param {string} text - Text to convert
     * @param {Object} options - Same as synthesize()
     * @returns {AsyncGenerator} Yields audio chunks
     */
    synthesizeStream(text: string, options?: Object): AsyncGenerator;
    /**
     * Synthesize with a specific provider
     */
    _synthesizeWithProvider(providerId: any, text: any, options: any): Promise<{
        audio: Buffer<ArrayBuffer>;
        contentType: string;
        voice: any;
    }>;
    /**
     * OpenAI TTS synthesis
     */
    _synthesizeWithOpenAI(text: any, options: any): Promise<{
        audio: Buffer<ArrayBuffer>;
        contentType: string;
        voice: any;
    }>;
    /**
     * Edge TTS synthesis (Microsoft free voices)
     */
    _synthesizeWithEdge(text: any, options: any): Promise<{
        audio: Buffer<ArrayBuffer>;
        contentType: string;
        voice: any;
    }>;
    /**
     * Get list of healthy providers in priority order
     */
    _getHealthyProviders(): string[];
    /**
     * Get available voices for a language
     */
    getVoices(language?: null): any[];
    /**
     * Get best voice for a language
     */
    getBestVoice(language: any): {
        provider: string;
        voice: any;
    };
    /**
     * Get provider health status
     */
    getHealthStatus(): {
        providers: ({
            healthy: boolean;
            lastError: null;
            errorCount: number;
            latencyMs: number;
            id: string;
            name: any;
        } | {
            healthy: boolean;
            lastError: null;
            errorCount: number;
            latencyMs: number;
            id: string;
            name: any;
        })[];
        healthyProviders: string[];
        primaryProvider: string | null;
    };
    /**
     * Reset provider health (for recovery)
     */
    resetProviderHealth(providerId?: null): void;
    /**
     * Test provider connectivity
     */
    testProvider(providerId: any): Promise<{
        success: boolean;
        latencyMs: number;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        latencyMs?: undefined;
    }>;
}
export const textToSpeechService: TextToSpeechService;
export namespace TTS_CONFIG {
    namespace providers {
        namespace openai {
            let name: string;
            let priority: number;
            let voices: {
                id: string;
                name: string;
                gender: string;
                description: string;
            }[];
            let models: string[];
            let defaultModel: string;
            let defaultVoice: string;
            let maxChars: number;
            let outputFormats: string[];
        }
        namespace edge {
            let name_1: string;
            export { name_1 as name };
            let priority_1: number;
            export { priority_1 as priority };
            let defaultVoice_1: string;
            export { defaultVoice_1 as defaultVoice };
            export namespace voicesByLanguage {
                let pl: string[];
                let en: string[];
                let de: string[];
                let es: string[];
                let ja: string[];
                let ar: string[];
                let fr: string[];
                let it: string[];
                let pt: string[];
                let ru: string[];
                let zh: string[];
                let ko: string[];
            }
            let maxChars_1: number;
            export { maxChars_1 as maxChars };
        }
    }
    let fallbackOrder: string[];
    let defaultLanguage: string;
    let defaultSpeed: number;
    let cleanTextForSpeech: boolean;
}
/**
 * Clean text for speech synthesis
 * Removes markdown, code blocks, and other non-speech content
 */
export function cleanTextForSpeech(text: any): any;
/**
 * Split long text into chunks for TTS
 */
export function splitTextIntoChunks(text: any, maxLength?: number): any[];
import OpenAI from 'openai';
//# sourceMappingURL=textToSpeechService.d.ts.map