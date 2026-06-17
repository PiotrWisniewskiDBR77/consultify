/**
 * @vitest-environment jsdom
 *
 * M10 D-03 — feature flag for the interview pipeline stepper.
 * Default OFF; localStorage beats env; URL query beats localStorage.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  INTERVIEW_PIPELINE_STEPPER_FLAG_KEYS as KEYS,
  isInterviewPipelineStepperEnabled,
} from '../interviewPipelineStepperFlag';

const ORIGINAL_LOCATION = window.location;

function setLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, search },
  });
}

describe('isInterviewPipelineStepperEnabled (D-03)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });
  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  it('defaults to OFF when nothing is set (prod-safe)', () => {
    expect(isInterviewPipelineStepperEnabled()).toBe(false);
  });

  it('honours localStorage override (1)', () => {
    window.localStorage.setItem(KEYS.localStorage, '1');
    expect(isInterviewPipelineStepperEnabled()).toBe(true);
  });

  it('URL query overrides localStorage', () => {
    window.localStorage.setItem(KEYS.localStorage, '1');
    setLocationSearch(`?${KEYS.query}=0`);
    expect(isInterviewPipelineStepperEnabled()).toBe(false);
  });

  it('invalid values fall through to default OFF', () => {
    window.localStorage.setItem(KEYS.localStorage, 'banana');
    expect(isInterviewPipelineStepperEnabled()).toBe(false);
  });

  it('exposes stable flag keys', () => {
    expect(KEYS.localStorage).toBe('ff.interview_pipeline_stepper');
    expect(KEYS.query).toBe('ff_interviewPipelineStepper');
    expect(KEYS.env).toBe('VITE_INTERVIEW_PIPELINE_STEPPER');
  });
});
