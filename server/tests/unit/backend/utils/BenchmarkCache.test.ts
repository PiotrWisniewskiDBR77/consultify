/**
 * Benchmark Cache Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.3: Testy dla Utils Layer - 100% coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { benchmarkCache } from '../../../src/utils/BenchmarkCache.js';

describe('BenchmarkCache', () => {
    beforeEach(() => {
        benchmarkCache.clear();
    });

    describe('get', () => {
        it('should return null for non-existent key', () => {
            const result = benchmarkCache.get('non-existent');
            expect(result).toBeNull();
        });

        it('should return cached data for existing key', () => {
            const data = { value: 'test' };
            benchmarkCache.set('test-key', data);
            const result = benchmarkCache.get('test-key');
            expect(result).toEqual(data);
        });

        it('should return null for expired entry', async () => {
            const data = { value: 'test' };
            benchmarkCache.set('test-key', data);
            
            // Mock Date.now to simulate expiration
            const originalNow = Date.now;
            Date.now = vi.fn(() => originalNow() + 3600001); // 1 hour + 1ms

            const result = benchmarkCache.get('test-key');
            expect(result).toBeNull();

            Date.now = originalNow;
        });
    });

    describe('set', () => {
        it('should store data in cache', () => {
            const data = { value: 'test' };
            benchmarkCache.set('test-key', data);
            const result = benchmarkCache.get('test-key');
            expect(result).toEqual(data);
        });

        it('should overwrite existing cache entry', () => {
            benchmarkCache.set('test-key', { value: 'old' });
            benchmarkCache.set('test-key', { value: 'new' });
            const result = benchmarkCache.get('test-key');
            expect(result).toEqual({ value: 'new' });
        });
    });

    describe('clear', () => {
        it('should clear all cache entries', () => {
            benchmarkCache.set('key1', { value: '1' });
            benchmarkCache.set('key2', { value: '2' });
            benchmarkCache.clear();
            
            expect(benchmarkCache.get('key1')).toBeNull();
            expect(benchmarkCache.get('key2')).toBeNull();
        });
    });

    describe('clearExpired', () => {
        it('should remove expired entries', async () => {
            benchmarkCache.set('key1', { value: '1' });
            benchmarkCache.set('key2', { value: '2' });
            
            // Mock Date.now to simulate expiration for key1
            const originalNow = Date.now;
            const baseTime = originalNow();
            Date.now = vi.fn(() => baseTime + 3600001); // Expired
            
            benchmarkCache.clearExpired();
            
            expect(benchmarkCache.get('key1')).toBeNull();
            
            // Reset Date.now for key2 check
            Date.now = vi.fn(() => baseTime);
            expect(benchmarkCache.get('key2')).toEqual({ value: '2' });

            Date.now = originalNow;
        });

        it('should keep non-expired entries', () => {
            benchmarkCache.set('key1', { value: '1' });
            benchmarkCache.clearExpired();
            
            expect(benchmarkCache.get('key1')).toEqual({ value: '1' });
        });
    });
});



