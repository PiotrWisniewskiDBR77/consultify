/**
 * @vitest-environment jsdom
 *
 * ODBIÓR NA ŻYWO 05.09 — `report-artifact`. Raport otwarty z Materiałów ma
 * renderować CZYTELNY dokument (nagłówek + sekcje wersalikami + realna treść),
 * a nie edytor bloków. Schemat w teście jest 1:1 kształtem realnego artefaktu
 * `artifact-d693d17a-…` zmierzonego na stagingu (typ `board_report`, sekcje z
 * `purpose` == `title`, bloki `paragraph` / `risk_table` / `bullet_list`).
 */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { DocumentStudioReportView, isReportDocumentType } from '../DocumentStudioReportView';
import type { DocumentSchema } from '../types';

const schema: DocumentSchema = {
  documentId: 'doc-1',
  artifactId: 'artifact-d693d17a',
  title: 'Raport zarządczy transformacji 2027',
  documentType: 'board_report',
  language: 'pl',
  audience: ['Zarząd', 'CFO'],
  goal: 'inform',
  communicationRegister: 'executive',
  density: 'standard',
  languageStyle: 'consulting',
  confidentiality: 'internal',
  createdAt: '2026-08-06T15:27:57.978Z',
  sourceRefs: [],
  sections: [
    {
      sectionId: 'sec-1',
      orderIndex: 0,
      level: 1,
      title: 'Podsumowanie zarządcze',
      // Realny artefakt powiela tytuł w `purpose` — podtytuł ma wtedy zniknąć.
      purpose: 'Podsumowanie zarządcze',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'blk-1',
          type: 'paragraph',
          content: { text: 'Realizacja planu wynosi 72%.' },
        },
      ],
    },
    {
      sectionId: 'sec-2',
      orderIndex: 1,
      level: 1,
      title: 'Ryzyka',
      purpose: 'RAG per strumień prac',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'blk-2',
          type: 'risk_table',
          content: {
            columns: ['Strumień prac', 'Status'],
            rows: [['Systemy i integracje', 'Zagrożone']],
          },
        },
      ],
    },
  ],
};

afterEach(() => cleanup());

describe('DocumentStudioReportView', () => {
  it('kwalifikuje raporty, a nie dokumenty robocze', () => {
    expect(isReportDocumentType('board_report')).toBe(true);
    expect(isReportDocumentType('steering_committee_report')).toBe(true);
    expect(isReportDocumentType('generic_document')).toBe(false);
    expect(isReportDocumentType('sop_document')).toBe(false);
    expect(isReportDocumentType(undefined)).toBe(false);
  });

  it('renderuje nagłówek, odbiorców, datę i sekcje z realną treścią', () => {
    render(<DocumentStudioReportView schema={schema} />);

    expect(screen.getByTestId('document-studio-report-view')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Raport zarządczy transformacji 2027' })
    ).toBeInTheDocument();

    const meta = screen.getByText(/Zarząd · CFO/);
    expect(meta.textContent).toContain('2026');

    expect(screen.getByRole('heading', { level: 2, name: 'Podsumowanie zarządcze' })).toBeInTheDocument();
    expect(screen.getByText('Realizacja planu wynosi 72%.')).toBeInTheDocument();

    // Tabela ryzyk to współdzielony `DocTableBlock`, nie własna tabela ekranu.
    expect(screen.getByText('Systemy i integracje')).toBeInTheDocument();
    expect(screen.getByText('Zagrożone')).toBeInTheDocument();
  });

  it('nie powiela tytułu sekcji w podtytule, a realny podtytuł pokazuje', () => {
    render(<DocumentStudioReportView schema={schema} />);
    expect(screen.getAllByText('Podsumowanie zarządcze')).toHaveLength(1);
    expect(screen.getByText('RAG per strumień prac')).toBeInTheDocument();
  });

  it('NIE zmyśla pigułki statusu ani streszczenia, których nie ma w danych', () => {
    render(<DocumentStudioReportView schema={schema} />);
    expect(screen.queryByText(/WYMAGA UWAGI/i)).toBeNull();
  });

  it('mówi wprost, gdy raport nie ma treści', () => {
    render(<DocumentStudioReportView schema={{ ...schema, sections: [] }} />);
    expect(screen.getByText('Ten raport nie ma jeszcze treści.')).toBeInTheDocument();
  });
});
