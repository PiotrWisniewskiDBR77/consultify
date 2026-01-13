/**
 * Modal/Dialog Tests
 * Tests for modal dialog management
 *
 * @module tests/ui/modal.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Modal manager implementation
const createModalManager = () => {
  const modals = [];
  const listeners = { open: [], close: [], change: [] };

  const emit = (event, data) => {
    listeners[event]?.forEach((fn) => fn(data));
  };

  return {
    open: (id, config = {}) => {
      const modal = {
        id,
        ...config,
        openedAt: Date.now(),
        zIndex: 1000 + modals.length,
      };
      modals.push(modal);
      emit('open', modal);
      emit('change', { action: 'open', modal });
      return modal;
    },

    close: (id) => {
      const index = modals.findIndex((m) => m.id === id);
      if (index === -1) return false;

      const [modal] = modals.splice(index, 1);
      emit('close', modal);
      emit('change', { action: 'close', modal });
      return true;
    },

    closeLast: () => {
      if (modals.length === 0) return false;
      return this.close(modals[modals.length - 1].id);
    },

    closeAll: () => {
      const count = modals.length;
      while (modals.length > 0) {
        this.closeLast();
      }
      return count;
    },

    isOpen: (id) => modals.some((m) => m.id === id),

    getModal: (id) => modals.find((m) => m.id === id),

    getActiveModal: () => modals[modals.length - 1] || null,

    getOpenModals: () => [...modals],

    getStackSize: () => modals.length,

    on: (event, handler) => {
      if (listeners[event]) {
        listeners[event].push(handler);
      }
      return () => {
        const index = listeners[event]?.indexOf(handler);
        if (index !== -1) listeners[event].splice(index, 1);
      };
    },

    bringToFront: (id) => {
      const index = modals.findIndex((m) => m.id === id);
      if (index === -1 || index === modals.length - 1) return false;

      const [modal] = modals.splice(index, 1);
      modal.zIndex = 1000 + modals.length;
      modals.push(modal);
      return true;
    },
  };
};

// Confirmation dialog helper
const createConfirmDialog = (modalManager) => {
  let resolvePromise;
  let rejectPromise;

  return {
    show: (message, options = {}) => {
      const { title = 'Confirm', confirmText = 'OK', cancelText = 'Cancel' } = options;

      return new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;

        modalManager.open('confirm-dialog', {
          type: 'confirm',
          title,
          message,
          confirmText,
          cancelText,
        });
      });
    },

    confirm: () => {
      modalManager.close('confirm-dialog');
      resolvePromise?.(true);
    },

    cancel: () => {
      modalManager.close('confirm-dialog');
      resolvePromise?.(false);
    },
  };
};

// Alert dialog helper
const createAlertDialog = (modalManager) => {
  let resolvePromise;

  return {
    show: (message, options = {}) => {
      const { title = 'Alert', buttonText = 'OK' } = options;

      return new Promise((resolve) => {
        resolvePromise = resolve;
        modalManager.open('alert-dialog', {
          type: 'alert',
          title,
          message,
          buttonText,
        });
      });
    },

    dismiss: () => {
      modalManager.close('alert-dialog');
      resolvePromise?.();
    },
  };
};

// Prompt dialog helper
const createPromptDialog = (modalManager) => {
  let resolvePromise;
  let inputValue = '';

  return {
    show: (message, options = {}) => {
      const { title = 'Input', defaultValue = '', placeholder = '' } = options;
      inputValue = defaultValue;

      return new Promise((resolve) => {
        resolvePromise = resolve;
        modalManager.open('prompt-dialog', {
          type: 'prompt',
          title,
          message,
          placeholder,
          defaultValue,
        });
      });
    },

    submit: (value) => {
      modalManager.close('prompt-dialog');
      resolvePromise?.(value);
    },

    cancel: () => {
      modalManager.close('prompt-dialog');
      resolvePromise?.(null);
    },

    setValue: (value) => {
      inputValue = value;
    },
  };
};

describe('Modal Manager Tests', () => {
  let modalManager;

  beforeEach(() => {
    modalManager = createModalManager();
  });

  // ═══════════════════════════════════════════════════════════════════
  // OPEN / CLOSE
  // ═══════════════════════════════════════════════════════════════════

  describe('open / close', () => {
    it('should open modal', () => {
      modalManager.open('test-modal');

      expect(modalManager.isOpen('test-modal')).toBe(true);
    });

    it('should close modal', () => {
      modalManager.open('test-modal');
      modalManager.close('test-modal');

      expect(modalManager.isOpen('test-modal')).toBe(false);
    });

    it('should return false when closing non-existent modal', () => {
      expect(modalManager.close('non-existent')).toBe(false);
    });

    it('should close last modal', () => {
      modalManager.open('modal-1');
      modalManager.open('modal-2');
      modalManager.closeLast();

      expect(modalManager.isOpen('modal-2')).toBe(false);
      expect(modalManager.isOpen('modal-1')).toBe(true);
    });

    it('should close all modals', () => {
      modalManager.open('modal-1');
      modalManager.open('modal-2');
      modalManager.open('modal-3');

      const count = modalManager.closeAll();

      expect(count).toBe(3);
      expect(modalManager.getStackSize()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // STACK
  // ═══════════════════════════════════════════════════════════════════

  describe('stack', () => {
    it('should track stack size', () => {
      modalManager.open('modal-1');
      modalManager.open('modal-2');

      expect(modalManager.getStackSize()).toBe(2);
    });

    it('should get active modal', () => {
      modalManager.open('modal-1');
      modalManager.open('modal-2');

      expect(modalManager.getActiveModal().id).toBe('modal-2');
    });

    it('should get all open modals', () => {
      modalManager.open('modal-1');
      modalManager.open('modal-2');

      const modals = modalManager.getOpenModals();
      expect(modals.length).toBe(2);
    });

    it('should assign z-index', () => {
      modalManager.open('modal-1');
      modalManager.open('modal-2');

      expect(modalManager.getModal('modal-2').zIndex).toBeGreaterThan(
        modalManager.getModal('modal-1').zIndex
      );
    });

    it('should bring modal to front', () => {
      modalManager.open('modal-1');
      modalManager.open('modal-2');
      modalManager.bringToFront('modal-1');

      expect(modalManager.getActiveModal().id).toBe('modal-1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════════

  describe('events', () => {
    it('should emit open event', () => {
      const handler = vi.fn();
      modalManager.on('open', handler);

      modalManager.open('test-modal');

      expect(handler).toHaveBeenCalled();
    });

    it('should emit close event', () => {
      const handler = vi.fn();
      modalManager.on('close', handler);

      modalManager.open('test-modal');
      modalManager.close('test-modal');

      expect(handler).toHaveBeenCalled();
    });

    it('should unsubscribe from events', () => {
      const handler = vi.fn();
      const unsubscribe = modalManager.on('open', handler);

      unsubscribe();
      modalManager.open('test-modal');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════════════

  describe('config', () => {
    it('should store modal config', () => {
      modalManager.open('test-modal', {
        title: 'My Modal',
        data: { key: 'value' },
      });

      const modal = modalManager.getModal('test-modal');
      expect(modal.title).toBe('My Modal');
      expect(modal.data.key).toBe('value');
    });
  });
});

describe('Confirm Dialog Tests', () => {
  let modalManager;
  let confirmDialog;

  beforeEach(() => {
    modalManager = createModalManager();
    confirmDialog = createConfirmDialog(modalManager);
  });

  it('should resolve true on confirm', async () => {
    const promise = confirmDialog.show('Are you sure?');

    setTimeout(() => confirmDialog.confirm(), 10);

    const result = await promise;
    expect(result).toBe(true);
  });

  it('should resolve false on cancel', async () => {
    const promise = confirmDialog.show('Are you sure?');

    setTimeout(() => confirmDialog.cancel(), 10);

    const result = await promise;
    expect(result).toBe(false);
  });

  it('should open confirm modal', () => {
    confirmDialog.show('Test message');

    expect(modalManager.isOpen('confirm-dialog')).toBe(true);
  });
});

describe('Prompt Dialog Tests', () => {
  let modalManager;
  let promptDialog;

  beforeEach(() => {
    modalManager = createModalManager();
    promptDialog = createPromptDialog(modalManager);
  });

  it('should return input value on submit', async () => {
    const promise = promptDialog.show('Enter name:');

    setTimeout(() => promptDialog.submit('John'), 10);

    const result = await promise;
    expect(result).toBe('John');
  });

  it('should return null on cancel', async () => {
    const promise = promptDialog.show('Enter name:');

    setTimeout(() => promptDialog.cancel(), 10);

    const result = await promise;
    expect(result).toBeNull();
  });
});
