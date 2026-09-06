/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({
  columns: [] as any[],
  data: [] as any[],
  preview: null as any,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'test' }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'pl' },
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));
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
// TESTY-ZASTANE (06.09.2026): AssessmentLibraryTab przeszedł na JedenPrawyPanel
// (@/components/shared/PreviewPane/JedenPrawyPanel) — import PreviewPaneAside
// zostaje w pliku źródłowym, ale jest martwy (nigdzie nie wywołany), więc
// mockowanie go tu nie miało żadnego efektu na renderowane DOM. Realny prawy
// panel renderuje JedenPrawyPanel bez mocka (jego <aside data-right-panel>).
vi.mock('@/method-core/api/methodCoreApi', () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  newIdempotencyKey: () => 'key',
  MethodCoreApiError: class extends Error {},
}));

import { AssessmentLibraryTab } from '../AssessmentLibraryTab';

describe('AssessmentLibraryTab B2 canonical contract', () => {
  /**
   * Odbiór 05.09 (05-ocena, defekt 3): zatwierdzony obraz biblioteki
   * (evidence/grafika/218-piec-rodzin/PO__assessment-five-surfaces__light.png)
   * ma CZTERY kolumny — METODYKA | OBSZAR | STATUS | DZIAŁANIA z przyciskiem
   * „Uruchom" w każdym wierszu. Na żywo było siedem kolumn i żadnej akcji
   * w wierszu. Kontrakt zmienia się więc na: osiem ZADEKLAROWANYCH kolumn,
   * z których cztery są domyślnie widoczne, a cztery czekają w pstryczku.
   */
  it('deklaruje osiem kolumn, z czego cztery z obrazu są domyślnie widoczne', () => {
    render(<AssessmentLibraryTab />);
    expect(captured.columns.map((column) => column.id)).toEqual([
      'name',
      'area',
      'description',
      'questionCount',
      'duration',
      'status',
      'lastUsed',
      'actions',
    ]);
    expect(
      captured.columns
        .filter((column) => column.defaultVisible !== false)
        .map((column) => column.id)
    ).toEqual(['name', 'area', 'status', 'actions']);
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
    expect(screen.getByRole('complementary')).toHaveAttribute('data-right-panel');
    expect(captured.preview.details.text).toContain('Osie i obszary');
    expect(captured.preview.details.text).toContain('•');
    expect(screen.getByRole('button', { name: 'Rozpocznij ocenę' })).toBeInTheDocument();
  });

  it('renders the real StandardTable structure instead of a bespoke table', async () => {
    vi.resetModules();
    vi.doUnmock('@/components/standard');
    const { AssessmentLibraryTab: AssessmentLibraryTabWithRealStandardTable } = await import(
      '../AssessmentLibraryTab'
    );

    const { container } = render(<AssessmentLibraryTabWithRealStandardTable />);
    expect(container.querySelector('table[data-min-table-width]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.viewSettings' })).toBeInTheDocument();
  });
});

/**
 * Odbiór 05.09 (05-ocena, defekt 3) — kolumna DZIAŁANIA i etykiety statusu.
 */
describe('AssessmentLibraryTab — kolumna DZIAŁANIA z obrazu', () => {
  it('daje przycisk „Uruchom" w wierszu metodyki z działającym silnikiem', () => {
    render(<AssessmentLibraryTab />);
    const actionsCol = captured.columns.find((c) => c.id === 'actions');
    expect(actionsCol).toBeTruthy();
    expect(actionsCol.label).toBe('Działania');

    const drd = captured.data.find((row) => row.id === 'DRD');
    render(<>{actionsCol.render(drd)}</>);
    const button = screen.getByTestId('library-start-DRD');
    expect(button).toHaveTextContent('Uruchom');
    expect(button).not.toBeDisabled();
  });

  it('wyszarza „Uruchom" dla metodyki, której nie da się jeszcze uruchomić', () => {
    render(<AssessmentLibraryTab />);
    const actionsCol = captured.columns.find((c) => c.id === 'actions');
    const cmmi = captured.data.find((row) => row.id === 'CMMI');
    render(<>{actionsCol.render(cmmi)}</>);
    expect(screen.getByTestId('library-start-CMMI')).toBeDisabled();
  });

  it('nazywa statusy tak jak obraz: „Rdzeń metody" i „Planowane"', () => {
    render(<AssessmentLibraryTab />);
    const statusCol = captured.columns.find((c) => c.id === 'status');
    const drd = captured.data.find((row) => row.id === 'DRD');
    const cmmi = captured.data.find((row) => row.id === 'CMMI');

    const { container: coreEl } = render(<>{statusCol.render(drd)}</>);
    expect(coreEl.textContent).toContain('Rdzeń metody');
    const { container: plannedEl } = render(<>{statusCol.render(cmmi)}</>);
    expect(plannedEl.textContent).toContain('Planowane');

    expect(statusCol.filterOptions.map((o: any) => o.label)).toEqual([
      'Rdzeń metody',
      'Planowane',
    ]);
  });
});

/**
 * Odbiór 05.09 — zasiew widoczności kolumn unieważniał `defaultVisible`.
 * Zmierzone na żywo: po dodaniu `defaultVisible: false` tabela DALEJ rysowała
 * osiem kolumn, bo komponent przy pierwszym wejściu wpisywał do localStorage
 * `filterableTable.cols.assessment.hub.library` z `visibility` = wszystko
 * widoczne, a FilterableTable czyta ten klucz PRZED domyślkami kolumn.
 */
describe('AssessmentLibraryTab — nie zasiewa widoczności kolumn do localStorage', () => {
  it('po zamontowaniu localStorage nie ma wpisu układu kolumn', () => {
    window.localStorage.removeItem('filterableTable.cols.assessment.hub.library');
    render(<AssessmentLibraryTab />);
    expect(
      window.localStorage.getItem('filterableTable.cols.assessment.hub.library')
    ).toBeNull();
  });
});
