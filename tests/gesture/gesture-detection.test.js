/**
 * Gesture and Touch Tests
 * Tests for touch gesture detection
 *
 * @module tests/gesture/gesture-detection.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Touch point tracker
const createTouchTracker = () => {
  const touches = new Map();

  return {
    start: (id, x, y, timestamp = Date.now()) => {
      touches.set(id, {
        id,
        startX: x,
        startY: y,
        x,
        y,
        startTime: timestamp,
        lastTime: timestamp,
      });
    },

    move: (id, x, y, timestamp = Date.now()) => {
      const touch = touches.get(id);
      if (touch) {
        touch.x = x;
        touch.y = y;
        touch.lastTime = timestamp;
      }
    },

    end: (id) => {
      const touch = touches.get(id);
      touches.delete(id);
      return touch;
    },

    get: (id) => touches.get(id),

    getAll: () => [...touches.values()],

    getCount: () => touches.size,

    clear: () => touches.clear(),
  };
};

// Gesture recognizer
const createGestureRecognizer = () => {
  const tracker = createTouchTracker();
  const handlers = new Map();

  const calculateDistance = (t1, t2) => {
    return Math.sqrt(Math.pow(t2.x - t1.x, 2) + Math.pow(t2.y - t1.y, 2));
  };

  const calculateAngle = (startX, startY, endX, endY) => {
    return (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;
  };

  return {
    on: (gesture, handler) => {
      handlers.set(gesture, handler);
    },

    handleTouchStart: (touches) => {
      for (const touch of touches) {
        tracker.start(touch.id, touch.x, touch.y);
      }
    },

    handleTouchMove: (touches) => {
      for (const touch of touches) {
        tracker.move(touch.id, touch.x, touch.y);
      }
    },

    handleTouchEnd: (touchIds) => {
      for (const id of touchIds) {
        const touch = tracker.end(id);
        if (!touch) continue;

        const dx = touch.x - touch.startX;
        const dy = touch.y - touch.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const duration = touch.lastTime - touch.startTime;

        // Detect tap
        if (distance < 10 && duration < 300) {
          handlers.get('tap')?.({ x: touch.x, y: touch.y });
        }

        // Detect swipe
        if (distance > 50 && duration < 500) {
          const angle = calculateAngle(touch.startX, touch.startY, touch.x, touch.y);
          let direction;

          if (angle > -45 && angle <= 45) direction = 'right';
          else if (angle > 45 && angle <= 135) direction = 'down';
          else if (angle > -135 && angle <= -45) direction = 'up';
          else direction = 'left';

          handlers.get('swipe')?.({ direction, distance, duration });
        }
      }
    },

    detectPinch: () => {
      const touches = tracker.getAll();
      if (touches.length !== 2) return null;

      const [t1, t2] = touches;
      const currentDistance = calculateDistance(t1, t2);
      const startDistance = calculateDistance(
        { x: t1.startX, y: t1.startY },
        { x: t2.startX, y: t2.startY }
      );

      return {
        scale: currentDistance / startDistance,
        center: {
          x: (t1.x + t2.x) / 2,
          y: (t1.y + t2.y) / 2,
        },
      };
    },

    detectRotation: () => {
      const touches = tracker.getAll();
      if (touches.length !== 2) return null;

      const [t1, t2] = touches;
      const startAngle = calculateAngle(t1.startX, t1.startY, t2.startX, t2.startY);
      const currentAngle = calculateAngle(t1.x, t1.y, t2.x, t2.y);

      return {
        rotation: currentAngle - startAngle,
        center: {
          x: (t1.x + t2.x) / 2,
          y: (t1.y + t2.y) / 2,
        },
      };
    },

    getTracker: () => tracker,
  };
};

// Long press detector
const createLongPressDetector = (options = {}) => {
  const { threshold = 500, moveTolerance = 10 } = options;
  let timer = null;
  let startPos = null;
  let callback = null;

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    startPos = null;
  };

  return {
    onLongPress: (handler) => {
      callback = handler;
    },

    start: (x, y) => {
      startPos = { x, y };
      timer = setTimeout(() => {
        callback?.({ x, y });
      }, threshold);
    },

    move: (x, y) => {
      if (!startPos) return;

      const dx = x - startPos.x;
      const dy = y - startPos.y;

      if (Math.sqrt(dx * dx + dy * dy) > moveTolerance) {
        cancel();
      }
    },

    end: () => {
      cancel();
    },

    cancel,

    isPending: () => timer !== null,
  };
};

// Double tap detector
const createDoubleTapDetector = (options = {}) => {
  const { threshold = 300, distanceTolerance = 50 } = options;
  let lastTap = null;
  let callback = null;

  return {
    onDoubleTap: (handler) => {
      callback = handler;
    },

    tap: (x, y) => {
      const now = Date.now();

      if (lastTap) {
        const timeDiff = now - lastTap.time;
        const distance = Math.sqrt(Math.pow(x - lastTap.x, 2) + Math.pow(y - lastTap.y, 2));

        if (timeDiff < threshold && distance < distanceTolerance) {
          callback?.({ x, y });
          lastTap = null;
          return true;
        }
      }

      lastTap = { x, y, time: now };
      return false;
    },

    reset: () => {
      lastTap = null;
    },
  };
};

describe('Touch Tracker Tests', () => {
  let tracker;

  beforeEach(() => {
    tracker = createTouchTracker();
  });

  it('should start touch', () => {
    tracker.start(1, 100, 200);

    const touch = tracker.get(1);
    expect(touch.startX).toBe(100);
    expect(touch.startY).toBe(200);
  });

  it('should move touch', () => {
    tracker.start(1, 100, 200);
    tracker.move(1, 150, 250);

    const touch = tracker.get(1);
    expect(touch.x).toBe(150);
    expect(touch.y).toBe(250);
  });

  it('should end touch', () => {
    tracker.start(1, 100, 200);
    const touch = tracker.end(1);

    expect(touch.startX).toBe(100);
    expect(tracker.get(1)).toBeUndefined();
  });

  it('should count touches', () => {
    tracker.start(1, 0, 0);
    tracker.start(2, 0, 0);

    expect(tracker.getCount()).toBe(2);
  });
});

describe('Gesture Recognizer Tests', () => {
  let recognizer;

  beforeEach(() => {
    recognizer = createGestureRecognizer();
  });

  it('should detect tap', () => {
    const tapHandler = vi.fn();
    recognizer.on('tap', tapHandler);

    recognizer.handleTouchStart([{ id: 1, x: 100, y: 100 }]);
    recognizer.handleTouchEnd([1]);

    expect(tapHandler).toHaveBeenCalled();
  });

  it('should detect swipe', () => {
    const swipeHandler = vi.fn();
    recognizer.on('swipe', swipeHandler);

    const tracker = recognizer.getTracker();
    tracker.start(1, 100, 100, 0);
    tracker.move(1, 200, 100, 100);
    tracker.touches?.get(1) && (tracker.touches.get(1).lastTime = 100);

    recognizer.handleTouchEnd([1]);

    expect(swipeHandler).toHaveBeenCalledWith(expect.objectContaining({ direction: 'right' }));
  });

  it('should detect pinch', () => {
    recognizer.handleTouchStart([
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 100, y: 0 },
    ]);

    recognizer.handleTouchMove([
      { id: 1, x: -50, y: 0 },
      { id: 2, x: 150, y: 0 },
    ]);

    const pinch = recognizer.detectPinch();

    expect(pinch.scale).toBeGreaterThan(1);
  });
});

describe('Long Press Detector Tests', () => {
  let detector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = createLongPressDetector({ threshold: 500 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should detect long press', () => {
    const handler = vi.fn();
    detector.onLongPress(handler);

    detector.start(100, 100);
    vi.advanceTimersByTime(500);

    expect(handler).toHaveBeenCalledWith({ x: 100, y: 100 });
  });

  it('should cancel on move', () => {
    const handler = vi.fn();
    detector.onLongPress(handler);

    detector.start(100, 100);
    detector.move(200, 200); // Move too far
    vi.advanceTimersByTime(500);

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('Double Tap Detector Tests', () => {
  let detector;

  beforeEach(() => {
    detector = createDoubleTapDetector({ threshold: 300 });
  });

  it('should detect double tap', () => {
    const handler = vi.fn();
    detector.onDoubleTap(handler);

    detector.tap(100, 100);
    const isDouble = detector.tap(100, 100);

    expect(isDouble).toBe(true);
    expect(handler).toHaveBeenCalled();
  });

  it('should not detect with too much distance', () => {
    const handler = vi.fn();
    detector.onDoubleTap(handler);

    detector.tap(0, 0);
    detector.tap(100, 100);

    expect(handler).not.toHaveBeenCalled();
  });
});
