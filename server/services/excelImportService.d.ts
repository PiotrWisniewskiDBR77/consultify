export default ExcelImportService;
declare namespace ExcelImportService {
    function parseDigitizationExcel(filePath: string): Promise<Object>;
    function detectStructure(sheet: any): {
        success: boolean;
        headerRow: number;
        columns: {};
        warnings: never[];
    };
    function parseRow(row: any, columns: any): {
        axis: any;
        areaCode: any;
        areaName: any;
        level: any;
        currentLevel: any;
        targetLevel: any;
        description: any;
        example: any;
        question: any;
        notes: any;
        justification: any;
    };
    function normalizeLevel(value: any): number;
    function validateFile(filePath: any): Promise<{
        valid: boolean;
        errors: never[];
        warnings: never[];
    }>;
    function importExcel(filePath: string, options: Object, services: Object): Promise<Object>;
}
//# sourceMappingURL=excelImportService.d.ts.map