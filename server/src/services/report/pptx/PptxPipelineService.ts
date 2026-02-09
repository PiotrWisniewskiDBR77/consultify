/**
 * PPTX Pipeline Service v2
 *
 * BCG-grade presentation generator.
 * Pipeline: UnifiedJSON → Validation → Layout Selection → Component Composition → Atomic Rendering → Buffer
 *
 * This replaces the monolithic PptxExportService for new-style reports.
 * The old service remains as v1 fallback.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const PptxGenJS: any = require('pptxgenjs');

import logger from '../../../utils/Logger.js';
import { getDesignTokens } from './designTokens.js';
import { resolveLayout } from './layouts/index.js';
import { validateReport } from './RulesEngine.js';
import type {
  DesignTokens,
  LayoutResult,
  UnifiedReportJSON,
  UnifiedReportMeta,
  ValidationResult,
} from './types.js';
import { type TransformOptions, transformToUnifiedJson } from './UnifiedJsonTransformer.js';

// ============================================================
// MASTER SLIDE DEFINITIONS
// ============================================================

function defineMasterSlides(pptx: any, tokens: DesignTokens): void {
  // COVER — full bleed brand color
  pptx.defineSlideMaster({
    title: 'COVER',
    background: { color: tokens.colors.primary },
  });

  // BLANK — completely empty, components draw everything
  pptx.defineSlideMaster({
    title: 'BLANK',
    background: { color: tokens.colors.background },
  });

  // SECTION_DIVIDER — colored band in the middle
  pptx.defineSlideMaster({
    title: 'SECTION_DIVIDER',
    background: { color: tokens.colors.surface },
    objects: [
      {
        rect: {
          x: 0,
          y: 1.2,
          w: '100%',
          h: 3.2,
          fill: { color: tokens.colors.primary },
        },
      },
    ],
  });
}

// ============================================================
// PIPELINE SERVICE
// ============================================================

export interface PipelineOptions {
  template?: 'corporate' | 'minimal' | 'modern';
  language?: 'en' | 'pl';
  brandColor?: string;
  confidentiality?: 'confidential' | 'internal' | 'public';
  addCover?: boolean;
  skipValidation?: boolean;
}

export interface PipelineResult {
  buffer: Buffer;
  validation: ValidationResult;
  slideCount: number;
  warnings: string[];
}

export class PptxPipelineService {
  /**
   * Generate a BCG-grade presentation from Unified Report JSON.
   * This is the primary entry point for new-style PPTX generation.
   */
  async generateFromUnifiedJson(
    report: UnifiedReportJSON,
    options: PipelineOptions = {}
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    logger.info(
      `[PptxPipeline] Starting generation for "${report.meta.project}" (${report.slides.length} slides)`
    );

    // 1. Get design tokens
    const tokens = getDesignTokens(
      options.template ?? report.meta.template ?? 'corporate',
      options.brandColor ?? report.meta.brandColor
    );

    // 2. Validate (quality gates)
    const validation = validateReport(report);
    if (!options.skipValidation && !validation.valid) {
      const errorMessages = validation.violations
        .filter((v) => v.severity === 'error')
        .map((v) => v.message);
      logger.error(`[PptxPipeline] Validation failed: ${errorMessages.join('; ')}`);
      throw new Error(`Report validation failed: ${errorMessages.join('; ')}`);
    }

    // Collect warnings
    for (const v of validation.violations) {
      if (v.severity === 'warning') {
        warnings.push(v.message);
        logger.warn(`[PptxPipeline] ${v.message}`);
      }
    }

    // 3. Create presentation
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = report.meta.author || 'Consultinity';
    pptx.title = report.meta.project;
    pptx.subject = `${report.meta.sourceType || ''} Report`.trim();
    pptx.company = report.meta.client;

    // 4. Define master slides
    defineMasterSlides(pptx, tokens);

    // 5. Render each slide through the pipeline
    let renderedCount = 0;
    for (let i = 0; i < report.slides.length; i++) {
      const slideData = report.slides[i];

      try {
        // Resolve layout for this intent
        const layoutFn = resolveLayout(slideData.intent);

        // Execute layout → get LayoutResult with elements
        const layoutResult: LayoutResult = layoutFn(slideData, report.meta, tokens);

        // Create pptxgenjs slide with the correct master
        const slide = pptx.addSlide({ masterName: layoutResult.masterName });

        // Apply any slide-level options
        if (layoutResult.slideOptions) {
          Object.assign(slide, layoutResult.slideOptions);
        }

        // Apply all rendered elements to the slide
        for (const element of layoutResult.elements) {
          try {
            element.apply(slide);
          } catch (elemErr: any) {
            logger.warn(
              `[PptxPipeline] Element render warning on slide ${i + 1}: ${elemErr.message}`
            );
            warnings.push(`Slide ${i + 1}: element render issue — ${elemErr.message}`);
          }
        }

        renderedCount++;
      } catch (err: any) {
        logger.error(
          `[PptxPipeline] Failed to render slide ${i + 1} (intent: ${slideData.intent}): ${err.message}`
        );
        warnings.push(`Slide ${i + 1} (${slideData.intent}): render failed — ${err.message}`);

        // Add a fallback error slide
        this.addErrorSlide(pptx, i + 1, slideData.intent, err.message, tokens);
        renderedCount++;
      }
    }

    // 6. Add closing slide
    this.addClosingSlide(pptx, report.meta, tokens);
    renderedCount++;

    // 7. Generate buffer
    const buffer = await pptx.write({ outputType: 'nodebuffer' });

    const elapsed = Date.now() - startTime;
    logger.info(`[PptxPipeline] Generated ${renderedCount} slides in ${elapsed}ms`);

    return {
      buffer: buffer as Buffer,
      validation,
      slideCount: renderedCount,
      warnings,
    };
  }

  /**
   * Generate from legacy report format (backward compatible).
   * Transforms legacy {report, sections} → UnifiedJSON → PPTX.
   */
  async generateFromLegacyReport(
    input: {
      report: any;
      sections: any[];
      scoreSummary?: any;
      organizationName?: string;
      projectName?: string;
    },
    options: PipelineOptions = {}
  ): Promise<PipelineResult> {
    logger.info(
      `[PptxPipeline] Transforming legacy report "${input.report.title}" to unified JSON`
    );

    // Transform to Unified JSON
    const transformOptions: TransformOptions = {
      language: options.language,
      template: options.template,
      brandColor: options.brandColor,
      confidentiality: options.confidentiality,
      addCover: options.addCover,
    };

    const unifiedJson = transformToUnifiedJson(input, transformOptions);

    logger.info(
      `[PptxPipeline] Transformed to ${unifiedJson.slides.length} slides, proceeding to render`
    );

    // Generate PPTX from unified JSON
    return this.generateFromUnifiedJson(unifiedJson, options);
  }

  // ============================================================
  // UTILITY SLIDES
  // ============================================================

  private addClosingSlide(pptx: any, meta: UnifiedReportMeta, tokens: DesignTokens): void {
    const slide = pptx.addSlide({ masterName: 'COVER' });
    const isPolish = meta.language === 'pl';

    slide.addText(isPolish ? 'Dziękujemy' : 'Thank You', {
      x: 0.5,
      y: 1.8,
      w: 9,
      h: 1,
      fontSize: 44,
      fontFace: tokens.fonts.title,
      color: tokens.colors.textInverse,
      bold: true,
      align: 'center',
    });

    slide.addText(
      isPolish ? 'Raport wygenerowany przez Consultinity' : 'Report generated by Consultinity',
      {
        x: 0.5,
        y: 3.2,
        w: 9,
        h: 0.5,
        fontSize: 16,
        fontFace: tokens.fonts.body,
        color: tokens.colors.textInverse,
        align: 'center',
      }
    );

    slide.addText(meta.date, {
      x: 0.5,
      y: 4.0,
      w: 9,
      h: 0.4,
      fontSize: 12,
      fontFace: tokens.fonts.body,
      color: tokens.colors.textInverse,
      align: 'center',
    });

    if (meta.confidentiality === 'confidential') {
      slide.addText('CONFIDENTIAL', {
        x: 7.5,
        y: 5.1,
        w: 2,
        h: 0.3,
        fontSize: 8,
        fontFace: tokens.fonts.body,
        color: tokens.colors.textInverse,
        align: 'right',
      });
    }
  }

  private addErrorSlide(
    pptx: any,
    slideNum: number,
    intent: string,
    errorMsg: string,
    tokens: DesignTokens
  ): void {
    const slide = pptx.addSlide({ masterName: 'BLANK' });

    // Header bar
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: tokens.grid.headerH,
      fill: { color: tokens.colors.danger },
    });

    slide.addText(`Slide ${slideNum} — Render Error`, {
      x: 0.5,
      y: 0.15,
      w: 9,
      h: 0.5,
      fontSize: tokens.fontSizes.slideTitle,
      fontFace: tokens.fonts.title,
      color: tokens.colors.textInverse,
      bold: true,
    });

    slide.addText(
      `Intent: ${intent}\n\nError: ${errorMsg}\n\nThis slide could not be rendered. Please check the data and try again.`,
      {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 3.5,
        fontSize: tokens.fontSizes.body,
        fontFace: tokens.fonts.body,
        color: tokens.colors.textPrimary,
      }
    );
  }
}

export default PptxPipelineService;
