/**
 * Canvas Utilities Tests
 * Tests for canvas drawing and manipulation
 *
 * @module tests/canvas/canvas-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Canvas context mock
const createMockContext = () => {
  const state = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  };

  const stateStack = [];
  const drawCalls = [];

  return {
    ...state,

    save: vi.fn(() => {
      stateStack.push({ ...state });
    }),

    restore: vi.fn(() => {
      const saved = stateStack.pop();
      if (saved) Object.assign(state, saved);
    }),

    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn((x, y) => drawCalls.push({ type: 'moveTo', x, y })),
    lineTo: vi.fn((x, y) => drawCalls.push({ type: 'lineTo', x, y })),
    arc: vi.fn((x, y, r, start, end) => drawCalls.push({ type: 'arc', x, y, r })),
    rect: vi.fn((x, y, w, h) => drawCalls.push({ type: 'rect', x, y, w, h })),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn((x, y, w, h) => drawCalls.push({ type: 'fillRect', x, y, w, h })),
    strokeRect: vi.fn((x, y, w, h) => drawCalls.push({ type: 'strokeRect', x, y, w, h })),
    clearRect: vi.fn((x, y, w, h) => drawCalls.push({ type: 'clearRect', x, y, w, h })),
    fillText: vi.fn((text, x, y) => drawCalls.push({ type: 'fillText', text, x, y })),
    strokeText: vi.fn((text, x, y) => drawCalls.push({ type: 'strokeText', text, x, y })),
    measureText: vi.fn((text) => ({ width: text.length * 8 })),
    drawImage: vi.fn(),
    getImageData: vi.fn((x, y, w, h) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    })),
    putImageData: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),

    getDrawCalls: () => [...drawCalls],
    clearDrawCalls: () => {
      drawCalls.length = 0;
    },
  };
};

// Shape drawing utilities
const createShapeDrawer = (ctx) => {
  return {
    circle: (x, y, radius, options = {}) => {
      const { fill = true, stroke = false } = options;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    },

    rectangle: (x, y, width, height, options = {}) => {
      const { fill = true, stroke = false, radius = 0 } = options;

      if (radius > 0) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0);
        ctx.lineTo(x + width, y + height - radius);
        ctx.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2);
        ctx.lineTo(x + radius, y + height);
        ctx.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI);
        ctx.lineTo(x, y + radius);
        ctx.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
        ctx.closePath();
      } else {
        ctx.rect(x, y, width, height);
      }

      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    },

    line: (x1, y1, x2, y2) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },

    polygon: (points, options = {}) => {
      if (points.length < 3) return;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();

      if (options.fill !== false) ctx.fill();
      if (options.stroke) ctx.stroke();
    },
  };
};

// Animation frame manager
const createAnimationManager = () => {
  let isRunning = false;
  let frameId = null;
  let lastTime = 0;
  const callbacks = [];

  return {
    add: (callback) => {
      callbacks.push(callback);
      return () => {
        const idx = callbacks.indexOf(callback);
        if (idx !== -1) callbacks.splice(idx, 1);
      };
    },

    start: () => {
      if (isRunning) return;
      isRunning = true;
      lastTime = performance.now();

      const loop = (currentTime) => {
        if (!isRunning) return;

        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        for (const callback of callbacks) {
          callback(deltaTime, currentTime);
        }

        frameId = requestAnimationFrame(loop);
      };

      frameId = requestAnimationFrame(loop);
    },

    stop: () => {
      isRunning = false;
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    },

    isRunning: () => isRunning,

    getCallbackCount: () => callbacks.length,
  };
};

// Color utilities
const createColorUtils = () => {
  const rgba = (r, g, b, a = 1) => `rgba(${r}, ${g}, ${b}, ${a})`;
  const hsla = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  const lerp = (color1, color2, t) => {
    const c1 = typeof color1 === 'string' ? hexToRgb(color1) : color1;
    const c2 = typeof color2 === 'string' ? hexToRgb(color2) : color2;

    return {
      r: Math.round(c1.r + (c2.r - c1.r) * t),
      g: Math.round(c1.g + (c2.g - c1.g) * t),
      b: Math.round(c1.b + (c2.b - c1.b) * t),
    };
  };

  return { rgba, hsla, hexToRgb, lerp };
};

describe('Mock Context Tests', () => {
  let ctx;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('should track draw calls', () => {
    ctx.fillRect(0, 0, 100, 100);
    ctx.moveTo(50, 50);
    ctx.lineTo(100, 100);

    const calls = ctx.getDrawCalls();

    expect(calls).toHaveLength(3);
    expect(calls[0].type).toBe('fillRect');
  });

  it('should save and restore state', () => {
    ctx.fillStyle = '#ff0000';
    ctx.save();
    ctx.fillStyle = '#00ff00';
    ctx.restore();

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('should measure text', () => {
    const metrics = ctx.measureText('Hello');

    expect(metrics.width).toBe(40); // 5 chars * 8
  });
});

describe('Shape Drawer Tests', () => {
  let ctx;
  let drawer;

  beforeEach(() => {
    ctx = createMockContext();
    drawer = createShapeDrawer(ctx);
  });

  it('should draw circle', () => {
    drawer.circle(100, 100, 50);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('should draw rectangle', () => {
    drawer.rectangle(10, 10, 100, 50);

    expect(ctx.rect).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('should draw line', () => {
    drawer.line(0, 0, 100, 100);

    const calls = ctx.getDrawCalls();
    expect(calls.some((c) => c.type === 'moveTo')).toBe(true);
    expect(calls.some((c) => c.type === 'lineTo')).toBe(true);
  });

  it('should draw polygon', () => {
    drawer.polygon([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
  });
});

describe('Animation Manager Tests', () => {
  let manager;

  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb) => setTimeout(cb, 16))
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    manager = createAnimationManager();
  });

  afterEach(() => {
    manager.stop();
    vi.unstubAllGlobals();
  });

  it('should add callbacks', () => {
    manager.add(() => {});
    manager.add(() => {});

    expect(manager.getCallbackCount()).toBe(2);
  });

  it('should start and stop', () => {
    manager.start();
    expect(manager.isRunning()).toBe(true);

    manager.stop();
    expect(manager.isRunning()).toBe(false);
  });

  it('should remove callback', () => {
    const remove = manager.add(() => {});
    remove();

    expect(manager.getCallbackCount()).toBe(0);
  });
});

describe('Color Utils Tests', () => {
  let colors;

  beforeEach(() => {
    colors = createColorUtils();
  });

  it('should create rgba string', () => {
    expect(colors.rgba(255, 0, 0, 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('should create hsla string', () => {
    expect(colors.hsla(180, 50, 50)).toBe('hsla(180, 50%, 50%, 1)');
  });

  it('should convert hex to rgb', () => {
    const rgb = colors.hexToRgb('#ff0000');
    expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('should lerp colors', () => {
    const result = colors.lerp('#000000', '#ffffff', 0.5);
    expect(result.r).toBe(128);
  });
});
