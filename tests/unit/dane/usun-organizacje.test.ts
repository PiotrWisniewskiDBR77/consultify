/**
 * Testy skryptu `scripts/dane/usun-organizacje.ts` — WYŁĄCZNIE części czyste,
 * bez połączenia z bazą. Każdy test broni jednego bezpiecznika, którego złamanie
 * kończy się skasowaniem prawdziwych danych.
 *
 * Uruchomienie:
 *   npx vitest run tests/unit/dane/usun-organizacje.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  parsujListe,
  parsujCli,
  sprawdzCel,
  sprawdzKolizjeZZachowanymi,
  wymagajForcePurge,
  HOSTY_ZDALNE_DOZWOLONE,
} from '../../../scripts/dane/usun-organizacje';

describe('parsujListe — czyta identyfikator i NIC WIĘCEJ', () => {
  it('bierze wyłącznie pierwszą kolumnę, ignoruje nazwę i komentarze', () => {
    const tekst = [
      '# komentarz',
      '',
      'demo-org | Demo Organization | 1061 | worek',
      'atelier-klon | Atelier Toys | 18 | klon-sesyjny',
      '   ',
      '6c3290eb-0f17-43f3-9906-41f3922e423c | Consultify | 1 | test',
    ].join('\n');
    expect(parsujListe(tekst)).toEqual([
      'demo-org',
      'atelier-klon',
      '6c3290eb-0f17-43f3-9906-41f3922e423c',
    ]);
  });

  it('działa też na liście bez kolumn opisowych', () => {
    expect(parsujListe('a\nb\n')).toEqual(['a', 'b']);
  });

  it('odrzuca duplikat identyfikatora', () => {
    expect(() => parsujListe('a | X\na | Y')).toThrow(/powtarza/);
  });

  it('odrzuca identyfikator z białym znakiem — separatorem jest „|", nie spacja', () => {
    expect(() => parsujListe('Demo Organization | opis')).toThrow(/biały znak/);
  });

  it('odrzuca pustą listę — pusta lista to błąd wejścia, nie „nic do roboty"', () => {
    expect(() => parsujListe('# tylko komentarze\n\n')).toThrow(/pusta/);
  });
});

describe('sprawdzKolizjeZZachowanymi — ostatnia bariera przed skasowaniem DBR77', () => {
  const zachowane = ['a3e05d4a-5397-419d-b486-8e44366c0063', 'atelier', 'system'];

  it('przepuszcza listę rozłączną z listą zachowaną', () => {
    expect(() => sprawdzKolizjeZZachowanymi(['demo-org', 'e2e-1'], zachowane)).not.toThrow();
  });

  it('ODMAWIA, gdy na liście do usunięcia jest DBR77', () => {
    expect(() =>
      sprawdzKolizjeZZachowanymi(['demo-org', 'a3e05d4a-5397-419d-b486-8e44366c0063'], zachowane)
    ).toThrow(/ODMOWA/);
  });

  it('ODMOWA wymienia każdy kolidujący identyfikator z nazwy', () => {
    let blad = '';
    try {
      sprawdzKolizjeZZachowanymi(['atelier', 'system'], zachowane);
    } catch (e) {
      blad = (e as Error).message;
    }
    expect(blad).toContain('atelier');
    expect(blad).toContain('system');
  });
});

describe('sprawdzCel — guard hosta', () => {
  const lokalny = 'postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_d0';

  it('przepuszcza host lokalny z pasującą deklaracją', () => {
    expect(sprawdzCel(lokalny, '127.0.0.1', {})).toBe('127.0.0.1:54418/consultify_kopia_d0');
  });

  it('odmawia, gdy deklaracja --oczekiwany-host nie pasuje do hosta', () => {
    expect(() => sprawdzCel(lokalny, 'trolley', {})).toThrow(/NIE pasuje do deklaracji/);
  });

  it('odmawia bez deklaracji --oczekiwany-host', () => {
    expect(() => sprawdzCel(lokalny, '', {})).toThrow(/oczekiwany-host/);
  });

  it('odmawia hosta zdalnego bez ALLOW_REMOTE_PURGE', () => {
    const url = `postgresql://u:p@${HOSTY_ZDALNE_DOZWOLONE[0]}:1234/railway`;
    expect(() => sprawdzCel(url, 'thomas', {})).toThrow(/ALLOW_REMOTE_PURGE/);
  });

  it('odmawia hosta zdalnego spoza jawnej listy, nawet z ALLOW_REMOTE_PURGE=1', () => {
    const url = 'postgresql://u:p@obcy.example.com:5432/railway';
    expect(() => sprawdzCel(url, 'obcy', { ALLOW_REMOTE_PURGE: '1' })).toThrow(/jawnej liście/);
  });

  it('przepuszcza host zdalny z listy przy ALLOW_REMOTE_PURGE=1', () => {
    const url = `postgresql://u:p@${HOSTY_ZDALNE_DOZWOLONE[0]}:1234/railway`;
    expect(sprawdzCel(url, 'thomas', { ALLOW_REMOTE_PURGE: '1' })).toContain('railway');
  });

  it('ODMAWIA PRODUKCJI bezwarunkowo — żadna zmienna tego nie odblokowuje', () => {
    const prod = 'postgresql://u:p@centerbeam.proxy.rlwy.net:5432/railway';
    expect(() =>
      sprawdzCel(prod, 'centerbeam', { ALLOW_REMOTE_PURGE: '1', ALLOW_PROD: 'true', FORCE_PURGE: 'true' })
    ).toThrow(/PRODUKCJ/);
  });
});

describe('wymagajForcePurge — drugi klucz', () => {
  it('--apply bez FORCE_PURGE=true jest odrzucane', () => {
    expect(() => wymagajForcePurge('apply', {})).toThrow(/FORCE_PURGE/);
  });

  it('--apply z FORCE_PURGE o innej wartości też jest odrzucane', () => {
    expect(() => wymagajForcePurge('apply', { FORCE_PURGE: '1' })).toThrow(/FORCE_PURGE/);
    expect(() => wymagajForcePurge('apply', { FORCE_PURGE: 'TRUE' })).toThrow(/FORCE_PURGE/);
  });

  it('--apply z FORCE_PURGE=true przechodzi', () => {
    expect(() => wymagajForcePurge('apply', { FORCE_PURGE: 'true' })).not.toThrow();
  });

  it('dry-run, verify i rollback nie wymagają FORCE_PURGE', () => {
    expect(() => wymagajForcePurge('dry-run', {})).not.toThrow();
    expect(() => wymagajForcePurge('verify', {})).not.toThrow();
    expect(() => wymagajForcePurge('rollback', {})).not.toThrow();
  });
});

describe('parsujCli — brak trybu i brak listy to błąd', () => {
  it('odrzuca wywołanie bez trybu', () => {
    expect(() => parsujCli(['--oczekiwany-host', '127.0.0.1', '--lista-id', 'x.txt'])).toThrow(/tryb/);
  });

  it('odrzuca wywołanie bez --lista-id (skrypt nigdy nie dobiera organizacji sam)', () => {
    expect(() => parsujCli(['--oczekiwany-host', '127.0.0.1', '--dry-run'])).toThrow(/lista-id/);
  });

  it('odrzuca wywołanie bez --oczekiwany-host', () => {
    expect(() => parsujCli(['--dry-run', '--lista-id', 'x.txt'])).toThrow(/oczekiwany-host/);
  });

  it('odrzuca nieznany argument zamiast go zignorować', () => {
    expect(() =>
      parsujCli(['--dry-run', '--oczekiwany-host', '127.0.0.1', '--lista-id', 'x.txt', '--wszystko'])
    ).toThrow(/Nieznany argument/);
  });

  it('przyjmuje obie składnie: „--klucz wartość" i „--klucz=wartość"', () => {
    const a = parsujCli(['--dry-run', '--oczekiwany-host=127.0.0.1', '--lista-id=x.txt']);
    const b = parsujCli(['--dry-run', '--oczekiwany-host', '127.0.0.1', '--lista-id', 'x.txt']);
    expect(a.odcisk).toBe(b.odcisk);
    expect(a.plikListy).toBe(b.plikListy);
    expect(a.tryb).toBe('dry-run');
  });

  it('--rollback bez manifestu jest odrzucane', () => {
    expect(() => parsujCli(['--rollback', '--oczekiwany-host', '127.0.0.1'])).toThrow(/manifest/);
  });

  it('--rollback=<plik> nie wymaga --lista-id (lista jest w manifeście)', () => {
    const o = parsujCli(['--rollback=m.json', '--oczekiwany-host', '127.0.0.1']);
    expect(o.tryb).toBe('rollback');
    expect(o.plikManifestu).toBe('m.json');
  });
});
