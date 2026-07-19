-- Migration 602: V3-E06 — ADMA seed data parity with SIRI
-- Enrich ADMA demo assessment to COMPLETED with full framework_data,
-- and add a second ADMA assessment for demo diversity.

-- 1) Complete the existing ADMA assessment (ts-006)
UPDATE assessments
SET status = 'COMPLETED',
    progress = 100,
    completed_at = datetime('now', '-8 days'),
    framework_data = json('{
      "pillars": {
        "strategy": {"current": 3.5, "target": 4.5, "gap": 1.0, "dimensionScores": {"digital_strategy": 4, "digital_investments": 3}},
        "smart_products": {"current": 2.5, "target": 4.0, "gap": 1.5, "dimensionScores": {"product_design": 3, "product_lifecycle": 2}},
        "smart_operations": {"current": 3.0, "target": 4.0, "gap": 1.0, "dimensionScores": {"production_processes": 3, "quality_management": 3, "maintenance_management": 3}},
        "smart_supply": {"current": 2.0, "target": 3.5, "gap": 1.5, "dimensionScores": {"supply_chain_integration": 2, "logistics_warehousing": 2}},
        "data_driven": {"current": 2.5, "target": 4.0, "gap": 1.5, "dimensionScores": {"data_governance": 3, "analytics_ai": 2, "cybersecurity": 3}}
      },
      "dimensions": {
        "digital_strategy": {"current": 4, "target": 5, "gap": 1, "evidence": "Formal digital roadmap aligned with business strategy"},
        "digital_investments": {"current": 3, "target": 4, "gap": 1, "evidence": "Budget allocated but ROI tracking ad-hoc"},
        "product_design": {"current": 3, "target": 4, "gap": 1, "evidence": "CAD/CAE used, no digital twin"},
        "product_lifecycle": {"current": 2, "target": 4, "gap": 2, "evidence": "Basic PLM, no IoT integration"},
        "production_processes": {"current": 3, "target": 4, "gap": 1, "evidence": "Partial MES integration"},
        "quality_management": {"current": 3, "target": 4, "gap": 1, "evidence": "SPC in place, SQC emerging"},
        "maintenance_management": {"current": 3, "target": 4, "gap": 1, "evidence": "Preventive maintenance, predictive planned"},
        "supply_chain_integration": {"current": 2, "target": 4, "gap": 2, "evidence": "EDI with key suppliers only"},
        "logistics_warehousing": {"current": 2, "target": 3, "gap": 1, "evidence": "WMS deployed, AGV evaluation"},
        "data_governance": {"current": 3, "target": 4, "gap": 1, "evidence": "Data policies defined, enforcement partial"},
        "analytics_ai": {"current": 2, "target": 4, "gap": 2, "evidence": "BI dashboards, no ML in production"},
        "cybersecurity": {"current": 3, "target": 4, "gap": 1, "evidence": "ISO 27001 certified, OT security gap"}
      },
      "overallMaturity": 2.7,
      "metadata": {"assessmentDate": "2026-02-10", "version": "2.0", "source": "manual"}
    }')
WHERE id = 'ts-006';

-- 2) Add a second completed ADMA assessment for demo diversity
INSERT OR IGNORE INTO assessments (
  id, organization_id, project_id, framework, name, status, progress,
  created_by, created_at, completed_at,
  framework_data
) VALUES (
  'ts-adma-002',
  'org-dbr77-test',
  'proj-lean-manufacturing',
  'ADMA',
  'Post-Transformation ADMA Review',
  'COMPLETED',
  100,
  'user-pawel-wojcik',
  datetime('now', '-90 days'),
  datetime('now', '-60 days'),
  json('{
    "pillars": {
      "strategy": {"current": 4.0, "target": 5.0, "gap": 1.0, "dimensionScores": {"digital_strategy": 4, "digital_investments": 4}},
      "smart_products": {"current": 3.5, "target": 4.5, "gap": 1.0, "dimensionScores": {"product_design": 4, "product_lifecycle": 3}},
      "smart_operations": {"current": 4.0, "target": 4.5, "gap": 0.5, "dimensionScores": {"production_processes": 4, "quality_management": 4, "maintenance_management": 4}},
      "smart_supply": {"current": 3.0, "target": 4.0, "gap": 1.0, "dimensionScores": {"supply_chain_integration": 3, "logistics_warehousing": 3}},
      "data_driven": {"current": 3.5, "target": 4.5, "gap": 1.0, "dimensionScores": {"data_governance": 4, "analytics_ai": 3, "cybersecurity": 4}}
    },
    "dimensions": {
      "digital_strategy": {"current": 4, "target": 5, "gap": 1, "evidence": "Board-approved digital strategy with quarterly reviews"},
      "digital_investments": {"current": 4, "target": 5, "gap": 1, "evidence": "Digital CapEx 12% of revenue with ROI dashboard"},
      "product_design": {"current": 4, "target": 5, "gap": 1, "evidence": "Digital twin for top 3 products"},
      "product_lifecycle": {"current": 3, "target": 4, "gap": 1, "evidence": "PLM with IoT data feeds for field performance"},
      "production_processes": {"current": 4, "target": 5, "gap": 1, "evidence": "Full MES with real-time OEE"},
      "quality_management": {"current": 4, "target": 5, "gap": 1, "evidence": "AI-assisted visual inspection on 2 lines"},
      "maintenance_management": {"current": 4, "target": 5, "gap": 1, "evidence": "Predictive maintenance on critical assets"},
      "supply_chain_integration": {"current": 3, "target": 4, "gap": 1, "evidence": "API integration with 60% of suppliers"},
      "logistics_warehousing": {"current": 3, "target": 4, "gap": 1, "evidence": "WMS + 2 AGVs operational"},
      "data_governance": {"current": 4, "target": 5, "gap": 1, "evidence": "Central data lake with quality rules"},
      "analytics_ai": {"current": 3, "target": 5, "gap": 2, "evidence": "ML demand forecasting in pilot"},
      "cybersecurity": {"current": 4, "target": 5, "gap": 1, "evidence": "IT/OT segmentation, SOC monitoring"}
    },
    "overallMaturity": 3.6,
    "metadata": {"assessmentDate": "2025-12-01", "version": "2.0", "source": "manual"}
  }')
);
