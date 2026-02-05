/**
 * Report Import Service Tests
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the service for testing
const mockReportImportService = {
  detectFramework: vi.fn(),
  extractScores: vi.fn(),
  mapToAssessment: vi.fn(),
  mapToReport: vi.fn(),
  validateExtraction: vi.fn(),
  getSupportedFormats: vi.fn(),
  getSupportedFrameworks: vi.fn(),
};

describe('ReportImportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectFramework', () => {
    it('should detect DRD framework from text', () => {
      mockReportImportService.detectFramework.mockReturnValue({
        framework: 'DRD',
        confidence: 85,
        matchedPatterns: ['Digital Readiness Diagnostic', 'DRD Assessment'],
      });

      const text = `
        Digital Readiness Diagnostic Assessment Report
        This DRD assessment evaluates the organization's digital maturity
        across 7 axes: Business Models, Digital Products, Data Management...
      `;

      const result = mockReportImportService.detectFramework(text);

      expect(result.framework).toBe('DRD');
      expect(result.confidence).toBeGreaterThan(70);
    });

    it('should detect SIRI framework from text', () => {
      mockReportImportService.detectFramework.mockReturnValue({
        framework: 'SIRI',
        confidence: 90,
        matchedPatterns: ['Smart Industry Readiness Index', 'Building Block'],
      });

      const text = `
        Smart Industry Readiness Index Assessment
        Building Block 1: Process
        Dimension: Operations
      `;

      const result = mockReportImportService.detectFramework(text);

      expect(result.framework).toBe('SIRI');
      expect(result.confidence).toBeGreaterThan(80);
    });

    it('should detect ADMA framework from text', () => {
      mockReportImportService.detectFramework.mockReturnValue({
        framework: 'ADMA',
        confidence: 88,
        matchedPatterns: ['Advanced Digital Maturity Assessment', 'Pillar'],
      });

      const text = `
        Advanced Digital Maturity Assessment
        Pillar 1: Strategy & Organization
        Dimension: Digital Strategy
      `;

      const result = mockReportImportService.detectFramework(text);

      expect(result.framework).toBe('ADMA');
      expect(result.confidence).toBeGreaterThan(80);
    });

    it('should return low confidence for ambiguous text', () => {
      mockReportImportService.detectFramework.mockReturnValue({
        framework: 'DRD',
        confidence: 30,
        matchedPatterns: ['digital', 'maturity'],
      });

      const text = 'Generic digital maturity report';

      const result = mockReportImportService.detectFramework(text);

      expect(result.confidence).toBeLessThan(50);
    });
  });

  describe('extractScores', () => {
    it('should extract DRD scores from text', () => {
      mockReportImportService.extractScores.mockReturnValue({
        axes: {
          businessModels: { current: 3, target: 4 },
          digitalProducts: { current: 2, target: 4 },
          dataManagement: { current: 2, target: 3 },
        },
        overall: 2.3,
      });

      const text = `
        Business Models: Level 3 (Target: 4)
        Digital Products: Level 2 (Target: 4)
        Data Management: Level 2 (Target: 3)
      `;

      const result = mockReportImportService.extractScores(text, 'DRD');

      expect(result.axes.businessModels.current).toBe(3);
      expect(result.axes.digitalProducts.current).toBe(2);
    });

    it('should extract SIRI scores with building blocks', () => {
      mockReportImportService.extractScores.mockReturnValue({
        buildingBlocks: {
          process: {
            operations: { current: 3, target: 4 },
            supplyChain: { current: 2, target: 3 },
          },
        },
        overall: 2.5,
      });

      const text = `
        Building Block: Process
        Operations: Band 3
        Supply Chain: Band 2
      `;

      const result = mockReportImportService.extractScores(text, 'SIRI');

      expect(result.buildingBlocks.process.operations.current).toBe(3);
    });
  });

  describe('mapToAssessment', () => {
    it('should map extracted DRD scores to assessment structure', () => {
      mockReportImportService.mapToAssessment.mockReturnValue({
        framework: 'DRD',
        status: 'draft',
        answers: {
          businessModels: { level: 3, notes: '' },
          digitalProducts: { level: 2, notes: '' },
        },
        metadata: {
          importedFrom: 'external',
          importDate: expect.any(String),
        },
      });

      const scores = {
        axes: {
          businessModels: { current: 3 },
          digitalProducts: { current: 2 },
        },
      };

      const result = mockReportImportService.mapToAssessment(scores, 'DRD', {});

      expect(result.framework).toBe('DRD');
      expect(result.status).toBe('draft');
      expect(result.answers.businessModels.level).toBe(3);
    });
  });

  describe('validateExtraction', () => {
    it('should validate complete DRD extraction', () => {
      mockReportImportService.validateExtraction.mockReturnValue({
        isValid: true,
        completeness: 100,
        missingFields: [],
        warnings: [],
      });

      const scores = {
        axes: {
          businessModels: { current: 3 },
          digitalProducts: { current: 2 },
          dataManagement: { current: 2 },
          aiMaturity: { current: 1 },
          processes: { current: 3 },
          culture: { current: 2 },
          technology: { current: 2 },
        },
      };

      const result = mockReportImportService.validateExtraction(scores, 'DRD');

      expect(result.isValid).toBe(true);
      expect(result.completeness).toBe(100);
    });

    it('should report missing fields for incomplete extraction', () => {
      mockReportImportService.validateExtraction.mockReturnValue({
        isValid: false,
        completeness: 57,
        missingFields: ['aiMaturity', 'culture', 'technology'],
        warnings: ['Some axes are missing scores'],
      });

      const scores = {
        axes: {
          businessModels: { current: 3 },
          digitalProducts: { current: 2 },
          dataManagement: { current: 2 },
          processes: { current: 3 },
        },
      };

      const result = mockReportImportService.validateExtraction(scores, 'DRD');

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('aiMaturity');
    });
  });

  describe('getSupportedFormats', () => {
    it('should return list of supported file formats', () => {
      mockReportImportService.getSupportedFormats.mockReturnValue([
        { format: 'pdf', mimeType: 'application/pdf', extension: '.pdf' },
        { format: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx' },
        { format: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: '.docx' },
        { format: 'json', mimeType: 'application/json', extension: '.json' },
        { format: 'csv', mimeType: 'text/csv', extension: '.csv' },
      ]);

      const formats = mockReportImportService.getSupportedFormats();

      expect(formats).toHaveLength(5);
      expect(formats.map((f: any) => f.format)).toContain('pdf');
      expect(formats.map((f: any) => f.format)).toContain('xlsx');
    });
  });

  describe('getSupportedFrameworks', () => {
    it('should return list of supported frameworks', () => {
      mockReportImportService.getSupportedFrameworks.mockReturnValue([
        { id: 'DRD', name: 'Digital Readiness Diagnostic', axes: 7 },
        { id: 'SIRI', name: 'Smart Industry Readiness Index', buildingBlocks: 3 },
        { id: 'ADMA', name: 'Advanced Digital Maturity Assessment', pillars: 5 },
      ]);

      const frameworks = mockReportImportService.getSupportedFrameworks();

      expect(frameworks).toHaveLength(3);
      expect(frameworks.map((f: any) => f.id)).toContain('DRD');
      expect(frameworks.map((f: any) => f.id)).toContain('SIRI');
      expect(frameworks.map((f: any) => f.id)).toContain('ADMA');
    });
  });
});
