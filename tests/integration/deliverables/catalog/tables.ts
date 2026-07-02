/**
 * tables — katalog 30 scenariuszy M20 (tabele) jako executable TS.
 * Źródło criteria: docs/qa/deliverables/scenarios/M20_TABLES.md
 */

import type { TableCatalogEntry } from './catalogTypes.js';
import { field, selectField, trafficLightSelect, table } from './builders.js';

const e = (
  id: string,
  tier: any,
  title: string,
  intent: string,
  criteria: any,
  mockPass: any
): TableCatalogEntry => ({
  meta: { id, tier, title, intent, context: {} },
  criteria: { scenarioId: id, ...criteria },
  mockPass,
});

const cfDataBar = (ref: string, color = '#16A34A') => ({ ref, rules: [{ type: 'dataBar', color }] });
const cfColorScale = (ref: string) => ({ ref, rules: [{ type: 'colorScale', colors: ['#DC2626', '#F59E0B', '#16A34A'] }] });
const cfIconSet = (ref: string, iconSet = '3Arrows') => ({ ref, rules: [{ type: 'iconSet', iconSet }] });
const cfCellIs = (ref: string) => ({ ref, rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: ['100000'], style: { bgColor: '#DC2626', bold: true } }] });

export const TABLE_SCENARIOS: TableCatalogEntry[] = [
  // ── Tier 1 — Sml ──────────────────────────────────────────────
  e(
    'M20.S01',
    'Sml',
    'Lista zadań (TODO)',
    'Tabela zadań: nazwa, owner, deadline, status',
    {
      minFields: 3,
      maxFields: 5,
      minRows: 3,
      maxRows: 6,
      requireFieldType: [
        { type: 'singleLineText', min: 1 },
        { type: 'date', min: 1 },
        { type: 'singleSelect', min: 1 },
      ],
      requireSelectLabels: [{ fieldHint: 'status', labels: ['todo', 'in progress', 'done'] }],
      requireSelectColors: true,
      minTypedFields: 2,
    },
    table({
      fields: [
        field('name', 'Nazwa', 'singleLineText'),
        field('owner', 'Owner', 'singleLineText'),
        field('deadline', 'Termin', 'date'),
        trafficLightSelect('status', 'Status', ['To Do', 'In Progress', 'Done']),
      ],
      rowCount: 4,
    })
  ),
  e(
    'M20.S02',
    'Sml',
    'Budżet projektu',
    'Tabela budżetu: kategoria, plan, wykonanie, % realizacji',
    {
      minFields: 4,
      maxFields: 4,
      minRows: 4,
      requireFieldType: [
        { type: 'singleLineText', min: 1 },
        { type: 'currency', min: 2 },
        { type: 'percent', min: 1 },
      ],
      minTypedFields: 3,
    },
    table({
      fields: [
        field('kategoria', 'Kategoria', 'singleLineText'),
        field('plan', 'Plan', 'currency'),
        field('wykonanie', 'Wykonanie', 'currency'),
        field('realizacja', '% realizacji', 'percent'),
      ],
      rowCount: 4,
    })
  ),
  e(
    'M20.S03',
    'Sml',
    'Lista kontaktów (CRM)',
    'Tabela kontaktów: imię, email, telefon, stanowisko, firma',
    {
      minFields: 5,
      maxFields: 5,
      minRows: 5,
      requireFieldType: [
        { type: 'singleLineText', min: 1 },
        { type: 'email', min: 1 },
        { type: 'phone', min: 1 },
      ],
      minTypedFields: 2,
    },
    table({
      fields: [
        field('imie', 'Imię', 'singleLineText'),
        field('email', 'Email', 'email'),
        field('telefon', 'Telefon', 'phone'),
        field('stanowisko', 'Stanowisko', 'singleLineText'),
        field('firma', 'Firma', 'singleLineText'),
      ],
      rowCount: 5,
    })
  ),
  e(
    'M20.S04',
    'Sml',
    'Ocena pracowników (rating)',
    'Tabela ocen: imię, performance (1-5 stars), goal achievement (%)',
    {
      minFields: 3,
      maxFields: 3,
      minRows: 3,
      requireFieldType: [
        { type: 'singleLineText', min: 1 },
        { type: 'rating', min: 1 },
        { type: 'percent', min: 1 },
      ],
      minTypedFields: 2,
    },
    table({
      fields: [
        field('imie', 'Imię', 'singleLineText'),
        field('performance', 'Performance', 'rating'),
        field('goal', 'Goal achievement', 'percent'),
      ],
      rowCount: 3,
    })
  ),
  e(
    'M20.S05',
    'Sml',
    'Tabela ryzyk (severity z kolorami)',
    'Tabela ryzyk ERP: nazwa, severity (Low/Med/High), likelihood, mitygacja',
    {
      minFields: 4,
      maxFields: 4,
      minRows: 5,
      requireSelectLabels: [{ fieldHint: 'severity', labels: ['low', 'med', 'high'] }],
      requireSelectColors: true,
      expectTrafficLightColors: [{ fieldHint: 'severity' }],
    },
    table({
      fields: [
        field('nazwa', 'Nazwa', 'singleLineText'),
        trafficLightSelect('severity', 'Severity', ['Low', 'Med', 'High']),
        field('likelihood', 'Likelihood', 'rating'),
        field('mitygacja', 'Mitygacja', 'singleLineText'),
      ],
      rowCount: 5,
    })
  ),

  // ── Tier 2 — Med ──────────────────────────────────────────────
  e(
    'M20.S06',
    'Med',
    'CRM accounts (10 kolumn)',
    'Tabela CRM: company, contact, email, phone, account_type, MRR, churn_risk, last_contact, notes, owner',
    {
      minFields: 9,
      maxFields: 11,
      minRows: 6,
      requireFieldType: [
        { type: 'email', min: 1 },
        { type: 'phone', min: 1 },
        { type: 'currency', min: 1 },
        { type: 'date', min: 1 },
        { type: 'singleSelect', min: 2 },
      ],
      requireSelectColors: true,
      minTypedFields: 5,
    },
    table({
      fields: [
        field('company', 'Company', 'singleLineText'),
        field('contact', 'Contact', 'singleLineText'),
        field('email', 'Email', 'email'),
        field('phone', 'Phone', 'phone'),
        selectField('account_type', 'Account Type', [
          { label: 'Enterprise', color: '#4338CA' },
          { label: 'Mid', color: '#0D9488' },
          { label: 'SMB', color: '#0891B2' },
        ]),
        field('mrr', 'MRR', 'currency'),
        trafficLightSelect('churn_risk', 'Churn Risk', ['Low', 'Medium', 'High']),
        field('last_contact', 'Last Contact', 'date'),
        field('notes', 'Notes', 'longText'),
        field('owner', 'Owner', 'singleLineText'),
      ],
      rowCount: 6,
    })
  ),
  e(
    'M20.S07',
    'Med',
    'Project portfolio (Airtable-style)',
    'Portfolio 8 projektów: nazwa, owner, status, priority, start, end, budget, progress',
    {
      minFields: 8,
      maxFields: 8,
      minRows: 8,
      requireFieldType: [
        { type: 'singleSelect', min: 2 },
        { type: 'date', min: 2 },
        { type: 'currency', min: 1 },
        { type: 'percent', min: 1 },
      ],
      requireSelectColors: true,
    },
    table({
      fields: [
        field('name', 'Project', 'singleLineText'),
        field('owner', 'Owner', 'singleLineText'),
        trafficLightSelect('status', 'Status', ['To Do', 'In Progress', 'Review', 'Done']),
        selectField('priority', 'Priority', [
          { label: 'P0', color: '#DC2626' },
          { label: 'P1', color: '#F59E0B' },
          { label: 'P2', color: '#2563EB' },
          { label: 'P3', color: '#6B7280' },
        ]),
        field('start', 'Start', 'date'),
        field('end', 'End', 'date'),
        field('budget', 'Budget', 'currency'),
        field('progress', 'Progress', 'percent'),
      ],
      rowCount: 8,
    })
  ),
  e(
    'M20.S08',
    'Med',
    'Sales pipeline',
    'Pipeline: deal, stage (5 stages), value, close_date, owner, probability',
    {
      minFields: 6,
      maxFields: 6,
      minRows: 10,
      requireSelectOptions: [{ fieldHint: 'stage', minOptions: 5 }],
      requireFieldType: [
        { type: 'currency', min: 1 },
        { type: 'percent', min: 1 },
        { type: 'date', min: 1 },
      ],
      requireSelectColors: true,
    },
    table({
      fields: [
        field('deal', 'Deal', 'singleLineText'),
        selectField('stage', 'Stage', [
          { label: 'Discovery', color: '#6B7280' },
          { label: 'Qualification', color: '#0891B2' },
          { label: 'Proposal', color: '#2563EB' },
          { label: 'Negotiation', color: '#D97706' },
          { label: 'Closed', color: '#16A34A' },
        ]),
        field('value', 'Value', 'currency'),
        field('close_date', 'Close Date', 'date'),
        field('owner', 'Owner', 'singleLineText'),
        field('probability', 'Probability', 'percent'),
      ],
      rowCount: 10,
    })
  ),
  e(
    'M20.S09',
    'Med',
    'Inventory (multiSelect)',
    'Inwentaryzacja: SKU, name, categories (multiSelect), stock, price, low_stock, supplier',
    {
      minFields: 7,
      maxFields: 7,
      minRows: 6,
      requireFieldType: [
        { type: 'multiSelect', min: 1 },
        { type: 'number', min: 1 },
        { type: 'currency', min: 1 },
        { type: 'checkbox', min: 1 },
      ],
      requireSelectColors: true,
    },
    table({
      fields: [
        field('sku', 'SKU', 'singleLineText'),
        field('name', 'Name', 'singleLineText'),
        selectField(
          'categories',
          'Categories',
          [
            { label: 'Electronics', color: '#2563EB' },
            { label: 'Tools', color: '#D97706' },
            { label: 'Parts', color: '#16A34A' },
          ],
          true
        ),
        field('stock', 'Stock', 'number'),
        field('price', 'Price', 'currency'),
        field('low_stock', 'Low Stock', 'checkbox'),
        field('supplier', 'Supplier', 'singleLineText'),
      ],
      rowCount: 6,
    })
  ),
  e(
    'M20.S10',
    'Med',
    'Recruitment funnel',
    'Funnel: candidate, position, source, stage (6 etapów), applied_date, last_action, owner',
    {
      minFields: 7,
      maxFields: 7,
      minRows: 8,
      requireSelectOptions: [{ fieldHint: 'stage', minOptions: 6 }],
      requireFieldType: [{ type: 'date', min: 1 }],
      requireSelectColors: true,
    },
    table({
      fields: [
        field('candidate', 'Candidate', 'singleLineText'),
        field('position', 'Position', 'singleLineText'),
        field('source', 'Source', 'singleLineText'),
        selectField('stage', 'Stage', [
          { label: 'Applied', color: '#6B7280' },
          { label: 'Screened', color: '#0891B2' },
          { label: 'Interviewed', color: '#2563EB' },
          { label: 'Offered', color: '#D97706' },
          { label: 'Hired', color: '#16A34A' },
          { label: 'Rejected', color: '#DC2626' },
        ]),
        field('applied_date', 'Applied', 'date'),
        field('last_action', 'Last Action', 'date'),
        field('owner', 'Owner', 'singleLineText'),
      ],
      rowCount: 8,
    })
  ),
  e(
    'M20.S11',
    'Med',
    'KPI tracker monthly',
    'Tabela 6 KPI: KPI, owner, target, actual, variance, status (above/on/below)',
    {
      minFields: 6,
      maxFields: 6,
      minRows: 6,
      requireFieldType: [
        { type: 'number', min: 1 },
        { type: 'percent', min: 1 },
        { type: 'singleSelect', min: 1 },
      ],
      requireSelectColors: true,
    },
    table({
      fields: [
        field('kpi', 'KPI', 'singleLineText'),
        field('owner', 'Owner', 'singleLineText'),
        field('target', 'Target', 'number'),
        field('actual', 'Actual', 'number'),
        field('variance', 'Variance', 'percent'),
        selectField('status', 'Status', [
          { label: 'Above', color: '#16A34A' },
          { label: 'On', color: '#2563EB' },
          { label: 'Below', color: '#DC2626' },
        ]),
      ],
      rowCount: 6,
    })
  ),
  e(
    'M20.S12',
    'Med',
    'Compliance checklist',
    'Lista RODO: 8 wymogów, status (compliant/partial/non), evidence_url, owner, deadline, last_review',
    {
      minFields: 6,
      maxFields: 8,
      minRows: 8,
      requireFieldType: [
        { type: 'url', min: 1 },
        { type: 'date', min: 2 },
        { type: 'singleSelect', min: 1 },
      ],
      requireSelectColors: true,
      expectTrafficLightColors: [{ fieldHint: 'status' }],
    },
    table({
      fields: [
        field('wymog', 'Wymóg', 'singleLineText'),
        trafficLightSelect('status', 'Status', ['Compliant', 'Partial', 'Non-compliant']),
        field('evidence_url', 'Evidence', 'url'),
        field('owner', 'Owner', 'singleLineText'),
        field('deadline', 'Deadline', 'date'),
        field('last_review', 'Last Review', 'date'),
      ],
      rowCount: 8,
    })
  ),
  e(
    'M20.S13',
    'Med',
    'Vendor scorecard',
    'Karta 5 dostawców × 5 kryteriów (rating 1-5), total, recommendation',
    {
      minFields: 7,
      maxFields: 8,
      minRows: 5,
      requireFieldType: [
        { type: 'rating', min: 5 },
        { type: 'number', min: 1 },
        { type: 'singleSelect', min: 1 },
      ],
      requireSelectColors: true,
    },
    table({
      fields: [
        field('vendor', 'Vendor', 'singleLineText'),
        field('c1', 'Cena', 'rating'),
        field('c2', 'Jakość', 'rating'),
        field('c3', 'Wsparcie', 'rating'),
        field('c4', 'Integracja', 'rating'),
        field('c5', 'Roadmapa', 'rating'),
        field('total', 'Total', 'number'),
        selectField('recommendation', 'Recommendation', [
          { label: 'Recommend', color: '#16A34A' },
          { label: 'Conditional', color: '#D97706' },
          { label: 'Reject', color: '#DC2626' },
        ]),
      ],
      rowCount: 5,
    })
  ),
  e(
    'M20.S14',
    'Med',
    'Event registration',
    'Lista uczestników: name, email, ticket_type, payment_status, dietary (multiSelect), notes',
    {
      minFields: 6,
      maxFields: 6,
      minRows: 10,
      requireFieldType: [
        { type: 'email', min: 1 },
        { type: 'singleSelect', min: 2 },
        { type: 'multiSelect', min: 1 },
      ],
      requireSelectColors: true,
    },
    table({
      fields: [
        field('name', 'Name', 'singleLineText'),
        field('email', 'Email', 'email'),
        selectField('ticket_type', 'Ticket', [
          { label: 'Standard', color: '#2563EB' },
          { label: 'VIP', color: '#D97706' },
        ]),
        selectField('payment_status', 'Payment', [
          { label: 'Paid', color: '#16A34A' },
          { label: 'Pending', color: '#D97706' },
          { label: 'Refunded', color: '#6B7280' },
        ]),
        selectField(
          'dietary',
          'Dietary',
          [
            { label: 'Vege', color: '#16A34A' },
            { label: 'Vegan', color: '#15803D' },
            { label: 'Gluten-free', color: '#D97706' },
          ],
          true
        ),
        field('notes', 'Notes', 'longText'),
      ],
      rowCount: 10,
    })
  ),
  e(
    'M20.S15',
    'Med',
    'Help desk tickets',
    'Zgłoszenia: ticket_id, subject, priority (P1-P4), status, assignee, created, resolved',
    {
      minFields: 6,
      maxFields: 8,
      minRows: 8,
      requireFieldType: [
        { type: 'singleSelect', min: 2 },
        { type: 'date', min: 1 },
      ],
      requireSelectColors: true,
    },
    table({
      fields: [
        field('ticket_id', 'Ticket', 'singleLineText'),
        field('subject', 'Subject', 'singleLineText'),
        selectField('priority', 'Priority', [
          { label: 'P1', color: '#DC2626' },
          { label: 'P2', color: '#D97706' },
          { label: 'P3', color: '#2563EB' },
          { label: 'P4', color: '#6B7280' },
        ]),
        trafficLightSelect('status', 'Status', ['Open', 'In Progress', 'Closed']),
        field('assignee', 'Assignee', 'singleLineText'),
        field('created', 'Created', 'date'),
      ],
      rowCount: 8,
    })
  ),

  // ── Tier 3 — Lrg (z CF) ───────────────────────────────────────
  e(
    'M20.S16',
    'Lrg',
    'Project portfolio z CF dataBar',
    'Portfolio 12 projektów z CF: progress jako dataBar, variance jako colorScale',
    {
      minFields: 10,
      maxFields: 12,
      minRows: 12,
      requireFieldType: [
        { type: 'currency', min: 2 },
        { type: 'percent', min: 1 },
        { type: 'singleSelect', min: 2 },
        { type: 'date', min: 2 },
      ],
      requireSelectColors: true,
      requireCfRule: [
        { type: 'dataBar', min: 1 },
        { type: 'colorScale', min: 1 },
      ],
    },
    table({
      fields: [
        field('name', 'Project', 'singleLineText'),
        field('owner', 'Owner', 'singleLineText'),
        trafficLightSelect('status', 'Status', ['On Track', 'At Risk', 'Off Track']),
        selectField('phase', 'Phase', [
          { label: 'Init', color: '#6B7280' },
          { label: 'Exec', color: '#2563EB' },
          { label: 'Close', color: '#16A34A' },
        ]),
        field('plan', 'Plan', 'currency'),
        field('actual', 'Actual', 'currency'),
        field('variance', 'Variance', 'percent'),
        field('progress', 'Progress', 'percent'),
        field('start', 'Start', 'date'),
        field('end', 'End', 'date'),
      ],
      rowCount: 12,
      cf: [cfDataBar('H2:H13'), cfColorScale('G2:G13')],
    })
  ),
  e(
    'M20.S17',
    'Lrg',
    'Risk register z iconSet',
    'Rejestr 8 ryzyk: severity (4 opcje), likelihood (rating iconSet), impact (rating colorScale)',
    {
      minFields: 5,
      maxFields: 6,
      minRows: 8,
      requireFieldType: [
        { type: 'singleSelect', min: 1 },
        { type: 'rating', min: 2 },
      ],
      requireSelectLabels: [{ fieldHint: 'severity', labels: ['critical', 'high', 'medium', 'low'] }],
      requireSelectColors: true,
      requireCfRule: [
        { type: 'iconSet', min: 1 },
        { type: 'colorScale', min: 1 },
      ],
      expectTrafficLightColors: [{ fieldHint: 'severity' }],
    },
    table({
      fields: [
        field('risk', 'Ryzyko', 'singleLineText'),
        trafficLightSelect('severity', 'Severity', ['Critical', 'High', 'Medium', 'Low']),
        field('likelihood', 'Likelihood', 'rating'),
        field('impact', 'Impact', 'rating'),
        field('owner', 'Owner', 'singleLineText'),
      ],
      rowCount: 8,
      cf: [cfIconSet('C2:C9', '3Arrows'), cfColorScale('D2:D9')],
    })
  ),
  e(
    'M20.S18',
    'Lrg',
    'Sales pipeline z cellIs',
    'Pipeline 15 deals: value highlight >100k z bold red',
    {
      minFields: 4,
      maxFields: 6,
      minRows: 15,
      requireFieldType: [{ type: 'currency', min: 1 }],
      requireCfRule: [{ type: 'cellIs', min: 1 }],
    },
    table({
      fields: [
        field('deal', 'Deal', 'singleLineText'),
        field('value', 'Value', 'currency'),
        field('owner', 'Owner', 'singleLineText'),
        field('close', 'Close', 'date'),
      ],
      rowCount: 15,
      cf: [cfCellIs('B2:B16')],
    })
  ),
  e(
    'M20.S19',
    'Lrg',
    'Multi-criteria scoring',
    'Macierz 6 dostawców × 8 kryteriów (rating), total z formułą SUM, ranking z color scale',
    {
      minFields: 9,
      maxFields: 11,
      minRows: 6,
      requireFieldType: [{ type: 'rating', min: 8 }, { type: 'number', min: 1 }],
      requireFormulas: true,
      requireCfRule: [{ type: 'colorScale', min: 1 }],
    },
    {
      fields: [
        field('vendor', 'Vendor', 'singleLineText'),
        ...Array.from({ length: 8 }, (_, i) => field(`c${i + 1}`, `Kryterium ${i + 1}`, 'rating')),
        field('total', 'Total', 'number'),
      ],
      seedRows: Array.from({ length: 6 }, (_, i) => {
        const row: Record<string, unknown> = { vendor: `V${i}`, total: '=SUM(B2:I2)' };
        for (let c = 1; c <= 8; c++) row[`c${c}`] = (c % 5) + 1;
        return row;
      }),
      hasFormulas: true,
      conditionalFormatting: [cfColorScale('J2:J7')],
    }
  ),
  e(
    'M20.S20',
    'Lrg',
    'Employee performance review',
    'Tabela 10 prac × 6 wymiarów + total + bonus_pct + bonus_amount (formuła)',
    {
      minFields: 9,
      maxFields: 11,
      minRows: 10,
      requireFieldType: [{ type: 'rating', min: 6 }, { type: 'percent', min: 1 }, { type: 'currency', min: 1 }],
      requireFormulas: true,
      requireCfRule: [{ type: 'colorScale', min: 1 }],
    },
    {
      fields: [
        field('emp', 'Pracownik', 'singleLineText'),
        ...Array.from({ length: 6 }, (_, i) => field(`d${i + 1}`, `Wymiar ${i + 1}`, 'rating')),
        field('salary', 'Salary', 'number'),
        field('bonus_pct', 'Bonus %', 'percent'),
        field('bonus_amount', 'Bonus', 'currency'),
      ],
      seedRows: Array.from({ length: 10 }, (_, i) => {
        const row: Record<string, unknown> = {
          emp: `E${i}`,
          salary: 10000,
          bonus_pct: 0.1,
          bonus_amount: '=H2*I2',
        };
        for (let c = 1; c <= 6; c++) row[`d${c}`] = (c % 5) + 1;
        return row;
      }),
      hasFormulas: true,
      conditionalFormatting: [cfColorScale('B2:G11')],
    }
  ),
  e(
    'M20.S21',
    'Lrg',
    'Time tracking weekly',
    'Time tracking 8 osób × 5 dni + weekly total (formuła) + utilization % (formuła)',
    {
      minFields: 7,
      maxFields: 8,
      minRows: 8,
      requireFieldType: [{ type: 'number', min: 5 }],
      requireFormulas: true,
      requireCfRule: [{ type: 'colorScale', min: 1 }],
    },
    {
      fields: [
        field('person', 'Osoba', 'singleLineText'),
        ...Array.from({ length: 5 }, (_, i) => field(`d${i + 1}`, `Dzień ${i + 1}`, 'number')),
        field('total', 'Total', 'number'),
        field('utilization', 'Utilization', 'percent'),
      ],
      seedRows: Array.from({ length: 8 }, (_, i) => {
        const row: Record<string, unknown> = { person: `P${i}`, total: '=SUM(B2:F2)', utilization: '=G2/40' };
        for (let c = 1; c <= 5; c++) row[`d${c}`] = 8;
        return row;
      }),
      hasFormulas: true,
      conditionalFormatting: [cfColorScale('H2:H9')],
    }
  ),
  e(
    'M20.S22',
    'Lrg',
    'Customer LTV cohort heatmap',
    'Cohort: 6 kohort × 12 miesięcy retention (percent), heatmap colorScale',
    {
      minFields: 13,
      maxFields: 13,
      minRows: 6,
      requireFieldType: [{ type: 'percent', min: 12 }],
      requireCfRule: [{ type: 'colorScale', min: 1 }],
    },
    table({
      fields: [
        field('cohort', 'Cohort', 'singleLineText'),
        ...Array.from({ length: 12 }, (_, i) => field(`m${i + 1}`, `M${i + 1}`, 'percent')),
      ],
      rowCount: 6,
      cf: [cfColorScale('B2:M7')],
    })
  ),
  e(
    'M20.S23',
    'Lrg',
    'OKR tracker',
    'OKR Q3: 4 Obiektywy + 12 KR, progress %, owner, status (on track/at risk/off track)',
    {
      minFields: 4,
      maxFields: 6,
      minRows: 12,
      requireFieldType: [{ type: 'percent', min: 1 }, { type: 'singleSelect', min: 1 }],
      requireSelectColors: true,
      requireCfRule: [{ type: 'dataBar', min: 1 }],
      expectTrafficLightColors: [{ fieldHint: 'status' }],
    },
    table({
      fields: [
        field('kr', 'Key Result', 'singleLineText'),
        field('owner', 'Owner', 'singleLineText'),
        field('progress', 'Progress', 'percent'),
        trafficLightSelect('status', 'Status', ['On Track', 'At Risk', 'Off Track']),
      ],
      rowCount: 12,
      cf: [cfDataBar('C2:C13')],
    })
  ),
  e(
    'M20.S24',
    'Lrg',
    'Marketing campaign performance',
    '10 kampanii × 8 metryk, CF wyróżnia top performers',
    {
      minFields: 9,
      maxFields: 9,
      minRows: 10,
      requireFieldType: [{ type: 'number', min: 2 }, { type: 'percent', min: 2 }, { type: 'currency', min: 1 }],
      requireCfRule: [{ type: 'colorScale', min: 2 }, { type: 'dataBar', min: 1 }],
    },
    table({
      fields: [
        field('campaign', 'Campaign', 'singleLineText'),
        field('impressions', 'Impressions', 'number'),
        field('clicks', 'Clicks', 'number'),
        field('ctr', 'CTR', 'percent'),
        field('conversions', 'Conversions', 'number'),
        field('cr', 'CR', 'percent'),
        field('cpa', 'CPA', 'currency'),
        field('spend', 'Spend', 'currency'),
        field('roas', 'ROAS', 'number'),
      ],
      rowCount: 10,
      cf: [cfColorScale('D2:D11'), cfColorScale('F2:F11'), cfDataBar('I2:I11')],
    })
  ),
  e(
    'M20.S25',
    'Lrg',
    'Operations dashboard table',
    'Dashboard: 6 procesów × KPIs (SLA, time, error, satisfaction), heatmap + status icons',
    {
      minFields: 5,
      maxFields: 6,
      minRows: 6,
      requireFieldType: [{ type: 'percent', min: 1 }, { type: 'number', min: 1 }, { type: 'singleSelect', min: 1 }],
      requireSelectColors: true,
      requireCfRule: [{ type: 'colorScale', min: 1 }, { type: 'iconSet', min: 1 }],
    },
    table({
      fields: [
        field('process', 'Process', 'singleLineText'),
        field('sla', 'SLA met %', 'percent'),
        field('avg_time', 'Avg Time', 'number'),
        field('error_rate', 'Error Rate', 'percent'),
        trafficLightSelect('status', 'Status', ['Good', 'Warn', 'Bad']),
      ],
      rowCount: 6,
      cf: [cfColorScale('B2:B7'), cfIconSet('E2:E7', '3TrafficLights1')],
    })
  ),

  // ── Tier 4 — Xtr ──────────────────────────────────────────────
  e(
    'M20.S26',
    'Xtr',
    'Annual budget workbook 4 sheety',
    'Roczny budżet: Summary, OpEx, CapEx, HC; cross-sheet formulas',
    {
      minFields: 3,
      maxFields: 6,
      minRows: 6,
      requireFieldType: [{ type: 'currency', min: 1 }],
      requireFormulas: true,
      requireMultiSheet: { minSheets: 4 },
    },
    (() => {
      const opexSheet = table({
        fields: [field('cat', 'Kategoria', 'singleLineText'), field('amount', 'Amount', 'currency')],
        rowCount: 6,
      });
      const capexSheet = table({
        fields: [field('cat', 'Kategoria', 'singleLineText'), field('amount', 'Amount', 'currency')],
        rowCount: 6,
      });
      const hcSheet = table({
        fields: [field('role', 'Rola', 'singleLineText'), field('cost', 'Koszt', 'currency')],
        rowCount: 6,
      });
      const summary = {
        fields: [
          field('line', 'Pozycja', 'singleLineText'),
          field('total', 'Total', 'currency'),
          field('share', 'Udział', 'percent'),
        ],
        seedRows: [
          { line: 'OpEx', total: '=OpEx!B10', share: 0.4 },
          { line: 'CapEx', total: '=CapEx!B10', share: 0.3 },
          { line: 'HC', total: '=HC!B10', share: 0.3 },
          { line: 'Suma', total: '=B2+B3+B4', share: 1 },
          { line: 'x', total: 0, share: 0 },
          { line: 'y', total: 0, share: 0 },
        ],
        hasFormulas: true,
      };
      return {
        ...summary,
        sheets: [summary as any, opexSheet, capexSheet, hcSheet],
      };
    })()
  ),
  e(
    'M20.S27',
    'Xtr',
    'Financial model 12-month',
    'Model 12 miesięcy: revenue, COGS, gross margin (formuła), OpEx, EBITDA (formuła), Cash (rolling formuła)',
    {
      minFields: 6,
      maxFields: 14,
      minRows: 6,
      requireFieldType: [{ type: 'currency', min: 1 }],
      requireFormulas: true,
      requireCfRule: [{ type: 'colorScale', min: 1 }],
    },
    {
      fields: [
        field('metric', 'Metric', 'singleLineText'),
        ...Array.from({ length: 12 }, (_, i) => field(`m${i + 1}`, `M${i + 1}`, 'currency')),
      ],
      seedRows: [
        { metric: 'Revenue', m1: 100000 },
        { metric: 'COGS', m1: 40000 },
        { metric: 'Gross Margin', m1: '=B1-B2' },
        { metric: 'OpEx', m1: 30000 },
        { metric: 'EBITDA', m1: '=B3-B4' },
        { metric: 'Cash', m1: '=B5' },
      ],
      hasFormulas: true,
      conditionalFormatting: [cfColorScale('B6:M6')],
    }
  ),
  e(
    'M20.S28',
    'Xtr',
    'Constraint: 0× singleLineText',
    'Tabela 15 kolumn BEZ singleLineText — każda kolumna typowana',
    {
      minFields: 15,
      maxFields: 15,
      minRows: 3,
      forbidFieldType: ['singleLineText'],
      minDistinctFieldTypes: 7,
    },
    table({
      fields: [
        field('f1', 'Liczba', 'number'),
        field('f2', 'Kwota', 'currency'),
        field('f3', 'Procent', 'percent'),
        field('f4', 'Data', 'date'),
        field('f5', 'Checkbox', 'checkbox'),
        field('f6', 'Rating', 'rating'),
        field('f7', 'Email', 'email'),
        field('f8', 'URL', 'url'),
        field('f9', 'Phone', 'phone'),
        selectField('f10', 'Select', [{ label: 'A', color: '#16A34A' }, { label: 'B', color: '#DC2626' }]),
        selectField('f11', 'Multi', [{ label: 'X', color: '#2563EB' }, { label: 'Y', color: '#D97706' }], true),
        field('f12', 'Long', 'longText'),
        field('f13', 'Liczba2', 'number'),
        field('f14', 'Data2', 'date'),
        field('f15', 'Kwota2', 'currency'),
      ],
      rowCount: 3,
    })
  ),
  e(
    'M20.S29',
    'Xtr',
    'Adversarial: ambiguous data type',
    "Tabela z kolumną 'kwota' (PLN → currency)",
    {
      minFields: 2,
      maxFields: 4,
      minRows: 3,
      requireFieldType: [{ type: 'currency', min: 1 }],
    },
    table({
      fields: [
        field('pozycja', 'Pozycja', 'singleLineText'),
        field('kwota', 'Kwota (PLN)', 'currency'),
      ],
      rowCount: 3,
    })
  ),
  e(
    'M20.S30',
    'Xtr',
    'Complex multi-dim (cohort×product×region)',
    '5 produktów × 4 regionów × 6 miesięcy + summary rows/cols z formułami',
    {
      minFields: 7,
      maxFields: 9,
      minRows: 6,
      requireFieldType: [{ type: 'number', min: 4 }],
      requireFormulas: true,
      requireCfRule: [{ type: 'colorScale', min: 1 }],
    },
    {
      fields: [
        field('dim', 'Produkt/Region', 'singleLineText'),
        ...Array.from({ length: 6 }, (_, i) => field(`m${i + 1}`, `M${i + 1}`, 'number')),
        field('total', 'Total', 'number'),
      ],
      seedRows: Array.from({ length: 6 }, (_, i) => {
        const row: Record<string, unknown> = { dim: `P${i}`, total: '=SUM(B2:G2)' };
        for (let c = 1; c <= 6; c++) row[`m${c}`] = (i + 1) * c * 10;
        return row;
      }),
      hasFormulas: true,
      conditionalFormatting: [cfColorScale('B2:G7')],
    }
  ),
];
