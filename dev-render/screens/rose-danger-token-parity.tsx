/**
 * FIX/rose-regression — dowód wartości: rose-* i danger-* to TA SAMA paleta
 * (tailwind.config.js: rose === danger, każdy numer identyczny hex).
 * PRZED (lewa, klasy rose-*, jak w kodzie sprzed sweepu) vs PO (prawa, danger-*,
 * jak po zamianie w Execution/settings) — jeśli swatche są piksel-identyczne,
 * sweep nie zmienił NIC wizualnie, tylko nazwę tokenu. light+dark przez ?theme.
 */
import React from 'react';

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const OPACITY_VARIANTS: Array<{ shade: number; op: number }> = [
  { shade: 500, op: 10 },
  { shade: 500, op: 20 },
  { shade: 500, op: 30 },
  { shade: 900, op: 10 },
  { shade: 900, op: 20 },
  { shade: 900, op: 30 },
];

const Swatch: React.FC<{ label: string; className: string }> = ({ label, className }) => (
  <div className="flex flex-col items-center gap-1">
    <div className={`w-14 h-10 rounded border border-c-border-subtle ${className}`} />
    <span className="text-[10px] text-c-text-muted font-mono">{label}</span>
  </div>
);

const Col: React.FC<{ title: string; prefix: 'rose' | 'danger'; tone: 'before' | 'after' }> = ({
  title,
  prefix,
  tone,
}) => (
  <div className="flex-1 min-w-[320px] space-y-4">
    <div
      className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded inline-block ${
        tone === 'before'
          ? 'text-c-text-secondary bg-c-surface-raised'
          : 'text-c-text bg-c-accent-soft'
      }`}
    >
      {title}
    </div>
    <div>
      <p className="text-xs text-c-text-muted mb-2">bg-{prefix}-XXX (solid)</p>
      <div className="flex flex-wrap gap-3">
        {SHADES.map((s) => (
          <Swatch key={s} label={String(s)} className={`bg-${prefix}-${s}`} />
        ))}
      </div>
    </div>
    <div>
      <p className="text-xs text-c-text-muted mb-2">bg-{prefix}-XXX/opacity (jak w alertach/badge)</p>
      <div className="flex flex-wrap gap-3">
        {OPACITY_VARIANTS.map(({ shade, op }) => (
          <Swatch
            key={`${shade}-${op}`}
            label={`${shade}/${op}`}
            className={`bg-${prefix}-${shade}/${op}`}
          />
        ))}
      </div>
    </div>
    <div>
      <p className="text-xs text-c-text-muted mb-2">text-{prefix}-XXX (na bg-c-surface)</p>
      <div className="flex flex-wrap gap-3 p-3 bg-c-surface rounded-lg">
        {[400, 500, 600, 700].map((s) => (
          <span key={s} className={`text-sm font-medium text-${prefix}-${s}`}>
            Aa {s}
          </span>
        ))}
      </div>
    </div>
    <div className={`flex items-center gap-2 p-3 rounded-lg border bg-${prefix}-50 dark:bg-${prefix}-900/10 border-${prefix}-200 dark:border-${prefix}-500/20`}>
      <span className={`text-sm font-medium text-${prefix}-700 dark:text-${prefix}-300`}>
        Przykład alertu (jak PrivacyDataSettings/CorrectiveActions)
      </span>
    </div>
  </div>
);

const RoseDangerTokenParityScreen: React.FC = () => (
  <div className="min-h-screen bg-c-bg-page p-8">
    <h1 className="text-lg font-semibold text-c-text mb-1">
      Dowód parytetu: rose-* → danger-* (fix/rose-regression)
    </h1>
    <p className="text-sm text-c-text-muted mb-6 max-w-2xl">
      Execution (M14) + Settings (M25): 34 pliki, 321 wystąpień rose-* → danger-*. Ta strona
      NIE jest zrzutem realnych ekranów (te wymagają zalogowanej sesji/API) — dowodzi, że
      paleta docelowa jest bit-identyczna z paletą źródłową, więc sweep nie zmienia niczego
      wizualnie w żadnym z tych 34 plików. Jeśli lewa i prawa kolumna wyglądają identycznie
      (light i dark), zamiana jest bezpieczna.
    </p>
    <div className="flex gap-10 flex-wrap">
      <Col title="PRZED — rose-* (skorumpowany token)" prefix="rose" tone="before" />
      <Col title="PO — danger-* (kanoniczny c-danger)" prefix="danger" tone="after" />
    </div>
  </div>
);

export default RoseDangerTokenParityScreen;
