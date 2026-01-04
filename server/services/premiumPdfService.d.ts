export default premiumPdfService;
declare const premiumPdfService: PremiumPdfService;
declare class PremiumPdfService {
    templatesDir: string;
    uploadsDir: string;
    browser: puppeteer.Browser | null;
    /**
     * Initialize browser instance (reuse for better performance)
     */
    getBrowser(): Promise<puppeteer.Browser>;
    /**
     * Load and compile a Handlebars template
     */
    loadTemplate(templateName: any): Promise<HandlebarsTemplateDelegate<any>>;
    /**
     * Load partials for the template
     */
    loadPartials(): Promise<void>;
    /**
     * Generate a premium PDF report
     */
    generatePDF(reportId: any, options?: {}): Promise<{
        pdf: Uint8Array<ArrayBufferLike>;
        filename: string;
        filepath: string;
        size: number;
    }>;
    /**
     * Get report data from database
     */
    getReportData(reportId: any): Promise<{
        id: any;
        name: any;
        status: any;
        assessmentId: any;
        assessmentName: any;
        organizationName: any;
        createdAt: any;
        updatedAt: any;
        sections: any;
        metrics: {
            overallMaturity: string;
            targetMaturity: string;
            totalGapPoints: any;
            estimatedROI: string;
        };
        axes: any;
        assessment: any;
    } | null>;
    /**
     * Get axis display name
     */
    getAxisName(axisId: any): any;
    /**
     * Default print CSS if file not found
     */
    getDefaultPrintCSS(): string;
    /**
     * Cleanup browser on shutdown
     */
    cleanup(): Promise<void>;
}
import puppeteer from 'puppeteer';
//# sourceMappingURL=premiumPdfService.d.ts.map