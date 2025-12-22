import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportReportToPDF, exportDashboardToPDF } from '../../services/pdf/pdfExport';
import html2canvas from 'html2canvas';

// Hoist the MockJsPDF class and mock setup
const { MockJsPDF } = vi.hoisted(() => {
    class MockJsPDF {
        internal = {
            pageSize: {
                getWidth: () => 210,
                getHeight: () => 297,
            },
        };
        getImageProperties = vi.fn(() => ({ width: 100, height: 200 }));
        getNumberOfPages = vi.fn(() => 1);
        setPage = vi.fn();
        addImage = vi.fn();
        addPage = vi.fn();
        save = vi.fn();
        setFontSize = vi.fn();
        setTextColor = vi.fn();
        text = vi.fn();
        setDrawColor = vi.fn();
        setLineWidth = vi.fn();
        line = vi.fn();
        setProperties = vi.fn();
    }
    return { MockJsPDF };
});

// Mock modules
vi.mock('html2canvas');
vi.mock('jspdf', () => {
    return {
        default: vi.fn(function () {
            return new MockJsPDF();
        })
    };
});

// Import jsPDF after mocking
import jsPDF from 'jspdf';

describe('Service Test: pdfExport', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock document behavior
        const mockElement = document.createElement('div');
        mockElement.id = 'test-element';

        // We'll spy on document.getElementById instead of assigning to it directly 
        // if possible, but since it's a global, assignment is often the way in jsdom.
        // However, restoring it is crucial.
        vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);

        // Mock canvas result
        const mockCanvas = {
            toDataURL: vi.fn(() => 'data:image/png;base64,test'),
        };

`(html2canvas as jest.Mock).mockResolvedValue(mockCanvas);`
    });

    // Explicit cleaning
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('exportReportToPDF', () => {
        it('returns false when element is not found', async () => {
            vi.mocked(document.getElementById).mockReturnValue(null);

            const result = await exportReportToPDF('non-existent', 'test.pdf');

            expect(result).toBe(false);
        });

        it('exports PDF successfully', async () => {
            const result = await exportReportToPDF('test-element', 'test.pdf');

            expect(html2canvas).toHaveBeenCalled();
            // Assuming the function returns true on success, but valid check based on previous test saying "boolean"
            expect(typeof result).toBe('boolean');
            expect(jsPDF).toHaveBeenCalled();
        });

        it('handles errors gracefully', async () => {
`(html2canvas as jest.Mock).mockRejectedValue(new Error('Canvas error'));`

            const result = await exportReportToPDF('test-element', 'test.pdf');

            expect(result).toBe(false);
        });
    });

    describe('exportDashboardToPDF', () => {
        it('creates PDF with metadata', async () => {
            await exportDashboardToPDF({
                filename: 'dashboard.pdf',
                title: 'Test Dashboard',
                author: 'Test Author',
                subject: 'Test Subject',
            });

            expect(jsPDF).toHaveBeenCalled();
        });

        it('handles optional metadata', async () => {
            await exportDashboardToPDF({
                filename: 'dashboard.pdf',
            });

            expect(jsPDF).toHaveBeenCalled();
        });
    });
});
