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
            backgroundColor: '#ffffff'
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
            console.error("PDF Export failed:", error);
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
        const chartElements = [
            'analytics-summary',
            'burn-down-chart',
            'velocity-chart'
        ];

        for (const elementId of chartElements) {
            const element = document.getElementById(elementId);
            if (!element) continue;

            const canvas = await html2canvas(element, {
                scale: 1.5,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
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
            console.error("Dashboard PDF Export failed:", error);
        }
        return false;
    }
};

export const exportToCSV = <T extends Record<string, unknown>>(data: T[], filename: string): boolean => {
    if (data.length === 0) return false;

    try {
        // Get headers from first object
        const headers = Object.keys(data[0]);

        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...data.map(row =>
                headers.map(header => {
                    const value = row[header];
                    // Escape commas and quotes
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
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
            console.error("CSV Export failed:", error);
        }
        return false;
    }
};
