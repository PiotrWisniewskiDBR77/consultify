# DRD — QBank Pack (v2, EN) — Axis 3-4 (Digital Business Models / Data Management)

## Pack meta

- **tool_slug**: `drd`
- **pack_type**: `qbank`
- **pack_version**: `2.0.0`
- **language**: `en`
- **source_kind**: `tool_pack`
- **axes**: `3, 4`
- **source**: `Digital Pathfinder / DBR77` (behavioral evidence-based questions, curated Oxford O1)
- **branded**: `true`

## Provenance (sources)

- Curated question bank: `src/services/assessmentKnowledge/drdKnowledgeOverridesAxis3And4.en.ts`
- Structure (area/axis names): `server/src/data/drdStructure.ts` / `src/services/drdStructure.ts`
- Methodology grounding: `knowledge/tool-kb/drd/methodology/v1/` (Digital Pathfinder, verbatim)
- Supersedes: `knowledge/tool-kb/drd/qbank/v1/` (931B placeholder — generic universal questions only, kept for backward compat)

## Audience + use

- **Used by**: DRD assessment UI (per-level question hints) + AI (tool-scoped RAG retrieval) + Teresa-led DRD sessions
- **Format**: behavioral, evidence-based questions ("kiedy ostatnio X, pokaż dowód") — NOT self-assessment opinion questions
- **Do not use for**: scoring decisions without the evidence the question asks for

---

## Sections (chunk-friendly, per area)

### [section_id:axis3-4-3a] Oś 3 (Digital Business Models) — Obszar 3A: E-commerce Models

#### [level:1] Poziom 1

**Questions (evidence-based):**
- Show us an active online store or marketplace listing — how many SKUs are available online and what % of the full assortment does that represent?
- How does an order placed online reach fulfilment — does someone manually re-key it into the warehouse system, or does the integration run automatically?
- What % of total revenue did the online channel generate last quarter — show us the sales report broken down by channel.

**Evidence / example:**
- Evidence: a dated screenshot of the online store with the product list; a report of online vs in-store orders from the last 30 days; the time from an online order being placed to it appearing in the fulfilment system (SLA: <5 min). Signal: the online store is active and generates regular orders, not just test ones.

**Suggested technologies:**
- E-commerce Platform, Order Management System, Marketplace Integration

#### [level:2] Poziom 2

**Questions (evidence-based):**
- On how many e-commerce or marketplace platforms do you sell simultaneously — show us the list of active integrations and order volume per platform.
- How do you manage stock levels synchronously across all sales channels — what happens when the same product sells at the same time in your own store and on a marketplace?
- What analytics tools track sales performance per online channel, and how often does a manager actually look at that data?

**Evidence / example:**
- Evidence: an e-commerce integration map (channels, systems, stock synchronisation); a per-channel sales report from the last 90 days; a log of an "oversell" event or its absence (stock sync works). Signal: the company sells on ≥2 platforms with synchronous stock management — with no manual babysitting.

**Suggested technologies:**
- Multi-channel E-commerce, Inventory Sync, Marketplace Integration, Sales Analytics

#### [level:3] Poziom 3

**Questions (evidence-based):**
- Show us a product configurator or advanced visualisation tool available to customers online — how does a customer personalise an order before purchase?
- How is customer purchase-history data used to personalise the offer in the online store — show us the actual recommendation mechanism, not plans.
- When did you last change the look or structure of the store based on analytics data (e.g. heatmaps, funnel, A/B test) — what exactly did you change and what was the effect?

**Evidence / example:**
- Evidence: a screenshot of the product configurator in action; a results report from an A/B test on a product-page change; a per-session recommendation log from the last 7 days. Signal: the store is actively optimised based on data — not designed once and forgotten.

**Suggested technologies:**
- Product Configurator, Recommendation Engine, A/B Testing, Web Analytics, Heatmap Tools

#### [level:4] Poziom 4

**Questions (evidence-based):**
- Show us an example of an offer automatically tailored to a specific customer or segment — how does the system decide what to show and what not to?
- How advanced are your marketplace integrations — do you have API integration with every channel, and how do you manage cross-channel pricing policy?
- How do you measure Customer Lifetime Value, and how does CLV influence pricing or offer strategy per segment?

**Evidence / example:**
- Evidence: a personalisation report (per-segment results: conversion, AOV, retention vs no personalisation); the cross-channel pricing policy configuration from the system; a segment CLV report from the last 12 months. Signal: every customer sees an offer generated from their own profile — not the same product page for everyone.

**Suggested technologies:**
- Personalization Engine, Cross-channel Commerce, CLV Analytics, Dynamic Pricing

#### [level:5] Poziom 5

**Questions (evidence-based):**
- What AI, IoT, or blockchain technologies are built into the online sales process — show us working features, not a roadmap.
- How does the online buying experience differ from competitors technologically — what can you show a customer that they cannot see with rivals (VR, AR, AI assistant)?
- Show us conversion and retention data with AI/technology features vs without them — what measurable effect does the technology deliver?

**Evidence / example:**
- Evidence: a live demo of a working AI/AR/VR feature in the online store (not a mock-up); a conversion report for an AI assistant or visual search vs the classic channel; a technical architecture description of the e-commerce stack highlighting AI/IoT elements. Signal: AI technology is deployed in production and measurably improves online sales metrics.

**Suggested technologies:**
- AI Commerce Engine, AR Product Visualization, Conversational Commerce, Blockchain Supply Chain, IoT Integration

### [section_id:axis3-4-3b] Oś 3 (Digital Business Models) — Obszar 3B: Platform Solutions

#### [level:1] Poziom 1

**Questions (evidence-based):**
- Do you use B2B platforms for purchasing or selling — show us the last platform transaction and how settlement is handled.
- How has the B2B platform you use helped optimise purchasing or reach new customers — describe a concrete example with data.
- What % of purchases or sales goes through external platforms versus being handled directly — show a report from the last 12 months.

**Evidence / example:**
- Evidence: a screenshot of an active B2B platform account with the date of the last transaction; a report of purchase/sales volume per platform; a calculation of savings or added revenue from the platform vs the traditional channel. Signal: the platform is an active channel, not just a test account.

**Suggested technologies:**
- B2B Platform, E-procurement, Supplier Portal, Marketplace Analytics

#### [level:2] Poziom 2

**Questions (evidence-based):**
- Do you run your own platform where external suppliers or partners offer products/services to customers — show us the number of active suppliers and transaction volume.
- How do you manage customer experience on the platform when an external supplier is responsible for the transaction — what do you control and what do you delegate?
- What analytics tools and support do you offer suppliers on the platform — show us the supplier panel.

**Evidence / example:**
- Evidence: a screenshot of the platform operator panel with the number of active suppliers and products; a GMV report from the last 90 days; the supplier analytics panel with available metrics. Signal: the platform has ≥5 active external suppliers and generates repeat transactions.

**Suggested technologies:**
- Marketplace Platform, Vendor Management, Platform Analytics, Multi-vendor E-commerce

#### [level:3] Poziom 3

**Questions (evidence-based):**
- How does the platform connect suppliers, partners, and customers into an ecosystem that creates synergy — show us a concrete example of value that no single participant could create alone.
- What market-analysis tools or joint-promotion features do you offer ecosystem participants — show us an example of a platform-wide campaign.
- How do you measure ecosystem health — GMV, supplier retention, participant NPS — and how often do you review these metrics?

**Evidence / example:**
- Evidence: an ecosystem report (GMV, number of active participants, supplier retention) from the last 90 days; an example of a joint promotion or analytics tool for participants; supplier and customer NPS from the last quarter. Signal: the ecosystem grows without active recruiting by the company — the network effect is visible in the data.

**Suggested technologies:**
- Ecosystem Platform, Partner Portal, Loyalty Programme, Market Analytics, Co-marketing Tools

#### [level:4] Poziom 4

**Questions (evidence-based):**
- What SaaS applications are available on your platform beyond the base marketplace — show us the app catalogue and the number of active users per app.
- How do you manage integrations of external SaaS vendors with your platform — do you have an API marketplace and a partner programme?
- What % of platform revenue comes from SaaS apps versus marketplace transactions — and how has that ratio changed year over year?

**Evidence / example:**
- Evidence: the SaaS app catalogue on the platform with prices and user counts; developer API documentation with integration examples; a report of SaaS revenue vs GMV from the last 12 months. Signal: the platform has ≥3 active SaaS integrations generating recurring subscription revenue.

**Suggested technologies:**
- SaaS Marketplace, API Platform, Developer Portal, App Store Management

#### [level:5] Poziom 5

**Questions (evidence-based):**
- How does the platform user community actively co-create value — content, support, innovation — show measurable examples from the last 90 days.
- How do you manage platform governance — do users have real influence over the direction of development and the rules of participation?
- What % of technical issues or user questions are resolved by the community without involving the company's support team?

**Evidence / example:**
- Evidence: a community activity report (posts, resolved issues, UGC) from the last 30 days; a feature-voting mechanism or co-governance charter; the community-containment rate from the helpdesk (% of cases resolved by the community). Signal: the community is healthy — people come back, help each other, and have real influence over the platform.

**Suggested technologies:**
- Community Platform, Governance Tools, Feature Voting, Self-service Community Support

### [section_id:axis3-4-3c] Oś 3 (Digital Business Models) — Obszar 3C: As-a-Service

#### [level:1] Poziom 1

**Questions (evidence-based):**
- Do you offer customers long-term service contracts instead of, or alongside, one-off sales — show us a sample contract and its scope.
- How many active service contracts do you have, and what revenue do they generate relative to one-off sales — show a report from the last 12 months.
- How is service-contract performance measured — SLA, KPIs, review — and what happens when a provider fails to meet the contract?

**Evidence / example:**
- Evidence: a sample service contract with scope, SLA, and price; a report of the number of active contracts and recurring revenue (MRR/ARR); the history of SLA breaches from the last 12 months and how they were handled. Signal: recurring revenue from service contracts is ≥10% of the total — and growing.

**Suggested technologies:**
- Service Contract Management, SLA Monitoring, Customer Success Platform, MRR Analytics

#### [level:2] Poziom 2

**Questions (evidence-based):**
- What subscription or tiered pricing models do you offer, and how are they priced — show the price list and compare it with competitors.
- How do you monitor and guarantee service continuity and quality under the subscription model — what does the customer get for their subscription when something breaks?
- What is the churn rate for subscription models over the last 12 months, and what is the main reason for cancellations?

**Evidence / example:**
- Evidence: the subscription price list with tier descriptions and per-tier SLA; a churn-rate report from the last 12 months with root-cause analysis; the service-monitoring dashboard shown to customers. Signal: monthly churn rate is below 5% and the subscription model has a positive NPS (>30).

**Suggested technologies:**
- Subscription Management, Billing Platform, Churn Analytics, Customer Health Score

#### [level:3] Poziom 3

**Questions (evidence-based):**
- Do you offer pay-per-use or time-based payment for resources — how is it metered and invoiced?
- Show us data on a typical customer usage pattern under pay-per-use — how does consumption vary over a weekly/monthly cycle, and what does that tell you about the model?
- How has the flexibility of the as-a-time/as-a-resource model helped acquire customers who previously could not afford a one-off purchase?

**Evidence / example:**
- Evidence: a resource-usage dashboard per customer with daily/hourly granularity; a sample invoice from the pay-per-use model with line items; a report of new customers acquired thanks to pricing flexibility. Signal: customers actively manage their own consumption because the system enables it — they are not paying one flat rate for everything.

**Suggested technologies:**
- Usage-based Billing, Metering System, Resource Monitoring, Flexible Pricing Engine

#### [level:4] Poziom 4

**Questions (evidence-based):**
- Do you deliver services under an outcome-based model (payment for results, not time/resources) — show us a contract and how you measure the achieved outcome.
- How do you negotiate and define the "outcome" with the customer at the start of an outcome-based contract — what is measurable, what is disputed, and how do you resolve disputes?
- Show us an example of an outcome-based project from the last 12 months: what was the outcome, was it achieved, and how did it affect the customer relationship?

**Evidence / example:**
- Evidence: an outcome-based contract with KPI definitions and measurement methodology; a report of achieved vs contracted outcomes from the last 12 months; the history of disputes and how they were resolved. Signal: the company has ≥3 active outcome-based contracts and a track record of delivery backed by data.

**Suggested technologies:**
- Contract Performance Management, Outcome Measurement, KPI Dashboards, Value-based Pricing

#### [level:5] Poziom 5

**Questions (evidence-based):**
- Do you manage a customer's entire business process as a BPO or full-scale managed-service provider — what exactly have you taken over, and how do you measure effectiveness?
- How do you integrate with the customer's systems when managing their process — what data do you exchange, and how often?
- Show us an effectiveness report for a managed customer process from the last 3 months — what value did you create beyond what the customer would have achieved alone?

**Evidence / example:**
- Evidence: the BPO/MSP SLA agreement with the scope of processes taken over; a results report for the managed process (KPI improvement vs baseline); the systems integration architecture with the data-exchange design. Signal: the customer can measure the improvement in their business results thanks to outsourcing the process — and says so publicly (case study).

**Suggested technologies:**
- Managed Service Platform, Process Automation, Client Reporting Portal, BPO Analytics

### [section_id:axis3-4-3d] Oś 3 (Digital Business Models) — Obszar 3D: Asset Sharing Models

#### [level:1] Poziom 1

**Questions (evidence-based):**
- What digital assets (files, applications, data, content) do you make available to other companies or users — on what basis, and for how much?
- How do you manage access rights to the digital assets you share — who can use them, who cannot, and how is that controlled?
- How many active users use your shared digital assets each month, and what revenue does that generate?

**Evidence / example:**
- Evidence: a list of shared digital assets with the licensing model and price list; a report of active users/subscribers from the last 30 days; a sample invoice for access to a digital asset. Signal: digital assets are shared under an organised model, not ad hoc via USB stick or email.

**Suggested technologies:**
- Digital Asset Management, License Management, Access Control, Content Delivery

#### [level:2] Poziom 2

**Questions (evidence-based):**
- Do you offer rental of physical assets (machinery, vehicles, real estate, equipment) via a digital platform — show us how a customer books and pays.
- How do you monitor the condition and location of the physical assets rented to customers — what does the customer see, and what does your operations team see?
- How many rentals are currently active, and what is the average rental value — show us a report from the system.

**Evidence / example:**
- Evidence: a screenshot of the booking platform with available assets and a calendar; a real-time asset-condition monitoring dashboard; a rental report (count, value, OTIF) from the last 90 days. Signal: a customer can book, pick up, and return an asset without any human contact on the company's side.

**Suggested technologies:**
- Asset Rental Platform, IoT Asset Tracking, Booking System, Fleet Management

#### [level:3] Poziom 3

**Questions (evidence-based):**
- Do you make knowledge, competencies, or intellectual work available to other parties under a sharing model — show us an example and the settlement model.
- How does the platform connect "knowledge providers" (experts, freelancers) with "recipients" (companies, learners) — what is your role in this model?
- How do you verify the quality of the knowledge or competencies offered on the platform — ratings, certificates, work samples?

**Evidence / example:**
- Evidence: a screenshot of the knowledge-sharing platform with expert profiles and reviews; a report of expert-customer matches from the last 30 days; the quality-rating mechanism with examples. Signal: the platform has active knowledge providers with documented results — not just a base of empty profiles.

**Suggested technologies:**
- Knowledge Marketplace, Expert Matching, Skill Verification, Learning Platform

#### [level:4] Poziom 4

**Questions (evidence-based):**
- How do you bill customers for the time they use physical assets — is it automatic based on device/sensor data, or manual?
- What happens when an asset is damaged or lost during a rental — how does the system detect it, and what is the claims process?
- How do you optimise asset availability (minimising downtime, maximising utilisation) — what tools and data do you use for that?

**Evidence / example:**
- Evidence: a billing log from the last month with a per-asset breakdown (usage time, amount); a utilisation report (% active time vs downtime) with a trend; the claims history from the system log (detection time, resolution time). Signal: utilisation is ≥70% — assets are working, not sitting idle.

**Suggested technologies:**
- Usage Metering, Asset Utilization Analytics, Damage Detection, Dynamic Availability

#### [level:5] Poziom 5

**Questions (evidence-based):**
- Do you make IT infrastructure, analytics tools, or logistics services available to other companies as full-scale business solutions — show us an example.
- How do you scale the business-asset-sharing model — what limits growth, and how do you plan to overcome it?
- What is the ROI for customers using your sharing model versus owning their own assets — show us a calculation or case study.

**Evidence / example:**
- Evidence: a customer case study using shared infrastructure/logistics with a savings calculation; a model-scalability report (number of customers vs cost to serve per customer); the solution architecture documentation. Signal: the sharing model has economies of scale — the cost of serving the next customer is lower than serving the first.

**Suggested technologies:**
- Shared Infrastructure Platform, White-label Services, Capacity Management, Multi-tenant Architecture

### [section_id:axis3-4-3e] Oś 3 (Digital Business Models) — Obszar 3E: Data Monetization Models

#### [level:1] Poziom 1

**Questions (evidence-based):**
- What customer data do you collect and for what purpose — show us the data-processing register (GDPR) and how it is used to improve the offer.
- Who in the company owns customer data and is responsible for its accuracy and quality — how do you measure data completeness?
- When did customer-behaviour data last lead to a concrete change in the product or offer — describe the instance with a date and a measurable effect.

**Evidence / example:**
- Evidence: the data-processing register (GDPR) with the list of datasets and purposes; a customer-data quality report (% completion of key fields); an example of an offer change driven by data analysis, with the decision date. Signal: the company uses customer data to make decisions, not just to send newsletters.

**Suggested technologies:**
- CRM, Customer Data Platform (CDP), Data Quality Tools, GDPR Compliance

#### [level:2] Poziom 2

**Questions (evidence-based):**
- What advanced customer-data analyses do you run — segmentation, cohorts, churn prediction — and who does them: a BI analyst, an automated tool, or Excel?
- Show us an analytics report from the last 30 days that revealed an unexpected customer-behaviour pattern or a new market opportunity.
- How often do executives or directors make business decisions explicitly citing data from the analytics system — is that a real culture, or an exception?

**Evidence / example:**
- Evidence: a dated analytics report from the BI system (not Excel); an example of an executive decision with the data source attributed (meeting minutes); a list of recurring analyses with frequency and owner. Signal: data is regularly consumed by decision-makers — not just generated by IT.

**Suggested technologies:**
- BI Platform, Cohort Analysis, Customer Analytics, Predictive Analytics

#### [level:3] Poziom 3

**Questions (evidence-based):**
- How do you personalise the offer based on the data you collect — what exactly changes for customer A vs customer B on the site/in communications?
- Show us a personalisation algorithm or rule that runs in production — where does the "signal" come from, and what does it trigger on the offer side?
- How do you measure the effectiveness of personalisation — what is the conversion or loyalty uplift for the personalised group vs the control group?

**Evidence / example:**
- Evidence: an A/B test report on personalisation with a control group and results (conversion, CLV, NPS); a description of the personalisation rule or model with inputs and outputs; a personalisation log for 3 specific customers from the last 7 days. Signal: personalisation has a proven business effect — it is not just the marketer's "intuition".

**Suggested technologies:**
- Personalization Engine, Recommendation System, A/B Testing Platform, Real-time Decisioning

#### [level:4] Poziom 4

**Questions (evidence-based):**
- Do you sell data or data-derived insights as a standalone product/service to partners or the market — show us a sample offer and contract.
- How do you ensure customer-data privacy and security when commercialising it — what technologies (anonymisation, aggregation, differential privacy) do you use?
- What revenue has data monetisation generated as a separate business line over the last 12 months — and how is it growing?

**Evidence / example:**
- Evidence: a sample data product or analytics report sold to an external customer; the data-anonymisation mechanism with technical documentation; a data-monetisation revenue report with a 12-month trend. Signal: data is a revenue-generating asset, not just an operational resource — and that revenue is visible in the P&L.

**Suggested technologies:**
- Data Marketplace, Data Anonymization, API Monetization, Differential Privacy

#### [level:5] Poziom 5

**Questions (evidence-based):**
- What products, services, or business models exist entirely because of the data you hold — what would not be possible without that data?
- How does data feed machine-learning loops that automatically improve your products or services — show us the closed loop in action.
- How do you value and manage data as a corporate asset — does data have an owner, a budget, and a value account?

**Evidence / example:**
- Evidence: a description of a data-native product or service with a data-flywheel architecture; a report on ML model improvement over time (drift monitoring, retraining schedule); a valuation of data assets on the balance sheet or in an internal ledger (data P&L). Signal: the company knows what its data is worth and manages it like capital — not like production waste.

**Suggested technologies:**
- Data Mesh, ML Platform, Data Catalog, Data Valuation Framework, AI Product Suite

### [section_id:axis3-4-4a] Oś 4 (Data Management) — Obszar 4A: Data Collection

#### [level:1] Poziom 1

**Questions (evidence-based):**
- How do employees record data about their work — paper form, routing card, spreadsheet, or mobile app? Show us a sample form from the last week.
- What % of operational data (orders, production, service) is entered manually by a person versus collected automatically?
- What happened when a weekly report was due and an employee forgot to fill in the form — did we end up with a data gap, and did the system detect it?

**Evidence / example:**
- Evidence: a sample data-recording form or card from the last week; the % of data from manual vs automatic sources per process (sales, production, logistics); a report of data gaps (missing records) from the last 30 days. Signal: data on key processes exists digitally — even if entered by a person.

**Suggested technologies:**
- Digital Forms, Mobile Data Entry, Basic ERP/CRM, Spreadsheet Automation

#### [level:2] Poziom 2

**Questions (evidence-based):**
- Where in production, warehousing, or sales processes do you use barcodes or QR codes to identify and track objects — show us the scanners in use.
- What does the system record at the moment of scanning a code, and how quickly is that information visible to other users?
- What % of warehouse items or products have an assigned barcode/QR code, and what happens to the ones without one?

**Evidence / example:**
- Evidence: a system screenshot with the scan history from the last 24h; the % of items with a code in the system; the time from scanning to visibility in the system (SLA: <30 sec). Signal: the barcode or QR code is the standard — an exception requires justification, not the other way round.

**Suggested technologies:**
- Barcode Scanners, QR Code System, Label Printers, Inventory Tracking

#### [level:3] Poziom 3

**Questions (evidence-based):**
- Where do you use RFID for automatic identification and tracking — show us the coverage (warehouse, production, assets) and what is tagged.
- What does RFID do automatically that barcodes could not — show us a concrete instance: what data does it collect, and what does it trigger in the system without human involvement?
- How often do RFID read errors occur, and how are they handled (fallback, alert, manual correction)?

**Evidence / example:**
- Evidence: a map of RFID reader placement on the facility floor plan; an RFID event report from the last 24h (count, error rate); an example of an automatic system action triggered by an RFID read. Signal: RFID collects data without operator involvement — a human sees the results, not generates them.

**Suggested technologies:**
- RFID Readers, RFID Tags, RFID Middleware, Asset Tracking System

#### [level:4] Poziom 4

**Questions (evidence-based):**
- Which machines or devices collect data automatically via sensors (temperature, pressure, speed, vibration) — how many are there, and what do they measure?
- How does data from machines reach the IT system — direct integration, PLC-to-SCADA-to-MES, or manual re-keying from a display?
- When did a machine sensor last detect a parameter deviation before a failure or defect occurred — describe the instance.

**Evidence / example:**
- Evidence: a list of machines with sensors and measured parameters (OT inventory); the data-flow architecture (sensor → PLC → SCADA → MES); a log of a parameter deviation from the last 30 days with the action taken. Signal: at least one critical machine sends data automatically to the analysis system without a manual reading.

**Suggested technologies:**
- Industrial IoT Sensors, PLC, SCADA, Machine Data Integration, MES

#### [level:5] Poziom 5

**Questions (evidence-based):**
- What data do you collect from mobile apps used by employees in the field or on the shop floor — what do they record, how often, and who has access?
- How is location or behavioural data from mobile devices integrated into management processes — what decisions can leadership make thanks to this data?
- How do you ensure offline capability — what happens to mobile data when an employee loses signal or network connection?

**Evidence / example:**
- Evidence: a list of mobile apps in use with the types of data collected; a user-activity report from the last 7 days; a test of offline mode — how the app behaves without internet and what happens to the data once connectivity is restored. Signal: field data reaches the system near real-time, not via email once a week.

**Suggested technologies:**
- Mobile Data Collection, Field Service App, Offline Sync, GPS Tracking

#### [level:6] Poziom 6

**Questions (evidence-based):**
- What environmental sensors collect data from buildings, machines, or production processes (temperature, humidity, CO2, motion, lighting) — show us the sensor network.
- How is environmental data from physical sensors integrated with the management or reporting system — who looks at it, and how often?
- When did an environmental sensor last detect a condition requiring action, and what did the system do automatically?

**Evidence / example:**
- Evidence: a sensor-network map with types and locations; a real-time environmental-data dashboard; a sensor-alert log from the last 30 days with the action taken. Signal: environmental data is continuously monitored — not just checked once a year during an inspection.

**Suggested technologies:**
- Environmental Sensors, IoT Gateway, Building Management System, Edge Computing

#### [level:7] Poziom 7

**Questions (evidence-based):**
- Where do you use optical inspection systems (cameras, machine vision) to collect data on quality or the condition of objects — what exactly is being analysed?
- How quickly does the vision system analyse an image and what decision does it make — what triggers a "defect detected" state, and what happens in the following 10 seconds?
- Show us data on the effectiveness of the vision system: how many defects did it detect last month, what was the false-positive rate, and how does it compare with manual inspection?

**Evidence / example:**
- Evidence: a defect-detection report from the vision system for the last month (count, types, TP/FP); a flow diagram from detection to action (line stop, logging, segregation); a comparison of detection effectiveness: camera vs inspector. Signal: the vision system is in production and replaces or supports manual inspection on at least one line.

**Suggested technologies:**
- Machine Vision, Industrial Cameras, Computer Vision AI, Defect Detection System

### [section_id:axis3-4-4b] Oś 4 (Data Management) — Obszar 4B: Data Storage Methodology

#### [level:1] Poziom 1

**Questions (evidence-based):**
- Where do you store financial, production, or HR documents and data — paper archive, binders, or is there also an electronic version?
- How do you find an old invoice or minutes from 2 years ago — how long does it take, and how much human effort does it require?
- What happens to historical data when an employee leaves — is the knowledge in the system, or in their desk drawer?

**Evidence / example:**
- Evidence: a description (or photo) of the current paper archive with its scope and time period; the time to find a random document from a year ago (benchmark test); the paper-data retention policy. Signal: even with traditional methods — documents are systematised and can be found in under 15 minutes.

**Suggested technologies:**
- Document Scanning, Physical Archive Management, Basic DMS, Retention Policy

#### [level:2] Poziom 2

**Questions (evidence-based):**
- Which systems or machines store data only locally on a single device with no synchronisation — what happens if that device fails?
- How is local data backed up — manually to a USB stick, automatically to a NAS, or is there no backup at all?
- When did you last lose data to a local-device failure — what did it cost, and how did you protect yourselves afterwards?

**Evidence / example:**
- Evidence: a list of systems with local (single-device) data storage; the backup policy with the date of the last restore test; a report of data-loss incidents from history. Signal: even data on a single device has a backup — and someone regularly tests restoring it.

**Suggested technologies:**
- Local Backup, NAS Storage, Automated Backup, Recovery Testing

#### [level:3] Poziom 3

**Questions (evidence-based):**
- What does the company's data "map" look like — where are the servers, network drives, local employee drives? Who knows this map, and is it up to date?
- What happens when two employees edit the same file at the same time from different computers — version conflict, overwrite, or does the system prevent it?
- How does a remote employee, or one at a second location, get access to files — VPN, network drive, cloud, or do they have to physically come and get a USB stick?

**Evidence / example:**
- Evidence: a data-storage map with location and type (paper/local/networked); the file-naming and folder-structure policy; a report of version-conflict incidents from the last 30 days (or the absence thereof). Signal: the company knows where its data is — and can find it without asking a specific employee.

**Suggested technologies:**
- Network File Server, Version Control, File Sharing, Remote Access VPN

#### [level:4] Poziom 4

**Questions (evidence-based):**
- What is your private cloud infrastructure (on-premise cloud) — hardware, software, who manages it, and what is the availability SLA?
- How do you manage capacity on your local cloud — what happens when storage fills up? Who monitors it, and how automatically?
- How is the local cloud protected against physical disaster (fire, flood, theft) and against cyberattack?

**Evidence / example:**
- Evidence: architecture documentation for the local cloud (hardware, hypervisor, storage tiers); an availability report from the last 90 days (uptime %); the DR/BCP policy with the date of the last test. Signal: the local cloud has an SLA and monitoring — it is not just a server in a cabinet without a UPS.

**Suggested technologies:**
- VMware / Hyper-V, On-premise Cloud, Storage Management, Disaster Recovery

#### [level:5] Poziom 5

**Questions (evidence-based):**
- Which cloud services (AWS, Azure, GCP, others) do you use, and for what — a list of services with data volume and monthly cost.
- How do you manage public-cloud costs — do you have FinOps / cost monitoring, and does someone regularly optimise usage?
- How is data in the public cloud secured — encryption at rest and in transit, access management, the provider's compliance certifications?

**Evidence / example:**
- Evidence: a list of active cloud services (provider, service, region, monthly cost); a usage and cost report from a FinOps tool for the last 90 days; the public-cloud data-security policy. Signal: the cloud is managed — costs, resources, and the person responsible for each service are known.

**Suggested technologies:**
- AWS / Azure / GCP, Cloud Cost Management, FinOps, Cloud Security

#### [level:6] Poziom 6

**Questions (evidence-based):**
- What data do you store in a private (dedicated) cloud versus a public one — what determines the choice, and how is it managed?
- How does the private cloud ensure isolation of sensitive data — what does the external provider get, and what do they absolutely not get?
- How do you manage configuration and provisioning of resources in the private cloud — manually by an admin, or Infrastructure as Code?

**Evidence / example:**
- Evidence: a data-classification policy mapping data types to storage environments; private-cloud architecture documentation (topology, isolation); the IaC configuration from a git repository with the date of the last change. Signal: the decision of what goes to the private vs public cloud is documented and enforced — it does not rely on an admin's intuition.

**Suggested technologies:**
- Private Cloud, IaC (Terraform/Ansible), Data Classification, Secure Enclave

#### [level:7] Poziom 7

**Questions (evidence-based):**
- Show us a data-storage strategy spanning edge, private cloud, and public cloud simultaneously — what goes where, and why?
- How do you optimise storage cost and performance: which data is hot (access <ms), warm (minutes), cold (hours-days)?
- When was the storage architecture last reviewed, and who decided to change the tier or environment for a specific dataset?

**Evidence / example:**
- Evidence: a hybrid architecture diagram (edge/on-prem/private cloud/public cloud) with the rationale for each tier; the tiering policy with rules for automatic data migration; a cost-and-performance report per tier from the last 90 days. Signal: the hybrid architecture is actively managed — it is not an accidental sum of historical decisions.

**Suggested technologies:**
- Hybrid Cloud, Edge Computing, Data Tiering, Storage Orchestration, FinOps

### [section_id:axis3-4-4c] Oś 4 (Data Management) — Obszar 4C: Data Communication

#### [level:1] Poziom 1

**Questions (evidence-based):**
- Show us a sample paper report or printout used to pass data between departments — what does it contain, who prints it, and how often?
- What happens to a paper report after it is used — does it go to an archive, a shredder, or a drawer? How long is it kept?
- When did a missing paper report last lead to a decision based on outdated data — describe the instance.

**Evidence / example:**
- Evidence: a sample printed report with a date and data fields; the time from printing to use by a decision-maker (SLA: <24h); a list of paper reports with frequency and recipients. Signal: even with paper reports — there is a regular rhythm and defined recipients, the data is not haphazard.

**Suggested technologies:**
- Print Management, Document Distribution, Basic Reporting, Archive System

#### [level:2] Poziom 2

**Questions (evidence-based):**
- What data do you regularly send by email as operational reports or information — show us the last example, who sent it, and what the attachment contained.
- How do you manage versions of reports sent by email — how does the recipient know they got the most current version?
- What happens when an email with an important report lands in spam or does not arrive — how do you detect that, and how do you react?

**Evidence / example:**
- Evidence: a sample email with an operational report (body and attachment); the history of recurring sends from the last 30 days (frequency, recipients); the number of "I didn't get the report" complaints from the last quarter. Signal: email reports have a defined rhythm and recipient list — they are not sent "whenever someone asks".

**Suggested technologies:**
- Email, Report Distribution, File Sharing, Automated Reporting

#### [level:3] Poziom 3

**Questions (evidence-based):**
- Show us the physical topology of the LAN at the main location — where are the switches, how are the segments divided, and what is the bandwidth of critical links?
- How do you monitor LAN availability — do you have a monitoring tool, and who gets alerted when something goes down?
- When did an Ethernet network failure last affect access to business systems — how long did it last, and how did you respond?

**Evidence / example:**
- Evidence: a LAN topology diagram with the last update date; a screenshot of the network-monitoring tool (uptime, latency, bandwidth) from the last 24h; a report of network incidents from the last 6 months with restoration time. Signal: the network has an inventory, monitoring, and an incident history — someone is accountable for it.

**Suggested technologies:**
- Network Management, Ethernet Switch, Network Monitoring, LAN Documentation

#### [level:4] Poziom 4

**Questions (evidence-based):**
- Where do you use an Industrial Ethernet network (PROFINET, EtherNet/IP, MODBUS TCP), and what does it connect — machines, PLCs, SCADA, IT systems?
- How is the industrial network separated from the office network — what passes through the DMZ, what is fully isolated?
- What is the availability SLA for the industrial network, and what happens to production if it fails — do you have a fallback?

**Evidence / example:**
- Evidence: an OT network map with protocols and devices; OT/IT segmentation documentation (DMZ, firewall rules); the industrial-network availability SLA with a history of outages. Signal: the industrial network is managed separately from the office network — it is not "the same cable as the printer".

**Suggested technologies:**
- Industrial Ethernet, PROFINET / EtherNet/IP, OT/IT Segmentation, Industrial Firewall

#### [level:5] Poziom 5

**Questions (evidence-based):**
- Where and how do you use wireless networks (WiFi, industrial WLAN, 5G) to collect or transmit operational data?
- How do you ensure reliable wireless connections in demanding environments (production floor, warehouse, outdoors) — coverage, handover, interference?
- What happens to mobile or IoT devices when they lose WiFi signal — how is data from that period handled?

**Evidence / example:**
- Evidence: a WiFi/WLAN coverage map marking dead spots; a signal-quality and retransmission report from the last 7 days; the offline-device handling policy (buffering and sync). Signal: wireless devices have guaranteed reliability through redundancy or offline buffering — they do not simply "not work" when WiFi is missing.

**Suggested technologies:**
- Industrial WLAN, WiFi 6, 5G Private Network, Wireless Site Survey

#### [level:6] Poziom 6

**Questions (evidence-based):**
- How are the company's different locations (branches, warehouses, factories) connected to each other — VPN, MPLS, SD-WAN, cloud? Show us the WAN topology.
- What is the guaranteed bandwidth and SLA of the WAN links between locations, and how do you respond when they fail?
- How do remote employees get access to internal systems — VPN, zero-trust, or does it differ per system or user group?

**Evidence / example:**
- Evidence: a WAN topology diagram with links, providers, and bandwidths; the provider SLA with a delivery history; the remote-access policy with MFA authentication. Signal: the company has an SLA on WAN links and a procedure for when the primary link fails — it does not sit idle waiting for a fix.

**Suggested technologies:**
- SD-WAN, MPLS, VPN, Zero Trust Network Access, WAN Monitoring

#### [level:7] Poziom 7

**Questions (evidence-based):**
- How are applications, data, and compute resources delivered from the cloud — which PaaS/IaaS/SaaS services are the central data-communication channel in the company?
- How do you manage APIs between systems and cloud services — do you have an API gateway or event bus, or do systems talk to each other directly?
- How do you scale data-communication throughput as load grows — automatic cloud scaling, or do you have to manually buy more capacity?

**Evidence / example:**
- Evidence: a cloud-communication architecture diagram (API gateway, event streaming, CDN); an availability and latency report for cloud services from the last 90 days; an example of automatic scaling (auto-scaling event) from the log. Signal: the communication architecture is cloud-native — scaling is automatic and users do not feel the change in load.

**Suggested technologies:**
- API Gateway, Event Streaming (Kafka), CDN, Cloud Architecture, Service Mesh

### [section_id:axis3-4-4d] Oś 4 (Data Management) — Obszar 4D: Big Data Analysis

#### [level:1] Poziom 1

**Questions (evidence-based):**
- What database management systems (DBMS) do you have in the company — MySQL, PostgreSQL, Oracle, SQL Server — and what is each used for?
- How do you manage the database schema — who can change it, how are changes documented, and how are migrations tested?
- Show us a sample SQL query that answers a business question (e.g. sales per customer last quarter) — can a manager run this themselves, or do they wait on IT?

**Evidence / example:**
- Evidence: a list of active databases with schema documentation and an owner; an example analytical query with its result; the time from a business question to a data report (SLA: <1 business day). Signal: data lives in a relational database — not just in managers' spreadsheets.

**Suggested technologies:**
- RDBMS (PostgreSQL/MySQL), SQL, Database Documentation, Query Tools

#### [level:2] Poziom 2

**Questions (evidence-based):**
- What ETL or ELT systems do you have for moving and transforming data between source systems and analytical systems?
- Show us an ETL pipeline that runs regularly — from where, to where, how often, what it transforms, and how you monitor whether it succeeded.
- When did an ETL pipeline last fail — what happened to the analytics report, who detected it, and how quickly was it fixed?

**Evidence / example:**
- Evidence: an ETL pipeline diagram with source and destination systems; a log of ETL runs from the last 7 days (success/failure, duration); an alert following an ETL failure with its history. Signal: ETL runs regularly and is monitored — a failure is detected automatically, not by accident.

**Suggested technologies:**
- ETL/ELT Platform, Data Pipeline, Apache Airflow, dbt, Pipeline Monitoring

#### [level:3] Poziom 3

**Questions (evidence-based):**
- Show us an active BI dashboard used by managers for daily decisions — where does it come from, who uses it, and how often?
- How do employees (not analysts) create their own ad hoc charts or reports — do they have a self-service BI tool, or must they ask IT?
- When did a data visualisation last reveal a trend or anomaly that would not have been visible in a table of numbers — describe the instance.

**Evidence / example:**
- Evidence: a screenshot of the BI dashboard with the last refresh date and the number of active users (30 days); an ad hoc report created by a business user (not IT) in the last week; an anomaly detected via visualisation with the resulting decision. Signal: BI is used by business people, not just by IT analysts.

**Suggested technologies:**
- BI Platform (Power BI/Tableau), Self-service Analytics, Data Visualization, Embedded Analytics

#### [level:4] Poziom 4

**Questions (evidence-based):**
- What big data platforms (Hadoop, Spark, Databricks, Snowflake) or their equivalents do you use to process large data volumes?
- Show us a big data analysis pipeline — how is data larger than 100GB processed, how long does it take, and how do you scale computation under heavier load?
- What business decisions do you use big data analysis results for — show us the most recent decision based on analysis of a large dataset.

**Evidence / example:**
- Evidence: the big data platform architecture with technologies and data volumes; a big data analysis report tied to a business decision with a date; the processing time for 1TB of data in that pipeline (benchmark). Signal: the company analyses data volumes that would not fit in Excel — and does so regularly in decision-making processes.

**Suggested technologies:**
- Apache Spark, Databricks, Snowflake, BigQuery, Distributed Computing

#### [level:5] Poziom 5

**Questions (evidence-based):**
- How do you check and ensure data quality across your systems — processes, tools, validation rules, who is it reported to?
- Show us a data-quality report from the last 30 days — what problems were found (duplicates, gaps, inconsistencies), and how were they fixed?
- Who owns data quality per area (sales, production, HR), and how are standards enforced?

**Evidence / example:**
- Evidence: a data-quality report from a tool (Great Expectations, dbt tests, Informatica) for the last 30 days; a list of data owners with their responsibilities; the time from detecting a quality issue to fixing it (SLA). Signal: data quality is measured and managed — it is not just known to be a problem with nobody accountable for fixing it.

**Suggested technologies:**
- Data Quality Platform, dbt Tests, Data Profiling, Data Governance, Master Data Management

#### [level:6] Poziom 6

**Questions (evidence-based):**
- Where do you use data simulation to test business or operational scenarios — show us the last simulation and the decision it led to.
- How do you generate synthetic data to test systems or ML models — what tools do you use, and how do you verify the realism of the synthetic data?
- When did a data simulation help you avoid a costly mistake or reduce decision risk — describe the instance.

**Evidence / example:**
- Evidence: a report from the last data simulation (parameters, scenarios, results); a comparison of synthetic vs real data (statistical tests); a decision made based on the simulation with a date and a measurable effect. Signal: the company uses simulation before rolling out a change in production — not just analysing what went wrong after the fact.

**Suggested technologies:**
- Data Simulation Tools, Synthetic Data Generation, Monte Carlo Simulation, Digital Twin

#### [level:7] Poziom 7

**Questions (evidence-based):**
- What machine-learning models run in production in the company — what do they predict, on what data are they trained, and how often are they retrained?
- How do you monitor ML model quality in production — do you track drift, prediction-quality degradation, and who acts when a model degrades?
- Show us a case where an ML model changed a business decision for the better — what was the baseline (without the model), and what was the result with the model?

**Evidence / example:**
- Evidence: a register of ML models in production (model, purpose, metrics, deployment date); a model-monitoring report (accuracy/F1 trend for the last 90 days); an A/B test or before/after analysis of the model's effect on a business metric. Signal: ML is in production and measurably improves the outcome — it is not just an experiment in an analyst's notebook.

**Suggested technologies:**
- MLOps Platform, Model Registry, Model Monitoring, ML Pipeline, Feature Store

### [section_id:axis3-4-4e] Oś 4 (Data Management) — Obszar 4E: Computing

#### [level:1] Poziom 1

**Questions (evidence-based):**
- On which desktop computers or laptops does analytical and operational data processing happen — how old is the hardware, and what are its limitations?
- What happens when an employee has to process a large file or report — does the computer slow down, freeze, or handle it without issue?
- How long does it take to generate a monthly report on a local computer, and is that acceptable to the user?

**Evidence / example:**
- Evidence: an IT hardware inventory with age, RAM, CPU (IT asset inventory); the generation time for a standard monthly report (benchmark); the number of "computer too slow" helpdesk tickets from the last 90 days. Signal: the hardware is sufficient for current needs — users are not waiting on their computer.

**Suggested technologies:**
- PC Hardware, IT Asset Management, Performance Monitoring, Desktop Virtualization

#### [level:2] Poziom 2

**Questions (evidence-based):**
- What physical or virtual servers process company data — where are they, who manages them, and what load do they handle?
- How do you monitor server resource utilisation (CPU, RAM, storage), and how do you respond as they approach the limit?
- When was a server last overloaded or did it last go down — how did that affect the business, and how quickly was it fixed?

**Evidence / example:**
- Evidence: a server inventory with configuration and roles; a CPU/RAM/storage utilisation report from the last 30 days; the server-maintenance SLA and incident history. Signal: servers are monitored and have a clearly defined owner and failure procedure.

**Suggested technologies:**
- Server Infrastructure, Virtualization (VMware), Server Monitoring, Capacity Planning

#### [level:3] Poziom 3

**Questions (evidence-based):**
- Do you have a server cluster (load balancing, failover, shared storage) — show us the architecture and what it protects against failure.
- How does the cluster handle the failure of one node — what happens to the applications, how long does failover take, and do users notice?
- Show us the most recent cluster failover test — when was it, what was the scenario, and what was the recovery time (RTO)?

**Evidence / example:**
- Evidence: a cluster diagram with nodes, network, and storage; a report from the last failover test (date, scenario, RTO); cluster monitoring with availability alerts. Signal: the cluster has a tested failover — the company knows how long recovery takes because it has measured it.

**Suggested technologies:**
- Clustering, Load Balancing, High Availability, Shared Storage

#### [level:4] Poziom 4

**Questions (evidence-based):**
- Do you participate in grid computing or shared compute capacity with other organisations — why, and how?
- How do you manage access to compute resources in a grid model — priorities, limits, cost settlement?
- What computational tasks use external or shared resources — what would not fit on your own infrastructure?

**Evidence / example:**
- Evidence: documentation of grid-computing participation (provider, scope, SLA); a report of computational jobs run on external infrastructure from the last 90 days; a cost calculation of grid vs owned infrastructure. Signal: grid computing is used for specific computational tasks — not just as a theoretical option.

**Suggested technologies:**
- Grid Computing, HPC Clusters, Distributed Workloads, Research Computing

#### [level:5] Poziom 5

**Questions (evidence-based):**
- What public-cloud compute services (EC2, Azure VM, GCP Compute) do you run, and for how long do they typically run — on-demand, reserved, or spot?
- How do you optimise cloud-compute costs — auto-scaling, spot instances, reserved capacity — show us a savings report from the last 3 months.
- What would stop working without cloud compute — what would have to change if the cloud became unavailable?

**Evidence / example:**
- Evidence: a cloud-compute usage report broken down by service and cost; an auto-scaling configuration with logs from the last 7 days; a savings report comparing reserved vs on-demand. Signal: cloud compute is cost-managed — the company knows what it pays for and why.

**Suggested technologies:**
- Cloud Compute (EC2/Azure VM), Auto-scaling, Spot Instances, Cloud Cost Management

#### [level:6] Poziom 6

**Questions (evidence-based):**
- Where do you use edge computing — processing data close to its source (at the machine, in a vehicle, at the point of sale) — what do you process there, and why not in the cloud?
- How do you manage a fleet of edge devices — software updates, monitoring, security — show us the fleet-management panel.
- What happens when an edge device loses connection to the cloud — how long can it operate autonomously, and what does it buffer?

**Evidence / example:**
- Evidence: a deployment map of edge devices with their computational tasks; an edge-fleet management panel with software version and device status; the offline-mode policy with maximum autonomy time and buffering scope. Signal: edge computing solves a concrete latency or offline problem — it is not there just because it is trendy.

**Suggested technologies:**
- Edge Computing Devices, Fleet Management, Edge AI, Offline First Architecture

#### [level:7] Poziom 7

**Questions (evidence-based):**
- Are you researching or planning quantum-computing applications in your industry — for what problems, and with which partners or vendors?
- What quantum algorithms or quantum simulators have you tested — what were you trying to solve, and what were the preliminary results?
- How do you assess the time horizon on which quantum computing will become relevant to your industry — and what are you doing today to be ready?

**Evidence / example:**
- Evidence: documentation of an experiment with a quantum simulator or QPU (AWS Braket, Azure Quantum, IBM Quantum) with results; a use-case analysis of quantum for the industry with a technology-maturity assessment; a partnership or research programme in quantum computing. Signal: the company actively tracks quantum computing — it has people who understand and experiment with it, not just read articles.

**Suggested technologies:**
- Quantum Computing (IBM Q / AWS Braket), Quantum Simulation, Post-quantum Cryptography, Quantum Research Programs
