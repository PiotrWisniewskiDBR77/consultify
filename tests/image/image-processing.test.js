/**
 * Image Processing Tests
 * Tests for image manipulation utilities
 * 
 * @module tests/image/image-processing.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Image data wrapper
const createImageData = (width, height, data = null) => {
    const pixels = data || new Uint8ClampedArray(width * height * 4);

    return {
        width,
        height,
        data: pixels,

        getPixel: (x, y) => {
            const i = (y * width + x) * 4;
            return {
                r: pixels[i],
                g: pixels[i + 1],
                b: pixels[i + 2],
                a: pixels[i + 3],
            };
        },

        setPixel: (x, y, r, g, b, a = 255) => {
            const i = (y * width + x) * 4;
            pixels[i] = r;
            pixels[i + 1] = g;
            pixels[i + 2] = b;
            pixels[i + 3] = a;
        },

        clone: () => {
            return createImageData(width, height, new Uint8ClampedArray(pixels));
        },

        forEach: (callback) => {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    callback(x, y, {
                        r: pixels[i],
                        g: pixels[i + 1],
                        b: pixels[i + 2],
                        a: pixels[i + 3],
                    });
                }
            }
        },
    };
};

// Image filters
const createImageFilters = () => {
    return {
        grayscale: (imageData) => {
            const result = imageData.clone();

            result.forEach((x, y, { r, g, b, a }) => {
                const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                result.setPixel(x, y, gray, gray, gray, a);
            });

            return result;
        },

        invert: (imageData) => {
            const result = imageData.clone();

            result.forEach((x, y, { r, g, b, a }) => {
                result.setPixel(x, y, 255 - r, 255 - g, 255 - b, a);
            });

            return result;
        },

        brightness: (imageData, factor) => {
            const result = imageData.clone();

            result.forEach((x, y, { r, g, b, a }) => {
                const adjust = (v) => Math.min(255, Math.max(0, Math.round(v * factor)));
                result.setPixel(x, y, adjust(r), adjust(g), adjust(b), a);
            });

            return result;
        },

        contrast: (imageData, factor) => {
            const result = imageData.clone();
            const adjust = (v) => Math.min(255, Math.max(0, Math.round(((v / 255 - 0.5) * factor + 0.5) * 255)));

            result.forEach((x, y, { r, g, b, a }) => {
                result.setPixel(x, y, adjust(r), adjust(g), adjust(b), a);
            });

            return result;
        },

        sepia: (imageData) => {
            const result = imageData.clone();

            result.forEach((x, y, { r, g, b, a }) => {
                const tr = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
                const tg = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
                const tb = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
                result.setPixel(x, y, Math.round(tr), Math.round(tg), Math.round(tb), a);
            });

            return result;
        },

        blur: (imageData, radius = 1) => {
            const result = imageData.clone();
            const { width, height } = imageData;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let r = 0, g = 0, b = 0, count = 0;

                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;

                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const pixel = imageData.getPixel(nx, ny);
                                r += pixel.r;
                                g += pixel.g;
                                b += pixel.b;
                                count++;
                            }
                        }
                    }

                    const original = imageData.getPixel(x, y);
                    result.setPixel(x, y,
                        Math.round(r / count),
                        Math.round(g / count),
                        Math.round(b / count),
                        original.a
                    );
                }
            }

            return result;
        },
    };
};

// Image resizer
const createImageResizer = () => {
    return {
        resize: (imageData, newWidth, newHeight) => {
            const result = createImageData(newWidth, newHeight);
            const { width, height } = imageData;

            const xRatio = width / newWidth;
            const yRatio = height / newHeight;

            for (let y = 0; y < newHeight; y++) {
                for (let x = 0; x < newWidth; x++) {
                    const srcX = Math.floor(x * xRatio);
                    const srcY = Math.floor(y * yRatio);
                    const pixel = imageData.getPixel(srcX, srcY);
                    result.setPixel(x, y, pixel.r, pixel.g, pixel.b, pixel.a);
                }
            }

            return result;
        },

        crop: (imageData, x, y, width, height) => {
            const result = createImageData(width, height);

            for (let dy = 0; dy < height; dy++) {
                for (let dx = 0; dx < width; dx++) {
                    const pixel = imageData.getPixel(x + dx, y + dy);
                    result.setPixel(dx, dy, pixel.r, pixel.g, pixel.b, pixel.a);
                }
            }

            return result;
        },

        rotate90: (imageData) => {
            const { width, height } = imageData;
            const result = createImageData(height, width);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixel = imageData.getPixel(x, y);
                    result.setPixel(height - 1 - y, x, pixel.r, pixel.g, pixel.b, pixel.a);
                }
            }

            return result;
        },

        flipHorizontal: (imageData) => {
            const { width, height } = imageData;
            const result = createImageData(width, height);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixel = imageData.getPixel(width - 1 - x, y);
                    result.setPixel(x, y, pixel.r, pixel.g, pixel.b, pixel.a);
                }
            }

            return result;
        },

        flipVertical: (imageData) => {
            const { width, height } = imageData;
            const result = createImageData(width, height);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixel = imageData.getPixel(x, height - 1 - y);
                    result.setPixel(x, y, pixel.r, pixel.g, pixel.b, pixel.a);
                }
            }

            return result;
        },
    };
};

// Image analyzer
const createImageAnalyzer = () => {
    return {
        getHistogram: (imageData) => {
            const histogram = { r: new Array(256).fill(0), g: new Array(256).fill(0), b: new Array(256).fill(0) };

            imageData.forEach((x, y, { r, g, b }) => {
                histogram.r[r]++;
                histogram.g[g]++;
                histogram.b[b]++;
            });

            return histogram;
        },

        getAverageColor: (imageData) => {
            let r = 0, g = 0, b = 0, count = 0;

            imageData.forEach((x, y, pixel) => {
                r += pixel.r;
                g += pixel.g;
                b += pixel.b;
                count++;
            });

            return {
                r: Math.round(r / count),
                g: Math.round(g / count),
                b: Math.round(b / count),
            };
        },

        getDominantColor: (imageData, sampleSize = 10) => {
            const colors = new Map();

            imageData.forEach((x, y, { r, g, b }) => {
                // Quantize to reduce colors
                const qr = Math.round(r / sampleSize) * sampleSize;
                const qg = Math.round(g / sampleSize) * sampleSize;
                const qb = Math.round(b / sampleSize) * sampleSize;

                const key = `${qr},${qg},${qb}`;
                colors.set(key, (colors.get(key) || 0) + 1);
            });

            let maxCount = 0;
            let dominant = null;

            for (const [key, count] of colors) {
                if (count > maxCount) {
                    maxCount = count;
                    dominant = key;
                }
            }

            const [r, g, b] = dominant.split(',').map(Number);
            return { r, g, b };
        },
    };
};

describe('Image Data Tests', () => {
    let imageData;

    beforeEach(() => {
        imageData = createImageData(10, 10);
    });

    it('should set and get pixel', () => {
        imageData.setPixel(5, 5, 255, 128, 64, 200);
        const pixel = imageData.getPixel(5, 5);

        expect(pixel).toEqual({ r: 255, g: 128, b: 64, a: 200 });
    });

    it('should clone', () => {
        imageData.setPixel(0, 0, 255, 0, 0);
        const clone = imageData.clone();

        expect(clone.getPixel(0, 0).r).toBe(255);

        clone.setPixel(0, 0, 0, 255, 0);
        expect(imageData.getPixel(0, 0).r).toBe(255); // Original unchanged
    });

    it('should iterate with forEach', () => {
        let count = 0;
        imageData.forEach(() => count++);

        expect(count).toBe(100);
    });
});

describe('Image Filter Tests', () => {
    let filters;
    let imageData;

    beforeEach(() => {
        filters = createImageFilters();
        imageData = createImageData(2, 2);
        imageData.setPixel(0, 0, 100, 150, 200, 255);
    });

    it('should apply grayscale', () => {
        const result = filters.grayscale(imageData);
        const pixel = result.getPixel(0, 0);

        expect(pixel.r).toBe(pixel.g);
        expect(pixel.g).toBe(pixel.b);
    });

    it('should invert colors', () => {
        const result = filters.invert(imageData);
        const pixel = result.getPixel(0, 0);

        expect(pixel.r).toBe(155);
        expect(pixel.g).toBe(105);
        expect(pixel.b).toBe(55);
    });

    it('should adjust brightness', () => {
        const result = filters.brightness(imageData, 1.5);
        const pixel = result.getPixel(0, 0);

        expect(pixel.r).toBe(150);
    });
});

describe('Image Resizer Tests', () => {
    let resizer;
    let imageData;

    beforeEach(() => {
        resizer = createImageResizer();
        imageData = createImageData(10, 10);
        imageData.setPixel(0, 0, 255, 0, 0);
    });

    it('should resize', () => {
        const result = resizer.resize(imageData, 5, 5);

        expect(result.width).toBe(5);
        expect(result.height).toBe(5);
    });

    it('should crop', () => {
        const result = resizer.crop(imageData, 2, 2, 5, 5);

        expect(result.width).toBe(5);
        expect(result.height).toBe(5);
    });

    it('should rotate 90 degrees', () => {
        const result = resizer.rotate90(imageData);

        expect(result.width).toBe(10);
        expect(result.height).toBe(10);
    });

    it('should flip horizontal', () => {
        const result = resizer.flipHorizontal(imageData);
        const pixel = result.getPixel(9, 0);

        expect(pixel.r).toBe(255);
    });
});

describe('Image Analyzer Tests', () => {
    let analyzer;
    let imageData;

    beforeEach(() => {
        analyzer = createImageAnalyzer();
        imageData = createImageData(2, 2);
        imageData.setPixel(0, 0, 100, 100, 100);
        imageData.setPixel(1, 0, 100, 100, 100);
        imageData.setPixel(0, 1, 200, 200, 200);
        imageData.setPixel(1, 1, 200, 200, 200);
    });

    it('should get histogram', () => {
        const histogram = analyzer.getHistogram(imageData);

        expect(histogram.r[100]).toBe(2);
        expect(histogram.r[200]).toBe(2);
    });

    it('should get average color', () => {
        const avg = analyzer.getAverageColor(imageData);

        expect(avg.r).toBe(150);
    });

    it('should get dominant color', () => {
        imageData.setPixel(0, 1, 100, 100, 100); // Make 100 dominant

        const dominant = analyzer.getDominantColor(imageData);

        expect(dominant.r).toBe(100);
    });
});
