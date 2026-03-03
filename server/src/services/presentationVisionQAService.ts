/**
 * Vision QA Service — quality gate for AI-generated presentation images.
 * Evaluates generated images against slide context, brand palette, and quality criteria.
 * Score < threshold triggers one regen with an improved prompt.
 */

import logger from '../utils/Logger.js';

interface VisionQAInput {
  imageUrl: string;
  slideTitle: string;
  slideIntent: string;
  brandPalette: string[];
  imageStylePreset: string;
  originalPrompt: string;
}

interface VisionQAResult {
  score: number;
  passed: boolean;
  issues: string[];
  improvedPrompt?: string;
}

interface ImageGenerationResult {
  url: string;
  qaScore: number;
  wasRegenerated: boolean;
}

const QA_THRESHOLD = 0.65;

const QA_CRITERIA = [
  'slide_friendly_aspect_ratio',
  'no_embedded_text',
  'color_palette_harmony',
  'professional_tone',
  'content_relevance',
  'technical_quality',
] as const;

/**
 * Evaluate an image using a vision model (GPT-4V, Claude).
 * Returns a quality score 0–1 and a list of issues.
 */
export async function evaluateImage(
  input: VisionQAInput,
  aiProvider: 'openai' | 'anthropic' = 'openai'
): Promise<VisionQAResult> {
  const systemPrompt = `You are a visual quality assurance system for business presentations.
Evaluate the provided image against these criteria:
1. Slide-friendly (16:9 safe, no text cropping risk)
2. No embedded text/watermarks that would conflict with slide text overlays
3. Color palette harmony with brand colors: ${input.brandPalette.join(', ')}
4. Professional tone appropriate for ${input.slideIntent} slides
5. Content relevance to: "${input.slideTitle}"
6. Technical quality (resolution adequate, no artifacts)

Return a JSON object:
{
  "scores": { "criterion_name": 0.0-1.0 },
  "overall_score": 0.0-1.0,
  "issues": ["issue description"],
  "improved_prompt": "if score < 0.65, suggest an improved image generation prompt"
}`;

  try {
    if (aiProvider === 'openai') {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI();

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: input.imageUrl, detail: 'low' },
              },
              {
                type: 'text',
                text: `Original prompt: "${input.originalPrompt}"\nStyle preset: ${input.imageStylePreset}\nSlide intent: ${input.slideIntent}`,
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        score: parsed.overall_score ?? 0.5,
        passed: (parsed.overall_score ?? 0.5) >= QA_THRESHOLD,
        issues: parsed.issues || [],
        improvedPrompt: parsed.improved_prompt,
      };
    }

    // Anthropic fallback
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            {
              type: 'image',
              source: { type: 'url', url: input.imageUrl },
            },
            { type: 'text', text: `Original prompt: "${input.originalPrompt}"` },
          ],
        },
      ],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text);
    return {
      score: parsed.overall_score ?? 0.5,
      passed: (parsed.overall_score ?? 0.5) >= QA_THRESHOLD,
      issues: parsed.issues || [],
      improvedPrompt: parsed.improved_prompt,
    };
  } catch (error) {
    logger.warn('[VisionQA] Evaluation failed, passing image by default', { error });
    return { score: 0.7, passed: true, issues: ['QA evaluation failed — image accepted by default'] };
  }
}

/**
 * Full QA pipeline: evaluate → if failed, regen once with improved prompt → return best.
 */
export async function qaGatedImageGeneration(
  generateImage: (prompt: string) => Promise<string>,
  context: Omit<VisionQAInput, 'imageUrl'>,
  aiProvider: 'openai' | 'anthropic' = 'openai'
): Promise<ImageGenerationResult> {
  const firstUrl = await generateImage(context.originalPrompt);

  const firstEval = await evaluateImage(
    { ...context, imageUrl: firstUrl },
    aiProvider
  );

  if (firstEval.passed) {
    logger.info(`[VisionQA] Image passed QA (score: ${firstEval.score.toFixed(2)})`);
    return { url: firstUrl, qaScore: firstEval.score, wasRegenerated: false };
  }

  logger.info(
    `[VisionQA] Image failed QA (score: ${firstEval.score.toFixed(2)}), issues: ${firstEval.issues.join('; ')}. Attempting regen.`
  );

  const improvedPrompt = firstEval.improvedPrompt || context.originalPrompt;

  try {
    const secondUrl = await generateImage(improvedPrompt);
    const secondEval = await evaluateImage(
      { ...context, imageUrl: secondUrl },
      aiProvider
    );

    if (secondEval.score > firstEval.score) {
      logger.info(`[VisionQA] Regen improved score: ${firstEval.score.toFixed(2)} → ${secondEval.score.toFixed(2)}`);
      return { url: secondUrl, qaScore: secondEval.score, wasRegenerated: true };
    }

    return { url: firstUrl, qaScore: firstEval.score, wasRegenerated: true };
  } catch (error) {
    logger.warn('[VisionQA] Regen failed, using original image', { error });
    return { url: firstUrl, qaScore: firstEval.score, wasRegenerated: false };
  }
}
