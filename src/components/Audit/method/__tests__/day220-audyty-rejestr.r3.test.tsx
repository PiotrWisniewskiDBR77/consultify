import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    listReports: vi.fn(),
  };
});

import { AuditProcessesTab } from '../tabs/AuditProcessesTab';
import { AuditReportsTab } from '../tabs/AuditReportsTab';
import {
  listReports,
  type AuditProgramSummary,
} from '../auditsMethodApi';

const longPack = 'Pakiet audytu transformacji — operacje wewnętrzne i odpowiedzialność właścicielska';
const longAudience = 'wewnętrzny przegląd właścicielski i komitet sterujący transformacją';
const longConfidentiality = 'wewnętrzny — dostęp ograniczony do zespołu właścicielskiego';

const program: AuditProgramSummary = {
  id: 'w3-aud-program-v1', name: 'Audyt transformacji', packId: 'w3-aud-pack-v1',
  packTitle: null, packVersion: 1, lifecycleState: 'findings_review',
  applicableCriteria: 1, concludedCriteria: 1, openFindings: 1,
  leadAuditorId: 'w3-aud-lead-user-v1', leadAuditorName: null,
  plannedStart: null, plannedEnd: null, updatedAt: '2026-08-21T09:40:00Z',
};


describe('Day220 R3 — pełna wartość jest dostępna mimo zwartego układu tabel', () => {
  it('udostępnia pełny tytuł pakietu i nazwę audytora w Sesjach', () => {
    render(<AuditProcessesTab programs={[program]} loading={false} error={null} onRetry={() => {}} isPolish onProgramChanged={() => {}} packTitleById={new Map([[program.packId, longPack]])} userNameById={new Map([['w3-aud-lead-user-v1', 'Alicja Audytorka']])} />);
    expect(screen.getByTitle(longPack)).toHaveTextContent(longPack);
    expect(screen.getByTitle('Alicja Audytorka')).toBeInTheDocument();
  });

  it('udostępnia pełnego odbiorcę i poufność w Raportach', async () => {
    vi.mocked(listReports).mockResolvedValue({ items: [{ id:'w3-aud-report-v1', programId:program.id, programName:program.name, reportKind:'audit_report', version:1, title:'Raport właścicielski', status:'draft', language:'en', audience:longAudience, confidentiality:longConfidentiality, approvedAt:null, publishedAt:null, updatedAt:'2026-08-21T09:40:00Z' }], total:1 });
    render(<AuditReportsTab isPolish />);
    expect(await screen.findByTitle(longAudience)).toHaveTextContent(longAudience);
    expect(screen.getByTitle(longConfidentiality)).toHaveTextContent(longConfidentiality);
  });

});
