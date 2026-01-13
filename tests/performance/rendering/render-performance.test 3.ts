/**
 * Rendering Performance Tests
 * Testing render performance
 * 
 * @module tests/performance/rendering/render-performance.test.ts
 */

import { describe, it, expect } from 'vitest';

describe('Rendering Performance Tests', () => {
    describe('JSON Serialization Performance', () => {
        it('should serialize large object under 50ms', () => {
            const largeObject = {
                users: Array.from({ length: 1000 }, (_, i) => ({
                    id: i,
                    name: `User ${i}`,
                    email: `user${i}@example.com`,
                    profile: { avatar: `url-${i}`, bio: `Bio ${i}` }
                })),
                metadata: { total: 1000, page: 1, perPage: 100 }
            };

            const start = Date.now();
            const json = JSON.stringify(largeObject);
            const elapsed = Date.now() - start;

            expect(json.length).toBeGreaterThan(0);
            expect(elapsed).toBeLessThan(50);
        });

        it('should parse large JSON under 30ms', () => {
            const jsonString = JSON.stringify(
                Array.from({ length: 1000 }, (_, i) => ({ id: i, data: `value-${i}` }))
            );

            const start = Date.now();
            const parsed = JSON.parse(jsonString);
            const elapsed = Date.now() - start;

            expect(parsed.length).toBe(1000);
            expect(elapsed).toBeLessThan(30);
        });
    });

    describe('Template Rendering Performance', () => {
        it('should render template with 100 items under 20ms', () => {
            const items = Array.from({ length: 100 }, (_, i) => ({
                id: i,
                title: `Item ${i}`,
                description: `Description for item ${i}`
            }));

            const start = Date.now();

            const rendered = items.map(item =>
                `<div class="item" data-id="${item.id}">
                    <h2>${item.title}</h2>
                    <p>${item.description}</p>
                </div>`
            ).join('\n');

            const elapsed = Date.now() - start;

            expect(rendered.length).toBeGreaterThan(0);
            expect(elapsed).toBeLessThan(20);
        });

        it('should render nested templates under 30ms', () => {
            const data = {
                sections: Array.from({ length: 10 }, (_, s) => ({
                    title: `Section ${s}`,
                    items: Array.from({ length: 10 }, (_, i) => ({
                        name: `Item ${s}-${i}`,
                        value: Math.random()
                    }))
                }))
            };

            const start = Date.now();

            const rendered = data.sections.map(section =>
                `<section>
                    <h2>${section.title}</h2>
                    <ul>
                        ${section.items.map(item =>
                    `<li>${item.name}: ${item.value.toFixed(2)}</li>`
                ).join('')}
                    </ul>
                </section>`
            ).join('\n');

            const elapsed = Date.now() - start;

            expect(rendered.length).toBeGreaterThan(0);
            expect(elapsed).toBeLessThan(30);
        });
    });

    describe('Data Transformation Performance', () => {
        it('should transform 10000 records under 50ms', () => {
            const records = Array.from({ length: 10000 }, (_, i) => ({
                firstName: `First${i}`,
                lastName: `Last${i}`,
                age: 20 + (i % 50),
                email: `user${i}@test.com`
            }));

            const start = Date.now();

            const transformed = records.map(r => ({
                fullName: `${r.firstName} ${r.lastName}`,
                isAdult: r.age >= 18,
                contact: r.email.toLowerCase()
            }));

            const elapsed = Date.now() - start;

            expect(transformed.length).toBe(10000);
            expect(elapsed).toBeLessThan(50);
        });
    });
});
