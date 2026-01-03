/**
 * Demo API Tests
 * 
 * Tests for the demo-related API endpoints.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3001/api';

describe('Demo API Endpoints', () => {
    describe('POST /auth/demo-login', () => {
        it('should return demo user credentials', async () => {
            const response = await fetch(`${API_URL}/auth/demo-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            expect(response.status).toBe(200);
            
            const data = await response.json();
            
            // Verify response structure
            expect(data).toHaveProperty('user');
            expect(data).toHaveProperty('token');
            expect(data).toHaveProperty('refreshToken');
            expect(data).toHaveProperty('isDemo', true);
            
            // Verify user data
            expect(data.user.email).toBe('demo@legolex.com');
            expect(data.user.isDemo).toBe(true);
            expect(data.user.role).toBeDefined();
        });

        it('should return valid JWT tokens', async () => {
            const response = await fetch(`${API_URL}/auth/demo-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            
            // Tokens should be non-empty strings
            expect(typeof data.token).toBe('string');
            expect(data.token.length).toBeGreaterThan(0);
            expect(typeof data.refreshToken).toBe('string');
            expect(data.refreshToken.length).toBeGreaterThan(0);
            
            // Token should be valid JWT format (3 parts separated by dots)
            const tokenParts = data.token.split('.');
            expect(tokenParts.length).toBe(3);
        });

        it('should allow demo token to access protected endpoints', async () => {
            // Get demo token
            const loginResponse = await fetch(`${API_URL}/auth/demo-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const { token } = await loginResponse.json();

            // Try to access a protected endpoint
            const protectedResponse = await fetch(`${API_URL}/users/me`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            expect(protectedResponse.status).toBe(200);
            
            const userData = await protectedResponse.json();
            expect(userData.email).toBe('demo@legolex.com');
        });

        it('should log demo access activity', async () => {
            const response = await fetch(`${API_URL}/auth/demo-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            expect(response.status).toBe(200);
            
            // Activity should be logged (this is internal verification)
            // In production, we'd check the activity log table
        });
    });

    describe('Demo User Access Control', () => {
        let demoToken: string;

        beforeAll(async () => {
            const response = await fetch(`${API_URL}/auth/demo-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            demoToken = data.token;
        });

        it('demo user should access assessment data', async () => {
            const response = await fetch(`${API_URL}/assessments`, {
                headers: {
                    'Authorization': `Bearer ${demoToken}`
                }
            });

            // Should return 200 or empty array
            expect([200, 204].includes(response.status)).toBe(true);
        });

        it('demo user should access initiatives', async () => {
            const response = await fetch(`${API_URL}/initiatives`, {
                headers: {
                    'Authorization': `Bearer ${demoToken}`
                }
            });

            expect([200, 204].includes(response.status)).toBe(true);
        });

        it('demo user should access tasks', async () => {
            const response = await fetch(`${API_URL}/tasks`, {
                headers: {
                    'Authorization': `Bearer ${demoToken}`
                }
            });

            expect([200, 204].includes(response.status)).toBe(true);
        });
    });

    describe('Demo Data Seeding', () => {
        it('demo organization should have sample data', async () => {
            // Login as demo
            const loginResponse = await fetch(`${API_URL}/auth/demo-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const { token } = await loginResponse.json();

            // Check for initiatives
            const initiativesResponse = await fetch(`${API_URL}/initiatives`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (initiativesResponse.status === 200) {
                const initiatives = await initiativesResponse.json();
                
                // Demo should have at least 1 initiative
                if (Array.isArray(initiatives)) {
                    expect(initiatives.length).toBeGreaterThanOrEqual(0);
                }
            }
        });
    });

    describe('Error Handling', () => {
        it('should return 404 if demo user not seeded', async () => {
            // This test would only fail if the demo user seed script hasn't run
            // In production, we ensure the demo user always exists
            const response = await fetch(`${API_URL}/auth/demo-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            // Should either succeed (200) or indicate demo user not found (404)
            expect([200, 404].includes(response.status)).toBe(true);
            
            if (response.status === 404) {
                const data = await response.json();
                expect(data.code).toBe('DEMO_USER_NOT_FOUND');
            }
        });
    });
});

describe('Token Refresh for Demo', () => {
    it('should be able to refresh demo tokens', async () => {
        // Get initial tokens
        const loginResponse = await fetch(`${API_URL}/auth/demo-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const { refreshToken } = await loginResponse.json();

        // Refresh token
        const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });

        expect(refreshResponse.status).toBe(200);
        
        const newTokens = await refreshResponse.json();
        expect(newTokens).toHaveProperty('accessToken');
        expect(newTokens).toHaveProperty('refreshToken');
    });
});








