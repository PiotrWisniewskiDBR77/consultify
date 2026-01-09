/**
 * Knowledge Service Unit Tests
 * 
 * Tests for knowledge base management - articles, search, versioning.
 * 
 * @module tests/unit/backend/knowledgeService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create knowledge service implementation
const createKnowledgeService = () => {
    const articles = new Map();
    const versions = new Map();

    return {
        // Create article
        create: async (data) => {
            if (!data.title) throw new Error('Title is required');

            const id = `kb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const article = {
                id,
                title: data.title,
                content: data.content || '',
                summary: data.summary || '',
                author: data.author,
                category: data.category || 'general',
                tags: data.tags || [],
                status: data.status || 'draft',
                version: 1,
                views: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                publishedAt: null
            };

            articles.set(id, article);
            versions.set(id, [{ version: 1, content: article.content, updatedAt: article.updatedAt }]);

            return article;
        },

        // Get by ID
        getById: async (id) => {
            return articles.get(id) || null;
        },

        // Update article (creates version)
        update: async (id, updates) => {
            const article = articles.get(id);
            if (!article) throw new Error('Article not found');

            const newVersion = article.version + 1;
            const updated = {
                ...article,
                ...updates,
                version: newVersion,
                updatedAt: new Date().toISOString()
            };

            articles.set(id, updated);

            // Save version history
            const history = versions.get(id) || [];
            history.push({ version: newVersion, content: updated.content, updatedAt: updated.updatedAt });
            versions.set(id, history);

            return updated;
        },

        // Publish article
        publish: async (id) => {
            const article = articles.get(id);
            if (!article) throw new Error('Article not found');

            const updated = {
                ...article,
                status: 'published',
                publishedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            articles.set(id, updated);
            return updated;
        },

        // Archive article
        archive: async (id) => {
            const article = articles.get(id);
            if (!article) throw new Error('Article not found');

            const updated = { ...article, status: 'archived', updatedAt: new Date().toISOString() };
            articles.set(id, updated);
            return updated;
        },

        // Delete article
        delete: async (id) => {
            versions.delete(id);
            return articles.delete(id);
        },

        // Search articles
        search: async (query, options = {}) => {
            const { category, status = 'published', limit = 10 } = options;
            const results = [];
            const queryLower = query.toLowerCase();

            for (const article of articles.values()) {
                if (status && article.status !== status) continue;
                if (category && article.category !== category) continue;

                const titleScore = article.title.toLowerCase().includes(queryLower) ? 0.6 : 0;
                const contentScore = article.content.toLowerCase().includes(queryLower) ? 0.3 : 0;
                const tagScore = article.tags.some(t => t.toLowerCase().includes(queryLower)) ? 0.1 : 0;
                const score = titleScore + contentScore + tagScore;

                if (score > 0 || !query) {
                    results.push({ ...article, score });
                }
            }

            return results.sort((a, b) => b.score - a.score).slice(0, limit);
        },

        // Get version history
        getVersions: async (id) => {
            return versions.get(id) || [];
        },

        // Restore version
        restoreVersion: async (id, targetVersion) => {
            const history = versions.get(id);
            if (!history) throw new Error('Article not found');

            const version = history.find(v => v.version === targetVersion);
            if (!version) throw new Error('Version not found');

            return this.update(id, { content: version.content });
        },

        // List by category
        listByCategory: async (category) => {
            return Array.from(articles.values())
                .filter(a => a.category === category && a.status === 'published');
        },

        // Get categories with counts
        getCategories: async () => {
            const cats = new Map();
            for (const article of articles.values()) {
                if (article.status === 'published') {
                    cats.set(article.category, (cats.get(article.category) || 0) + 1);
                }
            }
            return Array.from(cats.entries()).map(([name, count]) => ({ name, count }));
        },

        // Clear for testing
        clear: () => {
            articles.clear();
            versions.clear();
        }
    };
};

describe('KnowledgeService', () => {
    let knowledgeService;

    beforeEach(() => {
        knowledgeService = createKnowledgeService();
    });

    describe('Article Creation', () => {
        it('should create a knowledge article', async () => {
            const article = await knowledgeService.create({
                title: 'Introduction to Testing',
                content: 'Learn how to write effective tests',
                author: 'user-1',
                category: 'tutorials',
                tags: ['testing', 'beginner']
            });

            expect(article.id).toBeDefined();
            expect(article.title).toBe('Introduction to Testing');
            expect(article.version).toBe(1);
            expect(article.status).toBe('draft');
        });

        it('should require title', async () => {
            await expect(knowledgeService.create({ content: 'No title' }))
                .rejects.toThrow('Title is required');
        });
    });

    describe('Article Updates', () => {
        it('should update article and increment version', async () => {
            const created = await knowledgeService.create({
                title: 'Version 1',
                content: 'Original content'
            });

            const updated = await knowledgeService.update(created.id, {
                content: 'Updated content'
            });

            expect(updated.version).toBe(2);
            expect(updated.content).toBe('Updated content');
        });

        it('should track version history', async () => {
            const created = await knowledgeService.create({
                title: 'Test',
                content: 'Version 1'
            });

            await knowledgeService.update(created.id, { content: 'Version 2' });
            await knowledgeService.update(created.id, { content: 'Version 3' });

            const history = await knowledgeService.getVersions(created.id);
            expect(history.length).toBe(3);
        });
    });

    describe('Publishing', () => {
        it('should publish draft article', async () => {
            const created = await knowledgeService.create({
                title: 'Draft Article',
                content: 'Ready to publish'
            });

            const published = await knowledgeService.publish(created.id);

            expect(published.status).toBe('published');
            expect(published.publishedAt).toBeDefined();
        });

        it('should archive published article', async () => {
            const created = await knowledgeService.create({ title: 'Test' });
            await knowledgeService.publish(created.id);

            const archived = await knowledgeService.archive(created.id);
            expect(archived.status).toBe('archived');
        });
    });

    describe('Search', () => {
        beforeEach(async () => {
            const a1 = await knowledgeService.create({
                title: 'JavaScript Basics',
                content: 'Learn JavaScript fundamentals',
                category: 'programming',
                tags: ['javascript', 'beginner']
            });
            await knowledgeService.publish(a1.id);

            const a2 = await knowledgeService.create({
                title: 'Python Tutorial',
                content: 'Introduction to Python',
                category: 'programming',
                tags: ['python', 'beginner']
            });
            await knowledgeService.publish(a2.id);

            const a3 = await knowledgeService.create({
                title: 'Project Management Guide',
                content: 'How to manage projects effectively',
                category: 'business',
                tags: ['management']
            });
            await knowledgeService.publish(a3.id);
        });

        it('should search by title', async () => {
            const results = await knowledgeService.search('JavaScript');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].title).toContain('JavaScript');
        });

        it('should search by content', async () => {
            const results = await knowledgeService.search('fundamentals');
            expect(results.length).toBeGreaterThan(0);
        });

        it('should filter by category', async () => {
            const results = await knowledgeService.search('', { category: 'programming' });
            expect(results.every(r => r.category === 'programming')).toBe(true);
        });

        it('should only return published articles by default', async () => {
            await knowledgeService.create({ title: 'Draft Only', content: 'Not published' });

            const results = await knowledgeService.search('Draft');
            expect(results.length).toBe(0);
        });

        it('should rank by relevance score', async () => {
            const results = await knowledgeService.search('tutorial');
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
            }
        });
    });

    describe('Categories', () => {
        it('should get category counts', async () => {
            const a1 = await knowledgeService.create({ title: 'A1', category: 'tech' });
            const a2 = await knowledgeService.create({ title: 'A2', category: 'tech' });
            const a3 = await knowledgeService.create({ title: 'A3', category: 'business' });

            await knowledgeService.publish(a1.id);
            await knowledgeService.publish(a2.id);
            await knowledgeService.publish(a3.id);

            const categories = await knowledgeService.getCategories();
            const tech = categories.find(c => c.name === 'tech');
            expect(tech.count).toBe(2);
        });
    });

    describe('Delete', () => {
        it('should delete article and version history', async () => {
            const created = await knowledgeService.create({ title: 'Delete Me' });

            const result = await knowledgeService.delete(created.id);
            expect(result).toBe(true);

            const article = await knowledgeService.getById(created.id);
            expect(article).toBeNull();

            const versions = await knowledgeService.getVersions(created.id);
            expect(versions.length).toBe(0);
        });
    });
});
