/**
 * P-T14 (fala D3, 2026-09-14) — dwa ostatnie podpunkty wiersza P-T14
 * (`docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md:351`):
 * „nazwa nie synchronizuje paneli" i „zakładka «próba 1» przenosi na inną kartę".
 *
 * DLACZEGO TEST KONTRAKTU ŹRÓDŁA, A NIE RENDERU: `MyWorkHub.tsx` to ~4,5 tys.
 * linii z kilkunastoma leniwymi dziećmi i własnym magazynem dokumentów w
 * localStorage; w tym repozytorium NIE MA ani jednego testu, który by go
 * montował — wszystkie siostrzane pliki (`MyWorkHub.ideaTabs.ownerContract`,
 * `MyWorkHub.menu3PanelControls`, `MyWorkHub.photo003.contract`, …) pilnują go
 * właśnie kontraktem źródła. Trzymam się tej konwencji ŚWIADOMIE i mówię
 * wprost, ile ten test waży: pilnuje MECHANIZMU (że przewód jest podłączony
 * tam, gdzie go brakowało), nie obrazu. Dowód obrazem jest osobno, w zrzucie
 * realnej powłoki.
 *
 * PREMISY ZMIERZONE na 08c1bb7a26 (obie potwierdzone, obie naprawione):
 *
 * (a) `handleIdeaTabRename` aktualizował WYŁĄCZNIE `openDocuments`. Lista
 *     Pomysłów (`MyIdeasListContent`) dociąga dane na zmianę propa
 *     `refreshTrigger`, a jedyne miejsce, które go podbijało
 *     (`handleDocumentSaved`), nie leży na ścieżce zmiany nazwy z zakładki.
 *     Warsztat (`IdeaMapWorkspace`) trzyma własny `title` w stanie lokalnym,
 *     zasiewany RAZ przy wczytaniu, a `key` montowania to
 *     `idea-workspace-${id}` — przy zmianie nazwy id się nie zmienia, więc nie
 *     ma przemontowania. Defekt był ASYMETRYCZNY: warsztat → zakładka+lista
 *     synchronizowało się, zakładka → lista i warsztat NIE.
 *
 * (b) `hubDocs` to CAŁE `openDocuments`, bez filtra po typie dokumentu, więc
 *     na zakładce Pomysły wisiały też karty zadań/decyzji/powiadomień. Klik w
 *     zakładkę ustawiał WYŁĄCZNIE `activeDocumentId`, bez `setActiveTab`, a
 *     `renderDocumentContent` rysuje kartę wg `activeDoc.type` — użytkownik
 *     lądował na karcie innego rodzaju, mając w Menu 1/2 dalej „Pomysły".
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const hubSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/MyWork/MyWorkHub.tsx'),
  'utf8'
);
const workspaceSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/MyWork/IdeaMapWorkspace.tsx'),
  'utf8'
);

function sliceBetween(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  expect(start, `nie znalazłem kotwicy "${from}"`).toBeGreaterThan(-1);
  const end = source.indexOf(to, start);
  expect(end, `nie znalazłem kotwicy "${to}"`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('P-T14 (a) — zmiana nazwy na zakładce synchronizuje listę i warsztat', () => {
  it('handleIdeaTabRename podbija refreshTrigger, więc lista Pomysłów dociąga nową nazwę', () => {
    const handler = sliceBetween(
      hubSource,
      'const handleIdeaTabRename',
      '// Count update handlers'
    );
    // Stan zastany: sam `setOpenDocuments` i koniec.
    expect(handler).toContain('setOpenDocuments(');
    // Naprawa: lista dostaje sygnał do ponownego odczytu.
    expect(handler).toContain('setRefreshTrigger(');
  });

  it('lista Pomysłów faktycznie KONSUMUJE refreshTrigger (przewód, nie samo istnienie zmiennej)', () => {
    const listMount = sliceBetween(hubSource, '<MyIdeasListContent', '/>');
    expect(listMount).toContain('refreshTrigger={refreshTrigger}');
  });

  it('warsztat dostaje nazwę z zewnątrz propem externalTitle — bez przemontowania', () => {
    const workspaceMount = sliceBetween(hubSource, '<IdeaMapWorkspace', '</React.Suspense>');
    expect(workspaceMount).toContain('externalTitle={activeDoc.name}');
    // `key` po SAMYM id — dopisanie tytułu do klucza przemontowałoby warsztat
    // i skasowało stan płótna; ten test pilnuje, żeby nikt tak nie "naprawił".
    expect(workspaceMount).toContain('key={`idea-workspace-${activeDoc.id}`}');
    expect(workspaceMount).not.toContain('idea-workspace-${activeDoc.id}-${activeDoc.name}');
  });

  it('IdeaMapWorkspace przyjmuje externalTitle i wpisuje go do własnego tytułu', () => {
    expect(workspaceSource).toContain('externalTitle?: string;');
    const effect = sliceBetween(
      workspaceSource,
      "const [title, setTitle] = useState('');",
      '}, [externalTitle]);'
    );
    expect(effect).toContain('setTitle(');
    // Pusta wartość NIE MOŻE wyczyścić tytułu wczytanego z serwera.
    expect(effect).toContain('if (!next) return;');
  });
});

describe('P-T14 (b) — klik w zakładkę nie przenosi na obcą kartę bez zmiany nagłówka', () => {
  it('klik ustawia zakładkę modułu zgodnie z typem dokumentu, nie tylko activeDocumentId', () => {
    const onClick = sliceBetween(
      hubSource,
      'onClick={() => {',
      'onDoubleClick={renameControls?.onDoubleClick}'
    );
    expect(onClick).toContain('getDocumentTab(doc.type)');
    expect(onClick).toContain('setActiveTab(');
    expect(onClick).toContain('setActiveDocumentId(doc.id)');
    // Przełączenie ma być oznaczone jako programowe — inaczej efekt
    // synchronizujący adres URL potraktowałby je jak ruch użytkownika.
    expect(onClick).toContain('programmaticTabSwitchRef.current = true');
  });

  it('nie przełącza zakładki, gdy dokument należy do bieżącej (zero zbędnych przerysowań)', () => {
    const onClick = sliceBetween(
      hubSource,
      'onClick={() => {',
      'onDoubleClick={renameControls?.onDoubleClick}'
    );
    expect(onClick).toContain('if (docTab !== activeTab)');
  });

  it('nawigacja klawiaturą po zakładkach dalej istnieje (nie zepsuta przy okazji)', () => {
    expect(hubSource).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
  });
});
