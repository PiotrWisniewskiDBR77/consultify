// @vitest-environment node
/**
 * Unit tests — DBR77 curated template seed data (FT-1)
 *
 * Weryfikuje strukturę stałych z deliverableTemplateSeedService — bez DB,
 * bez mocków. Sprawdza że każdy typ ma ≥2 szablony z wymaganymi polami.
 */

import { describe, expect, it } from 'vitest';

import {
  DBR77_DECK_TEMPLATES,
  DBR77_DOC_TEMPLATES,
  DBR77_TABLE_TEMPLATES,
} from '../../../server/src/services/deliverableTemplateSeedService.js';

describe('DBR77 template seed data', () => {
  // FT-1.1 — doc templates: ≥2 szablony z sekcjami
  describe('DBR77_DOC_TEMPLATES', () => {
    it('contains at least 3 doc templates', () => {
      expect(DBR77_DOC_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    });

    it('each doc template has required fields (id, name, source_type, sections)', () => {
      for (const t of DBR77_DOC_TEMPLATES) {
        expect(t.id, `id missing for ${t.name}`).toBeTruthy();
        expect(t.name, `name missing`).toBeTruthy();
        expect(t.source_type, `source_type missing for ${t.id}`).toBeTruthy();
        expect(t.is_system, `is_system missing for ${t.id}`).toBe(true);
        expect(Array.isArray(t.sections), `sections must be array for ${t.id}`).toBe(true);
        expect(t.sections.length, `sections must be non-empty for ${t.id}`).toBeGreaterThan(0);
      }
    });

    it('each doc template section has key, type, title and order', () => {
      for (const t of DBR77_DOC_TEMPLATES) {
        for (const s of t.sections) {
          expect(s.key, `section key missing in ${t.id}`).toBeTruthy();
          expect(s.type, `section type missing in ${t.id}`).toBeTruthy();
          expect(s.title, `section title missing in ${t.id}`).toBeTruthy();
          expect(typeof s.order, `section order must be number in ${t.id}`).toBe('number');
        }
      }
    });

    it('doc template ids start with "dbr77-doc-"', () => {
      for (const t of DBR77_DOC_TEMPLATES) {
        expect(t.id).toMatch(/^dbr77-doc-/);
      }
    });
  });

  // FT-1.2 — deck templates: ≥2 szablony
  describe('DBR77_DECK_TEMPLATES', () => {
    it('contains at least 3 deck templates', () => {
      expect(DBR77_DECK_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    });

    it('each deck template has required fields (id, name, deck_type, outline)', () => {
      for (const t of DBR77_DECK_TEMPLATES) {
        expect(t.id, `id missing for ${t.name}`).toBeTruthy();
        expect(t.name, `name missing`).toBeTruthy();
        expect(t.deck_type, `deck_type missing for ${t.id}`).toBeTruthy();
        expect(t.is_system, `is_system must be true for ${t.id}`).toBe(true);
        expect(Array.isArray(t.outline), `outline must be array for ${t.id}`).toBe(true);
        expect(t.outline.length, `outline must be non-empty for ${t.id}`).toBeGreaterThan(0);
      }
    });

    it('each deck outline slide has intent and title', () => {
      for (const t of DBR77_DECK_TEMPLATES) {
        for (const slide of t.outline) {
          expect(slide.intent, `intent missing in ${t.id}`).toBeTruthy();
          expect(slide.title, `title missing in ${t.id}`).toBeTruthy();
        }
      }
    });

    it('deck template ids start with "dbr77-deck-"', () => {
      for (const t of DBR77_DECK_TEMPLATES) {
        expect(t.id).toMatch(/^dbr77-deck-/);
      }
    });
  });

  // FT-1.3 — table templates: ≥2 szablony z schema_snapshot zawierającym fields[]
  describe('DBR77_TABLE_TEMPLATES', () => {
    it('contains at least 3 table templates', () => {
      expect(DBR77_TABLE_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    });

    it('each table template has required fields (name, category, schema_snapshot)', () => {
      for (const t of DBR77_TABLE_TEMPLATES) {
        expect(t.name, `name missing`).toBeTruthy();
        expect(t.category, `category missing for ${t.name}`).toBeTruthy();
        expect(t.is_featured, `is_featured should be true for ${t.name}`).toBe(true);
        expect(t.schema_snapshot, `schema_snapshot missing for ${t.name}`).toBeTruthy();
      }
    });

    it('schema_snapshot contains fields array with at least 3 fields', () => {
      for (const t of DBR77_TABLE_TEMPLATES) {
        const { fields } = t.schema_snapshot;
        expect(Array.isArray(fields), `fields must be array in ${t.name}`).toBe(true);
        expect(fields.length, `fields must have ≥3 entries in ${t.name}`).toBeGreaterThanOrEqual(3);
      }
    });

    it('each field has name and type', () => {
      for (const t of DBR77_TABLE_TEMPLATES) {
        for (const f of t.schema_snapshot.fields) {
          expect(f.name, `field name missing in ${t.name}`).toBeTruthy();
          expect(f.type, `field type missing in ${t.name}`).toBeTruthy();
        }
      }
    });

    it('singleSelect fields have options array', () => {
      for (const t of DBR77_TABLE_TEMPLATES) {
        for (const f of t.schema_snapshot.fields) {
          if (f.type === 'singleSelect') {
            expect(Array.isArray(f.options), `options must be array for singleSelect field "${f.name}" in ${t.name}`).toBe(true);
            expect((f.options as string[]).length, `options must be non-empty for "${f.name}" in ${t.name}`).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  // Cross-cutting: IDs are unique across doc + deck (not table because UUID auto-gen)
  it('doc and deck template ids are unique across both sets', () => {
    const allIds = [
      ...DBR77_DOC_TEMPLATES.map((t) => t.id),
      ...DBR77_DECK_TEMPLATES.map((t) => t.id),
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});
