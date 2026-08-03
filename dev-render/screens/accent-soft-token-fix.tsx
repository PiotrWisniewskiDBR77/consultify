import React from 'react';

/**
 * J23 — bg-c-accent-soft opacity bug fix (cTok, wave5-internal-crimson finding).
 *
 * --c-accent-soft ma WPIECZONĄ niską alfę (0.08 light / 0.14 dark) i służy jako
 * miękki tint stanu zaznaczonego / odznaki REKOMENDACJA. Przed naprawą cTok
 * zwracał rgb(var(--c-accent-soft-rgb) / var(--tw-bg-opacity,1)) = pełny crimson,
 * bo Tailwind przekazuje sentinel 'var(--tw-…' zamiast undefined dla klasy bez /NN.
 *
 * Ekran pokazuje odznakę REKOMENDACJA (bg-c-accent-soft + text-c-accent) obok
 * pełnego accentu — jeśli oba tła są identyczne (pełny crimson), bug NIE jest
 * naprawiony. PO naprawie lewe tło = jasny tint, tekst crimson czytelny.
 */
function Swatch({ label, className }: { label: string; className: string }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <div
        className={className}
        style={{ width: 160, height: 96, borderRadius: 10, border: '1px solid var(--c-border)' }}
      />
      <code style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>{label}</code>
    </div>
  );
}

export default function AccentSoftTokenFixScreen(): React.ReactElement {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--c-bg)',
        color: 'var(--c-text)',
        padding: 32,
        fontFamily: 'system-ui',
      }}
    >
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>
        J23 · bg-c-accent-soft — miękki tint, nie pełny crimson
      </h1>
      <p
        style={{ fontSize: 13, color: 'var(--c-text-secondary)', marginBottom: 28, maxWidth: 720 }}
      >
        Odznaka REKOMENDACJA używa <code>bg-c-accent-soft</code> + <code>text-c-accent</code>. Jeśli
        tło jest pełnym crimsonem i tekst nieczytelny — bug żyje. Po naprawie: delikatny tint, tekst
        crimson wyraźny.
      </p>

      {/* Odznaka REKOMENDACJA — realny wzorzec (selected / tag) */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 36 }}>
        <span
          className="bg-c-accent-soft text-c-accent"
          style={{
            borderRadius: 9999,
            padding: '4px 12px',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          REKOMENDACJA
        </span>
        <span
          className="bg-c-accent-soft text-c-accent"
          style={{
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Wiersz zaznaczony (selected-state tint)
        </span>
      </div>

      {/* Swatche porównawcze */}
      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
        <Swatch label="bg-c-accent-soft (tint)" className="bg-c-accent-soft" />
        <Swatch label="bg-c-accent (pełny, ref)" className="bg-c-accent" />
        <Swatch label="bg-c-accent-soft/70 (modyfikator)" className="bg-c-accent-soft/70" />
      </div>
    </div>
  );
}
