-- Deep Thinking Industry Templates (Enterprise)
-- Pre-configured DoD extensions for specific industry verticals.

CREATE TABLE IF NOT EXISTS ai_industry_templates (
  id TEXT PRIMARY KEY,
  industry TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- DoD extensions
  additional_sections TEXT,    -- JSON array of extra DoD sections
  extra_quality_checks TEXT,   -- JSON array of additional quality validations
  
  -- Industry-specific context
  terminology TEXT,            -- JSON object of industry terms
  constraints TEXT,            -- JSON array of regulatory/compliance constraints
  typical_metrics TEXT,        -- JSON array of common metrics to include
  
  -- Templates
  prompt_addon TEXT,           -- Extra prompt text for this industry
  report_template TEXT,        -- Custom report structure
  
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial templates
INSERT OR IGNORE INTO ai_industry_templates (id, industry, display_name, description, additional_sections, terminology, constraints, typical_metrics, prompt_addon) VALUES
('ind-manufacturing', 'manufacturing', 'Manufacturing & Production', 'For production, assembly, and industrial operations', 
 '["oee_impact", "lean_assessment", "safety_implications", "supply_chain_effects"]',
 '{"OEE": "Overall Equipment Effectiveness", "TAKT": "Production rhythm time", "6S": "Sort, Set, Shine, Standardize, Sustain, Safety", "Muda": "Waste (Lean concept)"}',
 '["ISO 9001", "OSHA", "Environmental regulations"]',
 '["OEE (%)", "Cycle time reduction", "Defect rate", "Downtime %", "Throughput"]',
 'When analyzing this manufacturing decision, always consider: OEE impact, Lean principles (eliminate Muda), safety implications, supply chain resilience, and capacity utilization.'),

('ind-healthcare', 'healthcare', 'Healthcare & Life Sciences', 'For hospitals, clinics, pharma, and medical devices',
 '["patient_safety", "regulatory_compliance", "clinical_efficacy", "privacy_hipaa"]',
 '{"PHI": "Protected Health Information", "HIPAA": "Health Insurance Portability", "FDA": "Food and Drug Administration", "EHR": "Electronic Health Record"}',
 '["HIPAA", "FDA regulations", "GDPR (for EU)", "Clinical trial protocols"]',
 '["Patient outcomes", "Readmission rates", "Compliance rate", "Cost per patient", "Wait times"]',
 'When analyzing this healthcare decision, patient safety is PARAMOUNT. Always assess: regulatory compliance (HIPAA, FDA), clinical efficacy, data privacy, and ethical implications.'),

('ind-finance', 'finance', 'Financial Services & Banking', 'For banks, insurance, investment, and fintech',
 '["regulatory_risk", "market_impact", "counterparty_risk", "compliance_checklist"]',
 '{"AML": "Anti-Money Laundering", "KYC": "Know Your Customer", "Basel": "Basel Banking Regulations", "SOX": "Sarbanes-Oxley Act"}',
 '["SOX", "Basel III/IV", "AML/KYC", "GDPR", "PCI-DSS"]',
 '["Risk-adjusted return", "VaR", "Compliance cost", "Customer acquisition cost", "NPS"]',
 'When analyzing this financial decision, always assess: regulatory compliance (SOX, Basel), risk exposure, fiduciary duty, market impact, and audit trail requirements.'),

('ind-retail', 'retail', 'Retail & E-commerce', 'For retail chains, e-commerce, and consumer goods',
 '["customer_experience", "inventory_impact", "omnichannel_effects", "seasonal_considerations"]',
 '{"AOV": "Average Order Value", "CAC": "Customer Acquisition Cost", "LTV": "Lifetime Value", "SKU": "Stock Keeping Unit"}',
 '["Consumer protection laws", "PCI-DSS", "GDPR"]',
 '["Conversion rate", "Cart abandonment", "Inventory turnover", "Customer retention", "Same-store sales"]',
 'When analyzing this retail decision, consider: customer experience across channels, inventory implications, seasonal timing, competitive positioning, and unit economics.'),

('ind-technology', 'technology', 'Technology & SaaS', 'For software companies, tech startups, and IT services',
 '["scalability_assessment", "technical_debt", "security_review", "competitive_differentiation"]',
 '{"ARR": "Annual Recurring Revenue", "MRR": "Monthly Recurring Revenue", "Churn": "Customer attrition rate", "NRR": "Net Revenue Retention"}',
 '["SOC 2", "GDPR", "CCPA", "Industry-specific compliance"]',
 '["ARR growth", "Churn rate", "NPS", "Time to value", "Engineering velocity"]',
 'When analyzing this technology decision, assess: scalability, technical debt impact, security implications, developer experience, and competitive moat.');
