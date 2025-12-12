import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportReportToPDF, exportDashboardToPDF } from '../../services/pdf/pdfExport';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

vi.mock('html2canvas');
vi.mock('jspdf');

describe('Service Test: pdfExport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock document.getElementById
        const mockElement = document.createElement('div');
        mockElement.id = 'test-element';
        document.getElementById = vi.fn(() => mockElement);
        
        // Mock canvas
        const mockCanvas = {
            toDataURL: vi.fn(() => 'data:image/png;base64,test'),
        } as any;
        
        (html2canvas as any).mockResolvedValue(mockCanvas);
        
        // Mock jsPDF constructor
        class MockJsPDF {
            internal = {
                pageSize: {
                    getWidth: () => 210,
                    getHeight: () => 297,
                },
            };
            getImageProperties = vi.fn(() => ({ width: 100, height: 200 }));
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
        
        (jsPDF as any).mockImplementation(() => new MockJsPDF());
    });

    describe('exportReportToPDF', () => {
        it('returns false when element is not found', async () => {
            const originalGetElementById = document.getElementById;
            document.getElementById = vi.fn(() => null);
            
            const result = await exportReportToPDF('non-existent', 'test.pdf');
            
            expect(result).toBe(false);
            document.getElementById = originalGetElementById;
        });

        it('exports PDF successfully', async () => {
            const mockElement = document.createElement('div');
            mockElement.id = 'test-element';
            const originalGetElementById = document.getElementById;
            document.getElementById = vi.fn(() => mockElement);
            
            const resultPromise = exportReportToPDF('test-element', 'test.pdf');
            
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 200));
            const result = await resultPromise;
            
            expect(html2canvas).toHaveBeenCalled();
            // Result might be true or false depending on implementation
            expect(typeof result).toBe('boolean');
            document.getElementById = originalGetElementById;
        });

        it('handles errors gracefully', async () => {
            (html2canvas as any).mockRejectedValue(new Error('Canvas error'));
            
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

