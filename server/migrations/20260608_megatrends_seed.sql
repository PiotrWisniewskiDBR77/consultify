-- Megatrends baseline seed (Module 04 — Narzędzia, Wave 1)
-- Idempotent: stable ids + ON CONFLICT DO NOTHING so re-running is safe.
-- Ring values use the canonical UI buckets: 'Now' / 'Watch Closely' / 'On the Horizon'.

CREATE TABLE IF NOT EXISTS megatrends (
  id TEXT PRIMARY KEY,
  industry TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  base_impact_score INTEGER NOT NULL,
  initial_ring TEXT NOT NULL
);

INSERT INTO megatrends (id, industry, type, label, description, base_impact_score, initial_ring) VALUES
  ('mg-mfg-tech-01', 'Manufacturing', 'Technology', 'Industrial AI & ML', 'ML applied to predictive maintenance and quality control', 85, 'Now'),
  ('mg-mfg-tech-02', 'Manufacturing', 'Technology', 'Collaborative Robotics', 'Cobots alongside human workers in assembly', 75, 'Now'),
  ('mg-mfg-bus-01', 'Manufacturing', 'Business', 'Supply Chain Regionalization', 'Near-shoring driven by geopolitical risk', 80, 'Now'),
  ('mg-mfg-soc-01', 'Manufacturing', 'Societal', 'Skilled Labour Shortage', 'Demographic gap in technical trades', 70, 'Watch Closely'),
  ('mg-ps-tech-01', 'Professional Services', 'Technology', 'Generative AI for Knowledge Work', 'LLMs automating research, drafting, analysis', 90, 'Now'),
  ('mg-ps-bus-01', 'Professional Services', 'Business', 'Value-Based Pricing Shift', 'Clients reject hourly billing for outcome pricing', 72, 'Now'),
  ('mg-ps-soc-01', 'Professional Services', 'Societal', 'Hybrid Work as Default', 'Client expectation for remote-first delivery', 65, 'Watch Closely'),
  ('mg-ret-tech-01', 'Retail', 'Technology', 'AI-Driven Personalisation', 'Real-time recommendation and dynamic pricing', 88, 'Now'),
  ('mg-ret-bus-01', 'Retail', 'Business', 'Marketplace Consolidation', 'Long-tail retailers squeezed by platform growth', 78, 'Now'),
  ('mg-ret-soc-01', 'Retail', 'Societal', 'Sustainability-Led Purchasing', 'Consumer preference shift to low-impact products', 68, 'Watch Closely'),
  ('mg-gen-tech-01', 'general', 'Technology', 'Agentic AI & Orchestration', 'Multi-agent systems handling autonomous workflows', 82, 'On the Horizon'),
  ('mg-gen-bus-01', 'general', 'Business', 'Platform Economics', 'Network-effect moats across all sectors', 74, 'Watch Closely')
ON CONFLICT (id) DO NOTHING;
