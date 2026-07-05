import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Brand-consistent export palette (navy / teal).
 * jsPDF renders outside the DOM, so CSS vars are unavailable — these are fixed
 * RGB tuples aligned with the DBR77 navy/teal brand, kept in one place so PDF
 * and notebook exports read consistently. NEVER var() here (no DOM at export).
 */
const PDF_COLORS = {
  paper: '#ffffff',
  ink: [15, 23, 42] as [number, number, number],
  inkSubtle: [71, 85, 105] as [number, number, number],
  inkMuted: [100, 116, 128] as [number, number, number],
  hairline: [203, 210, 218] as [number, number, number],
  hairlineSubtle: [230, 233, 237] as [number, number, number],
  navy: [15, 23, 42] as [number, number, number],
  teal: [13, 148, 136] as [number, number, number],
};

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
    backgroundColor: PDF_COLORS.paper,
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
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.text(title, margin, yOffset + 5);
    yOffset += 15;
  }

  // Add generation timestamp
  pdf.setFontSize(9);
  pdf.setTextColor(...PDF_COLORS.inkMuted);
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
    pdf.setTextColor(...PDF_COLORS.inkMuted);
    pdf.text(`Page ${i} of ${totalPages} • Consultify`, pageWidth - margin, pageHeight - 5, {
      align: 'right',
    });
  }

  // Download PDF
  pdf.save(filename);
}

/**
 * Export a conversation (array of messages) as a formatted PDF document.
 * Uses jsPDF text rendering (no html2canvas needed).
 */
export async function exportConversationToPDF(
  messages: Array<{ role: string; content: string; timestamp?: Date | string }>,
  options: { title?: string; filename?: string } = {}
): Promise<void> {
  const { title = 'AI Conversation', filename = 'conversation.pdf' } = options;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const addPageIfNeeded = (requiredSpace: number) => {
    if (y + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  // Title
  pdf.setFontSize(18);
  pdf.setTextColor(...PDF_COLORS.navy);
  pdf.text(title, margin, y + 6);
  y += 14;

  // Subtitle
  pdf.setFontSize(9);
  pdf.setTextColor(...PDF_COLORS.inkSubtle);
  pdf.text(
    `Exported: ${new Date().toLocaleString()} • ${messages.length} messages • Consultify`,
    margin,
    y
  );
  y += 8;

  // Separator
  pdf.setDrawColor(...PDF_COLORS.hairline);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Messages
  for (const msg of messages) {
    const isUser = msg.role === 'user';
    const roleLabel = isUser ? 'USER' : 'AI CONSULTANT';
    const roleColor: [number, number, number] = isUser ? PDF_COLORS.navy : PDF_COLORS.teal;

    // Role label
    addPageIfNeeded(12);
    pdf.setFontSize(8);
    pdf.setTextColor(...roleColor);
    pdf.setFont('helvetica', 'bold');
    pdf.text(roleLabel, margin, y);
    if (msg.timestamp) {
      const ts = typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : msg.timestamp;
      pdf.setTextColor(...PDF_COLORS.inkMuted);
      pdf.setFont('helvetica', 'normal');
      pdf.text(ts.toLocaleString(), margin + 35, y);
    }
    y += 5;

    // Message content — word-wrap
    pdf.setFontSize(10);
    pdf.setTextColor(...PDF_COLORS.ink);
    pdf.setFont('helvetica', 'normal');

    // Clean markdown formatting for PDF
    const cleanContent = msg.content
      .replace(/\*\*(.*?)\*\*/g, '$1') // bold
      .replace(/\*(.*?)\*/g, '$1') // italic
      .replace(/#{1,6}\s/g, '') // headers
      .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '').trim()) // code blocks
      .replace(/`([^`]+)`/g, '$1') // inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .trim();

    const lines = pdf.splitTextToSize(cleanContent, maxWidth);
    for (const line of lines) {
      addPageIfNeeded(5);
      pdf.text(line, margin, y);
      y += 4.5;
    }
    y += 4;

    // Light separator between messages
    addPageIfNeeded(3);
    pdf.setDrawColor(...PDF_COLORS.hairlineSubtle);
    pdf.line(margin, y, margin + 40, y);
    y += 5;
  }

  // Footer on each page
  const totalPages = pdf.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(...PDF_COLORS.inkMuted);
    pdf.text(`Page ${i} of ${totalPages} • Consultify AI`, pageWidth - margin, pageHeight - 5, {
      align: 'right',
    });
  }

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
