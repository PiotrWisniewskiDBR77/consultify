/**
 * Image Generation Service - DALL-E 3 Integration
 * Provides AI-powered image generation capabilities
 *
 * @version 1.0.0
 */

import OpenAI from 'openai';

import { aiLogger } from './logger.js';

export interface ImageGenRequest {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  n?: number;
  userId?: string;
  organizationId?: string;
}

export interface ImageGenResponse {
  url: string;
  revisedPrompt: string;
  size: string;
  quality: string;
  style: string;
  created: number;
}

export interface ImageGenResult {
  success: boolean;
  images: ImageGenResponse[];
  error?: string;
  usage?: {
    model: string;
    size: string;
    quality: string;
    count: number;
    estimatedCost: number;
  };
}

// Pricing per image (as of 2024)
const DALLE3_PRICING: Record<string, Record<string, number>> = {
  standard: {
    '1024x1024': 0.04,
    '1792x1024': 0.08,
    '1024x1792': 0.08,
  },
  hd: {
    '1024x1024': 0.08,
    '1792x1024': 0.12,
    '1024x1792': 0.12,
  },
};

class ImageGenerationService {
  private openai: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  /**
   * Generate images using DALL-E 3
   */
  async generateImage(request: ImageGenRequest): Promise<ImageGenResult> {
    const {
      prompt,
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
      n = 1,
      userId,
      organizationId,
    } = request;

    // Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      return {
        success: false,
        images: [],
        error: 'Prompt is required',
      };
    }

    if (prompt.length > 4000) {
      return {
        success: false,
        images: [],
        error: 'Prompt exceeds maximum length of 4000 characters',
      };
    }

    aiLogger.info('ImageGeneration', `Generating image for user ${userId || 'unknown'}`, {
      promptLength: prompt.length,
      size,
      quality,
      style,
      organizationId,
    });

    try {
      const client = this.getClient();

      const response = await client.images.generate({
        model: 'dall-e-3',
        prompt,
        size,
        quality,
        style,
        n: Math.min(n, 1), // DALL-E 3 only supports n=1
        response_format: 'url',
      });

      const images: ImageGenResponse[] = response.data.map((img) => ({
        url: img.url || '',
        revisedPrompt: img.revised_prompt || prompt,
        size,
        quality,
        style,
        created: response.created,
      }));

      const estimatedCost = DALLE3_PRICING[quality]?.[size] || 0.04;

      aiLogger.info('ImageGeneration', 'Image generated successfully', {
        imageCount: images.length,
        revisedPromptLength: images[0]?.revisedPrompt?.length,
        estimatedCost,
      });

      return {
        success: true,
        images,
        usage: {
          model: 'dall-e-3',
          size,
          quality,
          count: images.length,
          estimatedCost,
        },
      };
    } catch (error) {
      const err = error as Error & { code?: string; status?: number };

      aiLogger.error('ImageGeneration', 'Failed to generate image', {
        error: err.message,
        code: err.code,
        status: err.status,
      });

      // Handle specific OpenAI errors
      if (err.message?.includes('content_policy_violation')) {
        return {
          success: false,
          images: [],
          error: 'Your prompt was rejected due to content policy. Please modify your request.',
        };
      }

      if (err.message?.includes('billing')) {
        return {
          success: false,
          images: [],
          error: 'Image generation is temporarily unavailable. Please try again later.',
        };
      }

      if (err.message?.includes('rate_limit')) {
        return {
          success: false,
          images: [],
          error: 'Rate limit exceeded. Please wait a moment before trying again.',
        };
      }

      return {
        success: false,
        images: [],
        error: `Failed to generate image: ${err.message}`,
      };
    }
  }

  /**
   * Enhance a prompt for better image generation results
   */
  async enhancePrompt(prompt: string): Promise<string> {
    try {
      const client = this.getClient();

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at crafting prompts for DALL-E 3 image generation.
Your task is to enhance the user's prompt to produce better, more detailed images.

Guidelines:
- Add specific visual details (lighting, composition, style)
- Maintain the original intent
- Keep it under 1000 characters
- Use clear, descriptive language
- Include artistic style references if appropriate

Return ONLY the enhanced prompt, nothing else.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content?.trim() || prompt;
    } catch (error) {
      aiLogger.warn('ImageGeneration', 'Failed to enhance prompt, using original', {
        error: (error as Error).message,
      });
      return prompt;
    }
  }

  /**
   * Generate variations of an existing image description
   */
  async generateVariations(
    description: string,
    count: number = 3
  ): Promise<{ prompts: string[]; error?: string }> {
    try {
      const client = this.getClient();

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Generate ${count} different variations of an image prompt.
Each variation should explore a different artistic style, perspective, or mood while keeping the core subject.
Return ONLY a JSON array of strings, e.g.: ["prompt1", "prompt2", "prompt3"]`,
          },
          {
            role: 'user',
            content: description,
          },
        ],
        max_tokens: 1000,
        temperature: 0.9,
      });

      const content = response.choices[0]?.message?.content?.trim() || '[]';

      try {
        const prompts = JSON.parse(content);
        if (Array.isArray(prompts)) {
          return { prompts };
        }
      } catch {
        // Parse failed, try to extract prompts manually
      }

      return { prompts: [description] };
    } catch (error) {
      return {
        prompts: [],
        error: (error as Error).message,
      };
    }
  }

  /**
   * Estimate cost for image generation
   */
  estimateCost(
    size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024',
    quality: 'standard' | 'hd' = 'standard',
    count: number = 1
  ): number {
    const pricePerImage = DALLE3_PRICING[quality]?.[size] || 0.04;
    return pricePerImage * count;
  }

  /**
   * Check if image generation is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      this.getClient();
      return true;
    } catch {
      return false;
    }
  }
}

export const imageGenerationService = new ImageGenerationService();
export default imageGenerationService;
