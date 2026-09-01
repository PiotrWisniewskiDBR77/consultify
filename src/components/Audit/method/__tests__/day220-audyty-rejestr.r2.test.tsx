import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { AuditProcessesTab } from '../tabs/AuditProcessesTab';
import type { AuditProgramSummary } from '../auditsMethodApi';

const RAW_ID = 'w3-aud-lead-user-v1';
const program: AuditProgramSummary = {
  id: 'w3-aud-program-v1',
  name: 'Audyt zarządzania transformacją',
  packId: 'w3-aud-pack-v1',
  packTitle: null,
  packVersion: 1,
  lifecycleState: 'findings_review',
  applicableCriteria: 1,
  concludedCriteria: 1,
  openFindings: 1,
  leadAuditorId: RAW_ID,
  leadAuditorName: null,
  plannedStart: null,
  plannedEnd: null,
  updatedAt: '2026-08-21T09:40:00Z',
};

describe('Day220 R2 — karta Sesji nie ujawnia surowego ID audytora', () => {
  it('rozwiązuje ID przez mapę użytkowników i nie renderuje identyfikatora fixture', () => {
    render(
      <AuditProcessesTab
        programs={[program]}
        loading={false}
        error={null}
        onRetry={() => {}}
        isPolish
        onProgramChanged={() => {}}
        packTitleById={new Map([['w3-aud-pack-v1', 'Pakiet audytu transformacji']])}
        userNameById={new Map([[RAW_ID, 'Alicja Audytorka']])}
      />
    );

    expect(screen.getByText('Alicja Audytorka')).toBeInTheDocument();
    expect(screen.queryByText(/^w3-aud-.*-v1$/)).toBeNull();
  });
});
