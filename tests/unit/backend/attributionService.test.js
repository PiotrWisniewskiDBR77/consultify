/**
 * Attribution Service Unit Tests
 * Tests marketing attribution, UTM tracking, and conversion analytics
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Attribution service implementation
const createAttributionService = () => {
  const attributions = [];
  const conversions = [];
  let counter = 0;

  return {
    track: (data) => {
      const attribution = {
        id: `attr-${Date.now()}-${++counter}`,
        sessionId: data.sessionId,
        userId: data.userId,
        source: data.source || 'direct',
        medium: data.medium,
        campaign: data.campaign,
        term: data.term,
        content: data.content,
        referrer: data.referrer,
        landingPage: data.landingPage,
        timestamp: new Date(),
      };
      attributions.push(attribution);
      return attribution;
    },

    parseUTM: (url) => {
      const urlObj = new URL(url);
      return {
        source: urlObj.searchParams.get('utm_source'),
        medium: urlObj.searchParams.get('utm_medium'),
        campaign: urlObj.searchParams.get('utm_campaign'),
        term: urlObj.searchParams.get('utm_term'),
        content: urlObj.searchParams.get('utm_content'),
      };
    },

    recordConversion: (attributionId, value, type = 'signup') => {
      const conversion = {
        id: `conv-${Date.now()}-${++counter}`,
        attributionId,
        type,
        value,
        timestamp: new Date(),
      };
      conversions.push(conversion);
      return conversion;
    },

    getConversionRate: (filters = {}) => {
      const relevantAttributions = filters.source
        ? attributions.filter((a) => a.source === filters.source)
        : attributions;

      const relevantConversions = conversions.filter((c) =>
        relevantAttributions.some((a) => a.id === c.attributionId)
      );

      if (relevantAttributions.length === 0) return 0;
      return relevantConversions.length / relevantAttributions.length;
    },

    getAttributionsBySource: () => {
      const bySource = {};
      for (const attr of attributions) {
        bySource[attr.source] = (bySource[attr.source] || 0) + 1;
      }
      return bySource;
    },

    getConversionValueBySource: () => {
      const bySource = {};
      for (const conv of conversions) {
        const attr = attributions.find((a) => a.id === conv.attributionId);
        if (attr) {
          bySource[attr.source] = (bySource[attr.source] || 0) + conv.value;
        }
      }
      return bySource;
    },

    getLastTouchAttribution: (userId) => {
      const userAttributions = attributions.filter((a) => a.userId === userId);
      return userAttributions[userAttributions.length - 1] || null;
    },

    getFirstTouchAttribution: (userId) => {
      const userAttributions = attributions.filter((a) => a.userId === userId);
      return userAttributions[0] || null;
    },
  };
};

describe('AttributionService', () => {
  let attributionService;

  beforeEach(() => {
    attributionService = createAttributionService();
  });

  describe('Attribution Tracking', () => {
    it('should track attribution', () => {
      const attribution = attributionService.track({
        source: 'google',
        medium: 'cpc',
        campaign: 'launch',
      });

      expect(attribution.id).toBeDefined();
      expect(attribution.source).toBe('google');
      expect(attribution.medium).toBe('cpc');
    });

    it('should default to direct source', () => {
      const attribution = attributionService.track({});
      expect(attribution.source).toBe('direct');
    });
  });

  describe('UTM Parsing', () => {
    it('should parse UTM parameters', () => {
      const url = 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=spring';
      const utm = attributionService.parseUTM(url);

      expect(utm.source).toBe('google');
      expect(utm.medium).toBe('cpc');
      expect(utm.campaign).toBe('spring');
    });

    it('should handle missing UTM params', () => {
      const url = 'https://example.com?utm_source=google';
      const utm = attributionService.parseUTM(url);

      expect(utm.source).toBe('google');
      expect(utm.medium).toBeNull();
    });
  });

  describe('Conversion Tracking', () => {
    it('should record conversion', () => {
      const attrs = attributionService.track({ source: 'google' });
      const conversion = attributionService.recordConversion(attrs.id, 99.99, 'purchase');

      expect(conversion.value).toBe(99.99);
      expect(conversion.type).toBe('purchase');
    });
  });

  describe('Conversion Rate', () => {
    it('should calculate conversion rate', () => {
      const attr1 = attributionService.track({ source: 'google' });
      const attr2 = attributionService.track({ source: 'google' });
      attributionService.track({ source: 'google' }); // No conversion
      attributionService.track({ source: 'google' }); // No conversion

      attributionService.recordConversion(attr1.id, 10);
      attributionService.recordConversion(attr2.id, 10);

      const rate = attributionService.getConversionRate();
      expect(rate).toBe(0.5); // 2 of 4
    });

    it('should filter by source', () => {
      const googleAttr = attributionService.track({ source: 'google' });
      attributionService.track({ source: 'facebook' });

      attributionService.recordConversion(googleAttr.id, 10);

      const googleRate = attributionService.getConversionRate({ source: 'google' });
      expect(googleRate).toBe(1); // 1 of 1
    });
  });

  describe('Attribution Analytics', () => {
    it('should group by source', () => {
      attributionService.track({ source: 'google' });
      attributionService.track({ source: 'google' });
      attributionService.track({ source: 'facebook' });

      const bySource = attributionService.getAttributionsBySource();
      expect(bySource.google).toBe(2);
      expect(bySource.facebook).toBe(1);
    });
  });

  describe('Touch Attribution', () => {
    it('should get first touch attribution', () => {
      attributionService.track({ userId: 'user-1', source: 'google' });
      attributionService.track({ userId: 'user-1', source: 'facebook' });

      const firstTouch = attributionService.getFirstTouchAttribution('user-1');
      expect(firstTouch.source).toBe('google');
    });

    it('should get last touch attribution', () => {
      attributionService.track({ userId: 'user-1', source: 'google' });
      attributionService.track({ userId: 'user-1', source: 'facebook' });

      const lastTouch = attributionService.getLastTouchAttribution('user-1');
      expect(lastTouch.source).toBe('facebook');
    });
  });
});
