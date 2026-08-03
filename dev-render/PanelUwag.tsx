/**
 * PANEL UWAG — wpięty w KAŻDY ekran harnessu odbioru.
 *
 * Właściciel klika po ekranie i zgłasza uwagi w miejscu, w którym je widzi.
 * Uwagi lecą POST-em na /__uwagi (plugin w dev-render/vite.config.ts) i lądują
 * na dysku w `odbior-uwagi/<ekran>.json` — stamtąd czyta je sesja nadzorcy.
 *
 * Świadomie BEZ zależności od stanu aplikacji: własne style inline, żeby panel
 * wyglądał tak samo niezależnie od motywu i CSS testowanego ekranu.
 */
import React from 'react';

type Werdykt = 'bierzemy' | 'popraw' | 'nie' | null;

interface Uwaga {
  tekst: string;
  czas: string;
}

interface Zapis {
  ekran: string;
  werdykt: Werdykt;
  uwagi: Uwaga[];
}

const KOLOR = {
  tlo: '#111827',
  tloJasne: '#1f2937',
  tekst: '#f9fafb',
  tekstMuted: '#9ca3af',
  ramka: '#374151',
  akcent: '#2563eb',
  ok: '#15803d',
  popraw: '#b45309',
  nie: '#b91c1c',
};

export default function PanelUwag({ ekran }: { ekran: string }): React.ReactElement {
  const [otwarty, setOtwarty] = React.useState(false);
  const [tekst, setTekst] = React.useState('');
  const [zapis, setZapis] = React.useState<Zapis>({ ekran, werdykt: null, uwagi: [] });
  const [stan, setStan] = React.useState<'' | 'zapisuję' | 'zapisano' | 'błąd'>('');

  React.useEffect(() => {
    fetch(`/__uwagi?ekran=${encodeURIComponent(ekran)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setZapis(d))
      .catch(() => undefined);
  }, [ekran]);

  const wyslij = React.useCallback(async (nowy: Zapis) => {
    setStan('zapisuję');
    try {
      const r = await fetch('/__uwagi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(nowy),
      });
      if (!r.ok) throw new Error(String(r.status));
      setZapis(nowy);
      setStan('zapisano');
      setTimeout(() => setStan(''), 1500);
    } catch {
      setStan('błąd');
    }
  }, []);

  const dodaj = () => {
    const t = tekst.trim();
    if (!t) return;
    void wyslij({
      ...zapis,
      ekran,
      uwagi: [...zapis.uwagi, { tekst: t, czas: new Date().toISOString() }],
    });
    setTekst('');
  };

  const ustawWerdykt = (w: Werdykt) => void wyslij({ ...zapis, ekran, werdykt: w });

  const btnWerdykt = (w: Exclude<Werdykt, null>, etykieta: string, kolor: string) => (
    <button
      key={w}
      onClick={() => ustawWerdykt(zapis.werdykt === w ? null : w)}
      style={{
        flex: 1,
        padding: '7px 6px',
        borderRadius: 7,
        border: `1px solid ${zapis.werdykt === w ? kolor : KOLOR.ramka}`,
        background: zapis.werdykt === w ? kolor : 'transparent',
        color: KOLOR.tekst,
        fontSize: 13,
        cursor: 'pointer',
        fontWeight: zapis.werdykt === w ? 600 : 400,
      }}
    >
      {etykieta}
    </button>
  );

  const stylPigulki: React.CSSProperties = {
    padding: '10px 15px',
    borderRadius: 999,
    border: 'none',
    background: KOLOR.tlo,
    color: KOLOR.tekst,
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,.35)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textDecoration: 'none',
    display: 'inline-block',
  };

  // Powrót do listy obiektów. Uwagi lecą na dysk przy każdym dodaniu, więc
  // wyjście z ekranu (ani odświeżenie) niczego nie gubi.
  const powrot = (
    <a
      href="/odbior.html"
      style={{ ...stylPigulki, background: '#334155' }}
      title="Wróć do listy obiektów"
    >
      ← Lista
    </a>
  );

  if (!otwarty) {
    const ile = zapis.uwagi.length;
    return (
      <div
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 2147483000,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        {powrot}
        <button onClick={() => setOtwarty(true)} style={stylPigulki}>
          Uwagi{ile ? ` · ${ile}` : ''}
          {zapis.werdykt ? ` · ${zapis.werdykt}` : ''}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 2147483000,
        width: 340,
        maxHeight: '78vh',
        display: 'flex',
        flexDirection: 'column',
        background: KOLOR.tlo,
        color: KOLOR.tekst,
        border: `1px solid ${KOLOR.ramka}`,
        borderRadius: 12,
        boxShadow: '0 10px 34px rgba(0,0,0,.45)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 13.5,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 13px',
          borderBottom: `1px solid ${KOLOR.ramka}`,
        }}
      >
        <strong style={{ fontSize: 13.5 }}>
          Uwagi do ekranu{zapis.uwagi.length ? ` (${zapis.uwagi.length})` : ''}
        </strong>
        <a
          href="/odbior.html"
          style={{
            marginLeft: 'auto',
            marginRight: 10,
            color: KOLOR.tekstMuted,
            fontSize: 12.5,
            textDecoration: 'none',
          }}
          title="Wróć do listy obiektów"
        >
          ← Lista
        </a>
        <button
          onClick={() => setOtwarty(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: KOLOR.tekstMuted,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
          }}
          aria-label="Zwiń panel uwag"
        >
          ×
        </button>
      </div>

      <div style={{ padding: '11px 13px', borderBottom: `1px solid ${KOLOR.ramka}` }}>
        <div style={{ color: KOLOR.tekstMuted, fontSize: 12, marginBottom: 7 }}>Werdykt</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {btnWerdykt('bierzemy', 'bierzemy', KOLOR.ok)}
          {btnWerdykt('popraw', 'popraw', KOLOR.popraw)}
          {btnWerdykt('nie', 'nie', KOLOR.nie)}
        </div>
      </div>

      <div style={{ padding: '11px 13px', overflowY: 'auto', flex: 1 }}>
        {zapis.uwagi.length === 0 ? (
          <div style={{ color: KOLOR.tekstMuted, fontSize: 12.5 }}>
            Brak uwag do tego ekranu. Pisz konkretnie — co dokładnie i gdzie.
          </div>
        ) : (
          zapis.uwagi.map((u, i) => (
            <div
              key={i}
              style={{
                background: KOLOR.tloJasne,
                borderRadius: 8,
                padding: '8px 10px',
                marginBottom: 7,
                fontSize: 13,
                lineHeight: 1.45,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <span style={{ color: KOLOR.tekstMuted, fontSize: 11.5, paddingTop: 2 }}>
                {i + 1}.
              </span>
              <span style={{ flex: 1 }}>{u.tekst}</span>
              <button
                onClick={() =>
                  void wyslij({ ...zapis, ekran, uwagi: zapis.uwagi.filter((_, j) => j !== i) })
                }
                title="Usuń tę uwagę"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: KOLOR.tekstMuted,
                  cursor: 'pointer',
                  fontSize: 15,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: '11px 13px', borderTop: `1px solid ${KOLOR.ramka}` }}>
        <textarea
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) dodaj();
          }}
          placeholder={
            zapis.uwagi.length ? 'Dodaj kolejną uwagę…' : 'Co jest nie tak na tym ekranie…'
          }
          rows={3}
          style={{
            width: '100%',
            resize: 'vertical',
            background: KOLOR.tloJasne,
            color: KOLOR.tekst,
            border: `1px solid ${KOLOR.ramka}`,
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
            fontFamily: 'inherit',
            marginBottom: 8,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <button
            onClick={dodaj}
            style={{
              padding: '7px 14px',
              borderRadius: 7,
              border: 'none',
              background: KOLOR.akcent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {zapis.uwagi.length ? 'Dodaj kolejną' : 'Dodaj uwagę'}
          </button>
          <span style={{ color: KOLOR.tekstMuted, fontSize: 11.5 }}>
            {stan ||
              (zapis.uwagi.length
                ? `${zapis.uwagi.length} ${zapis.uwagi.length === 1 ? 'uwaga' : 'uwagi'} · zapisane na dysku`
                : 'Cmd+Enter dodaje')}
          </span>
        </div>
      </div>
    </div>
  );
}
