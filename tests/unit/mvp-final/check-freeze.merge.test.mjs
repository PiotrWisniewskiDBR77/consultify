/**
 * DEC-398 — wyjątek MERGE_HEAD w check-freeze.sh.
 *
 * PO CO: `git merge --no-ff <starsza-gałąź>` wnosi w diffie WSZYSTKIE pliki różniące
 * repo od tamtej gałęzi — także zamrożone moduły — mimo że treść jest już przyjęta na
 * `origin/staging`. Bez wyjątku taki merge żąda znacznika [ODMROZENIE ...] dla każdego
 * dotkniętego modułu, choć commit nie wprowadza żadnej NOWEJ zmiany produktu.
 *
 * Test buduje PRAWDZIWE repo git w katalogu tmp (nie kopię plików) — wyjątek zależy
 * od realnego stanu git (MERGE_HEAD, merge-base, ref origin/staging), więc atrapa
 * plikowa by tego nie zmierzyła. Rejestr zamrożeń jest podmieniony na atrapę przez
 * MVP_FINAL_TEST_REJESTR (env, domyślnie nieaktywny — patrz check-freeze.sh).
 *
 * Trzy przypadki:
 *  1) merge gałęzi będącej przodkiem origin/staging → exit 0, BEZ znacznika.
 *  2) merge gałęzi NIE będącej przodkiem origin/staging → exit != 0, bez znacznika.
 *  3) zwykły (nie-merge) commit dotykający zamrożonego pliku, bez znacznika → exit != 0.
 * Ostatni test to DOWÓD MUTACYJNY: usunięcie warunku --is-ancestor musi zaczerwienić
 * przypadek (2); przywrócenie oryginału musi go znowu zazielenić.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const ZAMROZONY = 'src/components/AIChat/UnifiedChatPanel.tsx';
const REJESTR_REL = 'docs/program/MVP_FINAL_ZAMROZONE.json';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function napiszRejestr(dir) {
  fs.mkdirSync(path.join(dir, path.dirname(REJESTR_REL)), { recursive: true });
  fs.writeFileSync(
    path.join(dir, REJESTR_REL),
    JSON.stringify({ moduly: { '13_CHAT': { pliki: [ZAMROZONY] } }, wspolne: null }, null, 1)
  );
}

/**
 * Buduje repo git z:
 *  - commitem bazowym (baza),
 *  - gałęzią "staging-real" symulującą origin/staging (dostaje jeszcze jeden commit),
 *  - refs/remotes/origin/staging wskazującym na staging-real (bez prawdziwego remote),
 *  - gałęzią "codex-stary" z commitem dotykającym pliku zamrożonego, rozgałęzioną z bazy
 *    PRZED tym jak staging-real dostał swój commit, ale zawierającą DOKŁADNIE tę samą
 *    treść co staging-real (żeby symulować "treść już przyjęta wcześniej").
 * Zwraca ścieżkę repo i pomocnicze SHA.
 */
function zbudujRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-freeze-merge-'));
  git(dir, ['init', '-q', '-b', 'main', '.']);
  git(dir, ['config', 'user.email', 'test@test']);
  git(dir, ['config', 'user.name', 'test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);

  // Skopiuj skrypt pod test (identycznie jak checkFreeze.test.mjs — piaskownica skryptu,
  // ale tu MUSI to być prawdziwe repo git, więc kopiujemy do repo, nie obok niego).
  fs.mkdirSync(path.join(dir, 'scripts/mvp-final'), { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, 'scripts/mvp-final/check-freeze.sh'),
    path.join(dir, 'scripts/mvp-final/check-freeze.sh')
  );
  napiszRejestr(dir);
  fs.writeFileSync(path.join(dir, 'README.md'), 'baza\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'baza']);
  const bazaSha = git(dir, ['rev-parse', 'HEAD']).trim();

  // Gałąź "codex-stary": dotyka pliku zamrożonego, tworzy commit C1.
  git(dir, ['checkout', '-q', '-b', 'codex-stary']);
  fs.mkdirSync(path.join(dir, path.dirname(ZAMROZONY)), { recursive: true });
  fs.writeFileSync(path.join(dir, ZAMROZONY), 'export const X = 1;\n');
  git(dir, ['add', ZAMROZONY]);
  git(dir, ['commit', '-q', '-m', 'feat: dotyka zamrozonego pliku']);
  const c1Sha = git(dir, ['rev-parse', 'HEAD']).trim();

  // "origin/staging" jako ref zdalny: wskazuje na C1 (czyli C1 JEST przodkiem stagingu).
  git(dir, ['update-ref', 'refs/remotes/origin/staging', c1Sha]);

  git(dir, ['checkout', '-q', 'main']);

  return { dir, bazaSha, c1Sha };
}

function uruchomHook(dir) {
  const rejestrPath = path.join(dir, REJESTR_REL);
  return spawnSync('bash', ['scripts/mvp-final/check-freeze.sh', '--komunikat=merge: bez znacznika'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, MVP_FINAL_TEST_REJESTR: rejestrPath },
  });
}

let ctx;
before(() => { ctx = zbudujRepo(); });
after(() => { if (ctx) fs.rmSync(ctx.dir, { recursive: true, force: true }); });

test('PRZYPADEK 1: merge gałęzi będącej przodkiem origin/staging → exit 0 bez markera', () => {
  const { dir, c1Sha } = ctx;
  // main jest wciąż na bazie; merge codex-stary (== C1, przodek origin/staging) do main.
  const merge = spawnSync('git', ['merge', '--no-ff', '--no-edit', 'codex-stary'], { cwd: dir, encoding: 'utf8' });
  assert.equal(merge.status, 0, `merge --no-ff sam w sobie musi się powieść: ${merge.stderr}`);
  assert.ok(fs.existsSync(path.join(dir, '.git/MERGE_HEAD')) === false, 'po udanym merge MERGE_HEAD juz nie istnieje — sprawdzimy zaraz w trakcie');

  // MERGE_HEAD istnieje tylko W TRAKCIE mergowania (przed commitem) — git merge bez
  // konfliktu commituje od razu, więc symulujemy "w trakcie" ręcznie: cofamy commit
  // mergujący, ale zostawiamy MERGE_HEAD tak, jak zostawiłby konflikt.
  git(dir, ['reset', '--soft', 'HEAD@{1}']);
  fs.writeFileSync(path.join(dir, '.git/MERGE_HEAD'), c1Sha + '\n');
  fs.writeFileSync(path.join(dir, '.git/MERGE_MSG'), 'merge: bez znacznika\n');

  const r = uruchomHook(dir);
  assert.equal(r.status, 0, `oczekiwano exit 0, dostano ${r.status}\nstderr: ${r.stderr}\nstdout: ${r.stdout}`);
  assert.match(r.stderr, /DEC-398/);
  assert.match(r.stderr, /origin\/staging/);

  // Sprzątanie stanu merge, żeby kolejne testy widziały czysty main.
  fs.rmSync(path.join(dir, '.git/MERGE_HEAD'), { force: true });
  fs.rmSync(path.join(dir, '.git/MERGE_MSG'), { force: true });
  git(dir, ['reset', '--hard', ctx.bazaSha]);
});

test('PRZYPADEK 2: merge gałęzi NIE będącej przodkiem origin/staging → exit != 0 bez markera', () => {
  const { dir, bazaSha } = ctx;
  git(dir, ['reset', '--hard', bazaSha]);
  // Nowa gałąź z INNĄ zmianą zamrożonego pliku, nigdy nie scalona do origin/staging.
  git(dir, ['checkout', '-q', '-b', 'obca-galaz', bazaSha]);
  fs.mkdirSync(path.join(dir, path.dirname(ZAMROZONY)), { recursive: true });
  fs.writeFileSync(path.join(dir, ZAMROZONY), 'export const X = 999; // inna tresc\n');
  git(dir, ['add', ZAMROZONY]);
  git(dir, ['commit', '-q', '-m', 'feat: inna zmiana zamrozonego pliku, nie na stagingu']);
  const obcaSha = git(dir, ['rev-parse', 'HEAD']).trim();
  git(dir, ['checkout', '-q', 'main']);

  // Symulujemy stan "w trakcie mergowania" (jak w przypadku 1), tym razem z gałęzią,
  // która NIE jest przodkiem refs/remotes/origin/staging.
  fs.writeFileSync(path.join(dir, '.git/MERGE_HEAD'), obcaSha + '\n');
  fs.writeFileSync(path.join(dir, '.git/MERGE_MSG'), 'merge: obca galaz\n');

  // Upewnij się, że plik zamrożony jest w indeksie ze zmienioną treścią (tak jak byłby
  // po prawdziwym mergu z konfliktem rozstrzygniętym na korzyść obcej gałęzi). Katalog
  // jeszcze nie istnieje na main (plik powstał dopiero na obca-galaz).
  fs.mkdirSync(path.join(dir, path.dirname(ZAMROZONY)), { recursive: true });
  fs.writeFileSync(path.join(dir, ZAMROZONY), 'export const X = 999; // inna tresc\n');
  git(dir, ['add', ZAMROZONY]);

  const r = uruchomHook(dir);
  assert.notEqual(r.status, 0, `oczekiwano blokady (obca gałąź nie jest na stagingu), dostano exit ${r.status}\nstdout: ${r.stdout}`);
  assert.match(r.stderr, /COMMIT ZABLOKOWANY/);
  assert.doesNotMatch(r.stderr, /DEC-398/);

  fs.rmSync(path.join(dir, '.git/MERGE_HEAD'), { force: true });
  fs.rmSync(path.join(dir, '.git/MERGE_MSG'), { force: true });
  git(dir, ['reset', '--hard', bazaSha]);
});

test('PRZYPADEK 3: zwykły commit (bez MERGE_HEAD) dotykający modułu bez znacznika → exit != 0', () => {
  const { dir, bazaSha } = ctx;
  git(dir, ['reset', '--hard', bazaSha]);
  assert.ok(!fs.existsSync(path.join(dir, '.git/MERGE_HEAD')), 'test zakłada BRAK MERGE_HEAD — to zwykły commit');
  fs.mkdirSync(path.join(dir, path.dirname(ZAMROZONY)), { recursive: true });
  fs.writeFileSync(path.join(dir, ZAMROZONY), 'export const X = 2; // zwykla zmiana\n');
  git(dir, ['add', ZAMROZONY]);

  const r = uruchomHook(dir);
  assert.notEqual(r.status, 0, 'zwykły commit bez znacznika MUSI być zablokowany, wyjątek merge go nie dotyczy');
  assert.match(r.stderr, /COMMIT ZABLOKOWANY/);
  assert.doesNotMatch(r.stderr, /DEC-398/);

  git(dir, ['reset', '--hard', bazaSha]);
});

test('DOWÓD MUTACYJNY: usunięcie warunku --is-ancestor psuje przypadek 2 (RED), przywrócenie naprawia (GREEN)', () => {
  const { dir, bazaSha, c1Sha } = ctx;
  const sciezkaSkryptu = path.join(dir, 'scripts/mvp-final/check-freeze.sh');
  const oryginal = fs.readFileSync(sciezkaSkryptu, 'utf8');
  assert.match(oryginal, /merge-base --is-ancestor/, 'skrypt w piaskownicy musi zawierać warunek, ktory mutujemy');

  // Odtwórz dokładnie sytuację przypadku 2: obca gałąź NIE będąca przodkiem origin/staging,
  // w trakcie mergowania do main.
  git(dir, ['reset', '--hard', bazaSha]);
  git(dir, ['checkout', '-q', '-b', 'obca-galaz-2', bazaSha]);
  fs.mkdirSync(path.join(dir, path.dirname(ZAMROZONY)), { recursive: true });
  fs.writeFileSync(path.join(dir, ZAMROZONY), 'export const X = 777;\n');
  git(dir, ['add', ZAMROZONY]);
  git(dir, ['commit', '-q', '-m', 'feat: kolejna obca zmiana']);
  const obcaSha = git(dir, ['rev-parse', 'HEAD']).trim();
  git(dir, ['checkout', '-q', 'main']);
  fs.writeFileSync(path.join(dir, '.git/MERGE_HEAD'), obcaSha + '\n');
  fs.mkdirSync(path.join(dir, path.dirname(ZAMROZONY)), { recursive: true });
  fs.writeFileSync(path.join(dir, ZAMROZONY), 'export const X = 777;\n');
  git(dir, ['add', ZAMROZONY]);

  // Mutacja: warunek --is-ancestor zawsze "prawdziwy" (usuwamy go z łańcucha &&).
  const zmutowany = oryginal.replace(
    '&& git merge-base --is-ancestor "$MERGE_HEAD_SHA" refs/remotes/origin/staging 2>/dev/null; then',
    '; then'
  );
  assert.notEqual(zmutowany, oryginal, 'podmiana musi faktycznie zadziałać na treści skryptu');
  fs.writeFileSync(sciezkaSkryptu, zmutowany);

  const zMutacja = uruchomHook(dir);
  assert.equal(
    zMutacja.status, 0,
    'MUTACJA MUSI przejść (RED dla testu = wyjątek działa dla KAŻDEJ gałęzi, nie tylko dla przodka stagingu) — inaczej test nie mierzy zabezpieczenia'
  );
  assert.match(zMutacja.stderr, /DEC-398/, 'zmutowany skrypt fałszywie ogłasza wyjątek DEC-398 dla obcej gałęzi');

  // Przywrócenie oryginału → guard znowu blokuje (GREEN).
  fs.writeFileSync(sciezkaSkryptu, oryginal);
  const poNaprawie = uruchomHook(dir);
  assert.notEqual(poNaprawie.status, 0, 'po przywróceniu oryginału guard MUSI znowu blokować obcą gałąź');
  assert.match(poNaprawie.stderr, /COMMIT ZABLOKOWANY/);

  fs.rmSync(path.join(dir, '.git/MERGE_HEAD'), { force: true });
  git(dir, ['reset', '--hard', bazaSha]);

  // Sanity: c1Sha (prawdziwy przodek origin/staging) wciąż działa jak w przypadku 1,
  // dowodząc że przywrócony oryginał nie jest przeblokowany.
  fs.writeFileSync(path.join(dir, '.git/MERGE_HEAD'), c1Sha + '\n');
  const sanity = uruchomHook(dir);
  assert.equal(sanity.status, 0, 'oryginał po przywróceniu wciąż przepuszcza prawdziwego przodka stagingu');
  fs.rmSync(path.join(dir, '.git/MERGE_HEAD'), { force: true });
});
