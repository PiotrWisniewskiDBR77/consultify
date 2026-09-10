#!/usr/bin/env node
/**
 * DOSIEW MEGATRENDÓW — automotive (Zadanie D-B, DEC-463, 2026-09-10).
 *
 * POWÓD: panel Megatrendów (GET /api/megatrends/baseline?industry=...) oddaje
 * 503 "brak danych" dla organizacji Northwind. Zmierzone bezpośrednio na
 * żywej bazie STAGING PRZED tym skryptem (patrz evidence/d-b-megatrendy/):
 * tabela `megatrends` jest CAŁKOWICIE PUSTA (0 wierszy dla KAŻDEJ branży, nie
 * tylko automotive) — migracja `server/migrations/20260608_megatrends_seed.sql`
 * nie działa na tym środowisku / dane zostały skądś wyczyszczone. To szerszy
 * problem niż sam Northwind — dotyczy WSZYSTKICH organizacji na stagingu. Ten
 * skrypt naprawia w zakresie DEC-463: dosiewa branżę 'automotive', bo:
 *   - src/components/Megatrend/MegatrendsWorkspace.tsx:44 trzyma
 *     `useState('automotive')` jako domyślną (i jedyną realnie używaną w UI)
 *     wartość industry — NIE czyta organizations.industry dynamicznie
 *     (organizacja Northwind ma industry='Industrial Manufacturing' w bazie,
 *     ale panel i tak zapyta o 'automotive' — zmierzone, patrz
 *     src/store/megatrendStore.ts:21).
 *   - server/src/models/megatrend.ts getBaselineTrends(industry) robi
 *     `SELECT * FROM megatrends WHERE industry = ?` — brak jakiegokolwiek
 *     powiązania z organization_id/company_id (tabela `megatrends` to
 *     WSPÓLNY katalog per branża, nie per organizacja). Nie ma też osobnego
 *     rekordu "baseline per organizacja" do utworzenia — samo dosianie
 *     wierszy z industry='automotive' wystarcza.
 *
 * Naprawa INNYCH branż (Manufacturing/Professional Services/Retail/general —
 * też puste) jest POZA zakresem DEC-463 i tego skryptu — zgłoszone osobno.
 *
 * ------------------------------------------------------------------------------
 * UŻYCIE
 * ------------------------------------------------------------------------------
 *   DATABASE_URL=... node scripts/dane/megatrendy-automotive-20260910.mjs --dry-run
 *   DATABASE_URL=... FORCE_MEGATRENDY_AUTOMOTIVE=true node scripts/dane/megatrendy-automotive-20260910.mjs --apply
 *
 * Domyślny tryb = dry-run (brak jawnego --apply nigdy nie zapisuje).
 * --apply wymaga DODATKOWO zmiennej środowiskowej FORCE_MEGATRENDY_AUTOMOTIVE=true.
 * Manifest (pełna lista wierszy do wstawienia + stan PRZED) ląduje w
 *   evidence/d-b-megatrendy/manifest-<ISO-czas>.json
 * CSV PRZED/PO (liczba wierszy per branża) w
 *   evidence/d-b-megatrendy/przed.csv, evidence/d-b-megatrendy/po.csv
 *
 * IDEMPOTENTNY: stabilne, jawne id (mg-auto-*), INSERT ... ON CONFLICT (id)
 * DO NOTHING — powtórne odpalenie --apply nic nie dubluje.
 *
 * Guard hosta — ten sam wzorzec co scripts/dane/brud-e4-20260910.mjs:
 * produkcja (centerbeam) ZAWSZE odrzucona; dozwolony tylko host STAGING
 * (thomas.proxy.rlwy.net) + localhost do testów lokalnych. Demo (trolley)
 * jest tu CELOWO wykluczone — to zadanie dotyczy wyłącznie stagingu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const KATALOG_DOWODOW = path.join(REPO_ROOT, 'evidence', 'd-b-megatrendy');

const INDUSTRY = 'automotive';

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
// Dane — 12 megatrendów automotive, PO ANGIELSKU (DEC-461).
// Ring: 'Now' / 'Watch Closely' / 'On the Horizon' (kanon z 20260608_megatrends_seed.sql).
// Type: 'Technology' / 'Business' / 'Societal' (istniejący enum wartości).
// Źródło/atrybucja WEWNĄTRZ description (schema nie ma osobnej kolumny na
// źródło) — nazwy realnych raportów branżowych, bez zmyślonych adresów URL.
// ============================================================================
const ROWS = [
  {
    id: 'mg-auto-tech-01',
    type: 'Technology',
    label: 'Electrification of powertrains',
    description:
      'OEMs are shifting core R&D and capital expenditure from internal combustion to battery-electric and hybrid powertrains as emissions targets tighten across the EU, UK, and China. Model line-ups are being restructured around dedicated EV platforms rather than ICE-derived conversions. (Source: IEA Global EV Outlook 2025)',
    base_impact_score: 92,
    initial_ring: 'Now',
  },
  {
    id: 'mg-auto-tech-02',
    type: 'Technology',
    label: 'Software-defined vehicles',
    description:
      'Vehicle differentiation is moving from hardware to software: over-the-air updates, centralized compute architectures, and subscription features are becoming standard expectations. Traditional OEMs are building software organizations comparable to technology companies to avoid ceding margin to platform providers. (Source: McKinsey Software-Defined Vehicle report, 2025)',
    base_impact_score: 88,
    initial_ring: 'Now',
  },
  {
    id: 'mg-auto-bus-01',
    type: 'Business',
    label: 'Battery supply-chain localisation (EU Battery Regulation)',
    description:
      'The EU Battery Regulation and carbon border adjustments are pushing automakers and suppliers to localise cell and material production within Europe rather than rely on Asian imports. This is reshaping supplier contracts, gigafactory investment, and raw-material sourcing strategy. (Source: EU Battery Regulation 2023/1542; ACEA Pocket Guide 2025)',
    base_impact_score: 84,
    initial_ring: 'Now',
  },
  {
    id: 'mg-auto-bus-02',
    type: 'Business',
    label: 'Tier-1 consolidation',
    description:
      'Margin pressure from EV transition costs and software investment is accelerating mergers and restructuring among Tier-1 suppliers. Fewer, larger suppliers are emerging with broader mechatronics and software capability, changing how OEMs manage sourcing risk. (Source: ACEA Pocket Guide 2025)',
    base_impact_score: 74,
    initial_ring: 'Watch Closely',
  },
  {
    id: 'mg-auto-tech-03',
    type: 'Technology',
    label: 'Autonomous driving L2+/L3 regulation',
    description:
      'Regulatory frameworks for conditional automation (SAE Level 3) are advancing unevenly across markets, with UN R157 and national approvals unlocking limited highway use cases. Liability, homologation, and data-recording requirements remain the main gating factors for wider rollout. (Source: UNECE WP.29 regulatory framework; IEA Global EV Outlook 2025)',
    base_impact_score: 78,
    initial_ring: 'Watch Closely',
  },
  {
    id: 'mg-auto-bus-03',
    type: 'Business',
    label: 'Circular economy & recycled materials',
    description:
      'End-of-life vehicle and battery recycling mandates are pushing OEMs to design for disassembly and to secure recycled-content quotas for steel, aluminium, and battery-grade metals. This is creating new partnerships between automakers and recyclers to close material loops. (Source: EU Battery Regulation 2023/1542)',
    base_impact_score: 70,
    initial_ring: 'Watch Closely',
  },
  {
    id: 'mg-auto-bus-04',
    type: 'Business',
    label: 'Chinese OEM expansion in Europe',
    description:
      'Chinese automakers are rapidly increasing European market share through competitively priced EVs and local assembly investment, prompting anti-dumping tariff measures and defensive pricing from incumbent OEMs. This is intensifying competition in the mass-market EV segment. (Source: ACEA Pocket Guide 2025)',
    base_impact_score: 86,
    initial_ring: 'Now',
  },
  {
    id: 'mg-auto-tech-04',
    type: 'Technology',
    label: 'Semiconductor sovereignty',
    description:
      'Persistent exposure to semiconductor supply shocks is driving automakers to diversify chip sourcing, qualify second-source suppliers, and support regional fabrication capacity under initiatives such as the EU Chips Act. Chip shortages remain a recurring constraint on production planning. (Source: EU Chips Act; IEA Global EV Outlook 2025)',
    base_impact_score: 80,
    initial_ring: 'Watch Closely',
  },
  {
    id: 'mg-auto-tech-05',
    type: 'Technology',
    label: 'Predictive maintenance & digital twins',
    description:
      'Connected-vehicle telemetry and digital-twin modelling are enabling predictive maintenance programmes that reduce warranty costs and improve uptime for commercial fleets. Manufacturers are extending these capabilities from production lines into in-service vehicle monitoring. (Source: McKinsey Software-Defined Vehicle report, 2025)',
    base_impact_score: 76,
    initial_ring: 'Now',
  },
  {
    id: 'mg-auto-soc-01',
    type: 'Societal',
    label: 'Workforce reskilling for EV manufacturing',
    description:
      'The shift to electric powertrains requires fundamentally different assembly and maintenance skills than combustion engines, creating a reskilling gap among existing manufacturing and dealer-service workforces. OEMs and suppliers are investing in retraining programmes to avoid a shortage of qualified EV technicians. (Source: ACEA Pocket Guide 2025)',
    base_impact_score: 72,
    initial_ring: 'Watch Closely',
  },
  {
    id: 'mg-auto-bus-05',
    type: 'Business',
    label: 'Near-shoring to CEE',
    description:
      'Automakers and suppliers are relocating production and sourcing closer to European end markets, favouring Central and Eastern Europe for labour cost, logistics, and regulatory alignment advantages over long-distance Asian supply chains. This near-shoring trend is reinforced by battery and EU content-of-origin requirements. (Source: ACEA Pocket Guide 2025)',
    base_impact_score: 66,
    initial_ring: 'On the Horizon',
  },
  {
    id: 'mg-auto-soc-02',
    type: 'Societal',
    label: 'ESG/CSRD reporting pressure',
    description:
      'The Corporate Sustainability Reporting Directive (CSRD) is expanding mandatory ESG disclosure requirements to more automotive suppliers and OEMs, covering emissions, supply-chain due diligence, and circularity metrics. Compliance costs and data-collection burdens are rising sharply across the value chain. (Source: EU Corporate Sustainability Reporting Directive (CSRD))',
    base_impact_score: 75,
    initial_ring: 'Now',
  },
];

if (ROWS.length < 10 || ROWS.length > 12) {
  throw new Error(`Oczekiwano 10-12 wierszy, jest ${ROWS.length}.`);
}
const idSet = new Set(ROWS.map((r) => r.id));
if (idSet.size !== ROWS.length) throw new Error('Zduplikowane id w ROWS.');

// ============================================================================
// Manifest / CSV helpers
// ============================================================================
function zapiszManifest(dane) {
  fs.mkdirSync(KATALOG_DOWODOW, { recursive: true });
  const znacznik = new Date().toISOString().replace(/[:.]/g, '-');
  const plik = path.join(KATALOG_DOWODOW, `manifest-${znacznik}.json`);
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
  if (apply && process.env.FORCE_MEGATRENDY_AUTOMOTIVE !== 'true') {
    throw new Error('--apply wymaga FORCE_MEGATRENDY_AUTOMOTIVE=true.');
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
    const przedAutomotive = (
      await c.query('SELECT count(*)::int AS n FROM megatrends WHERE industry = $1', [INDUSTRY])
    ).rows[0].n;
    console.log(`[PRZED] wierszy dla industry='${INDUSTRY}': ${przedAutomotive}`);
    console.log('[PRZED] liczba branż z jakimikolwiek wierszami:', przedCounts.length);
    zapiszCsvCounts('przed.csv', przedCounts);

    const manifest = {
      zadanie: 'D-B / DEC-463 — dosiew megatrendów automotive',
      timestamp: new Date().toISOString(),
      tryb: apply ? 'APPLY' : 'DRY-RUN',
      industry: INDUSTRY,
      przedCounts,
      przedAutomotiveCount: przedAutomotive,
      wierszeDoWstawienia: ROWS,
    };

    // --- INSERT (idempotentny) ---
    let wstawionych = 0;
    await c.query('BEGIN');
    try {
      for (const r of ROWS) {
        const res = await c.query(
          `INSERT INTO megatrends (id, industry, type, label, description, base_impact_score, initial_ring)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [r.id, INDUSTRY, r.type, r.label, r.description, r.base_impact_score, r.initial_ring]
        );
        wstawionych += res.rowCount ?? 0;
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
    const poAutomotive = (
      await c.query('SELECT count(*)::int AS n FROM megatrends WHERE industry = $1', [INDUSTRY])
    ).rows[0].n;
    const poCounts = (
      await c.query('SELECT industry, count(*)::int FROM megatrends GROUP BY industry ORDER BY industry')
    ).rows;
    console.log(`[PO] wierszy dla industry='${INDUSTRY}': ${poAutomotive} (nowo wstawionych w tej operacji: ${wstawionych})`);
    if (apply) zapiszCsvCounts('po.csv', poCounts);

    manifest.wstawionychWTejOperacji = wstawionych;
    manifest.poAutomotiveCount = poAutomotive;
    manifest.poCounts = poCounts;
    const manifestPath = zapiszManifest(manifest);
    console.log(`[manifest] ${manifestPath}`);
    console.log(`[wynik] ${dryRun ? 'DRY-RUN (nic nie zapisano)' : 'APPLY (zapisano)'}: ${wstawionych}/${ROWS.length} nowych wierszy dla '${INDUSTRY}'.`);
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('BŁĄD:', err.message);
  process.exit(1);
});
