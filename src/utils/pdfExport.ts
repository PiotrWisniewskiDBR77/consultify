import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ExportOptions {
  filename?: string;
  title?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Export an HTML element as PDF using html2canvas and jspdf
 * @param elementId - The ID of the HTML element to export
 * @param options - Export options
 */
export async function exportToPDF(elementId: string, options: ExportOptions = {}): Promise<void> {
  const { filename = 'report.pdf', title, orientation = 'portrait' } = options;

  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  // Create canvas from HTML element
  const canvas = await html2canvas(element, {
    scale: 2, // Higher resolution
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png');

  // Calculate dimensions
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  // Calculate image dimensions maintaining aspect ratio
  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Add title if provided
  let yOffset = margin;
  if (title) {
    pdf.setFontSize(16);
    pdf.setTextColor(51, 51, 51);
    pdf.text(title, margin, yOffset + 5);
    yOffset += 15;
  }

  // Add generation timestamp
  pdf.setFontSize(9);
  pdf.setTextColor(128, 128, 128);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yOffset);
  yOffset += 10;

  // Handle multi-page if content is tall
  const position = yOffset;
  let remainingHeight = imgHeight;
  const availableHeight = pageHeight - yOffset - margin;

  // First page
  const firstPageHeight = Math.min(imgHeight, availableHeight);
  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');

  // Add additional pages if needed
  remainingHeight -= availableHeight;
  while (remainingHeight > 0) {
    pdf.addPage();

    // Calculate clip position for this page
    const clipY = imgHeight - remainingHeight;
    const pageImgHeight = Math.min(remainingHeight, pageHeight - 2 * margin);

    pdf.addImage(imgData, 'PNG', margin, margin - clipY, imgWidth, imgHeight, undefined, 'FAST');

    remainingHeight -= pageHeight - margin * 2;
  }

  // Add footer to each page
  const totalPages = pdf.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${i} of ${totalPages} • Consultinity`, pageWidth - margin, pageHeight - 5, {
      align: 'right',
    });
  }

  // Download PDF
  pdf.save(filename);
}

/**
 * Check if PDF export is allowed based on organization type
 * @param orgType - The organization type (DEMO, TRIAL, PAID)
 * @returns boolean indicating if export is allowed
 */
export function canExportPDF(orgType: string): boolean {
  if (orgType === 'DEMO') {
    return false;
  }
  return true;
}

/**
 * Get the export limit for trial organizations
 * @returns number of allowed exports for trial
 */
export function getTrialExportLimit(): number {
  return 3; // Configurable limit for trial accounts
}

interface ConversationMessage {
  role: string;
  content: string;
  timestamp?: string | Date;
}

interface ConversationExportOptions {
  title?: string;
  filename?: string;
}

/**
 * Export a conversation (chat messages) to PDF
 * @param messages - Array of conversation messages
 * @param options - Export options including title and filename
 */
export async function exportConversationToPDF(
  messages: ConversationMessage[],
  options: ConversationExportOptions = {}
): Promise<void> {
  const { title = 'Conversation Export', filename = 'conversation.pdf' } = options;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Add title
  pdf.setFontSize(18);
  pdf.setTextColor(51, 51, 51);
  pdf.text(title, margin, yPosition);
  yPosition += 10;

  // Add generation timestamp
  pdf.setFontSize(9);
  pdf.setTextColor(128, 128, 128);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
  yPosition += 8;

  // Add divider
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Set font for messages
  pdf.setFontSize(10);
  pdf.setTextColor(51, 51, 51);

  // Process each message
  for (const message of messages) {
    const role = message.role || 'unknown';
    const content = message.content || '';
    const timestamp = message.timestamp
      ? new Date(message.timestamp).toLocaleString()
      : undefined;

    // Check if we need a new page
    const estimatedHeight = pdf.getTextDimensions(content, {
      maxWidth: contentWidth,
    }).h;
    if (yPosition + estimatedHeight + 15 > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }

    // Role label
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    const roleLabel = role === 'user' ? 'User' : role === 'assistant' ? 'Assistant' : role;
    pdf.text(roleLabel, margin, yPosition);
    if (timestamp) {
      pdf.text(timestamp, pageWidth - margin - pdf.getTextWidth(timestamp), yPosition, {
        align: 'right',
      });
    }
    yPosition += 5;

    // Message content
    pdf.setFontSize(10);
    pdf.setTextColor(51, 51, 51);
    const lines = pdf.splitTextToSize(content, contentWidth);
    pdf.text(lines, margin, yPosition);
    yPosition += lines.length * 5 + 5;

    // Add spacing between messages
    yPosition += 3;
  }

  // Add footer to each page
  const totalPages = pdf.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${i} of ${totalPages} • Consultinity`, pageWidth - margin, pageHeight - 5, {
      align: 'right',
    });
  }

  // Download PDF
  pdf.save(filename);
}
