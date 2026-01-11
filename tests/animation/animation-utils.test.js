/**
 * Animation Tests
 * Tests for CSS/JS animation utilities
 *
 * @module tests/animation/animation-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Easing functions
const createEasingFunctions = () => {
  return {
    linear: (t) => t,

    easeInQuad: (t) => t * t,

    easeOutQuad: (t) => t * (2 - t),

    easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

    easeInCubic: (t) => t * t * t,

    easeOutCubic: (t) => --t * t * t + 1,

    easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),

    easeInElastic: (t) => {
      if (t === 0 || t === 1) return t;
      return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
    },

    easeOutElastic: (t) => {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
    },

    easeOutBounce: (t) => {
      if (t < 1 / 2.75) {
        return 7.5625 * t * t;
      } else if (t < 2 / 2.75) {
        return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      } else if (t < 2.5 / 2.75) {
        return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      } else {
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
      }
    },
  };
};

// Animation controller
const createAnimationController = () => {
  const animations = new Map();
  let frameId = null;
  let isRunning = false;

  const tick = (timestamp) => {
    for (const [id, anim] of animations) {
      if (anim.startTime === null) {
        anim.startTime = timestamp;
      }

      const elapsed = timestamp - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);
      const easedProgress = anim.easing(progress);

      anim.onUpdate(easedProgress, anim.getValue(easedProgress));

      if (progress >= 1) {
        anim.onComplete?.();
        animations.delete(id);
      }
    }

    if (animations.size > 0) {
      frameId = requestAnimationFrame(tick);
    } else {
      isRunning = false;
    }
  };

  return {
    animate: (options) => {
      const { from = 0, to = 1, duration = 300, easing = (t) => t, onUpdate, onComplete } = options;

      const id = crypto.randomUUID();

      animations.set(id, {
        from,
        to,
        duration,
        easing,
        onUpdate,
        onComplete,
        startTime: null,
        getValue: (progress) => from + (to - from) * progress,
      });

      if (!isRunning) {
        isRunning = true;
        frameId = requestAnimationFrame(tick);
      }

      return id;
    },

    cancel: (id) => {
      animations.delete(id);
    },

    cancelAll: () => {
      animations.clear();
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      isRunning = false;
    },

    getActiveCount: () => animations.size,

    isRunning: () => isRunning,
  };
};

// Keyframe animation
const createKeyframeAnimation = (keyframes) => {
  return {
    getValueAt: (progress) => {
      if (keyframes.length === 0) return null;
      if (keyframes.length === 1) return keyframes[0].value;

      // Find surrounding keyframes
      let prev = keyframes[0];
      let next = keyframes[keyframes.length - 1];

      for (let i = 0; i < keyframes.length - 1; i++) {
        if (progress >= keyframes[i].offset && progress <= keyframes[i + 1].offset) {
          prev = keyframes[i];
          next = keyframes[i + 1];
          break;
        }
      }

      // Interpolate
      const range = next.offset - prev.offset;
      const localProgress = range > 0 ? (progress - prev.offset) / range : 0;

      if (typeof prev.value === 'number') {
        return prev.value + (next.value - prev.value) * localProgress;
      }

      // Object interpolation
      if (typeof prev.value === 'object') {
        const result = {};
        for (const key of Object.keys(prev.value)) {
          result[key] = prev.value[key] + (next.value[key] - prev.value[key]) * localProgress;
        }
        return result;
      }

      return prev.value;
    },

    getDuration: () => {
      return keyframes[keyframes.length - 1]?.offset || 0;
    },

    getKeyframeCount: () => keyframes.length,
  };
};

// Spring animation
const createSpringAnimation = (options = {}) => {
  const { stiffness = 100, damping = 10, mass = 1, precision = 0.01 } = options;

  let position = 0;
  let velocity = 0;
  let target = 0;

  return {
    setTarget: (t) => {
      target = t;
    },

    step: (dt) => {
      const displacement = position - target;
      const springForce = -stiffness * displacement;
      const dampingForce = -damping * velocity;
      const acceleration = (springForce + dampingForce) / mass;

      velocity += acceleration * dt;
      position += velocity * dt;

      return position;
    },

    isAtRest: () => {
      return Math.abs(position - target) < precision && Math.abs(velocity) < precision;
    },

    getPosition: () => position,

    setPosition: (p) => {
      position = p;
    },

    reset: () => {
      position = 0;
      velocity = 0;
      target = 0;
    },
  };
};

describe('Easing Functions Tests', () => {
  let easing;

  beforeEach(() => {
    easing = createEasingFunctions();
  });

  it('should have linear at boundaries', () => {
    expect(easing.linear(0)).toBe(0);
    expect(easing.linear(1)).toBe(1);
  });

  it('should ease in quad', () => {
    expect(easing.easeInQuad(0.5)).toBe(0.25);
  });

  it('should ease out quad', () => {
    expect(easing.easeOutQuad(0.5)).toBe(0.75);
  });

  it('should ease in out quad', () => {
    expect(easing.easeInOutQuad(0)).toBe(0);
    expect(easing.easeInOutQuad(1)).toBe(1);
  });

  it('should have elastic boundaries', () => {
    expect(easing.easeInElastic(0)).toBe(0);
    expect(easing.easeInElastic(1)).toBe(1);
  });

  it('should bounce at end', () => {
    expect(easing.easeOutBounce(1)).toBeCloseTo(1);
  });
});

describe('Animation Controller Tests', () => {
  let controller;

  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb) => setTimeout(cb, 16))
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    controller = createAnimationController();
  });

  afterEach(() => {
    controller.cancelAll();
    vi.unstubAllGlobals();
  });

  it('should start animation', () => {
    const onUpdate = vi.fn();
    controller.animate({ onUpdate, duration: 100 });

    expect(controller.getActiveCount()).toBe(1);
  });

  it('should cancel animation', () => {
    const id = controller.animate({ onUpdate: vi.fn() });
    controller.cancel(id);

    expect(controller.getActiveCount()).toBe(0);
  });

  it('should cancel all', () => {
    controller.animate({ onUpdate: vi.fn() });
    controller.animate({ onUpdate: vi.fn() });
    controller.cancelAll();

    expect(controller.getActiveCount()).toBe(0);
  });
});

describe('Keyframe Animation Tests', () => {
  it('should interpolate between keyframes', () => {
    const animation = createKeyframeAnimation([
      { offset: 0, value: 0 },
      { offset: 1, value: 100 },
    ]);

    expect(animation.getValueAt(0.5)).toBe(50);
  });

  it('should handle object values', () => {
    const animation = createKeyframeAnimation([
      { offset: 0, value: { x: 0, y: 0 } },
      { offset: 1, value: { x: 100, y: 200 } },
    ]);

    const value = animation.getValueAt(0.5);
    expect(value.x).toBe(50);
    expect(value.y).toBe(100);
  });

  it('should report keyframe count', () => {
    const animation = createKeyframeAnimation([
      { offset: 0, value: 0 },
      { offset: 0.5, value: 50 },
      { offset: 1, value: 100 },
    ]);

    expect(animation.getKeyframeCount()).toBe(3);
  });
});

describe('Spring Animation Tests', () => {
  let spring;

  beforeEach(() => {
    spring = createSpringAnimation({ stiffness: 100, damping: 10 });
  });

  it('should move towards target', () => {
    spring.setTarget(100);

    for (let i = 0; i < 100; i++) {
      spring.step(0.016);
    }

    expect(spring.getPosition()).toBeGreaterThan(0);
  });

  it('should come to rest', () => {
    spring.setTarget(100);

    for (let i = 0; i < 1000; i++) {
      spring.step(0.016);
    }

    expect(spring.isAtRest()).toBe(true);
  });

  it('should reset', () => {
    spring.setTarget(100);
    spring.step(0.016);
    spring.reset();

    expect(spring.getPosition()).toBe(0);
  });
});
