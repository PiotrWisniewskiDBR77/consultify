/**
 * Content Management Tests
 * Tests for CMS-like content operations
 * 
 * @module tests/content/content-manager.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Content manager
const createContentManager = () => {
    const contents = new Map();
    const versions = new Map(); // contentId -> versions[]
    const relationships = new Map(); // contentId -> related[]

    return {
        create: (type, data, options = {}) => {
            const content = {
                id: crypto.randomUUID(),
                type,
                data,
                status: options.status || 'draft',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                createdBy: options.author || 'system',
                version: 1,
                slug: options.slug || null,
                metadata: options.metadata || {},
            };

            contents.set(content.id, content);
            versions.set(content.id, [{ ...content }]);

            return content;
        },

        get: (id) => contents.get(id) || null,

        getBySlug: (slug) => {
            for (const content of contents.values()) {
                if (content.slug === slug) return content;
            }
            return null;
        },

        update: (id, updates) => {
            const content = contents.get(id);
            if (!content) return null;

            const previousVersion = { ...content };
            Object.assign(content, updates, {
                updatedAt: Date.now(),
                version: content.version + 1,
            });

            const contentVersions = versions.get(id) || [];
            contentVersions.push({ ...content });
            versions.set(id, contentVersions);

            return content;
        },

        delete: (id) => {
            versions.delete(id);
            relationships.delete(id);
            return contents.delete(id);
        },

        publish: (id) => {
            return this.update(id, { status: 'published', publishedAt: Date.now() });
        },

        unpublish: (id) => {
            return this.update(id, { status: 'draft', publishedAt: null });
        },

        archive: (id) => {
            return this.update(id, { status: 'archived', archivedAt: Date.now() });
        },

        getVersions: (id) => versions.get(id) || [],

        revertToVersion: (id, versionNumber) => {
            const contentVersions = versions.get(id);
            if (!contentVersions) return null;

            const targetVersion = contentVersions.find(v => v.version === versionNumber);
            if (!targetVersion) return null;

            return this.update(id, {
                data: targetVersion.data,
                revertedFrom: targetVersion.version,
            });
        },

        query: (filters = {}) => {
            let results = [...contents.values()];

            if (filters.type) {
                results = results.filter(c => c.type === filters.type);
            }
            if (filters.status) {
                results = results.filter(c => c.status === filters.status);
            }
            if (filters.author) {
                results = results.filter(c => c.createdBy === filters.author);
            }

            // Sorting
            if (filters.sortBy) {
                results.sort((a, b) => {
                    const aVal = a[filters.sortBy];
                    const bVal = b[filters.sortBy];
                    return filters.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
                });
            }

            // Pagination
            if (filters.limit) {
                const offset = filters.offset || 0;
                results = results.slice(offset, offset + filters.limit);
            }

            return results;
        },

        relate: (fromId, toId, type = 'related') => {
            const rels = relationships.get(fromId) || [];
            rels.push({ contentId: toId, type, createdAt: Date.now() });
            relationships.set(fromId, rels);
        },

        getRelated: (id, type = null) => {
            const rels = relationships.get(id) || [];
            const filtered = type ? rels.filter(r => r.type === type) : rels;
            return filtered.map(r => contents.get(r.contentId)).filter(Boolean);
        },
    };
};

// Content scheduler
const createContentScheduler = () => {
    const scheduled = new Map();

    return {
        schedulePublish: (contentId, publishAt) => {
            scheduled.set(contentId, {
                contentId,
                action: 'publish',
                scheduledAt: publishAt,
                createdAt: Date.now(),
            });
        },

        scheduleUnpublish: (contentId, unpublishAt) => {
            scheduled.set(`${contentId}-unpublish`, {
                contentId,
                action: 'unpublish',
                scheduledAt: unpublishAt,
                createdAt: Date.now(),
            });
        },

        cancel: (contentId) => {
            scheduled.delete(contentId);
            scheduled.delete(`${contentId}-unpublish`);
        },

        getDue: () => {
            const now = Date.now();
            return [...scheduled.values()]
                .filter(s => s.scheduledAt <= now);
        },

        getScheduled: (contentId) => {
            return scheduled.get(contentId) || scheduled.get(`${contentId}-unpublish`) || null;
        },

        getAllScheduled: () => [...scheduled.values()],
    };
};

// Taxonomy manager
const createTaxonomyManager = () => {
    const taxonomies = new Map(); // taxonomy name -> terms
    const assignments = new Map(); // contentId -> terms

    return {
        createTaxonomy: (name, options = {}) => {
            taxonomies.set(name, {
                name,
                hierarchical: options.hierarchical ?? false,
                terms: new Map(),
            });
        },

        addTerm: (taxonomyName, term, parentId = null) => {
            const taxonomy = taxonomies.get(taxonomyName);
            if (!taxonomy) return null;

            const termData = {
                id: crypto.randomUUID(),
                name: term.name,
                slug: term.slug || term.name.toLowerCase().replace(/\s+/g, '-'),
                parentId,
                description: term.description || '',
            };

            taxonomy.terms.set(termData.id, termData);
            return termData;
        },

        getTerms: (taxonomyName, parentId = null) => {
            const taxonomy = taxonomies.get(taxonomyName);
            if (!taxonomy) return [];

            return [...taxonomy.terms.values()]
                .filter(t => t.parentId === parentId);
        },

        assignTerm: (contentId, termId) => {
            const terms = assignments.get(contentId) || new Set();
            terms.add(termId);
            assignments.set(contentId, terms);
        },

        removeTerm: (contentId, termId) => {
            const terms = assignments.get(contentId);
            if (terms) {
                terms.delete(termId);
            }
        },

        getContentTerms: (contentId) => {
            const termIds = assignments.get(contentId) || new Set();
            const result = [];

            for (const taxonomy of taxonomies.values()) {
                for (const [id, term] of taxonomy.terms) {
                    if (termIds.has(id)) {
                        result.push({ ...term, taxonomy: taxonomy.name });
                    }
                }
            }

            return result;
        },

        getContentByTerm: (termId, contentManager) => {
            const contentIds = [];
            for (const [contentId, terms] of assignments) {
                if (terms.has(termId)) {
                    contentIds.push(contentId);
                }
            }
            return contentIds.map(id => contentManager?.get(id)).filter(Boolean);
        },
    };
};

// Slug generator
const createSlugGenerator = () => {
    const usedSlugs = new Set();

    return {
        generate: (text, options = {}) => {
            let slug = text
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-');

            if (options.maxLength) {
                slug = slug.substring(0, options.maxLength);
            }

            // Ensure uniqueness
            let finalSlug = slug;
            let counter = 1;
            while (usedSlugs.has(finalSlug)) {
                finalSlug = `${slug}-${counter}`;
                counter++;
            }

            usedSlugs.add(finalSlug);
            return finalSlug;
        },

        isAvailable: (slug) => !usedSlugs.has(slug),

        release: (slug) => usedSlugs.delete(slug),

        reserve: (slug) => {
            if (usedSlugs.has(slug)) return false;
            usedSlugs.add(slug);
            return true;
        },
    };
};

describe('Content Manager Tests', () => {
    let cms;

    beforeEach(() => {
        cms = createContentManager();
    });

    it('should create content', () => {
        const content = cms.create('article', { title: 'Test', body: 'Content' });

        expect(content.id).toBeTruthy();
        expect(content.type).toBe('article');
        expect(content.status).toBe('draft');
    });

    it('should get by slug', () => {
        cms.create('page', { title: 'About' }, { slug: 'about-us' });

        const page = cms.getBySlug('about-us');
        expect(page.data.title).toBe('About');
    });

    it('should update content', () => {
        const content = cms.create('article', { title: 'Original' });
        cms.update(content.id, { data: { title: 'Updated' } });

        const updated = cms.get(content.id);
        expect(updated.data.title).toBe('Updated');
        expect(updated.version).toBe(2);
    });

    it('should publish and unpublish', () => {
        const content = cms.create('article', {});

        cms.publish(content.id);
        expect(cms.get(content.id).status).toBe('published');

        cms.unpublish(content.id);
        expect(cms.get(content.id).status).toBe('draft');
    });

    it('should track versions', () => {
        const content = cms.create('article', { v: 1 });
        cms.update(content.id, { data: { v: 2 } });
        cms.update(content.id, { data: { v: 3 } });

        const versions = cms.getVersions(content.id);
        expect(versions).toHaveLength(3);
    });

    it('should revert to version', () => {
        const content = cms.create('article', { title: 'v1' });
        cms.update(content.id, { data: { title: 'v2' } });

        cms.revertToVersion(content.id, 1);

        const reverted = cms.get(content.id);
        expect(reverted.data.title).toBe('v1');
    });

    it('should query content', () => {
        cms.create('article', {}, { status: 'published' });
        cms.create('article', {}, { status: 'draft' });
        cms.create('page', {}, { status: 'published' });

        const articles = cms.query({ type: 'article' });
        expect(articles).toHaveLength(2);

        const published = cms.query({ status: 'published' });
        expect(published).toHaveLength(2);
    });

    it('should manage relationships', () => {
        const article = cms.create('article', {});
        const related1 = cms.create('article', {});
        const related2 = cms.create('article', {});

        cms.relate(article.id, related1.id);
        cms.relate(article.id, related2.id);

        const related = cms.getRelated(article.id);
        expect(related).toHaveLength(2);
    });
});

describe('Content Scheduler Tests', () => {
    let scheduler;

    beforeEach(() => {
        scheduler = createContentScheduler();
    });

    it('should schedule publish', () => {
        const futureTime = Date.now() + 60000;
        scheduler.schedulePublish('content-1', futureTime);

        const scheduled = scheduler.getScheduled('content-1');
        expect(scheduled.action).toBe('publish');
    });

    it('should get due items', () => {
        scheduler.schedulePublish('past', Date.now() - 1000);
        scheduler.schedulePublish('future', Date.now() + 60000);

        const due = scheduler.getDue();
        expect(due).toHaveLength(1);
        expect(due[0].contentId).toBe('past');
    });

    it('should cancel scheduled', () => {
        scheduler.schedulePublish('content-1', Date.now() + 1000);
        scheduler.cancel('content-1');

        expect(scheduler.getScheduled('content-1')).toBeNull();
    });
});

describe('Taxonomy Manager Tests', () => {
    let taxonomy;

    beforeEach(() => {
        taxonomy = createTaxonomyManager();
        taxonomy.createTaxonomy('categories', { hierarchical: true });
        taxonomy.createTaxonomy('tags');
    });

    it('should add terms', () => {
        const tech = taxonomy.addTerm('categories', { name: 'Technology' });

        expect(tech.id).toBeTruthy();
        expect(tech.slug).toBe('technology');
    });

    it('should support hierarchical terms', () => {
        const parent = taxonomy.addTerm('categories', { name: 'Tech' });
        const child = taxonomy.addTerm('categories', { name: 'JavaScript' }, parent.id);

        expect(child.parentId).toBe(parent.id);
    });

    it('should assign terms to content', () => {
        const term = taxonomy.addTerm('tags', { name: 'Featured' });
        taxonomy.assignTerm('content-1', term.id);

        const contentTerms = taxonomy.getContentTerms('content-1');
        expect(contentTerms).toHaveLength(1);
        expect(contentTerms[0].name).toBe('Featured');
    });
});

describe('Slug Generator Tests', () => {
    let slugGen;

    beforeEach(() => {
        slugGen = createSlugGenerator();
    });

    it('should generate slug from text', () => {
        const slug = slugGen.generate('Hello World');
        expect(slug).toBe('hello-world');
    });

    it('should handle special characters', () => {
        const slug = slugGen.generate('Test & Demo! @2024');
        expect(slug).toBe('test--demo-2024');
    });

    it('should ensure uniqueness', () => {
        const slug1 = slugGen.generate('Test');
        const slug2 = slugGen.generate('Test');

        expect(slug1).toBe('test');
        expect(slug2).toBe('test-1');
    });

    it('should check availability', () => {
        slugGen.generate('taken');

        expect(slugGen.isAvailable('taken')).toBe(false);
        expect(slugGen.isAvailable('available')).toBe(true);
    });

    it('should release slug', () => {
        slugGen.generate('temp');
        slugGen.release('temp');

        expect(slugGen.isAvailable('temp')).toBe(true);
    });
});
