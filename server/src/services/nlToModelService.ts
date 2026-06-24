/**
 * M16 / 8.4 — NL → Model service
 *
 * Deterministic, rule-based extractor that turns a natural-language model
 * description into a structured model spec. This is the testable foundation
 * layer; an LLM-assisted parser is a follow-up that can reuse these pure
 * functions for grounding/validation.
 *
 * All functions here are pure (no DB, no I/O) so they are trivially unit
 * testable. Shapes are kept compatible with the (future) driverTreeService.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CurrencyCode = 'PLN' | 'USD' | 'EUR' | 'GBP';

export type BusinessType = 'SaaS' | 'ecommerce' | 'services' | 'generic';

export interface ModelDriver {
  /** Canonical driver key, e.g. 'customers', 'arpu', 'churnPct'. */
  name: string;
  /** Numeric value extracted from the text. */
  value: number;
  /** Optional unit, e.g. 'PLN', '%', 'months'. */
  unit?: string;
}

export interface DetectedContext {
  businessType?: BusinessType;
  currency?: CurrencyCode;
  /** Planning horizon in months. */
  horizon?: number;
}

export interface ModelSpec {
  drivers: ModelDriver[];
  detected: DetectedContext;
}

export interface DriverTreeNode {
  id: string;
  label: string;
  /** Driver key when this node maps to a concrete extracted driver. */
  driverName?: string;
  /** Resolved numeric value when known. */
  value?: number;
  unit?: string;
  /** 'input' = leaf driver, 'derived' = computed from children. */
  kind: 'input' | 'derived';
  /** Multiplicative composition of child node ids (for derived nodes). */
  children?: string[];
  formula?: string;
}

export interface DriverTree {
  nodes: DriverTreeNode[];
}

// ---------------------------------------------------------------------------
// Number parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a human-written number that may contain thousands separators
 * (space, comma, dot) and a 'k'/'m' magnitude suffix.
 */
function parseHumanNumber(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase();

  let multiplier = 1;
  const suffixMatch = s.match(/([km])\s*$/);
  if (suffixMatch) {
    multiplier = suffixMatch[1] === 'k' ? 1_000 : 1_000_000;
    s = s.slice(0, suffixMatch.index).trim();
  }

  // Normalise separators. We treat spaces and apostrophes as thousands sep.
  s = s.replace(/[\s']/g, '');

  // If both ',' and '.' appear, assume the last one is the decimal sep.
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // A lone comma: decimal if it looks like 1,5 ; thousands if 1,500.
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length !== 3) {
      s = parts[0] + '.' + parts[1];
    } else {
      s = s.replace(/,/g, '');
    }
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n * multiplier;
}

const NUM = String.raw`(\d[\d\s.,']*)\s*([km])?`;

// ---------------------------------------------------------------------------
// Currency detection
// ---------------------------------------------------------------------------

const CURRENCY_PATTERNS: Array<{ code: CurrencyCode; re: RegExp }> = [
  { code: 'PLN', re: /\b(pln|zł|zl|złotych|zlotych)\b/i },
  { code: 'USD', re: /(\$|\busd\b|\bdollars?\b)/i },
  { code: 'EUR', re: /(€|\beur\b|\beuro\b)/i },
  { code: 'GBP', re: /(£|\bgbp\b|\bpounds?\b)/i },
];

function detectCurrency(text: string): CurrencyCode | undefined {
  for (const { code, re } of CURRENCY_PATTERNS) {
    if (re.test(text)) return code;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Horizon detection (normalised to months)
// ---------------------------------------------------------------------------

function detectHorizon(text: string): number | undefined {
  // Months: "12 miesięcy", "horyzont 18 mies", "over 24 months"
  const monthRe = new RegExp(`${NUM}\\s*(?:mies(?:i[ęe]cy|i[ąa]c[ey]?)?|months?|mo\\b|m-cy)`, 'i');
  const mMatch = text.match(monthRe);
  if (mMatch) {
    const v = parseHumanNumber(mMatch[1] + (mMatch[2] ?? ''));
    if (v != null) return Math.round(v);
  }

  // Years: "3 lata", "5 years", "horyzont 2 lat" → months
  const yearRe = new RegExp(`${NUM}\\s*(?:lat[a]?|lata|years?|yrs?|r\\.|roku)`, 'i');
  const yMatch = text.match(yearRe);
  if (yMatch) {
    const v = parseHumanNumber(yMatch[1] + (yMatch[2] ?? ''));
    if (v != null) return Math.round(v * 12);
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Driver extraction
// ---------------------------------------------------------------------------

/**
 * Each rule maps a regex to a canonical driver. The first capture group is the
 * number; an optional magnitude suffix group is concatenated before parsing.
 */
interface DriverRule {
  name: string;
  unit?: string;
  re: RegExp;
}

const DRIVER_RULES: DriverRule[] = [
  // Customers / klienci / users
  {
    name: 'customers',
    re: new RegExp(`${NUM}\\s*(?:klient[oó]w|klienci|klienta|customers?|clients?|users?|u[zż]ytkownik[oó]w)`, 'i'),
  },
  // Churn — explicitly percentage
  {
    name: 'churnPct',
    unit: '%',
    // Either "churn ... <num>%" or "<num>% churn"; the trailing form requires a
    // percent sign so it can't greedily swallow an unrelated preceding number.
    re: new RegExp(`(?:churn[a-z]*\\s*(?:rate)?\\s*(?:wynosi|=|:)?\\s*${NUM}\\s*%?|(\\d[\\d.,]*)\\s*%\\s*churn)`, 'i'),
  },
  // ARPU
  {
    name: 'arpu',
    re: new RegExp(`arpu\\s*(?:wynosi|=|:|of)?\\s*${NUM}`, 'i'),
  },
  // MRR
  {
    name: 'mrr',
    re: new RegExp(`mrr\\s*(?:wynosi|=|:|of)?\\s*${NUM}`, 'i'),
  },
  // CAC
  {
    name: 'cac',
    re: new RegExp(`cac\\s*(?:wynosi|=|:|of)?\\s*${NUM}`, 'i'),
  },
  // LTV
  {
    name: 'ltv',
    re: new RegExp(`ltv\\s*(?:wynosi|=|:|of)?\\s*${NUM}`, 'i'),
  },
  // Average order value (ecommerce)
  {
    name: 'aov',
    re: new RegExp(`(?:aov|[sś]rednia?\\s*warto[sś][cć]\\s*zam[oó]wienia)\\s*(?:wynosi|=|:|of)?\\s*${NUM}`, 'i'),
  },
  // Orders / transactions
  {
    name: 'orders',
    re: new RegExp(`${NUM}\\s*(?:zam[oó]wie[ńn]|orders?|transakcji|transactions?)`, 'i'),
  },
  // Conversion rate
  {
    name: 'conversionPct',
    unit: '%',
    re: new RegExp(`(?:konwersj[ai]|conversion)\\s*(?:rate)?\\s*(?:wynosi|=|:|of)?\\s*${NUM}\\s*%?`, 'i'),
  },
  // Gross margin
  {
    name: 'grossMarginPct',
    unit: '%',
    re: new RegExp(`(?:mar[zż][ay]?\\s*(?:brutto)?|gross\\s*margin)\\s*(?:wynosi|=|:|of)?\\s*${NUM}\\s*%`, 'i'),
  },
];

function extractDrivers(text: string): ModelDriver[] {
  const drivers: ModelDriver[] = [];
  const seen = new Set<string>();

  for (const rule of DRIVER_RULES) {
    const m = text.match(rule.re);
    if (!m) continue;
    if (seen.has(rule.name)) continue;

    // Find the first non-undefined numeric capture pair after the full match.
    // Groups come in (number, suffix) pairs interleaved through the rule.
    let value: number | null = null;
    for (let i = 1; i < m.length; i++) {
      if (m[i] == null) continue;
      // A numeric capture starts with a digit.
      if (/^\d/.test(m[i])) {
        const suffix = m[i + 1] && /^[km]$/i.test(m[i + 1]) ? m[i + 1] : '';
        value = parseHumanNumber(m[i] + suffix);
        if (value != null) break;
      }
    }

    if (value == null) continue;
    seen.add(rule.name);
    const driver: ModelDriver = { name: rule.name, value };
    if (rule.unit) driver.unit = rule.unit;
    drivers.push(driver);
  }

  return drivers;
}

// ---------------------------------------------------------------------------
// Business-type detection
// ---------------------------------------------------------------------------

function detectBusinessType(text: string, drivers: ModelDriver[]): BusinessType | undefined {
  const lower = text.toLowerCase();
  const has = (name: string) => drivers.some((d) => d.name === name);

  if (/\bsaas\b|subskrypcj|subscription/.test(lower) || has('churnPct') || has('arpu') || has('mrr')) {
    return 'SaaS';
  }
  if (/e-?commerce|sklep|shop|store/.test(lower) || has('aov') || has('orders')) {
    return 'ecommerce';
  }
  if (/us[lł]ug|services?|consulting|doradztw/.test(lower)) {
    return 'services';
  }
  if (drivers.length > 0) return 'generic';
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a natural-language model description into a structured spec.
 */
export function parseModelSpec(text: string): ModelSpec {
  const safe = typeof text === 'string' ? text : '';
  const drivers = extractDrivers(safe);

  const detected: DetectedContext = {};
  const businessType = detectBusinessType(safe, drivers);
  if (businessType) detected.businessType = businessType;
  const currency = detectCurrency(safe);
  if (currency) detected.currency = currency;
  const horizon = detectHorizon(safe);
  if (horizon != null) detected.horizon = horizon;

  return { drivers, detected };
}

/**
 * Build a simple driver tree from a parsed spec. The tree is shaped for
 * driverTreeService consumption: a root "Revenue" node composed of the
 * relevant leaf drivers depending on detected business type.
 */
export function buildDriverTreeFromSpec(spec: ModelSpec): DriverTree {
  const driverMap = new Map(spec.drivers.map((d) => [d.name, d]));
  const nodes: DriverTreeNode[] = [];

  const leaf = (name: string, label: string): DriverTreeNode | null => {
    const d = driverMap.get(name);
    if (!d) return null;
    const node: DriverTreeNode = {
      id: name,
      label,
      driverName: name,
      value: d.value,
      kind: 'input',
    };
    if (d.unit) node.unit = d.unit;
    return node;
  };

  const businessType = spec.detected.businessType;

  // Decide which leaves compose Revenue.
  let revenueChildren: Array<{ name: string; label: string }> = [];
  let formula = '';

  if (businessType === 'SaaS') {
    revenueChildren = [
      { name: 'customers', label: 'Customers' },
      { name: 'arpu', label: 'ARPU' },
    ];
    formula = 'Revenue = Customers × ARPU';
  } else if (businessType === 'ecommerce') {
    revenueChildren = [
      { name: 'orders', label: 'Orders' },
      { name: 'aov', label: 'Average Order Value' },
    ];
    formula = 'Revenue = Orders × AOV';
  } else {
    // Generic: pick whatever multiplicative pair we can find.
    if (driverMap.has('customers') && driverMap.has('arpu')) {
      revenueChildren = [
        { name: 'customers', label: 'Customers' },
        { name: 'arpu', label: 'ARPU' },
      ];
      formula = 'Revenue = Customers × ARPU';
    } else if (driverMap.has('orders') && driverMap.has('aov')) {
      revenueChildren = [
        { name: 'orders', label: 'Orders' },
        { name: 'aov', label: 'Average Order Value' },
      ];
      formula = 'Revenue = Orders × AOV';
    }
  }

  const childIds: string[] = [];
  for (const { name, label } of revenueChildren) {
    const node = leaf(name, label);
    if (node) {
      nodes.push(node);
      childIds.push(node.id);
    }
  }

  // Root revenue node — derived when we have composing leaves, otherwise a stub.
  if (childIds.length >= 2) {
    const a = driverMap.get(childIds[0])!.value;
    const b = driverMap.get(childIds[1])!.value;
    nodes.push({
      id: 'revenue',
      label: 'Revenue',
      kind: 'derived',
      children: childIds,
      value: a * b,
      formula,
    });
  } else {
    nodes.push({
      id: 'revenue',
      label: 'Revenue',
      kind: 'derived',
      children: childIds,
    });
  }

  // Attach any remaining drivers as standalone input nodes (e.g. churn, cac).
  for (const d of spec.drivers) {
    if (nodes.some((n) => n.id === d.name)) continue;
    const node: DriverTreeNode = {
      id: d.name,
      label: d.name,
      driverName: d.name,
      value: d.value,
      kind: 'input',
    };
    if (d.unit) node.unit = d.unit;
    nodes.push(node);
  }

  return { nodes };
}

/**
 * Map a parsed spec into a flat record of model assumptions (numbers only),
 * ready to feed financial-modeling assumptions.
 */
export function specToAssumptions(spec: ModelSpec): Record<string, number> {
  const assumptions: Record<string, number> = {};

  for (const d of spec.drivers) {
    assumptions[d.name] = d.value;
  }

  if (spec.detected.horizon != null) {
    assumptions.horizonMonths = spec.detected.horizon;
  }

  return assumptions;
}

export default {
  parseModelSpec,
  buildDriverTreeFromSpec,
  specToAssumptions,
};
