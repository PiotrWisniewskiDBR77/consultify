/**
 * Color Utilities Tests
 * Tests for color manipulation and conversion
 * 
 * @module tests/color/color-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Color utilities
const createColorUtils = () => {
    return {
        hexToRgb: (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            if (!result) return null;
            return {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16),
            };
        },

        rgbToHex: (r, g, b) => {
            return '#' + [r, g, b].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
        },

        rgbToHsl: (r, g, b) => {
            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            let h, s;
            const l = (max + min) / 2;

            if (max === min) {
                h = s = 0;
            } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                    case g: h = ((b - r) / d + 2) / 6; break;
                    case b: h = ((r - g) / d + 4) / 6; break;
                }
            }

            return {
                h: Math.round(h * 360),
                s: Math.round(s * 100),
                l: Math.round(l * 100),
            };
        },

        hslToRgb: (h, s, l) => {
            h /= 360; s /= 100; l /= 100;

            let r, g, b;

            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                };

                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1 / 3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1 / 3);
            }

            return {
                r: Math.round(r * 255),
                g: Math.round(g * 255),
                b: Math.round(b * 255),
            };
        },

        lighten: (hex, amount = 10) => {
            const rgb = this.hexToRgb(hex);
            if (!rgb) return hex;
            const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
            hsl.l = Math.min(100, hsl.l + amount);
            const newRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
            return this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        },

        darken: (hex, amount = 10) => {
            const rgb = this.hexToRgb(hex);
            if (!rgb) return hex;
            const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
            hsl.l = Math.max(0, hsl.l - amount);
            const newRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
            return this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        },

        saturate: (hex, amount = 10) => {
            const rgb = this.hexToRgb(hex);
            if (!rgb) return hex;
            const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
            hsl.s = Math.min(100, hsl.s + amount);
            const newRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
            return this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        },

        desaturate: (hex, amount = 10) => {
            const rgb = this.hexToRgb(hex);
            if (!rgb) return hex;
            const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
            hsl.s = Math.max(0, hsl.s - amount);
            const newRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
            return this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        },

        opacity: (hex, alpha) => {
            const rgb = this.hexToRgb(hex);
            if (!rgb) return hex;
            return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
        },

        contrast: (hex) => {
            const rgb = this.hexToRgb(hex);
            if (!rgb) return '#000000';
            const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
            return luminance > 0.5 ? '#000000' : '#ffffff';
        },

        mix: (color1, color2, weight = 50) => {
            const rgb1 = this.hexToRgb(color1);
            const rgb2 = this.hexToRgb(color2);
            if (!rgb1 || !rgb2) return color1;

            const w = weight / 100;
            const r = Math.round(rgb1.r * (1 - w) + rgb2.r * w);
            const g = Math.round(rgb1.g * (1 - w) + rgb2.g * w);
            const b = Math.round(rgb1.b * (1 - w) + rgb2.b * w);

            return this.rgbToHex(r, g, b);
        },

        complementary: (hex) => {
            const rgb = this.hexToRgb(hex);
            if (!rgb) return hex;
            const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
            hsl.h = (hsl.h + 180) % 360;
            const newRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
            return this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        },

        isValidHex: (hex) => /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex),
    };
};

// Gradient generator
const createGradientGenerator = () => {
    return {
        linear: (colors, direction = 'to right') => {
            return `linear-gradient(${direction}, ${colors.join(', ')})`;
        },

        radial: (colors, shape = 'circle') => {
            return `radial-gradient(${shape}, ${colors.join(', ')})`;
        },

        steps: (color1, color2, steps = 5) => {
            const utils = createColorUtils();
            const rgb1 = utils.hexToRgb(color1);
            const rgb2 = utils.hexToRgb(color2);
            if (!rgb1 || !rgb2) return [color1, color2];

            const result = [];
            for (let i = 0; i < steps; i++) {
                const t = i / (steps - 1);
                const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
                const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
                const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);
                result.push(utils.rgbToHex(r, g, b));
            }
            return result;
        },
    };
};

describe('Color Utils Tests', () => {
    let colors;

    beforeEach(() => {
        colors = createColorUtils();
    });

    it('should convert hex to rgb', () => {
        expect(colors.hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
        expect(colors.hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    });

    it('should convert rgb to hex', () => {
        expect(colors.rgbToHex(255, 0, 0)).toBe('#ff0000');
        expect(colors.rgbToHex(0, 255, 0)).toBe('#00ff00');
    });

    it('should convert rgb to hsl', () => {
        const hsl = colors.rgbToHsl(255, 0, 0);
        expect(hsl.h).toBe(0);
        expect(hsl.s).toBe(100);
        expect(hsl.l).toBe(50);
    });

    it('should lighten color', () => {
        const lighter = colors.lighten('#808080', 20);
        const rgb = colors.hexToRgb(lighter);
        expect(rgb.r).toBeGreaterThan(128);
    });

    it('should darken color', () => {
        const darker = colors.darken('#808080', 20);
        const rgb = colors.hexToRgb(darker);
        expect(rgb.r).toBeLessThan(128);
    });

    it('should get contrast color', () => {
        expect(colors.contrast('#ffffff')).toBe('#000000');
        expect(colors.contrast('#000000')).toBe('#ffffff');
    });

    it('should mix colors', () => {
        const mixed = colors.mix('#ff0000', '#0000ff', 50);
        expect(mixed).toBe('#800080'); // Purple
    });

    it('should get complementary', () => {
        const comp = colors.complementary('#ff0000');
        expect(comp).toBe('#00ffff'); // Cyan
    });

    it('should validate hex', () => {
        expect(colors.isValidHex('#ff0000')).toBe(true);
        expect(colors.isValidHex('#fff')).toBe(true);
        expect(colors.isValidHex('invalid')).toBe(false);
    });
});

describe('Gradient Generator Tests', () => {
    let gradients;

    beforeEach(() => {
        gradients = createGradientGenerator();
    });

    it('should generate linear gradient', () => {
        const gradient = gradients.linear(['#ff0000', '#0000ff']);
        expect(gradient).toContain('linear-gradient');
        expect(gradient).toContain('#ff0000');
    });

    it('should generate radial gradient', () => {
        const gradient = gradients.radial(['#ff0000', '#0000ff']);
        expect(gradient).toContain('radial-gradient');
    });

    it('should generate gradient steps', () => {
        const steps = gradients.steps('#000000', '#ffffff', 3);
        expect(steps).toHaveLength(3);
        expect(steps[0]).toBe('#000000');
        expect(steps[2]).toBe('#ffffff');
    });
});
