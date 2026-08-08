/**
 * PPTX Pipeline Service v2
 *
 * BCG-grade presentation generator.
 * Pipeline: UnifiedJSON → Validation → Layout Selection → Component Composition → Atomic Rendering → Buffer
 *
 * This replaces the monolithic PptxExportService for new-style reports.
 * The old service remains as v1 fallback.
 */

import { createRequire } from 'module';

import logger from '../../../utils/Logger.js';
import type {
  CustomTemplateLayoutRole,
  PresentationCustomTemplateDefinition,
} from '../../presentationTemplateRuntimeService.js';
import { buildLayoutTruncationMarker } from './composites/LayoutTruncationMarker.js';
import { getDesignTokens } from './designTokens.js';
import { resolveLayout, resolveLayoutContext } from './layouts/index.js';
import { validateReport } from './RulesEngine.js';
import type {
  DesignTokens,
  LayoutResult,
  UnifiedReportJSON,
  UnifiedReportMeta,
  ValidationResult,
} from './types.js';
import { type TransformOptions, transformToUnifiedJson } from './UnifiedJsonTransformer.js';

const require = createRequire(import.meta.url);
const PptxGenJS: any = require('pptxgenjs');

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

function normalizeMasterName(value: string): string {
  return `CUSTOM_${value.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()}`;
}

export function customLayoutRoleForIntent(intent: string): CustomTemplateLayoutRole {
  if (intent === 'cover') return 'cover';
  if (intent === 'performance_overview') return 'kpi';
  if (intent === 'risk_management' || intent === 'appendix') return 'table';
  if (intent === 'next_steps' || intent === 'recommendation_single') return 'decision';
  return 'content';
}

function applyCustomThemeTokens(
  tokens: DesignTokens,
  customTemplate?: PresentationCustomTemplateDefinition
): DesignTokens {
  if (!customTemplate?.theme) return tokens;
  const theme = customTemplate.theme;
  const clean = (color: string | undefined, fallback: string) =>
    typeof color === 'string' && /^[#]?[0-9A-Fa-f]{6}$/.test(color)
      ? color.replace('#', '').toUpperCase()
      : fallback;
  return {
    ...tokens,
    fonts: {
      ...tokens.fonts,
      title: theme.titleFont || tokens.fonts.title,
      body: theme.bodyFont || tokens.fonts.body,
    },
    colors: {
      ...tokens.colors,
      primary: clean(theme.primaryColor, tokens.colors.primary),
      background: clean(theme.backgroundColor, tokens.colors.background),
      surface: clean(theme.surfaceColor, tokens.colors.surface),
      textPrimary: clean(theme.textColor, tokens.colors.textPrimary),
      accent: clean(theme.accentColor, tokens.colors.accent),
    },
  };
}

function defineCustomMasterSlides(
  pptx: any,
  tokens: DesignTokens,
  customTemplate?: PresentationCustomTemplateDefinition
): Map<string, string> {
  const masters = new Map<string, string>();
  if (!customTemplate?.theme || !customTemplate.layouts || !customTemplate.layoutMapping)
    return masters;
  for (const [layoutId, definition] of Object.entries(customTemplate.layouts || {})) {
    const masterName = normalizeMasterName(definition.masterName || layoutId);
    const backgroundColor = (definition.backgroundColor || tokens.colors.background).replace(
      '#',
      ''
    );
    const accentColor = (definition.accentColor || tokens.colors.accent).replace('#', '');
    const objects: any[] = [
      {
        rect: {
          x: 0,
          y: 0,
          w: 0.12,
          h: '100%',
          fill: { color: accentColor },
          line: { color: accentColor },
        },
      },
    ];
    if (/^data:image\/(?:png|jpeg);base64,/i.test(customTemplate.theme.logoDataUri || '')) {
      objects.push({
        image: { data: customTemplate.theme.logoDataUri, x: 8.35, y: 0.2, w: 1.15, h: 0.45 },
      });
    }
    pptx.defineSlideMaster({ title: masterName, background: { color: backgroundColor }, objects });
    masters.set(layoutId, masterName);
  }
  return masters;
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
  addClosingSlide?: boolean;
  skipValidation?: boolean;
  customTemplate?: PresentationCustomTemplateDefinition;
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
    const tokens = applyCustomThemeTokens(
      getDesignTokens(
        options.template ?? report.meta.template ?? 'corporate',
        options.brandColor ?? report.meta.brandColor
      ),
      options.customTemplate ?? report.meta.customTemplate
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
    pptx.author = report.meta.author || 'Consultify';
    pptx.title = report.meta.project;
    pptx.subject = `${report.meta.sourceType || ''} Report`.trim();
    pptx.company = report.meta.client;

    // 4. Define master slides
    defineMasterSlides(pptx, tokens);
    const activeCustomTemplate = options.customTemplate ?? report.meta.customTemplate;
    const customMasters = defineCustomMasterSlides(pptx, tokens, activeCustomTemplate);

    // 5. Render each slide through the pipeline
    let renderedCount = 0;
    for (let i = 0; i < report.slides.length; i++) {
      const slideData = report.slides[i];

      try {
        // Resolve layout for this intent
        const layoutFn = resolveLayout(slideData.intent);

        // P13 — ekran = eksport parity. Resolve the SAME layout-template id the
        // on-screen FE `LayoutEngine` picks for this slide (honouring
        // `composition.layoutVariantId` + W7 guard-split) and pass it to the
        // layout so composition-variant-aware layouts (e.g. Cover) render the
        // shape shown on screen instead of an intent-only default.
        const layoutCtx = resolveLayoutContext(slideData);

        // Execute layout → get LayoutResult with elements
        const layoutResult: LayoutResult = layoutFn(slideData, report.meta, tokens, layoutCtx);

        // Create pptxgenjs slide with the correct master
        const customRole = customLayoutRoleForIntent(slideData.intent);
        const customLayoutId = activeCustomTemplate?.layoutMapping?.[customRole];
        const masterName =
          (customLayoutId && customMasters.get(customLayoutId)) || layoutResult.masterName;
        const slide = pptx.addSlide({ masterName });

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

        // Sprint S15: render the layout-audit truncation marker AFTER
        // the layout's own elements so the badge sits on top of any
        // overflowing title / body text. The marker is a no-op when
        // `slide.auditFlags` is empty or unset (legacy callers). Closes
        // R-S13-4 — the rendered artifact now visibly carries the same
        // audit flags the Studio canvas banner shows.
        try {
          const marker = buildLayoutTruncationMarker(slideData, tokens);
          if (marker) marker.apply(slide);
        } catch (markerErr: any) {
          logger.warn(
            `[PptxPipeline] Layout-audit marker warning on slide ${i + 1}: ${markerErr.message}`
          );
          warnings.push(`Slide ${i + 1}: layout-audit marker skipped — ${markerErr.message}`);
        }

        this.addHeaderFooter(slide, report.meta, tokens, i + 1, report.slides.length);

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
    if (options.addClosingSlide !== false) {
      this.addClosingSlide(pptx, report.meta, tokens);
      renderedCount++;
    }

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

  private addHeaderFooter(
    slide: any,
    meta: UnifiedReportMeta,
    tokens: DesignTokens,
    pageNumber: number,
    totalPages: number
  ): void {
    if (pageNumber === 1) return;
    const isPolish = meta.language === 'pl';
    const confidentialityValue = String(meta.confidentiality || 'internal');
    const confidentiality = isPolish
      ? ({ confidential: 'POUFNE', internal: 'WEWNĘTRZNE', public: 'PUBLICZNE' }[
          confidentialityValue
        ] ?? confidentialityValue.toUpperCase())
      : confidentialityValue.toUpperCase();
    const footer = `${confidentiality} · Consultify · ${pageNumber}/${totalPages}`;
    // PRAWA strona stopki — lewą zajmuje Footnote("client — project") z layoutu;
    // wcześniej oba startowały w tym samym x i NACHODZIŁY (garbled footer).
    slide.addText(footer, {
      x: 6.3,
      y: tokens.grid.footerY ?? 5.28,
      w: 3.25,
      h: 0.16,
      fontFace: tokens.fonts.body,
      fontSize: 6.5,
      color: tokens.colors.textSecondary,
      align: 'right',
      margin: 0,
      breakLine: false,
      fit: 'shrink',
    });
  }

  /**
   * Closing slide — a premium "bookend" that mirrors the Cover layout
   * (CoverLayout.ts): navy COVER master, left accent spine, uppercase
   * accent eyebrow, large LEFT-aligned title in the title font, an accent
   * rule under it, a CTA line, plus the meta date (bottom-left) and the
   * CONSULTIFY wordmark (bottom-right). Geometry intentionally matches the
   * cover so the deck opens and closes on the same visual chord.
   */
  private addClosingSlide(pptx: any, meta: UnifiedReportMeta, tokens: DesignTokens): void {
    const slide = pptx.addSlide({ masterName: 'COVER' });
    const isPolish = meta.language === 'pl';
    const inverse = tokens.colors.textInverse;
    const accent = tokens.colors.accent;

    const LEFT = 0.85;
    const TEXT_W = 8.3;

    // Left accent spine — mirrors the cover's anchoring vertical bar.
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 0.16,
      h: tokens.grid.slideH,
      fill: { color: accent },
      line: { color: accent, width: 0 },
    });

    // Eyebrow — uppercase, letter-spaced, accent color.
    slide.addText(isPolish ? 'PODSUMOWANIE' : 'IN CLOSING', {
      x: LEFT,
      y: 1.5,
      w: TEXT_W,
      h: 0.32,
      fontSize: 12,
      bold: true,
      color: accent,
      charSpacing: 2,
      fontFace: tokens.fonts.body,
      align: 'left',
      valign: 'middle',
      margin: 0,
    });

    // Title — large, bold, title font, left-aligned (mirrors cover title).
    slide.addText(isPolish ? 'Dziękujemy' : 'Thank you', {
      x: LEFT,
      y: 1.92,
      w: TEXT_W,
      h: 1.0,
      fontSize: 40,
      bold: true,
      color: inverse,
      fontFace: tokens.fonts.title,
      align: 'left',
      valign: 'top',
      lineSpacingMultiple: 0.95,
    });

    // Accent rule under the title.
    slide.addShape('line', {
      x: LEFT + 0.02,
      y: 3.5,
      w: 1.7,
      h: 0,
      line: { color: accent, width: 3 },
    });

    // CTA / summary line — generated-by + date, smaller, inverse, left.
    const cta = isPolish
      ? 'Raport wygenerowany przez Consultify'
      : 'Report generated by Consultify';
    slide.addText(cta, {
      x: LEFT,
      y: 3.68,
      w: TEXT_W,
      h: 0.6,
      fontSize: 18,
      color: inverse,
      fontFace: tokens.fonts.body,
      align: 'left',
      valign: 'top',
    });

    // Meta date — bottom-left baseline (mirrors cover meta line).
    if (meta.date) {
      slide.addText(meta.date, {
        x: LEFT,
        y: 4.92,
        w: 6.0,
        h: 0.4,
        fontSize: 13,
        bold: true,
        color: inverse,
        fontFace: tokens.fonts.body,
        align: 'left',
        valign: 'middle',
        margin: 0,
      });
    }

    // Consultify wordmark — bottom-right (mirrors cover wordmark exactly).
    slide.addText('CONSULTIFY', {
      x: 7.0,
      y: 4.92,
      w: 2.65,
      h: 0.4,
      fontSize: 11,
      bold: true,
      color: inverse,
      charSpacing: 3,
      fontFace: tokens.fonts.body,
      align: 'right',
      valign: 'middle',
      margin: 0,
    });

    // Confidential — subtle, sits above the baseline so it never collides
    // with the wordmark; quiet (no banner, no alarm color).
    if (meta.confidentiality === 'confidential') {
      slide.addText(isPolish ? 'POUFNE' : 'CONFIDENTIAL', {
        x: 7.0,
        y: 4.56,
        w: 2.65,
        h: 0.28,
        fontSize: 8,
        color: inverse,
        charSpacing: 2,
        fontFace: tokens.fonts.body,
        align: 'right',
        valign: 'middle',
        margin: 0,
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
