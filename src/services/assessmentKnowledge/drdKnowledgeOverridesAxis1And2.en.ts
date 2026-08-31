/**
 * DRD_KNOWLEDGE_OVERRIDES (EN) — Axis 1 (Digital Processes, 9 areas × 7 levels)
 *                              + Axis 2 (Digital Products, 5 areas × 5 levels)
 *
 * Oxford O1 · batch 1 · 2026-07-02 · EN mirror of drdKnowledgeOverridesAxis1And2.ts
 *
 * Question format: behavioral — we ask about behavior, an artifact, or an
 * event, NOT self-assessment. Canon pattern §9.2:
 *   "When did you last do X? Show us that case."
 *   "What did the system do when Y happened? What log/screenshot do you have?"
 *
 * The `example` field doubles as `expectedEvidence` (the DRDLevelKnowledge type
 * has no separate evidence field; we fold it in here as guidance for the
 * consultant).
 *
 * This is a faithful consulting-grade translation of the Polish source, not a
 * literal one — tone, register, and the behavioral/evidentiary character of
 * each question are preserved. `suggestedTechnologies` are kept identical to
 * the PL file (already English acronyms/tech terms).
 *
 * Keys mirror the Polish source 1:1 (88 keys total). English axis/area names
 * per drdStructure.ts: Axis 1 = Digital Processes, Axis 2 = Digital Products.
 */

import type { DRDAreaLevelKey, DRDLevelKnowledge } from './drdKnowledge';

export const DRD_OVERRIDES_AXIS_1_2_EN: Partial<
  Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>
> = {
  // ================================================================
  // AXIS 1A — SALES PROCESSES (7 levels)
  // ================================================================

  '1A#1': {
    questions: [
      'Show us the last 10 orders in the system — how quickly after the contract was signed did the entry appear: same day, a few days later, or at month-end?',
      'When did a salesperson last close a deal without entering it into the system? How did that come to light?',
      'What does an "order record" look like in the system: full counterparty/product/value fields, or just a number and a date?',
    ],
    example:
      "Evidence: list of orders with entry dates vs. signing dates (system export); a printout or screenshot of a sample contract/order with fields filled in. Acceptable level: 100% of this month's orders entered within 24 hours.",
    suggestedTechnologies: ['Order Management System', 'Contract & Order Registry', 'CRM'],
  },

  '1A#2': {
    questions: [
      "Show last week's sales dashboard/report — where does it come from, who generated it, and how long did it take to prepare?",
      'Which sales KPIs (e.g. conversion, pipeline, average deal size) do you track automatically, and which are still tallied by hand?',
      'When did a sales report last surface a problem that had previously gone unnoticed? Describe the case.',
    ],
    example:
      'Evidence: screenshot of a live report/dashboard with a generation timestamp; list of KPIs available in the reporting tool; history of reports sent (e.g. via email or CRM). Level II signal: the report is generated automatically, not from a manual export.',
    suggestedTechnologies: ['Reporting', 'KPI Dashboards', 'Performance Monitoring', 'CRM'],
  },

  '1A#3': {
    questions: [
      'How does sales budget control work: does the system flag a plan overrun in real time, or do you find out a month later from a report?',
      "Show us where the current quarter's sales plan lives in the system and how it is compared against actuals on an ongoing basis.",
      'Who can change the sales budget in the system, and what trail does that change leave?',
    ],
    example:
      'Evidence: screenshot of a "plan vs. actual" view with today\'s date; budget change log; the parameters the system used to generate the plan (historical data, indicators). Key Level III signal: the budget lives in the system, not in a manager\'s Excel sheet.',
    suggestedTechnologies: [
      'Budgeting',
      'Forecasting',
      'Financial Planning',
      'CRM',
      'Sales Analytics',
    ],
  },

  '1A#4': {
    questions: [
      'How many orders did customers place on their own last month (online store/marketplace/B2B platform) without contacting a salesperson? What % of the total is that?',
      'Describe the customer journey from landing on the platform to placing an order — where does a human step in, and where does the system take over?',
      'What happens in the system when a customer places an order outside business hours — does it queue up and start fulfillment automatically?',
    ],
    example:
      'Evidence: order report tagged by channel (online vs. salesperson); screenshot of the order journey in the customer portal; log of orders placed outside business hours with timestamps. Level IV signal: at least one customer segment buys without a salesperson involved.',
    suggestedTechnologies: [
      'E-commerce Platform',
      'Marketplace Integration',
      'Self-service Ordering',
      'B2B Procurement Platform',
    ],
  },

  '1A#5': {
    questions: [
      'How does delivery/logistics data reach the sales process — a manual phone call to the warehouse, or does the system query MES/WMS automatically when an order is created?',
      'When a customer asks about delivery status, where does the salesperson get the answer: one click in the system, or a call to logistics?',
      "Show us last month's report linking sales data with delivery data (lead times, delays per customer).",
    ],
    example:
      'Evidence: screenshot of an order view with delivery status pulled automatically from the logistics system; a report combining sales and logistics data; screenshot of the API integration or MES view inside the CRM. Signal: the salesperson sees delivery status without leaving the CRM.',
    suggestedTechnologies: ['MES', 'WMS', 'CRM', 'OEE Dashboard', 'Warehouse Analytics'],
  },

  '1A#6': {
    questions: [
      'Show us how sales, inventory, receivables, and margin are visible in a single system view — without manually stitching data together from several programs.',
      'When did a trade term (price, payment period, credit limit) last change — how did the system handle it and what path did the change take?',
      'Describe the data flow from a customer order through production/purchasing to invoicing — how many systems require a human to "retype" the data?',
    ],
    example:
      'Evidence: system integration map (ERP → CRM → WMS → Finance) with last-updated date; a demo of the order-to-cash view in ERP without jumping between systems; count of manual re-entry points (target: 0). Level VI signal: one order is visible across all modules without manual syncing.',
    suggestedTechnologies: [
      'ERP',
      'Master Data Management (MDM)',
      'API Integration',
      'Order Management',
      'CRM',
    ],
  },

  '1A#7': {
    questions: [
      'Show us an example of an AI-generated personalized offer for a specific customer — where did the recommendations come from, and how did the customer react?',
      'Does a chatbot or sales bot handle any commercial inquiries? How many interactions per month, and what % close without escalating to a human?',
      "How do you measure the recommendation algorithm's effectiveness — what conversion uplift or average order value do you see versus a group without recommendations?",
    ],
    example:
      "Evidence: last week's chatbot interaction log with a resolution rate; A/B test report for the recommendation algorithm (AI group vs. no-AI group); a sample personalized offer with the algorithm's metadata. Level VII signal: AI recommends, a human approves or reviews the exceptions.",
    suggestedTechnologies: [
      'NLP',
      'Chatbots',
      'ML Models',
      'CRM',
      'Personalization Engine',
      'Customer Service Automation',
    ],
  },

  // ================================================================
  // AXIS 1B — MARKETING PROCESSES (7 levels)
  // ================================================================

  '1B#1': {
    questions: [
      "Where do you store contact data for customers acquired last quarter — in the CRM, an Excel sheet, or scattered across different salespeople's lists?",
      'What does a new contact entry in the CRM look like: which fields are mandatory, and which are still blank 30 days after creation?',
      'When did you last lose a customer or a sales opportunity because you had no access to the contact history (e.g. a salesperson left the company)?',
    ],
    example:
      'Evidence: number of contacts in the CRM with last-update date; % of records with key fields filled in (email, company, segment, source); a report of missing data (blank fields). Level I signal: the CRM exists and is used by at least 80% of salespeople.',
    suggestedTechnologies: ['CRM', 'Contact Management', 'Customer Data Platform (CDP)'],
  },

  '1B#2': {
    questions: [
      'Which marketing metrics (e.g. CPL, CTR, MQL) do you track continuously in a CRM or analytics tool, rather than only at quarter-end?',
      'Show us the performance report for your last email campaign — open rate, CTR, conversion, cost per lead.',
      "How do you decide to reallocate campaign budget mid-month: based on system data, or a manager's gut feeling?",
    ],
    example:
      'Evidence: screenshot of the marketing dashboard with last-refresh date; campaign report from the CRM (sent, opened, clicked, converted); history of budget decisions with data-backed rationale. Signal: campaigns are assessed within 48 hours, not a month later.',
    suggestedTechnologies: [
      'CRM',
      'Marketing Automation',
      'Campaign Tracking',
      'Reporting',
      'KPI Dashboards',
    ],
  },

  '1B#3': {
    questions: [
      'Show us your Google Analytics or Search Console results for the last 30 days — how many organic sessions, what are the top landing pages, and what is the conversion rate?',
      'How do you optimize SEO content: keyword audits, ranking monitoring, content refreshes — how often, and who owns it?',
      'When did data from Google Analytics last drive a decision to change content or site structure — describe the case.',
    ],
    example:
      'Evidence: a data export from Google Analytics or Search Console (not a screenshot — an actual report); an SEO optimization plan with dates and owners; an example content change with documented traffic impact. Level III signal: SEO is a recurring process, not a one-off project.',
    suggestedTechnologies: [
      'SEO Toolkit',
      'Google Analytics',
      'Search Console',
      'Content Analytics',
      'Web Analytics',
    ],
  },

  '1B#4': {
    questions: [
      'Describe your last email marketing campaign: how did you segment the list, what automated scenarios did it have, and what triggered each next step?',
      'How many email/SMS campaigns currently run in automatic mode (triggered by an event, not sent manually)? Show us the list of active automations.',
      'How personalized is the content in your sends — first name, segment, purchase history, or something more advanced?',
    ],
    example:
      'Evidence: screenshot of the list of active automations in the email marketing platform (Mailchimp, HubSpot, Klaviyo, etc.); campaign report with segmentation parameters; A/B test result for a personalized variant vs. a non-personalized one. Level IV signal: ≥3 automations active simultaneously, triggered by customer behavior.',
    suggestedTechnologies: [
      'Email Marketing',
      'Campaign Automation',
      'Personalization Engine',
      'CRM',
      'Marketing Automation',
    ],
  },

  '1B#5': {
    questions: [
      'How do you measure lead quality (scoring), and where is that score visible to the salesperson in the CRM?',
      "Walk us through the customer journey across the sales funnel: at what point does an MQL become an SQL, and how is that determined (a system rule vs. a salesperson's judgment)?",
      'What is the MQL→SQL→closed-won conversion rate for the last quarter, and where does that data come from?',
    ],
    example:
      "Evidence: lead scoring configuration in the system (rules, weights, thresholds); MQL→SQL→Win conversion report for the last 90 days; screenshot of a lead's view with its scoring result in the CRM. Signal: conversion is tracked automatically, not from a manual pipeline review.",
    suggestedTechnologies: ['MES', 'CRM', 'Marketing Automation', 'Lead Scoring', 'BI'],
  },

  '1B#6': {
    questions: [
      'How are marketing campaigns synchronized with sales and production activity in the system — does the ERP/CRM know about an ongoing promotion and factor it into pricing/stock levels?',
      'Show us how you manage customer data in one place for marketing, sales, and customer service — is it one system, or is data synchronized across several?',
      "When did a marketing campaign last trigger a logistics crisis (demand spike production/purchasing hadn't anticipated)? How should the system have foreseen it?",
    ],
    example:
      'Evidence: integration diagram for Marketing Automation ↔ CRM ↔ ERP; an example campaign with linked entries on the production/purchasing side; a single-customer-view report. Signal: campaigns are built with visibility into stock levels and production capacity.',
    suggestedTechnologies: [
      'ERP',
      'CRM',
      'Marketing Automation',
      'Customer Data Platform (CDP)',
      'API Integration',
    ],
  },

  '1B#7': {
    questions: [
      'Do you use a chatbot or an NLP algorithm to handle marketing/sales inquiries? How many interactions per week, and what is the self-resolution rate?',
      'How do you generate AI-assisted marketing content (product descriptions, posts, newsletters) — what % of content has AI input, and how do you measure quality?',
      'Describe a case where AI suggested a campaign target audience or channel that turned out to be surprisingly effective.',
    ],
    example:
      'Evidence: chatbot log for the last 7 days (volume, containment rate, escalation rate); an example of AI-generated content with metadata (model, prompt, review); a campaign report with an AI-generated segment. Level VII signal: AI sits inside the campaign decision loop, not just as a copywriting tool.',
    suggestedTechnologies: [
      'NLP',
      'Chatbots',
      'Content Generation',
      'Customer Service Automation',
      'ML Models',
    ],
  },

  // ================================================================
  // AXIS 1C — PROCESS TECHNOLOGY AND R&D (7 levels)
  // ================================================================

  '1C#1': {
    questions: [
      'Show us a technical design or component designed in CAD in the last month — where are the files stored, who has access, and how is versioning managed?',
      'How is a new technical solution registered: is there a central R&D project registry with dates, status, and an assigned engineer?',
      'What happens to technical documentation when an engineer leaves the company — does the knowledge stay in the system, or does it leave with them?',
    ],
    example:
      'Evidence: CAD project registry with dates and versions (PDM/PLM or a version-controlled network folder); a sample project with its change history; a documentation archiving procedure. Signal: every drawing has an author, a version, and a date — no undated "final_v3_really_final" files.',
    suggestedTechnologies: ['CAD', 'PLM/PDM', 'Design Data Management'],
  },

  '1C#2': {
    questions: [
      'Show us a process or workstation simulation run in the last quarter — the tool, the parameters, and the conclusion drawn from it.',
      'How have digital simulations influenced design decisions (e.g. line layout changes, machine parameter selection) — describe a specific case with a measurable effect.',
      'How long does it take to go from concept to the first digital simulation of a new process/workstation?',
    ],
    example:
      "Evidence: simulation report (e.g. from Tecnomatix, Arena, SimPy, SolidWorks Simulation) with date and conclusions; a design decision justified by simulation results (minutes, an executive email); time from concept to first simulation (target: <2 weeks). Signal: simulation precedes the decision — it doesn't just document it after the fact.",
    suggestedTechnologies: ['Simulation Tools', 'Digital Twin', 'CAD', 'PLM/PDM'],
  },

  '1C#3': {
    questions: [
      'Show us your latest FMEA analysis — who ran it, when, for which process, and what corrective actions came out of it?',
      'How is FMEA updated: automatically after every process change (the system enforces it), or only when someone remembers to?',
      'How many "open" FMEA corrective actions are overdue by more than 90 days, and who monitors that?',
    ],
    example:
      "Evidence: an FMEA worksheet with the last-updated date, RPN number, and action status; a list of open corrective actions with owners and deadlines; the procedure that triggers an FMEA update when a process changes. Level III signal: the FMEA stays alive after implementation — it doesn't sit in a drawer.",
    suggestedTechnologies: ['FMEA', 'Risk Register', 'Corrective Action Tracking (CAPA)'],
  },

  '1C#4': {
    questions: [
      'How many prototypes or process trials were run using digital technologies (3D printing, VR/AR) in the last year, versus traditional methods?',
      'Show us your most recent 3D-printed prototype or a VR/AR simulation — what engineering question did it resolve, and how much time did it save versus the traditional approach?',
      'How do you train operators on new processes — a paper manual, video, or a VR/AR environment?',
    ],
    example:
      'Evidence: a registry of 3D prototypes from the last 12 months (model, purpose, outcome); time from design to a finished prototype (target: days, not weeks); a VR/AR training protocol or a list of completed sessions. Signal: digital prototyping is the default step, not a budget exception.',
    suggestedTechnologies: [
      '3D Printing',
      'Rapid Prototyping',
      'Design Verification',
      'Virtual Reality (VR)',
      'Augmented Reality (AR)',
    ],
  },

  '1C#5': {
    questions: [
      'How do you manage technology projects: schedule, resources, milestones — through some kind of MES/PM-class system, or on a whiteboard and in email threads?',
      'When did an R&D project last blow through its deadline or budget — did the system flag the risk beforehand (an alert), or did you find out after the fact?',
      'Show us the critical path of a technology project currently underway, as tracked in your project management system.',
    ],
    example:
      'Evidence: screenshot of an active R&D project in a PM tool (Jira, Asana, MS Project, MES) with schedule and status; a project KPI report (deadline, budget, resources); a system alert/notification about a milestone-overrun risk. Signal: the project manager sees status without having to ask every engineer.',
    suggestedTechnologies: ['MES', 'Digital Twin', 'Simulation Models', 'PLM/PDM'],
  },

  '1C#6': {
    questions: [
      'How are technology projects synchronized with the production schedule and purchasing in the ERP — are new technology rollout dates visible in the production plan?',
      'Describe the data flow from a technology project (cycle times, process parameters) to a commercial quote — how much of that is manual copy-paste between systems?',
      'When did ERP data (e.g. material costs, lead times) last influence a decision to change a technology project still in the R&D phase?',
    ],
    example:
      "Evidence: PLM/CAD ↔ ERP integration with a data map (which fields flow automatically); an example project quote based on ERP data (not an engineer's spreadsheet); a design review protocol with cost data pulled from the system. Signal: the engineer sees material cost in PLM, not after the fact in ERP.",
    suggestedTechnologies: ['ERP', 'PLM/PDM', 'API Integration', 'Master Data Management (MDM)'],
  },

  '1C#7': {
    questions: [
      "Describe a case where an AI algorithm proposed a process parameter optimization or flagged a potential innovation area that engineers hadn't previously considered.",
      'How does AI support R&D: patent analysis, literature review, hypothesis generation — which tools, and how much time do they save?',
      'Show us a process-optimization dashboard driven by an AI algorithm — which parameters does it optimize, and how do we measure the effect?',
    ],
    example:
      'Evidence: a report from an AI tool for patent analysis or process optimization; a documented case of a design change driven by an AI recommendation (with a savings metric); the alert-loop: AI alert → engineer decision → outcome (closed loop). Signal: AI operates inside the R&D process, not after it concludes.',
    suggestedTechnologies: ['Digital Twin', 'ML Models', 'Simulation Models', 'IoT Data Feeds'],
  },

  // ================================================================
  // AXIS 1D — PURCHASING PROCESSES (7 levels)
  // ================================================================

  '1D#1': {
    questions: [
      'Show us the supplier registry in the system — how many active suppliers, and which data fields are filled in for each (contact details, category, terms, certifications)?',
      'How do you register a new purchase order: manually in the system by a buyer, or is there some automatic trigger (e.g. stock level)?',
      'What happened to the last order placed by phone or email — did it end up in the system, or stay outside it?',
    ],
    example:
      'Evidence: supplier list from the system with % completeness of key fields; a sample purchase order with all fields filled in (supplier, line items, prices, delivery date); an order log from the last month. Signal: 100% of orders above a threshold (e.g. PLN 1,000) are logged in the system within a day of being placed.',
    suggestedTechnologies: [
      'Supplier Registry',
      'Purchase Orders',
      'MRP',
      'Contract & Order Registry',
    ],
  },

  '1D#2': {
    questions: [
      'How do you plan stock levels and ordering schedules — does MRP generate proposals automatically, or does the buyer decide on their own when to order?',
      'Show us an example MRP-generated purchase proposal from last week — what data went in (stock levels, BOM, lead time), and what did the system propose?',
      "How many times did unexpected material shortages occur last month that MRP hadn't predicted — what caused them?",
    ],
    example:
      'Evidence: screenshot of the list of MRP purchase proposals with generation date and parameters; a report of shortages vs. the MRP plan (accuracy); a protocol for correcting MRP parameters after deviation analysis. Signal: MRP accuracy ≥85% (proposals executed without manual overrides).',
    suggestedTechnologies: ['MRP', 'Inventory Planning', 'Reorder Point Optimization', 'ERP'],
  },

  '1D#3': {
    questions: [
      'Show us the last 5 purchase orders above the approval threshold — how did the approval flow work, and how long did each step take?',
      'Who can approve a purchase above PLN 50,000, and how is that enforced by the system (rather than "because that\'s how we\'ve always done it")?',
      'How many orders are currently waiting for approval, and for how many days — where can we see that in the system?',
    ],
    example:
      'Evidence: purchasing workflow log for the last 30 days (who approved, when, wait time); the system\'s threshold-and-approver configuration; a report of orders exceeding the approval SLA. Level III signal: zero orders "bypassing" the system — every purchase has a digital trail.',
    suggestedTechnologies: [
      'Workflow Management',
      'Approval Flows',
      'ERP',
      'Process Orchestration',
    ],
  },

  '1D#4': {
    questions: [
      'Do you use B2B platforms for tenders, auctions, or supplier-offer comparisons? Show us your last tender — how many bids came in, and how were they compared?',
      "What % of last year's purchases went through an electronic platform (not email/phone)? What cost savings do you see on those purchases versus the traditional route?",
      'How does a supplier submit a bid or confirm an order — through a portal/platform, or by emailing the buyer?',
    ],
    example:
      'Evidence: a transaction report from the procurement platform (number of tenders, suppliers, savings %); a screenshot of the supplier panel in the portal; a comparison of platform-sourced purchase cost vs. traditional purchases over the last 12 months. Signal: the B2B platform handles ≥30% of purchase value.',
    suggestedTechnologies: ['B2B Procurement Platform', 'e-Auctions', 'Supplier Portal', 'EDI'],
  },

  '1D#5': {
    questions: [
      'Which procurement KPIs do you monitor continuously (e.g. supplier OTIF, purchase cost, delivery quality), and in what tool?',
      "Show us last quarter's supplier ranking by quality and timeliness — where does the data come from, and how often is it refreshed?",
      'When did a procurement KPI review last lead to a contract renegotiation or a supplier switch — describe the case.',
    ],
    example:
      "Evidence: a procurement KPI dashboard with today's date (OTIF, price vs. budget, quality); a supplier scorecard for the last 90 days; a renegotiation or supplier-switch protocol backed by data. Signal: the decision to switch suppliers is backed by system data, not just a buyer's opinion.",
    suggestedTechnologies: ['MES', 'KPI Dashboards', 'Reporting', 'Supplier Portal', 'ERP'],
  },

  '1D#6': {
    questions: [
      'How is purchasing integrated with production planning and finance in the system — does a production plan change automatically update purchasing requirements?',
      'Walk us through an order from ERP approval through supplier dispatch, goods receipt, and invoice posting — how many manual steps are in that flow?',
      'When did a purchasing deviation (delay, higher price) last show up in the production system before it became a physical problem?',
    ],
    example:
      'Evidence: a Purchase-to-Pay process map in ERP flagging automatic vs. manual steps; a P2P cycle-time report (order → invoice paid); an MRP ↔ purchasing ↔ finance integration diagram of the data flow. Signal: fewer than 3 manual steps in the full P2P cycle.',
    suggestedTechnologies: ['ERP', 'Master Data Management (MDM)', 'API Integration', 'MRP'],
  },

  '1D#7': {
    questions: [
      'Do you use predictive algorithms to forecast raw material or component prices? Show us the latest forecast and how it influenced a purchasing decision.',
      'How does AI support supplier negotiations — does the system suggest a target price, the right time to buy, or an alternative supplier?',
      'Describe a case where an algorithm flagged a price-increase risk earlier than the buyer did, and the company hedged with a forward contract.',
    ],
    example:
      'Evidence: an algorithm-generated price forecast report (with accuracy vs. actuals); a purchasing decision based on an AI recommendation with documented savings; a list of active price alerts from the system. Signal: AI influences the timing and value of at least 20% of purchases.',
    suggestedTechnologies: ['ML Models', 'Forecasting', 'ERP', 'B2B Procurement Platform'],
  },

  // ================================================================
  // AXIS 1E — LOGISTICS PROCESSES (7 levels)
  // ================================================================

  '1E#1': {
    questions: [
      'Show us how you scan goods on receipt at the warehouse — what does the system record, and how quickly does the item show up in stock?',
      'How many warehouse items have no barcode or RFID tag, and how is their identification managed?',
      'When did you last mix up goods or issue the wrong item — what failed in the identification process?',
    ],
    example:
      'Evidence: a screenshot of the goods-receipt process from the scanner (timestamp, item, quantity, location); % of warehouse items with a barcode/RFID tag; an error log of issuing mistakes from the last 90 days. Signal: 100% of warehouse movements (receipts, issues, transfers) are logged by scanner, not by hand.',
    suggestedTechnologies: ['Barcode Scanners', 'RFID', 'Label Printers', 'Inventory Scanning'],
  },

  '1E#2': {
    questions: [
      "How does a warehouse worker check an item's location and quantity in real time — a mobile terminal, an app, or a walk to a desktop computer?",
      'Show us what a pick list looks like for a worker: a paper printout, a mobile terminal, or voice picking/AR?',
      'How long does it take to locate an item in the warehouse when a request comes in from sales or production?',
    ],
    example:
      'Evidence: a screenshot of a mobile terminal or WMS app in actual use (not a demo); response time for a location inquiry (SLA: <2 min); a terminal activity report (transactions per day per terminal). Signal: every warehouse movement is confirmed via terminal in real time.',
    suggestedTechnologies: ['Mobile Terminals', 'Real-time Location', 'Inventory Updates', 'WMS'],
  },

  '1E#3': {
    questions: [
      "How does the WMS manage the process from order to shipment — walk us through an order's path in the system from arrival to the generated waybill.",
      'Do you use EDI to exchange data with suppliers or customers? Which documents (orders, advance shipping notices, invoices) go through EDI?',
      'When did the WMS last automatically propose an optimal location for a new item — on what basis?',
    ],
    example:
      'Evidence: a screenshot of the order workflow in the WMS (statuses: new → picking → packing → shipped); an EDI configuration listing partners and document types; a warehouse-location optimization log. Signal: the entire order-to-waybill flow lives in one system without manual re-entry.',
    suggestedTechnologies: ['WMS', 'EDI', 'B2B Integration', 'Barcode/RFID', 'Warehouse Analytics'],
  },

  '1E#4': {
    questions: [
      'How many AGVs or warehouse robots are active day to day, and what % of internal transport is automated?',
      'Show us AGV availability and throughput data from last week — how many cycles, how many breakdowns, how much downtime?',
      'How does a robot/AGV work with the WMS: does the WMS automatically generate a transport order when an AGV becomes available?',
    ],
    example:
      'Evidence: an AGV dashboard with KPIs (cycles/hour, availability %, downtime); a WMS ↔ AGV integration diagram of the order flow; a report comparing throughput with AGVs versus before deployment. Signal: AGVs handle ≥50% of internal transport without manual dispatch.',
    suggestedTechnologies: ['AGV', 'Warehouse Robotics', 'Route Optimization', 'WMS'],
  },

  '1E#5': {
    questions: [
      'How is milkrun or kanban integrated with the WMS and production system — does the WMS automatically trigger a milkrun route based on material consumption?',
      "Show us last month's internal material-flow KPIs — kitting lead time, picking accuracy, fill rate.",
      'When did a disruption in internal logistics (shortage, delay) last get caught by the system before it stopped the production line?',
    ],
    example:
      'Evidence: kanban/milkrun configuration linked to the WMS; an internal logistics KPI report (kitting lead time, picking accuracy); a system-logged "shortage alert → milkrun trigger" event. Signal: the production line doesn\'t stop because of shortages caused by invisible material flow.',
    suggestedTechnologies: ['MES', 'WMS', 'SCADA', 'OEE Dashboard', 'Barcode/RFID'],
  },

  '1E#6': {
    questions: [
      'How is logistics (warehouse, transport, deliveries) visible in ERP alongside orders, production, and finance — is it one view, or do you have to stitch reports together from several systems?',
      'Walk us through how a customer order moves from the sales module to the warehouse and transport modules in ERP — how many steps are automatic?',
      'How do you allocate logistics costs (warehouse, transport) per order or per customer in ERP — can that be done with one click?',
    ],
    example:
      'Evidence: a demo or screenshots of the order-to-ship flow in ERP (from order to the delivery-note/waybill document); a logistics-cost-per-customer/channel report; order-to-ship time tracked automatically in ERP. Signal: zero manual data transfers between the logistics and sales modules.',
    suggestedTechnologies: ['ERP', 'WMS', 'Master Data Management (MDM)', 'API Integration'],
  },

  '1E#7': {
    questions: [
      'How does AI optimize stock levels — does the system dynamically recommend min/max/reorder points per SKU based on demand and lead time, or are those fixed parameters?',
      'Describe a recent case where an AI algorithm proposed relocating goods in the warehouse to cut picking time — what did you achieve?',
      'How does AI demand forecasting influence replenishment decisions — with what accuracy, and how often does the algorithm miss reality?',
    ],
    example:
      'Evidence: an AI forecast-accuracy report vs. actuals (MAPE or MAE over the last 90 days); a history of min/max parameter changes generated by AI; a warehouse map with a history of algorithm-driven location optimization. Signal: inventory turnover improved by ≥15% after AI deployment versus the prior year.',
    suggestedTechnologies: ['ML Models', 'WMS', 'Forecasting', 'AGV', 'Route Optimization'],
  },

  // ================================================================
  // AXIS 1F — PRODUCTION PROCESSES (7 levels)
  // ================================================================

  '1F#1': {
    questions: [
      'Show us what data you collect automatically from production machines — which parameters, at what frequency, and where does it land?',
      'Which machines in the plant collect data digitally, and which still require a manual entry by the operator? What % is that?',
      'When did machine data last help explain the cause of a product defect or a downtime event?',
    ],
    example:
      'Evidence: a machine list mapped onto the shop floor layout, flagging which ones collect data automatically (OT asset inventory); a sample machine-parameter log from the last shift; a root-cause report that used machine data. Signal: ≥70% of machines on critical lines collect data without operator involvement.',
    suggestedTechnologies: ['Machine Data Logging', 'PLC & Sensors', 'MES', 'SCADA'],
  },

  '1F#2': {
    questions: [
      'Show us which process parameters are monitored by PLC/sensors in real time, and what the system does automatically when a parameter goes out of spec.',
      'How many PLC/SCADA alarms fired last week, and what % were genuine (not false positives)?',
      'How does an operator find out about a line problem — through a system alarm, or because "something sounds off"?',
    ],
    example:
      'Evidence: PLC alarm configuration listing monitored parameters and thresholds; an alarm report for the last 7 days (true-alarm rate); an operator instruction describing the alarm response (not "call the shift supervisor"). Signal: the operator reacts to a system alarm before a defect occurs, not after.',
    suggestedTechnologies: ['PLC', 'Sensors', 'Industrial Detectors', 'SCADA', 'MES'],
  },

  '1F#3': {
    questions: [
      'Show us the OEE figure for the main production line over the last month — how is it measured, who analyzes it, and what actions were taken in response to deviations?',
      'How does the CMMS manage the maintenance and inspection schedule — are PM work orders generated automatically by the system, or by a maintenance planner?',
      'Where is the current Value Stream Map for this production line, and when was it last updated?',
    ],
    example:
      'Evidence: an OEE report (Availability × Performance × Quality) for the last 30 days with a trend line; a CMMS maintenance schedule (PM orders with dates and technicians); a VSM with a current date and marked wastes. Signal: OEE >65% is a starting point for improvement action, not just a historical data point.',
    suggestedTechnologies: ['CMMS', 'OEE Dashboard', 'Value Stream Mapping (VSM)', 'MES', 'SCADA'],
  },

  '1F#4': {
    questions: [
      'How many stations on the main production line are fully automated (robot/machine, no operator involved), and what % of the overall process is that?',
      'Show us robot downtime data from the last month — what availability, what are the most common failure causes?',
      'How is a robot or automated cell reprogrammed for a product changeover — how long does it take, and who does it?',
    ],
    example:
      'Evidence: a production line map flagging automated stations; a robot OEE/availability report for the last 90 days; changeover time logged for a product switch. Signal: automation targets stations where human error was the leading cause of defects.',
    suggestedTechnologies: ['Cobots', 'Robot Safety Systems', 'Automation Cells', 'PLC', 'MES'],
  },

  '1F#5': {
    questions: [
      'Show us how the MES manages production orders in real time — from the moment an order appears to its closure, what does the system do automatically?',
      'How does the shop-floor operator see what to produce, in what sequence, and at which station — a paper work order, an MES terminal, or a screen at the machine?',
      'When did the MES last automatically re-sequence the production queue in response to a disruption (e.g. a machine breakdown, a material shortage)?',
    ],
    example:
      "Evidence: a screenshot of the production order queue in the MES with a timestamp; a log of automatic re-sequencing during a disruption; an order-fulfillment report (on-time, completeness, quantity deviations). Signal: the operator doesn't print a paper work order — they see the order on screen and confirm completion in the system.",
    suggestedTechnologies: ['MES', 'SCADA', 'OEE Dashboard', 'PLC', 'Sensors'],
  },

  '1F#6': {
    questions: [
      'How does ERP synchronize the production plan with purchasing, sales, and finance — is a customer order change immediately reflected in the material plan and schedule?',
      'How many systems (ERP, MES, WMS, QMS) are integrated with each other in real time on the shop floor — show us the integration map.',
      'How often do the "ERP plan" and "shop floor reality" diverge, and what does the system do automatically to reconcile the difference?',
    ],
    example:
      'Evidence: a system integration map (ERP ↔ MES ↔ WMS ↔ QMS) with data flows; a demo of a customer order change → automatic production and material plan update; a plan-vs.-actual deviation report with trends. Signal: time from order change to production plan update is under an hour, with no manual intervention.',
    suggestedTechnologies: [
      'ERP',
      'MES',
      'Master Data Management (MDM)',
      'API Integration',
      'SCADA',
    ],
  },

  '1F#7': {
    questions: [
      'Show us a case where AI optimized the production schedule — which parameters did it optimize (changeover time, OEE, delivery date), and by how much did they improve?',
      'Do you use a digital twin to plan or optimize production? Show us the most recent simulation and the decision made from it.',
      'How does AI detect anomalies in the production process before a defect or breakdown occurs — an example from the prediction log.',
    ],
    example:
      'Evidence: an AI schedule-optimization report (before/after OEE, changeover time, OTIF); a digital-twin simulation with a documented decision; an anomaly-prediction log from the last 30 days (true-positive rate). Signal: the AI scheduler runs on live data, not just as a demo.',
    suggestedTechnologies: [
      'Digital Twin',
      'ML Models',
      'MES',
      'Simulation Models',
      'IoT Data Feeds',
    ],
  },

  // ================================================================
  // AXIS 1G — QUALITY PROCESSES (7 levels)
  // ================================================================

  '1G#1': {
    questions: [
      'Show us what an electronic quality-control record from the last shift looks like — who filled it in, which parameters, and what happened with out-of-spec results?',
      'How many quality records from the last week are on paper, how many are electronic — and where do they go after being filled in?',
      'When did a quality check last catch a problem that was visible in the data before it became a customer complaint?',
    ],
    example:
      'Evidence: a sample electronic inspection record from the system (not a scan of paper) with date and digital signature; % of electronic vs. paper records over the last 30 days; a nonconformance report with detection date vs. complaint date. Signal: 100% of inspection records are digital, entered at the point of inspection.',
    suggestedTechnologies: ['Compliance Sheets', 'Inspection Records', 'QMS'],
  },

  '1G#2': {
    questions: [
      'Which quality parameters (dimensions, weight, appearance, composition) are measured automatically by machines or vision systems, and which are checked by hand with a gauge?',
      'Show us the automated-inspection results report from the last 24 hours — how quickly does a measurement result reach the system after the sample is taken?',
      'When did a camera or sensor last catch a defect that a visual inspector missed — describe the case.',
    ],
    example:
      'Evidence: a list of stations with automated quality control (machine, parameter, SPC chart); a false-positive/false-negative report from the vision system for the last 90 days; time from measurement to QMS entry. Signal: automated inspection covers ≥50% of critical quality parameters.',
    suggestedTechnologies: ['Cameras', 'Machine Vision', 'Automated Inspection', 'QMS', 'MES'],
  },

  '1G#3': {
    questions: [
      'What happens in the system when quality control detects a nonconformance — show us the automatic flow from detection to the stop/continue decision.',
      'Who does the system alert when a control limit is breached, and what is the expected response time (SLA)?',
      'How many quality alerts from last week resulted in a corrective action, and how many were closed without one?',
    ],
    example:
      'Evidence: a nonconformance-flow diagram in the QMS showing automatic routing; a quality-alert report for the last 30 days with response time and outcome; % of alerts with a corrective action taken. Signal: time from nonconformance detection to notifying the right people is under 15 minutes.',
    suggestedTechnologies: ['Corrective Action Tracking (CAPA)', 'QMS', 'MES', 'Reporting'],
  },

  '1G#4': {
    questions: [
      'Show us the robots or advanced vision systems used for automated quality inspection — which defects do they detect, and with what accuracy?',
      'How does the defect-detection rate compare: automated system vs. visual inspector — based on the last 3 months of data?',
      'What happens to defects detected by a robot/camera: automatic sorting, a line stop, or just a log entry?',
    ],
    example:
      'Evidence: vision system spec sheet listing the defect types it detects; a comparative accuracy report (robot vs. human inspection); a log of automatic actions following defect detection (stop → log → sort). Signal: the automated system has replaced or augmented 100% of visual inspection on critical items.',
    suggestedTechnologies: ['Machine Vision', 'Cameras', 'Automated Inspection', 'QMS', 'MES'],
  },

  '1G#5': {
    questions: [
      'Show us how the QMS manages the full lifecycle of a quality document: creation, approval, distribution, revision — what parts of that are automatic?',
      'How do you measure process stability (e.g. Cp, Cpk, SPC), and where are those indicators visible to the quality manager?',
      'When did a QMS report last drive a systemic (not one-off) change in a production process — describe the case.',
    ],
    example:
      'Evidence: a list of active QMS documents with revision dates and owners; an SPC chart or Cp/Cpk report from the last 30 days; a production-system change documented as a consequence of QMS analysis. Signal: the QMS is a source of improvement initiatives, not just a certificate archive.',
    suggestedTechnologies: ['QMS', 'Quality Planning', 'Inspection Reporting', 'MES', 'Reporting'],
  },

  '1G#6': {
    questions: [
      'How is the QMS integrated with ERP in the complaint-handling process — does a customer complaint automatically create a nonconformance in the QMS and a linked credit note in finance?',
      'Show us a quality report linked to cost data — what does poor quality cost us (internal vs. external) last quarter?',
      'How does quality data from production feed into purchasing parameters (e.g. supplier ratings) — is that an automatic flow, or a manual quarterly review?',
    ],
    example:
      "Evidence: QMS ↔ ERP integration (mapping the complaint → NC → credit note flow); a cost-of-poor-quality (COPQ) report for the last 3 months; an automatic link from supplier quality scores to the ERP purchasing rating. Signal: quality costs are visible in management accounting, not just in the quality department's report.",
    suggestedTechnologies: ['ERP', 'QMS', 'Corrective Action Tracking (CAPA)', 'Reporting'],
  },

  '1G#7': {
    questions: [
      'Show us how an AI algorithm decides which production batches need a full quality inspection versus which can be released based on process data.',
      'How does AI predict defects before they occur — with how much lead time, and with what accuracy over the last 90 days?',
      'Describe a case where an AI quality prediction avoided a complaint or a costly rework — what was the savings metric?',
    ],
    example:
      'Evidence: an AI quality-prediction report with precision/recall for the last 90 days; a log of batches released without full inspection based on an AI recommendation (and their outcomes); a calculation of costs avoided thanks to the prediction. Signal: AI-driven sampling has replaced calendar-based or 100% inspection on at least one line.',
    suggestedTechnologies: ['ML Models', 'QMS', 'MES', 'Machine Vision', 'IoT Data Feeds'],
  },

  // ================================================================
  // AXIS 1H — FINANCIAL MANAGEMENT (7 levels)
  // ================================================================

  '1H#1': {
    questions: [
      'Show us how you process incoming invoices — OCR scanning, manual retyping, or does an e-invoice enter the system automatically?',
      'How long does it take to post an invoice from receipt to appearing in accounts payable — and how much of that is manual work?',
      'Where do you store financial documents (invoices, contracts, credit notes) — a paper archive, a local drive, or a DMS with full-text search?',
    ],
    example:
      'Evidence: a log of processed invoices from the last month tagged by type (OCR/manual/EDI); an invoice-cycle-time report (received → posted) with percentiles; a list of DMS systems with search capability. Signal: >80% of invoices are processed without manual re-keying.',
    suggestedTechnologies: ['OCR', 'Document Management', 'Invoice Capture', 'AP Automation'],
  },

  '1H#2': {
    questions: [
      'Show us the current finance dashboard (FC) with its key indicators — where does it come from, and how often is it refreshed (real-time, daily, monthly)?',
      'How does the finance manager check for budget deviations: do they log into the system and see it, or wait for a report from an analyst?',
      'Which financial KPIs (e.g. DSO, gross margin, burn rate) do you have set up as automatic alerts?',
    ],
    example:
      'Evidence: a screenshot of the FC dashboard with last-refresh date; a list of financial alerts from the system (KPI, thresholds, recipients); a variance-analysis report from the last month (plan vs. actuals with drilldown). Signal: the CFO sees current results without waiting on a report from the controller.',
    suggestedTechnologies: ['KPI Dashboards', 'Budgeting', 'Data Warehouse', 'Reporting', 'BI'],
  },

  '1H#3': {
    questions: [
      'Show us how payment or cost approval above a threshold works — who approves it, how long does it take, and where can you see the status of pending decisions?',
      'Who can post a cost above PLN 100,000, and how does the system enforce the approval path (rather than just a policy on paper)?',
      'How many financial requests are currently waiting for approval, and for how many days — show us that list from the system.',
    ],
    example:
      'Evidence: the approval-matrix configuration in the system (amounts, roles, escalations); a report of pending approvals with dates; the approval cycle time (request → decision) with percentiles for the last month. Signal: zero payments approved outside the system — a full audit trail.',
    suggestedTechnologies: [
      'Approval Flows',
      'Workflow Management',
      'ERP',
      'Process Orchestration',
    ],
  },

  '1H#4': {
    questions: [
      'Which financial processes are handled by RPA — e.g. automatic bank-statement processing, invoice matching, reporting? How many hours per month does that save?',
      'Show us an RPA bot in action, or its log from the last week — how many transactions did it handle, and how many exceptions (errors) did it hand off to a human?',
      'How do you measure the quality of RPA-automated processes — what SLA and error rate do they have?',
    ],
    example:
      'Evidence: a list of running RPA bots with task scope and weekly volume; an error/exception report (error rate <5%); a calculation of FTE-hours saved monthly thanks to RPA. Signal: RPA runs 24/7 on at least 2 finance processes without supervision.',
    suggestedTechnologies: ['RPA', 'Invoice Processing', 'AP Automation', 'Financial Posting'],
  },

  '1H#5': {
    questions: [
      'Show us the financial workflow managing the process from request to payment — who does what, in what order, with what SLAs?',
      'How does the system track the status of every financial task (e.g. invoice approval, account reconciliation) — who sees the backlog?',
      'When did the financial workflow system last automatically escalate an overdue task to a senior manager?',
    ],
    example:
      'Evidence: a financial workflow map (visual, not descriptive) with SLA per step; a backlog report from the system (overdue tasks with dates and owners); an automatic-escalation log from the last 30 days. Signal: every financial task has an owner, a deadline, and system visibility.',
    suggestedTechnologies: ['Workflow Management', 'Approval Flows', 'ERP', 'Reporting'],
  },

  '1H#6': {
    questions: [
      'How is finance integrated with the other modules in ERP — does a purchase order automatically create a budget reservation, and does an invoice automatically post to accounts payable?',
      'Show us a financial statement generated from ERP within the last week — how long did it take to prepare, and how much data was filled in manually outside the system?',
      'How many "parallel Excel sheets" are running in the company alongside ERP to manage finance?',
    ],
    example:
      'Evidence: a demo of P&L or balance-sheet generation from ERP (generation time <10 min); a list of ERP modules integrated with finance (a data-flow map); the count of "shadow spreadsheets" identified in the most recent IT audit. Signal: month-end close is under 3 business days.',
    suggestedTechnologies: [
      'ERP',
      'Budgeting',
      'Financial Planning',
      'Reporting',
      'API Integration',
    ],
  },

  '1H#7': {
    questions: [
      'How do AI or BI tools support financial forecasting — does a model automatically generate scenarios (base/worst/best) from historical data and macro assumptions?',
      'Show us your latest AI-assisted analytical report — what business question did it answer, and how much time did it save versus a manual analysis?',
      'How does AI detect anomalies in financial data (e.g. fraud, duplicate invoices, unexplained deviations) — an example from the last 3 months.',
    ],
    example:
      'Evidence: an AI financial-forecasting model with accuracy over the last 6 months (MAPE); an analytical report with AI-flagged insights; an anomaly log detected by AI with classification (true/false alarms). Signal: the AI financial forecast is actually used by the CFO in decision-making, not just generated and filed away.',
    suggestedTechnologies: ['BI', 'ML Models', 'Data Warehouse', 'Forecasting', 'Budgeting'],
  },

  // ================================================================
  // AXIS 1I — HR PROCESSES (7 levels)
  // ================================================================

  '1I#1': {
    questions: [
      'How do you track employee working hours — paper timecards, an HR system, or an access-control reader (card/biometric)?',
      "How long does it take an HR manager to confirm an employee's attendance on a specific day from a month ago — from question to answer?",
      "What happens to a new employee's timesheet in their first week — filled in manually, or generated automatically once their account is set up?",
    ],
    example:
      'Evidence: a screenshot of the access-control system or time-and-attendance record for a sample day; % of employees with electronic time tracking (target: 100%); response time for an attendance-confirmation request (SLA <5 min from the system). Signal: 100% of employees log time in the system, zero paper timecards.',
    suggestedTechnologies: ['Time & Attendance', 'Access Control', 'HRM', 'Biometric Readers'],
  },

  '1I#2': {
    questions: [
      'Walk us through the payroll process — how long does it take to close the payroll run, and how many steps require manual verification?',
      'Show us how the HR/payroll system calculates taxes, social security, and net pay — is it fully automatic, or does someone still "double-check the numbers" in a spreadsheet?',
      'When did a payroll error last get caught by the system before payment (rather than by an employee after payday)?',
    ],
    example:
      'Evidence: a report of payroll close time over the last 6 months (target: <3 days); a log of automatic payroll checks (what the system verifies); a history of detected payroll errors (pre- vs. post-system implementation). Signal: payroll is closed by the system, not by an accountant with a calculator.',
    suggestedTechnologies: ['Payroll System', 'Tax Declarations', 'Salary Management', 'HRM'],
  },

  '1I#3': {
    questions: [
      'How does an employee clock in and out — a proximity card, a fingerprint reader, a mobile app? What does a manager see in real time?',
      "Show us last week's attendance report — how is it generated, and who reviews it before it feeds into payroll?",
      "What happens in the system when an employee doesn't show up without notice — does it alert the manager automatically?",
    ],
    example:
      'Evidence: a screenshot of an attendance report from the access-control system with a date; the absence-alert configuration (who, when, how fast); time from absence to alert in the system (SLA <30 min). Signal: the manager learns of an unplanned absence from the system, not from a coworker.',
    suggestedTechnologies: ['Biometric Readers', 'Time & Attendance', 'Access Control', 'HRM'],
  },

  '1I#4': {
    questions: [
      'Can employees independently submit a leave request, update personal data, or download documents through a system/kiosk/mobile app?',
      'Walk us through a leave request from submission to approval and payroll calculation in the system — how long does it take, and how many steps are automatic?',
      'How many employee requests (leave, overtime, business travel) last month went through the system versus email/paper?',
    ],
    example:
      'Evidence: a screenshot of the employee self-service panel; leave-request cycle time (submission → approval → calculation) from the log; % of electronic vs. paper requests over the last 30 days. Signal: >90% of employee requests are submitted through the system, not emailed to HR.',
    suggestedTechnologies: ['Employee Kiosk', 'Self-Service HR Portal', 'Digital Forms', 'HRM'],
  },

  '1I#5': {
    questions: [
      'Show us how the HRM system manages training planning — how does it know which trainings a specific employee needs, and when does it remind them?',
      'How is a performance review conducted and stored in the system — a paper form that gets scanned afterward, or is it natively digital?',
      "How is an employee's career path documented in the HRM system, and who updates it after every role/competency change?",
    ],
    example:
      "Evidence: a screenshot of an employee profile in the HRM system with role, training, and review history; an automatically generated report of scheduled trainings for the next 90 days; a team competency matrix with a current date. Signal: the HRM system drives training decisions, not a manager's Excel sheet.",
    suggestedTechnologies: ['HRM', 'Training Planning', 'Performance Reviews'],
  },

  '1I#6': {
    questions: [
      'How is the HR module integrated with ERP (production, costs, projects) — is labor cost automatically allocated to production orders or projects?',
      "Show us an HR cost report integrated with the company's financial results — how quickly can you pull labor cost per project or department for the current month?",
      'When an employee changes department or role, how does their system profile update automatically (pay, training, access, cost center)?',
    ],
    example:
      'Evidence: the HRM ↔ ERP integration configuration (labor cost allocation); a labor-cost-per-project/department report from ERP for the current month; a log of automatic profile updates after a role change. Signal: the project manager sees labor cost in ERP, not emailed over by HR.',
    suggestedTechnologies: ['ERP', 'HRM', 'Payroll System', 'API Integration'],
  },

  '1I#7': {
    questions: [
      'How does AI support recruitment: CV screening, candidate matching, interview scheduling — how much time does it save the recruiter, and how do you measure the quality of the matches?',
      'Does the HR system analyze employee data to predict turnover or identify talent — show us an example of that analysis.',
      "How does AI personalize employee development plans based on competency data, performance, and other employees' career paths?",
    ],
    example:
      'Evidence: an AI CV-screening report (precision of candidates reaching the first interview vs. manual review); turnover-prediction accuracy over the last 6 months; a sample AI-generated personalized training plan versus a standard one. Signal: time-to-hire dropped by ≥20% after adopting AI in recruitment.',
    suggestedTechnologies: ['ML Models', 'HRM', 'NLP', 'Training Planning', 'Performance Reviews'],
  },

  // ================================================================
  // AXIS 2A — DIGITAL PRODUCTS (5 levels)
  // ================================================================

  '2A#1': {
    questions: [
      'Which digital products (e-books, downloadable files, or streaming content) do you offer customers, and how are they delivered after purchase?',
      'Walk us through the purchase and delivery journey for a digital product — where does the customer pay, where do they download it, and how fast is delivery?',
      'How many unique digital products did you sell last month, and what % of revenue does that represent?',
    ],
    example:
      'Evidence: a list of digital products in the store with price and description; a sales report for the last 30 days (transaction count, revenue, product type); time from purchase to customer access (SLA: instant or <5 min). Signal: the digital product sells on an ongoing basis, not just as a pilot project.',
    suggestedTechnologies: ['E-commerce Platform', 'Digital Delivery', 'Payment Integration'],
  },

  '2A#2': {
    questions: [
      'Is the same content available across multiple channels or formats (e.g. e-book + audiobook + video, an iOS and an Android app) — show us an example.',
      'How do you manage distribution of multimedia content across platforms — separate uploads to each one, or a single distribution system?',
      'Which streaming platforms or devices are supported by your products, and how do you test compatibility?',
    ],
    example:
      'Evidence: a list of available formats per title/product; a screenshot of the multi-platform distribution management panel; a viewing/listening report per platform and device. Signal: content is uploaded once and distributed automatically to ≥3 platforms/formats.',
    suggestedTechnologies: [
      'Content Management',
      'Multi-platform Distribution',
      'Streaming Platform',
    ],
  },

  '2A#3': {
    questions: [
      'What advanced features do your digital products have beyond the content itself — personalization, AI, interaction with other users?',
      'Show us an example of personalization in the product (e.g. recommendations based on usage history, adaptive content) — how does it work, and what data does it collect?',
      'How do you measure user engagement with the digital features (completion rate, time in app, return visits)?',
    ],
    example:
      'Evidence: a description of the advanced features in the product (not in a sales deck — in the live product); an engagement-metrics report for the last 30 days; an A/B test of personalization with a result. Signal: users come back to the product because of the digital features, not just the content.',
    suggestedTechnologies: ['Mobile App', 'Personalization Engine', 'Analytics SDK', 'AI Features'],
  },

  '2A#4': {
    questions: [
      'Describe how a user actively shapes the product or environment — e.g. creates their own content, customizes a learning path, collaborates with other users.',
      'How many actively creating (not just consuming) users do you have per month, and what % of the base is that?',
      "Show us a feature where a user's decision permanently changes the state of the product and affects their experience (not just UI preferences).",
    ],
    example:
      'Evidence: a user-generated-content report (volume, types, creative activity) for the last 30 days; a screenshot of a collaborative or configuration feature available to users; a DAU/MAU ratio (target: >30% active base). Signal: the product has platform-like traits — value grows with the number of active users.',
    suggestedTechnologies: [
      'Interactive Platform',
      'Collaboration Features',
      'User Analytics',
      'Gamification',
    ],
  },

  '2A#5': {
    questions: [
      'What AI or machine learning technologies are built into your digital product — how do they work, and what measurable benefit do they bring the user?',
      'Is the product available as SaaS or a cloud platform — show us the architecture and the scaling model.',
      'How does data generated by product users create value for the product itself (a machine-learning feedback loop, personalization, benchmarking)?',
    ],
    example:
      'Evidence: a description of the AI architecture in the product (not a roadmap — features that actually work); a usage report for the AI features with business metrics (retention, NPS, conversion); a data model for the closed learning loop. Signal: AI is the core of the value proposition, not a footnote in the documentation.',
    suggestedTechnologies: ['ML Models', 'Cloud Platform', 'AI Features', 'Data Flywheel'],
  },

  // ================================================================
  // AXIS 2B — COMMUNITY-BASED PRODUCTS (5 levels)
  // ================================================================

  '2B#1': {
    questions: [
      'Do you run an online community around the product or brand — a forum, a group, a platform? How many active members does it have, and how often do new posts appear?',
      'What resources (files, tools, knowledge) do you make available for users to share, and how do you manage access rights?',
      'Who moderates the community, and how do you measure its health (activity, retention, self-sufficiency)?',
    ],
    example:
      'Evidence: a screenshot of the active community with a date and weekly post count; an active-user report for the last 30 days; a list of shared resources with download/usage counts. Signal: the community stays active without company-driven initiatives — users create content on their own.',
    suggestedTechnologies: ['Community Platform', 'Forum', 'Knowledge Base', 'File Sharing'],
  },

  '2B#2': {
    questions: [
      'Show us an example of a project or discussion led by the user community — how does the collaboration unfold, and what tools support it?',
      'What % of community content comes from users (UGC) versus the company — and how has that ratio changed year over year?',
      'When did collaborative work in the community last lead to solving a problem or creating a product?',
    ],
    example:
      'Evidence: a UGC-vs.-company-content report for the last 90 days; an example of a collaborative project with its contribution history; a self-resolution rate for problems in the community (without company intervention). Signal: >50% of content is user-created, not company-created.',
    suggestedTechnologies: ['Collaboration Platform', 'Project Wiki', 'Version Control', 'Forum'],
  },

  '2B#3': {
    questions: [
      'How is mentoring and expert knowledge-sharing organized within the community — is it formal (a program, defined roles) or spontaneous?',
      "Show us an example of value generated by a community expert — someone who helped another user better than the company's own support could.",
      'How do you identify and recognize experts in the community, and how does that affect their engagement?',
    ],
    example:
      'Evidence: a list of identified community experts with their contributions (posts, problems solved, materials); a report comparing response times from community experts vs. company support; an expert program describing the benefits offered. Signal: community experts answer questions faster than the company help desk.',
    suggestedTechnologies: [
      'Expert Community',
      'Reputation System',
      'Knowledge Base',
      'Mentoring Platform',
    ],
  },

  '2B#4': {
    questions: [
      'How does the community co-create materials, projects, or artifacts — concrete examples from the last quarter.',
      'Show us the tool used for user co-creation of content — how is ownership/licensing of contributions managed?',
      'How much community-generated content does the company actually use (in products, marketing, documentation)?',
    ],
    example:
      "Evidence: a list of joint projects/artifacts with their contribution history; a UGC ownership policy; a report of company reuse of community content over the last 12 months. Signal: the company and the community co-create value under an explicit model — the company isn't just consuming UGC without reciprocity.",
    suggestedTechnologies: [
      'Co-creation Platform',
      'Contribution Tracking',
      'Licensing Management',
    ],
  },

  '2B#5': {
    questions: [
      'How does the user community influence product decisions — feature voting, beta testing, an advisory board? Show us the most recent example of an implemented community suggestion.',
      'What decision-making mechanism gives users real influence over the platform/product direction?',
      'What % of the product roadmap came directly from community proposals in the last year?',
    ],
    example:
      'Evidence: a feature-voting report with a list of implemented proposals and dates; a documented product decision citing community feedback; NPS/CSAT results for the "engaged community" segment vs. the rest. Signal: the roadmap includes ≥30% of items initiated by the community.',
    suggestedTechnologies: [
      'Product Roadmap Tool',
      'Feature Voting',
      'Community Governance',
      'Beta Program',
    ],
  },

  // ================================================================
  // AXIS 2C — ICT-BASED PRODUCTS (5 levels)
  // ================================================================

  '2C#1': {
    questions: [
      'What customer data do you collect through ICT — from where, how often, and what do you do with it? Show us a sample customer-data dashboard.',
      'How is data from different customer-contact channels (website, email, meetings, support) merged into a single customer profile?',
      'Which department owns customer data, and how do they ensure it stays current?',
    ],
    example:
      'Evidence: a screenshot of a customer profile in an analytics platform or CRM with data from multiple channels; a map of customer-data sources; a customer-profile completeness report (% of key fields filled in). Signal: the company knows more about customer behavior than the customer does about themselves.',
    suggestedTechnologies: ['Customer Data Platform (CDP)', 'Analytics', 'CRM', 'Web Analytics'],
  },

  '2C#2': {
    questions: [
      'Show us how ICT personalizes the offer for a customer — which algorithm do you use, and where do the recommendations for a specific customer come from?',
      'Which personalization-effectiveness metrics do you track (recommendation CTR, conversion uplift, average order value)?',
      'When did personalization last produce a measurable increase in sales or engagement — describe the experiment.',
    ],
    example:
      'Evidence: a recommendation-system report with metrics (click-through rate, conversion uplift) over the last 90 days; an A/B test of personalization with a control group; a sample recommendation for a fictional customer profile with the algorithm explained. Signal: personalization lifts conversion by ≥10% versus the no-personalization variant.',
    suggestedTechnologies: [
      'Recommendation Engine',
      'ML Models',
      'Customer Data Platform (CDP)',
      'A/B Testing',
    ],
  },

  '2C#3': {
    questions: [
      'Which customer-communication channels does ICT support (chat, email, VoIP, a self-service portal), and how fast does a customer get a response in each channel?',
      "Is data from all communication channels visible to the support agent in one place — show us the agent's view during a customer call.",
      'What % of customer inquiries are resolved without escalating to a human (via bot, FAQ, portal)?',
    ],
    example:
      "Evidence: a customer-service SLA report per channel (first response time, resolution time); a screenshot of the agent view with multi-channel contact history; the chatbot/portal containment rate for the last 30 days. Signal: the customer doesn't have to repeat their issue after switching channels.",
    suggestedTechnologies: [
      'Helpdesk',
      'Chatbots',
      'CRM',
      'Omni-channel Platform',
      'Self-service Portal',
    ],
  },

  '2C#4': {
    questions: [
      'How do CRM and marketing automation personalize customer communication automatically — show us a sequence of triggered emails or personalized notifications from the last 2 weeks.',
      'What triggers an automatic campaign or message to a customer (an event, behavior, a date), and how is it segmented?',
      'How do you measure whether automatic personalization improves the customer experience (NPS, retention, CSAT)?',
    ],
    example:
      'Evidence: a list of active CRM/MA automations with their triggers and targeting; a report comparing automated vs. manual campaign results; a correlation between personalization and NPS/retention results. Signal: the customer gets the right message at the right moment without manual marketer intervention.',
    suggestedTechnologies: [
      'CRM',
      'Marketing Automation',
      'Personalization Engine',
      'Customer Journey Platform',
    ],
  },

  '2C#5': {
    questions: [
      'How does ICT act as an engine of product innovation — which technologies (big data, AI, prediction) led to new products or features in the last 12 months?',
      "Show us an example of a product or service that exists only because the company holds ICT data and capabilities competitors don't have.",
      'How do you analyze customer trends and needs through data to get ahead of the market — what is the process, and which tools do you use?',
    ],
    example:
      "Evidence: a product-innovation document from the last 12 months tied back to ICT data; a unique product/service that can't be copied without the underlying data; a customer-trend report generated by big-data analytics. Signal: ICT is a source of competitive advantage, not just an operational tool.",
    suggestedTechnologies: [
      'Big Data Analytics',
      'ML Models',
      'Predictive Analytics',
      'Customer Intelligence',
    ],
  },

  // ================================================================
  // AXIS 2D — PRODUCT ALIGNMENT TO CUSTOMER EXPECTATIONS (5 levels)
  // ================================================================

  '2D#1': {
    questions: [
      'Show us how you collect customer purchasing preferences and how they influence the offer — a concrete mechanism, not an intention.',
      'Through how many channels can your product be purchased, and how do you ensure a consistent experience (prices, availability, terms) across all of them?',
      'When did customer-behavior data last drive a change in the assortment or how the offer is presented?',
    ],
    example:
      'Evidence: a multi-channel analytics report with sales share per channel; a history of assortment/presentation changes driven by data; a customer-journey map with the decision point marked. Signal: the offer is consistent regardless of which channel the customer engages the product through.',
    suggestedTechnologies: [
      'Customer Data Platform (CDP)',
      'Multi-channel Analytics',
      'Product Catalog',
    ],
  },

  '2D#2': {
    questions: [
      'Show us how the product is tailored to different customer segments — which segments have you defined, and what differences exist in the offer per segment?',
      'How do you know the segmentation reflects real needs — what data validates the segment definitions?',
      'Show us recommendations for different customer profiles (new vs. returning, segment A vs. B) — how do they differ?',
    ],
    example:
      'Evidence: a customer-segment definition with criteria and counts; a per-segment offer-performance report (conversion, AOV, retention); an example of two different offer variants for different segments of the same product. Signal: segments are measured and managed, not just drawn on a slide.',
    suggestedTechnologies: ['Segmentation Engine', 'CRM', 'Personalization Engine', 'Analytics'],
  },

  '2D#3': {
    questions: [
      'How does product pricing adapt to market conditions, demand, or customer profile — dynamic pricing, segment-based, or a fixed price list for everyone?',
      'Through which channels can a customer reach support, and what is the response time — measured from the system, not from a claim?',
      "When did the product price last change, and what triggered it (the system, or a manager's decision)?",
    ],
    example:
      'Evidence: a price-change report for the last 90 days with the rationale (data trigger vs. decision); the pricing-model configuration in the system (can it adjust automatically?); a customer-support SLA report per channel. Signal: at least one pricing element adjusts automatically based on data.',
    suggestedTechnologies: [
      'Pricing Engine',
      'CRM',
      'E-commerce Platform',
      'Customer Support Platform',
    ],
  },

  '2D#4': {
    questions: [
      'Show us how the user experience is personalized at the individual level — not just per segment, but per person.',
      'What data about a specific customer does the system use for personalization, and where does it come from (behavior, purchases, preferences, context)?',
      'When did individual-level personalization last produce a measurable business effect — an A/B test or case study with data.',
    ],
    example:
      'Evidence: a user profile with personalization data (history, preferences, context); an A/B test report comparing 1-to-1 personalization vs. segment-based vs. no personalization; an example of an automatically personalized email or view from the send log. Signal: every active user gets a different version of the experience.',
    suggestedTechnologies: [
      '1-to-1 Personalization',
      'Real-time Decisioning',
      'CRM',
      'Recommendation Engine',
    ],
  },

  '2D#5': {
    questions: [
      'Do you offer a configure-to-order or made-to-order product supported by digital tools — show us the configurator and how it flows into fulfillment.',
      'How does AI or ML predict the evolution of customer needs, and how do products respond to that prediction?',
      'Describe a product or service designed entirely from customer data (data-driven product design) in the last 12 months.',
    ],
    example:
      'Evidence: an online product configurator with a flow into fulfillment; a report on the accuracy of customer-needs predictions; documentation of the data-driven product-design process with concrete data-backed decisions. Signal: a customer can configure and order a unique product without any human involvement.',
    suggestedTechnologies: [
      'Product Configurator',
      'ML Models',
      'Predictive Analytics',
      'CPQ (Configure-Price-Quote)',
    ],
  },

  // ================================================================
  // AXIS 2E — PRODUCT SCALABILITY (5 levels)
  // ================================================================

  '2E#1': {
    questions: [
      'What geographic reach does your digital product have — local only (one city/region), or broader?',
      "What technically and regulatory factors limit the product's availability outside your current market?",
      "What % of revenue comes from outside your main market's location?",
    ],
    example:
      'Evidence: a product-availability map with a date; a list of expansion barriers (technical/regulatory/language) with an estimated cost to overcome them; a revenue-per-region report. Signal: expansion barriers are known and quantified — not a "we could go anywhere" statement with no substance behind it.',
    suggestedTechnologies: ['E-commerce Platform', 'Geolocation', 'Multi-currency Support'],
  },

  '2E#2': {
    questions: [
      'Is the product available in several countries or regions — which ones, and since when? What adaptations did entering each market require?',
      'Show us growth metrics for expansion markets versus the home market over the last 12 months.',
      'What is retention and NPS in a new market compared to the home market — and what do those differences tell you about product fit?',
    ],
    example:
      "Evidence: a revenue-and-users-per-country report with a 12-month trend; documentation of product adaptations per market (language, payments, regulations); NPS per market for the last quarter. Signal: a new market reaches ≥60% of the home market's retention within 6 months.",
    suggestedTechnologies: [
      'Multi-language Support',
      'Local Payment Methods',
      'Compliance Management',
    ],
  },

  '2E#3': {
    questions: [
      'Is your product available through global platforms (App Store, Google Play, a marketplace, the cloud) — show us the listing and its metrics there.',
      'How does the product perform on global platforms compared to local alternatives — what do the download, rating, and conversion numbers say?',
      'Which global-platform features do you use to extend reach (global recommendations, featured placement, cross-store promotions)?',
    ],
    example:
      "Evidence: a screenshot of the global-platform listing with date and ratings; a downloads/installs-per-country report from the global platform; a history of product description or feature changes driven by the platform's algorithm. Signal: the product generates organic traffic from the global platform without active local marketing.",
    suggestedTechnologies: [
      'App Store Optimization (ASO)',
      'Global Marketplace',
      'Cloud Distribution',
    ],
  },

  '2E#4': {
    questions: [
      'In how many countries/regions is the product actively sold with local adaptation (language, currency, regulations, UI/UX)? Show us those markets.',
      'What does the product localization process look like — how long does it take and what does it cost to enter a new market once a strategic decision is made?',
      'What mechanisms in the product allow a new market to be added quickly (internationalization in the code, localization modules)?',
    ],
    example:
      'Evidence: a market list with per-market adaptation documentation; time-to-market for a new market from expansion history; product architecture highlighting i18n/l10n modules. Signal: time to enter a new market is under 3 months, not 18 months.',
    suggestedTechnologies: [
      'i18n/l10n Framework',
      'Multi-currency',
      'Local Compliance Tools',
      'CDN',
    ],
  },

  '2E#5': {
    questions: [
      'Is the product available globally without geographic restrictions — in how many countries, and how do you handle local regulatory requirements?',
      "How does the product's technical architecture support global scalability (CDN, multi-region deployment, disaster recovery)?",
      'Show us an example of cultural adaptation in the product that went beyond text translation (UX, icons, examples, date formats).',
    ],
    example:
      'Evidence: a product-usage-per-country report (a world heat map) for the last 30 days; multi-region architecture documentation with availability SLA; an A/B test example of cultural adaptation with results. Signal: the product serves ≥20 countries with a local SLA and local payment methods, without dedicated per-country software.',
    suggestedTechnologies: [
      'Global CDN',
      'Multi-region Cloud',
      'i18n/l10n',
      'Global Payment Gateway',
    ],
  },
};
