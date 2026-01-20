/**
 * Image Service for AI Vision
 *
 * Handles image processing for multimodal AI interactions:
 * - Base64 encoding/decoding
 * - Image compression
 * - MIME type validation
 * - Size optimization for API limits
 *
 * FLOW-AI-VISION: Image input processing
 */

import logger from '../../utils/Logger.js';

// Lazy load sharp to avoid runtime errors if not installed
let sharp: any;
const loadSharp = async () => {
  if (!sharp) {
    try {
      sharp = (await import('sharp')).default;
    } catch (error) {
      throw new Error('sharp package is required for image processing. Please install it: npm install sharp');
    }
  }
  return sharp;
};

// ==========================================
// TYPES
// ==========================================

export interface ProcessedImage {
  base64: string;
  mimeType: string;
  originalSize: number;
  processedSize: number;
  width: number;
  height: number;
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  size?: number;
}

// Supported MIME types for vision models
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Max sizes for different providers
const MAX_SIZES = {
  openai: 20 * 1024 * 1024, // 20MB for GPT-4V
  anthropic: 5 * 1024 * 1024, // 5MB for Claude
  google: 20 * 1024 * 1024, // 20MB for Gemini
  default: 4 * 1024 * 1024, // 4MB default
};

// Max dimensions (will resize if larger)
const MAX_DIMENSION = 2048;

// ==========================================
// VALIDATION
// ==========================================

/**
 * Validate image file/buffer
 */
export function validateImage(data: Buffer | string, mimeType?: string): ImageValidationResult {
  try {
    let buffer: Buffer;
    let detectedMime = mimeType;

    // Handle base64 string
    if (typeof data === 'string') {
      // Check for data URL format
      const dataUrlMatch = data.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUrlMatch) {
        detectedMime = dataUrlMatch[1];
        buffer = Buffer.from(dataUrlMatch[2], 'base64');
      } else {
        // Assume raw base64
        buffer = Buffer.from(data, 'base64');
      }
    } else {
      buffer = data;
    }

    // Detect MIME type from magic bytes if not provided
    if (!detectedMime) {
      detectedMime = detectMimeType(buffer);
    }

    // Validate MIME type
    if (!detectedMime || !SUPPORTED_MIME_TYPES.includes(detectedMime)) {
      return {
        valid: false,
        error: `Unsupported image type: ${detectedMime || 'unknown'}. Supported: ${SUPPORTED_MIME_TYPES.join(', ')}`,
      };
    }

    // Check size
    if (buffer.length > MAX_SIZES.default * 2) {
      return {
        valid: false,
        error: `Image too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB. Max: ${((MAX_SIZES.default * 2) / 1024 / 1024).toFixed(0)}MB`,
      };
    }

    return {
      valid: true,
      mimeType: detectedMime,
      size: buffer.length,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: `Invalid image data: ${error.message}`,
    };
  }
}

/**
 * Detect MIME type from buffer magic bytes
 */
function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif';
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

// ==========================================
// PROCESSING
// ==========================================

/**
 * Process image for AI vision API
 * - Resizes if too large
 * - Compresses to reduce size
 * - Returns base64 encoded
 */
export async function processImageForVision(
  data: Buffer | string,
  options: {
    maxSize?: number;
    maxDimension?: number;
    quality?: number;
    provider?: 'openai' | 'anthropic' | 'google';
  } = {}
): Promise<ProcessedImage> {
  const {
    maxSize = MAX_SIZES[options.provider || 'default'] || MAX_SIZES.default,
    maxDimension = MAX_DIMENSION,
    quality = 85,
  } = options;

  let buffer: Buffer;
  let mimeType: string;

  // Parse input
  if (typeof data === 'string') {
    const dataUrlMatch = data.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      buffer = Buffer.from(dataUrlMatch[2], 'base64');
    } else {
      buffer = Buffer.from(data, 'base64');
      mimeType = detectMimeType(buffer) || 'image/jpeg';
    }
  } else {
    buffer = data;
    mimeType = detectMimeType(buffer) || 'image/jpeg';
  }

  const originalSize = buffer.length;

  try {
    // Get image metadata
    const sharpLib = await loadSharp();
    const metadata = await sharpLib(buffer).metadata();
    let { width = 0, height = 0 } = metadata;

    // Check if resize needed
    const needsResize = width > maxDimension || height > maxDimension;
    const needsCompress = buffer.length > maxSize;

    if (!needsResize && !needsCompress) {
      // Return as-is
      return {
        base64: buffer.toString('base64'),
        mimeType,
        originalSize,
        processedSize: buffer.length,
        width,
        height,
      };
    }

    // Process with sharp
    let sharpInstance = sharpLib(buffer);

    // Resize if needed
    if (needsResize) {
      const scale = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      sharpInstance = sharpInstance.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to JPEG for compression (unless PNG with transparency)
    let outputBuffer: Buffer;
    let outputMime: string;

    if (mimeType === 'image/png') {
      // Check for transparency
      const hasAlpha = metadata.hasAlpha;
      if (hasAlpha) {
        // Keep as PNG but compress
        outputBuffer = await sharpInstance.png({ quality, compressionLevel: 9 }).toBuffer();
        outputMime = 'image/png';
      } else {
        // Convert to JPEG
        outputBuffer = await sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer();
        outputMime = 'image/jpeg';
      }
    } else if (mimeType === 'image/gif') {
      // Keep as GIF (sharp preserves animation)
      outputBuffer = await sharpInstance.gif().toBuffer();
      outputMime = 'image/gif';
    } else if (mimeType === 'image/webp') {
      outputBuffer = await sharpInstance.webp({ quality }).toBuffer();
      outputMime = 'image/webp';
    } else {
      // Default to JPEG
      outputBuffer = await sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer();
      outputMime = 'image/jpeg';
    }

    // If still too large, reduce quality further
    if (outputBuffer.length > maxSize && quality > 50) {
      const reducedQuality = Math.max(50, quality - 20);
      outputBuffer = await sharpLib(buffer)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: reducedQuality, mozjpeg: true })
        .toBuffer();
      outputMime = 'image/jpeg';
    }

    logger.debug(
      `[ImageService] Processed image: ${originalSize} -> ${outputBuffer.length} bytes (${((1 - outputBuffer.length / originalSize) * 100).toFixed(1)}% reduction)`
    );

    return {
      base64: outputBuffer.toString('base64'),
      mimeType: outputMime,
      originalSize,
      processedSize: outputBuffer.length,
      width,
      height,
    };
  } catch (error: any) {
    logger.error('[ImageService] Processing error:', error);
    // Return original if processing fails
    return {
      base64: buffer.toString('base64'),
      mimeType,
      originalSize,
      processedSize: buffer.length,
      width: 0,
      height: 0,
    };
  }
}

/**
 * Convert image to data URL format
 */
export function toDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Extract base64 and mime from data URL
 */
export function fromDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    base64: match[2],
  };
}

/**
 * Build multimodal content array for OpenAI/Anthropic
 */
export function buildMultimodalContent(
  text: string,
  images: ProcessedImage[]
): Array<{ type: string; text?: string; image_url?: { url: string }; source?: any }> {
  const content: any[] = [];

  // Add text if present
  if (text) {
    content.push({ type: 'text', text });
  }

  // Add images
  for (const image of images) {
    // OpenAI format
    content.push({
      type: 'image_url',
      image_url: {
        url: toDataUrl(image.base64, image.mimeType),
        detail: 'auto', // Can be 'low', 'high', or 'auto'
      },
    });
  }

  return content;
}

/**
 * Build Anthropic-specific content format
 */
export function buildAnthropicContent(
  text: string,
  images: ProcessedImage[]
): Array<{ type: string; text?: string; source?: any }> {
  const content: any[] = [];

  // Add images first (Anthropic prefers images before text)
  for (const image of images) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mimeType,
        data: image.base64,
      },
    });
  }

  // Add text
  if (text) {
    content.push({ type: 'text', text });
  }

  return content;
}

// ==========================================
// EXPORTS
// ==========================================

export const imageService = {
  validate: validateImage,
  process: processImageForVision,
  toDataUrl,
  fromDataUrl,
  buildMultimodalContent,
  buildAnthropicContent,
  SUPPORTED_MIME_TYPES,
  MAX_SIZES,
};

export default imageService;
