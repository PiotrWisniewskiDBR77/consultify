import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyPreviewPositioning,
  LIGHT_LUMA_MIN,
  validateCaptureState,
} from '../click-then-shoot.mjs';

describe('click-then-shoot protocol', () => {
  it('classifies the canonical static preview as a side panel', () => {
    assert.equal(classifyPreviewPositioning({ position: 'static', inset: 'auto', zIndex: 'auto' }), 'side-panel');
  });

  it('uses a positive control to classify a fixed high-stack preview as an overlay', () => {
    assert.equal(classifyPreviewPositioning({ position: 'fixed', inset: '0px', zIndex: '50' }), 'overlay');
  });

  it('rejects the naive before-click mutation when it accidentally contains preview', () => {
    assert.throws(() => validateCaptureState({ mode: 'before-click', previewVisible: true }), /naiwny kadr zawiera podgląd/);
  });

  it('rejects capture when preview is absent after row click', () => {
    assert.throws(() => validateCaptureState({ mode: 'after-click', previewVisible: false }), /Brak podglądu po kliknięciu/);
  });

  it('accepts capture only after the preview selector is visible', () => {
    assert.equal(validateCaptureState({ mode: 'after-click', previewVisible: true }), true);
    assert.equal(LIGHT_LUMA_MIN, 150);
  });
});
