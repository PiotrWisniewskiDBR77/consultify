/**
 * RB-1 (Wpis 76 / przepis Wpis 44) — dev-render host for the REAL
 * <SettingsPanel /> (Report Builder → right rail, "Content" tab) showing the
 * new "Voice & Detail" card that exposes the engine knobs (verbosity, writing
 * style, examples, custom tone) which previously had no live control.
 *
 * No re-implementation: mounts the production component with representative
 * intent/styling props. The card ships collapsed (defaultOpen=false), so the
 * harness performs one REAL click on its header after mount to reveal the
 * controls — the same interaction a user makes.
 *
 * ?lang=en|pl &theme=light|dark
 */
import React, { useEffect } from 'react';

import type { ReportIntent, ReportStyling } from '../../src/components/ReportBuilder/ReportEditor/ReportEditor';
import { SettingsPanel } from '../../src/components/ReportBuilder/ReportEditor/SettingsPanel';

const intent: ReportIntent = {
  audience: 'executive',
  goal: 'diagnosis',
  language: 'en',
  tone: 'consulting',
  scope: 'full',
  verbosity: 'detailed',
  writingStyle: 'consultative',
  illustrationLevel: 'moderate',
  customTone: 'direct and data-driven',
};

const styling: ReportStyling = {
  theme: 'professional',
  primaryColor: '#85182F',
  accentColor: '#85182F',
  fontFamily: 'inter',
  showLogo: false,
  showBranding: true,
};

export default function ReportBuilderVoiceDetailScreen(): React.ReactElement {
  useEffect(() => {
    // Karta startuje zwinięta (defaultOpen=false). Kliknij jej nagłówek, aby
    // odsłonić pokrętła — powtarzaj, aż kontrolki pojawią się w DOM ( StrictMode
    // montuje efekt dwukrotnie, więc bez ref-guarda; warunek stopu = widoczny select).
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const revealed = Array.from(document.querySelectorAll('label')).some((l) =>
        /Verbosity/i.test(l.textContent || '')
      );
      if (revealed || tries > 40) {
        clearInterval(timer);
        return;
      }
      const header = Array.from(document.querySelectorAll('button')).find((b) =>
        /Voice & Detail|Głos i szczegółowość/i.test(b.textContent || '')
      );
      header?.click();
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', height: '100vh', background: 'var(--c-bg, #fff)' }}>
      <div style={{ width: 380, height: '100vh', overflow: 'auto' }}>
        <SettingsPanel
          intent={intent}
          styling={styling}
          sourceType="ASSESSMENT"
          sourceName="Northwind Packaging — DRD"
          onIntentChange={() => {}}
          onStylingChange={() => {}}
          activeSection="intent"
          onSectionChange={() => {}}
          embedded
        />
      </div>
    </div>
  );
}
