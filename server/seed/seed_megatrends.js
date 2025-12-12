// server/seed/seed_megatrends.js
// Seed script to populate default megatrends for supported industries

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Example data – in a real project this would be exhaustive and possibly loaded from a JSON file
const defaultMegatrends = [
    // Technology (Opportunity)
    { industry: 'general', type: 'Technology', label: 'Artificial Intelligence / GenAI', description: '', base_impact_score: 6, initial_ring: 'Now' },
    { industry: 'general', type: 'Technology', label: 'Machine Learning in Operations', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Technology', label: 'Digital Twin of Factory', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Technology', label: 'Industrial IoT', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Technology', label: 'Edge Computing', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Technology', label: 'Advanced Analytics / Big Data', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Technology', label: 'Predictive Maintenance', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Technology', label: 'Robotics & Cobots', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Technology', label: 'Autonomous Mobile Robots (AMR)', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Technology', label: 'Drones in Industry', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Technology', label: 'Computer Vision (Quality, Safety)', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Technology', label: 'Additive Manufacturing (3D Printing)', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Technology', label: 'Blockchain for Traceability', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Technology', label: 'Cybersecurity for OT', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Technology', label: 'Cloud / Hybrid Cloud', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Technology', label: 'Low-code / No-code', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Technology', label: 'Quantum Computing (far horizon)', description: '', base_impact_score: 2, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Technology', label: 'Augmented Reality (AR) for maintenance', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Technology', label: 'Virtual Reality (VR) training', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Technology', label: 'Energy management systems', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    // Business (Competitive Pressure)
    { industry: 'general', type: 'Business', label: 'Servitization (Product → Service)', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Business', label: 'Outcome-based pricing', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Business', label: 'Platformization / Marketplaces', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Business', label: 'Mass Customization', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Business', label: 'Shorter product lifecycles', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Business', label: 'Data as a product', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Business', label: 'Subscription models in industry', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Business', label: 'Vertical integration', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Business', label: 'Re-shoring / Near-shoring', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Business', label: 'Supply chain resilience', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Business', label: 'Price transparency', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Business', label: 'Direct-to-customer models', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Business', label: 'Partner ecosystems', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Business', label: 'Automation-driven cost competition', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Business', label: 'Speed-to-market as advantage', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Business', label: 'Digital sales channels (B2B)', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Business', label: 'Standardization vs differentiation', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Business', label: 'AI-driven competitors', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Business', label: 'New entrants from tech sector', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Business', label: 'Consolidation of suppliers', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    // Societal (Non-negotiable)
    { industry: 'general', type: 'Societal', label: 'Sustainability / ESG', description: '', base_impact_score: 6, initial_ring: 'Now' },
    { industry: 'general', type: 'Societal', label: 'Carbon footprint transparency', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Societal', label: 'Regulatory pressure (EU Green Deal, CBAM)', description: '', base_impact_score: 7, initial_ring: 'Now' },
    { industry: 'general', type: 'Societal', label: 'Traceability requirements', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Societal', label: 'Ethical sourcing', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Societal', label: 'Workforce shortages', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Societal', label: 'Aging workforce', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Societal', label: 'Skills gap / reskilling', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Societal', label: 'Employee expectations (purpose, tools)', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Societal', label: 'Health & safety standards', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Societal', label: 'Cyber trust', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Societal', label: 'Data privacy', description: '', base_impact_score: 5, initial_ring: 'Now' },
    { industry: 'general', type: 'Societal', label: 'Compliance-by-design', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Societal', label: 'Speed & reliability expectations', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Societal', label: 'Customer transparency demands', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Societal', label: 'Social responsibility of manufacturers', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Societal', label: 'Energy efficiency norms', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Societal', label: 'Circular economy', description: '', base_impact_score: 4, initial_ring: 'Watch Closely' },
    { industry: 'general', type: 'Societal', label: 'Waste reduction', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' },
    { industry: 'general', type: 'Societal', label: 'Climate risk adaptation', description: '', base_impact_score: 3, initial_ring: 'On the Horizon' }
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
