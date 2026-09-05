/**
 * ROI (P7K C) — poziom 1: kolumny i podgląd TABELI ANALIZ.
 *
 * Wzorzec zaakceptowany przez właściciela: `evidence/p7k-wyniki/prototype/roi-l1--light.png`
 * (prototyp `dev-render/screens/p7k-wyniki-prototype.tsx`, widok `roi-l1`).
 * Kolejność kolumn i to, co jest schowane w pstryczku, są WERDYKTEM K4
 * (`docs/program/PROGRAM_NAPRAWCZY_20260905/P7K_KROK1_WERDYKT_20260905.md`):
 *   „Domyślne kolumny: NAZWA · PRZEDMIOT · WARIANT · CAPEX · ROCZNA KORZYŚĆ ·
 *    ROI · PAYBACK · REKOMENDACJA · FAZA; NPV i IRR w pstryczku kolumn
 *    (domyślnie schowane)." — stąd `defaultVisible: false` na dwóch ostatnich.
 *
 * K11/K12 (nakładanie tekstu): komórki TEKSTOWE zawijają do dwóch linii
 * (`line-clamp-2`) z pełną treścią w `title`; komórki LICZBOWE nigdy się nie
 * łamią (`whitespace-nowrap tabular-nums`). K4: dziewięć kolumn mieści się
 * na 1440 bez ucięcia.
 *
 * Czyste funkcje — ten sam kod rysuje ekran żywy i harness dev-render.
 */
import React from 'react';

import type { ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import type { StandardPreviewProps, TableColumn } from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives';

import type { RoiRegistryRow } from './roiCardApi';
import {
  BRAK,
  fmtDate,
  fmtMoney,
  fmtPercent,
  fmtRoiWithHorizon,
  fmtYears,
  phaseLabel,
  RECOMMENDATION_LABEL,
  roiHorizonLabel,
  variantLabel,
} from './roiCardFormat';

/** Rozwiązanie identyfikatora na NAZWISKO — nigdy nie pokazujemy UUID-a. */
export type RoiMemberNameResolver = (userId: string) => string | null;

const TextCell: React.FC<{ value: string | null; strong?: boolean }> = ({ value, strong }) => (
  <span
    className={`block overflow-hidden text-sm ${strong ? 'font-medium text-c-text' : 'text-c-text-secondary'}`}
    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
    title={value ?? undefined}
  >
    {value && value.trim() ? value : BRAK}
  </span>
);

const NumCell: React.FC<{ value: string }> = ({ value }) => (
  <span className="block whitespace-nowrap text-sm tabular-nums text-c-text-secondary">{value}</span>
);

export function buildRoiRegistryColumns(isPolish: boolean): TableColumn[] {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  return [
    {
      id: 'title',
      label: t('Nazwa', 'Name'),
      width: '190px',
      sortable: true,
      sortAccessor: (row: RoiRegistryRow) => row.title,
      render: (row: RoiRegistryRow) => <TextCell value={row.title} strong />,
    },
    {
      id: 'subjectType',
      label: t('Przedmiot', 'Subject'),
      width: '110px',
      filterable: true,
      render: (row: RoiRegistryRow) => <TextCell value={row.subjectType} />,
    },
    {
      id: 'variant',
      label: t('Wariant', 'Option'),
      width: '150px',
      render: (row: RoiRegistryRow) => (
        <TextCell value={variantLabel(row.optionVariant, row.optionVariantLabel)} />
      ),
    },
    {
      id: 'capex',
      label: 'CAPEX',
      width: '120px',
      align: 'right',
      sortable: true,
      sortAccessor: (row: RoiRegistryRow) => row.capex ?? Number.NEGATIVE_INFINITY,
      render: (row: RoiRegistryRow) => <NumCell value={fmtMoney(row.capex, row.currency, isPolish)} />,
    },
    {
      id: 'annualNetBenefit',
      label: t('Roczna korzyść', 'Annual benefit'),
      width: '130px',
      align: 'right',
      sortable: true,
      sortAccessor: (row: RoiRegistryRow) => row.annualNetBenefit ?? Number.NEGATIVE_INFINITY,
      render: (row: RoiRegistryRow) => (
        <NumCell value={fmtMoney(row.annualNetBenefit, row.currency, isPolish)} />
      ),
    },
    {
      id: 'roi',
      // Nagłówek bez horyzontu (horyzont bywa różny w różnych wierszach),
      // horyzont jest przy KAŻDEJ liczbie: „ROI 5Y 100 %" (metodyka §17).
      label: 'ROI',
      width: '115px',
      align: 'right',
      sortable: true,
      sortAccessor: (row: RoiRegistryRow) => row.roiPct ?? Number.NEGATIVE_INFINITY,
      render: (row: RoiRegistryRow) => (
        <NumCell value={fmtRoiWithHorizon(row.roiPct, row.horizonYears, isPolish)} />
      ),
    },
    {
      id: 'payback',
      label: 'Payback',
      width: '95px',
      align: 'right',
      sortable: true,
      sortAccessor: (row: RoiRegistryRow) => row.paybackYears ?? Number.POSITIVE_INFINITY,
      render: (row: RoiRegistryRow) => <NumCell value={fmtYears(row.paybackYears, isPolish)} />,
    },
    {
      id: 'recommendation',
      label: t('Rekomendacja', 'Recommendation'),
      width: '155px',
      filterable: true,
      render: (row: RoiRegistryRow) =>
        row.recommendation ? (
          // Pigułka NEUTRALNA (werdykt K1/K4: stany aktywne i decyzje bez
          // crimsonu — czerwień zostaje wyłącznie dla przekroczeń).
          // `hideDot`: kropka nic tu nie znaczy (pigułka jest neutralna
          // z definicji), a zabiera ~14 px, przez które „CONDITIONAL GO"
          // nie mieściło się w jednej linii na 1440 (defekt klasy K5).
          <StatusChip
            label={RECOMMENDATION_LABEL[row.recommendation]}
            tone="neutral"
            hideDot
            title={row.recommendationCondition ?? undefined}
          />
        ) : (
          <span className="text-sm text-c-text-muted">{BRAK}</span>
        ),
    },
    {
      id: 'phase',
      label: t('Faza', 'Phase'),
      width: '105px',
      filterable: true,
      render: (row: RoiRegistryRow) => (
        <span className="block whitespace-nowrap text-sm text-c-text-secondary">
          {phaseLabel(row.phase, isPolish)}
        </span>
      ),
    },
    {
      id: 'npv',
      label: 'NPV',
      width: '130px',
      align: 'right',
      // K4: NPV i IRR istnieją w pstryczku kolumn, ale NIE w domyślnym widoku.
      defaultVisible: false,
      render: (row: RoiRegistryRow) => <NumCell value={fmtMoney(row.npv, row.currency, isPolish)} />,
    },
    {
      id: 'irr',
      label: 'IRR',
      width: '100px',
      align: 'right',
      defaultVisible: false,
      render: (row: RoiRegistryRow) => <NumCell value={fmtPercent(row.irrPct, isPolish)} />,
    },
  ];
}

/**
 * Podgląd wiersza = Executive Summary analizy (metodyka §42 I) jako tabela
 * Właściwość/Wartość + jedno wyjście „Otwórz analizę".
 */
export function buildRoiRegistryPreview(
  row: RoiRegistryRow,
  isPolish: boolean,
  resolveMemberName: RoiMemberNameResolver,
  onOpen: () => void,
  onClose?: () => void
): StandardPreviewProps {
  const t = (pl: string, en: string) => (isPolish ? pl : en);
  const properties: ArtifactPropertyRow[] = [
    { id: 'subject', label: t('Przedmiot', 'Subject'), value: row.subjectType ?? BRAK },
    { id: 'variant', label: t('Wariant', 'Option'), value: variantLabel(row.optionVariant, row.optionVariantLabel) },
    {
      id: 'horizon',
      label: t('Horyzont', 'Horizon'),
      value: row.horizonYears ? `${row.horizonYears} ${t('lat', 'yrs')}` : BRAK,
    },
    { id: 'capex', label: 'CAPEX', value: fmtMoney(row.capex, row.currency, isPolish) },
    {
      id: 'annualBenefit',
      label: t('Roczna korzyść netto', 'Annual net benefit'),
      value: fmtMoney(row.annualNetBenefit, row.currency, isPolish),
    },
    { id: 'roi', label: roiHorizonLabel(row.horizonYears), value: fmtPercent(row.roiPct, isPolish, 0) },
    { id: 'payback', label: 'Payback', value: fmtYears(row.paybackYears, isPolish) },
    { id: 'npv', label: 'NPV', value: fmtMoney(row.npv, row.currency, isPolish) },
    { id: 'irr', label: 'IRR', value: fmtPercent(row.irrPct, isPolish) },
    {
      id: 'recommendation',
      label: t('Rekomendacja', 'Recommendation'),
      value: row.recommendation ? RECOMMENDATION_LABEL[row.recommendation] : BRAK,
    },
    { id: 'phase', label: t('Faza', 'Phase'), value: phaseLabel(row.phase, isPolish) },
    {
      id: 'owner',
      label: t('Właściciel', 'Owner'),
      value: resolveMemberName(row.ownerUserId) ?? BRAK,
    },
    { id: 'updated', label: t('Aktualizacja', 'Updated'), value: fmtDate(row.updatedAt, isPolish) },
  ];

  return {
    title: row.title,
    onClose,
    onOpenFull: onOpen,
    openLabel: t('Otwórz analizę', 'Open analysis'),
    meta: {
      pills: [
        { label: t('Faza', 'Phase'), value: phaseLabel(row.phase, isPolish), tone: 'neutral' },
        ...(row.recommendation
          ? [
              {
                label: t('Rekomendacja', 'Recommendation'),
                value: RECOMMENDATION_LABEL[row.recommendation],
                tone: 'neutral' as const,
              },
            ]
          : []),
      ],
    },
    details: {
      label: t('Executive Summary', 'Executive Summary'),
      properties,
      propertyLabel: t('Właściwość', 'Property'),
      // Warunek rekomendacji to jedyna PROZA w podglądzie — bez niego
      // „CONDITIONAL GO" byłoby werdyktem bez warunku, czyli nieczytelnym.
      text: row.recommendationCondition ?? undefined,
    },
  };
}
