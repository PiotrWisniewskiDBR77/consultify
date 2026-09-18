/**
 * OP-2a evidence harness (Wpis 99, wiersz planu 65 / U-27) — mounts the REAL
 * `AuditsMethodHub` (Library tab) and the REAL `AuditPackObjectPage` behind a
 * `MemoryRouter` that carries the SAME two routes `AppRoutes.tsx` registers
 * (`/audit-programs` and `/audit-programs/packs/:packId`), with pack data from
 * `mocks/qoderOp2aFakeServer`. Nothing here re-implements a screen: the
 * components, the gates and the i18n keys are the production ones.
 *
 * URL params:
 *   &view=list|object        (default list)
 *   &pack=pack-draft-1|pack-published-1   (default pack-draft-1)
 *
 * The object route wrapper below mirrors `AppRoutes.AuditPackObjectRoute`
 * (not exported — importing `AppRoutes` into a harness would pull the whole
 * route tree). The flag is ON in this harness by design: OP-2a's screenshots
 * are the owner-acceptance material for the gated screen; the OFF path is
 * covered by `AuditLibraryTab.packViewerEntry.test.tsx`.
 */
import '../../src/index.css';

import React from 'react';
import { MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';

import { AuditsMethodHub } from '../../src/components/Audit/method/AuditsMethodHub';
import { AuditPackObjectPage } from '../../src/components/Audit/method/pack/AuditPackObjectPage';

const params = new URLSearchParams(window.location.search);
const view = params.get('view') === 'object' ? 'object' : 'list';
const packId = params.get('pack') || 'pack-draft-1';
const initialEntry =
  view === 'object'
    ? `/audit-programs/packs/${encodeURIComponent(packId)}`
    : '/audit-programs?tab=library';

const ObjectRoute: React.FC = () => {
  const routeParams = useParams<{ packId: string }>();
  const navigate = useNavigate();
  return (
    <AuditPackObjectPage
      packId={routeParams.packId ?? null}
      onBack={() => navigate('/audit-programs?tab=library')}
      onStartAudit={(pack) =>
        navigate(`/audit-programs?tab=library&selectPackId=${encodeURIComponent(pack.id)}`)
      }
    />
  );
};

export default function QoderOp2aPackObjectScreen(): React.ReactElement {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--c-bg)]">
        <Routes>
          <Route path="/audit-programs" element={<AuditsMethodHub />} />
          <Route path="/audit-programs/packs/:packId" element={<ObjectRoute />} />
        </Routes>
      </div>
    </MemoryRouter>
  );
}
