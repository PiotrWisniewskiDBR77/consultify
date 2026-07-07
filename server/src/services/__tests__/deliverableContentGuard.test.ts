import { describe, expect, it } from 'vitest';

import {
  isTemplateInventoryLeak,
  contentLeaksTemplateInventory,
} from '../deliverableContentGuard.js';

describe('deliverableContentGuard (BUG C)', () => {
  describe('isTemplateInventoryLeak', () => {
    it('flags the "Available templates (N):" catalogue string', () => {
      expect(
        isTemplateInventoryLeak(
          'Available templates (20): Okresowy raport postępu, Pitch inwestorski'
        )
      ).toBe(true);
    });

    it('flags "Deprecated templates:" marker', () => {
      expect(isTemplateInventoryLeak('Deprecated templates: Old deck')).toBe(true);
    });

    it('flags the Polish variants', () => {
      expect(isTemplateInventoryLeak('Dostępne szablony (5): Raport, Pitch')).toBe(true);
      expect(isTemplateInventoryLeak('Przestarzałe szablony: Stary')).toBe(true);
    });

    it('does not flag ordinary content', () => {
      expect(isTemplateInventoryLeak('Revenue grew 12% year over year.')).toBe(false);
      expect(isTemplateInventoryLeak('')).toBe(false);
      expect(isTemplateInventoryLeak(null)).toBe(false);
    });
  });

  describe('contentLeaksTemplateInventory', () => {
    it('flags content containing two or more template names', () => {
      expect(
        contentLeaksTemplateInventory('We used Pitch inwestorski and Analiza rynku here', [
          'Pitch inwestorski',
          'Analiza rynku',
          'Okresowy raport postępu',
        ])
      ).toBe(true);
    });

    it('does not flag a single template name (could be a legit section title)', () => {
      expect(
        contentLeaksTemplateInventory('Our market analysis section', ['market analysis'])
      ).toBe(false);
    });

    it('flags via structural marker even without name list', () => {
      expect(contentLeaksTemplateInventory('Available templates (3): a, b, c')).toBe(true);
    });
  });
});
