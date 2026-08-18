export const MATERIAL_EXPORT_POLICY_VERSION = 'mat-policy-v1' as const;

export type MaterialOutputSemantics = 'document' | 'workbook' | 'presentation' | 'text_summary';

export interface ApprovedExportEngine {
  providerKey: string;
  packageName: 'docx' | 'pptxgenjs' | 'exceljs' | 'pdfkit';
  version: string;
  license: 'MIT';
  outputSemantics: MaterialOutputSemantics;
}

const APPROVED_ENGINES: Readonly<Record<string, ApprovedExportEngine>> = Object.freeze({
  'native:docx': Object.freeze({ providerKey: 'native:docx', packageName: 'docx', version: '9.5.1', license: 'MIT', outputSemantics: 'document' }),
  'native:pptxgenjs': Object.freeze({ providerKey: 'native:pptxgenjs', packageName: 'pptxgenjs', version: '4.0.1', license: 'MIT', outputSemantics: 'presentation' }),
  'native:exceljs': Object.freeze({ providerKey: 'native:exceljs', packageName: 'exceljs', version: '4.4.0', license: 'MIT', outputSemantics: 'workbook' }),
  'native:pdfkit': Object.freeze({ providerKey: 'native:pdfkit', packageName: 'pdfkit', version: '0.17.2', license: 'MIT', outputSemantics: 'text_summary' }),
});

export function requireApprovedExportEngine(providerKey: string): ApprovedExportEngine {
  const engine = APPROVED_ENGINES[providerKey];
  if (!engine) throw new Error(`MAT_EXPORT_ENGINE_NOT_APPROVED:${providerKey}`);
  return engine;
}

export function isApprovedTemplateProvenance(value: unknown): boolean {
  return String(value || '').trim().toLowerCase() === 'approved';
}

