/**
 * IdeaTemplateGallery — Template selection for Idea Workspace canvas tools.
 *
 * Provides pre-built templates for Process Flow and Mind Map tools.
 * Templates are loaded into the workspace graph via Api.syncMyIdeaMap.
 */
import {
  ArrowRight,
  FileText,
  GitBranch,
  Layers,
  LayoutGrid,
  Loader2,
  Network,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

// Closure (2026-08-10) 04_ACTION_COVERAGE_INVENTORY.csv class-d: this is the
// ONE call site in this file that imports the registry (mirrors the registry's
// own deliberate exception importing `findIdeaTemplate` FROM this file, see
// `ideaActionRegistry.ts` top-of-file comment). Circular module reference is
// safe here: both `runIdeaAction` (function declaration, hoisted) and
// `findIdeaTemplate` are only ever CALLED from inside event-handler closures
// (button onClick / registry action handler), never read at module-eval time,
// so ESM live-bindings resolve correctly regardless of which side loads first.
import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';

import type { CanvasTemplateGovernanceMeta } from './canvas/canvasOsContract';
// #10-AB: baza ~40 startowych szablonów konsultingowych (7 kategorii). Import
// value; moduł importuje z tego pliku wyłącznie TYP (erased) → brak cyklu runtime.
import { CONSULTING_TEMPLATES } from './ideaConsultingTemplates';
import { EMPTY_SELECTION, type CanvasToolType } from './ideaSelectionTypes';
import { useConfirmDialog } from './shared/ConfirmDialog';

// ── Template types ───────────────────────────────────────────────────────────

export interface TemplateDefinition {
  id: string;
  nameEn: string;
  namePl: string;
  descEn: string;
  descPl: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tool: CanvasToolType;
  nodes: any[];
  edges: any[];
  extensions: Record<string, unknown>;
  governance?: CanvasTemplateGovernanceMeta;
  /**
   * #10-AB: fine-grained consulting catalog group (7 kategorii biznesowych)
   * ponad grubą `governance.category`. Używane przez galerię-akcept (dev-render)
   * do grupowania startowych szablonów konsultingowych. Opcjonalne — nie dotyczy
   * legacy szablonów canvas.
   */
  catalogGroup?: string;
}

// ── Process Flow templates ───────────────────────────────────────────────────

const PROCESS_FLOW_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'pf-blank',
    nameEn: 'Blank Process',
    namePl: 'Pusty proces',
    descEn: 'Start from scratch with an empty canvas',
    descPl: 'Zacznij od pustego canvas',
    icon: FileText,
    tool: 'process_flow',
    nodes: [],
    edges: [],
    extensions: { processFlow: { lanes: [{ id: 'lane-1', label: 'Lane 1', color: '#e0e7ff' }] } },
  },
  {
    id: 'pf-process-improvement',
    nameEn: 'Process Improvement Workshop',
    namePl: 'Warsztat usprawnienia procesu',
    descEn: 'Current state, bottlenecks, target state, and KPI checkpoints in one starter.',
    descPl: 'Stan obecny, bottlenecks, stan docelowy i checkpointy KPI w jednym starterze.',
    icon: Sparkles,
    tool: 'process_flow',
    nodes: [
      {
        id: 'pf-pi-start',
        type: 'flowNode',
        position: { x: 40, y: 60 },
        data: {
          label: 'Current state start',
          shape: 'start',
          laneId: 'lane-current',
          laneColor: '#dbeafe',
        },
      },
      {
        id: 'pf-pi-map',
        type: 'flowNode',
        position: { x: 240, y: 60 },
        data: {
          label: 'Map current process',
          shape: 'action',
          laneId: 'lane-current',
          laneColor: '#dbeafe',
        },
      },
      {
        id: 'pf-pi-bottleneck',
        type: 'flowNode',
        position: { x: 460, y: 60 },
        data: {
          label: 'Identify bottlenecks',
          shape: 'decision',
          laneId: 'lane-current',
          laneColor: '#dbeafe',
        },
      },
      {
        id: 'pf-pi-kpi',
        type: 'flowNode',
        position: { x: 700, y: 220 },
        data: {
          label: 'Define KPI baseline',
          shape: 'action',
          laneId: 'lane-kpi',
          laneColor: '#fef3c7',
        },
      },
      {
        id: 'pf-pi-hypothesis',
        type: 'flowNode',
        position: { x: 700, y: 60 },
        data: {
          label: 'Improvement hypothesis',
          shape: 'action',
          laneId: 'lane-target',
          laneColor: '#d1fae5',
        },
      },
      {
        id: 'pf-pi-future',
        type: 'flowNode',
        position: { x: 930, y: 60 },
        data: {
          label: 'Future state design',
          shape: 'action',
          laneId: 'lane-target',
          laneColor: '#d1fae5',
        },
      },
      {
        id: 'pf-pi-review',
        type: 'flowNode',
        position: { x: 1160, y: 140 },
        data: { label: 'Review impact', shape: 'end', laneId: 'lane-kpi', laneColor: '#fef3c7' },
      },
    ],
    edges: [
      { id: 'e-pi-1', source: 'pf-pi-start', target: 'pf-pi-map', type: 'flowEdge' },
      { id: 'e-pi-2', source: 'pf-pi-map', target: 'pf-pi-bottleneck', type: 'flowEdge' },
      {
        id: 'e-pi-3',
        source: 'pf-pi-bottleneck',
        target: 'pf-pi-hypothesis',
        type: 'flowEdge',
        label: 'High impact',
        data: { conditionType: 'yes' },
      },
      {
        id: 'e-pi-4',
        source: 'pf-pi-bottleneck',
        target: 'pf-pi-kpi',
        type: 'flowEdge',
        label: 'Needs baseline',
        data: { conditionType: 'default' },
      },
      { id: 'e-pi-5', source: 'pf-pi-kpi', target: 'pf-pi-review', type: 'flowEdge' },
      { id: 'e-pi-6', source: 'pf-pi-hypothesis', target: 'pf-pi-future', type: 'flowEdge' },
      { id: 'e-pi-7', source: 'pf-pi-future', target: 'pf-pi-review', type: 'flowEdge' },
    ],
    extensions: {
      processFlow: {
        lanes: [
          { id: 'lane-current', label: 'Current state', color: '#dbeafe' },
          { id: 'lane-target', label: 'Target state', color: '#d1fae5' },
          { id: 'lane-kpi', label: 'KPI / Review', color: '#fef3c7' },
        ],
        semanticKit: 'classic',
      },
    },
    governance: {
      category: 'process',
      library: 'core',
      version: '1.0.0',
      scope: 'global',
      capability: 'real',
    },
  },
  {
    id: 'pf-basic',
    nameEn: 'Basic Process',
    namePl: 'Podstawowy proces',
    descEn: 'Start → Analysis → Decision → Action → End',
    descPl: 'Start → Analiza → Decyzja → Akcja → Koniec',
    icon: Workflow,
    tool: 'process_flow',
    nodes: [
      {
        id: 'pf-t-s',
        type: 'flowNode',
        position: { x: 50, y: 60 },
        data: { label: 'Start', shape: 'start', laneId: 'lane-1', laneColor: '#e0e7ff' },
      },
      {
        id: 'pf-t-a1',
        type: 'flowNode',
        position: { x: 250, y: 60 },
        data: { label: 'Analysis', shape: 'action', laneId: 'lane-1', laneColor: '#e0e7ff' },
      },
      {
        id: 'pf-t-d1',
        type: 'flowNode',
        position: { x: 450, y: 60 },
        data: { label: 'Decision', shape: 'decision', laneId: 'lane-1', laneColor: '#e0e7ff' },
      },
      {
        id: 'pf-t-a2',
        type: 'flowNode',
        position: { x: 650, y: 20 },
        data: { label: 'Action', shape: 'action', laneId: 'lane-1', laneColor: '#e0e7ff' },
      },
      {
        id: 'pf-t-e',
        type: 'flowNode',
        position: { x: 850, y: 60 },
        data: { label: 'End', shape: 'end', laneId: 'lane-1', laneColor: '#e0e7ff' },
      },
    ],
    edges: [
      { id: 'e-t-1', source: 'pf-t-s', target: 'pf-t-a1', type: 'flowEdge' },
      { id: 'e-t-2', source: 'pf-t-a1', target: 'pf-t-d1', type: 'flowEdge' },
      {
        id: 'e-t-3',
        source: 'pf-t-d1',
        target: 'pf-t-a2',
        type: 'flowEdge',
        label: 'Yes',
        data: { conditionType: 'yes' },
      },
      {
        id: 'e-t-4',
        source: 'pf-t-d1',
        target: 'pf-t-e',
        type: 'flowEdge',
        label: 'No',
        data: { conditionType: 'no' },
      },
      { id: 'e-t-5', source: 'pf-t-a2', target: 'pf-t-e', type: 'flowEdge' },
    ],
    extensions: {
      processFlow: { lanes: [{ id: 'lane-1', label: 'Main Process', color: '#e0e7ff' }] },
    },
  },
  {
    id: 'pf-approval',
    nameEn: 'Approval Workflow',
    namePl: 'Workflow zatwierdzania',
    descEn: 'Request → Review → Approve/Reject → Notify',
    descPl: 'Wniosek → Przegląd → Zatwierdzenie/Odrzucenie → Powiadomienie',
    icon: Layers,
    tool: 'process_flow',
    nodes: [
      {
        id: 'pf-ap-s',
        type: 'flowNode',
        position: { x: 50, y: 60 },
        data: { label: 'Submit Request', shape: 'start', laneId: 'lane-req', laneColor: '#dbeafe' },
      },
      {
        id: 'pf-ap-r',
        type: 'flowNode',
        position: { x: 250, y: 200 },
        data: { label: 'Review', shape: 'action', laneId: 'lane-rev', laneColor: '#d1fae5' },
      },
      {
        id: 'pf-ap-d',
        type: 'flowNode',
        position: { x: 450, y: 200 },
        data: { label: 'Approve?', shape: 'decision', laneId: 'lane-rev', laneColor: '#d1fae5' },
      },
      {
        id: 'pf-ap-n1',
        type: 'flowNode',
        position: { x: 650, y: 60 },
        data: {
          label: 'Notify Approved',
          shape: 'action',
          laneId: 'lane-req',
          laneColor: '#dbeafe',
        },
      },
      {
        id: 'pf-ap-n2',
        type: 'flowNode',
        position: { x: 650, y: 200 },
        data: {
          label: 'Notify Rejected',
          shape: 'action',
          laneId: 'lane-rev',
          laneColor: '#d1fae5',
        },
      },
      {
        id: 'pf-ap-e',
        type: 'flowNode',
        position: { x: 850, y: 130 },
        data: { label: 'End', shape: 'end', laneId: 'lane-req', laneColor: '#dbeafe' },
      },
    ],
    edges: [
      { id: 'e-ap-1', source: 'pf-ap-s', target: 'pf-ap-r', type: 'flowEdge' },
      { id: 'e-ap-2', source: 'pf-ap-r', target: 'pf-ap-d', type: 'flowEdge' },
      {
        id: 'e-ap-3',
        source: 'pf-ap-d',
        target: 'pf-ap-n1',
        type: 'flowEdge',
        label: 'Yes',
        data: { conditionType: 'yes' },
      },
      {
        id: 'e-ap-4',
        source: 'pf-ap-d',
        target: 'pf-ap-n2',
        type: 'flowEdge',
        label: 'No',
        data: { conditionType: 'no' },
      },
      { id: 'e-ap-5', source: 'pf-ap-n1', target: 'pf-ap-e', type: 'flowEdge' },
      { id: 'e-ap-6', source: 'pf-ap-n2', target: 'pf-ap-e', type: 'flowEdge' },
    ],
    extensions: {
      processFlow: {
        lanes: [
          { id: 'lane-req', label: 'Requester', color: '#dbeafe' },
          { id: 'lane-rev', label: 'Reviewer', color: '#d1fae5' },
        ],
      },
    },
  },
  {
    id: 'pf-pdca',
    nameEn: 'PDCA Cycle',
    namePl: 'Cykl PDCA',
    descEn: 'Plan → Do → Check → Act continuous improvement cycle',
    descPl: 'Planuj → Wykonaj → Sprawdź → Działaj — cykl ciągłego doskonalenia',
    icon: LayoutGrid,
    tool: 'process_flow',
    nodes: [
      {
        id: 'pf-pdca-s',
        type: 'flowNode',
        position: { x: 50, y: 60 },
        data: { label: 'Start', shape: 'start', laneId: 'lane-pdca', laneColor: '#e0e7ff' },
      },
      {
        id: 'pf-pdca-p',
        type: 'flowNode',
        position: { x: 250, y: 60 },
        data: { label: 'Plan', shape: 'action', laneId: 'lane-pdca', laneColor: '#e0e7ff' },
      },
      {
        id: 'pf-pdca-d',
        type: 'flowNode',
        position: { x: 450, y: 60 },
        data: { label: 'Do', shape: 'action', laneId: 'lane-pdca', laneColor: '#e0e7ff' },
      },
      {
        id: 'pf-pdca-c',
        type: 'flowNode',
        position: { x: 650, y: 60 },
        data: { label: 'Check', shape: 'action', laneId: 'lane-pdca', laneColor: '#e0e7ff' },
      },
      {
        id: 'pf-pdca-a',
        type: 'flowNode',
        position: { x: 850, y: 60 },
        data: { label: 'Act', shape: 'action', laneId: 'lane-pdca', laneColor: '#e0e7ff' },
      },
      {
        id: 'pf-pdca-ok',
        type: 'flowNode',
        position: { x: 1050, y: 60 },
        data: {
          label: 'Satisfactory?',
          shape: 'decision',
          laneId: 'lane-pdca',
          laneColor: '#e0e7ff',
        },
      },
      {
        id: 'pf-pdca-e',
        type: 'flowNode',
        position: { x: 1250, y: 60 },
        data: { label: 'Standardize', shape: 'end', laneId: 'lane-pdca', laneColor: '#e0e7ff' },
      },
    ],
    edges: [
      { id: 'e-pdca-1', source: 'pf-pdca-s', target: 'pf-pdca-p', type: 'flowEdge' },
      { id: 'e-pdca-2', source: 'pf-pdca-p', target: 'pf-pdca-d', type: 'flowEdge' },
      { id: 'e-pdca-3', source: 'pf-pdca-d', target: 'pf-pdca-c', type: 'flowEdge' },
      { id: 'e-pdca-4', source: 'pf-pdca-c', target: 'pf-pdca-a', type: 'flowEdge' },
      { id: 'e-pdca-5', source: 'pf-pdca-a', target: 'pf-pdca-ok', type: 'flowEdge' },
      {
        id: 'e-pdca-6',
        source: 'pf-pdca-ok',
        target: 'pf-pdca-e',
        type: 'flowEdge',
        label: 'Yes',
        data: { conditionType: 'yes' },
      },
      {
        id: 'e-pdca-7',
        source: 'pf-pdca-ok',
        target: 'pf-pdca-p',
        type: 'flowEdge',
        label: 'No',
        data: { conditionType: 'no' },
      },
    ],
    extensions: {
      processFlow: { lanes: [{ id: 'lane-pdca', label: 'PDCA Cycle', color: '#e0e7ff' }] },
    },
  },
  {
    id: 'pf-o2c',
    nameEn: 'Order-to-Cash (O2C)',
    namePl: 'Order-to-Cash (O2C)',
    descEn: 'Order → Credit Check → Confirm → Pick & Pack → Ship → Invoice → Payment → Close',
    descPl:
      'Zamówienie → Weryfikacja kredytowa → Potwierdzenie → Kompletacja → Wysyłka → Faktura → Płatność → Zamknięcie',
    icon: Workflow,
    tool: 'process_flow',
    nodes: [
      {
        id: 'pf-o2c-s',
        type: 'flowNode',
        position: { x: 50, y: 60 },
        data: {
          label: 'Order Received',
          shape: 'start',
          laneId: 'lane-sales',
          laneColor: '#dbeafe',
        },
      },
      {
        id: 'pf-o2c-cc',
        type: 'flowNode',
        position: { x: 250, y: 200 },
        data: {
          label: 'Credit Check',
          shape: 'decision',
          laneId: 'lane-finance',
          laneColor: '#d1fae5',
        },
      },
      {
        id: 'pf-o2c-oc',
        type: 'flowNode',
        position: { x: 450, y: 60 },
        data: {
          label: 'Order Confirmation',
          shape: 'action',
          laneId: 'lane-sales',
          laneColor: '#dbeafe',
        },
      },
      {
        id: 'pf-o2c-pp',
        type: 'flowNode',
        position: { x: 650, y: 340 },
        data: {
          label: 'Pick & Pack',
          shape: 'action',
          laneId: 'lane-warehouse',
          laneColor: '#fef3c7',
        },
      },
      {
        id: 'pf-o2c-sh',
        type: 'flowNode',
        position: { x: 850, y: 340 },
        data: { label: 'Ship', shape: 'action', laneId: 'lane-warehouse', laneColor: '#fef3c7' },
      },
      {
        id: 'pf-o2c-inv',
        type: 'flowNode',
        position: { x: 1050, y: 200 },
        data: { label: 'Invoice', shape: 'action', laneId: 'lane-finance', laneColor: '#d1fae5' },
      },
      {
        id: 'pf-o2c-pay',
        type: 'flowNode',
        position: { x: 1250, y: 200 },
        data: { label: 'Payment', shape: 'action', laneId: 'lane-finance', laneColor: '#d1fae5' },
      },
      {
        id: 'pf-o2c-e',
        type: 'flowNode',
        position: { x: 1450, y: 60 },
        data: { label: 'Close', shape: 'end', laneId: 'lane-sales', laneColor: '#dbeafe' },
      },
    ],
    edges: [
      { id: 'e-o2c-1', source: 'pf-o2c-s', target: 'pf-o2c-cc', type: 'flowEdge' },
      {
        id: 'e-o2c-2',
        source: 'pf-o2c-cc',
        target: 'pf-o2c-oc',
        type: 'flowEdge',
        label: 'Approved',
        data: { conditionType: 'yes' },
      },
      { id: 'e-o2c-3', source: 'pf-o2c-oc', target: 'pf-o2c-pp', type: 'flowEdge' },
      { id: 'e-o2c-4', source: 'pf-o2c-pp', target: 'pf-o2c-sh', type: 'flowEdge' },
      { id: 'e-o2c-5', source: 'pf-o2c-sh', target: 'pf-o2c-inv', type: 'flowEdge' },
      { id: 'e-o2c-6', source: 'pf-o2c-inv', target: 'pf-o2c-pay', type: 'flowEdge' },
      { id: 'e-o2c-7', source: 'pf-o2c-pay', target: 'pf-o2c-e', type: 'flowEdge' },
    ],
    extensions: {
      processFlow: {
        lanes: [
          { id: 'lane-sales', label: 'Sales', color: '#dbeafe' },
          { id: 'lane-finance', label: 'Finance', color: '#d1fae5' },
          { id: 'lane-warehouse', label: 'Warehouse', color: '#fef3c7' },
        ],
      },
    },
  },
  {
    id: 'pf-p2p',
    nameEn: 'Procure-to-Pay (P2P)',
    namePl: 'Procure-to-Pay (P2P)',
    descEn: 'Requisition → Approval → PO Creation → Goods Receipt → Invoice Match → Payment',
    descPl:
      'Zapotrzebowanie → Zatwierdzenie → Zamówienie → Przyjęcie towaru → Dopasowanie faktury → Płatność',
    icon: Workflow,
    tool: 'process_flow',
    nodes: [
      {
        id: 'pf-p2p-s',
        type: 'flowNode',
        position: { x: 50, y: 60 },
        data: {
          label: 'Requisition',
          shape: 'start',
          laneId: 'lane-procurement',
          laneColor: '#dbeafe',
        },
      },
      {
        id: 'pf-p2p-ap',
        type: 'flowNode',
        position: { x: 250, y: 200 },
        data: {
          label: 'Approval',
          shape: 'decision',
          laneId: 'lane-approvals',
          laneColor: '#fef3c7',
        },
      },
      {
        id: 'pf-p2p-po',
        type: 'flowNode',
        position: { x: 450, y: 60 },
        data: {
          label: 'PO Creation',
          shape: 'action',
          laneId: 'lane-procurement',
          laneColor: '#dbeafe',
        },
      },
      {
        id: 'pf-p2p-gr',
        type: 'flowNode',
        position: { x: 650, y: 60 },
        data: {
          label: 'Goods Receipt',
          shape: 'action',
          laneId: 'lane-procurement',
          laneColor: '#dbeafe',
        },
      },
      {
        id: 'pf-p2p-im',
        type: 'flowNode',
        position: { x: 850, y: 340 },
        data: {
          label: 'Invoice Match',
          shape: 'action',
          laneId: 'lane-finance',
          laneColor: '#d1fae5',
        },
      },
      {
        id: 'pf-p2p-pay',
        type: 'flowNode',
        position: { x: 1050, y: 340 },
        data: { label: 'Payment', shape: 'end', laneId: 'lane-finance', laneColor: '#d1fae5' },
      },
    ],
    edges: [
      { id: 'e-p2p-1', source: 'pf-p2p-s', target: 'pf-p2p-ap', type: 'flowEdge' },
      {
        id: 'e-p2p-2',
        source: 'pf-p2p-ap',
        target: 'pf-p2p-po',
        type: 'flowEdge',
        label: 'Approved',
        data: { conditionType: 'yes' },
      },
      { id: 'e-p2p-3', source: 'pf-p2p-po', target: 'pf-p2p-gr', type: 'flowEdge' },
      { id: 'e-p2p-4', source: 'pf-p2p-gr', target: 'pf-p2p-im', type: 'flowEdge' },
      { id: 'e-p2p-5', source: 'pf-p2p-im', target: 'pf-p2p-pay', type: 'flowEdge' },
    ],
    extensions: {
      processFlow: {
        lanes: [
          { id: 'lane-procurement', label: 'Procurement', color: '#dbeafe' },
          { id: 'lane-approvals', label: 'Approvals', color: '#fef3c7' },
          { id: 'lane-finance', label: 'Finance', color: '#d1fae5' },
        ],
      },
    },
  },
  {
    id: 'pf-incident',
    nameEn: 'Incident Management',
    namePl: 'Zarządzanie incydentami',
    descEn: 'Report → Classify → Investigate → Resolve → Close → Review',
    descPl: 'Zgłoszenie → Klasyfikacja → Badanie → Rozwiązanie → Zamknięcie → Przegląd',
    icon: Layers,
    tool: 'process_flow',
    nodes: [
      {
        id: 'pf-inc-s',
        type: 'flowNode',
        position: { x: 50, y: 60 },
        data: { label: 'Report', shape: 'start', laneId: 'lane-servicedesk', laneColor: '#dbeafe' },
      },
      {
        id: 'pf-inc-cl',
        type: 'flowNode',
        position: { x: 250, y: 60 },
        data: {
          label: 'Classify',
          shape: 'action',
          laneId: 'lane-servicedesk',
          laneColor: '#dbeafe',
        },
      },
      {
        id: 'pf-inc-inv',
        type: 'flowNode',
        position: { x: 450, y: 200 },
        data: { label: 'Investigate', shape: 'action', laneId: 'lane-l2', laneColor: '#d1fae5' },
      },
      {
        id: 'pf-inc-res',
        type: 'flowNode',
        position: { x: 650, y: 200 },
        data: { label: 'Resolve', shape: 'action', laneId: 'lane-l2', laneColor: '#d1fae5' },
      },
      {
        id: 'pf-inc-close',
        type: 'flowNode',
        position: { x: 850, y: 60 },
        data: { label: 'Close', shape: 'action', laneId: 'lane-servicedesk', laneColor: '#dbeafe' },
      },
      {
        id: 'pf-inc-rev',
        type: 'flowNode',
        position: { x: 1050, y: 340 },
        data: { label: 'Review', shape: 'end', laneId: 'lane-mgmt', laneColor: '#fef3c7' },
      },
    ],
    edges: [
      { id: 'e-inc-1', source: 'pf-inc-s', target: 'pf-inc-cl', type: 'flowEdge' },
      { id: 'e-inc-2', source: 'pf-inc-cl', target: 'pf-inc-inv', type: 'flowEdge' },
      { id: 'e-inc-3', source: 'pf-inc-inv', target: 'pf-inc-res', type: 'flowEdge' },
      { id: 'e-inc-4', source: 'pf-inc-res', target: 'pf-inc-close', type: 'flowEdge' },
      { id: 'e-inc-5', source: 'pf-inc-close', target: 'pf-inc-rev', type: 'flowEdge' },
    ],
    extensions: {
      processFlow: {
        lanes: [
          { id: 'lane-servicedesk', label: 'Service Desk', color: '#dbeafe' },
          { id: 'lane-l2', label: 'L2 Support', color: '#d1fae5' },
          { id: 'lane-mgmt', label: 'Management', color: '#fef3c7' },
        ],
      },
    },
  },
];

const TYPED_PROCESS_FLOW_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'pf-bpmn-approval',
    nameEn: 'BPMN Approval',
    namePl: 'BPMN Approval',
    descEn: 'Typed BPMN starter with event, tasks, and gateway.',
    descPl: 'Typowany starter BPMN z eventem, zadaniami i bramką.',
    icon: Workflow,
    tool: 'process_flow',
    nodes: [
      {
        id: 'bpmn-start',
        type: 'flowNode',
        position: { x: 60, y: 80 },
        data: { label: 'Start event', shape: 'bpmn_event', semanticType: 'process' },
      },
      {
        id: 'bpmn-task-1',
        type: 'flowNode',
        position: { x: 240, y: 80 },
        data: { label: 'Submit request', shape: 'bpmn_task', semanticType: 'process' },
      },
      {
        id: 'bpmn-gateway',
        type: 'flowNode',
        position: { x: 460, y: 80 },
        data: { label: 'Approved?', shape: 'bpmn_gateway', semanticType: 'decision' },
      },
      {
        id: 'bpmn-task-2',
        type: 'flowNode',
        position: { x: 680, y: 20 },
        data: { label: 'Notify approver', shape: 'bpmn_task', semanticType: 'process' },
      },
      {
        id: 'bpmn-end',
        type: 'flowNode',
        position: { x: 900, y: 80 },
        data: { label: 'End event', shape: 'bpmn_event', semanticType: 'process' },
      },
    ],
    edges: [
      { id: 'e-bpmn-1', source: 'bpmn-start', target: 'bpmn-task-1', type: 'flowEdge' },
      { id: 'e-bpmn-2', source: 'bpmn-task-1', target: 'bpmn-gateway', type: 'flowEdge' },
      {
        id: 'e-bpmn-3',
        source: 'bpmn-gateway',
        target: 'bpmn-task-2',
        type: 'flowEdge',
        label: 'Yes',
      },
      { id: 'e-bpmn-4', source: 'bpmn-gateway', target: 'bpmn-end', type: 'flowEdge', label: 'No' },
      { id: 'e-bpmn-5', source: 'bpmn-task-2', target: 'bpmn-end', type: 'flowEdge' },
    ],
    extensions: {
      processFlow: {
        semanticKit: 'bpmn',
        lanes: [{ id: 'lane-1', label: 'BPMN Lane', color: '#dbeafe' }],
      },
    },
    governance: {
      category: 'process',
      library: 'core',
      version: '1.0.0',
      scope: 'global',
      capability: 'real',
    },
  },
  {
    id: 'pf-system-architecture',
    nameEn: 'System Mapping',
    namePl: 'Mapa systemów',
    descEn: 'Typed service, actor, and datastore starter.',
    descPl: 'Typowany starter z serwisem, aktorem i magazynem danych.',
    icon: Network,
    tool: 'process_flow',
    nodes: [
      {
        id: 'sys-actor',
        type: 'flowNode',
        position: { x: 60, y: 80 },
        data: { label: 'Business user', shape: 'system_actor', semanticType: 'role' },
      },
      {
        id: 'sys-service',
        type: 'flowNode',
        position: { x: 280, y: 80 },
        data: { label: 'Core service', shape: 'system_service', semanticType: 'system' },
      },
      {
        id: 'sys-db',
        type: 'flowNode',
        position: { x: 520, y: 80 },
        data: { label: 'ERP data store', shape: 'system_db', semanticType: 'system' },
      },
      {
        id: 'sys-gateway',
        type: 'flowNode',
        position: { x: 760, y: 80 },
        data: { label: 'API gateway', shape: 'decision', semanticType: 'system' },
      },
    ],
    edges: [
      { id: 'e-sys-1', source: 'sys-actor', target: 'sys-service', type: 'flowEdge' },
      { id: 'e-sys-2', source: 'sys-service', target: 'sys-db', type: 'flowEdge' },
      { id: 'e-sys-3', source: 'sys-db', target: 'sys-gateway', type: 'flowEdge' },
    ],
    extensions: {
      processFlow: {
        semanticKit: 'system',
        lanes: [{ id: 'lane-1', label: 'System Boundary', color: '#cffafe' }],
      },
    },
    governance: {
      category: 'system',
      library: 'core',
      version: '1.0.0',
      scope: 'global',
      capability: 'real',
    },
  },
  {
    id: 'pf-org-handoffs',
    nameEn: 'Org Handoffs',
    namePl: 'Przekazania organizacyjne',
    descEn: 'Typed org starter for roles, teams, and handoffs.',
    descPl: 'Typowany starter organizacyjny dla ról, zespołów i przekazań.',
    icon: Layers,
    tool: 'process_flow',
    nodes: [
      {
        id: 'org-role',
        type: 'flowNode',
        position: { x: 60, y: 80 },
        data: { label: 'Request owner', shape: 'org_role', semanticType: 'role' },
      },
      {
        id: 'org-team',
        type: 'flowNode',
        position: { x: 280, y: 80 },
        data: { label: 'Operations team', shape: 'org_team', semanticType: 'role' },
      },
      {
        id: 'org-handoff',
        type: 'flowNode',
        position: { x: 520, y: 80 },
        data: { label: 'Approval handoff', shape: 'org_handoff', semanticType: 'process' },
      },
      {
        id: 'org-role-2',
        type: 'flowNode',
        position: { x: 760, y: 80 },
        data: { label: 'Finance reviewer', shape: 'org_role', semanticType: 'role' },
      },
    ],
    edges: [
      { id: 'e-org-1', source: 'org-role', target: 'org-team', type: 'flowEdge' },
      { id: 'e-org-2', source: 'org-team', target: 'org-handoff', type: 'flowEdge' },
      {
        id: 'e-org-3',
        source: 'org-handoff',
        target: 'org-role-2',
        type: 'flowEdge',
        label: 'Escalate',
      },
      {
        id: 'e-org-4',
        source: 'org-handoff',
        target: 'org-role',
        type: 'flowEdge',
        label: 'Feedback',
      },
    ],
    extensions: {
      processFlow: {
        semanticKit: 'org',
        lanes: [{ id: 'lane-1', label: 'Org Flow', color: '#f3e8ff' }],
      },
    },
    governance: {
      category: 'org',
      library: 'core',
      version: '1.0.0',
      scope: 'global',
      capability: 'real',
    },
  },
];

// ── Mind Map templates ───────────────────────────────────────────────────────

const MINDMAP_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'mm-blank',
    nameEn: 'Blank Mind Map',
    namePl: 'Pusta mapa myśli',
    descEn: 'Start with a central idea node',
    descPl: 'Zacznij od centralnego węzła',
    icon: FileText,
    tool: 'mindmap',
    nodes: [
      {
        id: 'root',
        type: 'root',
        position: { x: 400, y: 300 },
        data: { label: 'Central Idea', branchKey: 'root' },
      },
    ],
    edges: [],
    extensions: {},
  },
  {
    id: 'mm-swot',
    nameEn: 'SWOT Analysis',
    namePl: 'Analiza SWOT',
    descEn: 'Strengths, Weaknesses, Opportunities, Threats',
    descPl: 'Mocne strony, Słabe strony, Szanse, Zagrożenia',
    icon: LayoutGrid,
    tool: 'mindmap',
    nodes: [
      {
        id: 'root',
        type: 'root',
        position: { x: 400, y: 300 },
        data: { label: 'SWOT', branchKey: 'root' },
      },
      {
        id: 'b-s',
        type: 'branch',
        position: { x: 200, y: 150 },
        data: { label: 'Strengths', branchKey: 'strengths' },
      },
      {
        id: 'b-w',
        type: 'branch',
        position: { x: 600, y: 150 },
        data: { label: 'Weaknesses', branchKey: 'weaknesses' },
      },
      {
        id: 'b-o',
        type: 'branch',
        position: { x: 200, y: 450 },
        data: { label: 'Opportunities', branchKey: 'opportunities' },
      },
      {
        id: 'b-t',
        type: 'branch',
        position: { x: 600, y: 450 },
        data: { label: 'Threats', branchKey: 'threats' },
      },
    ],
    edges: [
      { id: 'e-s', source: 'root', target: 'b-s' },
      { id: 'e-w', source: 'root', target: 'b-w' },
      { id: 'e-o', source: 'root', target: 'b-o' },
      { id: 'e-t', source: 'root', target: 'b-t' },
    ],
    extensions: {},
  },
  {
    id: 'mm-5whys',
    nameEn: '5 Whys',
    namePl: '5 Dlaczego',
    descEn: 'Root cause analysis — drill down with "Why?"',
    descPl: 'Analiza przyczyn źródłowych — pogłębiaj pytaniem "Dlaczego?"',
    icon: GitBranch,
    tool: 'mindmap',
    nodes: [
      {
        id: 'root',
        type: 'root',
        position: { x: 100, y: 300 },
        data: { label: 'Problem', branchKey: 'root' },
      },
      {
        id: 'w1',
        type: 'branch',
        position: { x: 300, y: 300 },
        data: { label: 'Why? (1)', branchKey: 'why1' },
      },
      {
        id: 'w2',
        type: 'branch',
        position: { x: 500, y: 300 },
        data: { label: 'Why? (2)', branchKey: 'why2' },
      },
      {
        id: 'w3',
        type: 'branch',
        position: { x: 700, y: 300 },
        data: { label: 'Why? (3)', branchKey: 'why3' },
      },
      {
        id: 'w4',
        type: 'branch',
        position: { x: 900, y: 300 },
        data: { label: 'Why? (4)', branchKey: 'why4' },
      },
      {
        id: 'w5',
        type: 'branch',
        position: { x: 1100, y: 300 },
        data: { label: 'Root Cause', branchKey: 'root_cause' },
      },
    ],
    edges: [
      { id: 'e-w1', source: 'root', target: 'w1' },
      { id: 'e-w2', source: 'w1', target: 'w2' },
      { id: 'e-w3', source: 'w2', target: 'w3' },
      { id: 'e-w4', source: 'w3', target: 'w4' },
      { id: 'e-w5', source: 'w4', target: 'w5' },
    ],
    extensions: {},
  },
  {
    id: 'mm-fishbone',
    nameEn: 'Fishbone / Ishikawa',
    namePl: 'Diagram Ishikawy',
    descEn: 'Cause-and-effect diagram with 6M categories',
    descPl: 'Diagram przyczynowo-skutkowy z kategoriami 6M',
    icon: Network,
    tool: 'mindmap',
    nodes: [
      {
        id: 'root',
        type: 'root',
        position: { x: 800, y: 300 },
        data: { label: 'Effect / Problem', branchKey: 'root' },
      },
      {
        id: 'b-man',
        type: 'branch',
        position: { x: 200, y: 100 },
        data: { label: 'Man', branchKey: 'man' },
      },
      {
        id: 'b-machine',
        type: 'branch',
        position: { x: 400, y: 100 },
        data: { label: 'Machine', branchKey: 'machine' },
      },
      {
        id: 'b-material',
        type: 'branch',
        position: { x: 600, y: 100 },
        data: { label: 'Material', branchKey: 'material' },
      },
      {
        id: 'b-method',
        type: 'branch',
        position: { x: 200, y: 500 },
        data: { label: 'Method', branchKey: 'method' },
      },
      {
        id: 'b-measurement',
        type: 'branch',
        position: { x: 400, y: 500 },
        data: { label: 'Measurement', branchKey: 'measurement' },
      },
      {
        id: 'b-environment',
        type: 'branch',
        position: { x: 600, y: 500 },
        data: { label: 'Environment', branchKey: 'environment' },
      },
    ],
    edges: [
      { id: 'e-man', source: 'b-man', target: 'root' },
      { id: 'e-machine', source: 'b-machine', target: 'root' },
      { id: 'e-material', source: 'b-material', target: 'root' },
      { id: 'e-method', source: 'b-method', target: 'root' },
      { id: 'e-measurement', source: 'b-measurement', target: 'root' },
      { id: 'e-environment', source: 'b-environment', target: 'root' },
    ],
    extensions: {},
  },
  {
    id: 'mm-stakeholder',
    nameEn: 'Stakeholder Map',
    namePl: 'Mapa interesariuszy',
    descEn: 'Map stakeholders by influence and interest',
    descPl: 'Zmapuj interesariuszy wg wpływu i zainteresowania',
    icon: Network,
    tool: 'mindmap',
    nodes: [
      {
        id: 'root',
        type: 'root',
        position: { x: 400, y: 300 },
        data: { label: 'Project', branchKey: 'root' },
      },
      {
        id: 'b-high',
        type: 'branch',
        position: { x: 200, y: 150 },
        data: { label: 'High Influence', branchKey: 'high_influence' },
      },
      {
        id: 'b-med',
        type: 'branch',
        position: { x: 600, y: 150 },
        data: { label: 'Medium Influence', branchKey: 'medium_influence' },
      },
      {
        id: 'b-low',
        type: 'branch',
        position: { x: 400, y: 500 },
        data: { label: 'Low Influence', branchKey: 'low_influence' },
      },
    ],
    edges: [
      { id: 'e-high', source: 'root', target: 'b-high' },
      { id: 'e-med', source: 'root', target: 'b-med' },
      { id: 'e-low', source: 'root', target: 'b-low' },
    ],
    extensions: {},
  },
  {
    id: 'mm-porter5',
    nameEn: "Porter's 5 Forces",
    namePl: '5 Sił Portera',
    descEn: 'Rivalry, New Entrants, Substitutes, Buyer Power, Supplier Power',
    descPl: 'Rywalizacja, Nowi gracze, Substytuty, Siła nabywców, Siła dostawców',
    icon: Network,
    tool: 'mindmap',
    nodes: [
      {
        id: 'root',
        type: 'root',
        position: { x: 400, y: 300 },
        data: { label: "Porter's 5 Forces", branchKey: 'root' },
      },
      {
        id: 'b-rivalry',
        type: 'branch',
        position: { x: 400, y: 80 },
        data: { label: 'Competitive Rivalry', branchKey: 'rivalry' },
      },
      {
        id: 'b-entrants',
        type: 'branch',
        position: { x: 700, y: 200 },
        data: { label: 'New Entrants', branchKey: 'new_entrants' },
      },
      {
        id: 'b-substitutes',
        type: 'branch',
        position: { x: 650, y: 450 },
        data: { label: 'Substitutes', branchKey: 'substitutes' },
      },
      {
        id: 'b-buyers',
        type: 'branch',
        position: { x: 150, y: 450 },
        data: { label: 'Buyer Power', branchKey: 'buyer_power' },
      },
      {
        id: 'b-suppliers',
        type: 'branch',
        position: { x: 100, y: 200 },
        data: { label: 'Supplier Power', branchKey: 'supplier_power' },
      },
    ],
    edges: [
      { id: 'e-rivalry', source: 'root', target: 'b-rivalry' },
      { id: 'e-entrants', source: 'root', target: 'b-entrants' },
      { id: 'e-substitutes', source: 'root', target: 'b-substitutes' },
      { id: 'e-buyers', source: 'root', target: 'b-buyers' },
      { id: 'e-suppliers', source: 'root', target: 'b-suppliers' },
    ],
    extensions: {},
  },
  {
    id: 'mm-value-chain',
    nameEn: 'Value Chain',
    namePl: 'Łańcuch Wartości',
    descEn: 'Inbound, Operations, Outbound, Marketing, Service, Support',
    descPl: 'Logistyka, Operacje, Dystrybucja, Marketing, Serwis, Wsparcie',
    icon: Workflow,
    tool: 'mindmap',
    nodes: [
      {
        id: 'root',
        type: 'root',
        position: { x: 400, y: 300 },
        data: { label: 'Value Chain', branchKey: 'root' },
      },
      {
        id: 'b-inbound',
        type: 'branch',
        position: { x: 100, y: 150 },
        data: { label: 'Inbound Logistics', branchKey: 'inbound' },
      },
      {
        id: 'b-ops',
        type: 'branch',
        position: { x: 300, y: 100 },
        data: { label: 'Operations', branchKey: 'operations' },
      },
      {
        id: 'b-outbound',
        type: 'branch',
        position: { x: 500, y: 100 },
        data: { label: 'Outbound Logistics', branchKey: 'outbound' },
      },
      {
        id: 'b-marketing',
        type: 'branch',
        position: { x: 700, y: 150 },
        data: { label: 'Marketing & Sales', branchKey: 'marketing' },
      },
      {
        id: 'b-service',
        type: 'branch',
        position: { x: 600, y: 450 },
        data: { label: 'Service', branchKey: 'service' },
      },
      {
        id: 'b-support',
        type: 'branch',
        position: { x: 200, y: 450 },
        data: { label: 'Support Activities', branchKey: 'support' },
      },
    ],
    edges: [
      { id: 'e-inbound', source: 'root', target: 'b-inbound' },
      { id: 'e-ops', source: 'root', target: 'b-ops' },
      { id: 'e-outbound', source: 'root', target: 'b-outbound' },
      { id: 'e-marketing', source: 'root', target: 'b-marketing' },
      { id: 'e-service', source: 'root', target: 'b-service' },
      { id: 'e-support', source: 'root', target: 'b-support' },
    ],
    extensions: {},
  },
  {
    id: 'mm-mckinsey7s',
    nameEn: 'McKinsey 7S',
    namePl: 'McKinsey 7S',
    descEn: 'Strategy, Structure, Systems, Shared Values, Skills, Style, Staff',
    descPl: 'Strategia, Struktura, Systemy, Wartości, Umiejętności, Styl, Kadry',
    icon: LayoutGrid,
    tool: 'mindmap',
    nodes: [
      {
        id: 'root',
        type: 'root',
        position: { x: 400, y: 300 },
        data: { label: 'McKinsey 7S', branchKey: 'root' },
      },
      {
        id: 'b-strategy',
        type: 'branch',
        position: { x: 400, y: 60 },
        data: { label: 'Strategy', branchKey: 'strategy' },
      },
      {
        id: 'b-structure',
        type: 'branch',
        position: { x: 680, y: 140 },
        data: { label: 'Structure', branchKey: 'structure' },
      },
      {
        id: 'b-systems',
        type: 'branch',
        position: { x: 720, y: 350 },
        data: { label: 'Systems', branchKey: 'systems' },
      },
      {
        id: 'b-values',
        type: 'branch',
        position: { x: 550, y: 520 },
        data: { label: 'Shared Values', branchKey: 'shared_values' },
      },
      {
        id: 'b-skills',
        type: 'branch',
        position: { x: 250, y: 520 },
        data: { label: 'Skills', branchKey: 'skills' },
      },
      {
        id: 'b-style',
        type: 'branch',
        position: { x: 80, y: 350 },
        data: { label: 'Style', branchKey: 'style' },
      },
      {
        id: 'b-staff',
        type: 'branch',
        position: { x: 120, y: 140 },
        data: { label: 'Staff', branchKey: 'staff' },
      },
    ],
    edges: [
      { id: 'e-strategy', source: 'root', target: 'b-strategy' },
      { id: 'e-structure', source: 'root', target: 'b-structure' },
      { id: 'e-systems', source: 'root', target: 'b-systems' },
      { id: 'e-values', source: 'root', target: 'b-values' },
      { id: 'e-skills', source: 'root', target: 'b-skills' },
      { id: 'e-style', source: 'root', target: 'b-style' },
      { id: 'e-staff', source: 'root', target: 'b-staff' },
    ],
    extensions: {},
  },
];

// ── Whiteboard templates ──────────────────────────────────────────────────────

const WHITEBOARD_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'wb-blank',
    nameEn: 'Blank Whiteboard',
    namePl: 'Pusta tablica',
    descEn: 'Start from scratch',
    descPl: 'Zacznij od zera',
    icon: FileText,
    tool: 'whiteboard',
    nodes: [],
    edges: [],
    extensions: {},
  },
  {
    id: 'wb-bmc',
    nameEn: 'Business Model Canvas',
    namePl: 'Business Model Canvas',
    descEn: '9 building blocks of a business model',
    descPl: '9 bloków modelu biznesowego',
    icon: LayoutGrid,
    tool: 'whiteboard',
    nodes: [
      {
        id: 'f-kp',
        type: 'frameNode',
        position: { x: 0, y: 0 },
        data: { label: 'Key Partners', width: 200, height: 300 },
      },
      {
        id: 'f-ka',
        type: 'frameNode',
        position: { x: 220, y: 0 },
        data: { label: 'Key Activities', width: 200, height: 150 },
      },
      {
        id: 'f-kr',
        type: 'frameNode',
        position: { x: 220, y: 160 },
        data: { label: 'Key Resources', width: 200, height: 140 },
      },
      {
        id: 'f-vp',
        type: 'frameNode',
        position: { x: 440, y: 0 },
        data: { label: 'Value Propositions', width: 200, height: 300 },
      },
      {
        id: 'f-cr',
        type: 'frameNode',
        position: { x: 660, y: 0 },
        data: { label: 'Customer Relationships', width: 200, height: 150 },
      },
      {
        id: 'f-ch',
        type: 'frameNode',
        position: { x: 660, y: 160 },
        data: { label: 'Channels', width: 200, height: 140 },
      },
      {
        id: 'f-cs',
        type: 'frameNode',
        position: { x: 880, y: 0 },
        data: { label: 'Customer Segments', width: 200, height: 300 },
      },
      {
        id: 'f-cost',
        type: 'frameNode',
        position: { x: 0, y: 320 },
        data: { label: 'Cost Structure', width: 540, height: 150 },
      },
      {
        id: 'f-rev',
        type: 'frameNode',
        position: { x: 560, y: 320 },
        data: { label: 'Revenue Streams', width: 520, height: 150 },
      },
    ],
    edges: [],
    extensions: {},
  },
  {
    id: 'wb-impact-effort',
    nameEn: 'Impact / Effort Matrix',
    namePl: 'Macierz Wpływ / Wysiłek',
    descEn: '4 quadrants: Quick Wins, Big Bets, Fill-ins, Money Pit',
    descPl: '4 kwadranty: Szybkie wygrane, Duże zakłady, Uzupełnienia, Pułapki',
    icon: LayoutGrid,
    tool: 'whiteboard',
    nodes: [
      {
        id: 'f-qw',
        type: 'frameNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'Quick Wins (High Impact, Low Effort)',
          width: 350,
          height: 250,
          bgColor: 'rgba(209,250,229,0.4)',
        },
      },
      {
        id: 'f-bb',
        type: 'frameNode',
        position: { x: 370, y: 0 },
        data: {
          label: 'Big Bets (High Impact, High Effort)',
          width: 350,
          height: 250,
          bgColor: 'rgba(219,234,254,0.4)',
        },
      },
      {
        id: 'f-fi',
        type: 'frameNode',
        position: { x: 0, y: 270 },
        data: {
          label: 'Fill-ins (Low Impact, Low Effort)',
          width: 350,
          height: 250,
          bgColor: 'rgba(254,243,199,0.4)',
        },
      },
      {
        id: 'f-mp',
        type: 'frameNode',
        position: { x: 370, y: 270 },
        data: {
          label: 'Money Pit (Low Impact, High Effort)',
          width: 350,
          height: 250,
          bgColor: 'rgba(252,231,243,0.4)',
        },
      },
    ],
    edges: [],
    extensions: {},
  },
  {
    id: 'wb-retro',
    nameEn: 'Retrospective',
    namePl: 'Retrospektywa',
    descEn: 'What went well, What to improve, Action items',
    descPl: 'Co poszło dobrze, Co poprawić, Działania',
    icon: Layers,
    tool: 'whiteboard',
    nodes: [
      {
        id: 'f-good',
        type: 'frameNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'What went well',
          width: 280,
          height: 350,
          bgColor: 'rgba(209,250,229,0.4)',
        },
      },
      {
        id: 'f-improve',
        type: 'frameNode',
        position: { x: 300, y: 0 },
        data: {
          label: 'What to improve',
          width: 280,
          height: 350,
          bgColor: 'rgba(254,243,199,0.4)',
        },
      },
      {
        id: 'f-actions',
        type: 'frameNode',
        position: { x: 600, y: 0 },
        data: { label: 'Action items', width: 280, height: 350, bgColor: 'rgba(219,234,254,0.4)' },
      },
    ],
    edges: [],
    extensions: {},
  },
  {
    id: 'wb-lean-canvas',
    nameEn: 'Lean Canvas',
    namePl: 'Lean Canvas',
    descEn: 'Problem, Solution, Key Metrics, Unfair Advantage and more',
    descPl: 'Problem, Rozwiązanie, Kluczowe metryki, Przewaga i więcej',
    icon: LayoutGrid,
    tool: 'whiteboard',
    nodes: [
      {
        id: 'f-lc-problem',
        type: 'frameNode',
        position: { x: 0, y: 0 },
        data: { label: 'Problem', width: 200, height: 300 },
      },
      {
        id: 'f-lc-solution',
        type: 'frameNode',
        position: { x: 220, y: 0 },
        data: { label: 'Solution', width: 200, height: 150 },
      },
      {
        id: 'f-lc-metrics',
        type: 'frameNode',
        position: { x: 220, y: 160 },
        data: { label: 'Key Metrics', width: 200, height: 140 },
      },
      {
        id: 'f-lc-uvp',
        type: 'frameNode',
        position: { x: 440, y: 0 },
        data: { label: 'Unique Value Proposition', width: 200, height: 300 },
      },
      {
        id: 'f-lc-advantage',
        type: 'frameNode',
        position: { x: 660, y: 0 },
        data: { label: 'Unfair Advantage', width: 200, height: 150 },
      },
      {
        id: 'f-lc-channels',
        type: 'frameNode',
        position: { x: 660, y: 160 },
        data: { label: 'Channels', width: 200, height: 140 },
      },
      {
        id: 'f-lc-segments',
        type: 'frameNode',
        position: { x: 880, y: 0 },
        data: { label: 'Customer Segments', width: 200, height: 300 },
      },
      {
        id: 'f-lc-cost',
        type: 'frameNode',
        position: { x: 0, y: 320 },
        data: { label: 'Cost Structure', width: 540, height: 150 },
      },
      {
        id: 'f-lc-revenue',
        type: 'frameNode',
        position: { x: 560, y: 320 },
        data: { label: 'Revenue Streams', width: 520, height: 150 },
      },
    ],
    edges: [],
    extensions: {},
  },
  {
    id: 'wb-cjm',
    nameEn: 'Customer Journey Map',
    namePl: 'Mapa podróży klienta',
    descEn: 'Awareness → Consideration → Purchase → Retention → Advocacy',
    descPl: 'Świadomość → Rozważanie → Zakup → Utrzymanie → Rzecznictwo',
    icon: Workflow,
    tool: 'whiteboard',
    nodes: [
      {
        id: 'f-cjm-h-aware',
        type: 'frameNode',
        position: { x: 0, y: 0 },
        data: { label: 'Awareness', width: 220, height: 60, bgColor: 'rgba(219,234,254,0.5)' },
      },
      {
        id: 'f-cjm-h-consider',
        type: 'frameNode',
        position: { x: 240, y: 0 },
        data: { label: 'Consideration', width: 220, height: 60, bgColor: 'rgba(209,250,229,0.5)' },
      },
      {
        id: 'f-cjm-h-purchase',
        type: 'frameNode',
        position: { x: 480, y: 0 },
        data: { label: 'Purchase', width: 220, height: 60, bgColor: 'rgba(254,243,199,0.5)' },
      },
      {
        id: 'f-cjm-h-retain',
        type: 'frameNode',
        position: { x: 720, y: 0 },
        data: { label: 'Retention', width: 220, height: 60, bgColor: 'rgba(252,231,243,0.5)' },
      },
      {
        id: 'f-cjm-h-advocate',
        type: 'frameNode',
        position: { x: 960, y: 0 },
        data: { label: 'Advocacy', width: 220, height: 60, bgColor: 'rgba(237,233,254,0.5)' },
      },
      {
        id: 'f-cjm-tp1',
        type: 'frameNode',
        position: { x: 0, y: 80 },
        data: { label: 'Touchpoints', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-tp2',
        type: 'frameNode',
        position: { x: 240, y: 80 },
        data: { label: 'Touchpoints', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-tp3',
        type: 'frameNode',
        position: { x: 480, y: 80 },
        data: { label: 'Touchpoints', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-tp4',
        type: 'frameNode',
        position: { x: 720, y: 80 },
        data: { label: 'Touchpoints', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-tp5',
        type: 'frameNode',
        position: { x: 960, y: 80 },
        data: { label: 'Touchpoints', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-em1',
        type: 'frameNode',
        position: { x: 0, y: 200 },
        data: { label: 'Emotions', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-em2',
        type: 'frameNode',
        position: { x: 240, y: 200 },
        data: { label: 'Emotions', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-em3',
        type: 'frameNode',
        position: { x: 480, y: 200 },
        data: { label: 'Emotions', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-em4',
        type: 'frameNode',
        position: { x: 720, y: 200 },
        data: { label: 'Emotions', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-em5',
        type: 'frameNode',
        position: { x: 960, y: 200 },
        data: { label: 'Emotions', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-pp1',
        type: 'frameNode',
        position: { x: 0, y: 320 },
        data: { label: 'Pain Points', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-pp2',
        type: 'frameNode',
        position: { x: 240, y: 320 },
        data: { label: 'Pain Points', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-pp3',
        type: 'frameNode',
        position: { x: 480, y: 320 },
        data: { label: 'Pain Points', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-pp4',
        type: 'frameNode',
        position: { x: 720, y: 320 },
        data: { label: 'Pain Points', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-pp5',
        type: 'frameNode',
        position: { x: 960, y: 320 },
        data: { label: 'Pain Points', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-op1',
        type: 'frameNode',
        position: { x: 0, y: 440 },
        data: { label: 'Opportunities', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-op2',
        type: 'frameNode',
        position: { x: 240, y: 440 },
        data: { label: 'Opportunities', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-op3',
        type: 'frameNode',
        position: { x: 480, y: 440 },
        data: { label: 'Opportunities', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-op4',
        type: 'frameNode',
        position: { x: 720, y: 440 },
        data: { label: 'Opportunities', width: 220, height: 100 },
      },
      {
        id: 'f-cjm-op5',
        type: 'frameNode',
        position: { x: 960, y: 440 },
        data: { label: 'Opportunities', width: 220, height: 100 },
      },
    ],
    edges: [],
    extensions: {},
  },
];

// ── Additional Mind Map templates ─────────────────────────────────────────────

const EXTRA_MINDMAP_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'mm-okr',
    nameEn: 'OKR Cascade',
    namePl: 'Kaskada OKR',
    descEn: 'Objectives → Key Results → Initiatives',
    descPl: 'Cele → Kluczowe wyniki → Inicjatywy',
    icon: GitBranch,
    tool: 'mindmap',
    nodes: [
      {
        id: 'root',
        type: 'root',
        position: { x: 400, y: 50 },
        data: { label: 'Company Vision', branchKey: 'root' },
      },
      {
        id: 'o1',
        type: 'branch',
        position: { x: 200, y: 180 },
        data: { label: 'Objective 1', branchKey: 'obj1' },
      },
      {
        id: 'o2',
        type: 'branch',
        position: { x: 600, y: 180 },
        data: { label: 'Objective 2', branchKey: 'obj2' },
      },
      {
        id: 'kr1',
        type: 'leaf',
        position: { x: 80, y: 320 },
        data: { label: 'KR 1.1', branchKey: 'obj1' },
      },
      {
        id: 'kr2',
        type: 'leaf',
        position: { x: 320, y: 320 },
        data: { label: 'KR 1.2', branchKey: 'obj1' },
      },
      {
        id: 'kr3',
        type: 'leaf',
        position: { x: 480, y: 320 },
        data: { label: 'KR 2.1', branchKey: 'obj2' },
      },
      {
        id: 'kr4',
        type: 'leaf',
        position: { x: 720, y: 320 },
        data: { label: 'KR 2.2', branchKey: 'obj2' },
      },
      {
        id: 'i1',
        type: 'leaf',
        position: { x: 80, y: 450 },
        data: { label: 'Initiative A', branchKey: 'obj1' },
      },
      {
        id: 'i2',
        type: 'leaf',
        position: { x: 480, y: 450 },
        data: { label: 'Initiative B', branchKey: 'obj2' },
      },
    ],
    edges: [
      { id: 'e-o1', source: 'root', target: 'o1' },
      { id: 'e-o2', source: 'root', target: 'o2' },
      { id: 'e-kr1', source: 'o1', target: 'kr1' },
      { id: 'e-kr2', source: 'o1', target: 'kr2' },
      { id: 'e-kr3', source: 'o2', target: 'kr3' },
      { id: 'e-kr4', source: 'o2', target: 'kr4' },
      { id: 'e-i1', source: 'kr1', target: 'i1' },
      { id: 'e-i2', source: 'kr3', target: 'i2' },
    ],
    extensions: {},
  },
  {
    id: 'mm-kotter8',
    nameEn: "Kotter's 8 Steps",
    namePl: '8 Kroków Kottera',
    descEn:
      'Change management: Urgency → Coalition → Vision → Communicate → Remove Obstacles → Wins → Build → Anchor',
    descPl:
      'Zarządzanie zmianą: Pilność → Koalicja → Wizja → Komunikacja → Usuwanie barier → Wygrane → Budowanie → Zakotwiczenie',
    icon: GitBranch,
    tool: 'mindmap',
    nodes: [
      {
        id: 'root',
        type: 'root',
        position: { x: 400, y: 300 },
        data: { label: "Kotter's 8 Steps", branchKey: 'root' },
      },
      {
        id: 'b-urgency',
        type: 'branch',
        position: { x: 100, y: 80 },
        data: { label: '1. Create Urgency', branchKey: 'urgency' },
      },
      {
        id: 'b-coalition',
        type: 'branch',
        position: { x: 300, y: 50 },
        data: { label: '2. Form Coalition', branchKey: 'coalition' },
      },
      {
        id: 'b-vision',
        type: 'branch',
        position: { x: 550, y: 50 },
        data: { label: '3. Create Vision', branchKey: 'vision' },
      },
      {
        id: 'b-communicate',
        type: 'branch',
        position: { x: 730, y: 120 },
        data: { label: '4. Communicate Vision', branchKey: 'communicate' },
      },
      {
        id: 'b-obstacles',
        type: 'branch',
        position: { x: 750, y: 350 },
        data: { label: '5. Remove Obstacles', branchKey: 'obstacles' },
      },
      {
        id: 'b-wins',
        type: 'branch',
        position: { x: 600, y: 520 },
        data: { label: '6. Create Short-term Wins', branchKey: 'wins' },
      },
      {
        id: 'b-build',
        type: 'branch',
        position: { x: 300, y: 540 },
        data: { label: '7. Build on Change', branchKey: 'build' },
      },
      {
        id: 'b-anchor',
        type: 'branch',
        position: { x: 80, y: 420 },
        data: { label: '8. Anchor in Culture', branchKey: 'anchor' },
      },
    ],
    edges: [
      { id: 'e-urgency', source: 'root', target: 'b-urgency' },
      { id: 'e-coalition', source: 'root', target: 'b-coalition' },
      { id: 'e-vision', source: 'root', target: 'b-vision' },
      { id: 'e-communicate', source: 'root', target: 'b-communicate' },
      { id: 'e-obstacles', source: 'root', target: 'b-obstacles' },
      { id: 'e-wins', source: 'root', target: 'b-wins' },
      { id: 'e-build', source: 'root', target: 'b-build' },
      { id: 'e-anchor', source: 'root', target: 'b-anchor' },
    ],
    extensions: {},
  },
];

// #10-AB dedup: kuratorowane szablony konsultingowe (cx-*) zastępują legacy-duble.
// Retirujemy legacy o tym samym frameworku (definicje zostają w kodzie — filtr jest odwracalny).
const RETIRED_LEGACY_TEMPLATE_IDS = new Set<string>([
  'mm-swot', // → cx-swot
  'mm-porter5', // → cx-porter5
  'wb-bmc', // → cx-bmc
  'wb-cjm', // → cx-cjm
  'mm-okr', // → cx-okr-planning
]);

const ALL_TEMPLATES = [
  ...PROCESS_FLOW_TEMPLATES,
  ...TYPED_PROCESS_FLOW_TEMPLATES,
  ...MINDMAP_TEMPLATES,
  ...EXTRA_MINDMAP_TEMPLATES,
  ...WHITEBOARD_TEMPLATES,
  // #10-AB: baza ~40 startowych szablonów konsultingowych (7 kategorii biznesowych).
  ...CONSULTING_TEMPLATES,
].filter((template) => !RETIRED_LEGACY_TEMPLATE_IDS.has(template.id));

export function findIdeaTemplate(templateId: string): TemplateDefinition | null {
  return ALL_TEMPLATES.find((template) => template.id === templateId) || null;
}

export async function applyIdeaTemplate(params: {
  ideaId: string;
  template: TemplateDefinition;
  isPl?: boolean;
  activeTool?: CanvasToolType;
  baseVersion?: number;
  ideaTitle?: string;
  seedText?: string;
}): Promise<any> {
  const { ideaId, template, activeTool = template.tool, isPl, baseVersion } = params;
  const buildPayload = (version?: number) => ({
    nodes: template.nodes,
    edges: template.edges,
    preferredTool: template.tool,
    extensions: {
      ...template.extensions,
      templateGovernance: {
        templateId: template.id,
        templateName: isPl ? template.namePl : template.nameEn,
        appliedAt: new Date().toISOString(),
        ...(template.governance || {
          category: activeTool === 'process_flow' ? 'process' : 'private',
          library: 'core',
          version: '1.0.0',
          scope: 'global',
          capability: 'real',
        }),
      },
    },
    ...(version != null ? { baseVersion: version } : {}),
    reason: 'manual' as const,
  });

  // B2 (2026-07-27): SAMO-LECZENIE 409.
  // `baseVersion` przychodzi z `graphRuntime.graph.version`, a ta wartość jest
  // aktualizowana WYŁĄCZNIE w refresh()/flushGraph() — zwykły autosave (queueSync)
  // podnosi wersję NA SERWERZE, ale nie w tym stanie. Więc po każdym autozapisie
  // galeria wysyłała przeterminowaną wersję, a serwer odrzucał zapis 409
  // (my-work.routes.ts: `baseVersion !== currentVersion` → 409). Dla użytkownika:
  // „klikam Użyj szablonu i nic się nie dzieje" (mignięcie ostrzeżenia).
  // Szablon świadomie NADPISUJE całą kanwę (użytkownik potwierdził w oknie
  // „Zastąpić istniejące elementy?"), więc kolizja wersji nie jest tu sporem
  // o cudzą treść — dociągamy aktualną wersję i ponawiamy DOKŁADNIE raz.
  let result: any;
  try {
    result = await Api.syncMyIdeaMap(ideaId, buildPayload(baseVersion ?? undefined));
  } catch (err: any) {
    if (err?.status !== 409) throw err;
    const serverVersion =
      Number(err?.data?.currentVersion || err?.currentVersion || 0) ||
      Number((await Api.getMyIdeaMap(ideaId).catch(() => null))?.map?.version || 0);
    if (!serverVersion) throw err;
    result = await Api.syncMyIdeaMap(ideaId, buildPayload(serverVersion));
  }

  if (params.ideaTitle && template.nodes.some((n) => n.type === 'branch')) {
    try {
      await Api.expandMyIdeaMap(ideaId, {
        anchorNodeId: 'root',
        count: 5,
        language: isPl ? 'pl' : 'en',
        proposeOnly: false,
        context: `Template: ${isPl ? template.namePl : template.nameEn}. Idea: "${params.ideaTitle}". ${params.seedText ? `Context: ${params.seedText}` : ''}. Generate nodes that fit the template structure.`,
      });
    } catch {
      // best-effort — template still applied even if AI expand fails
    }
  }

  return result;
}

// ── Component ────────────────────────────────────────────────────────────────

interface IdeaTemplateGalleryProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  activeTool: CanvasToolType;
  onApplied: () => void;
  baseVersion?: number;
  /** Liczba węzłów aktualnie na kanwie — gdy >0, zastosowanie szablonu wymaga potwierdzenia (L-06). */
  existingNodeCount?: number;
}

export const IdeaTemplateGallery: React.FC<IdeaTemplateGalleryProps> = ({
  open,
  onClose,
  ideaId,
  activeTool,
  onApplied,
  baseVersion,
  existingNodeCount = 0,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const { dialog: confirmDialog, confirm } = useConfirmDialog();
  const [applying, setApplying] = useState<string | null>(null);
  const [aiFilling, setAiFilling] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'all' | CanvasTemplateGovernanceMeta['scope']>(
    'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | CanvasTemplateGovernanceMeta['category']
  >('all');

  const templates = ALL_TEMPLATES.filter((t) => {
    if (t.tool !== activeTool) return false;
    const governance = t.governance;
    if (scopeFilter !== 'all' && governance?.scope !== scopeFilter) return false;
    if (categoryFilter !== 'all' && governance?.category !== categoryFilter) return false;
    return true;
  });

  const handleApply = useCallback(
    async (template: TemplateDefinition, withAIFill = false) => {
      // L-06: szablon nadpisuje cały graf (Api.syncMyIdeaMap zastępuje nodes/edges).
      // Gdy kanwa ma już elementy — wymagaj świadomego potwierdzenia, by nie utracić pracy.
      if (existingNodeCount > 0) {
        const proceed = await confirm({
          title: t('myWorkIdeas.templateGallery.replaceExistingElements'),
          description: t('myWorkIdeas.templateGallery.replaceExistingElementsDesc', {
            value: existingNodeCount,
            word: isPl
              ? existingNodeCount === 1
                ? 'element'
                : 'elementów'
              : existingNodeCount === 1
                ? 'element'
                : 'elements',
          }),
          confirmLabel: t('myWorkIdeas.templateGallery.replace'),
          cancelLabel: t('myWorkIdeas.templateGallery.cancel'),
          variant: 'warning',
        });
        if (!proceed) return;
      }

      setApplying(template.id);
      try {
        await applyIdeaTemplate({
          ideaId,
          template,
          isPl,
          activeTool,
          baseVersion,
        });

        if (withAIFill && template.nodes.length > 0) {
          setAiFilling(template.id);
          try {
            const { generateAIProposal } = await import('@/services/ideaAIGenerator');
            const batch = await generateAIProposal({
              ideaId,
              generatorType: 'mindmap_expand',
              tool: activeTool,
              context: {
                seedText: `Fill the ${isPl ? template.namePl : template.nameEn} template with company-specific data`,
                title: isPl ? template.namePl : template.nameEn,
                existingNodes: template.nodes,
                existingEdges: template.edges,
                language: i18n.language || 'en',
              },
            });
            if (batch?.proposals?.length) {
              window.dispatchEvent(
                new CustomEvent('idea-workspace-ai-proposal', { detail: { batch } })
              );
            }
          } catch {
            // AI fill is optional, template is already applied
          } finally {
            setAiFilling(null);
          }
        }

        toast.success(t('myWorkIdeas.templateGallery.templateApplied'));
        onApplied();
        onClose();
      } catch (err: any) {
        if (err?.status === 409) {
          toast(t('myWorkIdeas.templateGallery.changeConflictDetectedRefreshingMapFrom'), {
            icon: '⚠️',
          });
          onApplied();
          onClose();
        } else {
          toast.error(err?.message || t('myWorkIdeas.templateGallery.failedApplyTemplate'));
        }
      } finally {
        setApplying(null);
      }
    },
    [
      activeTool,
      baseVersion,
      confirm,
      existingNodeCount,
      i18n.language,
      ideaId,
      isPl,
      onApplied,
      onClose,
    ]
  );

  // Closure (2026-08-10) 04_ACTION_COVERAGE_INVENTORY.csv class-d:
  // `idea.template.apply` (ideaActionRegistry.ts) — routes BOTH gallery
  // buttons below (plain "Use template" and "AI Fill") through the ONE
  // registered id; `withAIFill` is the second param, not a second command
  // (see registry entry comment for the L-06 evidence this is genuinely one
  // command, not two). `ctx.source === 'ui'` + `params.run` makes the
  // registry call `handleApply` directly — byte-identical to the pre-wiring
  // click, confirm-before-overwrite dialog included.
  const runTemplateApplyAction = useCallback(
    (template: TemplateDefinition, withAIFill: boolean) => {
      const ctx: ActionContext = {
        ideaId,
        tool: activeTool,
        selection: EMPTY_SELECTION,
        surface: 'panel',
        source: 'ui',
        params: {
          templateId: template.id,
          withAIFill,
          run: () => handleApply(template, withAIFill),
        },
      };
      void runIdeaAction('idea.template.apply', ctx);
    },
    [activeTool, handleApply, ideaId]
  );

  if (!open) return null;

  return (
    <>
      {confirmDialog}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-navy-700/60 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {t('myWorkIdeas.templateGallery.templateGallery')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t('myWorkIdeas.templateGallery.chooseTemplateGetStartedQuickly')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <X size={16} className="text-slate-500" />
            </button>
          </div>

          <div className="px-5 py-3 border-b border-slate-200/60 dark:border-navy-700/60 flex flex-wrap gap-2">
            {(['all', 'global', 'organization', 'project', 'private'] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => setScopeFilter(scope)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  scopeFilter === scope
                    ? 'bg-c-info/10 text-c-info'
                    : 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-300'
                }`}
              >
                {scope}
              </button>
            ))}
            {(['all', 'process', 'system', 'org', 'strategy', 'workshop'] as const).map(
              (category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                    categoryFilter === category
                      ? 'bg-c-info/10 text-c-info'
                      : 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-300'
                  }`}
                >
                  {category}
                </button>
              )
            )}
          </div>

          {/* Templates grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-[11px] text-slate-500 dark:text-slate-400">
                {t('myWorkIdeas.templateGallery.noTemplatesAvailableTool')}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {templates.map((template) => {
                  const Icon = template.icon;
                  const governance = template.governance;
                  return (
                    <div
                      key={template.id}
                      className="group text-left p-4 rounded-xl border border-slate-200/60 dark:border-navy-700/60 hover:border-c-info/40 hover:bg-c-info/[0.02] transition-all duration-200"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-c-info/10 to-c-info/10 flex items-center justify-center text-c-info shrink-0">
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-bold text-slate-800 dark:text-slate-100 mb-0.5">
                            {isPl ? template.namePl : template.nameEn}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {isPl ? template.descPl : template.descEn}
                          </div>
                          {governance && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-navy-800 dark:text-slate-300">
                                {governance.category}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-navy-800 dark:text-slate-300">
                                {governance.scope}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-navy-800 dark:text-slate-300">
                                v{governance.version}
                              </span>
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => runTemplateApplyAction(template, false)}
                              disabled={!!applying}
                              className="inline-flex items-center gap-1 text-[9px] font-semibold text-c-info hover:text-c-info/80 transition-colors disabled:opacity-50"
                            >
                              {applying === template.id && !aiFilling
                                ? t('myWorkIdeas.templateGallery.applying')
                                : t('myWorkIdeas.templateGallery.useTemplate')}
                              <ArrowRight size={10} />
                            </button>
                            {template.nodes.length > 0 && (
                              <button
                                onClick={() => runTemplateApplyAction(template, true)}
                                disabled={!!applying}
                                className="inline-flex items-center gap-1 text-[9px] font-semibold text-c-info hover:text-c-info/80 transition-colors disabled:opacity-50"
                              >
                                {aiFilling === template.id ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <Sparkles size={10} />
                                )}
                                {t('myWorkIdeas.templateGallery.aiFill')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default IdeaTemplateGallery;
