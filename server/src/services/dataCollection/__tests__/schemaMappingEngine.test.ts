import { describe, expect, it } from 'vitest';

import type { ExternalSchema, FieldMapping } from '../connectorFramework.js';
import {
  autoMap,
  inferFieldType,
  type TargetField,
  transformValue,
  validateMapping,
} from '../schemaMappingEngine.js';

function makeTargetFields(
  fields: Array<{ id: string; name: string; field_type: string }>
): TargetField[] {
  return fields.map((f) => ({ id: f.id, name: f.name, field_type: f.field_type }));
}

function makeExternalSchema(fieldNames: string[]): ExternalSchema {
  return {
    tables: [
      {
        name: 'Sheet1',
        fields: fieldNames.map((name) => ({
          name,
          externalType: 'string',
          inferredType: 'singleLineText',
        })),
      },
    ],
  };
}

describe('schemaMappingEngine — autoMap', () => {
  // 1. autoMap with matching field names → correct mapping
  it('maps fields with matching names', () => {
    const external = makeExternalSchema(['Name', 'Email', 'Phone']);
    const target = makeTargetFields([
      { id: 'f1', name: 'Name', field_type: 'singleLineText' },
      { id: 'f2', name: 'Email', field_type: 'email' },
      { id: 'f3', name: 'Phone', field_type: 'phone' },
    ]);

    const result = autoMap(external, target);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ sourceField: 'Name', targetFieldId: 'f1' });
    expect(result[1]).toEqual({ sourceField: 'Email', targetFieldId: 'f2' });
    expect(result[2]).toEqual({ sourceField: 'Phone', targetFieldId: 'f3' });
  });

  // 2. autoMap with different casing → still maps
  it('maps fields with different casing', () => {
    const external = makeExternalSchema(['NAME', 'email']);
    const target = makeTargetFields([
      { id: 'f1', name: 'name', field_type: 'singleLineText' },
      { id: 'f2', name: 'Email', field_type: 'email' },
    ]);

    const result = autoMap(external, target);
    expect(result).toHaveLength(2);
    expect(result[0].sourceField).toBe('NAME');
    expect(result[0].targetFieldId).toBe('f1');
  });

  // 3. autoMap with underscores vs spaces → still maps
  it('maps fields with underscores vs spaces', () => {
    const external = makeExternalSchema(['first_name', 'last name']);
    const target = makeTargetFields([
      { id: 'f1', name: 'First Name', field_type: 'singleLineText' },
      { id: 'f2', name: 'last_name', field_type: 'singleLineText' },
    ]);

    const result = autoMap(external, target);
    expect(result).toHaveLength(2);
    expect(result[0].sourceField).toBe('first_name');
    expect(result[0].targetFieldId).toBe('f1');
    expect(result[1].sourceField).toBe('last name');
    expect(result[1].targetFieldId).toBe('f2');
  });
});

describe('schemaMappingEngine — inferFieldType', () => {
  // 4. inferFieldType for "amount" (numeric samples) → number
  it('infers number for numeric sample values', () => {
    const result = inferFieldType('unknown', ['100', '200.50', '3000']);
    expect(result).toBe('number');
  });

  // 5. inferFieldType for date samples → date
  it('infers date for ISO date samples', () => {
    const result = inferFieldType('unknown', ['2024-01-15', '2024-06-30', '2024-12-25']);
    expect(result).toBe('date');
  });

  // 6. inferFieldType for "true"/"false" → checkbox
  it('infers checkbox for boolean string samples', () => {
    const result = inferFieldType('unknown', ['true', 'false', 'yes', 'no']);
    expect(result).toBe('checkbox');
  });

  it('returns mapped type for known external type "currency"', () => {
    const result = inferFieldType('currency', []);
    expect(result).toBe('currency');
  });

  it('returns singleLineText for empty samples with unknown type', () => {
    const result = inferFieldType('unknown', []);
    expect(result).toBe('singleLineText');
  });
});

describe('schemaMappingEngine — transformValue', () => {
  // 7. transformValue string to number → correct
  it('transforms string to number', () => {
    const result = transformValue('$1,234.56', 'string', 'number');
    expect(result).toBe(1234.56);
  });

  it('transforms plain numeric string to number', () => {
    const result = transformValue('42', 'string', 'number');
    expect(result).toBe(42);
  });

  // 8. transformValue date string → ISO date
  it('transforms date string to ISO date', () => {
    const result = transformValue('2024-01-15', 'string', 'date');
    expect(result).toBe('2024-01-15');
  });

  it('transforms non-ISO date string to ISO format', () => {
    const result = transformValue('January 15, 2024', 'string', 'date');
    expect(typeof result).toBe('string');
    expect(String(result)).toContain('2024');
  });

  it('transforms null to null', () => {
    expect(transformValue(null, 'string', 'number')).toBeNull();
  });

  it('transforms empty string to null', () => {
    expect(transformValue('', 'string', 'number')).toBeNull();
  });

  it('transforms boolean string to checkbox', () => {
    expect(transformValue('true', 'string', 'checkbox')).toBe(true);
    expect(transformValue('false', 'string', 'checkbox')).toBe(false);
    expect(transformValue('yes', 'string', 'checkbox')).toBe(true);
  });
});

describe('schemaMappingEngine — validateMapping', () => {
  const targetFields = makeTargetFields([
    { id: 'f1', name: 'Name', field_type: 'singleLineText' },
    { id: 'f2', name: 'Email', field_type: 'email' },
  ]);

  // 9. validateMapping with valid mapping → passes
  it('passes for valid mapping', () => {
    const mapping: FieldMapping[] = [
      { sourceField: 'col_name', targetFieldId: 'f1' },
      { sourceField: 'col_email', targetFieldId: 'f2' },
    ];
    const result = validateMapping(mapping, targetFields);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // 10. validateMapping with missing target field → fails
  it('fails when target field does not exist', () => {
    const mapping: FieldMapping[] = [
      { sourceField: 'col_name', targetFieldId: 'f1' },
      { sourceField: 'col_phone', targetFieldId: 'f-nonexistent' },
    ];
    const result = validateMapping(mapping, targetFields);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('does not exist');
  });

  it('fails for duplicate target field mappings', () => {
    const mapping: FieldMapping[] = [
      { sourceField: 'col_a', targetFieldId: 'f1' },
      { sourceField: 'col_b', targetFieldId: 'f1' },
    ];
    const result = validateMapping(mapping, targetFields);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('fails for missing sourceField', () => {
    const mapping: FieldMapping[] = [{ sourceField: '', targetFieldId: 'f1' }];
    const result = validateMapping(mapping, targetFields);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('missing sourceField'))).toBe(true);
  });
});
