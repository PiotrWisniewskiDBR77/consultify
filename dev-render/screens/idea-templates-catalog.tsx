/**
 * Dev-render: KATALOG-AKCEPT #10-AB — baza ~40 startowych szablonów konsultingowych.
 *
 * Renderuje REALNE dane `CONSULTING_TEMPLATES` (te same, które zasilają
 * IdeaTemplateGallery → applyIdeaTemplate) pogrupowane w 7 zatwierdzonych
 * kategorii biznesowych. Każda karta pokazuje: nazwę PL/EN, opis „po co i kiedy",
 * typ canvas (mindmap/flow/table/whiteboard) oraz STRESZCZENIE SEEDU (etykiety
 * ramek/gałęzi/pasów/kolumn) — dowód, że każdy szablon to realny punkt startu,
 * nie placeholder. Bez logowania/API — czyste dane. Motyw/lang z URL.
 */
import React from 'react';

import {
  CONSULTING_CATEGORY_LABELS,
  CONSULTING_CATEGORY_ORDER,
  CONSULTING_TEMPLATES,
  CONSULTING_TEMPLATES_BY_GROUP,
} from '../../src/components/MyWork/ideaConsultingTemplates';
import type { TemplateDefinition } from '../../src/components/MyWork/IdeaTemplateGallery';

const isPl = () =>
  (new URLSearchParams(window.location.search).get('lang') || 'pl').startsWith('pl');

// ★ NAPRAWA (2026-08-30, dyżur 131-noc-moja-praca): etykieta typu narzędzia była
// na sztywno po angielsku niezależnie od `?lang=` — jedyne miejsce w tym pliku,
// które ignorowało `isPl()` mimo że reszta karty (nazwa PL/EN) go respektuje.
// Ten katalog to harness akceptacyjny (KATALOG-AKCEPT #10-AB), nie ekran
// produktu widziany przez klienta, ale skoro renderuje `?lang=pl` — badge też
// powinien być po polsku.
// ★ POPRAWKA (ten sam dyżur, po znalezieniu SSOT): „Whiteboard" i „Process Flow"
// ZOSTAJĄ po angielsku w obu językach — to jest UDOKUMENTOWANA decyzja właściciela
// (`src/components/MyWork/IdeaWorkspaceToolbar.tsx:51-52`, „owner request —
// »Mapa myśli · Whiteboard · Process Flow · Tabela«"), nie brak tłumaczenia.
// Pierwsza wersja tej naprawy błędnie przetłumaczyła je na „Tablica"/„Diagram
// procesu" — rozjazd z SSOT, cofnięte.
const TOOL_LABEL: Record<string, { pl: string; en: string }> = {
  whiteboard: { pl: 'Whiteboard', en: 'Whiteboard' },
  mindmap: { pl: 'Mapa myśli', en: 'Mind Map' },
  process_flow: { pl: 'Process Flow', en: 'Process Flow' },
  table: { pl: 'Tabela', en: 'Table' },
};

// Zgodnie z kanonicznym mapowaniem produkcyjnym (TOOL_ICON_COLOR_VAR,
// src/components/MyWork/MyIdeasListContent.tsx:251) — crimson (--c-accent)
// zarezerwowany dla Mind Map (flagowe narzędzie, jedyny wyjątek), reszta
// narzędzi = kolory semantyczne. PRZED tej naprawy Whiteboard miał crimson =
// złamanie reguły "czerwień tylko semantyka krytyczna" (CLAUDE.md #3).
const TOOL_TONE: Record<string, string> = {
  whiteboard: 'var(--c-warning)',
  mindmap: 'var(--c-accent)',
  process_flow: 'var(--c-success)',
  table: 'var(--c-info)',
};

/** Wyciąga zwięzłe streszczenie seedu danego szablonu (co użytkownik dostaje). */
function seedSummary(t: TemplateDefinition): { kind: string; items: string[] } {
  if (t.tool === 'table') {
    const cols = ((t.extensions as any)?.table?.columns || []) as { header: string }[];
    const rows = t.nodes.length;
    return {
      kind: `${cols.length} kolumn · ${rows} wierszy`,
      items: cols.map((c) => c.header),
    };
  }
  if (t.tool === 'process_flow') {
    const lanes = ((t.extensions as any)?.processFlow?.lanes || []) as { label: string }[];
    const steps = t.nodes
      .map((n: any) => String(n?.data?.label || '').split('\n')[0])
      .filter(Boolean);
    return {
      kind: `${lanes.length} pasy · ${t.nodes.length} kroków`,
      items: lanes.length ? lanes.map((l) => `▸ ${l.label}`).concat(steps.slice(0, 4)) : steps,
    };
  }
  if (t.tool === 'mindmap') {
    const branches = t.nodes
      .filter((n: any) => n?.type === 'branch')
      .map((n: any) => String(n?.data?.label || ''));
    return { kind: `${branches.length} gałęzi`, items: branches };
  }
  // whiteboard — ramki (bez sticky-podpowiedzi)
  const frames = t.nodes
    .filter((n: any) => n?.type === 'frameNode')
    .map((n: any) => String(n?.data?.label || ''));
  return { kind: `${frames.length} sekcji`, items: frames };
}

const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 999,
      color: color || 'var(--c-text-muted)',
      background: color
        ? `color-mix(in srgb, ${color} 12%, transparent)`
        : 'var(--c-surface-raised)',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

const Card: React.FC<{ t: TemplateDefinition; pl: boolean }> = ({ t, pl }) => {
  const Icon = t.icon;
  const seed = seedSummary(t);
  const tone = TOOL_TONE[t.tool] || 'var(--c-text-muted)';
  return (
    <div
      style={{
        border: '1px solid var(--c-border-subtle)',
        borderRadius: 14,
        background: 'var(--c-surface)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tone,
            background: `color-mix(in srgb, ${tone} 12%, transparent)`,
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.25 }}>
            {pl ? t.namePl : t.nameEn}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--c-text-muted)' }}>
            {pl ? t.nameEn : t.namePl}
          </div>
        </div>
        <Badge color={tone}>{pl ? TOOL_LABEL[t.tool].pl : TOOL_LABEL[t.tool].en}</Badge>
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--c-text-secondary)', lineHeight: 1.45 }}>
        {pl ? t.descPl : t.descEn}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
        <Badge>{seed.kind}</Badge>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {seed.items.slice(0, 10).map((it, i) => (
          <span
            key={i}
            style={{
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 7,
              color: 'var(--c-text-secondary)',
              background: 'var(--c-surface-raised)',
              border: '1px solid var(--c-border-subtle)',
            }}
          >
            {it}
          </span>
        ))}
        {seed.items.length > 10 && (
          <span style={{ fontSize: 10, color: 'var(--c-text-muted)', padding: '2px 4px' }}>
            +{seed.items.length - 10}
          </span>
        )}
      </div>
    </div>
  );
};

const IdeaTemplatesCatalogScreen: React.FC = () => {
  const pl = isPl();
  return (
    <div
      style={{
        padding: '28px 24px 64px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--c-accent)',
          }}
        >
          #10-AB · Ideas · Template Library
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', margin: '6px 0 4px' }}>
          {pl ? 'Baza startowych szablonów konsultingowych' : 'Consulting Starter Template Library'}
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--c-text-muted)', margin: 0 }}>
          {pl
            ? `${CONSULTING_TEMPLATES.length} szablonów w 7 kategoriach — każdy z realnym seedem frameworka (McKinsey/BCG-grade).`
            : `${CONSULTING_TEMPLATES.length} templates across 7 categories — each with a real framework seed (McKinsey/BCG-grade).`}
        </p>
      </div>

      {CONSULTING_CATEGORY_ORDER.map((group) => {
        const items = CONSULTING_TEMPLATES_BY_GROUP[group];
        const label = CONSULTING_CATEGORY_LABELS[group];
        return (
          <section key={group} style={{ marginBottom: 30 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: '1px solid var(--c-border-subtle)',
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-text)', margin: 0 }}>
                {pl ? label.pl : label.en}
              </h2>
              <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 600 }}>
                {items.length}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: 12,
              }}
            >
              {items.map((t) => (
                <Card key={t.id} t={t} pl={pl} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default IdeaTemplatesCatalogScreen;
