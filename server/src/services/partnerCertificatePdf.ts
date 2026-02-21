import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

export async function generatePartnerCertificatePdf(params: {
  certificateId: string;
  partnerOrgName: string;
  userName: string;
  certificateType: string;
  earnedAt: string;
  language?: 'en' | 'pl';
}): Promise<Buffer> {
  const language = params.language === 'pl' ? 'pl' : 'en';
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
  const endPromise = new Promise<Buffer>((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  doc.pipe(stream);

  const title = language === 'pl' ? 'Certyfikat Partnera' : 'Partner Certificate';
  const subtitle =
    params.certificateType === 'sales'
      ? language === 'pl'
        ? 'Certyfikacja sprzedażowa'
        : 'Sales Certification'
      : params.certificateType;

  doc.rect(0, 0, doc.page.width, 140).fill('#4F46E5');
  doc.fillColor('#FFFFFF').fontSize(28).text(title, 48, 54);

  doc.moveDown(6);
  doc.fillColor('#0f172a').fontSize(20).text(subtitle, { align: 'center' });
  doc.moveDown(1);

  doc
    .fontSize(12)
    .fillColor('#334155')
    .text(
      language === 'pl'
        ? `Przyznano dla: ${params.userName || 'User'}`
        : `Awarded to: ${params.userName || 'User'}`,
      { align: 'center' }
    );
  doc
    .fontSize(12)
    .fillColor('#334155')
    .text(
      language === 'pl'
        ? `Organizacja partnerska: ${params.partnerOrgName}`
        : `Partner organization: ${params.partnerOrgName}`,
      { align: 'center' }
    );
  doc.moveDown(1);

  const earned = new Date(params.earnedAt).toLocaleDateString();
  doc
    .fontSize(11)
    .fillColor('#64748b')
    .text(language === 'pl' ? `Data: ${earned}` : `Date: ${earned}`, { align: 'center' });
  doc.moveDown(2);

  doc
    .fontSize(10)
    .fillColor('#94a3b8')
    .text(`Certificate ID: ${params.certificateId}`, { align: 'center' });

  doc.end();
  return endPromise;
}
