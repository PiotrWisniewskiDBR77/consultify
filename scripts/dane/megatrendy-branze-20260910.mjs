#!/usr/bin/env node
/**
 * DOSIEW MEGATRENDÓW — pozostałe branże (D-B2, dokończenie DEC-463, 2026-09-10).
 *
 * POWÓD: skrypt scripts/dane/megatrendy-automotive-20260910.mjs (D-B) dosiał
 * WYŁĄCZNIE industry='automotive' (12 wierszy), bo panel Megatrendów
 * (src/components/Megatrend/MegatrendsWorkspace.tsx:44,
 * src/store/megatrendStore.ts:21) trzyma sztywne `useState('automotive')` i
 * NIE czyta organizations.industry dynamicznie. Ten fakt jest znanym długiem
 * produktowym (zgłoszony osobno, NIE naprawiany w tym zadaniu).
 *
 * Zmierzone bezpośrednio na żywej bazie STAGING PRZED tym skryptem:
 *   - tabela `megatrends` miała TYLKO industry='automotive' (12 wierszy) —
 *     migracja server/migrations/20260608_megatrends_seed.sql (Manufacturing/
 *     Professional Services/Retail/general, 12 wierszy) NIE jest obecna na
 *     tym środowisku.
 *   - organizations.industry na stagingu: 'edtech manufacturing' (10),
 *     'financial' (1), 'Industrial Manufacturing' (1 — organizacja Northwind),
 *     NULL (7). Żadna wartość nie odpowiada literalnie branżom z migracji
 *     20260608 — mimo to migracja 20260608 to KANONICZNY seed (branże
 *     Manufacturing/Professional Services/Retail/general są referencyjnym
 *     katalogiem, nie muszą 1:1 odpowiadać istniejącym organizacjom) i ma
 *     wejść na bazę zgodnie ze swoim przeznaczeniem.
 *
 * ZAKRES tego skryptu (dokończenie DEC-463, zadanie D-B2):
 *   (a) dosiewa DOKŁADNIE te same 12 wierszy co migracja 20260608 (te same
 *       stabilne id: mg-mfg-*, mg-ps-*, mg-ret-*, mg-gen-*) — dane w migracji
 *       są już po angielsku i realistyczne, więc reużyte 1:1 bez zmian. Te
 *       same id → przyszłe uruchomienie migracji 20260608 NIC nie zduplikuje
 *       (ON CONFLICT (id) DO NOTHING po obu stronach).
 *   (b) dosiewa NOWĄ branżę industry='Industrial Manufacturing' (dokładna
 *       wartość organizations.industry dla Northwind) — 10 realistycznych
 *       trendów EN, bo to jedyna organizacja na stagingu z realnym,
 *       niepustym industry poza automotive/financial/edtech, a panel — gdyby
 *       kiedyś przestał być sztywno wpięty w 'automotive' — miałby dla niej
 *       dane zamiast 503.
 *
 * NIE naprawia (poza zakresem, zgłoszone do rejestru):
 *   - panelu sztywno wołającego industry='automotive' niezależnie od
 *     organizacji (MegatrendsWorkspace.tsx:44 / megatrendStore.ts:21),
 *   - branż 'financial' i 'edtech manufacturing' (brak kanonicznego seedu ani
 *     zlecenia dla tych branż w DEC-463 — do osobnej decyzji).
 *
 * ------------------------------------------------------------------------------
 * UŻYCIE
 * ------------------------------------------------------------------------------
 *   DATABASE_URL=... node scripts/dane/megatrendy-branze-20260910.mjs --dry-run
 *   DATABASE_URL=... FORCE_MEGATRENDY_BRANZE=true node scripts/dane/megatrendy-branze-20260910.mjs --apply
 *
 * Domyślny tryb = dry-run (brak jawnego --apply nigdy nie zapisuje).
 * --apply wymaga DODATKOWO zmiennej środowiskowej FORCE_MEGATRENDY_BRANZE=true.
 * Manifest ląduje w evidence/d-b-megatrendy/manifest-branze-<ISO-czas>.json
 * CSV PRZED/PO (liczba wierszy per branża) w
 *   evidence/d-b-megatrendy/przed-branze.csv, evidence/d-b-megatrendy/po-branze.csv
 *
 * IDEMPOTENTNY: stabilne, jawne id, INSERT ... ON CONFLICT (id) DO NOTHING —
 * powtórne odpalenie --apply nic nie dubluje (zweryfikowane drugim dry-run po
 * apply w tym zadaniu — patrz manifest).
 *
 * Guard hosta — identyczny wzorzec co megatrendy-automotive-20260910.mjs:
 * produkcja (centerbeam) ZAWSZE odrzucona; dozwolony tylko host STAGING
 * (thomas.proxy.rlwy.net) + localhost do testów lokalnych. Demo (trolley)
 * jest tu CELOWO wykluczone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const KATALOG_DOWODOW = path.join(REPO_ROOT, 'evidence', 'd-b-megatrendy');

// ============================================================================
// Guard hosta
// ============================================================================
const HOSTY_ZDALNE_DOZWOLONE = ['thomas.proxy.rlwy.net'];
const LOKALNE = ['127.0.0.1', 'localhost', '::1', '0.0.0.0'];

function sprawdzHost(databaseUrl) {
  const u = new URL(databaseUrl);
  if (/centerbeam/i.test(u.hostname)) {
    throw new Error('PRODUKCJA (centerbeam) — STOP. Ten skrypt nie wolno uruchomić na produkcji.');
  }
  if (/trolley/i.test(u.hostname)) {
    throw new Error('DEMO (trolley) — STOP. To zadanie dotyczy wyłącznie stagingu (thomas).');
  }
  if (LOKALNE.includes(u.hostname)) return;
  if (!HOSTY_ZDALNE_DOZWOLONE.includes(u.hostname)) {
    throw new Error(`Host niedozwolony (nie staging): ${u.hostname}`);
  }
}

// ============================================================================
// (a) Dane 1:1 z server/migrations/20260608_megatrends_seed.sql — kanoniczny
// seed, EN, realistyczny, BEZ ZMIAN treści. Te same id — idempotentne wobec
// przyszłego uruchomienia tej migracji.
// ============================================================================
const ROWS_Z_MIGRACJI = [
  { id: 'mg-mfg-tech-01', industry: 'Manufacturing', type: 'Technology', label: 'Industrial AI & ML', description: 'ML applied to predictive maintenance and quality control', base_impact_score: 85, initial_ring: 'Now' },
  { id: 'mg-mfg-tech-02', industry: 'Manufacturing', type: 'Technology', label: 'Collaborative Robotics', description: 'Cobots alongside human workers in assembly', base_impact_score: 75, initial_ring: 'Now' },
  { id: 'mg-mfg-bus-01', industry: 'Manufacturing', type: 'Business', label: 'Supply Chain Regionalization', description: 'Near-shoring driven by geopolitical risk', base_impact_score: 80, initial_ring: 'Now' },
  { id: 'mg-mfg-soc-01', industry: 'Manufacturing', type: 'Societal', label: 'Skilled Labour Shortage', description: 'Demographic gap in technical trades', base_impact_score: 70, initial_ring: 'Watch Closely' },
  { id: 'mg-ps-tech-01', industry: 'Professional Services', type: 'Technology', label: 'Generative AI for Knowledge Work', description: 'LLMs automating research, drafting, analysis', base_impact_score: 90, initial_ring: 'Now' },
  { id: 'mg-ps-bus-01', industry: 'Professional Services', type: 'Business', label: 'Value-Based Pricing Shift', description: 'Clients reject hourly billing for outcome pricing', base_impact_score: 72, initial_ring: 'Now' },
  { id: 'mg-ps-soc-01', industry: 'Professional Services', type: 'Societal', label: 'Hybrid Work as Default', description: 'Client expectation for remote-first delivery', base_impact_score: 65, initial_ring: 'Watch Closely' },
  { id: 'mg-ret-tech-01', industry: 'Retail', type: 'Technology', label: 'AI-Driven Personalisation', description: 'Real-time recommendation and dynamic pricing', base_impact_score: 88, initial_ring: 'Now' },
  { id: 'mg-ret-bus-01', industry: 'Retail', type: 'Business', label: 'Marketplace Consolidation', description: 'Long-tail retailers squeezed by platform growth', base_impact_score: 78, initial_ring: 'Now' },
  { id: 'mg-ret-soc-01', industry: 'Retail', type: 'Societal', label: 'Sustainability-Led Purchasing', description: 'Consumer preference shift to low-impact products', base_impact_score: 68, initial_ring: 'Watch Closely' },
  { id: 'mg-gen-tech-01', industry: 'general', type: 'Technology', label: 'Agentic AI & Orchestration', description: 'Multi-agent systems handling autonomous workflows', base_impact_score: 82, initial_ring: 'On the Horizon' },
  { id: 'mg-gen-bus-01', industry: 'general', type: 'Business', label: 'Platform Economics', description: 'Network-effect moats across all sectors', base_impact_score: 74, initial_ring: 'Watch Closely' },
];

// ============================================================================
// (b) Nowa branża — industry='Industrial Manufacturing' (dokładna wartość
// organizations.industry dla Northwind na stagingu). 10 trendów PO ANGIELSKU,
// źródło/atrybucja wewnątrz description (schema nie ma osobnej kolumny).
// ============================================================================
const ROWS_INDUSTRIAL_MANUFACTURING = [
  {
    id: 'mg-indmfg-tech-01',
    industry: 'Industrial Manufacturing',
    type: 'Technology',
    label: 'Industry 4.0 / IIoT convergence',
    description:
      'Plant-floor sensors, PLCs, and MES/ERP systems are converging into unified Industrial Internet of Things platforms, giving real-time visibility into throughput, quality, and downtime. Manufacturers that have connected their equipment report materially faster root-cause analysis than those relying on manual data collection. (Source: World Economic Forum Global Lighthouse Network, 2025)',
    base_impact_score: 88,
    initial_ring: 'Now',
  },
  {
    id: 'mg-indmfg-bus-01',
    industry: 'Industrial Manufacturing',
    type: 'Business',
    label: 'Energy costs & decarbonisation pressure',
    description:
      'Volatile industrial energy prices and tightening emissions-reporting obligations are forcing manufacturers to invest in efficiency retrofits, on-site generation, and electrification of process heat. Energy strategy has moved from a facilities line item to a board-level capital-planning topic. (Source: IEA World Energy Outlook 2025)',
    base_impact_score: 85,
    initial_ring: 'Now',
  },
  {
    id: 'mg-indmfg-bus-02',
    industry: 'Industrial Manufacturing',
    type: 'Business',
    label: 'Reshoring & near-shoring of production',
    description:
      'Extended lead times and geopolitical risk exposed during recent supply disruptions are pushing manufacturers to relocate production closer to end markets, trading lower unit-cost labour for shorter, more predictable supply chains. Government incentive programmes in the US and EU are reinforcing the shift. (Source: McKinsey Global Manufacturing Outlook, 2025)',
    base_impact_score: 80,
    initial_ring: 'Now',
  },
  {
    id: 'mg-indmfg-soc-01',
    industry: 'Industrial Manufacturing',
    type: 'Societal',
    label: 'Skilled-labour shortage',
    description:
      'An ageing skilled-trades workforce and insufficient pipeline of machinists, welders, and industrial technicians is constraining capacity expansion independent of order volume. Manufacturers are competing directly with other sectors for the same shrinking pool of technical talent. (Source: Deloitte and The Manufacturing Institute, Manufacturing Talent Study, 2025)',
    base_impact_score: 74,
    initial_ring: 'Watch Closely',
  },
  {
    id: 'mg-indmfg-tech-02',
    industry: 'Industrial Manufacturing',
    type: 'Technology',
    label: 'Additive manufacturing at production scale',
    description:
      'Metal and polymer 3D printing is moving beyond prototyping into low-volume production of tooling, spare parts, and complex geometries that are uneconomical to cast or machine. This is starting to reshape spare-parts inventory strategy toward print-on-demand rather than warehousing. (Source: McKinsey Global Manufacturing Outlook, 2025)',
    base_impact_score: 68,
    initial_ring: 'Watch Closely',
  },
  {
    id: 'mg-indmfg-tech-03',
    industry: 'Industrial Manufacturing',
    type: 'Technology',
    label: 'OT/ICS cybersecurity exposure',
    description:
      'Connecting previously air-gapped operational-technology and industrial-control systems to IT networks is expanding the attack surface for ransomware and state-linked actors targeting plant availability. Regulators and insurers are increasingly requiring documented OT security programmes as a condition of coverage. (Source: ENISA Threat Landscape for Industrial Control Systems, 2025)',
    base_impact_score: 82,
    initial_ring: 'Now',
  },
  {
    id: 'mg-indmfg-bus-03',
    industry: 'Industrial Manufacturing',
    type: 'Business',
    label: 'Supply-chain resilience & dual sourcing',
    description:
      'Single-source dependency on critical components and raw materials is being replaced by deliberate dual- and multi-sourcing strategies, higher safety-stock targets, and supplier risk scoring, trading some cost efficiency for continuity of supply. (Source: McKinsey Global Manufacturing Outlook, 2025)',
    base_impact_score: 78,
    initial_ring: 'Now',
  },
  {
    id: 'mg-indmfg-bus-04',
    industry: 'Industrial Manufacturing',
    type: 'Business',
    label: 'Servitization: equipment-as-a-service',
    description:
      'Industrial equipment makers are shifting from one-time capital-equipment sales toward outcome-based, subscription, and performance-guarantee contracts bundled with monitoring and maintenance, changing revenue recognition and requiring new customer-success capabilities. (Source: World Economic Forum Global Lighthouse Network, 2025)',
    base_impact_score: 65,
    initial_ring: 'Watch Closely',
  },
  {
    id: 'mg-indmfg-tech-04',
    industry: 'Industrial Manufacturing',
    type: 'Technology',
    label: 'Digital twins for plant operations',
    description:
      'Manufacturers are building simulation models of production lines and whole plants to test layout changes, schedule maintenance, and de-risk new-product introduction before touching physical equipment, shortening commissioning time for new lines. (Source: World Economic Forum Global Lighthouse Network, 2025)',
    base_impact_score: 70,
    initial_ring: 'Watch Closely',
  },
  {
    id: 'mg-indmfg-bus-05',
    industry: 'Industrial Manufacturing',
    type: 'Business',
    label: 'CBAM & ESG compliance costs',
    description:
      'The EU Carbon Border Adjustment Mechanism and expanding ESG-disclosure regimes are requiring manufacturers to track embedded emissions across multi-tier supply chains, adding compliance overhead and reshaping supplier-selection criteria toward lower-carbon inputs. (Source: EU Carbon Border Adjustment Mechanism (CBAM) regulation)',
    base_impact_score: 76,
    initial_ring: 'Now',
  },
];

const WSZYSTKIE_NOWE_WIERSZE = [...ROWS_Z_MIGRACJI, ...ROWS_INDUSTRIAL_MANUFACTURING];

// Walidacja podstawowa
{
  const idSet = new Set(WSZYSTKIE_NOWE_WIERSZE.map((r) => r.id));
  if (idSet.size !== WSZYSTKIE_NOWE_WIERSZE.length) throw new Error('Zduplikowane id w danych.');
  if (ROWS_INDUSTRIAL_MANUFACTURING.length < 10 || ROWS_INDUSTRIAL_MANUFACTURING.length > 12) {
    throw new Error(`Industrial Manufacturing: oczekiwano 10-12 wierszy, jest ${ROWS_INDUSTRIAL_MANUFACTURING.length}.`);
  }
}

// ============================================================================
// Manifest / CSV helpers
// ============================================================================
function zapiszManifest(dane) {
  fs.mkdirSync(KATALOG_DOWODOW, { recursive: true });
  const znacznik = new Date().toISOString().replace(/[:.]/g, '-');
  const plik = path.join(KATALOG_DOWODOW, `manifest-branze-${znacznik}.json`);
  fs.writeFileSync(plik, JSON.stringify(dane, null, 2), 'utf8');
  return plik;
}

function zapiszCsvCounts(nazwa, rows) {
  fs.mkdirSync(KATALOG_DOWODOW, { recursive: true });
  const plik = path.join(KATALOG_DOWODOW, nazwa);
  const header = 'industry,count';
  const lines = rows.map((r) => `${r.industry},${r.count}`);
  fs.writeFileSync(plik, [header, ...lines].join('\n') + '\n', 'utf8');
  return plik;
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dryRun = !apply;
  if (apply && process.env.FORCE_MEGATRENDY_BRANZE !== 'true') {
    throw new Error('--apply wymaga FORCE_MEGATRENDY_BRANZE=true.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Brak DATABASE_URL.');
  sprawdzHost(databaseUrl);

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2, ssl: false });
  const c = await pool.connect();
  try {
    // --- PRZED ---
    const przedCounts = (
      await c.query('SELECT industry, count(*)::int FROM megatrends GROUP BY industry ORDER BY industry')
    ).rows;
    console.log('[PRZED] liczba wierszy per branża:');
    console.table(przedCounts);
    zapiszCsvCounts('przed-branze.csv', przedCounts);

    const manifest = {
      zadanie: 'D-B2 — dokończenie DEC-463: dosiew pozostałych branż megatrendów',
      timestamp: new Date().toISOString(),
      tryb: apply ? 'APPLY' : 'DRY-RUN',
      branzeDosiewane: [...new Set(WSZYSTKIE_NOWE_WIERSZE.map((r) => r.industry))],
      przedCounts,
      wierszeDoWstawienia: WSZYSTKIE_NOWE_WIERSZE,
    };

    // --- INSERT (idempotentny) ---
    let wstawionych = 0;
    const wstawionePerBranza = {};
    await c.query('BEGIN');
    try {
      for (const r of WSZYSTKIE_NOWE_WIERSZE) {
        const res = await c.query(
          `INSERT INTO megatrends (id, industry, type, label, description, base_impact_score, initial_ring)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [r.id, r.industry, r.type, r.label, r.description, r.base_impact_score, r.initial_ring]
        );
        const n = res.rowCount ?? 0;
        wstawionych += n;
        wstawionePerBranza[r.industry] = (wstawionePerBranza[r.industry] ?? 0) + n;
      }
      if (apply) {
        await c.query('COMMIT');
      } else {
        await c.query('ROLLBACK');
      }
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    }

    // --- PO (odczyt kontrolny — po COMMIT gdy apply, po ROLLBACK gdy dry-run) ---
    const poCounts = (
      await c.query('SELECT industry, count(*)::int FROM megatrends GROUP BY industry ORDER BY industry')
    ).rows;
    console.log('[PO] liczba wierszy per branża:');
    console.table(poCounts);
    console.log('[PO] nowo wstawionych w tej operacji per branża:', wstawionePerBranza);
    if (apply) zapiszCsvCounts('po-branze.csv', poCounts);

    manifest.wstawionychWTejOperacji = wstawionych;
    manifest.wstawionePerBranza = wstawionePerBranza;
    manifest.poCounts = poCounts;
    const manifestPath = zapiszManifest(manifest);
    console.log(`[manifest] ${manifestPath}`);
    console.log(
      `[wynik] ${dryRun ? 'DRY-RUN (nic nie zapisano)' : 'APPLY (zapisano)'}: ${wstawionych}/${WSZYSTKIE_NOWE_WIERSZE.length} nowych wierszy.`
    );
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('BŁĄD:', err.message);
  process.exit(1);
});
