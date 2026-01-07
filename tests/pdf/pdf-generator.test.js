/**
 * PDF Generation Tests
 * Tests for PDF document creation
 * 
 * @module tests/pdf/pdf-generator.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// PDF Document builder
const createPDFDocument = () => {
    const pages = [];
    let currentPage = null;
    const metadata = {};

    const createPage = (options = {}) => {
        const { width = 595, height = 842, margin = 50 } = options; // A4 default

        return {
            width,
            height,
            margin,
            elements: [],
            cursor: { x: margin, y: margin },
        };
    };

    return {
        addPage: (options) => {
            currentPage = createPage(options);
            pages.push(currentPage);
            return currentPage;
        },

        getCurrentPage: () => currentPage,

        getPageCount: () => pages.length,

        setMetadata: (key, value) => {
            metadata[key] = value;
        },

        getMetadata: () => ({ ...metadata }),

        // Text operations
        addText: (text, options = {}) => {
            if (!currentPage) this.addPage();

            const { x, y, fontSize = 12, fontFamily = 'Helvetica', color = '#000000', align = 'left' } = options;

            currentPage.elements.push({
                type: 'text',
                content: text,
                x: x ?? currentPage.cursor.x,
                y: y ?? currentPage.cursor.y,
                fontSize,
                fontFamily,
                color,
                align,
            });

            // Update cursor
            currentPage.cursor.y += fontSize * 1.2;
        },

        addHeading: (text, level = 1) => {
            const sizes = { 1: 24, 2: 20, 3: 16, 4: 14, 5: 12, 6: 10 };
            this.addText(text, { fontSize: sizes[level] || 12, fontFamily: 'Helvetica-Bold' });
            currentPage.cursor.y += 10; // Extra spacing
        },

        addParagraph: (text, options = {}) => {
            if (!currentPage) this.addPage();

            const { width = currentPage.width - 2 * currentPage.margin, lineHeight = 1.5 } = options;
            const words = text.split(' ');
            let line = '';
            const charWidth = 6; // Approximate

            for (const word of words) {
                const testLine = line + (line ? ' ' : '') + word;
                if (testLine.length * charWidth > width) {
                    this.addText(line);
                    line = word;
                } else {
                    line = testLine;
                }
            }

            if (line) {
                this.addText(line);
            }

            currentPage.cursor.y += 10; // Paragraph spacing
        },

        // Image operations
        addImage: (imageData, options = {}) => {
            if (!currentPage) this.addPage();

            const { x, y, width = 100, height = 100 } = options;

            currentPage.elements.push({
                type: 'image',
                data: imageData,
                x: x ?? currentPage.cursor.x,
                y: y ?? currentPage.cursor.y,
                width,
                height,
            });

            currentPage.cursor.y += height + 10;
        },

        // Table operations
        addTable: (data, options = {}) => {
            if (!currentPage) this.addPage();

            const { headers, columnWidths, rowHeight = 20 } = options;

            currentPage.elements.push({
                type: 'table',
                data,
                headers,
                columnWidths,
                rowHeight,
                x: currentPage.cursor.x,
                y: currentPage.cursor.y,
            });

            const totalRows = (headers ? 1 : 0) + data.length;
            currentPage.cursor.y += totalRows * rowHeight + 10;
        },

        // Drawing operations
        drawLine: (x1, y1, x2, y2, options = {}) => {
            if (!currentPage) this.addPage();

            currentPage.elements.push({
                type: 'line',
                x1, y1, x2, y2,
                ...options,
            });
        },

        drawRect: (x, y, width, height, options = {}) => {
            if (!currentPage) this.addPage();

            currentPage.elements.push({
                type: 'rect',
                x, y, width, height,
                ...options,
            });
        },

        // Export
        getPages: () => pages.map(p => ({ ...p, elements: [...p.elements] })),

        toJSON: () => ({
            metadata,
            pages: pages.map(p => ({ ...p })),
        }),
    };
};

// PDF Template engine
const createPDFTemplate = (template) => {
    return {
        render: (data) => {
            const doc = createPDFDocument();

            for (const section of template.sections) {
                switch (section.type) {
                    case 'header':
                        doc.addPage();
                        doc.addHeading(section.title, 1);
                        break;

                    case 'text':
                        const text = section.content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
                        doc.addParagraph(text);
                        break;

                    case 'table':
                        const tableData = data[section.dataKey] || [];
                        doc.addTable(tableData, { headers: section.headers });
                        break;

                    case 'pageBreak':
                        doc.addPage();
                        break;
                }
            }

            return doc;
        },
    };
};

// PDF Merger
const createPDFMerger = () => {
    const documents = [];

    return {
        add: (doc) => {
            documents.push(doc);
        },

        merge: () => {
            const merged = createPDFDocument();

            for (const doc of documents) {
                const pages = doc.getPages();
                for (const page of pages) {
                    merged.addPage({ width: page.width, height: page.height });
                    for (const element of page.elements) {
                        merged.getCurrentPage().elements.push(element);
                    }
                }
            }

            return merged;
        },

        getDocumentCount: () => documents.length,

        clear: () => {
            documents.length = 0;
        },
    };
};

describe('PDF Document Tests', () => {
    let doc;

    beforeEach(() => {
        doc = createPDFDocument();
    });

    it('should add page', () => {
        doc.addPage();

        expect(doc.getPageCount()).toBe(1);
    });

    it('should add text', () => {
        doc.addPage();
        doc.addText('Hello World');

        const page = doc.getCurrentPage();
        expect(page.elements[0].type).toBe('text');
        expect(page.elements[0].content).toBe('Hello World');
    });

    it('should add heading', () => {
        doc.addPage();
        doc.addHeading('Title', 1);

        const page = doc.getCurrentPage();
        expect(page.elements[0].fontSize).toBe(24);
    });

    it('should add paragraph with wrapping', () => {
        doc.addPage();
        doc.addParagraph('This is a long paragraph that should wrap across multiple lines when rendered.');

        const page = doc.getCurrentPage();
        expect(page.elements.length).toBeGreaterThan(0);
    });

    it('should add image', () => {
        doc.addPage();
        doc.addImage('base64data', { width: 200, height: 150 });

        const page = doc.getCurrentPage();
        expect(page.elements[0].type).toBe('image');
    });

    it('should add table', () => {
        doc.addPage();
        doc.addTable([
            ['Alice', '30'],
            ['Bob', '25'],
        ], { headers: ['Name', 'Age'] });

        const page = doc.getCurrentPage();
        expect(page.elements[0].type).toBe('table');
    });

    it('should set metadata', () => {
        doc.setMetadata('title', 'Test Document');
        doc.setMetadata('author', 'John Doe');

        const meta = doc.getMetadata();
        expect(meta.title).toBe('Test Document');
        expect(meta.author).toBe('John Doe');
    });

    it('should draw shapes', () => {
        doc.addPage();
        doc.drawLine(0, 0, 100, 100);
        doc.drawRect(50, 50, 100, 50);

        const page = doc.getCurrentPage();
        expect(page.elements.some(e => e.type === 'line')).toBe(true);
        expect(page.elements.some(e => e.type === 'rect')).toBe(true);
    });
});

describe('PDF Template Tests', () => {
    it('should render template with data', () => {
        const template = createPDFTemplate({
            sections: [
                { type: 'header', title: 'Report' },
                { type: 'text', content: 'Hello {{name}}!' },
            ],
        });

        const doc = template.render({ name: 'John' });

        expect(doc.getPageCount()).toBe(1);
    });

    it('should render tables from data', () => {
        const template = createPDFTemplate({
            sections: [
                { type: 'header', title: 'Users' },
                { type: 'table', dataKey: 'users', headers: ['Name', 'Email'] },
            ],
        });

        const doc = template.render({
            users: [['Alice', 'alice@test.com']],
        });

        const page = doc.getPages()[0];
        expect(page.elements.some(e => e.type === 'table')).toBe(true);
    });
});

describe('PDF Merger Tests', () => {
    let merger;

    beforeEach(() => {
        merger = createPDFMerger();
    });

    it('should merge documents', () => {
        const doc1 = createPDFDocument();
        doc1.addPage();
        doc1.addText('Page 1');

        const doc2 = createPDFDocument();
        doc2.addPage();
        doc2.addText('Page 2');

        merger.add(doc1);
        merger.add(doc2);

        const merged = merger.merge();

        expect(merged.getPageCount()).toBe(2);
    });

    it('should track document count', () => {
        merger.add(createPDFDocument());
        merger.add(createPDFDocument());

        expect(merger.getDocumentCount()).toBe(2);
    });
});
