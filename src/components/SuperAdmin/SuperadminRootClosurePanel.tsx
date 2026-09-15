import React from 'react';

import { tlumaczPozaHookiem } from '@/utils/tlumaczPozaHookiem';
type SuperadminRootClosurePanelProps = {
  compact?: boolean;
};

export const SuperadminRootClosurePanel: React.FC<SuperadminRootClosurePanelProps> = ({
  compact = false,
}) => (
  <section className={compact ? 'space-y-2' : 'space-y-4'}>
    <h2>One visible platform control plane</h2>
    <ul>
      <li>{tlumaczPozaHookiem("superadmin.superadminRootClosure.tenantsAndCustomers", "Tenants and customers")}</li>
      <li>{tlumaczPozaHookiem("superadmin.superadminRootClosure.aIAndConnectorPlatformOps", "AI and connector platform ops")}</li>
      <li>Control-plane closure rules</li>
    </ul>
  </section>
);

export default SuperadminRootClosurePanel;
