// @ts-nocheck
// server/models/megatrend.ts
// Provides data access for Megatrend Scanner module
// Uses the existing SQLite/Postgres db abstraction (db.get, db.all, db.run)

import { getDatabase } from '../database/index.js';
const db = getDatabase();

// TypeScript interfaces
interface Megatrend {
  id: string;
  type: string;
  label: string;
  description: string;
  baseImpactScore: number;
  initialRing: string;
  industry?: string;
}

interface MegatrendRow {
  id: string;
  industry: string;
  type: string;
  label: string;
  description: string;
  base_impact_score: number;
  initial_ring: string;
  ring?: string;
  impact?: number;
}

interface CustomTrendPayload {
  industry: string;
  type: string;
  label: string;
  description: string;
  ring: string;
}

// Default megatrends data for common industries (fallback when DB is empty)
const DEFAULT_MEGATRENDS: Record<string, Megatrend[]> = {
  automotive: [
    {
      id: 'auto-1',
      type: 'Technology',
      label: 'Electric Vehicle Revolution',
      description: 'Transition from ICE to electric powertrains across all segments',
      baseImpactScore: 7,
      initialRing: 'Now',
    },
    {
      id: 'auto-2',
      type: 'Technology',
      label: 'Autonomous Driving',
      description: 'Self-driving capabilities from L2 to full autonomy',
      baseImpactScore: 6,
      initialRing: 'Watch Closely',
    },
    {
      id: 'auto-3',
      type: 'Business',
      label: 'Mobility as a Service (MaaS)',
      description: 'Shift from ownership to subscription and shared mobility models',
      baseImpactScore: 5,
      initialRing: 'Watch Closely',
    },
    {
      id: 'auto-4',
      type: 'Technology',
      label: 'Connected Car Ecosystems',
      description: 'Vehicle-to-everything (V2X) communication and software-defined vehicles',
      baseImpactScore: 6,
      initialRing: 'Now',
    },
    {
      id: 'auto-5',
      type: 'Societal',
      label: 'Sustainability Regulations',
      description: 'Strict emissions targets and circular economy requirements',
      baseImpactScore: 7,
      initialRing: 'Now',
    },
    {
      id: 'auto-6',
      type: 'Business',
      label: 'Supply Chain Localization',
      description: 'Nearshoring and regionalization of critical component manufacturing',
      baseImpactScore: 5,
      initialRing: 'Now',
    },
  ],
  manufacturing: [
    {
      id: 'mfg-1',
      type: 'Technology',
      label: 'Industry 4.0 & Smart Factory',
      description: 'Full digitalization of production with IoT, AI, and robotics',
      baseImpactScore: 7,
      initialRing: 'Now',
    },
    {
      id: 'mfg-2',
      type: 'Technology',
      label: 'Additive Manufacturing',
      description: '3D printing for prototyping and production parts',
      baseImpactScore: 5,
      initialRing: 'Watch Closely',
    },
    {
      id: 'mfg-3',
      type: 'Business',
      label: 'Mass Customization',
      description: 'Personalized products at scale without cost penalty',
      baseImpactScore: 5,
      initialRing: 'Watch Closely',
    },
    {
      id: 'mfg-4',
      type: 'Technology',
      label: 'Predictive Maintenance',
      description: 'AI-driven equipment health monitoring and failure prevention',
      baseImpactScore: 6,
      initialRing: 'Now',
    },
    {
      id: 'mfg-5',
      type: 'Societal',
      label: 'Labor Transformation',
      description: 'Reskilling workforce for human-robot collaboration',
      baseImpactScore: 6,
      initialRing: 'Now',
    },
    {
      id: 'mfg-6',
      type: 'Societal',
      label: 'Carbon Neutral Manufacturing',
      description: 'Net-zero production through renewable energy and process optimization',
      baseImpactScore: 7,
      initialRing: 'Now',
    },
  ],
  financial: [
    {
      id: 'fin-1',
      type: 'Technology',
      label: 'Open Banking & APIs',
      description: 'Third-party access to financial data and services',
      baseImpactScore: 6,
      initialRing: 'Now',
    },
    {
      id: 'fin-2',
      type: 'Technology',
      label: 'AI-Powered Risk Assessment',
      description: 'Machine learning for credit scoring and fraud detection',
      baseImpactScore: 7,
      initialRing: 'Now',
    },
    {
      id: 'fin-3',
      type: 'Business',
      label: 'FinTech Disruption',
      description: 'Digital-native competitors unbundling traditional banking',
      baseImpactScore: 7,
      initialRing: 'Now',
    },
    {
      id: 'fin-4',
      type: 'Technology',
      label: 'Blockchain & DeFi',
      description: 'Decentralized finance and distributed ledger applications',
      baseImpactScore: 5,
      initialRing: 'Watch Closely',
    },
    {
      id: 'fin-5',
      type: 'Societal',
      label: 'ESG Investing Mandates',
      description: 'Environmental and social criteria in investment decisions',
      baseImpactScore: 6,
      initialRing: 'Now',
    },
    {
      id: 'fin-6',
      type: 'Business',
      label: 'Embedded Finance',
      description: 'Financial services integrated into non-financial platforms',
      baseImpactScore: 5,
      initialRing: 'Watch Closely',
    },
  ],
  retail: [
    {
      id: 'ret-1',
      type: 'Business',
      label: 'Omnichannel Integration',
      description: 'Seamless customer experience across physical and digital',
      baseImpactScore: 7,
      initialRing: 'Now',
    },
    {
      id: 'ret-2',
      type: 'Technology',
      label: 'AI-Driven Personalization',
      description: 'Hyper-personalized recommendations and dynamic pricing',
      baseImpactScore: 6,
      initialRing: 'Now',
    },
    {
      id: 'ret-3',
      type: 'Business',
      label: 'Direct-to-Consumer (D2C)',
      description: 'Brands bypassing traditional retail channels',
      baseImpactScore: 6,
      initialRing: 'Now',
    },
    {
      id: 'ret-4',
      type: 'Technology',
      label: 'Automated Fulfillment',
      description: 'Robotics and AI in warehousing and last-mile delivery',
      baseImpactScore: 5,
      initialRing: 'Watch Closely',
    },
    {
      id: 'ret-5',
      type: 'Societal',
      label: 'Conscious Consumerism',
      description: 'Demand for sustainable and ethical products',
      baseImpactScore: 6,
      initialRing: 'Now',
    },
    {
      id: 'ret-6',
      type: 'Technology',
      label: 'Social Commerce',
      description: 'Shopping integrated into social media platforms',
      baseImpactScore: 5,
      initialRing: 'Now',
    },
  ],
  healthcare: [
    {
      id: 'hc-1',
      type: 'Technology',
      label: 'AI Diagnostics',
      description: 'Machine learning for medical imaging and disease detection',
      baseImpactScore: 7,
      initialRing: 'Now',
    },
    {
      id: 'hc-2',
      type: 'Technology',
      label: 'Telemedicine',
      description: 'Remote consultations and virtual care delivery',
      baseImpactScore: 7,
      initialRing: 'Now',
    },
    {
      id: 'hc-3',
      type: 'Technology',
      label: 'Precision Medicine',
      description: 'Treatments tailored to individual genetic profiles',
      baseImpactScore: 6,
      initialRing: 'Watch Closely',
    },
    {
      id: 'hc-4',
      type: 'Business',
      label: 'Value-Based Care',
      description: 'Shift from fee-for-service to outcomes-based payment',
      baseImpactScore: 6,
      initialRing: 'Now',
    },
    {
      id: 'hc-5',
      type: 'Societal',
      label: 'Aging Population',
      description: 'Growing demand for elderly care and chronic disease management',
      baseImpactScore: 7,
      initialRing: 'Now',
    },
    {
      id: 'hc-6',
      type: 'Technology',
      label: 'Wearables & Remote Monitoring',
      description: 'Continuous health data collection and prevention',
      baseImpactScore: 5,
      initialRing: 'Now',
    },
  ],
};

// Get default trends for any industry
function getDefaultTrends(industry: string | undefined): Megatrend[] {
  const normalizedIndustry = (industry || 'manufacturing').toLowerCase();
  const trends = DEFAULT_MEGATRENDS[normalizedIndustry] || DEFAULT_MEGATRENDS.manufacturing;
  return trends.map((t) => ({ ...t, industry: normalizedIndustry }));
}

// Helper to map DB rows to JS objects
function mapMegatrendRow(row: MegatrendRow): Megatrend {
  return {
    id: row.id,
    industry: row.industry,
    type: row.type, // Technology / Business / Societal
    label: row.label,
    description: row.description,
    baseImpactScore: row.base_impact_score,
    initialRing: row.initial_ring, // Now / Watch / Horizon
  };
}

/**
 * Get default megatrends for a given industry.
 * If no industry is provided, returns all baseline trends.
 * Falls back to static data if database is empty.
 */
function getBaselineTrends(industry) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT * FROM megatrends`;
    const params = [];
    if (industry) {
      sql += ` WHERE industry = ?`;
      params.push(industry);
    }
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.warn('[Megatrend] DB error, using fallback data:', err.message);
        return resolve(getDefaultTrends(industry));
      }

      // If no data in DB, use fallback
      if (!rows || rows.length === 0) {
        console.log('[Megatrend] No data in DB, using default trends for:', industry);
        return resolve(getDefaultTrends(industry));
      }

      resolve(rows.map(mapMegatrendRow));
    });
  });
}

/**
 * Get data for the radar chart.
 * Returns an array of { label, type, ring, impact } for the selected industry.
 */
function getRadarData(industry) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT label, type, initial_ring as ring, base_impact_score as impact FROM megatrends`;
    const params = [];
    if (industry) {
      sql += ` WHERE industry = ?`;
      params.push(industry);
    }
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(
        rows.map((r) => ({
          label: r.label,
          type: r.type,
          ring: r.ring,
          impact: r.impact,
        }))
      );
    });
  });
}

/**
 * Get full detail for a specific megatrend (including AI insights).
 */
function getTrendDetail(id) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM megatrends WHERE id = ?`;
    db.get(sql, [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      // Placeholder AI insights; can be extended later.
      const insight = {
        suggestedRing: row.initial_ring,
        risks: [],
        opportunities: [],
        recommendedActions: [],
      };
      resolve({ ...mapMegatrendRow(row), aiInsight: insight });
    });
  });
}

/**
 * Create a custom/company‑specific trend.
 * payload: { industry, type, label, description, ring }
 */
function createCustomTrend(payload, companyId) {
  return new Promise((resolve, reject) => {
    const { industry, type, label, description, ring } = payload;
    const id = require('uuid').v4();
    const sql = `INSERT INTO custom_trends (id, company_id, industry, type, label, description, ring)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [id, companyId, industry, type, label, description, ring], function (err) {
      if (err) return reject(err);
      resolve({ id, ...payload, ring });
    });
  });
}

/**
 * Update an existing custom trend.
 */
function updateCustomTrend(id, payload, companyId) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const params = [];
    if (payload.industry) {
      fields.push('industry = ?');
      params.push(payload.industry);
    }
    if (payload.type) {
      fields.push('type = ?');
      params.push(payload.type);
    }
    if (payload.label) {
      fields.push('label = ?');
      params.push(payload.label);
    }
    if (payload.description) {
      fields.push('description = ?');
      params.push(payload.description);
    }
    if (payload.ring) {
      fields.push('ring = ?');
      params.push(payload.ring);
    }
    if (fields.length === 0) return resolve(null);
    const sql = `UPDATE custom_trends SET ${fields.join(', ')} WHERE id = ? AND company_id = ?`;
    params.push(id, companyId);
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id, ...payload });
    });
  });
}

export { createCustomTrend, getBaselineTrends, getRadarData, getTrendDetail, updateCustomTrend };

export default {
  getBaselineTrends,
  getRadarData,
  getTrendDetail,
  createCustomTrend,
  updateCustomTrend,
};
