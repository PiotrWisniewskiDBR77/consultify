/**
 * Ollama Integration Tests
 * 
 * Tests for verifying local Ollama LLM server connectivity and functionality.
 * Prerequisites: Ollama must be running at http://localhost:11434
 * 
 * NOTE: These tests are SKIPPED if Ollama server is not properly configured
 * Set OLLAMA_TEST=true environment variable to run these tests
 */

import { describe, it, expect, beforeAll } from 'vitest';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'gemma3:27b';
const TEST_TIMEOUT = 60000; // 60 seconds for LLM responses

// Skip tests by default unless explicitly enabled
const OLLAMA_ENABLED = process.env.OLLAMA_TEST === 'true';

describe.skipIf(!OLLAMA_ENABLED)('Ollama Local LLM Integration', () => {

    describe('Server Health', () => {
        it('should have Ollama server running', async () => {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
            expect(response.ok).toBe(true);
        }, TEST_TIMEOUT);

        it('should list available models', async () => {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
            const data = await response.json();

            expect(data).toHaveProperty('models');
            expect(Array.isArray(data.models)).toBe(true);
            expect(data.models.length).toBeGreaterThan(0);
        }, TEST_TIMEOUT);

        it('should have gemma model available', async () => {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
            const data = await response.json();

            const hasGemma = data.models?.some((m: any) =>
                m.name.includes('gemma3') || m.name.includes('gemma')
            );

            expect(hasGemma).toBe(true);
        }, TEST_TIMEOUT);
    });

    describe('API Generate Endpoint', () => {
        it('should generate a response (non-streaming)', async () => {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: DEFAULT_MODEL,
                    prompt: 'Say "Hello" and nothing else.',
                    stream: false,
                }),
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data).toHaveProperty('response');
        }, TEST_TIMEOUT);

        it('should generate streaming response', async () => {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: DEFAULT_MODEL,
                    prompt: 'Count from 1 to 3.',
                    stream: true,
                }),
            });

            expect(response.ok).toBe(true);
        }, TEST_TIMEOUT);
    });

    describe('OpenAI Compatible API', () => {
        it('should respond to chat completions (OpenAI format)', async () => {
            const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ollama',
                },
                body: JSON.stringify({
                    model: DEFAULT_MODEL,
                    messages: [
                        { role: 'user', content: 'What is 2+2?' }
                    ],
                    max_tokens: 50,
                    stream: false,
                }),
            });

            expect(response.ok).toBe(true);
        }, TEST_TIMEOUT);
    });

    describe('Error Handling', () => {
        it('should handle invalid model gracefully', async () => {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'non-existent-model-12345',
                    prompt: 'Hello',
                    stream: false,
                }),
            });

            expect([400, 404]).toContain(response.status);
        }, TEST_TIMEOUT);
    });
});

describe.skipIf(!OLLAMA_ENABLED)('Performance', () => {
    it('should respond within reasonable time', async () => {
        const startTime = Date.now();

        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                prompt: 'Say OK.',
                stream: false,
            }),
        });

        const duration = Date.now() - startTime;

        expect(response.ok).toBe(true);
        expect(duration).toBeLessThan(60000);
    }, TEST_TIMEOUT);
});
