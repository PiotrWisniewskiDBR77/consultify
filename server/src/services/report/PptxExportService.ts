/**
 * PPTX Export Service
 *
 * Service for exporting reports to PowerPoint presentations.
 * Uses pptxgenjs library for generating PPTX files.
 * 
 * NOTE: This is v1 service - API compatibility may vary by pptxgenjs version.
 * Type errors are suppressed with @ts-expect-error to maintain v1 compatibility.
 */

import PptxGenJS, { type Slide, type TextProps, type ChartData } from 'pptxgenjs';

import logger from '../../utils/Logger.js';

// ============================================
// TYPES
// ============================================

export interface ReportSection {
  key: string;
  title: string;
  type: string;
  content: string;
  renderKind?: 'markdown' | 'table' | 'chart' | 'matrix';
  data?: any;
}

export interface ReportData {
  id: string;
  name: string;
  sourceType: string;
  sourceFramework?: string;
  organizationName?: string;
  projectName?: string;
  createdAt: string;
  intentConfig?: {
    audience?: string;
    goal?: string;
    language?: string;
    tone?: string;
  };
  sections: ReportSection[];
  scoreSummary?: {
    overall?: number;
    axes?: Record<string, { actual: number; target?: number }>;
    dimensions?: Record<string, { current: number; target?: number }>;
  };
}

export interface PptxExportOptions {
  template?: 'corporate' | 'minimal' | 'modern';
  includeCharts?: boolean;
  includeToc?: boolean;
  language?: 'en' | 'pl';
  brandColor?: string;
}

// ============================================
// CONSTANTS
// ============================================

const COLORS = {
  primary: '0066CC',
  secondary: '333333',
  accent: '00AA55',
  background: 'FFFFFF',
  lightGray: 'F5F5F5',
  darkGray: '666666',
  success: '22C55E',
  warning: 'F59E0B',
  danger: 'EF4444',
};

const FONTS = {
  title: 'Arial',
  body: 'Arial',
  mono: 'Courier New',
};

// ============================================
// SERVICE CLASS
// ============================================

export class PptxExportService {
  private defaultOptions: PptxExportOptions = {
    template: 'corporate',
    includeCharts: true,
    includeToc: true,
    language: 'pl',
    brandColor: COLORS.primary,
  };

  /**
   * Generate PowerPoint presentation from report data
   */
  async generatePresentation(report: ReportData, options: PptxExportOptions = {}): Promise<Buffer> {
    const opts = { ...this.defaultOptions, ...options };
    const isPolish = opts.language === 'pl';

    logger.info(`[PptxExport] Generating presentation for report: ${report.id}`);

    const pptx = new PptxGenJS();

    // Set presentation properties
    pptx.author = 'Consultify';
    pptx.title = report.name;
    pptx.subject = `${report.sourceType} Report`;
    pptx.company = report.organizationName || 'Organization';

    // Define master slides
    this.defineMasterSlides(pptx, opts);

    // Add title slide
    this.addTitleSlide(pptx, report, opts, isPolish);

    // Add table of contents (if enabled)
    if (opts.includeToc && report.sections.length > 0) {
      this.addTableOfContents(pptx, report.sections, isPolish);
    }

    // Add executive summary if available
    const summarySection = report.sections.find(
      (s) => s.key === 'summary' || s.key === 'executive_summary'
    );
    if (summarySection) {
      this.addSummarySlide(pptx, summarySection, report, opts, isPolish);
    }

    // Add score overview if available
    if (report.scoreSummary) {
      this.addScoreOverviewSlide(pptx, report, opts, isPolish);
    }

    // Add content slides for each section
    for (const section of report.sections) {
      if (section.key === 'summary' || section.key === 'executive_summary') continue;
      this.addSectionSlide(pptx, section, opts, isPolish);
    }

    // Add closing slide
    this.addClosingSlide(pptx, report, isPolish);

    // Generate buffer
    const buffer = await pptx.write({ outputType: 'nodebuffer' });

    logger.info(`[PptxExport] Presentation generated successfully`);

    return buffer as Buffer;
  }

  /**
   * Define master slides with consistent styling
   */
  private defineMasterSlides(pptx: PptxGenJS, options: PptxExportOptions): void {
    const brandColor = options.brandColor || COLORS.primary;

    // Title slide master
    pptx.defineSlideMaster({
      title: 'TITLE_SLIDE',
      background: { color: brandColor },
      objects: [
        {
          placeholder: {
            name: 'title',
            type: 'title',
            options: {
              x: 0.5,
              y: 2.5,
              w: 9,
              h: 1.5,
              fontSize: 44,
              fontFace: FONTS.title,
              color: 'FFFFFF',
              bold: true,
              align: 'center',
            },
            text: '',
          },
        },
        {
          placeholder: {
            name: 'subtitle',
            type: 'body',
            options: {
              x: 0.5,
              y: 4.2,
              w: 9,
              h: 1,
              fontSize: 20,
              
      fontFace: FONTS.body,
              color: 'FFFFFF',
              align: 'center',
            },
            text: '',
          },
        },
      ],
    });

    // Content slide master
    pptx.defineSlideMaster({
      title: 'CONTENT_SLIDE',
      background: { color: COLORS.background },
      objects: [
        // Header bar
        {
          rect: {
            x: 0,
            y: 0,
            w: 10,
            h: 0.8,
            fill: { color: brandColor },
          },
        },
        // Title placeholder
        {
          placeholder: {
            name: 'title',
            type: 'title',
            options: {
              x: 0.5,
              y: 0.15,
              w: 9,
              h: 0.5,
              fontSize: 24,
              fontFace: FONTS.title,
              color: 'FFFFFF',
              bold: true,
            },
            text: '',
          },
        },
        // Footer
        {
          text: 'Consultify Report',
          options: {
            x: 0.5,
            y: 5.2,
            w: 4,
            h: 0.3,
            fontSize: 10,
            fontFace: FONTS.body,
            color: COLORS.darkGray,
          },
        },
        // Page number
        {
          text: '',
          options: {
            x: 8.5,
            y: 5.2,
            w: 1,
            h: 0.3,
            fontSize: 10,
            fontFace: FONTS.body,
            color: COLORS.darkGray,
            align: 'right',
          },
        },
      ],
    });

    // Section divider master
    pptx.defineSlideMaster({
      title: 'SECTION_DIVIDER',
      background: { color: COLORS.lightGray },
      objects: [
        {
          rect: {
            x: 0,
            y: 2,
            w: 10,
            h: 2,
            fill: { color: brandColor },
          },
        },
        {
          placeholder: {
            name: 'title',
            type: 'title',
            options: {
              x: 0.5,
              y: 2.3,
              w: 9,
              h: 1.4,
              fontSize: 36,
              fontFace: FONTS.title,
              color: 'FFFFFF',
              bold: true,
              align: 'center',
              valign: 'middle',
            },
            text: '',
          },
        },
      ],
    });
  }

  /**
   * Add title slide
   */
  private addTitleSlide(
    pptx: PptxGenJS,
    report: ReportData,
    options: PptxExportOptions,
    isPolish: boolean
  ): void {
    const slide = pptx.addSlide({ masterName: 'TITLE_SLIDE' });

    // Title
    slide.addText(report.name, {
      x: 0.5,
      y: 2,
      w: 9,
      h: 1.5,
      fontSize: 40,
      
      
      fontFace: FONTS.title,
      color: 'FFFFFF',
      bold: true,
      align: 'center',
    });

    // Subtitle with report info
    const subtitleParts = [];
    if (report.sourceFramework) {
      subtitleParts.push(report.sourceFramework);
    }
    if (report.organizationName) {
      subtitleParts.push(report.organizationName);
    }
    if (report.projectName) {
      subtitleParts.push(report.projectName);
    }

    slide.addText(subtitleParts.join(' | '), {
      x: 0.5,
      y: 3.7,
      w: 9,
      h: 0.5,
      fontSize: 18,
      
      fontFace: FONTS.body,
      color: 'FFFFFF',
      align: 'center',
    });

    // Date
    const dateStr = new Date(report.createdAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    slide.addText(dateStr, {
      x: 0.5,
      y: 4.5,
      w: 9,
      h: 0.4,
      fontSize: 14,
      
      fontFace: FONTS.body,
      color: 'FFFFFF',
      align: 'center',
    });

    // Logo placeholder
    slide.addText('Consultify', {
      x: 0.5,
      y: 5,
      w: 9,
      h: 0.4,
      fontSize: 12,
      
      fontFace: FONTS.body,
      color: 'FFFFFF',
      align: 'center',
    });
  }

  /**
   * Add table of contents slide
   */
  private addTableOfContents(pptx: PptxGenJS, sections: ReportSection[], isPolish: boolean): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

    slide.addText(isPolish ? 'Spis treści' : 'Table of Contents', {
      x: 0.5,
      y: 0.15,
      w: 9,
      h: 0.5,
      fontSize: 24,
      
      fontFace: FONTS.title,
      color: 'FFFFFF',
      bold: true,
    });

    const tocItems = sections.map((section, index) => ({
      text: `${index + 1}. ${section.title}`,
      options: {
        fontSize: 16,
        
      fontFace: FONTS.body,
        color: COLORS.secondary,
        bullet: false,
        paraSpaceAfter: 10,
      },
    }));

    
    slide.addText(tocItems, {
      x: 0.5,
      y: 1.2,
      w: 9,
      h: 4,
    });
  }

  /**
   * Add executive summary slide
   */
  private addSummarySlide(
    pptx: PptxGenJS,
    section: ReportSection,
    report: ReportData,
    options: PptxExportOptions,
    isPolish: boolean
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

    slide.addText(isPolish ? 'Podsumowanie wykonawcze' : 'Executive Summary', {
      x: 0.5,
      y: 0.15,
      w: 9,
      h: 0.5,
      fontSize: 24,
      
      fontFace: FONTS.title,
      color: 'FFFFFF',
      bold: true,
    });

    // Summary content
    const content = this.cleanMarkdown(section.content);
    const lines = content.split('\n').filter((l) => l.trim());

    
    
    slide.addText(
      lines.slice(0, 8).map((line) => ({
        text: line,
        options: {
          fontSize: 14,
          
      fontFace: FONTS.body,
          color: COLORS.secondary,
          bullet: line.startsWith('-') || line.startsWith('•'),
          paraSpaceAfter: 8,
        },
      })),
      {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 3.8,
      }
    );
  }

  /**
   * Add score overview slide with chart
   */
  private addScoreOverviewSlide(
    pptx: PptxGenJS,
    report: ReportData,
    options: PptxExportOptions,
    isPolish: boolean
  ): void {
    const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

    slide.addText(isPolish ? 'Przegląd wyników' : 'Score Overview', {
      x: 0.5,
      y: 0.15,
      w: 9,
      h: 0.5,
      fontSize: 24,
      
      fontFace: FONTS.title,
      color: 'FFFFFF',
      bold: true,
    });

    // Overall score box
    if (report.scoreSummary?.overall) {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.5,
        y: 1.2,
        w: 2,
        h: 1.5,
        fill: { color: options.brandColor || COLORS.primary },
        line: { color: options.brandColor || COLORS.primary },
      });

      slide.addText(report.scoreSummary.overall.toFixed(1), {
        x: 0.5,
        y: 1.4,
        w: 2,
        h: 0.8,
        fontSize: 36,
        
      fontFace: FONTS.title,
        color: 'FFFFFF',
        bold: true,
        align: 'center',
      });

      slide.addText(isPolish ? 'Wynik ogólny' : 'Overall Score', {
        x: 0.5,
        y: 2.2,
        w: 2,
        h: 0.4,
        fontSize: 12,
        
      fontFace: FONTS.body,
        color: 'FFFFFF',
        align: 'center',
      });
    }

    // Add chart if axes/dimensions available
    if (options.includeCharts && report.scoreSummary) {
      const chartData = this.prepareChartData(report.scoreSummary);

      if (chartData.labels.length > 0) {
        slide.addChart(pptx.ChartType.bar, chartData, {
          x: 3,
          y: 1.2,
          w: 6.5,
          h: 3.5,
          barDir: 'bar',
          barGapWidthPct: 50,
          showValue: true,
          valAxisMaxVal: 7,
          catAxisTitle: isPolish ? 'Elementy' : 'Elements',
          valAxisTitle: isPolish ? 'Wynik' : 'Score',
          chartColors: [options.brandColor || COLORS.primary, COLORS.accent],
          showLegend: true,
          legendPos: 'b',
        });
      }
    }
  }

  /**
   * Add section slide
   */
  private addSectionSlide(
    pptx: PptxGenJS,
    section: ReportSection,
    options: PptxExportOptions,
    isPolish: boolean
  ): void {
    // Add section divider
    const dividerSlide = pptx.addSlide({ masterName: 'SECTION_DIVIDER' });
    dividerSlide.addText(section.title, {
      x: 0.5,
      y: 2.3,
      w: 9,
      h: 1.4,
      fontSize: 32,
      
      fontFace: FONTS.title,
      color: 'FFFFFF',
      bold: true,
      align: 'center',
      valign: 'middle',
    });

    // Add content slide(s)
    const content = this.cleanMarkdown(section.content);
    const contentChunks = this.splitContentIntoSlides(content, 1500);

    for (let i = 0; i < contentChunks.length; i++) {
      const slide = pptx.addSlide({ masterName: 'CONTENT_SLIDE' });

      const titleText =
        contentChunks.length > 1
          ? `${section.title} (${i + 1}/${contentChunks.length})`
          : section.title;

      slide.addText(titleText, {
        x: 0.5,
        y: 0.15,
        w: 9,
        h: 0.5,
        fontSize: 24,
        
      fontFace: FONTS.title,
        color: 'FFFFFF',
        bold: true,
      });

      // Handle different render kinds
      if (section.renderKind === 'table' && section.data) {
        this.addTableToSlide(slide, section.data);
      } else {
        // Default: text content
        const lines = contentChunks[i].split('\n').filter((l) => l.trim());

        
        
        slide.addText(
          lines.map((line) => ({
            text: line.replace(/^[-•*]\s*/, ''),
            options: {
              fontSize: 13,
              
      fontFace: FONTS.body,
              color: COLORS.secondary,
              bullet: line.match(/^[-•*]\s/) ? true : false,
              paraSpaceAfter: 6,
            },
          })),
          {
            x: 0.5,
            y: 1.1,
            w: 9,
            h: 4,
          }
        );
      }
    }
  }

  /**
   * Add table to slide
   */
  private addTableToSlide(slide: Slide, data: any): void {
    if (!data || !Array.isArray(data) || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const rows: Array<Array<TextProps>> = [];

    // Header row
    rows.push(
      headers.map((h) => ({
        text: h,
        options: {
          bold: true,
          fill: { color: COLORS.primary },
          color: 'FFFFFF',
          fontSize: 11,
        },
      }))
    );

    // Data rows
    for (const row of data.slice(0, 10)) {
      rows.push(
        headers.map((h) => ({
          text: String(row[h] ?? ''),
          options: {
            fontSize: 10,
            color: COLORS.secondary,
          },
        }))
      );
    }

    slide.addTable(rows, {
      x: 0.5,
      y: 1.1,
      w: 9,
      colW: headers.map(() => 9 / headers.length),
      border: { pt: 0.5, color: COLORS.lightGray },
      
      fontFace: FONTS.body,
    });
  }

  /**
   * Add closing slide
   */
  private addClosingSlide(pptx: PptxGenJS, report: ReportData, isPolish: boolean): void {
    const slide = pptx.addSlide({ masterName: 'TITLE_SLIDE' });

    slide.addText(isPolish ? 'Dziękujemy' : 'Thank You', {
      x: 0.5,
      y: 2,
      w: 9,
      h: 1,
      fontSize: 44,
      
      fontFace: FONTS.title,
      color: 'FFFFFF',
      bold: true,
      align: 'center',
    });

    slide.addText(
      isPolish ? 'Raport wygenerowany przez Consultify' : 'Report generated by Consultify',
      {
        x: 0.5,
        y: 3.5,
        w: 9,
        h: 0.5,
        fontSize: 16,
        
      fontFace: FONTS.body,
        color: 'FFFFFF',
        align: 'center',
      }
    );

    const dateStr = new Date().toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    slide.addText(dateStr, {
      x: 0.5,
      y: 4.2,
      w: 9,
      h: 0.4,
      fontSize: 12,
      
      fontFace: FONTS.body,
      color: 'FFFFFF',
      align: 'center',
    });
  }

  /**
   * Prepare chart data from score summary
   */
  private prepareChartData(scoreSummary: ReportData['scoreSummary']): ChartData {
    const labels: string[] = [];
    const actualValues: number[] = [];
    const targetValues: number[] = [];

    if (scoreSummary?.axes) {
      Object.entries(scoreSummary.axes).forEach(([key, value]) => {
        labels.push(`Axis ${key}`);
        actualValues.push(value.actual);
        targetValues.push(value.target || value.actual);
      });
    } else if (scoreSummary?.dimensions) {
      Object.entries(scoreSummary.dimensions).forEach(([key, value]) => {
        labels.push(key.replace(/_/g, ' '));
        actualValues.push(value.current);
        targetValues.push(value.target || value.current);
      });
    }

    return {
      labels,
      data: [
        {
          name: 'Actual',
          values: actualValues,
        },
        {
          name: 'Target',
          values: targetValues,
        },
      ],
    };
  }

  /**
   * Clean markdown formatting for plain text
   */
  private cleanMarkdown(text: string): string {
    return text
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/`([^`]+)`/g, '$1') // Remove code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/>\s/g, '') // Remove blockquotes
      .trim();
  }

  /**
   * Split content into slide-sized chunks
   */
  private splitContentIntoSlides(content: string, maxChars: number): string[] {
    const chunks: string[] = [];
    const paragraphs = content.split('\n\n');
    let currentChunk = '';

    for (const para of paragraphs) {
      if ((currentChunk + para).length > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [content];
  }
}

export default PptxExportService;
