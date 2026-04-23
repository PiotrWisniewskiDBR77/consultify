export const FOOTER_TARGETS = ['pdf_footer', 'docx_footer', 'pptx_footer'] as const;
export type FooterTarget = (typeof FOOTER_TARGETS)[number];

export type WatermarkSpec = {
  readonly text: string;
};

export type TenantWatermarkPolicy = {
  readonly watermarkRequired: boolean;
  readonly defaultText: string;
};

export type ProvenanceFooter = {
  readonly sha256Prefix12: string;
  readonly footerTarget: FooterTarget;
  readonly watermarkText: string | null;
};

