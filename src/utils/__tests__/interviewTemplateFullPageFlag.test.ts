/**
 * DEC-533 (U-07 / IS-3a): the full-page interview template editor flag is
 * fail-closed — only the exact string `true` turns it ON, so the document
 * editor keeps the current N-card shell until the owner accepts the screen.
 */
import { describe, expect, it } from 'vitest';

import { isInterviewTemplateFullPageEnabled } from '../interviewTemplateFullPageFlag';

describe('interviewTemplateFullPageFlag — fail-closed', () => {
  it('is OFF for a missing, empty, or non-`true` value', () => {
    expect(isInterviewTemplateFullPageEnabled({})).toBe(false);
    expect(isInterviewTemplateFullPageEnabled({ VITE_INTERVIEW_TEMPLATE_FULLPAGE: '' })).toBe(false);
    expect(isInterviewTemplateFullPageEnabled({ VITE_INTERVIEW_TEMPLATE_FULLPAGE: 'TRUE' })).toBe(false);
    expect(isInterviewTemplateFullPageEnabled({ VITE_INTERVIEW_TEMPLATE_FULLPAGE: '1' })).toBe(false);
    expect(isInterviewTemplateFullPageEnabled({ VITE_INTERVIEW_TEMPLATE_FULLPAGE: 'false' })).toBe(false);
  });

  it('is ON only for the exact string `true`', () => {
    expect(isInterviewTemplateFullPageEnabled({ VITE_INTERVIEW_TEMPLATE_FULLPAGE: 'true' })).toBe(true);
  });
});
