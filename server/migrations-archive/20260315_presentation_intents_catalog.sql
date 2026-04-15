-- Presentation intent catalog — replaces hardcoded array in presentations.routes.ts
CREATE TABLE IF NOT EXISTS presentation_intents (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  label_pl TEXT NOT NULL,
  description TEXT NOT NULL,
  description_pl TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO presentation_intents (id, label, label_pl, description, description_pl, sort_order) VALUES
  ('cover', 'Cover Slide', 'Slajd tytułowy', 'Title page with branding', 'Strona tytułowa z brandingiem', 1),
  ('executive_summary', 'Executive Summary', 'Podsumowanie wykonawcze', 'High-level findings and KPIs', 'Kluczowe ustalenia i KPI', 2),
  ('section_intro', 'Section Intro', 'Wprowadzenie do sekcji', 'Section divider with title', 'Separator sekcji z tytułem', 3),
  ('key_messages', 'Key Messages', 'Kluczowe wnioski', '3-4 critical takeaways', '3-4 kluczowe wnioski', 4),
  ('performance_overview', 'KPI Dashboard', 'Dashboard KPI', 'Performance metrics overview', 'Przegląd wskaźników wydajności', 5),
  ('single_insight', 'Single Insight', 'Pojedynczy wgląd', 'One chart or metric deep-dive', 'Pogłębiona analiza jednego wykresu lub metryki', 6),
  ('comparison', 'Comparison', 'Porównanie', 'Side-by-side or gap analysis', 'Analiza porównawcza lub luk', 7),
  ('assessment', 'Assessment', 'Ocena', 'Maturity/score overview', 'Przegląd dojrzałości/oceny', 8),
  ('recommendation_portfolio', 'Recommendations', 'Rekomendacje', 'Action recommendations', 'Rekomendacje działań', 9),
  ('initiative_portfolio', 'Initiative Portfolio', 'Portfel inicjatyw', 'Initiative cards/table', 'Karty/tabela inicjatyw', 10),
  ('prioritization_matrix', 'Prioritization Matrix', 'Macierz priorytetyzacji', 'Impact vs effort quadrants', 'Kwadranty wpływ vs wysiłek', 11),
  ('roadmap', 'Roadmap', 'Plan działania', 'Timeline with phases', 'Oś czasu z fazami', 12),
  ('risk_management', 'Risks & Mitigations', 'Ryzyka i mitygacje', 'Risk table with actions', 'Tabela ryzyk z działaniami', 13),
  ('next_steps', 'Next Steps', 'Kolejne kroki', 'Actions, owners, deadlines', 'Działania, właściciele, terminy', 14),
  ('appendix', 'Appendix', 'Załącznik', 'Disclaimers & methodology', 'Zastrzeżenia i metodologia', 15)
ON CONFLICT (id) DO NOTHING;
