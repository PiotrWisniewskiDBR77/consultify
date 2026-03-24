/**
 * Seed 3 showcase demo ideas with rich canvas data:
 *
 * 1. Whiteboard — "Redesign procesu obsługi klienta" (colorful sticky notes, frames, shapes)
 * 2. Process Flow (VSM) — "Optymalizacja linii produkcyjnej — Value Stream Map"
 * 3. Table — "Analiza rentowności zakupu stanowiska zrobotyzowanego"
 *
 * Usage:
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." npx tsx server/scripts/seed-demo-ideas-showcase.ts
 *
 * Optional:
 *   SEED_ORG_ID=<organization id>
 *   SEED_USER_EMAIL=user@example.com
 */
import crypto from 'crypto';

import dotenv from 'dotenv';

import logger from '../src/utils/Logger.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

function nowIso() {
  return new Date().toISOString();
}
function isoPlusDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
function uid() {
  return crypto.randomUUID();
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEA 1: WHITEBOARD — Redesign procesu obsługi klienta
// ═══════════════════════════════════════════════════════════════════════════════

function buildWhiteboardData(ideaId: string) {
  const nodes: any[] = [];
  const edges: any[] = [];

  // ── Frames (grouping areas) ──
  nodes.push({
    id: 'frame-current',
    type: 'frameNode',
    position: { x: -20, y: -20 },
    data: {
      label: '🔍 Current State (AS-IS)',
      width: 580,
      height: 340,
      bgColor: '#fef2f2',
      semanticLabel: 'current-state',
    },
  });

  nodes.push({
    id: 'frame-future',
    type: 'frameNode',
    position: { x: 620, y: -20 },
    data: {
      label: '🚀 Target State (TO-BE)',
      width: 580,
      height: 340,
      bgColor: '#ecfdf5',
      semanticLabel: 'future-state',
    },
  });

  nodes.push({
    id: 'frame-actions',
    type: 'frameNode',
    position: { x: 200, y: 380 },
    data: {
      label: '⚡ Key Actions',
      width: 820,
      height: 260,
      bgColor: '#eff6ff',
      semanticLabel: 'actions',
    },
  });

  // ── Current state stickies (warm colors) ──
  const currentStickies = [
    { label: 'Customer calls hotline\n→ avg wait time: 8 min', color: '#fef9c3', colorIndex: 0, x: 20, y: 40 },
    { label: 'Manual routing\nbetween departments\n(3-4 transfers)', color: '#ffe4e6', colorIndex: 7, x: 210, y: 40 },
    { label: 'No contact history\n→ customer repeats issue', color: '#ffedd5', colorIndex: 5, x: 400, y: 40 },
    { label: 'NPS: 32\n(down 15 pts YoY)', color: '#fce7f3', colorIndex: 3, x: 20, y: 180 },
    { label: 'Avg resolution time:\n48h (target: 24h)', color: '#ffe4e6', colorIndex: 7, x: 210, y: 180 },
    { label: 'No self-service\n→ 70% of simple cases\nrequire an agent', color: '#fef9c3', colorIndex: 0, x: 400, y: 180 },
  ];

  currentStickies.forEach((s, i) => {
    nodes.push({
      id: `sticky-current-${i}`,
      type: 'stickyNote',
      position: { x: s.x, y: s.y },
      data: { label: s.label, color: s.color, colorIndex: s.colorIndex, size: 'm' },
    });
  });

  // ── Future state stickies (cool colors) ──
  const futureStickies = [
    { label: 'Omnichannel routing\n(AI-powered)\n→ wait time < 2 min', color: '#dcfce7', colorIndex: 2, x: 640, y: 40 },
    { label: 'Unified customer profile\n→ full contact history\nin a single view', color: '#dbeafe', colorIndex: 1, x: 830, y: 40 },
    { label: 'Chatbot + FAQ self-service\n→ 50% cases without agent', color: '#ccfbf1', colorIndex: 6, x: 640, y: 180 },
    { label: 'NPS target: 65+\n(+100% vs baseline)', color: '#f3e8ff', colorIndex: 4, x: 830, y: 180 },
    { label: 'SLA: resolution < 12h\nFirst Contact Resolution > 70%', color: '#dcfce7', colorIndex: 2, x: 1020, y: 40 },
    { label: 'Proactive notifications\non ticket status', color: '#dbeafe', colorIndex: 1, x: 1020, y: 180 },
  ];

  futureStickies.forEach((s, i) => {
    nodes.push({
      id: `sticky-future-${i}`,
      type: 'stickyNote',
      position: { x: s.x, y: s.y },
      data: { label: s.label, color: s.color, colorIndex: s.colorIndex, size: 'm' },
    });
  });

  // ── Action stickies (mixed colors) ──
  const actionStickies = [
    { label: '1. Deploy CRM\nwith 360° customer view', color: '#dbeafe', colorIndex: 1, x: 220, y: 420 },
    { label: '2. Integrate AI chatbot\n(FAQ + triage)', color: '#f3e8ff', colorIndex: 4, x: 420, y: 420 },
    { label: '3. Agent training\n+ new KPIs', color: '#dcfce7', colorIndex: 2, x: 620, y: 420 },
    { label: '4. A/B test new\nservice flow (pilot)', color: '#fef9c3', colorIndex: 0, x: 820, y: 420 },
    { label: 'Budget: $120K\nTimeline: Q2-Q3 2026', color: '#ffedd5', colorIndex: 5, x: 420, y: 560 },
    { label: 'Risk: agent adoption\n→ change management', color: '#ffe4e6', colorIndex: 7, x: 620, y: 560 },
  ];

  actionStickies.forEach((s, i) => {
    nodes.push({
      id: `sticky-action-${i}`,
      type: 'stickyNote',
      position: { x: s.x, y: s.y },
      data: { label: s.label, color: s.color, colorIndex: s.colorIndex, size: 'm' },
    });
  });

  // ── Shapes (key metrics / decision points) ──
  nodes.push({
    id: 'shape-diamond-1',
    type: 'shapeNode',
    position: { x: 280, y: -80 },
    data: { label: 'GO / NO-GO', shape: 'diamond', bgColor: '#fbbf24' },
  });

  nodes.push({
    id: 'shape-circle-roi',
    type: 'shapeNode',
    position: { x: 900, y: -80 },
    data: { label: 'ROI: 180%\n(18 mo.)', shape: 'circle', bgColor: '#34d399' },
  });

  // ── Text annotations ──
  nodes.push({
    id: 'text-title',
    type: 'textNode',
    position: { x: 350, y: -130 },
    data: { label: 'Customer Service Redesign — Brainstorm Board', semanticLabel: 'title' },
  });

  // ── Connector edges ──
  edges.push(
    { id: `e-${uid()}`, source: 'frame-current', target: 'shape-diamond-1', type: 'default', data: { label: 'Analysis' } },
    { id: `e-${uid()}`, source: 'shape-diamond-1', target: 'frame-future', type: 'default', data: { label: 'Transformation' } },
    { id: `e-${uid()}`, source: 'frame-future', target: 'frame-actions', type: 'default', data: { label: 'Implementation Plan' } },
    { id: `e-${uid()}`, source: 'sticky-action-0', target: 'sticky-action-1', type: 'default' },
    { id: `e-${uid()}`, source: 'sticky-action-1', target: 'sticky-action-2', type: 'default' },
    { id: `e-${uid()}`, source: 'sticky-action-2', target: 'sticky-action-3', type: 'default' },
  );

  const extensions = {
    whiteboard: {
      mode: 'board',
      viewState: { snap: true, showGrid: true },
      drawingPaths: [],
      scenes: [],
      bgPattern: 'dots',
      sessionState: { activeParticipants: [], cursorPositions: {} },
      libraryItems: [],
      outcomeRegistry: [],
      activityLog: [],
      historyLog: [],
    },
  };

  return { nodes, edges, extensions, version: 1 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEA 2: PROCESS FLOW (VSM) — Optymalizacja linii produkcyjnej
// ═══════════════════════════════════════════════════════════════════════════════

function buildProcessFlowVSMData(ideaId: string) {
  const nodes: any[] = [];
  const edges: any[] = [];

  const lanes = [
    { id: 'lane-supplier', label: 'Raw Material Supplier', color: '#e0e7ff' },
    { id: 'lane-production', label: 'Production Line', color: '#dbeafe' },
    { id: 'lane-quality', label: 'Quality Control', color: '#d1fae5' },
    { id: 'lane-logistics', label: 'Logistics / Warehouse', color: '#fef3c7' },
    { id: 'lane-customer', label: 'End Customer', color: '#fce7f3' },
  ];

  // ── Supplier ──
  nodes.push({
    id: 'vsm-supplier',
    type: 'flowNode',
    position: { x: 50, y: 20 },
    data: {
      label: 'Raw Material Supplier\n(3 vendors)',
      shape: 'vsm_supplier',
      laneId: 'lane-supplier',
      laneColor: '#e0e7ff',
    },
  });

  // ── Inventory: raw materials ──
  nodes.push({
    id: 'vsm-inv-raw',
    type: 'flowNode',
    position: { x: 250, y: 20 },
    data: {
      label: 'Raw Materials Storage',
      shape: 'vsm_inventory',
      laneId: 'lane-supplier',
      laneColor: '#e0e7ff',
      inventory: '5 days stock',
    },
  });

  // ── Production processes ──
  const prodSteps = [
    { id: 'vsm-p1', label: 'Cutting / Preparation', x: 50, ct: '45s', co: '15 min', uptime: '92%', ops: 2 },
    { id: 'vsm-p2', label: 'Main Assembly', x: 250, ct: '120s', co: '30 min', uptime: '85%', ops: 4 },
    { id: 'vsm-p3', label: 'Welding / Joining', x: 450, ct: '90s', co: '20 min', uptime: '88%', ops: 2 },
    { id: 'vsm-p4', label: 'Finishing', x: 650, ct: '60s', co: '10 min', uptime: '95%', ops: 2 },
  ];

  prodSteps.forEach((step) => {
    nodes.push({
      id: step.id,
      type: 'flowNode',
      position: { x: step.x, y: 160 },
      data: {
        label: step.label,
        shape: 'vsm_process',
        laneId: 'lane-production',
        laneColor: '#dbeafe',
        cycleTime: step.ct,
        changeoverTime: step.co,
        uptimePercent: step.uptime,
        operators: step.ops,
      },
    });
  });

  // ── WIP inventories between steps ──
  nodes.push({
    id: 'vsm-inv-wip1',
    type: 'flowNode',
    position: { x: 180, y: 160 },
    data: { label: 'WIP', shape: 'vsm_inventory', laneId: 'lane-production', laneColor: '#dbeafe', inventory: '120 pcs' },
  });
  nodes.push({
    id: 'vsm-inv-wip2',
    type: 'flowNode',
    position: { x: 380, y: 160 },
    data: { label: 'WIP', shape: 'vsm_inventory', laneId: 'lane-production', laneColor: '#dbeafe', inventory: '85 pcs' },
  });
  nodes.push({
    id: 'vsm-inv-wip3',
    type: 'flowNode',
    position: { x: 580, y: 160 },
    data: { label: 'WIP', shape: 'vsm_inventory', laneId: 'lane-production', laneColor: '#dbeafe', inventory: '40 pcs' },
  });

  // ── Quality control ──
  nodes.push({
    id: 'vsm-qc',
    type: 'flowNode',
    position: { x: 350, y: 310 },
    data: {
      label: 'Quality Control\n(visual + measurement)',
      shape: 'vsm_process',
      laneId: 'lane-quality',
      laneColor: '#d1fae5',
      cycleTime: '30s',
      uptimePercent: '99%',
      operators: 1,
    },
  });

  nodes.push({
    id: 'vsm-decision-qc',
    type: 'flowNode',
    position: { x: 550, y: 310 },
    data: {
      label: 'OK / NOK?',
      shape: 'decision',
      laneId: 'lane-quality',
      laneColor: '#d1fae5',
    },
  });

  // ── Logistics / Warehouse ──
  nodes.push({
    id: 'vsm-inv-finished',
    type: 'flowNode',
    position: { x: 250, y: 460 },
    data: {
      label: 'Finished Goods Warehouse',
      shape: 'vsm_inventory',
      laneId: 'lane-logistics',
      laneColor: '#fef3c7',
      inventory: '3 days stock',
    },
  });

  nodes.push({
    id: 'vsm-shipping',
    type: 'flowNode',
    position: { x: 500, y: 460 },
    data: {
      label: 'Packing + Shipping',
      shape: 'vsm_process',
      laneId: 'lane-logistics',
      laneColor: '#fef3c7',
      cycleTime: '180s',
      operators: 3,
    },
  });

  // ── Customer ──
  nodes.push({
    id: 'vsm-customer',
    type: 'flowNode',
    position: { x: 350, y: 600 },
    data: {
      label: 'End Customer\n(orders: 200 pcs/day)',
      shape: 'vsm_customer',
      laneId: 'lane-customer',
      laneColor: '#fce7f3',
    },
  });

  // ── Kaizen bursts ──
  nodes.push({
    id: 'vsm-kaizen-1',
    type: 'flowNode',
    position: { x: 250, y: 100 },
    data: {
      label: 'KAIZEN: Reduce WIP by 40%',
      shape: 'vsm_kaizen',
      laneId: 'lane-production',
      laneColor: '#dbeafe',
    },
  });

  nodes.push({
    id: 'vsm-kaizen-2',
    type: 'flowNode',
    position: { x: 650, y: 100 },
    data: {
      label: 'KAIZEN: SMED on finishing',
      shape: 'vsm_kaizen',
      laneId: 'lane-production',
      laneColor: '#dbeafe',
    },
  });

  // ── Push/Pull arrows ──
  nodes.push({
    id: 'vsm-push',
    type: 'flowNode',
    position: { x: 150, y: 100 },
    data: { label: 'PUSH', shape: 'vsm_push_arrow', laneId: 'lane-production', laneColor: '#dbeafe' },
  });

  nodes.push({
    id: 'vsm-pull',
    type: 'flowNode',
    position: { x: 550, y: 100 },
    data: { label: 'PULL (Kanban)', shape: 'vsm_pull_arrow', laneId: 'lane-production', laneColor: '#dbeafe' },
  });

  // ── Edges (flow connections) ──
  const flowEdges = [
    ['vsm-supplier', 'vsm-inv-raw', ''],
    ['vsm-inv-raw', 'vsm-p1', ''],
    ['vsm-p1', 'vsm-inv-wip1', ''],
    ['vsm-inv-wip1', 'vsm-p2', ''],
    ['vsm-p2', 'vsm-inv-wip2', ''],
    ['vsm-inv-wip2', 'vsm-p3', ''],
    ['vsm-p3', 'vsm-inv-wip3', ''],
    ['vsm-inv-wip3', 'vsm-p4', ''],
    ['vsm-p4', 'vsm-qc', ''],
    ['vsm-qc', 'vsm-decision-qc', ''],
    ['vsm-decision-qc', 'vsm-inv-finished', 'OK'],
    ['vsm-decision-qc', 'vsm-p3', 'NOK → rework'],
    ['vsm-inv-finished', 'vsm-shipping', ''],
    ['vsm-shipping', 'vsm-customer', ''],
  ];

  flowEdges.forEach(([src, tgt, label]) => {
    edges.push({
      id: `fe-${uid()}`,
      source: src,
      target: tgt,
      type: 'flowEdge',
      data: label ? { label, conditionType: label.includes('OK') ? 'yes' : label.includes('NOK') ? 'no' : undefined } : {},
    });
  });

  const extensions = {
    processFlow: {
      lanes,
      flowMode: 'vsm',
      semanticKit: 'vsm',
      viewState: { layoutMode: 'free', showGrid: true, snap: true },
    },
  };

  return { nodes, edges, extensions, version: 1 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEA 3: TABLE — Analiza rentowności zakupu stanowiska zrobotyzowanego
// ═══════════════════════════════════════════════════════════════════════════════

function buildTableData(ideaId: string) {
  const columns = [
    { key: 'name', header: 'Workstation / Variant', type: 'text', visible: true, width: 220 },
    { key: 'vendor', header: 'Vendor', type: 'select', visible: true, width: 140, options: ['FANUC', 'KUKA', 'ABB', 'Universal Robots', 'Yaskawa'], optionColors: { FANUC: '#fef3c7', KUKA: '#dbeafe', ABB: '#d1fae5', 'Universal Robots': '#f3e8ff', Yaskawa: '#fce7f3' } },
    { key: 'type', header: 'Robot Type', type: 'select', visible: true, width: 130, options: ['Industrial', 'Cobot', 'SCARA', 'Delta'], optionColors: { Industrial: '#e0e7ff', Cobot: '#dcfce7', SCARA: '#fef3c7', Delta: '#fce7f3' } },
    { key: 'capex', header: 'CAPEX ($)', type: 'currency', visible: true, width: 130 },
    { key: 'install_cost', header: 'Installation Cost', type: 'currency', visible: true, width: 130 },
    { key: 'annual_maintenance', header: 'Annual Maintenance', type: 'currency', visible: true, width: 140 },
    { key: 'annual_savings', header: 'Annual Savings', type: 'currency', visible: true, width: 150 },
    { key: 'payback_months', header: 'Payback (mo.)', type: 'number', visible: true, width: 120 },
    { key: 'roi_3y', header: '3-Year ROI', type: 'text', visible: true, width: 100 },
    { key: 'fte_replaced', header: 'FTE Replaced', type: 'number', visible: true, width: 110 },
    { key: 'cycle_time', header: 'Cycle Time (s)', type: 'number', visible: true, width: 110 },
    { key: 'quality_improvement', header: 'Quality Improvement', type: 'text', visible: true, width: 130 },
    { key: 'risk', header: 'Implementation Risk', type: 'select', visible: true, width: 130, options: ['Low', 'Medium', 'High'], optionColors: { Low: '#d1fae5', Medium: '#fef3c7', High: '#fee2e2' } },
    { key: 'status', header: 'Analysis Status', type: 'status', visible: true, width: 130 },
    { key: 'priority', header: 'Priority', type: 'rating', visible: true, width: 100 },
    { key: 'notes', header: 'Notes', type: 'text', visible: true, width: 200 },
  ];

  const rows = [
    {
      id: `row-${uid()}`,
      type: 'idea',
      data: {
        name: 'Welding Station — FANUC ARC Mate 100iD',
        vendor: 'FANUC',
        type: 'Industrial',
        capex: 95000,
        install_cost: 24000,
        annual_maintenance: 7000,
        annual_savings: 61000,
        payback_months: 22,
        roi_3y: '156%',
        fte_replaced: 2.5,
        cycle_time: 45,
        quality_improvement: 'Defects: -65%',
        risk: 'Low',
        status: 'done',
        priority: 5,
        notes: 'Recommendation #1. Best ROI-to-risk ratio. Vendor with local service.',
      },
      position: { x: 0, y: 0 },
    },
    {
      id: `row-${uid()}`,
      type: 'idea',
      data: {
        name: 'Palletizing Station — KUKA KR 180 R3200',
        vendor: 'KUKA',
        type: 'Industrial',
        capex: 130000,
        install_cost: 32500,
        annual_maintenance: 10500,
        annual_savings: 77500,
        payback_months: 25,
        roi_3y: '130%',
        fte_replaced: 3,
        cycle_time: 18,
        quality_improvement: 'Damage: -80%',
        risk: 'Medium',
        status: 'in_progress',
        priority: 4,
        notes: 'Requires packing zone rebuild. High scale potential.',
      },
      position: { x: 0, y: 1 },
    },
    {
      id: `row-${uid()}`,
      type: 'idea',
      data: {
        name: 'Assembly Cobot — UR10e + OnRobot Gripper',
        vendor: 'Universal Robots',
        type: 'Cobot',
        capex: 49000,
        install_cost: 8800,
        annual_maintenance: 3000,
        annual_savings: 30000,
        payback_months: 23,
        roi_3y: '145%',
        fte_replaced: 1,
        cycle_time: 90,
        quality_improvement: 'Repeatability: +40%',
        risk: 'Low',
        status: 'in_progress',
        priority: 4,
        notes: 'Easy integration, no fencing. Ideal for small batches.',
      },
      position: { x: 0, y: 2 },
    },
    {
      id: `row-${uid()}`,
      type: 'idea',
      data: {
        name: 'Vision Inspection — ABB IRB 1200 + Cognex Camera',
        vendor: 'ABB',
        type: 'Industrial',
        capex: 72500,
        install_cost: 21300,
        annual_maintenance: 5500,
        annual_savings: 45000,
        payback_months: 24,
        roi_3y: '128%',
        fte_replaced: 2,
        cycle_time: 8,
        quality_improvement: 'Detection: 99.7%',
        risk: 'Medium',
        status: 'todo',
        priority: 3,
        notes: 'Requires MES integration. Critical for ISO certification.',
      },
      position: { x: 0, y: 3 },
    },
    {
      id: `row-${uid()}`,
      type: 'idea',
      data: {
        name: 'Pick & Place — SCARA Yaskawa SG650',
        vendor: 'Yaskawa',
        type: 'SCARA',
        capex: 36300,
        install_cost: 6300,
        annual_maintenance: 2500,
        annual_savings: 23800,
        payback_months: 21,
        roi_3y: '160%',
        fte_replaced: 1.5,
        cycle_time: 3,
        quality_improvement: 'Precision: ±0.01mm',
        risk: 'Low',
        status: 'done',
        priority: 5,
        notes: 'Fastest payback. Ideal for sorting and packing.',
      },
      position: { x: 0, y: 4 },
    },
    {
      id: `row-${uid()}`,
      type: 'idea',
      data: {
        name: 'Robotic CNC Cell — FANUC M-20iD/25 + Loading',
        vendor: 'FANUC',
        type: 'Industrial',
        capex: 112500,
        install_cost: 27500,
        annual_maintenance: 8800,
        annual_savings: 70000,
        payback_months: 24,
        roi_3y: '140%',
        fte_replaced: 2,
        cycle_time: 55,
        quality_improvement: 'OEE: +25%',
        risk: 'Medium',
        status: 'in_progress',
        priority: 4,
        notes: 'Tends 3 CNC machines. Runs 3 shifts unattended.',
      },
      position: { x: 0, y: 5 },
    },
    {
      id: `row-${uid()}`,
      type: 'idea',
      data: {
        name: 'Delta Robot — Blister Packing (Pharma)',
        vendor: 'ABB',
        type: 'Delta',
        capex: 52500,
        install_cost: 13800,
        annual_maintenance: 4500,
        annual_savings: 37500,
        payback_months: 21,
        roi_3y: '155%',
        fte_replaced: 2,
        cycle_time: 2,
        quality_improvement: 'Cleanroom: ISO 8',
        risk: 'High',
        status: 'todo',
        priority: 3,
        notes: 'Requires cleanroom. High ROI but complex regulatory requirements.',
      },
      position: { x: 0, y: 6 },
    },
    {
      id: `row-${uid()}`,
      type: 'idea',
      data: {
        name: 'Painting Cobot — UR16e + Spray System',
        vendor: 'Universal Robots',
        type: 'Cobot',
        capex: 57500,
        install_cost: 15000,
        annual_maintenance: 5000,
        annual_savings: 40000,
        payback_months: 22,
        roi_3y: '142%',
        fte_replaced: 1.5,
        cycle_time: 120,
        quality_improvement: 'Uniformity: +55%',
        risk: 'Medium',
        status: 'todo',
        priority: 3,
        notes: 'Improves HSE (eliminates fume exposure for operators).',
      },
      position: { x: 0, y: 7 },
    },
  ];

  const views = [
    { id: 'view-default', name: 'All Variants', layout: 'table', icon: '📊' },
    { id: 'view-roi', name: 'ROI Ranking', layout: 'table', sort: [{ key: 'roi_3y', direction: 'desc' }], icon: '💰' },
    { id: 'view-kanban', name: 'Analysis Status', layout: 'kanban', groupBy: 'status', icon: '📋' },
  ];

  const extensions = {
    table: {
      columns,
      views,
      activeViewId: 'view-default',
      viewState: { sort: null, filters: { logic: 'and', rules: [] }, groupBy: null },
      formatting: [],
      viewLayout: 'table',
    },
  };

  return { nodes: rows, edges: [], extensions, version: 1 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  process.env.DB_TYPE = process.env.DB_TYPE || 'postgres';

  const seedDbName = (process.env.SEED_DB_NAME || '').trim();
  if (seedDbName && process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      u.pathname = `/${seedDbName}`;
      process.env.DATABASE_URL = u.toString();
    } catch {}
  }

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  const seedOrgId = (process.env.SEED_ORG_ID || '').trim() || null;
  const seedUserEmail = (process.env.SEED_USER_EMAIL || '').trim() || null;
  const seedUserId = (process.env.SEED_USER_ID || '').trim() || null;
  const directOrgId = (process.env.SEED_DIRECT_ORG_ID || '').trim() || null;

  // Direct mode: skip DB user lookup entirely (for JWT-only sessions)
  if (seedUserId && directOrgId) {
    logger.info('[seed-showcase] DIRECT mode — skipping user lookup', { userId: seedUserId, orgId: directOrgId });
    var userId = seedUserId;
    var effectiveOrgId = directOrgId;
  } else {
    const requestedOrgId = seedOrgId;
    if (!requestedOrgId) {
      throw new Error('[seed-showcase] Set SEED_ORG_ID explicitly.');
    }
    const orgId = await (async () => {
      const r = await db.query<{ id: string }>(`SELECT id FROM organizations WHERE id = $1 LIMIT 1`, [
        requestedOrgId,
      ]);
      return r?.rows?.[0]?.id || null;
    })();
    if (!orgId) {
      throw new Error(`[seed-showcase] Target organization "${requestedOrgId}" not found.`);
    }

    const userRow = await (async () => {
      if (seedUserId) {
        const r = await db.query<{ id: string; email: string; organization_id: string }>(
          `SELECT id, email, organization_id FROM users WHERE id = $1 LIMIT 1`,
          [seedUserId]
        );
        if (r?.rows?.[0]?.id) return r.rows[0];
        throw new Error(`User not found by ID: ${seedUserId}`);
      }
      if (seedUserEmail) {
        const r = await db.query<{ id: string; email: string; organization_id: string }>(
          `SELECT id, email, organization_id FROM users WHERE email = $1 LIMIT 1`,
          [seedUserEmail]
        );
        if (r?.rows?.[0]?.id) {
          if (String(r.rows[0].organization_id || '') !== orgId) {
            throw new Error(
              `[seed-showcase] User ${seedUserEmail} belongs to organization "${r.rows[0].organization_id}", not "${orgId}".`
            );
          }
          return r.rows[0];
        }
        throw new Error(`User not found: ${seedUserEmail}`);
      }
      const r = await db.query<{ id: string; email: string }>(
        `SELECT id, email FROM users WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [orgId]
      );
      return r?.rows?.[0] || null;
    })();
    if (!userRow?.id) throw new Error('No users found.');
    var userId = userRow.id;

    const userOrgRow = await db.query<{ organization_id: string }>(
      `SELECT organization_id FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    var effectiveOrgId = userOrgRow?.rows?.[0]?.organization_id || orgId;
  }

  logger.info('[seed-showcase] Target', { orgId: effectiveOrgId, userId });

  const createdAt = nowIso();

  const ideas = [
    {
      slug: 'whiteboard-cx',
      title: 'Customer Service Process Redesign',
      body:
        'Brainstorm: how to redesign the customer service process to reduce response time, raise NPS and implement self-service.\n\n' +
        'Canvas: Whiteboard with AS-IS / TO-BE analysis, key actions and ROI metrics.',
      tags: ['showcase', 'whiteboard', 'customer-experience', 'brainstorm'],
      stage: 'shaping',
      area: 'Customer Experience',
      priority: 85,
      branch: 'operations',
      preferredTool: 'whiteboard',
      buildMap: buildWhiteboardData,
    },
    {
      slug: 'vsm-production',
      title: 'Production Line Optimization — Value Stream Map',
      body:
        'Value Stream Map (VSM) for the production line: from raw material supplier, through production processes, quality control, to the end customer.\n\n' +
        'Includes: cycle times, WIP inventory, Kaizen bursts, push/pull flow.',
      tags: ['showcase', 'process-flow', 'vsm', 'lean', 'production'],
      stage: 'shaping',
      area: 'Operations / Manufacturing',
      priority: 90,
      branch: 'execution',
      preferredTool: 'process_flow',
      buildMap: buildProcessFlowVSMData,
    },
    {
      slug: 'table-robot-roi',
      title: 'Robotic Workstation ROI Analysis',
      body:
        'Comparison of 8 robotics variants for production workstations: welding, palletizing, assembly, vision inspection, pick & place, CNC, packing, painting.\n\n' +
        'Analysis covers: CAPEX, installation costs, annual savings, payback, 3-year ROI, FTE, quality.',
      tags: ['showcase', 'table', 'robotics', 'roi-analysis', 'capex'],
      stage: 'ready',
      area: 'Technology / Automation',
      priority: 92,
      branch: 'execution',
      preferredTool: 'table',
      buildMap: buildTableData,
    },
  ];

  for (const idea of ideas) {
    const ideaId = `showcase_${idea.slug}_${Date.now()}`;
    const mapData = idea.buildMap(ideaId);

    await db.run(
      `INSERT INTO my_ideas(
        id, user_id, organization_id, title, body, tags, source_type,
        stage, area, priority, branch,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        tags = excluded.tags,
        stage = excluded.stage,
        area = excluded.area,
        priority = excluded.priority,
        branch = excluded.branch,
        updated_at = excluded.updated_at`,
      [
        ideaId,
        userId,
        effectiveOrgId,
        idea.title,
        idea.body,
        JSON.stringify(idea.tags),
        'seed',
        idea.stage,
        idea.area,
        idea.priority,
        idea.branch,
        isoPlusDays(-2),
        createdAt,
      ]
    );

    const mapId = `showcase_map_${idea.slug}_${Date.now()}`;
    await db.run(
      `INSERT INTO my_idea_maps(
        id, idea_id, user_id, organization_id,
        nodes_json, edges_json, extensions_json,
        preferred_tool, version,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (user_id, idea_id) DO UPDATE SET
        nodes_json = excluded.nodes_json,
        edges_json = excluded.edges_json,
        extensions_json = excluded.extensions_json,
        preferred_tool = excluded.preferred_tool,
        version = excluded.version,
        updated_at = excluded.updated_at`,
      [
        mapId,
        ideaId,
        userId,
        effectiveOrgId,
        JSON.stringify(mapData.nodes),
        JSON.stringify(mapData.edges),
        JSON.stringify(mapData.extensions),
        idea.preferredTool,
        mapData.version,
        createdAt,
        createdAt,
      ]
    );

    logger.info(`[seed-showcase] Created: ${idea.title}`, { ideaId, mapId, tool: idea.preferredTool });
  }

  logger.info('[seed-showcase] Done! 3 showcase ideas created.');
}

main().catch((err) => {
  logger.error('[seed-showcase] Failed:', err?.message || err);
  process.exit(1);
});
