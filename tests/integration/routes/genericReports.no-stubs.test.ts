import { describe, it } from 'vitest';

// Pending by design: the legacy /api/generic-reports router was removed. Reports
// are now owned by governed report services, so importing the deleted router or
// claiming an executable 503 contract would be dishonest. A replacement test
// must target the selected governed report owner in its module acceptance lane.
describe.skip('Generic reports routes (retired route)', () => {
  it('is replaced by a governed report-owner acceptance contract', () => {});
});
