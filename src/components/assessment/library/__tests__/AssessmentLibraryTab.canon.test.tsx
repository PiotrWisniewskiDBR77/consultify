/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({
  columns: [] as any[],
  data: [] as any[],
  preview: null as any,
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'pl' } }) }));
vi.mock('react-hot-toast', () => ({
  default: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/components/standard', () => ({
  StandardTable: (props: any) => {
    captured.columns = props.columns;
    captured.data = props.data;
    return <button onClick={() => props.onRowClick(props.data[0])}>wybierz DRD</button>;
  },
  StandardPreview: (props: any) => {
    captured.preview = props;
    return (
      <button onClick={props.actions.informational[0].onClick}>
        {props.actions.informational[0].label}
      </button>
    );
  },
}));
vi.mock('@/components/shared/PreviewPane', () => ({
  PreviewPaneAside: ({ children }: any) => <aside data-preview-pane>{children}</aside>,
}));
vi.mock('@/method-core/api/methodCoreApi', () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  newIdempotencyKey: () => 'key',
  MethodCoreApiError: class extends Error {},
}));

import { AssessmentLibraryTab } from '../AssessmentLibraryTab';

describe('AssessmentLibraryTab B2 canonical contract', () => {
  it('declares exactly seven B2 columns and no session rows', () => {
    render(<AssessmentLibraryTab />);
    expect(captured.columns.map((column) => column.id)).toEqual([
      'name',
      'area',
      'description',
      'questionCount',
      'duration',
      'status',
      'lastUsed',
    ]);
    expect(captured.columns.filter((column) => column.sortable).map((column) => column.id)).toEqual(
      ['name', 'area', 'status']
    );
    expect(
      captured.columns.filter((column) => column.filterable).map((column) => column.id)
    ).toEqual(['area', 'status']);
    expect(captured.data).toHaveLength(5);
    expect(captured.data.every((row) => !('sessionId' in row))).toBe(true);
    expect(captured.data.find((row) => row.id === 'DRD').questionCount).toBeGreaterThan(0);
    expect(captured.data.find((row) => row.id === 'ADMA').duration).toBeNull();
    expect(captured.data.find((row) => row.id === 'ADMA').lastUsed).toBeNull();
  });

  it('opens StandardPreview with axes and the existing start action', () => {
    render(<AssessmentLibraryTab />);
    fireEvent.click(screen.getByRole('button', { name: 'wybierz DRD' }));
    expect(screen.getByRole('complementary')).toHaveAttribute('data-preview-pane');
    expect(captured.preview.details.text).toContain('Osie i obszary');
    expect(captured.preview.details.text).toContain('•');
    expect(screen.getByRole('button', { name: 'Rozpocznij ocenę' })).toBeInTheDocument();
  });
});
