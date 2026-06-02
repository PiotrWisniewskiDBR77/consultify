import React from 'react';

type SuperadminRootClosurePanelProps = {
  compact?: boolean;
};

export const SuperadminRootClosurePanel: React.FC<SuperadminRootClosurePanelProps> = ({
  compact = false,
}) => (
  <section className={compact ? 'space-y-2' : 'space-y-4'}>
    <h2>One visible platform control plane</h2>
    <ul>
      <li>Tenants and customers</li>
      <li>AI and connector platform ops</li>
      <li>Control-plane closure rules</li>
    </ul>
  </section>
);

export default SuperadminRootClosurePanel;
