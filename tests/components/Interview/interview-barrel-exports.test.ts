import { describe, expect, it } from 'vitest';

import { AssignInterviewModal, ManageAssignmentModal } from '@/components/Interview';

describe('Interview barrel exports', () => {
  it('exports assignment modals from the Interview component barrel', () => {
    expect(AssignInterviewModal).toBeTypeOf('function');
    expect(ManageAssignmentModal).toBeTypeOf('function');
  });
});
