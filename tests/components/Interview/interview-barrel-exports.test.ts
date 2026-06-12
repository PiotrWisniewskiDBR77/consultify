import { describe, expect, it } from 'vitest';

import { AssignInterviewModal, InterviewHub, InterviewWorkspace } from '@/components/Interview';

describe('Interview barrel exports', () => {
  it('exports core components from the Interview component barrel', () => {
    expect(AssignInterviewModal).toBeTypeOf('function');
    expect(InterviewHub).toBeTypeOf('function');
    expect(InterviewWorkspace).toBeTypeOf('function');
  });
});
