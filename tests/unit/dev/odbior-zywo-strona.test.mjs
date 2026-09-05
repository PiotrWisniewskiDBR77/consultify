import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  indeksWynikowZywo,
  indeksZatwierdzonychLight,
  liczZywe,
  stronaZywo,
} from '../../../scripts/dev/lib/odbiorZywo.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
void repoRoot; // nieużywane bezpośrednio, zostaje dla czytelności ścieżek względnych powyżej

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Status.json w miniaturze: dwa moduły, cztery ekrany A/B (jeden C — ma być pominięty). */
function przykladowyStatus() {
  return {
    moduly: [
      {
        katalog: '02-moja-praca',
        nazwa: 'Moja praca',
        opis: 'Opis modułu',
        ekrany: [
          { id: 'ekran-zgodny', nazwa: 'Ekran zgodny', ocena: 'A', co: 'opis ekranu' },
          { id: 'ekran-rozni', nazwa: 'Ekran różniący się', ocena: 'B', co: 'opis ekranu' },
          { id: 'ekran-pominiety', nazwa: 'Ekran C — nie do odbioru', ocena: 'C', co: 'nie pokazujemy' },
        ],
      },
      {
        katalog: '06-inicjatywy',
        nazwa: 'Inicjatywy',
        opis: 'Opis modułu 2',
        ekrany: [
          { id: 'ekran-niedotarlem', nazwa: 'Ekran nie dotarłem', ocena: 'A', co: 'opis' },
          { id: 'ekran-brak-wyniku', nazwa: 'Ekran bez wyniku', ocena: 'B', co: 'opis' },
        ],
      },
    ],
  };
}

test('indeksWynikowZywo: brak katalogu evidence/odbior-zywo-* nie wywala niczego, zwraca pustą mapę', () => {
  const brakujacy = path.join(os.tmpdir(), 'nigdy-nieistniejacy-katalog-' + Date.now());
  assert.deepEqual(indeksWynikowZywo(brakujacy), {});
  assert.deepEqual(indeksWynikowZywo(undefined), {});
});

test('indeksWynikowZywo: scala wyniki.json z wielu katalogów, pomija zepsuty JSON i wpisy bez id', () => {
  const root = tmpDir('zywo-wyniki-');
  const kat1 = path.join(root, '02-moja-praca');
  const kat2 = path.join(root, '06-inicjatywy');
  const katZepsuty = path.join(root, '99-zepsuty');
  fs.mkdirSync(kat1, { recursive: true });
  fs.mkdirSync(kat2, { recursive: true });
  fs.mkdirSync(katZepsuty, { recursive: true });

  fs.writeFileSync(
    path.join(kat1, 'wyniki.json'),
    JSON.stringify([
      { id: 'ekran-zgodny', werdykt: 'ZGODNY', opis: 'bez różnic', trasa: '/my-work', kliki: ['otwórz kartę'], kiedy: '2026-09-05T08:00:00.000Z' },
      { id: 'ekran-rozni', werdykt: 'ROZNI_SIE', opis: 'kolor przycisku inny niż w projekcie', zrzut: 'evidence/odbior-zywo-20260905/02-moja-praca/ekran-rozni.png' },
      { werdykt: 'ZGODNY', opis: 'wpis bez id — ma być pominięty' },
    ])
  );
  fs.writeFileSync(
    path.join(kat2, 'wyniki.json'),
    JSON.stringify([{ id: 'ekran-niedotarlem', werdykt: 'NIE_DOTARLEM', opis: 'ekran 404 na trasie' }])
  );
  fs.writeFileSync(path.join(katZepsuty, 'wyniki.json'), '{ to nie jest poprawny json');

  const wyniki = indeksWynikowZywo(root);
  assert.equal(Object.keys(wyniki).length, 3);
  assert.equal(wyniki['ekran-zgodny'].werdykt, 'ZGODNY');
  assert.equal(wyniki['ekran-rozni'].werdykt, 'ROZNI_SIE');
  assert.equal(wyniki['ekran-niedotarlem'].werdykt, 'NIE_DOTARLEM');
  assert.equal(wyniki['ekran-brak-wyniku'], undefined);

  fs.rmSync(root, { recursive: true, force: true });
});

test('indeksZatwierdzonychLight: wybiera najnowszy plik *light*.png per id, ignoruje dark i inne id', async () => {
  const evid = tmpDir('grafika-');
  const modDir = path.join(evid, '02-moja-praca');
  fs.mkdirSync(modDir, { recursive: true });

  const stary = path.join(modDir, 'ekran-zgodny__PRZED__light.png');
  const nowy = path.join(modDir, 'ekran-zgodny__PO__light.png');
  const ciemny = path.join(modDir, 'ekran-zgodny__PO__dark.png');
  fs.writeFileSync(stary, 'stary-png');
  await new Promise((r) => setTimeout(r, 5));
  fs.writeFileSync(nowy, 'nowy-png');
  fs.writeFileSync(ciemny, 'ciemny-png');

  const idx = indeksZatwierdzonychLight(evid);
  assert.equal(Object.keys(idx).length, 1);
  assert.equal(idx['ekran-zgodny'].pelna, nowy);

  fs.rmSync(evid, { recursive: true, force: true });
});

test('liczZywe: liczy ZGODNY/ROZNI_SIE/NIE_DOTARLEM/BRAK po ekranach A/B', () => {
  const status = przykladowyStatus();
  const ekranyAB = status.moduly.flatMap((m) => m.ekrany.filter((e) => e.ocena === 'A' || e.ocena === 'B'));
  assert.equal(ekranyAB.length, 4); // ekran-pominiety (C) nie wchodzi

  const wyniki = {
    'ekran-zgodny': { werdykt: 'ZGODNY' },
    'ekran-rozni': { werdykt: 'ROZNI_SIE' },
    'ekran-niedotarlem': { werdykt: 'NIE_DOTARLEM' },
  };
  const n = liczZywe(ekranyAB, wyniki);
  assert.equal(n.razem, 4);
  assert.equal(n.ZGODNY, 1);
  assert.equal(n.ROZNI_SIE, 1);
  assert.equal(n.NIE_DOTARLEM, 1);
  assert.equal(n.BRAK, 1); // ekran-brak-wyniku
});

test('stronaZywo: katalog evidence/odbior-zywo-* jeszcze nie istnieje — strona buduje się bez wyjątku, wszystko BRAK WYNIKU', () => {
  const status = przykladowyStatus();
  const evidenceRoot = tmpDir('evidence-puste-');
  const zywoDir = path.join(evidenceRoot, 'odbior-zywo-20260905'); // celowo nie tworzymy tego katalogu

  const html = stronaZywo({ status, zywoDir, evidenceRoot, decyzjeGlowne: {}, decyzjeZywo: {} });

  assert.ok(html.includes('<!doctype html>'));
  assert.ok(html.includes('Na żywo 05.09'));
  // 4 ekrany A/B, zero wyników → wszystkie liczniki werdyktów na zero, 4 w "brak"
  assert.match(html, /<b>4<\/b> ekranów A\/B/);
  assert.match(html, /<b>0<\/b> zgodny/);
  assert.match(html, /<b>0<\/b> różni się/);
  assert.match(html, /<b>0<\/b> nie dotarłem/);
  assert.match(html, /<b>4<\/b> brak wyniku/);
  assert.ok(html.includes('BRAK WYNIKU (jeszcze nie sprawdzony)'));
  assert.ok(html.includes('brak obrazu')); // ani zatwierdzony, ani na-żywo obraz nie istnieje

  fs.rmSync(evidenceRoot, { recursive: true, force: true });
});

test('stronaZywo: liczniki i etykiety werdyktów odpowiadają danym z wyniki.json, obrazy się linkują', () => {
  const status = przykladowyStatus();
  const evidenceRoot = tmpDir('evidence-pelne-');
  const grafikaDir = path.join(evidenceRoot, 'grafika', '02-moja-praca');
  const zywoDir = path.join(evidenceRoot, 'odbior-zywo-20260905', '02-moja-praca');
  fs.mkdirSync(grafikaDir, { recursive: true });
  fs.mkdirSync(zywoDir, { recursive: true });

  // Obraz zatwierdzony (jasny) dla ekran-zgodny i ekran-rozni.
  fs.writeFileSync(path.join(grafikaDir, 'ekran-zgodny__PO__light.png'), 'zatw-zgodny');
  fs.writeFileSync(path.join(grafikaDir, 'ekran-rozni__PO__light.png'), 'zatw-rozni');

  // Zrzut "na żywo" — ścieżka względem korzenia repo, tak jak specyfikują dane wejściowe.
  const zrzutRozni = 'evidence/odbior-zywo-20260905/02-moja-praca/ekran-rozni.png';
  fs.writeFileSync(path.join(evidenceRoot, 'odbior-zywo-20260905', '02-moja-praca', 'ekran-rozni.png'), 'zywy-rozni');

  fs.writeFileSync(
    path.join(zywoDir, 'wyniki.json'),
    JSON.stringify([
      { id: 'ekran-zgodny', werdykt: 'ZGODNY', opis: 'identyczne', kiedy: '2026-09-05T08:00:00.000Z' },
      { id: 'ekran-rozni', werdykt: 'ROZNI_SIE', opis: 'przycisk inny kolor', zrzut: zrzutRozni, trasa: '/my-work?x=1', kliki: ['klik a', 'klik b'] },
      { id: 'ekran-niedotarlem', werdykt: 'NIE_DOTARLEM', opis: 'trasa zwraca 404' },
    ])
  );

  const html = stronaZywo({
    status,
    zywoDir: path.join(evidenceRoot, 'odbior-zywo-20260905'),
    evidenceRoot,
    decyzjeGlowne: { 'ekran-rozni': { decyzja: 'poprawka', uwaga: 'poprawić kolor przycisku', kiedy: '2026-09-01T00:00:00.000Z' } },
    decyzjeZywo: {},
  });

  assert.match(html, /<b>4<\/b> ekranów A\/B/);
  assert.match(html, /<b>1<\/b> zgodny/);
  assert.match(html, /<b>1<\/b> różni się/);
  assert.match(html, /<b>1<\/b> nie dotarłem/);
  assert.match(html, /<b>1<\/b> brak wyniku/); // ekran-brak-wyniku

  assert.ok(html.includes('>ZGODNY<'));
  assert.ok(html.includes('RÓŻNI SIĘ'));
  assert.ok(html.includes('NIE DOTARŁEM'));
  assert.ok(html.includes('BRAK WYNIKU (jeszcze nie sprawdzony)'));

  assert.ok(html.includes('przycisk inny kolor'));
  assert.ok(html.includes('poprawić kolor przycisku')); // uwaga właściciela z ODBIOR_DECYZJE.json
  assert.ok(html.includes('/ev/grafika/02-moja-praca/ekran-rozni__PO__light.png')); // obraz zatwierdzony
  assert.ok(html.includes('/ev/odbior-zywo-20260905/02-moja-praca/ekran-rozni.png')); // obraz na żywo
  assert.ok(html.includes('/my-work?x=1'));
  assert.ok(html.includes('klik a') && html.includes('klik b'));

  // Ekran C (ocena !== A/B) nigdy nie ląduje na stronie /zywo.
  assert.ok(!html.includes('Ekran C — nie do odbioru'));

  fs.rmSync(evidenceRoot, { recursive: true, force: true });
});
