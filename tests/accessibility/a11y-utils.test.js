/**
 * Accessibility Tests
 * Tests for a11y utilities and ARIA helpers
 *
 * @module tests/accessibility/a11y-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Focus trap
const createFocusTrap = (container) => {
  let firstFocusable = null;
  let lastFocusable = null;
  let isActive = false;

  const getFocusableElements = () => {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    return container.querySelectorAll?.(selector) || [];
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab' || !isActive) return;

    const focusables = getFocusableElements();
    if (focusables.length === 0) return;

    firstFocusable = focusables[0];
    lastFocusable = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === firstFocusable) {
      e.preventDefault();
      lastFocusable.focus();
    } else if (!e.shiftKey && document.activeElement === lastFocusable) {
      e.preventDefault();
      firstFocusable.focus();
    }
  };

  return {
    activate: () => {
      isActive = true;
      document.addEventListener('keydown', handleKeyDown);

      const focusables = getFocusableElements();
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    },

    deactivate: () => {
      isActive = false;
      document.removeEventListener('keydown', handleKeyDown);
    },

    isActive: () => isActive,

    getFocusableCount: () => getFocusableElements().length,
  };
};

// ARIA live region announcer
const createAnnouncer = () => {
  let announcements = [];
  let element = null;

  const init = (el) => {
    element = el;
    if (element) {
      element.setAttribute('role', 'status');
      element.setAttribute('aria-live', 'polite');
      element.setAttribute('aria-atomic', 'true');
    }
  };

  const announce = (message, priority = 'polite') => {
    announcements.push({ message, priority, timestamp: Date.now() });

    if (element) {
      element.setAttribute('aria-live', priority);
      element.textContent = message;
    }

    return message;
  };

  const announceAssertive = (message) => {
    return announce(message, 'assertive');
  };

  const clear = () => {
    if (element) {
      element.textContent = '';
    }
  };

  return {
    init,
    announce,
    announceAssertive,
    clear,
    getAnnouncements: () => [...announcements],
    getLastAnnouncement: () => announcements[announcements.length - 1],
  };
};

// Keyboard navigation helper
const createKeyboardNav = (items, options = {}) => {
  const { wrap = true, orientation = 'vertical' } = options;

  let currentIndex = 0;

  const getNextKey = () => (orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown');
  const getPrevKey = () => (orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp');

  return {
    handleKeyDown: (e) => {
      switch (e.key) {
        case getNextKey():
          e.preventDefault();
          this.next();
          break;
        case getPrevKey():
          e.preventDefault();
          this.previous();
          break;
        case 'Home':
          e.preventDefault();
          this.first();
          break;
        case 'End':
          e.preventDefault();
          this.last();
          break;
      }
    },

    next: () => {
      if (currentIndex < items.length - 1) {
        currentIndex++;
      } else if (wrap) {
        currentIndex = 0;
      }
      return currentIndex;
    },

    previous: () => {
      if (currentIndex > 0) {
        currentIndex--;
      } else if (wrap) {
        currentIndex = items.length - 1;
      }
      return currentIndex;
    },

    first: () => {
      currentIndex = 0;
      return currentIndex;
    },

    last: () => {
      currentIndex = items.length - 1;
      return currentIndex;
    },

    getCurrentIndex: () => currentIndex,

    setCurrentIndex: (index) => {
      currentIndex = Math.max(0, Math.min(index, items.length - 1));
    },

    getCurrentItem: () => items[currentIndex],
  };
};

// Screen reader text helper
const createSROnly = () => {
  return {
    getStyles: () => ({
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    }),

    wrapText: (text) => {
      return `<span class="sr-only">${text}</span>`;
    },

    createHiddenLabel: (text, forId) => {
      return {
        tag: 'label',
        attributes: {
          for: forId,
          class: 'sr-only',
        },
        text,
      };
    },
  };
};

// Color contrast checker
const createContrastChecker = () => {
  const getLuminance = (r, g, b) => {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

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

  const getContrastRatio = (color1, color2) => {
    const rgb1 = typeof color1 === 'string' ? hexToRgb(color1) : color1;
    const rgb2 = typeof color2 === 'string' ? hexToRgb(color2) : color2;

    const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  };

  const meetsWCAG = (color1, color2, level = 'AA', size = 'normal') => {
    const ratio = getContrastRatio(color1, color2);

    if (level === 'AAA') {
      return size === 'large' ? ratio >= 4.5 : ratio >= 7;
    }
    // AA
    return size === 'large' ? ratio >= 3 : ratio >= 4.5;
  };

  const findAccessibleColor = (background, targetColors) => {
    for (const color of targetColors) {
      if (meetsWCAG(background, color)) {
        return color;
      }
    }
    return null;
  };

  return { getContrastRatio, meetsWCAG, findAccessibleColor };
};

describe('Focus Trap Tests', () => {
  let container;
  let trap;

  beforeEach(() => {
    container = {
      querySelectorAll: vi.fn().mockReturnValue([{ focus: vi.fn() }, { focus: vi.fn() }]),
    };
    trap = createFocusTrap(container);
  });

  it('should activate', () => {
    trap.activate();

    expect(trap.isActive()).toBe(true);
  });

  it('should deactivate', () => {
    trap.activate();
    trap.deactivate();

    expect(trap.isActive()).toBe(false);
  });

  it('should count focusable elements', () => {
    expect(trap.getFocusableCount()).toBe(2);
  });
});

describe('Announcer Tests', () => {
  let announcer;

  beforeEach(() => {
    announcer = createAnnouncer();
  });

  it('should announce message', () => {
    announcer.announce('Hello');

    const last = announcer.getLastAnnouncement();
    expect(last.message).toBe('Hello');
  });

  it('should use polite by default', () => {
    announcer.announce('Test');

    const last = announcer.getLastAnnouncement();
    expect(last.priority).toBe('polite');
  });

  it('should announce assertive', () => {
    announcer.announceAssertive('Important!');

    const last = announcer.getLastAnnouncement();
    expect(last.priority).toBe('assertive');
  });

  it('should track all announcements', () => {
    announcer.announce('First');
    announcer.announce('Second');

    expect(announcer.getAnnouncements()).toHaveLength(2);
  });
});

describe('Keyboard Nav Tests', () => {
  let nav;

  beforeEach(() => {
    nav = createKeyboardNav(['a', 'b', 'c'], { wrap: true });
  });

  it('should navigate next', () => {
    nav.next();

    expect(nav.getCurrentIndex()).toBe(1);
  });

  it('should navigate previous', () => {
    nav.next();
    nav.previous();

    expect(nav.getCurrentIndex()).toBe(0);
  });

  it('should wrap around', () => {
    nav.previous();

    expect(nav.getCurrentIndex()).toBe(2);
  });

  it('should go to first', () => {
    nav.next();
    nav.next();
    nav.first();

    expect(nav.getCurrentIndex()).toBe(0);
  });

  it('should go to last', () => {
    nav.last();

    expect(nav.getCurrentIndex()).toBe(2);
  });
});

describe('Contrast Checker Tests', () => {
  let checker;

  beforeEach(() => {
    checker = createContrastChecker();
  });

  it('should calculate contrast ratio', () => {
    const ratio = checker.getContrastRatio('#000000', '#ffffff');

    expect(ratio).toBeCloseTo(21, 0);
  });

  it('should check WCAG AA', () => {
    expect(checker.meetsWCAG('#000000', '#ffffff', 'AA')).toBe(true);
    expect(checker.meetsWCAG('#777777', '#888888', 'AA')).toBe(false);
  });

  it('should check WCAG AAA', () => {
    expect(checker.meetsWCAG('#000000', '#ffffff', 'AAA')).toBe(true);
  });

  it('should find accessible color', () => {
    const color = checker.findAccessibleColor('#ffffff', ['#000000', '#cccccc']);

    expect(color).toBe('#000000');
  });
});
