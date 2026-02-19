/**
 * Legal Validators
 * T093: Zod schemas for legal acceptance endpoints
 */

import { z } from 'zod';

export const LEGAL_DOC_TYPES = [
  'TOS',
  'PRIVACY',
  'AUP',
  'AI_POLICY',
  'COOKIES',
  'DPA',
  'SUBSCRIPTION',
  'SLA',
  'REFUNDS',
] as const;

export const acceptDocumentsSchema = z.object({
  docTypes: z
    .array(z.string().toUpperCase())
    .min(1, 'At least one document type is required'),
  scope: z.enum(['USER', 'ORG_ADMIN']).default('USER'),
});

export const publishDocumentSchema = z.object({
  docType: z.string().toUpperCase(),
  version: z.string().min(1),
  title: z.string().min(1),
  contentMd: z.string().min(1),
  effectiveFrom: z.string().min(1),
  changeSummary: z.string().optional(),
  scopeType: z.enum(['global', 'org']).default('global'),
  scopeValue: z.string().optional(),
});

export type AcceptDocumentsInput = z.infer<typeof acceptDocumentsSchema>;
export type PublishDocumentInput = z.infer<typeof publishDocumentSchema>;
