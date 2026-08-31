/**
 * Dev-render host — MACIERZ DWUWYMIAROWA obszary × poziomy dla jednej osi DRD.
 *
 * PO CO: właściciel opisał docelową prezentację jako „siedem macierzy
 * dwuwymiarowych, gdzie na dole mamy osie, a w linii Y mamy poziomy". Jedynym
 * komponentem w repo, który faktycznie rysuje SIATKĘ (kolumny = obszary,
 * wiersze = poziomy dojrzałości, komórka = czy poziom osiągnięty/docelowy),
 * jest `src/components/Reports/AreaMatrixTable.tsx`. Komponent jest MARTWY:
 * jedynym jego wołaczem jest `AxisReportSection`, a ten ma wyłącznie
 * re-eksport w `src/components/Reports/index.ts` — tego barrela nie importuje
 * NIKT (sprawdzone grepem po `src/`, `server/src/`, `dev-render/`).
 *
 * Ten ekran montuje REALNY `AreaMatrixTable` (nie atrapę) i karmi go danymi z
 * jedynego źródła prawdy `src/services/drdStructure.ts`:
 *   - kolumny  = `axis.areas` (oś 1 → 9 obszarów 1A..1I, osie 2..7 → po 5),
 *   - wiersze  = poziomy 1..`axis.levelCount` (7·5·5·7·6·6·5), malejąco,
 *   - oceny    = mock (poniżej), zróżnicowane, żeby było widać wzór dojrzałości.
 *
 * UWAGA — komponent DOMYŚLNIE ma zaszyte na sztywno 9 obszarów funkcyjnych i 7
 * poziomów, więc bez podania propsów `areas`/`levels` rysowałby tę samą siatkę
 * dla każdej z 7 osi (dla osi 2,3,7 pokazałby 2 nieistniejące wiersze, dla
 * 5 i 6 — jeden, i zawsze 9 zamiast 5 kolumn). Propsy `areas`/`levels` są
 * opcjonalne i domyślnie równe starym stałym, więc zachowanie dotychczasowych
 * (martwych) wołaczy jest niezmienione.
 *
 * NIC nie jest tu wpinane do produktu: żadnej trasy, żadnej flagi. Ekran służy
 * wyłącznie do pokazania obrazu właścicielowi (CLAUDE.md #7).
 *
 * URL: ?screen=drd-macierz-obszary-poziomy&os=1..7&theme=light|dark&lang=pl
 */
import React from 'react';

import type { AreaAssessment, MatrixLevelDef } from '@/components/Reports/AreaMatrixTable';
import { AreaMatrixTable } from '@/components/Reports/AreaMatrixTable';
import { DRD_STRUCTURE, getAxisById } from '@/services/drdStructure';

/**
 * Rampa kolorów poziomów 1..7 skopiowana 1:1 z `MATURITY_LEVELS` w komponencie
 * (od najniższego do najwyższego). Dla osi o 5 lub 6 poziomach rozciągamy tę
 * samą rampę na dostępny zakres, żeby najniższy poziom był zawsze „zimny",
 * a najwyższy „gorący" niezależnie od liczby wierszy.
 */
const RAMPA = ['#f43f5e', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#ec4899'];

function kolorPoziomu(poziom: number, ile: number): string {
  if (ile <= 1) return RAMPA[0];
  const idx = Math.round(((poziom - 1) / (ile - 1)) * (RAMPA.length - 1));
  return RAMPA[Math.min(RAMPA.length - 1, Math.max(0, idx))];
}

/**
 * Mock ocen: [poziom obecny, poziom docelowy] per obszar. Dobrane tak, żeby
 * na obrazie było widać wzór dojrzałości (mocne i słabe obszary), a nie same
 * zera — i żeby żadna wartość nie wychodziła poza `levelCount` swojej osi.
 */
const OCENY: Record<string, [number, number]> = {
  // Oś 1 — Procesy Cyfrowe (7 poziomów, 9 obszarów)
  '1A': [4, 6],
  '1B': [3, 6],
  '1C': [2, 5],
  '1D': [3, 4],
  '1E': [5, 6],
  '1F': [5, 7],
  '1G': [2, 5],
  '1H': [6, 7],
  '1I': [1, 4],
  // Oś 2 — Produkty Cyfrowe (5 poziomów)
  '2A': [3, 5],
  '2B': [1, 3],
  '2C': [4, 5],
  '2D': [2, 4],
  '2E': [2, 5],
  // Oś 3 — Cyfrowe Modele Biznesowe (5 poziomów)
  '3A': [4, 5],
  '3B': [2, 4],
  '3C': [1, 4],
  '3D': [1, 2],
  '3E': [2, 5],
  // Oś 4 — Zarządzanie Danymi (7 poziomów)
  '4A': [5, 6],
  '4B': [4, 6],
  '4C': [3, 5],
  '4D': [2, 5],
  '4E': [3, 7],
  // Oś 5 — Kultura Transformacji (6 poziomów)
  '5A': [4, 6],
  '5B': [3, 5],
  '5C': [2, 5],
  '5D': [3, 6],
  '5E': [5, 6],
  // Oś 6 — Cyberbezpieczeństwo (6 poziomów)
  '6A': [3, 6],
  '6B': [5, 6],
  '6C': [4, 6],
  '6D': [2, 5],
  '6E': [1, 4],
  // Oś 7 — Dojrzałość AI (5 poziomów)
  '7A': [2, 4],
  '7B': [1, 4],
  '7C': [1, 3],
  '7D': [2, 5],
  '7E': [3, 5],
};

export default function DrdMacierzObszaryPoziomyScreen() {
  const params = new URLSearchParams(window.location.search);
  const zadana = Number(params.get('os') || '1');
  const osId = Number.isFinite(zadana) && zadana >= 1 && zadana <= 7 ? zadana : 1;
  const jezyk = (params.get('lang') || 'pl') === 'en' ? 'en' : 'pl';

  const os = getAxisById(osId);
  if (!os) return <div className="p-8">Brak osi {osId} w DRD_STRUCTURE.</div>;

  // Kolumny = obszary tej osi, prosto ze źródła prawdy (bez ikon — SSOT ich
  // nie ma; komponent renderuje ikonę tylko gdy jest podana).
  const obszary = os.areas.map((a) => ({
    id: a.id,
    name: `${a.id} · ${a.name}`,
    namePl: `${a.id} · ${a.namePL || a.name}`,
  }));

  // Wiersze = poziomy 1..levelCount, malejąco (najwyższy u góry). Nazwy
  // poziomów bierzemy z pierwszego obszaru osi — wszystkie obszary jednej osi
  // dzielą tę samą drabinę (tak samo robi `drdMaturityLevels.ts`).
  const drabina = os.areas[0]?.levels || [];
  const poziomy: MatrixLevelDef[] = Array.from({ length: os.levelCount }, (_, i) => {
    const nr = os.levelCount - i; // malejąco
    const wpis = drabina.find((l) => l.level === nr);
    const nazwa = wpis?.title || `Poziom ${nr}`;
    return { level: nr, name: nazwa, namePl: nazwa, color: kolorPoziomu(nr, os.levelCount) };
  });

  const oceny: AreaAssessment[] = os.areas.map((a) => {
    const [currentLevel, targetLevel] = OCENY[a.id] || [0, 0];
    return { areaId: a.id, currentLevel, targetLevel };
  });

  return (
    <div className="min-h-screen bg-c-bg text-c-text p-6">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-c-text-muted">
          Prototyp do obejrzenia · harness dev-render · nic nie wpięte w produkt
        </div>
        <h1 className="text-lg font-semibold">
          Macierz obszary × poziomy — oś {os.id}. {os.namePL || os.name}
        </h1>
        <p className="text-xs text-c-text-secondary mt-0.5">
          {os.areas.length} obszarów (kolumny) × {os.levelCount} poziomów (wiersze) — źródło:
          src/services/drdStructure.ts. Przełącznik osi: parametr adresu <code>&amp;os=1..7</code>.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {DRD_STRUCTURE.map((a) => (
            <a
              key={a.id}
              href={`?screen=drd-macierz-obszary-poziomy&os=${a.id}&lang=${jezyk}&theme=${params.get('theme') || 'light'}`}
              className={`px-2.5 py-1 rounded-md text-[11px] border ${
                a.id === os.id
                  ? 'bg-c-surface-raised border-c-border-strong text-c-text font-medium'
                  : 'bg-c-surface border-c-border text-c-text-secondary'
              }`}
            >
              {a.id}. {a.namePL || a.name} ({a.areas.length}×{a.levelCount})
            </a>
          ))}
        </div>
      </div>

      <AreaMatrixTable
        axisId={String(os.id)}
        axisName={os.namePL || os.name}
        axisIcon=""
        areaAssessments={oceny}
        areas={obszary}
        levels={poziomy}
        language={jezyk}
        showAnimation={false}
      />
    </div>
  );
}
