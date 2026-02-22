/**
 * Seed PLAST-MET Centrum DRD assessment from provided PDF.
 *
 * What it does (idempotent by stable IDs):
 * - Creates/updates a DRD assessment with scores filled based on the PDF report
 * - Copies the PDF into `server/uploads/imports/` and creates an `imported_reports` row linked to the assessment
 * - Creates a list of 29 initiatives (name + description) and links them to the assessment via source_type/source_id
 *
 * How to run (from repo root):
 *   DB_TYPE=postgres node -e "console.log('using .env DATABASE_URL')" && npx tsx server/scripts/seed-plastmet-assessment-from-pdf.ts
 */

import 'dotenv/config';

import fs from 'fs';
import path from 'path';
import pg from 'pg';

import { DRD_STRUCTURE } from '../../src/services/drdStructure';

const { Pool } = pg;

const ORG_ID = process.env.PLASTMET_ORG_ID || 'org-plastmetcentrum';
const PDF_SOURCE_PATH =
  process.env.PLASTMET_PDF_PATH ||
  path.resolve(process.cwd(), 'Plast-met', 'Mapa Rozwoju Digitalnego - Plastmet.pdf');

// Stable IDs (so the script is safe to re-run)
const ASSESSMENT_ID = process.env.PLASTMET_ASSESSMENT_ID || 'assessment-plastmet-drd-2025-12';
const IMPORT_ID = process.env.PLASTMET_IMPORT_ID || 'import-plastmet-drd-2025-12';

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function scale06to05(v06: number): number {
  // Report uses 0..6 in some modules; DRD editor expects 0..5 for axes 5-7.
  // We map proportionally (keep 0 possible for "gap/none").
  return round1((v06 / 6) * 5);
}

function toPgJson(value: unknown): any {
  // pg accepts JS objects for json/jsonb params
  return value as any;
}

async function main() {
  const databaseUrl = mustEnv('DATABASE_URL');
  const dbUrl = new URL(databaseUrl);
  // Railway DNS can be flaky in some environments; allow host override (e.g. an IP).
  if (process.env.DB_HOST_OVERRIDE) {
    dbUrl.hostname = String(process.env.DB_HOST_OVERRIDE).trim();
  }

  const pool = new Pool({
    connectionString: dbUrl.toString(),
    connectionTimeoutMillis: 60000,
  });

  const q = async <T = any>(text: string, params: any[] = []): Promise<T[]> =>
    (await pool.query(text, params)).rows as T[];

  try {
    // -----------------------------------------------------------------------
    // Resolve org + user
    // -----------------------------------------------------------------------
    const orgRows = await q<{ id: string; name: string }>(
      `SELECT id, name FROM organizations WHERE id = $1 LIMIT 1`,
      [ORG_ID]
    );
    if (!orgRows[0]) {
      throw new Error(`Organization not found: ${ORG_ID}`);
    }
    const orgName = orgRows[0].name || 'Plast-Met Centrum';

    const userRows = await q<{ id: string; email: string; role: string }>(
      `SELECT id, email, role
       FROM users
       WHERE organization_id = $1
       ORDER BY (CASE WHEN role = 'OWNER' THEN 0 ELSE 1 END), created_at ASC
       LIMIT 1`,
      [ORG_ID]
    );
    if (!userRows[0]) throw new Error(`No users found for org: ${ORG_ID}`);
    const userId = userRows[0].id;

    // -----------------------------------------------------------------------
    // Scores derived from the provided PDF:
    // - Overall maturity: 40%
    // - Module average scores:
    //   Digitalizacja procesów: 2.6 / 7
    //   Digitalne produkty:     2.6 / 5
    //   Digitalne modele:       0.8 / 5
    //   Zarządzanie danymi:     2.6 / 7
    //   Kultura transformacji:  5.2 / 6  -> mapped proportionally to DRD 1..5
    //   Cyberbezpieczeństwo:    0.8 / 6  -> mapped proportionally to DRD 1..5
    //   AI dojrzałość:          0%       -> 0 on DRD 1..5 (unassessed)
    // -----------------------------------------------------------------------
    const axisActual: Record<number, number> = {
      1: 2.6,
      2: 2.6,
      3: 0.8,
      4: 2.6,
      5: scale06to05(5.2),
      6: scale06to05(0.8),
      7: 0,
    };
    const axisPercent: Record<string, number> = {
      processes: 37,
      products: 52,
      businessModels: 16,
      culture: 87,
      data: 37,
      cybersecurity: 13,
      ai: 0,
      overall: 40,
    };

    // Build full DRD area answers.
    // Where the PDF provides sub-area scores (e.g. Sales=4, Marketing=2),
    // we map them to DRD area IDs 1A..7E. Otherwise we distribute axis averages.
    const areaOverrides: Record<string, number> = {
      // Axis 1 (Digitalizacja procesów) – scores shown as: Sprzedaż, Marketing, Technologia, Zakupy, Logistyka, Produkcja, Jakość, Finanse, HRM
      '1A': 4,
      '1B': 2,
      '1C': 2,
      '1D': 1,
      '1E': 1,
      '1F': 4,
      '1G': 3,
      '1H': 3,
      '1I': 3,

      // Axis 2 (Digitalne produkty)
      '2A': 3, // Produkty w formie elektronicznej
      '2B': 2, // Produkty oparte na społeczności
      '2C': 3, // Produkty oparte na ICT
      '2D': 2, // Dopasowanie produktu do oczekiwań klienta
      '2E': 3, // Możliwość skalowania produktu

      // Axis 3 (Digitalne modele biznesowe)
      '3A': 1, // Model e-commerce
      '3B': 1, // Modele platformowe
      '3C': 0, // As a services
      '3D': 1, // Współdzielenie aktywów
      '3E': 1, // Monetyzacja danych

      // Axis 4 (Zarządzanie danymi)
      '4A': 1, // Zbieranie danych
      '4B': 4, // Przechowywanie danych
      '4C': 5, // Komunikacja danych
      '4D': 2, // Analizy Big Data
      '4E': 1, // Komputing

      // Axis 5 (Kultura transformacji) – values in report are 0..6, mapped to 0..5
      '5A': scale06to05(5), // Style przywództwa
      '5B': scale06to05(4), // Gotowość do zmiany
      '5C': scale06to05(5), // Stałe doskonalenie
      '5D': scale06to05(6), // Kultura innowacyjności
      '5E': scale06to05(6), // Dostępność zasobów

      // Axis 6 (Cyberbezpieczeństwo) – values in report are 0..6, mapped to 0..5
      '6A': scale06to05(0), // Strategia i zarządzanie ryzykiem
      '6B': scale06to05(2), // Ochrona sieci i systemów
      '6C': scale06to05(2), // Ochrona danych
      '6D': scale06to05(0), // Edukacja i system jakości
      '6E': scale06to05(0), // Plan awaryjny
    };

    const areas: Record<
      string,
      { achievedLevel: number; targetLevel: number; levelNotes: Record<string, string> }
    > = {};
    for (const axis of DRD_STRUCTURE) {
      for (const area of axis.areas) {
        const achieved =
          areaOverrides[area.id] !== undefined ? Number(areaOverrides[area.id]) : Number(axisActual[axis.id] ?? 0);
        const target = achieved;
        areas[area.id] = { achievedLevel: achieved, targetLevel: target, levelNotes: {} };
      }
    }

    const answersJson = { drd: { areas } };
    const scoreSummary = {
      overallPercent: axisPercent.overall,
      axes: Object.fromEntries(
        DRD_STRUCTURE.map((ax) => [
          String(ax.id),
          { actual: Number(axisActual[ax.id] ?? 0), target: Number(axisActual[ax.id] ?? 0) },
        ])
      ),
    };

    const contextSnapshot = {
      importedFrom: path.basename(PDF_SOURCE_PATH),
      importKind: 'manual_seed',
      reportDate: '2025-12',
      organizationName: orgName,
      axisPercent,
      axisActual,
      areaOverrides,
    };

    const frameworkData = {
      progress: 100,
      overallScore: axisPercent.overall,
      axisPercent,
      axisActual,
      importedReportId: IMPORT_ID,
      importedFrom: path.basename(PDF_SOURCE_PATH),
      reportDate: '2025-12',
    };

    // -----------------------------------------------------------------------
    // Upsert assessment
    // -----------------------------------------------------------------------
    const assessmentName = `DRD – Plast-Met Centrum (Grudzień 2025)`;
    const assessmentDescription = `Wyniki wypełnione na podstawie raportu PDF: "${path.basename(
      PDF_SOURCE_PATH
    )}".`;

    await q(
      `INSERT INTO assessments (
         id,
         organization_id,
         project_id,
         name,
         description,
         status,
         framework_type,
         framework_data,
         assessment_type,
         completion_percent,
         confidence_avg,
         answers_json,
         score_summary,
         context_snapshot,
         created_by,
         updated_by,
         created_at,
         updated_at,
         type,
         framework,
         overall_score
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW(),$17,$18,$19
       )
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         project_id = EXCLUDED.project_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         status = EXCLUDED.status,
         framework_type = EXCLUDED.framework_type,
         framework_data = EXCLUDED.framework_data,
         assessment_type = EXCLUDED.assessment_type,
         completion_percent = EXCLUDED.completion_percent,
         confidence_avg = EXCLUDED.confidence_avg,
         answers_json = EXCLUDED.answers_json,
         score_summary = EXCLUDED.score_summary,
         context_snapshot = EXCLUDED.context_snapshot,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW(),
         type = EXCLUDED.type,
         framework = EXCLUDED.framework,
         overall_score = EXCLUDED.overall_score`,
      [
        ASSESSMENT_ID,
        ORG_ID,
        null,
        assessmentName,
        assessmentDescription,
        'APPROVED',
        'DRD',
        toPgJson(frameworkData),
        'DRD',
        100,
        4.0,
        JSON.stringify(answersJson),
        JSON.stringify(scoreSummary),
        JSON.stringify(contextSnapshot),
        userId,
        userId,
        'DRD',
        'DRD',
        axisPercent.overall,
      ]
    );

    // -----------------------------------------------------------------------
    // Copy PDF into server uploads and upsert imported report linked to assessment
    // -----------------------------------------------------------------------
    if (!fs.existsSync(PDF_SOURCE_PATH)) {
      throw new Error(`PDF not found: ${PDF_SOURCE_PATH}`);
    }
    const uploadsDir = path.resolve(process.cwd(), 'server', 'uploads', 'imports');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const destFileName = `${IMPORT_ID}_${path.basename(PDF_SOURCE_PATH)}`;
    const destPath = path.join(uploadsDir, destFileName);
    fs.copyFileSync(PDF_SOURCE_PATH, destPath);
    const stat = fs.statSync(destPath);

    const importExtractedData = {
      framework: 'DRD',
      confidence: 100,
      metadata: {
        sourceFileName: path.basename(PDF_SOURCE_PATH),
        organizationName: orgName,
        assessmentDate: '2025-12',
      },
      // Keep initiatives empty to avoid accidental duplicate creation from the UI button.
      initiatives: [],
      scores: {
        axes: Object.fromEntries(
          DRD_STRUCTURE.map((ax) => [
            String(ax.id),
            { actual: Number(axisActual[ax.id] ?? 0), target: Number(axisActual[ax.id] ?? 0) },
          ])
        ),
        areas: {},
        overallScore: axisPercent.overall,
      },
      extractionDetails: {
        fieldsFound: DRD_STRUCTURE.map((ax) => `Axis ${ax.id}`),
        fieldsMissing: [],
        warnings: [],
        rawTextLength: 0,
        extractionMethod: 'manual_seed',
      },
      coveragePercent: 100,
    };

    await q(
      `INSERT INTO imported_reports (
         id,
         organization_id,
         project_id,
         source_file_name,
         source_file_path,
         source_file_size,
         source_format,
         detected_framework,
         detection_confidence,
         extracted_data_json,
         extraction_details_json,
         document_metadata_json,
         target_type,
         target_id,
         status,
         processing_error,
         processing_log,
         created_by,
         created_at,
         updated_at,
         processed_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),NOW(),NOW()
       )
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         project_id = EXCLUDED.project_id,
         source_file_name = EXCLUDED.source_file_name,
         source_file_path = EXCLUDED.source_file_path,
         source_file_size = EXCLUDED.source_file_size,
         source_format = EXCLUDED.source_format,
         detected_framework = EXCLUDED.detected_framework,
         detection_confidence = EXCLUDED.detection_confidence,
         extracted_data_json = EXCLUDED.extracted_data_json,
         extraction_details_json = EXCLUDED.extraction_details_json,
         document_metadata_json = EXCLUDED.document_metadata_json,
         target_type = EXCLUDED.target_type,
         target_id = EXCLUDED.target_id,
         status = EXCLUDED.status,
         processing_error = EXCLUDED.processing_error,
         processing_log = EXCLUDED.processing_log,
         updated_at = NOW(),
         processed_at = NOW()`,
      [
        IMPORT_ID,
        ORG_ID,
        null,
        path.basename(PDF_SOURCE_PATH),
        destPath,
        stat.size,
        'pdf',
        'DRD',
        100,
        JSON.stringify(importExtractedData),
        JSON.stringify(importExtractedData.extractionDetails),
        JSON.stringify(importExtractedData.metadata),
        'assessment',
        ASSESSMENT_ID,
        'completed',
        null,
        'Seeded for client demo',
        userId,
      ]
    );

    // -----------------------------------------------------------------------
    // Upsert initiatives (29 items)
    // -----------------------------------------------------------------------
    const initiatives: Array<{ code: string; title: string; description: string; priority: string }> = [
      // Program 1: Fundament
      {
        code: '1.1',
        title: 'Wdrożenie projektowego podejścia do zarządzania zmianą',
        description:
          'Wdrożenie lekkiej metodyki zarządzania projektami (np. PRINCE2/PMBoK) z jasnymi rolami, cyklem życia projektu, statusami i repozytorium dokumentów (np. Teams/SharePoint).',
        priority: 'critical',
      },
      {
        code: '1.2',
        title: 'Utworzenie Biura Zarządzania Transformacją (TMO)',
        description:
          'Powołanie TMO jako właściciela portfela transformacji: governance, priorytetyzacja, monitoring KPI, wsparcie liderów oraz raportowanie do zarządu.',
        priority: 'high',
      },
      {
        code: '1.3',
        title: 'System zarządzania portfelem inicjatyw',
        description:
          'Ustandaryzowanie kart inicjatyw, zależności, budżetów i postępu w jednym narzędziu (portfolio view + roadmap) z cyklicznymi przeglądami steering committee.',
        priority: 'medium',
      },
      // Program 2: Cyfrowy kręgosłup
      {
        code: '2.1',
        title: 'Standaryzacja Master Data Management (MDM)',
        description:
          'Ujednolicenie kluczowych danych podstawowych (klienci, produkty, cenniki, BOM) oraz reguł jakości danych; przygotowanie pod integracje ERP/MES/CRM.',
        priority: 'critical',
      },
      {
        code: '2.2',
        title: 'Platforma Business Intelligence i Analytics',
        description:
          'Wdrożenie warstwy raportowej i dashboardów (marża, OEE, rotacja, sprzedaż) opartej na spójnych danych i jednym źródle prawdy.',
        priority: 'critical',
      },
      {
        code: '2.3',
        title: 'Enterprise Service Bus (ESB) – integracja systemów',
        description:
          'Zbudowanie warstwy integracyjnej (API/ESB) łączącej konfiguratory, ERP, MES i inne systemy w celu eliminacji ręcznych przepływów danych.',
        priority: 'high',
      },
      {
        code: '2.4',
        title: 'Data Lake dla Advanced Analytics',
        description:
          'Utworzenie jeziora danych dla analityki zaawansowanej (predykcje, ML), w tym dane produkcyjne, sprzedażowe i operacyjne.',
        priority: 'low',
      },
      // Program 3: Doskonałość operacyjna
      {
        code: '3.1',
        title: 'Value Stream Mapping i Lean Manufacturing – pilot bramy',
        description:
          'Mapowanie strumienia wartości i eliminacja marnotrawstwa na pilotażowym procesie (brama) jako baza do automatyzacji i standaryzacji.',
        priority: 'critical',
      },
      {
        code: '3.2',
        title: 'Automatyzacja Order-to-Cash (Konfigurator → ERP → MES)',
        description:
          'Automatyzacja przepływu informacji od konfiguracji zamówienia do planowania i realizacji produkcji, redukcja błędów i skrócenie lead time.',
        priority: 'critical',
      },
      {
        code: '3.3',
        title: 'Zaawansowany WMS z RFID',
        description:
          'Wdrożenie WMS z lokalizacjami i RFID dla optymalizacji zapasów, kompletacji i logistyki wewnętrznej, ograniczenie zamrożonego kapitału.',
        priority: 'critical',
      },
      {
        code: '3.4',
        title: 'Manufacturing Execution System (MES) – rozbudowa',
        description:
          'Rozszerzenie MES o lepszy Shop Floor Control, integrację jakości, OEE i pętlę informacji zwrotnej (quality → produkcja).',
        priority: 'high',
      },
      {
        code: '3.5',
        title: 'Product Lifecycle Management (PLM)',
        description:
          'Ustandaryzowanie zarządzania dokumentacją techniczną i zmianami produktu; skrócenie time-to-market i centralizacja wiedzy produktowej.',
        priority: 'high',
      },
      // Program 4: Inteligentna produkcja
      {
        code: '4.1',
        title: 'Industrial IoT – monitoring maszyn w czasie rzeczywistym',
        description:
          'Pozyskanie danych z maszyn/sensorów i ich bieżąca wizualizacja w celu poprawy dostępności, jakości i wydajności.',
        priority: 'medium',
      },
      {
        code: '4.2',
        title: 'Predictive Maintenance System',
        description:
          'Predykcja awarii na podstawie danych z maszyn, redukcja przestojów i lepsze planowanie utrzymania ruchu.',
        priority: 'medium',
      },
      {
        code: '4.3',
        title: 'Digital Twin dla kluczowych produktów',
        description:
          'Cyfrowy bliźniak dla wybranych produktów/procesów do symulacji, testów i optymalizacji przed wdrożeniem zmian.',
        priority: 'low',
      },
      {
        code: '4.4',
        title: 'AI‑powered Quality Control System',
        description:
          'Wykorzystanie AI/wizji komputerowej do automatycznej kontroli jakości i szybszego wykrywania odchyleń.',
        priority: 'low',
      },
      // Program 5: Tarcza cyfrowa
      {
        code: '5.1',
        title: 'KSeF i automatyzacja obiegu dokumentów',
        description:
          'Dostosowanie procesów i systemów do KSeF oraz automatyzacja workflow dokumentów (akceptacje, OCR, ścieżki audytu).',
        priority: 'critical',
      },
      {
        code: '5.2',
        title: 'Backup, Disaster Recovery i Business Continuity',
        description:
          'Wdrożenie strategii kopii zapasowych, procedur DR/BCP i testów odtwarzania dla zapewnienia ciągłości działania.',
        priority: 'critical',
      },
      {
        code: '5.3',
        title: 'Security Operations Center (SOC) i SIEM',
        description:
          'Uruchomienie monitoringu bezpieczeństwa (SOC/SIEM), detekcja incydentów i reagowanie (w tym IT/OT).',
        priority: 'high',
      },
      {
        code: '5.4',
        title: 'Certyfikacja ISO 27001',
        description:
          'Przygotowanie i wdrożenie SZBI pod ISO 27001 (polityki, role, procesy, audyty) jako element dojrzałości i wiarygodności.',
        priority: 'low',
      },
      {
        code: '5.5',
        title: 'Compliance Framework (NIS2, RODO, inne)',
        description:
          'Zbudowanie ram zgodności regulacyjnej (NIS2/RODO) i „security by design” dla wszystkich nowych wdrożeń cyfrowych.',
        priority: 'critical',
      },
      // Program 6: Ekosystem rynkowy
      {
        code: '6.1',
        title: 'Platforma OroCommerce – pełne wdrożenie B2B',
        description:
          'Rozwój kanału B2B w kierunku platformy cyfrowej (zamówienia, statusy, integracje, onboarding partnerów) dla skalowania eksportu.',
        priority: 'critical',
      },
      {
        code: '6.2',
        title: 'Freemium model dla PM Ogrodzenia',
        description:
          'Rozszerzenie narzędzi partnerskich o model freemium i dodatkowe funkcje (np. tracking zamówień, usługi dodane) zwiększające adopcję.',
        priority: 'medium',
      },
      {
        code: '6.3',
        title: 'Market Intelligence as a Service dla partnerów',
        description:
          'Usługi analityczne/benchmarking dla partnerów oparte na danych sprzedażowych i rynkowych, jako dodatkowy strumień wartości.',
        priority: 'low',
      },
      {
        code: '6.4',
        title: 'Ekosystem PLAST‑MET Connect (Marketplace)',
        description:
          'Budowa ekosystemu/marketplace wokół produktu fizycznego (usługi komplementarne: finansowanie, montaż, logistyka) i efekty sieciowe.',
        priority: 'low',
      },
      // Program 7: Ludzie i kultura
      {
        code: '7.1',
        title: 'Program Transformation Champions',
        description:
          'Wyłonienie i przygotowanie liderów średniego szczebla do prowadzenia autonomicznych inicjatyw transformacyjnych i kaskadowania zmiany.',
        priority: 'critical',
      },
      {
        code: '7.2',
        title: 'Akademia kompetencji cyfrowych',
        description:
          'Program szkoleń dla kluczowych ról (dane, procesy, narzędzia) – wsparcie adopcji nowych systemów i przejścia do Data‑Driven.',
        priority: 'critical',
      },
      {
        code: '7.3',
        title: 'System zarządzania wiedzą (Knowledge Management)',
        description:
          'Repozytorium wiedzy procesowej i technicznej (standardy, instrukcje, decyzje) redukujące zależność od wiedzy jednostek.',
        priority: 'high',
      },
      {
        code: '7.4',
        title: 'Program ciągłego doskonalenia (Kaizen)',
        description:
          'Mechanizmy zgłaszania usprawnień, standaryzacja i cykliczne przeglądy – utrzymanie tempa innowacji i poprawy efektywności.',
        priority: 'high',
      },
    ];

    for (const init of initiatives) {
      const initiativeId = `init-plastmet-${init.code.replace(/\./g, '-')}`;
      const title = `[${init.code}] ${init.title}`;
      const now = new Date().toISOString();
      await q(
        `INSERT INTO initiatives (
           id,
           organization_id,
           project_id,
           name,
           title,
           summary,
           description,
           priority,
           status,
           source_type,
           source_id,
           created_from,
           tags,
           created_by,
           created_at,
           updated_at,
           source_assessment_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
         )
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           title = EXCLUDED.title,
           summary = EXCLUDED.summary,
           description = EXCLUDED.description,
           priority = EXCLUDED.priority,
           status = EXCLUDED.status,
           source_type = EXCLUDED.source_type,
           source_id = EXCLUDED.source_id,
           created_from = EXCLUDED.created_from,
           tags = EXCLUDED.tags,
           updated_at = EXCLUDED.updated_at,
           source_assessment_id = EXCLUDED.source_assessment_id`,
        [
          initiativeId,
          ORG_ID,
          null,
          title,
          title,
          init.description.slice(0, 240),
          init.description,
          init.priority,
          'PENDING_REVIEW',
          'assessment',
          ASSESSMENT_ID,
          'MANUAL',
          JSON.stringify(['plast-met', 'pdf', 'drd', 'imported']),
          userId,
          now,
          now,
          ASSESSMENT_ID,
        ]
      );
    }

    // Mark assessment with initiatives count (best-effort).
    await q(
      `UPDATE assessments SET initiatives_generated = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3`,
      [initiatives.length, userId, ASSESSMENT_ID]
    );

    // Print a small summary (no secrets).
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ok: true,
          organizationId: ORG_ID,
          assessmentId: ASSESSMENT_ID,
          importedReportId: IMPORT_ID,
          initiativesCount: initiatives.length,
          pdfStoredAt: destPath,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[seed-plastmet] Failed:', e?.message || e);
  process.exitCode = 1;
});

