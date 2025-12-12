// server/seed/seed_megatrends.js
// Seed script to populate default megatrends for supported industries

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Example data – in a real project this would be exhaustive and possibly loaded from a JSON file
const defaultMegatrends = [
    // Automotive industry examples
    {
        industry: 'automotive',
        type: 'Technology',
        label: 'Artificial Intelligence / GenAI',
        description: 'AI-driven design, predictive maintenance, autonomous driving.',
        base_impact_score: 6,
        initial_ring: 'Now'
    },
    {
        industry: 'automotive',
        type: 'Technology',
        label: 'Electric Vehicles',
        description: 'Shift to EV powertrains, battery tech advances.',
        base_impact_score: 5,
        initial_ring: 'Watch Closely'
    },
    {
        industry: 'automotive',
        type: 'Societal',
        label: 'Regulatory pressure (EU Green Deal, CBAM)',
        description: 'Emissions standards and carbon accounting.',
        base_impact_score: 7,
        initial_ring: 'Now'
    },
    // FMCG industry examples
    {
        industry: 'FMCG',
        type: 'Business',
        label: 'Mass Customization',
        description: 'Personalized packaging and product variants.',
        base_impact_score: 4,
        initial_ring: 'Watch Closely'
    },
    {
        industry: 'FMCG',
        type: 'Technology',
        label: 'Advanced Analytics / Big Data',
        description: 'Demand forecasting, supply chain optimization.',
        base_impact_score: 5,
        initial_ring: 'Now'
    },
    {
        industry: 'FMCG',
        type: 'Societal',
        label: 'Sustainability / ESG',
        description: 'Eco‑friendly packaging, carbon footprint transparency.',
        base_impact_score: 6,
        initial_ring: 'Now'
    }
];

function seedMegatrends() {
    return new Promise((resolve, reject) => {
        const placeholders = defaultMegatrends.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
        const values = [];
        defaultMegatrends.forEach(trend => {
            values.push(
                uuidv4(),
                trend.industry,
                trend.type,
                trend.label,
                trend.description,
                trend.base_impact_score,
                trend.initial_ring
            );
        });
        const sql = `INSERT OR IGNORE INTO megatrends (id, industry, type, label, description, base_impact_score, initial_ring) VALUES ${placeholders}`;
        db.run(sql, values, function (err) {
            if (err) return reject(err);
            resolve({ inserted: this.changes });
        });
    });
}

module.exports = { seedMegatrends };
