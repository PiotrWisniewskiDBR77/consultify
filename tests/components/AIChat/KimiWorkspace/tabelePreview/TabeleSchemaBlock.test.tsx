/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import TabeleSchemaBlock from '../../../../../src/components/AIChat/KimiWorkspace/tabelePreview/TabeleSchemaBlock';

describe('TabeleSchemaBlock', () => {
  it('renders field name, type, and governance status', () => {
    render(
      <TabeleSchemaBlock
        field={{
          fieldId: 'field-1',
          name: 'risk_score',
          fieldType: 'number',
          governanceState: 'committed',
        }}
        isPolish={false}
      />
    );

    expect(screen.getByText('risk_score')).toBeInTheDocument();
    expect(screen.getByText('number')).toBeInTheDocument();
    expect(screen.getByText('Committed')).toBeInTheDocument();
  });

  it('is clickable when linked to a schema proposal', () => {
    const onClickProposal = vi.fn();

    render(
      <TabeleSchemaBlock
        field={{
          fieldId: 'field-2',
          name: 'legal_owner',
          fieldType: 'user',
          governanceState: 'proposed',
          proposalId: 'proposal-7',
        }}
        isPolish={false}
        onClickProposal={onClickProposal}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /legal_owner/i }));
    expect(onClickProposal).toHaveBeenCalledWith('proposal-7');
  });
});
