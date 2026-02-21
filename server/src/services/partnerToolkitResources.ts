import fs from 'fs';
import JSZip from 'jszip';
import path from 'path';
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';
import { PassThrough } from 'stream';

export type PartnerResourceLanguage = 'en' | 'pl';

export interface GeneratedResourceFile {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

function toLanguage(lang: unknown): PartnerResourceLanguage {
  return lang === 'pl' ? 'pl' : 'en';
}

async function renderPdfToBuffer(build: (doc: PDFDocument) => void): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));

  const endPromise = new Promise<Buffer>((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  doc.pipe(stream);
  build(doc);
  doc.end();

  return endPromise;
}

function safeReadFile(absPath: string): Buffer | null {
  try {
    return fs.readFileSync(absPath);
  } catch {
    return null;
  }
}

function listFiles(absDir: string, pattern: RegExp): string[] {
  try {
    return fs
      .readdirSync(absDir)
      .filter((f) => pattern.test(f))
      .map((f) => path.join(absDir, f));
  } catch {
    return [];
  }
}

function buildServerOrigin(): string {
  const port = process.env.PORT || '3005';
  const base = process.env.PUBLIC_API_ORIGIN || `http://localhost:${port}`;
  return base.replace(/\/$/, '');
}

export async function generatePartnerToolkitResourceFile(params: {
  fileKey: string;
  language?: PartnerResourceLanguage;
  fileNameHint?: string | null;
}): Promise<GeneratedResourceFile> {
  const language = toLanguage(params.language);
  const fileKey = params.fileKey;

  if (fileKey === 'generated:email_pack') {
    const content =
      language === 'pl'
        ? [
            'Consultify — pakiet szablonów email (v1)',
            '',
            '1) Cold outbound',
            'Temat: {Company} — krótkie pytanie o decyzje i governance',
            '',
            'Cześć {FirstName},',
            '... (używaj bezpiecznych claimów; unikaj obietnic ROI).',
            '',
            '2) Follow‑up (3 dni)',
            '3) Post‑demo / trial nudge',
            '',
            'Compliance: dodaj wyraźny opt‑out i działaj zgodnie z lokalnym prawem.',
          ].join('\n')
        : [
            'Consultify — email templates pack (v1)',
            '',
            '1) Cold outbound',
            'Subject: {Company} — quick question on governance & decisions',
            '',
            'Hi {FirstName},',
            '... (use safe claims; avoid guaranteed ROI).',
            '',
            '2) Follow‑up (3 days)',
            '3) Post‑demo / trial nudge',
            '',
            'Compliance: include a clear opt‑out and follow local regulations.',
          ].join('\n');

    return {
      buffer: Buffer.from(content, 'utf8'),
      fileName:
        params.fileNameHint ||
        (language === 'pl' ? 'consultify-email-pack-pl-v1.txt' : 'consultify-email-pack-en-v1.txt'),
      mimeType: 'text/plain',
    };
  }

  if (fileKey === 'generated:sales_deck') {
    const pptx = new (PptxGenJS as any)();
    pptx.layout = 'LAYOUT_WIDE';

    const title =
      language === 'pl' ? 'Consultify — Deck partnerski' : 'Consultify — Partner Sales Deck';
    const subtitle =
      language === 'pl'
        ? 'Bezpieczne claimy • discovery-first • evidence-backed'
        : 'Safe claims • discovery-first • evidence-backed';

    const slide1 = pptx.addSlide();
    slide1.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.33,
      h: 7.5,
      fill: { color: '4F46E5' },
    });
    slide1.addText(title, {
      x: 0.7,
      y: 2.4,
      w: 12,
      h: 1,
      fontFace: 'Aptos Display',
      fontSize: 36,
      color: 'FFFFFF',
      bold: true,
    });
    slide1.addText(subtitle, {
      x: 0.7,
      y: 3.4,
      w: 12,
      h: 0.6,
      fontFace: 'Aptos',
      fontSize: 16,
      color: 'EDE9FE',
    });

    const slide2 = pptx.addSlide();
    slide2.addText(language === 'pl' ? 'Co to jest Consultify?' : 'What is Consultify?', {
      x: 0.7,
      y: 0.6,
      w: 12,
      h: 0.6,
      fontFace: 'Aptos Display',
      fontSize: 26,
      color: '0F172A',
      bold: true,
    });
    const bullets =
      language === 'pl'
        ? [
            'Pomaga prowadzić uporządkowane discovery i uzgodnienia w programach transformacji.',
            'Ułatwia pracę evidence‑backed: fakty, niewiadome, insighty i decyzje.',
            'Wspiera governance bez “over‑claimingu” automatyzacji.',
          ]
        : [
            'Helps run structured discovery and alignment in transformation programs.',
            'Supports evidence‑backed work: facts, unknowns, insights and decisions.',
            'Augments governance without over-claiming automation.',
          ];
    slide2.addText(bullets.map((b) => `• ${b}`).join('\n'), {
      x: 1.0,
      y: 1.6,
      w: 11.5,
      h: 5.2,
      fontFace: 'Aptos',
      fontSize: 18,
      color: '334155',
      valign: 'top',
    });

    const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
    return {
      buffer,
      fileName:
        params.fileNameHint ||
        (language === 'pl'
          ? 'consultify-sales-deck-pl-v1.pptx'
          : 'consultify-sales-deck-en-v1.pptx'),
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
  }

  if (fileKey === 'generated:brand_kit_zip') {
    const zip = new JSZip();
    const logosDir = path.resolve(process.cwd(), 'public', 'assets', 'logos');
    const logoFiles = listFiles(logosDir, /\.(png|svg)$/i);

    const rules =
      language === 'pl'
        ? [
            'Consultify — Brand kit (v1)',
            '',
            'Zasady użycia:',
            '- Nie zmieniaj proporcji logo.',
            '- Zachowaj margines/oddech.',
            '- Używaj “Partner badge” tylko przy aktywnej współpracy.',
          ].join('\n')
        : [
            'Consultify — Brand kit (v1)',
            '',
            'Usage rules:',
            '- Do not distort logo aspect ratio.',
            '- Keep clear space around the mark.',
            '- Use the “Partner badge” only with an active partnership.',
          ].join('\n');

    zip.file('README.txt', rules);
    zip.file(
      'partner-badge.svg',
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200"><rect width="640" height="200" rx="24" fill="#4F46E5"/><text x="40" y="120" font-family="Arial" font-size="64" fill="#fff">Consultify Partner</text></svg>`
    );

    for (const absPath of logoFiles) {
      const data = safeReadFile(absPath);
      if (!data) continue;
      zip.file(path.join('logos', path.basename(absPath)), data);
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    return {
      buffer,
      fileName: params.fileNameHint || 'consultify-brand-kit-v1.zip',
      mimeType: 'application/zip',
    };
  }

  if (fileKey === 'generated:screenshots_zip') {
    const zip = new JSZip();
    const shotsDir = path.resolve(process.cwd(), 'public', 'screenshots');
    const screenshotFiles = listFiles(shotsDir, /\.(png|jpg|jpeg)$/i).slice(0, 40);
    for (const absPath of screenshotFiles) {
      const data = safeReadFile(absPath);
      if (!data) continue;
      zip.file(path.join('screenshots', path.basename(absPath)), data);
    }
    zip.file(
      'README.txt',
      language === 'pl'
        ? 'Zrzuty ekranu Consultify — używaj zgodnie z zasadami partnera.'
        : 'Consultify screenshots — use according to partner rules.'
    );
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    return {
      buffer,
      fileName: params.fileNameHint || 'consultify-screenshots-v1.zip',
      mimeType: 'application/zip',
    };
  }

  if (
    fileKey === 'generated:one_pager' ||
    fileKey === 'generated:discovery_script' ||
    fileKey === 'generated:case_study_pack'
  ) {
    const titles: Record<string, { en: string; pl: string }> = {
      'generated:one_pager': {
        en: 'Consultify — Product One‑pager',
        pl: 'Consultify — One‑pager produktu',
      },
      'generated:discovery_script': {
        en: 'Consultify — Discovery Call Script',
        pl: 'Consultify — Skrypt rozmowy discovery',
      },
      'generated:case_study_pack': {
        en: 'Consultify — Case Study Pack',
        pl: 'Consultify — Pakiet Case Study',
      },
    };

    const bodyText =
      fileKey === 'generated:one_pager'
        ? language === 'pl'
          ? [
              'Cel: szybki overview dla klienta B2B.',
              '',
              'Bezpieczne claimy:',
              '• Pomaga uporządkować discovery i uzgodnić kryteria sukcesu.',
              '• Wspiera dokumentowanie faktów, niewiadomych i insightów.',
              '• Augmentuje governance (nie “zastępuje” PMO).',
              '',
              'Następny krok: umów 30‑min call discovery.',
            ].join('\n')
          : [
              'Goal: quick B2B overview.',
              '',
              'Safe claims:',
              '• Helps structure discovery and align success criteria.',
              '• Supports documenting facts, unknowns and insights.',
              '• Augments governance (does not “replace” the PMO).',
              '',
              'Next step: schedule a 30-min discovery call.',
            ].join('\n')
        : fileKey === 'generated:discovery_script'
          ? language === 'pl'
            ? [
                '1) Kontekst',
                '• Jakie decyzje są dziś najwolniejsze/sporne?',
                '• Kto jest ownerem governance? (COO/PMO/CFO)',
                '',
                '2) Pain points',
                '• Gdzie giną fakty i ustalenia?',
                '• Jak mierzycie postęp?',
                '',
                '3) Next steps',
                '• Uzgodnijmy kryteria sukcesu dla trialu.',
              ].join('\n')
            : [
                '1) Context',
                '• Which decisions are currently slowest or most contested?',
                '• Who owns governance? (COO/PMO/CFO)',
                '',
                '2) Pain points',
                '• Where do facts and agreements get lost?',
                '• How do you measure progress today?',
                '',
                '3) Next steps',
                '• Agree on measurable success criteria for a trial.',
              ].join('\n')
          : language === 'pl'
            ? [
                'Szablon Case Study',
                '',
                '1) Tło / kontekst',
                '2) Problem',
                '3) Podejście (facts-only, evidence-backed)',
                '4) Rezultat (bez gwarantowanych %; opis jakościowy + metryki jeśli potwierdzone)',
                '5) Quote',
              ].join('\n')
            : [
                'Case Study Template',
                '',
                '1) Background',
                '2) Problem',
                '3) Approach (facts-only, evidence-backed)',
                '4) Outcome (no guaranteed %; qualitative + verified metrics)',
                '5) Quote',
              ].join('\n');

    const pdfBuffer = await renderPdfToBuffer((doc) => {
      doc.fontSize(22).fillColor('#0f172a').text(titles[fileKey][language], { align: 'left' });
      doc.moveDown(0.8);
      doc.fontSize(10).fillColor('#64748b').text(`Generated: ${new Date().toLocaleDateString()}`);
      doc.moveDown(1.2);
      doc.fontSize(12).fillColor('#334155').text(bodyText, { lineGap: 4 });
      doc.moveDown(1.2);
      doc
        .fontSize(9)
        .fillColor('#94a3b8')
        .text(
          language === 'pl'
            ? 'Uwaga: używaj wyłącznie claimów zgodnych z produktem.'
            : 'Note: use only product-accurate, safe claims.'
        );
    });

    return {
      buffer: pdfBuffer,
      fileName:
        params.fileNameHint ||
        (fileKey === 'generated:one_pager'
          ? language === 'pl'
            ? 'consultify-one-pager-pl-v1.pdf'
            : 'consultify-one-pager-en-v1.pdf'
          : fileKey === 'generated:discovery_script'
            ? language === 'pl'
              ? 'consultify-discovery-script-pl-v1.pdf'
              : 'consultify-discovery-script-en-v1.pdf'
            : language === 'pl'
              ? 'consultify-case-study-pack-pl-v1.pdf'
              : 'consultify-case-study-pack-en-v1.pdf'),
      mimeType: 'application/pdf',
    };
  }

  const origin = buildServerOrigin();
  const msg = `Unknown partner resource file_key: ${fileKey}`;
  const buffer = Buffer.from(
    language === 'pl'
      ? `Nie można wygenerować pliku.\n\n${msg}\n\nKontakt: ${origin}`
      : `Unable to generate file.\n\n${msg}\n\nContact: ${origin}`,
    'utf8'
  );
  return {
    buffer,
    fileName: params.fileNameHint || 'resource.txt',
    mimeType: 'text/plain',
  };
}
