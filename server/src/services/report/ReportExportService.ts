export class ReportExportService {
  exportToCsv(reportData: any): string {
    if (!reportData.data || !Array.isArray(reportData.data) || reportData.data.length === 0) {
      return '';
    }

    const headers = Object.keys(reportData.data[0]);
    const csvRows = [headers.join(',')];

    for (const row of reportData.data) {
      const values = headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') {
          // Escape double quotes and wrap in quotes if contains comma
          const escaped = val.replace(/"/g, '""');
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${escaped}"`;
          }
          return escaped;
        }
        return String(val);
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}
