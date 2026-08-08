import type PDFKit from 'pdfkit';

/**
 * Draw a presentation footer inside PDFKit's printable area.
 *
 * PDFKit automatically adds a page when text starts below `page.maxY()`. The
 * old route used `page.height - 42` with a 48pt margin, which placed the footer
 * six points outside that area and turned a 10-slide export into 17 pages.
 */
export function drawPresentationPdfFooter(
  doc: PDFKit.PDFDocument,
  text: string,
  margin: number
): void {
  const y = doc.page.height - margin - 10;
  doc
    .fillColor('#666')
    .fontSize(8)
    .text(text, margin, y, {
      width: doc.page.width - margin * 2,
      align: 'center',
      lineBreak: false,
    });
}
