import { z } from 'zod';

export const RESULTS_SEARCH_KINDS = ['kpi', 'okr_set', 'roi_case'] as const;
export type ResultsSearchKind = (typeof RESULTS_SEARCH_KINDS)[number];

const kindsSchema = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((kind) => kind.trim())
      .filter(Boolean)
  )
  .pipe(z.array(z.enum(RESULTS_SEARCH_KINDS)).min(1))
  .optional();

export const ResultsVnextSearchQuerySchema = z.object({
  q: z.string().trim().max(200),
  kinds: kindsSchema,
  limit: z.coerce.number().int().positive().max(50).optional(),
  cursor: z.string().max(2000).optional(),
});
