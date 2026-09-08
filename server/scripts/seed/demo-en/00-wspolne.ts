/**
 * WSPÓLNE — biblioteka dla paczki D1 „jedna baza pokazowa po angielsku"
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D1).
 *
 * Reużywa wzór z `scripts/demo/seed-organizacja-pilotaz.ts`: UUIDv5 z ustalonej
 * przestrzeni nazw, guard hosta (odmowa na produkcji i przy niezgodnym hoście),
 * cztery tryby CLI (`--dry-run`/`--apply`/`--verify`/`--reset`), licznik
 * wstawionych/pominiętych, hasła wyłącznie do pliku poza repo.
 *
 * WSZYSTKIE podskrypty w `server/scripts/seed/demo-en/` importują ten plik —
 * nie duplikują UUIDv5 ani guardu hosta.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { Pool } from 'pg';

// ============================================================================
// Tożsamość seeda — SSOT dla całej paczki D1-D6 (organizacja „northwind")
// ============================================================================
export const TAG = 'northwind-demo-2026';
// Przestrzeń nazw UUIDv5 wyłącznie dla tego seeda — stała, nigdy nie zmieniać
// (zmiana przestawiłaby WSZYSTKIE deterministyczne id i złamała idempotencję).
export const PRZESTRZEN = 'f3a9c6d2-6b7e-5e1a-9c4b-2d7f1a8e6c30';
export const ORG_ID = 'northwind';
export const ORG_NAZWA = 'Northwind Manufacturing Ltd.';
export const DOMENA = 'northwind.example';

export function uuidV5(nazwa: string, przestrzen: string): string {
  const ns = Buffer.from(przestrzen.replace(/-/g, ''), 'hex');
  const hash = crypto.createHash('sha1').update(ns).update(Buffer.from(nazwa, 'utf8')).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x50;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Deterministyczne id: `rodzaj` np. 'user'/'team'/'project', `klucz` np. e-mail/slug. */
export const det = (rodzaj: string, klucz: string): string => uuidV5(`${TAG}|${rodzaj}|${klucz}`, PRZESTRZEN);

// ============================================================================
// Słownik ról — TYLKO to, co dopuszcza `organization_members_role_check`
// (`server/migrations/727_beta_missing_tables.sql:25`, poszerzony
// `server/migrations/...` do USER/GUEST). `users.role` NIGDY nie niesie
// stanowiska (POMIAR.md §1.4: „UX Designer"/„DevOps Engineer" w users.role
// to defekt zastany, nie wzór) — wyłącznie wartość z tego słownika.
// ============================================================================
export const SLOWNIK_ROL = ['OWNER', 'ADMIN', 'MEMBER', 'CONSULTANT', 'USER', 'GUEST'] as const;
export type RolaSlownikowa = (typeof SLOWNIK_ROL)[number];

export function sprawdzRoleSlownika(rola: string, kontekst: string): void {
  if (!(SLOWNIK_ROL as readonly string[]).includes(rola)) {
    throw new Error(
      `Odmowa: rola „${rola}" (${kontekst}) nie jest w słowniku ról (${SLOWNIK_ROL.join('/')}). ` +
        'users.role/organization_members.role nigdy nie niesie stanowiska — stanowisko idzie do job_title.'
    );
  }
}

// ============================================================================
// Guard celu — te same reguły co scripts/demo/seed-organizacja-pilotaz.ts
// ============================================================================
export function tozsamosc(url: string): string {
  const u = new URL(url);
  return `${u.hostname.toLowerCase()}:${u.port || '5432'}/${decodeURIComponent(u.pathname.replace(/^\//, '')).toLowerCase()}`;
}

/**
 * Nazwa bazy dopuszczona dla WSZYSTKICH paczek D1-D6: lokalna kopia pokazowa
 * `consultify_kopia_d<numer paczki>` (D1 pracuje na `consultify_kopia_d1`,
 * D3 na `consultify_kopia_d3` itd.). Wzorzec jest CELOWO wąski — `consultify_staging_kopia`,
 * `consultify_kopia_final` czy `railway` odpadają, bo nie kończą się numerem paczki.
 */
export const WZORZEC_BAZY_KOPII = /^consultify_kopia_d[0-9]+$/i;

export function sprawdzCel(url: string, oczekiwanyHost: string): string {
  const toz = tozsamosc(url);
  if (/centerbeam/i.test(toz)) throw new Error('Cel wskazuje PRODUKCJĘ (centerbeam). STOP.');
  if (/trolley|thomas/i.test(toz))
    throw new Error('Cel wskazuje demo/staging (trolley/thomas). Paczki D1-D6 działają WYŁĄCZNIE na kopii lokalnej. STOP.');
  const host = toz.split('/')[0]!;
  if (!host.includes(oczekiwanyHost))
    throw new Error(`Cel NIE pasuje do deklaracji --oczekiwany-host „${oczekiwanyHost}" (host nie jest pokazywany). STOP.`);
  if (!/consultify_kopia_d\d+/i.test(toz))
    throw new Error(`Cel NIE jest kopią lokalną „consultify_kopia_d<numer paczki>" (dostał: nazwa bazy ukryta, sprawdzono wzorcem). STOP.`);
  return toz;
}

// ============================================================================
// CLI — cztery tryby, wspólne dla 01-rdzen.ts i 99-verify.ts
// ============================================================================
export type Tryb = 'dry-run' | 'apply' | 'verify' | 'reset';

export type WspolneOpcje = {
  tryb: Tryb;
  oczekiwanyHost: string;
  resetujHasla: boolean;
  hasloPlik: string;
};

const HASLO_PLIK_DOMYSLNY = '/private/tmp/dane-pokazowe-en/northwind-konta.txt';

export function czytajWspolneArgumenty(argv: string[]): WspolneOpcje {
  let tryb: Tryb | null = null;
  let oczekiwanyHost = '';
  let resetujHasla = false;
  let hasloPlik = HASLO_PLIK_DOMYSLNY;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--dry-run') tryb = 'dry-run';
    else if (a === '--apply') tryb = 'apply';
    else if (a === '--verify') tryb = 'verify';
    else if (a === '--reset') tryb = 'reset';
    else if (a === '--resetuj-hasla') resetujHasla = true;
    else if (a === '--oczekiwany-host') oczekiwanyHost = argv[++i] ?? '';
    else if (a.startsWith('--oczekiwany-host=')) oczekiwanyHost = a.split('=').slice(1).join('=');
    else if (a === '--haslo-plik') hasloPlik = argv[++i] ?? '';
    else if (a.startsWith('--haslo-plik=')) hasloPlik = a.split('=').slice(1).join('=');
    // Nieznane flagi są ignorowane tutaj — podskrypt może mieć własne (żaden na razie nie ma).
  }

  if (!tryb)
    throw new Error('Podaj dokładnie jeden z: --dry-run, --apply, --verify, --reset (domyślnego trybu celowo nie ma).');
  if (!oczekiwanyHost)
    throw new Error('Brak --oczekiwany-host. Podaj fragment hosta bazy (np. 127.0.0.1 albo 54418). Bez deklaracji skrypt nie wie, w co celuje.');
  if (hasloPlik && !hasloPlik.startsWith('/'))
    throw new Error('--haslo-plik musi być ścieżką bezwzględną poza repozytorium.');

  return { tryb, oczekiwanyHost, resetujHasla, hasloPlik };
}

export function losoweHaslo(): string {
  // 18 znaków base64url ≈ 108 bitów entropii. Bez znaków mylących w mowie.
  return crypto.randomBytes(14).toString('base64url').replace(/[-_]/g, 'x');
}

export function zapiszHaslaPlik(sciezka: string, tresc: string): void {
  fs.mkdirSync(path.dirname(sciezka), { recursive: true });
  fs.writeFileSync(sciezka, tresc, { mode: 0o600 });
  fs.chmodSync(sciezka, 0o600);
}

// ============================================================================
// Licznik — wstawiono/pominięto/zmieniono, drukowany identycznie w każdym skrypcie.
// ============================================================================
export class Licznik {
  utworzono = 0;
  zmieniono = 0;
  pominieto = 0;

  utworz() {
    this.utworzono++;
  }
  zmien() {
    this.zmieniono++;
  }
  pomin() {
    this.pominieto++;
  }

  raport(prefiks: string): string {
    return `[${prefiks}] utworzono=${this.utworzono} zmieniono=${this.zmieniono} pominieto=${this.pominieto}`;
  }
}

// ============================================================================
// Pool
// ============================================================================
export function otworzPool(url: string): Pool {
  return new Pool({ connectionString: url, ssl: false, max: 2 });
}

export function wymaganyUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Brak DATABASE_URL.');
  return url;
}
