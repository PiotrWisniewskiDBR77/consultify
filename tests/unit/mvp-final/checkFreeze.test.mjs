/**
 * MVP FINAL — bezpiecznik zamrożenia.
 *
 * Test celuje w SAMO ZABEZPIECZENIE, nie w mechanizm dookoła: jeśli ktoś wytnie
 * porównanie staged×rejestr albo warunek znacznika, testy MUSZĄ zczerwienić.
 * Dowód mutacyjny robimy w osobnym worktree na kopii skryptu (test „psuje" kopię,
 * nie repo) — patrz ostatni test.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
let wt;

const REJESTR = 'docs/program/MVP_FINAL_ZAMROZONE.json';
const ZAMROZONY = 'src/components/AIChat/UnifiedChatPanel.tsx';
const WOLNY = 'src/views/SettingsView.tsx';

function git(a, cwd = repoRoot) { return execFileSync('git', a, { cwd, encoding: 'utf8' }).trim(); }
function uruchom(argv, cwd = wt) {
  return spawnSync('bash', ['scripts/mvp-final/check-freeze.sh', ...argv], { cwd, encoding: 'utf8' });
}
function ustawRejestr(obj, cwd = wt) {
  fs.mkdirSync(path.join(cwd, path.dirname(REJESTR)), { recursive: true });
  fs.writeFileSync(path.join(cwd, REJESTR), JSON.stringify(obj, null, 1));
}

before(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mvp-final-wt-'));
  fs.rmSync(dir, { recursive: true, force: true });
  git(['worktree', 'add', '--detach', dir, 'HEAD']);
  wt = dir;
});
after(() => { if (wt) { try { git(['worktree', 'remove', '--force', wt]); } catch {} } });

test('brak rejestru = przepuszcza, ale mówi to wprost (cisza nie udaje zieleni)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mvp-final-pusty-'));
  fs.mkdirSync(path.join(dir, 'scripts/mvp-final'), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'scripts/mvp-final/check-freeze.sh'), path.join(dir, 'scripts/mvp-final/check-freeze.sh'));
  const r = uruchom(['--pliki', ZAMROZONY, '--komunikat=cokolwiek'], dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /żaden moduł nie jest jeszcze zamrożony/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('rejestr pusty (moduly: {}) = nic nie blokuje', () => {
  ustawRejestr({ moduly: {}, wspolne: null });
  const r = uruchom(['--pliki', ZAMROZONY, '--komunikat=fix: cos']);
  assert.equal(r.status, 0);
});

test('commit dotykający ZAMROŻONEGO pliku BEZ znacznika = kod wyjścia 1', () => {
  ustawRejestr({ moduly: { '13_CHAT': { pliki: [ZAMROZONY] } }, wspolne: null });
  const r = uruchom(['--pliki', ZAMROZONY, '--komunikat=fix(czat): drobiazg']);
  assert.equal(r.status, 1, 'bezpiecznik MUSI zablokować');
  assert.match(r.stderr, /COMMIT ZABLOKOWANY/);
  assert.match(r.stderr, /13_CHAT/);
  assert.match(r.stderr, /ODMROZENIE 13_CHAT DEC-/);
});

test('ten sam commit ZE znacznikiem = kod wyjścia 0', () => {
  ustawRejestr({ moduly: { '13_CHAT': { pliki: [ZAMROZONY] } }, wspolne: null });
  const r = uruchom(['--pliki', ZAMROZONY, '--komunikat=fix(czat): drobiazg [ODMROZENIE 13_CHAT DEC-318]']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /świadomy znacznik odmrożenia/);
});

test('znacznik dla INNEGO modułu nie odmraża tego modułu', () => {
  ustawRejestr({ moduly: { '13_CHAT': { pliki: [ZAMROZONY] } }, wspolne: null });
  const r = uruchom(['--pliki', ZAMROZONY, '--komunikat=fix: x [ODMROZENIE 14_ADMIN DEC-318]']);
  assert.equal(r.status, 1, 'znacznik cudzego modułu nie może przepuszczać');
});

test('znacznik bez numeru DEC- nie odmraża', () => {
  ustawRejestr({ moduly: { '13_CHAT': { pliki: [ZAMROZONY] } }, wspolne: null });
  const r = uruchom(['--pliki', ZAMROZONY, '--komunikat=fix: x [ODMROZENIE 13_CHAT]']);
  assert.equal(r.status, 1);
});

test('dwa zamrożone moduły w jednym commicie wymagają DWÓCH znaczników', () => {
  ustawRejestr({ moduly: { '13_CHAT': { pliki: [ZAMROZONY] }, '15_SETTINGS': { pliki: [WOLNY] } }, wspolne: null });
  const jeden = uruchom(['--pliki', ZAMROZONY, WOLNY, '--komunikat=x [ODMROZENIE 13_CHAT DEC-1]']);
  assert.equal(jeden.status, 1);
  assert.match(jeden.stderr, /15_SETTINGS/);
  const oba = uruchom(['--pliki', ZAMROZONY, WOLNY, '--komunikat=x [ODMROZENIE 13_CHAT DEC-1] [ODMROZENIE 15_SETTINGS DEC-2]']);
  assert.equal(oba.status, 0);
});

test('lista WSPOLNE też blokuje (kanon UI jest zamrażany osobno)', () => {
  ustawRejestr({ moduly: {}, wspolne: { pliki: ['src/components/standard/StandardTable.tsx'] } });
  const bez = uruchom(['--pliki', 'src/components/standard/StandardTable.tsx', '--komunikat=fix: x']);
  assert.equal(bez.status, 1);
  assert.match(bez.stderr, /WSPOLNE/);
  const ze = uruchom(['--pliki', 'src/components/standard/StandardTable.tsx', '--komunikat=fix: x [ODMROZENIE WSPOLNE DEC-7]']);
  assert.equal(ze.status, 0);
});

test('plik spoza zamrożenia przechodzi bez znacznika', () => {
  ustawRejestr({ moduly: { '13_CHAT': { pliki: [ZAMROZONY] } }, wspolne: null });
  const r = uruchom(['--pliki', WOLNY, '--komunikat=fix: cos']);
  assert.equal(r.status, 0);
});

test('tryb --tylko-ostrzez nigdy nie blokuje, ale wypisuje ostrzeżenie', () => {
  ustawRejestr({ moduly: { '13_CHAT': { pliki: [ZAMROZONY] } }, wspolne: null });
  const r = uruchom(['--tylko-ostrzez', '--pliki', ZAMROZONY, '--komunikat=fix: cos']);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /rusza pliki ZAMROŻONE/);
});

test('DOWÓD MUTACYJNY: wycięcie porównania staged×rejestr = test przestaje łapać', () => {
  ustawRejestr({ moduly: { '13_CHAT': { pliki: [ZAMROZONY] } }, wspolne: null });
  const sciezka = path.join(wt, 'scripts/mvp-final/check-freeze.sh');
  const oryginal = fs.readFileSync(sciezka, 'utf8');

  // Mutacja 1: guard przestaje widzieć trafienia (jak gdyby przecięcie zwracało pustkę).
  fs.writeFileSync(sciezka, oryginal.replace('if (mapa.has(p)) console.log', 'if (false && mapa.has(p)) console.log'));
  const zMutacja = uruchom(['--pliki', ZAMROZONY, '--komunikat=fix: cos']);
  assert.equal(zMutacja.status, 0, 'MUTACJA MUSI przejść — inaczej test nie mierzy zabezpieczenia');

  // Mutacja 2: warunek znacznika zawsze prawdziwy.
  fs.writeFileSync(sciezka, oryginal.replace(
    'if ! printf \'%s\' "$KOMUNIKAT" | grep -Eq',
    'if false && ! printf \'%s\' "$KOMUNIKAT" | grep -Eq'
  ));
  const zMutacja2 = uruchom(['--pliki', ZAMROZONY, '--komunikat=fix: cos']);
  assert.equal(zMutacja2.status, 0, 'MUTACJA 2 MUSI przejść');

  // Przywrócenie: bezpiecznik znowu blokuje.
  fs.writeFileSync(sciezka, oryginal);
  const poNaprawie = uruchom(['--pliki', ZAMROZONY, '--komunikat=fix: cos']);
  assert.equal(poNaprawie.status, 1, 'po przywróceniu guard MUSI znowu blokować');
});
