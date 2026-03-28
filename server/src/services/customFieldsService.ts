import { z } from 'zod';

export const FieldTypeEnum = z.enum([
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'multiselect',
  'boolean',
  'user',
  'url',
  'email',
  'currency',
]);

export const CustomFieldDefinitionSchema = z.object({
  fieldKey: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(128),
  fieldType: FieldTypeEnum,
  required: z.boolean().default(false),
  entityType: z.enum(['task', 'decision', 'initiative']).default('task'),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  defaultValue: z.unknown().optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

export type CustomFieldDefinition = z.infer<typeof CustomFieldDefinitionSchema>;

export const UpdateCustomFieldSchema = z.object({
  label: z.string().min(1).max(128).optional(),
  required: z.boolean().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  defaultValue: z.unknown().optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export type UpdateCustomFieldInput = z.infer<typeof UpdateCustomFieldSchema>;

export function validateCustomFieldValues(
  definitions: CustomFieldDefinition[],
  values: Record<string, unknown>
): { valid: boolean; errors: Array<{ field: string; message: string }> } {
  const errors: Array<{ field: string; message: string }> = [];

  for (const def of definitions.filter((d) => d.isActive)) {
    const value = values[def.fieldKey];

    if (def.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: def.fieldKey, message: `${def.label} is required` });
      continue;
    }

    if (value === undefined || value === null) continue;

    switch (def.fieldType) {
      case 'number':
      case 'currency':
        if (typeof value !== 'number') {
          errors.push({ field: def.fieldKey, message: `${def.label} must be a number` });
        } else {
          if (def.validation?.min !== undefined && value < def.validation.min)
            errors.push({
              field: def.fieldKey,
              message: `${def.label} must be >= ${def.validation.min}`,
            });
          if (def.validation?.max !== undefined && value > def.validation.max)
            errors.push({
              field: def.fieldKey,
              message: `${def.label} must be <= ${def.validation.max}`,
            });
        }
        break;
      case 'select':
        if (def.options && !def.options.some((o) => o.value === value))
          errors.push({ field: def.fieldKey, message: `Invalid option for ${def.label}` });
        break;
      case 'multiselect':
        if (!Array.isArray(value)) {
          errors.push({ field: def.fieldKey, message: `${def.label} must be an array` });
        } else if (def.options) {
          const validValues = new Set(def.options.map((o) => o.value));
          for (const v of value) {
            if (!validValues.has(v as string))
              errors.push({
                field: def.fieldKey,
                message: `Invalid option "${v}" for ${def.label}`,
              });
          }
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean')
          errors.push({ field: def.fieldKey, message: `${def.label} must be boolean` });
        break;
      case 'email':
        if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          errors.push({ field: def.fieldKey, message: `${def.label} must be a valid email` });
        break;
      case 'url':
        if (typeof value === 'string') {
          try {
            new URL(value);
          } catch {
            errors.push({ field: def.fieldKey, message: `${def.label} must be a valid URL` });
          }
        }
        break;
      case 'date':
        if (typeof value === 'string' && isNaN(Date.parse(value)))
          errors.push({ field: def.fieldKey, message: `${def.label} must be a valid date` });
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}
