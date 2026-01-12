declare namespace _default {
    export { SpeechToTextService };
    export { speechToTextService };
    export { STT_CONFIG };
}
export default _default;
export class SpeechToTextService {
    config: {
        providers: {
            whisper: {
                name: string;
                priority: number;
                maxFileSize: number;
                supportedFormats: string[];
                supportedLanguages: string[];
                defaultModel: string;
            };
            deepgram: {
                name: string;
                priority: number;
                maxFileSize: number;
                supportedFormats: string[];
                supportedLanguages: string[];
                defaultModel: string;
            };
        };
        fallbackOrder: string[];
        defaultLanguage: string;
        timeoutMs: number;
    };
    openai: any;
    deepgramApiKey: string | undefined;
    /**
     * Initialize OpenAI client
     */
    _initOpenAI(): void;
    /**
     * Main transcription method with automatic fallback
     *
     * @param {Buffer|string} audio - Audio data (Buffer) or file path (string)
     * @param {Object} options - Transcription options
     * @param {string} options.language - Language code (e.g., 'pl', 'en')
     * @param {string} options.provider - Force specific provider
     * @param {string} options.format - Audio format (auto-detected if not provided)
     * @param {boolean} options.timestamps - Include word timestamps
     * @returns {Promise<Object>} Transcription result
     */
    transcribe(audio: Buffer | string, options?: {
        language: string;
        provider: string;
        format: string;
        timestamps: boolean;
    }): Promise<Object>;
    /**
     * Transcribe with a specific provider
     */
    _transcribeWithProvider(providerId: any, audio: any, options: any): Promise<{
        text: any;
        language: any;
        confidence: any;
        words: any;
    }>;
    /**
     * OpenAI Whisper transcription
     */
    _transcribeWithWhisper(audio: any, options: any): Promise<{
        text: any;
        language: any;
        confidence: number;
        words: any;
        segments: any;
    }>;
    /**
     * Deepgram transcription
     */
    _transcribeWithDeepgram(audio: any, options: any): Promise<{
        text: any;
        language: any;
        confidence: any;
        words: any;
    }>;
    /**
     * Get list of healthy providers in priority order
     */
    _getHealthyProviders(): string[];
    /**
     * Detect audio format from buffer or filename
     */
    _detectFormat(audio: any): string;
    /**
     * Check if a language is supported
     */
    isLanguageSupported(language: any, provider?: null): any;
    /**
     * Get supported languages
     */
    getSupportedLanguages(): any[];
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
    /**
     * Create a minimal silent WAV for testing
     */
    _createSilentAudio(): Buffer<ArrayBuffer>;
}
export const speechToTextService: SpeechToTextService;
export namespace STT_CONFIG {
    namespace providers {
        namespace whisper {
            let name: string;
            let priority: number;
            let maxFileSize: number;
            let supportedFormats: string[];
            let supportedLanguages: string[];
            let defaultModel: string;
        }
        namespace deepgram {
            let name_1: string;
            export { name_1 as name };
            let priority_1: number;
            export { priority_1 as priority };
            let maxFileSize_1: number;
            export { maxFileSize_1 as maxFileSize };
            let supportedFormats_1: string[];
            export { supportedFormats_1 as supportedFormats };
            let supportedLanguages_1: string[];
            export { supportedLanguages_1 as supportedLanguages };
            let defaultModel_1: string;
            export { defaultModel_1 as defaultModel };
        }
    }
    let fallbackOrder: string[];
    let defaultLanguage: string;
    let timeoutMs: number;
}
//# sourceMappingURL=speechToTextService.d.ts.map