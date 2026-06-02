-- Radar 2.0 foundation
-- Source registry, ingestion storage, processed signals, personalization, ranking, actions, watchlist.

CREATE TABLE IF NOT EXISTS radar_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'rss',
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'market',
  language TEXT NOT NULL DEFAULT 'en',
  trust_score REAL NOT NULL DEFAULT 0.7,
  refresh_frequency_minutes INTEGER NOT NULL DEFAULT 180,
  active INTEGER NOT NULL DEFAULT 1,
  tags_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  last_fetched_at TIMESTAMP,
  next_refresh_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_radar_sources_url ON radar_sources(url);
CREATE INDEX IF NOT EXISTS idx_radar_sources_active_next_refresh
  ON radar_sources(active, next_refresh_at);

CREATE TABLE IF NOT EXISTS radar_raw_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  raw_text TEXT,
  raw_html TEXT,
  canonical_url TEXT NOT NULL,
  author TEXT,
  published_at TIMESTAMP,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  language TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  content_hash TEXT,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES radar_sources(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_radar_raw_items_source_url
  ON radar_raw_items(source_id, canonical_url);
CREATE INDEX IF NOT EXISTS idx_radar_raw_items_source_fetch
  ON radar_raw_items(source_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_raw_items_processing_status
  ON radar_raw_items(processing_status, fetched_at DESC);

CREATE TABLE IF NOT EXISTS radar_processed_signals (
  id TEXT PRIMARY KEY,
  raw_item_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  summary_short TEXT NOT NULL,
  summary_long TEXT,
  content_type TEXT NOT NULL DEFAULT 'news',
  domain_tags_json TEXT NOT NULL DEFAULT '[]',
  topic_tags_json TEXT NOT NULL DEFAULT '[]',
  entity_tags_json TEXT NOT NULL DEFAULT '[]',
  relevance_scope TEXT NOT NULL DEFAULT 'general',
  business_impact TEXT NOT NULL DEFAULT 'medium',
  actionability TEXT NOT NULL DEFAULT 'medium',
  durability TEXT NOT NULL DEFAULT 'current',
  freshness_score REAL NOT NULL DEFAULT 0,
  impact_score REAL NOT NULL DEFAULT 0,
  actionability_score REAL NOT NULL DEFAULT 0,
  trust_score REAL NOT NULL DEFAULT 0,
  duplicate_cluster_id TEXT,
  status TEXT NOT NULL DEFAULT 'processed',
  signal_kind TEXT NOT NULL DEFAULT 'external',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (raw_item_id) REFERENCES radar_raw_items(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES radar_sources(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_radar_processed_signals_raw_item
  ON radar_processed_signals(raw_item_id);
CREATE INDEX IF NOT EXISTS idx_radar_processed_signals_source
  ON radar_processed_signals(source_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_processed_signals_duplicate_cluster
  ON radar_processed_signals(duplicate_cluster_id);
CREATE INDEX IF NOT EXISTS idx_radar_processed_signals_sort
  ON radar_processed_signals(freshness_score DESC, impact_score DESC, actionability_score DESC);

CREATE TABLE IF NOT EXISTS user_radar_profiles (
  user_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  roles_json TEXT NOT NULL DEFAULT '[]',
  industries_json TEXT NOT NULL DEFAULT '[]',
  seniority TEXT,
  region TEXT,
  tracked_topics_json TEXT NOT NULL DEFAULT '[]',
  tracked_companies_json TEXT NOT NULL DEFAULT '[]',
  muted_topics_json TEXT NOT NULL DEFAULT '[]',
  muted_sources_json TEXT NOT NULL DEFAULT '[]',
  preferred_content_types_json TEXT NOT NULL DEFAULT '[]',
  strategic_interests_json TEXT NOT NULL DEFAULT '[]',
  personalization_weights_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_radar_profiles_org ON user_radar_profiles(organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS radar_ranked_signals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  signal_id TEXT NOT NULL,
  final_score REAL NOT NULL DEFAULT 0,
  relevance_breakdown_json TEXT NOT NULL DEFAULT '{}',
  why_you_see_this TEXT,
  why_it_matters TEXT,
  suggested_next_step TEXT,
  impact_type TEXT,
  confidence_score REAL,
  related_projects_json TEXT NOT NULL DEFAULT '[]',
  related_context_json TEXT NOT NULL DEFAULT '[]',
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (signal_id) REFERENCES radar_processed_signals(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_radar_ranked_signals_user_signal
  ON radar_ranked_signals(user_id, signal_id);
CREATE INDEX IF NOT EXISTS idx_radar_ranked_signals_user_score
  ON radar_ranked_signals(user_id, final_score DESC, generated_at DESC);

CREATE TABLE IF NOT EXISTS radar_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  signal_id TEXT,
  action_type TEXT NOT NULL,
  source_context TEXT,
  created_object_type TEXT,
  created_object_id TEXT,
  action_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (signal_id) REFERENCES radar_processed_signals(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_radar_actions_user_created
  ON radar_actions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_actions_signal_created
  ON radar_actions(signal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_actions_action_type
  ON radar_actions(action_type, created_at DESC);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_items_unique
  ON watchlist_items(user_id, item_type, value);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_active
  ON watchlist_items(user_id, active, created_at DESC);
