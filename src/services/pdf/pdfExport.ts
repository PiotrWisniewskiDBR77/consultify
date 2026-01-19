import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ExportOptions {
  filename: string;
  title?: string;
  author?: string;
  subject?: string;
}

export const exportReportToPDF = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return false;
  }

  try {
    // 1. Capture the element as canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');

    // 2. Initialize PDF (A4)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // 3. Calculate dimensions
    const imgProps = pdf.getImageProperties(imgData);
    const pdfImgWidth = pdfWidth;
    const pdfImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;

    // 4. Add image to PDF (handling multipage)
    let heightLeft = pdfImgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'PNG', 0, position, pdfImgWidth, pdfImgHeight);
    heightLeft -= pdfHeight;

    // Subsequent pages
    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfImgWidth, pdfImgHeight);
      heightLeft -= pdfHeight;
    }

    // 5. Save
    pdf.save(fileName);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('PDF Export failed:', error);
    }
    return false;
  }
};

export const exportDashboardToPDF = async (options: ExportOptions) => {
  const { filename, title, author, subject } = options;

  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Add metadata
    if (title) pdf.setProperties({ title });
    if (author) pdf.setProperties({ author });
    if (subject) pdf.setProperties({ subject });

    // Header
    pdf.setFontSize(24);
    pdf.setTextColor(30, 41, 59); // navy-900
    pdf.text(title || 'Analytics Report', 20, 25);

    // Subtitle
    pdf.setFontSize(12);
    pdf.setTextColor(100, 116, 139); // slate-500
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 35);

    // Divider
    pdf.setDrawColor(226, 232, 240); // slate-200
    pdf.setLineWidth(0.5);
    pdf.line(20, 40, pageWidth - 20, 40);

    let yPosition = 50;

    // Capture and add charts
    const chartElements = ['analytics-summary', 'burn-down-chart', 'velocity-chart'];

    for (const elementId of chartElements) {
      const element = document.getElementById(elementId);
      if (!element) continue;

      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const imgProps = pdf.getImageProperties(imgData);

      const imgWidth = pageWidth - 40; // 20mm margins
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      // Check if we need a new page
      if (yPosition + imgHeight > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.addImage(imgData, 'PNG', 20, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    }

    // Footer on last page
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setTextColor(148, 163, 184); // slate-400
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    pdf.save(filename);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Dashboard PDF Export failed:', error);
    }
    return false;
  }
};

export const exportToCSV = <T extends Record<string, unknown>>(
  data: T[],
  filename: string
): boolean => {
  if (data.length === 0) return false;

  try {
    // Get headers from first object
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Escape commas and quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(',')
      ),
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);

    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('CSV Export failed:', error);
    }
    return false;
  }
};

// ==================== STRATEGIC TOOLS EXPORT ====================

interface StrategicToolExportOptions {
  toolType: string;
  toolName: string;
  sessionName: string;
  organizationName: string;
  createdAt: string;
  elementRef: HTMLElement | null;
  isPolish?: boolean;
}

export const exportStrategicToolToPDF = async (options: StrategicToolExportOptions): Promise<boolean> => {
  const { toolType, toolName, sessionName, organizationName, createdAt, elementRef, isPolish = false } = options;

  if (!elementRef) {
    console.error('[exportStrategicToolToPDF] No element reference provided');
    return false;
  }

  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    // Set document metadata
    pdf.setProperties({
      title: `${toolName} - ${sessionName}`,
      subject: `Strategic Analysis Report`,
      author: organizationName,
      creator: 'Consultify Strategic Tools',
    });

    // === COVER PAGE ===
    
    // Background accent
    pdf.setFillColor(124, 58, 237); // primary color
    pdf.rect(0, 0, pageWidth, 50, 'F');

    // Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.setTextColor(255, 255, 255);
    pdf.text(toolName, margin, 30);

    // Session name
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text(sessionName, margin, 42);

    // Organization and date
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(12);
    let yPos = 70;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(isPolish ? 'Organizacja:' : 'Organization:', margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(organizationName, margin + 35, yPos);
    
    yPos += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.text(isPolish ? 'Data utworzenia:' : 'Created:', margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(new Date(createdAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }), margin + 35, yPos);

    yPos += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.text(isPolish ? 'Typ analizy:' : 'Analysis Type:', margin, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(toolType.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '), margin + 35, yPos);

    // Divider line
    yPos += 15;
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPos, pageWidth - margin, yPos);

    // === CONTENT PAGES ===
    
    // Capture the content element
    const canvas = await html2canvas(elementRef, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 800, // Fixed width for consistent rendering
    });

    const imgData = canvas.toDataURL('image/png');
    const imgProps = pdf.getImageProperties(imgData);

    // Calculate dimensions to fit page width
    const imgWidth = contentWidth;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

    // Start content on same page if fits, otherwise new page
    yPos += 15;
    const remainingHeight = pageHeight - yPos - margin;

    if (imgHeight <= remainingHeight) {
      // Fits on cover page
      pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
    } else {
      // Need new page(s)
      pdf.addPage();
      let currentY = margin;
      let heightLeft = imgHeight;
      let sourceY = 0;

      while (heightLeft > 0) {
        const availableHeight = pageHeight - currentY - margin;
        const sliceHeight = Math.min(heightLeft, availableHeight);
        
        // Calculate source dimensions from original canvas
        const sourceHeight = (sliceHeight / imgHeight) * imgProps.height;
        
        // For simplicity, we'll add the full image and let it overflow
        // This is a common approach and works well for most reports
        if (currentY === margin) {
          pdf.addImage(imgData, 'PNG', margin, currentY - sourceY, imgWidth, imgHeight);
        }
        
        heightLeft -= availableHeight;
        sourceY += availableHeight;
        
        if (heightLeft > 0) {
          pdf.addPage();
          currentY = margin;
        }
      }
    }

    // === FOOTER ON ALL PAGES ===
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      
      // Left: Consultify branding
      pdf.text('Generated by Consultify Strategic Tools', margin, pageHeight - 8);
      
      // Right: Page number
      pdf.text(
        `${isPolish ? 'Strona' : 'Page'} ${i} / ${pageCount}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: 'right' }
      );
    }

    // Generate filename
    const sanitizedName = sessionName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${toolType}_${sanitizedName}_${dateStr}.pdf`;

    pdf.save(filename);
    return true;
  } catch (error) {
    console.error('[exportStrategicToolToPDF] Export failed:', error);
    return false;
  }
};

export const exportStrategicToolToImage = async (
  elementRef: HTMLElement | null,
  filename: string
): Promise<boolean> => {
  if (!elementRef) {
    console.error('[exportStrategicToolToImage] No element reference provided');
    return false;
  }

  try {
    const canvas = await html2canvas(elementRef, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Create download link
    const link = document.createElement('a');
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    return true;
  } catch (error) {
    console.error('[exportStrategicToolToImage] Export failed:', error);
    return false;
  }
};
