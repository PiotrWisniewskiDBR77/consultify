/**
 * FALA 1 (Settings) — neutralizacja crimson CTA/toggle/selected (kanon pułapka #1).
 * PRZED (lewa, crimson bg-c-accent) vs PO (prawa, neutralne bg-c-text / bg-c-focus).
 * Wierne odwzorowanie realnych klas z src/components/settings/* — mock, zero API,
 * żeby nadzorca zrobił zrzut PRZED odbiorem Piotra (CLAUDE.md #7). light+dark przez ?theme.
 */
import { Check, Save, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';

const Col: React.FC<{ title: string; tone: 'before' | 'after'; children: React.ReactNode }> = ({
  title,
  tone,
  children,
}) => (
  <div className="flex-1 min-w-[280px] space-y-4">
    <div
      className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded ${
        tone === 'before' ? 'text-c-accent bg-c-accent-soft' : 'text-c-text bg-c-surface-raised'
      }`}
    >
      {title}
    </div>
    {children}
  </div>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
    <p className="font-medium text-c-text text-sm">{label}</p>
    {children}
  </div>
);

/** Pstryczek — kopia geometrii z AdvancedSettings/PrivacyData, tylko kolor ON się zmienia. */
const Toggle: React.FC<{ on: boolean; onColor: string }> = ({ on, onColor }) => (
  <button
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      on ? onColor : 'bg-c-surface-raised'
    }`}
  >
    <span
      className={`${on ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
    />
  </button>
);

const SettingsCrimsonNeutralizedScreen: React.FC = () => {
  const [tab, setTab] = useState<'sessions' | 'devices' | 'events'>('sessions');
  const tabs = [
    { id: 'sessions' as const, label: 'Sesje' },
    { id: 'devices' as const, label: 'Urządzenia' },
    { id: 'events' as const, label: 'Zdarzenia' },
  ];

  return (
    <div className="min-h-screen bg-c-bg p-8">
      <div className="max-w-4xl mx-auto space-y-10">
        <header>
          <h2 className="text-xl font-semibold text-c-text">
            Fala 1 · Settings — crimson CTA/aktywne → neutralne
          </h2>
          <p className="text-sm text-c-text-muted mt-1">
            Kanon pułapka #1: pełne crimson tło TYLKO semantyka krytyczna. CTA/toggle/selected =
            neutralne (tekst/fokus). 39 miejsc naprawionych, 2 zostawione (poniżej).
          </p>
        </header>

        {/* Archetyp 1: Filled-CTA */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-c-text-secondary">
            Archetyp 1 · Filled-CTA (np. „Zapisz")
          </h3>
          <div className="flex gap-8 flex-wrap">
            <Col title="Przed · bg-c-accent" tone="before">
              <button className="flex items-center gap-2 px-4 py-2 bg-c-accent hover:bg-c-accent text-white rounded-lg transition-colors">
                <Save size={16} /> Zapisz zmiany
              </button>
            </Col>
            <Col title="Po · bg-c-text text-c-surface" tone="after">
              <button className="flex items-center gap-2 px-4 py-2 bg-c-text hover:bg-c-text text-c-surface rounded-lg transition-colors">
                <Save size={16} /> Zapisz zmiany
              </button>
            </Col>
          </div>
        </section>

        {/* Archetyp 2: Toggle ON */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-c-text-secondary">
            Archetyp 2 · Pstryczek ON (bez lokalnego wzorca → niebieski c-focus)
          </h3>
          <div className="flex gap-8 flex-wrap">
            <Col title="Przed · ON = bg-c-accent" tone="before">
              <Row label="Skróty klawiszowe">
                <Toggle on onColor="bg-c-accent" />
              </Row>
            </Col>
            <Col title="Po · ON = bg-c-focus" tone="after">
              <Row label="Skróty klawiszowe">
                <Toggle on onColor="bg-c-focus" />
              </Row>
            </Col>
          </div>
        </section>

        {/* Archetyp 3a: Selected tab */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-c-text-secondary">
            Archetyp 3 · Zakładka aktywna (SessionsActivity)
          </h3>
          <div className="flex gap-8 flex-wrap">
            <Col title="Przed · bg-c-accent text-white" tone="before">
              <div className="inline-flex gap-1 p-1 bg-c-surface-raised rounded-lg">
                {tabs.map((t) => (
                  <span
                    key={t.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md ${
                      t.id === 'sessions'
                        ? 'bg-c-accent text-white shadow-sm'
                        : 'text-c-text-secondary'
                    }`}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            </Col>
            <Col title="Po · bg-c-text text-c-surface" tone="after">
              <div className="inline-flex gap-1 p-1 bg-c-surface-raised rounded-lg">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      tab === t.id
                        ? 'bg-c-text text-c-surface shadow-sm'
                        : 'text-c-text-secondary hover:text-c-text hover:bg-c-surface'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Col>
          </div>
        </section>

        {/* Archetyp 3b: Step indicator */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-c-text-secondary">
            Archetyp 3 · Wskaźnik kroku aktywnego (SecurityOverview)
          </h3>
          <div className="flex gap-8 flex-wrap">
            {(
              [
                { title: 'Przed · isActive = bg-c-accent', active: 'bg-c-accent text-white', tone: 'before' as const },
                { title: 'Po · isActive = bg-c-text', active: 'bg-c-text text-c-surface', tone: 'after' as const },
              ]
            ).map((v) => (
              <Col key={v.title} title={v.title} tone={v.tone}>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((n) => {
                    const completed = n === 1;
                    const active = n === 2;
                    return (
                      <div
                        key={n}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          completed
                            ? 'bg-emerald-500 text-white'
                            : active
                              ? v.active
                              : 'bg-c-surface/[0.06] text-c-text-muted'
                        }`}
                      >
                        {completed ? <Check size={10} /> : n}
                      </div>
                    );
                  })}
                </div>
              </Col>
            ))}
          </div>
        </section>

        {/* ZOSTAWIONE — zamierzone, nie CTA */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-c-text-secondary">
            Zostawione (zamierzone) · nie CTA — crimson dozwolony
          </h3>
          <div className="flex gap-8 flex-wrap items-center">
            <div className="space-y-2">
              <div className="text-xs text-c-text-muted">ThemeSettings · swatch „Crimson"</div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-c-accent border border-c-border-subtle" />
                <span className="text-sm text-c-text">Crimson</span>
              </div>
            </div>
            <div className="space-y-2 min-w-[220px]">
              <div className="text-xs text-c-text-muted">SecurityDashboard · pasek postępu (dane)</div>
              <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
                <div className="h-full bg-c-accent rounded-full" style={{ width: '68%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-c-text-muted">SecurityEvents · ikona-gradient nagłówka</div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-c-accent-soft to-c-accent flex items-center justify-center shadow-lg shadow-c-accent text-white">
                <ShieldCheck size={22} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsCrimsonNeutralizedScreen;
