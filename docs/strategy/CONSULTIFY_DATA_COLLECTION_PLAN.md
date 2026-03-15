# Consultify Data Collection
## Central Ingestion and Analysis Plan

Version: draft v1  
Owner: Product + Data Platform + Engineering  
Scope: tables, models, KPI ingestion, and central data collection strategy

## 1. Purpose

This document defines how Consultify should collect data automatically into tables and analysis flows so the product can become the central point for:

- data collection
- operational modeling
- governed analysis
- downstream reporting and execution

The target is not to copy Airtable or Power BI mechanically.

The target is to adopt the strongest patterns from both:

- Airtable for operational data intake and flexible table synchronization
- Power BI for governed semantic modeling, refresh orchestration, and scalable analytics consumption

## 2. Benchmark lessons

## 2.1 What Airtable does well

Based on current Airtable sync patterns:

- one-way sync into tables from external systems
- synced tables as operational landing zones
- field mapping during sync setup
- unique identifier or primary key for deduplication and update matching
- configurable update and deletion behavior
- sync activity logs and ownership visibility
- simple mental model for business users

Important lesson:

Airtable makes it easy to bring external data into a usable table quickly, but synced tables are primarily operational intake surfaces, not a full governed semantic analytics layer.

## 2.2 What Power BI does well

Based on current Power BI dataflow and semantic model patterns:

- semantic models as the governed analysis layer
- dataflows to unify and prepare data from multiple sources
- scheduled refresh
- chained refresh behavior
- multiple connectivity modes: import, direct query, live, push
- direct access for near real-time cases when full import is not ideal
- clear distinction between source ingestion and consumption layer

Important lesson:

Power BI treats dashboards as outputs of a governed model, not as the model itself.

## 3. Strategic conclusion for Consultify

Consultify should combine both patterns in one product:

1. `Landing tables` for fast operational ingestion and mapping
2. `Governed models` for reusable metrics, finance, and analytical views
3. `Action layer` where analysis connects to initiatives, decisions, tasks, reports, and presentations

This means Consultify should not choose only one of these identities:

- only Airtable-like tables
- only Power BI-like dashboards

It should become:

`a central governed data operating layer`

## 4. Core design principle

Data collection should be organized into four layers.

```mermaid
flowchart LR
  Sources[External Sources]
  Ingestion[Ingestion Layer]
  Landing[Landing Tables]
  Governed[Governed Models and Metrics]
  Consumption[Views Analysis Reports Execution]

  Sources --> Ingestion
  Ingestion --> Landing
  Landing --> Governed
  Governed --> Consumption
```

## 5. Target layers

## 5.1 Source layer

The product should support data collection from:

- files: CSV, XLSX, PDF where appropriate
- SaaS APIs
- databases and warehouses
- internal MCP providers
- webhooks and event sources
- manual entry where no connector exists

## 5.2 Ingestion layer

The ingestion layer should own:

- connector configuration
- authentication
- schema discovery
- mapping setup
- refresh scheduling
- retry logic
- run logs
- error classification
- provenance capture

This should not live as local logic inside each table or module.

## 5.3 Landing table layer

Landing tables are the Consultify equivalent of Airtable synced tables.

They should be:

- easy to create
- easy to map
- refreshable
- visible to business users
- safe for light operational work

They should not automatically be treated as the final analytical truth.

## 5.4 Governed model layer

This layer is the Consultify equivalent of Power BI semantic modeling.

It should own:

- KPI definitions
- dimensions
- slices and filters
- finance mappings
- canonical line mappings
- record relationships
- reuse across Results, Reports, Finance, and Execution

## 6. Data collection modes

Consultify should support four canonical ingestion modes.

### Mode 1: File import

For:

- CSV
- XLSX
- controlled document imports

Use case:

- fastest onboarding from Airtable exports or operational spreadsheets

### Mode 2: Scheduled sync

For:

- SaaS tools
- internal APIs
- ERP and KPI sources

Use case:

- regular refresh into landing tables

### Mode 3: Live query or federated read

For:

- warehouse-scale datasets
- near real-time dashboards
- sources that should not be copied fully

Use case:

- Power BI-like direct access pattern for selected high-volume or latency-sensitive sources

### Mode 4: Push or event-driven ingestion

For:

- webhook events
- operational notifications
- streaming or asynchronous measurements

Use case:

- incremental updates without full table refresh

## 7. Connector strategy

The first serious connector wave should focus on sources that help users migrate without stress.

### P0 migration connectors

- CSV and XLSX import
- Airtable import or mirror path
- Jira or PM connector for operational records
- Google Sheets or Microsoft Excel source ingestion
- database connectors for Postgres and common warehouse sources
- KPI and finance source connectors already aligned with existing Results and Finance strategy

### P1 connectors

- Salesforce or HubSpot
- Power BI catalog or dashboard reference import where useful
- SharePoint and Drive file sources
- internal MCP providers such as IRIS

## 8. Required ingestion contract

Every ingestion flow should produce a durable run record with:

- `connector_run_id`
- `source_type`
- `source_ref`
- `destination_table_id`
- `run_status`
- `started_at`
- `completed_at`
- `records_seen`
- `records_inserted`
- `records_updated`
- `records_rejected`
- `schema_changes_detected`
- `error_summary`

Every imported record should carry provenance metadata sufficient to answer:

- where did it come from
- when was it last refreshed
- which connector run touched it
- whether it was later manually edited

## 9. Mapping model

Consultify should support explicit mapping during ingestion:

- source field -> destination field
- type conversion rules
- default values
- deduplication key
- delete behavior
- missing-field behavior
- schema drift handling

This is a direct lesson from Airtable sync setup and should be preserved because users trust visible mapping behavior.

## 10. Refresh model

Consultify should support three refresh policies.

### Policy A: Full refresh replace

Use when:

- the source is authoritative
- the destination is a clean mirror

### Policy B: Incremental upsert

Use when:

- records have stable external identifiers
- only changed rows should update

### Policy C: Append-only event history

Use when:

- data is event-based
- historical trace matters

Each table or ingestion flow should declare its refresh policy explicitly.

## 11. Reconciliation and trust

To become the central data hub, Consultify must not silently mix manual and synced values.

Required rules:

- synced values carry source provenance
- manual overrides are explicit
- conflicts are visible
- stale data is visible
- failed refreshes do not look successful
- downstream governed models can require only trusted inputs

## 12. Relationship to tables and models

The product should support two different user expectations:

### Expectation A: "I need a working table now"

Answer with:

- landing tables
- connector setup
- refreshable operational records

### Expectation B: "I need trusted analytics and decision support"

Answer with:

- governed models
- semantic KPI layer
- finance and ROI lineage
- reusable slices, dimensions, and views

These should be connected, but not collapsed into one undifferentiated layer.

## 13. Migration path from Airtable users

Recommended onboarding:

1. import or sync operational tables into landing tables
2. preserve familiar field structures where possible
3. add linked records and saved views
4. gradually connect those tables to governed models and reporting flows

Key message:

Users should not feel that they must redesign their entire operating model on day one.

## 14. Migration path from Power BI users

Recommended onboarding:

1. identify critical KPI datasets and source systems
2. create governed KPI and metric definitions inside Consultify
3. connect refreshable sources
4. use Consultify for action loops, ROI, reports, and artifact generation around those metrics

Key message:

Users should not feel that Consultify is "just another dashboard."

## 15. Proposed platform components

The long-term platform should introduce:

- `DataSourceRegistry`
- `ConnectorRegistry`
- `IngestionJobScheduler`
- `ConnectorRunLog`
- `LandingTableService`
- `SchemaMappingService`
- `ProvenanceService`
- `GovernedMetricLayer`
- `ReconciliationService`

## 16. Recommended phased rollout

### Phase 1: Landing table foundation

- file imports
- basic scheduled syncs
- explicit mapping UI
- run logs
- provenance on rows

### Phase 2: Governed model foundation

- KPI definitions
- dimensions and slices
- reusable model contracts
- readiness and trust flags for downstream use

### Phase 3: Advanced ingestion and live access

- warehouse connectors
- incremental refresh
- live query mode for selected cases
- conflict and reconciliation workflows

## 17. Non-goals for the first wave

The first wave should not attempt:

- every possible connector
- full BI parity
- full ETL studio behavior
- advanced streaming platform semantics
- uncontrolled schema inference without review

## 18. Success criteria

The strategy is successful if Consultify can:

- ingest real operational data into tables with low setup friction
- keep source provenance visible
- support governed metric and finance modeling on top of collected data
- power reports, presentations, initiatives, and decisions from the same trusted layer
- let users migrate progressively from Airtable and Power BI instead of forcing replacement

## 19. Final recommendation

Consultify should adopt:

- Airtable's ease of operational sync
- Power BI's discipline of governed semantic models

But it should go one step further and connect collected data directly to:

- execution
- decisions
- ROI
- reports
- presentations

That is the strongest path to becoming the central system for data collection and analysis.
