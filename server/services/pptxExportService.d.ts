export default PPTXExportService;
declare class PPTXExportService {
    constructor(options?: {});
    options: {
        lang: any;
        companyName: any;
        logoPath: any;
    };
    /**
     * Generate PowerPoint presentation
     */
    generatePresentation(reportData: any, sections: any, axisData: any): Promise<any>;
    /**
     * Define master slides for consistent branding
     */
    _defineMasterSlides(pptx: any): void;
    /**
     * Create title slide
     */
    _createTitleSlide(pptx: any, reportData: any, isPolish: any): void;
    /**
     * Create executive summary slide
     */
    _createExecutiveSummarySlide(pptx: any, section: any, axisData: any, isPolish: any): void;
    /**
     * Create maturity overview with bar chart
     */
    _createMaturityOverviewSlide(pptx: any, axisData: any, isPolish: any): void;
    /**
     * Create gap analysis slide
     */
    _createGapAnalysisSlide(pptx: any, axisData: any, isPolish: any): void;
    /**
     * Create recommendations slide
     */
    _createRecommendationsSlide(pptx: any, section: any, isPolish: any): void;
    /**
     * Create roadmap slide
     */
    _createRoadmapSlide(pptx: any, section: any, isPolish: any): void;
    /**
     * Create next steps slide
     */
    _createNextStepsSlide(pptx: any, isPolish: any): void;
    /**
     * Create appendix slides
     */
    _createAppendixSlides(pptx: any, sections: any, axisData: any, isPolish: any): void;
    /**
     * Create thank you slide
     */
    _createThankYouSlide(pptx: any, reportData: any, isPolish: any): void;
    /**
     * Strip HTML tags from content
     */
    _stripHtmlTags(html: any): any;
    /**
     * Save presentation to file or stream
     */
    writeToStream(pptx: any, outputStream: any): Promise<any>;
}
//# sourceMappingURL=pptxExportService.d.ts.map