import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const exportReportToPDF = async (elementId: string, fileName: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with id ${elementId} not found`);
        return false;
    }

    try {
        // 1. Capture the element as canvas
        // scale: 2 improves resolution
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true, // For images if any
            logging: false
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
            position -= pdfHeight; // Move the image up to show the next chunk
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfImgWidth, pdfImgHeight);
            heightLeft -= pdfHeight;
        }

        // 5. Save
        pdf.save(fileName);
        return true;
    } catch (error) {
        console.error("PDF Export failed:", error);
        return false;
    }
};
