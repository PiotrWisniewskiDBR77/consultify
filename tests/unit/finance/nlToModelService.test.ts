import { describe, expect, it } from 'vitest';

import {
  buildDriverTreeFromSpec,
  parseModelSpec,
  specToAssumptions,
} from '../../../server/src/services/nlToModelService';

describe('nlToModelService.parseModelSpec', () => {
  it('extracts customers / ARPU / churn / currency from a SaaS description', () => {
    const spec = parseModelSpec('SaaS: 200 klientów, 5% churn miesięcznie, ARPU 500 PLN');

    const byName = Object.fromEntries(spec.drivers.map((d) => [d.name, d]));

    expect(byName.customers?.value).toBe(200);
    expect(byName.arpu?.value).toBe(500);
    expect(byName.churnPct?.value).toBe(5);
    expect(byName.churnPct?.unit).toBe('%');

    expect(spec.detected.businessType).toBe('SaaS');
    expect(spec.detected.currency).toBe('PLN');
  });

  it('detects CAC and a multi-year horizon normalised to months', () => {
    const spec = parseModelSpec(
      'Model SaaS na 3 lata: 1000 klientów, ARPU 120 USD, CAC 2000, churn 4%'
    );
    const byName = Object.fromEntries(spec.drivers.map((d) => [d.name, d]));

    expect(byName.cac?.value).toBe(2000);
    expect(byName.customers?.value).toBe(1000);
    expect(byName.churnPct?.value).toBe(4);
    expect(spec.detected.currency).toBe('USD');
    expect(spec.detected.horizon).toBe(36);
  });

  it('parses human numbers with separators and magnitude suffix', () => {
    const spec = parseModelSpec('1 200 klientów, ARPU 1.5k EUR, MRR 50000');
    const byName = Object.fromEntries(spec.drivers.map((d) => [d.name, d]));

    expect(byName.customers?.value).toBe(1200);
    expect(byName.arpu?.value).toBe(1500);
    expect(byName.mrr?.value).toBe(50000);
    expect(spec.detected.currency).toBe('EUR');
  });

  it('recognises an ecommerce business type', () => {
    const spec = parseModelSpec('Sklep e-commerce: 500 zamówień, AOV 250 PLN');
    expect(spec.detected.businessType).toBe('ecommerce');
    const byName = Object.fromEntries(spec.drivers.map((d) => [d.name, d]));
    expect(byName.orders?.value).toBe(500);
    expect(byName.aov?.value).toBe(250);
  });

  it('returns an empty spec for non-numeric text', () => {
    const spec = parseModelSpec('Chcę zbudować jakiś model finansowy.');
    expect(spec.drivers).toEqual([]);
    expect(spec.detected.businessType).toBeUndefined();
  });
});

describe('nlToModelService.buildDriverTreeFromSpec', () => {
  it('builds a revenue tree with customers × ARPU leaves for SaaS', () => {
    const spec = parseModelSpec('SaaS: 200 klientów, 5% churn miesięcznie, ARPU 500 PLN');
    const tree = buildDriverTreeFromSpec(spec);

    expect(tree.nodes.length).toBeGreaterThan(0);

    const byId = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));

    expect(byId.customers?.kind).toBe('input');
    expect(byId.arpu?.kind).toBe('input');

    const revenue = byId.revenue;
    expect(revenue).toBeDefined();
    expect(revenue.kind).toBe('derived');
    expect(revenue.children).toEqual(expect.arrayContaining(['customers', 'arpu']));
    // 200 customers × ARPU 500 = 100000
    expect(revenue.value).toBe(100000);

    // Churn carried as a standalone input node.
    expect(byId.churnPct?.kind).toBe('input');
  });

  it('builds an orders × AOV revenue tree for ecommerce', () => {
    const spec = parseModelSpec('Sklep e-commerce: 500 zamówień, AOV 250 PLN');
    const tree = buildDriverTreeFromSpec(spec);
    const byId = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));

    expect(byId.revenue?.children).toEqual(expect.arrayContaining(['orders', 'aov']));
    expect(byId.revenue?.value).toBe(125000);
  });

  it('still emits a revenue node when drivers are incomplete', () => {
    const spec = parseModelSpec('200 klientów');
    const tree = buildDriverTreeFromSpec(spec);
    const revenue = tree.nodes.find((n) => n.id === 'revenue');
    expect(revenue).toBeDefined();
    expect(revenue?.value).toBeUndefined();
  });
});

describe('nlToModelService.specToAssumptions', () => {
  it('maps drivers and horizon into a flat numeric record', () => {
    const spec = parseModelSpec(
      'SaaS na 2 lata: 200 klientów, 5% churn, ARPU 500 PLN, CAC 2000'
    );
    const assumptions = specToAssumptions(spec);

    expect(assumptions.customers).toBe(200);
    expect(assumptions.arpu).toBe(500);
    expect(assumptions.churnPct).toBe(5);
    expect(assumptions.cac).toBe(2000);
    expect(assumptions.horizonMonths).toBe(24);

    // Every value is a finite number.
    for (const v of Object.values(assumptions)) {
      expect(typeof v).toBe('number');
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('omits horizon when not present', () => {
    const spec = parseModelSpec('200 klientów, ARPU 500');
    const assumptions = specToAssumptions(spec);
    expect(assumptions.horizonMonths).toBeUndefined();
  });
});
