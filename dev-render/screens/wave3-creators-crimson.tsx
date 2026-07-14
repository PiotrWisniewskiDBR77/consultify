/**
 * Dev-render: FALA 3 (ReportBuilder + AIChat + Meeting) — crimson-fill CTA sweep.
 *
 * Audit found ~250 bg-c-accent (pełne crimson tło) misused as CTA/active-state
 * fills (CLAUDE.md Pułapka nr 1: primary=crimson, CTA/active state musi być
 * neutralne). This screen is a STATIC SWATCH, not a live-mounted production
 * page: ReportBuilderWizard needs react-router context + a live report-builder
 * API session, MessageRenderer needs a full `msg` object + a dozen handler
 * callbacks, MeetingHub fetches its own org/meeting data with no props — none
 * of those are mockable cheaply in a night-shift dev-render harness. Instead,
 * each block below is copy-pasted VERBATIM (same className strings) from the
 * fixed source files, so what's on screen is byte-for-byte what ships.
 *
 * Sources (line numbers as fixed):
 *   - ReportBuilderWizard.tsx:404 (active step circle), :443 (progress line), :660 (Next CTA step 3)
 *   - BlockTypesManager.tsx:456 / TemplatesManager.tsx:742 (toolbar "New" CTA)
 *   - BlockPalette.tsx:149/206/330/341/352 (block-type color swatches)
 *   - AIChat/MessageRenderer.tsx:899 (Confirm & proceed), :1962 (Save as Decision)
 *   - Meeting/MeetingHub.tsx:691 (New meeting), :1000 (modal Save), :1680 (today badge)
 */
import {
  CheckCircle2,
  FileText,
  LayoutGrid,
  MessageSquare,
  Plus,
  Quote,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import React from 'react';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-c-text uppercase tracking-wide">{title}</h2>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-c-border-subtle bg-c-surface p-5">
        {children}
      </div>
    </div>
  );
}

function Swatch({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-2">
      {children}
      <span className="text-[10px] text-c-text-secondary">{label}</span>
    </div>
  );
}

export default function Wave3CreatorsCrimsonScreen(): React.ReactElement {
  return (
    <div className="min-h-screen w-full bg-c-bg p-8 space-y-8">
      <div>
        <h1 className="text-lg font-bold text-c-text">
          Fala 3 — ReportBuilder + AIChat + Meeting: crimson-fill CTA sweep (PO naprawie)
        </h1>
        <p className="text-xs text-c-text-secondary mt-1">
          Wszystkie elementy poniżej używają realnych className z naprawionych plików źródłowych.
        </p>
      </div>

      {/* ── ReportBuilderWizard: step indicator + Next CTA ────────────── */}
      <Section title="ReportBuilderWizard.tsx — krok aktywny (:404) + linia postępu (:443) + Next CTA (:660)">
        <Swatch label="Step circle — active (bg-c-surface-raised, ring-c-focus)">
          <button
            disabled
            className="relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 bg-c-surface-raised text-c-text ring-4 ring-c-focus shadow-lg"
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>
        </Swatch>
        <Swatch label="Step circle — completed (unchanged, green)">
          <button
            disabled
            className="relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 bg-green-500 text-c-text cursor-pointer hover:bg-green-600 shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>
        </Swatch>
        <Swatch label="Connector — current step (bg-c-focus-solid)">
          <div className="w-24 h-0.5 rounded-full transition-all duration-300 bg-c-focus-solid" />
        </Swatch>
        <Swatch label={'Next CTA (step 3, teraz = bg-c-text/text-c-bg)'}>
          <button
            disabled
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all text-sm bg-c-text text-c-bg shadow-md hover:shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            Generate
          </button>
        </Swatch>
      </Section>

      {/* ── Toolbar "New" CTA — BlockTypesManager / TemplatesManager ──── */}
      <Section title='BlockTypesManager.tsx:456 / TemplatesManager.tsx:742 — toolbar "New" CTA'>
        <Swatch label="New Block / New Template">
          <button
            disabled
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium bg-c-text text-c-surface border border-c-border-subtle hover:brightness-110 shadow-lg transition duration-200"
          >
            <Plus size={14} />
            <span>New Block</span>
          </button>
        </Swatch>
      </Section>

      {/* ── BlockPalette color swatches ────────────────────────────── */}
      <Section title="BlockPalette.tsx — kolory typów bloków (quote/matrix/risk/prioritization/initiatives)">
        <Swatch label="quote (:149 — violet)">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white">
            <Quote className="w-6 h-6" />
          </div>
        </Swatch>
        <Swatch label="matrix (:206 — indigo)">
          <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
            <LayoutGrid className="w-6 h-6" />
          </div>
        </Swatch>
        <Swatch label="risk (:330 — amber)">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <MessageSquare className="w-6 h-6" />
          </div>
        </Swatch>
        <Swatch label="prioritization (:341 — blue)">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <Target className="w-6 h-6" />
          </div>
        </Swatch>
        <Swatch label="initiatives (:352 — emerald)">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <Zap className="w-6 h-6" />
          </div>
        </Swatch>
        <Swatch label="TemplatePickerModal header icon (:336 — blue, było crimson)">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 text-c-text rounded-lg">
            <FileText size={20} />
          </div>
        </Swatch>
      </Section>

      {/* ── AIChat/MessageRenderer filled CTAs ─────────────────────── */}
      <Section title="AIChat/MessageRenderer.tsx — filled CTA (:899, :1962; wzorzec identyczny dla :1189/:1350/:2072/:2138)">
        <Swatch label="Confirm & proceed (:899)">
          <button
            disabled
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-text hover:opacity-90 text-c-surface disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm & proceed
          </button>
        </Swatch>
        <Swatch label="Save as Decision (:1962)">
          <button
            disabled
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-c-text hover:opacity-90 text-c-surface disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            Save as Decision
          </button>
        </Swatch>
        <Swatch label="'pisze…' pulse dots — ZOSTAWIONE (crimson, poza scope)">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-c-accent animate-pulse" />
            <div
              className="w-2 h-2 rounded-full bg-c-accent animate-pulse"
              style={{ animationDelay: '0.15s' }}
            />
            <div
              className="w-2 h-2 rounded-full bg-c-accent animate-pulse"
              style={{ animationDelay: '0.3s' }}
            />
          </div>
        </Swatch>
      </Section>

      {/* ── MeetingHub CTAs + calendar today-badge ─────────────────── */}
      <Section title="Meeting/MeetingHub.tsx — New meeting (:691) / modal Save (:1000) / today badge (:1680)">
        <Swatch label="New meeting (:691)">
          <button
            disabled
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-c-text text-c-surface hover:opacity-90 transition-colors"
          >
            <span>New meeting</span>
          </button>
        </Swatch>
        <Swatch label="Modal 'Create meeting' (:1000)">
          <button
            disabled
            className="h-9 px-4 rounded-full bg-c-text text-c-surface text-sm font-medium hover:opacity-90"
          >
            Create meeting
          </button>
        </Swatch>
        <Swatch label="AI notes (:1378)">
          <button
            disabled
            className="h-9 px-4 rounded-full bg-c-text text-c-surface text-sm font-medium inline-flex items-center gap-1.5 hover:opacity-90"
          >
            <Sparkles className="w-4 h-4" />
            AI notes
          </button>
        </Swatch>
        <Swatch label="Calendar 'today' badge (:1680 — bg-c-focus-solid)">
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] bg-c-focus-solid font-semibold text-white">
            13
          </span>
        </Swatch>
      </Section>
    </div>
  );
}
