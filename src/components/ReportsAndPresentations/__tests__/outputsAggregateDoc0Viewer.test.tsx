/**
 * @vitest-environment jsdom
 *
 * DOC-0 etap 1 (b) (DEC-593, Wpis 68 pkt 2-3) — rozwidlenie `openRow` w liście
 * Outputs (All/Mine/Review): przy fladze `VITE_DOC0_DOCUMENT_VIEWER` ON każde
 * otwarcie ZATWIERDZONEGO dokumentu (2-klik / „Open full" / kebab „Open") prowadzi
 * do JEDNEGO `DocumentViewer`; 1-klik zostaje podglądem; „Edit" z viewera = jawne
 * przejście starą trasą (Report Builder). Przy fladze OFF — zachowanie z linii
 * bajt w bajt (nawigacja tą samą trasą, viewer się NIE renderuje).
 *
 * MUTACJE (zmierzone, meldunek Wpis 68):
 *  (a) `openRow` pomija `mode:'viewer'` i zawsze nawiguje starą ścieżką → testy ON CZERWONE,
 *  (b) `resolveArtifactOpenTarget` bez warunku flagi → test OFF CZERWONY.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateSpy = vi.hoisted(() => vi.fn());
const tableProps = vi.hoisted(() => ({ current: null as any }));
const previewProps = vi.hoisted(() => ({ current: null as any }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
  useLocation: () => ({ search: '', pathname: '/presentations' }),
}));

vi.mock('react-hot-toast', () => ({
  default: { loading: vi.fn(() => 'toast-1'), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('@/components/shared/states', () => ({ LoadingState: () => null }));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: () => null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: () => null,
  DialogHeader: () => null,
  DialogTitle: () => null,
}));

vi.mock('@/components/ui/primitives', () => ({
  Button: ({ children }: any) => <button>{children}</button>,
  ErrorState: () => null,
}));

vi.mock('@/components/ui/primitives/chips', () => ({
  EntityStatusChip: () => null,
  statusChipTone: () => 'neutral',
}));

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('@/utils/sheetArtifactOpen', () => ({
  downloadSheetArtifactXlsx: vi.fn(),
  resolveTablePlatformWorkspaceIdForTable: vi.fn(async () => null),
}));

vi.mock('../../../services/api', () => ({ API_URL: 'http://test', getHeaders: () => ({}) }));

vi.mock('../../shared/ModuleHub', () => ({ GridView: () => null }));

vi.mock('../../standard', () => ({
  StandardTable: (props: any) => {
    tableProps.current = props;
    return <div data-testid="std-table" />;
  },
  StandardPreview: (props: any) => {
    previewProps.current = props;
    return <div data-testid="std-preview" />;
  },
  standardPreviewShortcuts: () => ({}),
}));

vi.mock('../../documents/DocumentViewer', () => ({
  // Stub buttons carry no visible label on purpose: the J0 language gate counts
  // EN/PL literals in JSX, and these are test-only handles clicked by testid.
  DocumentViewer: (props: any) => (
    <div data-testid="doc0-viewer-stub" data-artifact-id={props.artifactId}>
      <button type="button" data-testid="doc0-viewer-edit" onClick={props.onEdit} />
      <button type="button" data-testid="doc0-viewer-close" onClick={props.onClose} />
    </div>
  ),
}));

vi.mock('../duplicateArtifactToDraft', () => ({ duplicateArtifactToCanvasDraft: vi.fn() }));
vi.mock('../SaveAsTemplateModal', () => ({ SaveAsTemplateModal: () => null }));
vi.mock('../TrustStatePreviewSection', () => ({ TrustStatePreviewSection: () => null }));
vi.mock('../useTrustState', () => ({ useTrustState: () => null }));

import { getArtifactPath } from '@/utils/artifactLinks';

import { OutputsAggregateTabContent } from '../OutputsAggregateTabContent';
import type { UnifiedOutputRow } from '../types';

const LS_KEY = 'ff.doc0DocumentViewer';

function row(overrides: Partial<UnifiedOutputRow> = {}): UnifiedOutputRow {
  return {
    kind: 'document',
    originRecordId: 'rpt-doc0-1',
    artifactId: 'art-doc0-1',
    title: 'doc0-approved-row',
    statusKey: 'ready',
    owner: 'Owner Name',
    updatedAt: '2026-09-15T10:00:00.000Z',
    exportFormats: [],
    fileFormat: 'DOCX',
    ...overrides,
  } as UnifiedOutputRow;
}

const approvedDoc = row();
const draftDoc = row({
  originRecordId: 'rpt-doc0-2',
  artifactId: 'art-doc0-2',
  statusKey: 'draft',
  title: 'doc0-draft-row',
});

function renderTab(rows: UnifiedOutputRow[] = [approvedDoc, draftDoc]) {
  return render(
    <OutputsAggregateTabContent
      viewMode="table"
      searchQuery=""
      activeFilters={[]}
      onFilterChange={vi.fn()}
      rows={rows}
      loading={false}
      onRefresh={vi.fn()}
      actions={{} as any}
    />
  );
}

function aggregateRow(target: UnifiedOutputRow) {
  return { ...target, id: `${target.kind}:${target.originRecordId}`, title: target.title };
}

beforeEach(() => {
  vi.clearAllMocks();
  tableProps.current = null;
  previewProps.current = null;
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('openRow — flaga ON (DEC-593): zatwierdzony dokument → JEDEN DocumentViewer', () => {
  beforeEach(() => {
    window.localStorage.setItem(LS_KEY, '1');
  });

  it('2-klik na zatwierdzony dokument otwiera viewer (bez nawigacji)', () => {
    renderTab();
    act(() => tableProps.current.onRowDoubleClick(aggregateRow(approvedDoc)));
    expect(screen.getByTestId('doc0-viewer-stub')).toBeTruthy();
    expect(screen.getByTestId('doc0-viewer-stub').getAttribute('data-artifact-id')).toBe('art-doc0-1');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('kebab „Open" otwiera viewer', () => {
    renderTab();
    const menu = tableProps.current.rowMenu(aggregateRow(approvedDoc));
    const open = menu.primary.find((item: any) => item.id === 'open');
    act(() => open.onClick());
    expect(screen.getByTestId('doc0-viewer-stub')).toBeTruthy();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('1-klik zostaje podglądem; „Open full" z podglądu otwiera viewer', () => {
    renderTab();
    act(() => tableProps.current.onRowClick(aggregateRow(approvedDoc)));
    // 1-klik: podgląd widoczny, viewer NIE, zero nawigacji.
    expect(screen.getByTestId('std-preview')).toBeTruthy();
    expect(screen.queryByTestId('doc0-viewer-stub')).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
    act(() => previewProps.current.onOpenFull());
    expect(screen.getByTestId('doc0-viewer-stub')).toBeTruthy();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('„Edit" z viewera = jawne przejście starą trasą do Report Buildera i zamknięcie viewera', () => {
    renderTab();
    act(() => tableProps.current.onRowDoubleClick(aggregateRow(approvedDoc)));
    fireEvent.click(screen.getByTestId('doc0-viewer-edit'));
    expect(navigateSpy).toHaveBeenCalledWith(getArtifactPath('report', 'rpt-doc0-1'));
    expect(screen.queryByTestId('doc0-viewer-stub')).toBeNull();
  });

  it('Close wraca do listy bez nawigacji', () => {
    renderTab();
    act(() => tableProps.current.onRowDoubleClick(aggregateRow(approvedDoc)));
    fireEvent.click(screen.getByTestId('doc0-viewer-close'));
    expect(screen.queryByTestId('doc0-viewer-stub')).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('SZKIC dokumentu przy ON nadal starą trasą (viewer tylko zatwierdzone)', () => {
    renderTab();
    act(() => tableProps.current.onRowDoubleClick(aggregateRow(draftDoc)));
    expect(screen.queryByTestId('doc0-viewer-stub')).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(getArtifactPath('report', 'rpt-doc0-2'));
  });
});

describe('openRow — flaga OFF: parytet z linią bajt w bajt', () => {
  beforeEach(() => {
    window.localStorage.setItem(LS_KEY, '0');
  });

  it('zatwierdzony dokument: navigate DOKŁADNIE starą trasą, viewer się NIE renderuje', () => {
    renderTab();
    act(() => tableProps.current.onRowDoubleClick(aggregateRow(approvedDoc)));
    expect(navigateSpy).toHaveBeenCalledWith(getArtifactPath('report', 'rpt-doc0-1'));
    expect(screen.queryByTestId('doc0-viewer-stub')).toBeNull();
  });

  it('kebab „Open" przy OFF = stara trasa', () => {
    renderTab();
    const menu = tableProps.current.rowMenu(aggregateRow(approvedDoc));
    act(() => menu.primary.find((item: any) => item.id === 'open').onClick());
    expect(navigateSpy).toHaveBeenCalledWith(getArtifactPath('report', 'rpt-doc0-1'));
    expect(screen.queryByTestId('doc0-viewer-stub')).toBeNull();
  });
});
