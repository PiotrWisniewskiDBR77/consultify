/**
 * Help Search Service Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HelpSearchService } from '../../services/helpSearchService';

describe('HelpSearchService', () => {
    let searchService: HelpSearchService;
    
    beforeEach(() => {
        searchService = new HelpSearchService();
    });
    
    describe('buildIndex', () => {
        it('should build index from modules, cards, and FAQs', () => {
            const index = searchService.getIndex();
            expect(index).toBeDefined();
            expect(index.modules.length).toBeGreaterThan(0);
            expect(index.cards.length).toBeGreaterThan(0);
            expect(index.faqs.length).toBeGreaterThan(0);
        });
        
        it('should include all expected module IDs', () => {
            const index = searchService.getIndex();
            const moduleIds = index.modules.map(m => m.id);
            
            expect(moduleIds).toContain('dashboard');
            expect(moduleIds).toContain('initiatives');
            expect(moduleIds).toContain('admin-users');
        });
        
        it('should include searchable text for each item', () => {
            const index = searchService.getIndex();
            
            index.modules.forEach(module => {
                expect(module.searchText).toBeDefined();
                expect(module.searchText.length).toBeGreaterThan(0);
            });
            
            index.cards.forEach(card => {
                expect(card.searchText).toBeDefined();
            });
            
            index.faqs.forEach(faq => {
                expect(faq.searchText).toBeDefined();
            });
        });
    });
    
    describe('search', () => {
        it('should return results for valid queries', () => {
            const results = searchService.search('dashboard');
            
            expect(results).toBeDefined();
            expect(results.length).toBeGreaterThan(0);
        });
        
        it('should return empty array for empty query', () => {
            const results = searchService.search('');
            expect(results).toEqual([]);
        });
        
        it('should return empty array for whitespace-only query', () => {
            const results = searchService.search('   ');
            expect(results).toEqual([]);
        });
        
        it('should handle special characters in query', () => {
            const results = searchService.search('test@#$%');
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });
        
        it('should be case insensitive', () => {
            const resultsLower = searchService.search('dashboard');
            const resultsUpper = searchService.search('DASHBOARD');
            
            expect(resultsLower.length).toBe(resultsUpper.length);
        });
        
        it('should prioritize exact matches', () => {
            const results = searchService.search('dashboard');
            
            if (results.length > 1) {
                // First result should have exact match
                expect(
                    results[0].title.toLowerCase().includes('dashboard') ||
                    results[0].id.toLowerCase().includes('dashboard')
                ).toBe(true);
            }
        });
        
        it('should limit results to specified maximum', () => {
            const results = searchService.search('a', { maxResults: 5 });
            expect(results.length).toBeLessThanOrEqual(5);
        });
        
        it('should filter by type when specified', () => {
            const results = searchService.search('settings', { type: 'faq' });
            
            results.forEach(result => {
                expect(result.type).toBe('faq');
            });
        });
        
        it('should include relevance score', () => {
            const results = searchService.search('dashboard');
            
            results.forEach(result => {
                expect(result.score).toBeDefined();
                expect(typeof result.score).toBe('number');
                expect(result.score).toBeGreaterThan(0);
            });
        });
    });
    
    describe('search results structure', () => {
        it('should return properly structured results', () => {
            const results = searchService.search('initiative');
            
            if (results.length > 0) {
                const result = results[0];
                
                expect(result).toHaveProperty('id');
                expect(result).toHaveProperty('type');
                expect(result).toHaveProperty('title');
                expect(result).toHaveProperty('description');
                expect(result).toHaveProperty('score');
            }
        });
        
        it('should include moduleId for card results', () => {
            const results = searchService.search('profile settings');
            const cardResults = results.filter(r => r.type === 'card');
            
            cardResults.forEach(result => {
                expect(result.moduleId).toBeDefined();
            });
        });
        
        it('should include answer for FAQ results', () => {
            const results = searchService.search('how');
            const faqResults = results.filter(r => r.type === 'faq');
            
            faqResults.forEach(result => {
                expect(result.answer).toBeDefined();
            });
        });
    });
    
    describe('multilingual search', () => {
        it('should find results in English', () => {
            const results = searchService.search('settings', { language: 'en' });
            expect(results.length).toBeGreaterThan(0);
        });
        
        it('should find results in Polish', () => {
            const results = searchService.search('ustawienia', { language: 'pl' });
            expect(results.length).toBeGreaterThan(0);
        });
        
        it('should return titles in correct language', () => {
            const resultsEn = searchService.search('dashboard', { language: 'en' });
            const resultsPl = searchService.search('dashboard', { language: 'pl' });
            
            if (resultsEn.length > 0 && resultsPl.length > 0) {
                // Titles should be in respective languages
                expect(typeof resultsEn[0].title).toBe('string');
                expect(typeof resultsPl[0].title).toBe('string');
            }
        });
    });
    
    describe('performance', () => {
        it('should complete search within 100ms', () => {
            const start = performance.now();
            searchService.search('dashboard');
            const end = performance.now();
            
            expect(end - start).toBeLessThan(100);
        });
        
        it('should handle multiple concurrent searches', async () => {
            const queries = ['dashboard', 'settings', 'project', 'initiative', 'admin'];
            
            const results = await Promise.all(
                queries.map(q => Promise.resolve(searchService.search(q)))
            );
            
            results.forEach(result => {
                expect(result).toBeDefined();
                expect(Array.isArray(result)).toBe(true);
            });
        });
    });
    
    describe('getRecentSearches', () => {
        it('should return empty array initially', () => {
            const recent = searchService.getRecentSearches();
            expect(recent).toEqual([]);
        });
        
        it('should track recent searches', () => {
            searchService.search('dashboard');
            searchService.search('settings');
            
            const recent = searchService.getRecentSearches();
            
            expect(recent).toContain('dashboard');
            expect(recent).toContain('settings');
        });
        
        it('should limit recent searches count', () => {
            for (let i = 0; i < 20; i++) {
                searchService.search(`query${i}`);
            }
            
            const recent = searchService.getRecentSearches();
            expect(recent.length).toBeLessThanOrEqual(10);
        });
        
        it('should not duplicate searches', () => {
            searchService.search('dashboard');
            searchService.search('dashboard');
            searchService.search('dashboard');
            
            const recent = searchService.getRecentSearches();
            const dashboardCount = recent.filter(q => q === 'dashboard').length;
            
            expect(dashboardCount).toBe(1);
        });
    });
    
    describe('clearRecentSearches', () => {
        it('should clear all recent searches', () => {
            searchService.search('dashboard');
            searchService.search('settings');
            searchService.clearRecentSearches();
            
            const recent = searchService.getRecentSearches();
            expect(recent).toEqual([]);
        });
    });
});

