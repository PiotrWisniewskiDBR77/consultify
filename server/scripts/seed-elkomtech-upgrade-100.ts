#!/usr/bin/env tsx
/**
 * Seed UPGRADE → „100% McKinsey-ready" dla Elkomtech.
 * Wobec INITIATIVE_FORMULA.md (MECE · charter+WBS · Kaplan-Norton value-driver · baseline→target · falsyfikowalna teza).
 *
 * Robi:
 *  - KPI: baseline_value → target_value (+ direction); baseline „do ustalenia (N4)" gdzie brak danych.
 *  - Sizing nagrody + ROI (expected_roi/estimated_roi + market_context z jawnymi założeniami).
 *  - value_driver + impact/effort/confidence/wave → tagi (zgodnie z SSOT §11.4).
 *  - Tezy przepisane na „jeśli X to Y(mierzalne) bo Z".
 *  - Wnioski: + sekcja „Rekomendacja" + opportunities_json.
 *  - MECE: N6 zawężone do produktu „z półki"; +N11 (głos klienta/NPS←I9), +N12 (rejestr/SLA ofertowania←I4).
 *
 * Usage: SEED_MODE=production SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION npx tsx server/scripts/seed-elkomtech-upgrade-100.ts
 */
import dotenv from 'dotenv';
import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
import logger from '../src/utils/Logger.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
if (process.env.ENV_FILE) dotenv.config({ path: process.env.ENV_FILE, override: true });

const ORG_ID = 'elkomtech';
const PROJECT_ID = 'elkomtech-polityka-procesowa';
const OWNER_EMAIL = 'piotr.wisniewski@dbr77.com';
const BALUK = 'stanislaw.baluk@apator.com';

type Db = { run: (s: string, p?: unknown[]) => Promise<unknown>; query: <T>(s: string, p?: unknown[]) => Promise<{ rows?: T[] }>; };
function nowIso() { return new Date().toISOString(); }
function plusMonths(m: number) { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toISOString(); }
async function getCols(db: Db, t: string): Promise<Set<string>> {
  const r = await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [t]);
  return new Set((r.rows || []).map((x) => String(x.column_name).trim()));
}
async function tableExists(db: Db, t: string): Promise<boolean> {
  const r = await db.query<{ e: boolean }>(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) e`, [t]);
  return Boolean(r.rows?.[0]?.e);
}
async function upsert(db: Db, table: string, conflict: string[], entries: Array<[string, unknown]>, cols: Set<string>): Promise<boolean> {
  const f = entries.filter(([c, v]) => cols.has(c) && v !== undefined);
  if (!conflict.every((c) => cols.has(c)) || !f.length) return false;
  const ic = f.map(([c]) => c), params = f.map(([, v]) => v);
  const upd = ic.filter((c) => !conflict.includes(c)).map((c) => `${c}=EXCLUDED.${c}`);
  await db.run(`INSERT INTO ${table} (${ic.join(', ')}) VALUES (${ic.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (${conflict.join(', ')}) ${upd.length ? `DO UPDATE SET ${upd.join(', ')}` : 'DO NOTHING'}`, params);
  return true;
}

// ── WNIOSKI: aktualizacja treści (Rekomendacja) + opportunities ─────────────────
const INSIGHT_PATCH: Record<string, { recommendation: string; opportunity: { title: string; description: string }; stake?: string }> = {
  I1: { recommendation: '**Rekomendacja:** wyznaczyć właścicieli procesów E2E (→ N2) i osadzić ich w rytmie zarządczym PMO (→ N3).', opportunity: { title: 'Single owner E2E', description: 'Jeden właściciel sprawy od zapytania do serwisu + RACI + eskalacja 24h.' } },
  I2: { recommendation: '**Rekomendacja:** wydzielić serwis od produkcji i wdrożyć capacity planning (→ N7).', opportunity: { title: 'Odblokowanie monetyzacji', description: 'Skrócenie lead time uruchomień o 30–40% i OTIF > 90%.' }, stake: 'Stawka (rząd wielkości, założenie 5–10% potencjalnej sprzedaży blokowane przez wąskie gardło): ~3–6,5 mln zł przychodu rocznie, ~0,8–1,7 mln zł marży L1.' },
  I3: { recommendation: '**Rekomendacja:** zbudować drzewo KPI + dashboard (→ N4) na jednym źródle prawdy CRM/Service Desk (→ N5).', opportunity: { title: 'Sterowalność danymi', description: 'TTO/TTR/OTIF/NPS z definicjami, źródłami i właścicielami wskaźników.' } },
  I4: { recommendation: '**Rekomendacja:** wdrożyć standard obsługi zapytań — rejestr + triage S/M/L + SLA + pomiar lead-time (→ N12); rozstrzygnie spór danymi.', opportunity: { title: 'Rejestr + SLA ofertowania', description: 'Numer sprawy, triage, SLA i pomiar „zapytanie→oferta" kończą spór o tempo.' }, stake: 'Stawka: ~2100–2500 zapytań/rok; +2–4 pp konwersji = wymierny przyrost przychodu (do oszacowania po uruchomieniu rejestru).' },
  I5: { recommendation: '**Rekomendacja:** zdjąć zależność od jednej osoby i wprowadzić selekcję must-win (→ N8).', opportunity: { title: 'De-ryzykowanie przetargów', description: 'Kryteria must-win, koordynator techniczny, repozytorium, zastępowalność.' } },
  I6: { recommendation: '**Rekomendacja:** zbudować ofertę „z półki" — pakiety + cennik modułowy (→ N6).', opportunity: { title: 'Oferta „z półki"', description: 'Biblioteka pakietów i cennik modułowy skracają ścieżkę projektową.' } },
  I7: { recommendation: '**Rekomendacja:** powiązać premie z KPI procesowymi + program zarządzania zmianą (→ N10).', opportunity: { title: 'Premiowy oparty na KPI', description: '„Success fee" i powiązanie z miernikami procesowymi zamiast płaskiej premii.' } },
  I8: { recommendation: '**Rekomendacja:** zabezpieczyć know-how (umowy/NDA/non-compete) i sukcesję R&D (→ N9).', opportunity: { title: 'Ochrona łańcucha wartości', description: 'Umowy ramowe z podwykonawcami + plan sukcesji + baza wiedzy.' } },
  I9: { recommendation: '**Rekomendacja:** uruchomić program głosu klienta / NPS (→ N11); zewnętrznie + proxy wewnętrzne.', opportunity: { title: 'Głos klienta / NPS', description: 'Pomiar satysfakcji + analiza reklamacji + win/loss zamykają największą lukę danych.' } },
  I10: { recommendation: '**Rekomendacja:** wprowadzić standard opisu procesu + repozytorium i domknąć back-office (→ N1).', opportunity: { title: 'Proces jako produkt', description: 'Jednolity SIPOC+flowchart+RACI+bramki jakości; mapy back-office.' } },
};

// ── INICJATYWY (12) — pełne, ulepszone ─────────────────────────────────────────
type Kpi = { name: string; unit: string; baseline: number | null; target: number; direction: string; primary?: boolean; baselineNote?: string };
type Initiative = {
  key: string; sourceInsight: string; title: string; axis: string; area: string; valueDriver: string; wave: number;
  priority: string; impact: string; effort: string; confidence: string; horizonMonths: number; budget: number; roi: number;
  ownerEmail: string; summary: string; problem: string; hypothesis: string; businessValue: string; sizing: string;
  deliverables: string[]; successCriteria: string[]; scopeIn: string[]; scopeOut: string[]; killCriteria: string[]; keyRisks: string[]; tools: string[]; baseTags: string[];
  kpis: Kpi[]; milestones: Array<{ name: string; months: number }>;
};

const INITS: Initiative[] = [
  { key: 'N1', sourceInsight: 'I10', title: 'Standard opisu procesu + repozytorium („proces jako produkt")', axis: 'transformational', area: 'Architektura procesów', valueDriver: 'Skalowalność', wave: 2, priority: 'high', impact: 'high', effort: 'medium', confidence: 'high', horizonMonths: 6, budget: 80000, roi: 2.5, ownerEmail: OWNER_EMAIL,
    summary: 'Jednolity, obowiązkowy standard opisu każdego procesu (SIPOC+flowchart+RACI+bramki jakości) + centralne repozytorium; domknięcie niezmapowanych procesów back-office.',
    problem: 'Procesy opisane fragmentarycznie i niewdrożone; brak standardu, repozytorium i bramek jakości (I10).',
    hypothesis: 'Jeśli wprowadzimy jednolity standard opisu i repozytorium dla wszystkich procesów, to udział procesów krytycznych opisanych wg standardu wzrośnie z ~30% do 100% w 6 mies., bo praca stanie się powtarzalna i niezależna od osób (usunięcie wiedzy „w głowach").',
    businessValue: 'Value-driver: Skalowalność. Fundament pod opomiarowanie i właścicielstwo procesów; powtarzalność niezależna od osób.',
    sizing: 'Sizing: enabler — wartość pośrednia (warunkuje N2/N4); szac. redukcja czasu wdrażania nowych osób i błędów procesowych. ROI ~2,5x w horyzoncie 24 mies.',
    deliverables: ['Szablon SIPOC+flowchart+RACI', 'Repozytorium procesów', 'Mapy back-office (zakupy, magazyn, produkcja, SCADA, controlling)', 'Katalog bramek jakości'],
    successCriteria: ['100% procesów krytycznych wg standardu', '100% procesów z właścicielem', 'Repozytorium używane przez zespoły'],
    scopeIn: ['Wszystkie makroprocesy AiR ICT — front i back-office'], scopeOut: ['Wdrożenie systemów IT (→ N5)', 'Definiowanie wskaźników KPI (→ N4)'],
    killCriteria: ['Brak adopcji standardu przez właścicieli po 3 mies.'], keyRisks: ['Opór organizacji', 'Niska jakość eksportu istniejących map'], tools: ['Repozytorium procesów'], baseTags: ['proces', 'standard', 'fundament'],
    kpis: [{ name: '% procesów krytycznych opisanych wg standardu', unit: '%', baseline: 30, target: 100, direction: 'UP', primary: true }, { name: '% procesów z wyznaczonym właścicielem', unit: '%', baseline: 0, target: 100, direction: 'UP' }],
    milestones: [{ name: 'Standard + szablon zatwierdzone', months: 1 }, { name: 'Front-office opisany', months: 3 }, { name: 'Back-office zmapowany', months: 6 }] },
  { key: 'N2', sourceInsight: 'I1', title: 'Właściciele procesów end-to-end (Process Owners + RACI)', axis: 'transformational', area: 'Governance procesów', valueDriver: 'Efektywność / Rozliczalność', wave: 1, priority: 'critical', impact: 'high', effort: 'low', confidence: 'high', horizonMonths: 3, budget: 20000, roi: 6.0, ownerEmail: BALUK,
    summary: 'Każdy makroproces dostaje jednego właściciela E2E; dla TOP klientów „single owner". RACI, eskalacja 24h, rytm przeglądów.',
    problem: 'Nikt nie odpowiada za sprawę klienta od leada do serwisu; silosy i „utykające" tematy (I1).',
    hypothesis: 'Jeśli wyznaczymy właścicieli E2E i RACI z eskalacją 24h, to udział spraw z przypisanym właścicielem wzrośnie z ~0% do 100% a czas eskalacji spadnie < 24h w 3 mies., bo znikną luki odpowiedzialności między silosami.',
    businessValue: 'Value-driver: Efektywność/Rozliczalność. Krótszy czas reakcji, mniej „przerzucania spraw".',
    sizing: 'Sizing: niski koszt (20k), wysoka dźwignia organizacyjna; ROI ~6x — odblokowuje pozostałe inicjatywy procesowe.',
    deliverables: ['Mapa ról i właścicieli', 'Macierz RACI', 'Ścieżka eskalacji 24h', 'Kalendarz przeglądów'],
    successCriteria: ['100% spraw z właścicielem', 'Eskalacja < 24h', 'Single owner dla TOP klientów'],
    scopeIn: ['Wszystkie makroprocesy', 'TOP klienci OSD'], scopeOut: ['Opis procesów (→ N1)', 'Struktura PMO (→ N3)'],
    killCriteria: ['Właściciele nie pełnią roli po 60 dniach'], keyRisks: ['Konflikty kompetencyjne', 'Brak czasu właścicieli'], tools: ['Tablica statusów'], baseTags: ['właściciel', 'RACI', 'governance'],
    kpis: [{ name: '% spraw z przypisanym właścicielem', unit: '%', baseline: 0, target: 100, direction: 'UP', primary: true }, { name: 'Czas eskalacji problemu klienta', unit: 'h', baseline: null, target: 24, direction: 'DOWN', baselineNote: 'do ustalenia (N4) — dziś brak pomiaru' }],
    milestones: [{ name: 'Właściciele mianowani', months: 1 }, { name: 'RACI + eskalacje wdrożone', months: 2 }, { name: 'Rytm przeglądów działa', months: 3 }] },
  { key: 'N3', sourceInsight: 'I1', title: 'PMO procesowy + governance', axis: 'transformational', area: 'PMO / governance', valueDriver: 'Egzekucja / Skalowalność', wave: 1, priority: 'high', impact: 'high', effort: 'medium', confidence: 'high', horizonMonths: 3, budget: 60000, roi: 3.0, ownerEmail: OWNER_EMAIL,
    summary: 'Trwała struktura egzekucji: komitet sterujący, war room, kadencja przeglądów KPI, zarządzanie backlogiem zmian — by transformacja „doszła do końca".',
    problem: 'Brak struktury egzekwującej zmianę → ryzyko rozejścia się w silosach (I1, I10).',
    hypothesis: 'Jeśli uruchomimy PMO z miesięcznym rytmem przeglądów KPI i WIP-limitem, to realizacja kamieni milowych portfela osiągnie ≥ 90% w terminie, bo egzekucja przestanie zależeć od dobrej woli silosów.',
    businessValue: 'Value-driver: Egzekucja/Skalowalność. Ciągłość i widoczność postępu dla zarządu.',
    sizing: 'Sizing: koszt egzekucji (60k); ROI ~3x mierzony jako odsetek zrealizowanego portfela vs scenariusz bez PMO (typowo 30–40% inicjatyw bez PMO nie dochodzi do końca).',
    deliverables: ['Karta PMO', 'Komitet sterujący', 'Rytm przeglądów KPI', 'Backlog zmian + WIP-limit'],
    successCriteria: ['Realizacja kamieni ≥ 90%', 'Cykl przeglądów utrzymany', 'Burn-down inicjatyw'],
    scopeIn: ['Wszystkie strumienie transformacji'], scopeOut: ['Operacyjne prowadzenie inicjatyw (właściciele)', 'Wyznaczanie właścicieli (→ N2)'],
    killCriteria: ['Brak kadencji przeglądów przez 2 cykle'], keyRisks: ['Niskie zaangażowanie sponsora'], tools: ['Dashboard PMO'], baseTags: ['PMO', 'governance', 'egzekucja'],
    kpis: [{ name: 'Realizacja kamieni milowych portfela', unit: '%', baseline: null, target: 90, direction: 'UP', primary: true, baselineNote: 'do ustalenia — brak PMO/pomiaru dziś' }, { name: 'Inicjatywy w terminie', unit: '%', baseline: null, target: 80, direction: 'UP', baselineNote: 'do ustalenia (N4)' }],
    milestones: [{ name: 'PMO uruchomione', months: 1 }, { name: 'Pierwszy przegląd KPI', months: 2 }, { name: 'Pełny rytm zarządczy', months: 3 }] },
  { key: 'N4', sourceInsight: 'I3', title: 'System opomiarowania (drzewo KPI) + dashboard zarządczy', axis: 'transformational', area: 'Dane / KPI', valueDriver: 'Sterowalność / Efektywność', wave: 1, priority: 'critical', impact: 'high', effort: 'medium', confidence: 'high', horizonMonths: 6, budget: 90000, roi: 2.0, ownerEmail: 'aleksandra.struzynska@apator.com',
    summary: 'Serce projektu: definicje TTO/TTR/OTIF/lead-time/NPS (źródła, właściciele wskaźników), dashboard, ustanowienie baseline; proxy głosu klienta wewnętrznie.',
    problem: 'Organizacja niemierzalna: brak KPI, SSOT i baseline (I3, I9). Bez tego nie rozstrzygniemy sporów (I4) ani nie udowodnimy efektu.',
    hypothesis: 'Jeśli zdefiniujemy i wdrożymy drzewo KPI z baseline, to ≥ 80% procesów krytycznych będzie mierzonych w 6 mies., bo powstanie jedno źródło prawdy i właściciele wskaźników — co umożliwi sterowanie i rozstrzygnięcie spornych hipotez.',
    businessValue: 'Value-driver: Sterowalność. Decyzje oparte na danych; dowód efektu transformacji; ustanowienie baseline dla pozostałych inicjatyw.',
    sizing: 'Sizing: enabler krytyczny — dostarcza baseline dla WSZYSTKICH pozostałych KPI. ROI ~2x (konserwatywnie, jako enabler), realnie wyższe przez rozstrzygnięcie sporu o tempo (I4) i priorytetyzację.',
    deliverables: ['Słownik KPI (definicje, źródła, właściciele)', 'Dashboard zarządczy', 'Ustanowiony baseline operacyjny', 'Proxy głosu klienta (reklamacje/win-loss)'],
    successCriteria: ['Wdrożone KPI: TTO/TTR/OTIF/NPS', 'Pokrycie procesów pomiarem ≥ 80%', 'Cykl raportowania miesięczny'],
    scopeIn: ['Definicje i pomiar KPI operacyjno-klienckich', 'Baseline'], scopeOut: ['Dostarczenie systemów źródłowych (→ N5)', 'Zewnętrzne badanie NPS (→ N11)'],
    killCriteria: ['Brak danych źródłowych do ≥ połowy KPI po 3 mies.'], keyRisks: ['Brak danych w rejestrach', 'Jakość danych'], tools: ['Dashboard BI'], baseTags: ['KPI', 'measurement', 'dashboard'],
    kpis: [{ name: 'Liczba wdrożonych KPI z baseline', unit: 'szt', baseline: 0, target: 8, direction: 'UP', primary: true }, { name: 'Pokrycie procesów pomiarem', unit: '%', baseline: 0, target: 80, direction: 'UP' }],
    milestones: [{ name: 'Słownik KPI zatwierdzony', months: 1 }, { name: 'Dashboard MVP + baseline', months: 3 }, { name: 'Pełny pomiar', months: 6 }] },
  { key: 'N5', sourceInsight: 'I3', title: 'Single source of truth (CRM + Service Desk + rejestr)', axis: 'operational', area: 'Systemy / dane', valueDriver: 'Efektywność / Dane', wave: 3, priority: 'high', impact: 'high', effort: 'high', confidence: 'medium', horizonMonths: 9, budget: 180000, roi: 2.0, ownerEmail: OWNER_EMAIL,
    summary: 'Jedno miejsce statusu sprawy: CRM (pipeline), Service Desk (ticketing), rejestr zapytań z numerem sprawy; reaktywacja ESZ.',
    problem: 'Brak SSOT; status rozproszony w Excelu/kafelkach, brak numeru sprawy i zarządzania backlogiem (I3).',
    hypothesis: 'Jeśli wdrożymy CRM + Service Desk + rejestr z numerem sprawy, to ≥ 90% spraw będzie prowadzonych w systemie w 9 mies., bo powstanie jedno źródło prawdy eliminujące „shadow-Excele" i zasilające KPI (N4).',
    businessValue: 'Value-driver: Efektywność/Dane. Zarządzanie przepustowością i backlogiem; dane do KPI; koniec pracy ręcznej.',
    sizing: 'Sizing: redukcja pracy ręcznej (rejestry, statusy) + zasilenie KPI; ROI ~2x w 2–3 lata. Założenie: oszczędność czasu administracyjnego rzędu 0,5–1 FTE w ofertowaniu/operacjach.',
    deliverables: ['CRM (pipeline)', 'Service Desk (ticketing)', 'Rejestr zapytań z numerem sprawy', 'Reaktywacja ESZ'],
    successCriteria: ['≥ 90% spraw w systemie', 'Numer sprawy spina przepływ', 'Zniknięcie „shadow-Exceli"'],
    scopeIn: ['Sprzedaż, ofertowanie, uruchomienia, serwis'], scopeOut: ['Definicje KPI (→ N4)', 'Reguły procesu/SLA (→ N12)', 'ERP/produkcja'],
    killCriteria: ['Adopcja < 50% po 6 mies.'], keyRisks: ['Opór organizacyjny/polityczny (ESZ)', 'Integracje danych'], tools: ['CRM', 'Service Desk', 'ESZ'], baseTags: ['CRM', 'SSOT', 'systemy'],
    kpis: [{ name: '% spraw prowadzonych w systemie', unit: '%', baseline: 10, target: 90, direction: 'UP', primary: true, baselineNote: 'szac. — dziś Excel/kafelki' }, { name: 'Kompletność danych sprawy', unit: '%', baseline: null, target: 85, direction: 'UP', baselineNote: 'do ustalenia (N4)' }],
    milestones: [{ name: 'Wybór i konfiguracja', months: 3 }, { name: 'Pilotaż na 1 strumieniu', months: 6 }, { name: 'Pełne wdrożenie', months: 9 }] },
  { key: 'N6', sourceInsight: 'I6', title: 'Standaryzacja produktowa oferty („z półki" + cennik modułowy)', axis: 'operational', area: 'Produkt / oferta', valueDriver: 'Wzrost przychodu / Efektywność', wave: 2, priority: 'high', impact: 'high', effort: 'medium', confidence: 'medium', horizonMonths: 9, budget: 70000, roi: 3.0, ownerEmail: 'liza.wojtowicz@apator.com',
    summary: 'Biblioteka standardowych pakietów produktowo-usługowych + cennik modułowy „z półki", odciążające R&D i skracające ścieżkę projektową. (Triage/SLA procesu → N12.)',
    problem: 'Brak oferty „z półki"; niemal każde zapytanie idzie długą ścieżką projektową, obciąża R&D i planowanie (I6).',
    hypothesis: 'Jeśli zbudujemy bibliotekę pakietów „z półki" i cennik modułowy, to udział ofert standardowych wzrośnie z ~5% do ≥ 30% w 9 mies., bo powtarzalne konfiguracje przestaną wymagać pracy projektowej R&D.',
    businessValue: 'Value-driver: Wzrost przychodu/Efektywność. Krótszy lead time, niższy koszt obsługi, większa konwersja prostych ofert.',
    sizing: 'Sizing: założenie — standaryzacja skraca obsługę ~30% zapytań i podnosi konwersję prostych ofert o ~3–5 pp przy ~2200 zapytaniach/rok; odciążenie R&D. ROI ~3x.',
    deliverables: ['Biblioteka pakietów', 'Cennik modułowy 2.0', 'Kryteria „z półki vs custom"'],
    successCriteria: ['≥ 30% ofert „z półki"', 'Odciążenie R&D na powtarzalnych konfiguracjach'],
    scopeIn: ['Katalog produktowy, pakiety, cennik'], scopeOut: ['Triage S/M/L i SLA procesu ofertowania (→ N12)', 'CRM/rejestr (→ N5)'],
    killCriteria: ['Brak adopcji pakietów po 4 mies.'], keyRisks: ['Trudność standaryzacji custom', 'Opór sprzedaży'], tools: ['Cennik modułowy', 'Repozytorium pakietów'], baseTags: ['standaryzacja', 'produkt', 'oferta'],
    kpis: [{ name: '% ofert „z półki"', unit: '%', baseline: 5, target: 30, direction: 'UP', primary: true, baselineNote: 'szac. — dziś brak gotowców' }, { name: 'Udział custom w zapytaniach standardowych', unit: '%', baseline: null, target: 40, direction: 'DOWN', baselineNote: 'do ustalenia (N12 rejestr)' }],
    milestones: [{ name: 'Kryteria z półki/custom', months: 3 }, { name: 'Pierwsza biblioteka pakietów', months: 6 }, { name: 'Cennik modułowy v1', months: 9 }] },
  { key: 'N7', sourceInsight: 'I2', title: 'Wydzielenie serwisu od produkcji + capacity planning', axis: 'operational', area: 'Operacje / serwis', valueDriver: 'Wzrost przychodu (monetyzacja)', wave: 3, priority: 'critical', impact: 'high', effort: 'high', confidence: 'high', horizonMonths: 12, budget: 220000, roi: 5.0, ownerEmail: 'jerzy.karbowski@apator.com',
    summary: 'Wydzielona jednostka serwisu, rozbudowa uruchomień (+50–70%), ścieżka junior→senior, apteczki serwisowe, planowanie obłożenia (pipeline→capacity).',
    problem: 'Uruchomienia/serwis to wąskie gardło monetyzacji; serwis spychany przez produkcję (I2).',
    hypothesis: 'Jeśli wydzielimy serwis od produkcji i wdrożymy capacity planning, to lead time uruchomień spadnie o 30–40% a OTIF wzrośnie > 90% w 12 mies., bo zniknie konkurencja o zasoby między serwisem a produkcją i pojawi się sterowanie obłożeniem (pipeline→capacity).',
    businessValue: 'Value-driver: Wzrost przychodu. Szybsza monetyzacja sprzedaży, lepsza reputacja, stabilny serwis.',
    sizing: 'Sizing (rząd wielkości, założenie 5–10% potencjalnej sprzedaży blokowane/opóźniane przez wąskie gardło uruchomień przy przychodzie ~65 mln): ~3–6,5 mln zł przychodu rocznie do odblokowania, ~0,8–1,7 mln zł marży L1/rok. Koszt 220k → ROI ~4–8x w marży. Przyjęto ROI=5,0.',
    deliverables: ['Wydzielona jednostka serwisu', 'Plan rozbudowy uruchomień', 'Ścieżka junior→senior', 'Apteczki serwisowe', 'Capacity planning (pipeline→capacity)'],
    successCriteria: ['Lead time uruchomień -30–40%', 'OTIF uruchomień > 90%', 'SLA serwisu odpowiedź < 24h'],
    scopeIn: ['Serwis gwar./pogwar.', 'Uruchomienia'], scopeOut: ['Outsourcing pełnego procesu (ryzyko know-how → N9)', 'System ticketingu (→ N5)'],
    killCriteria: ['Brak rekrutacji i wydzielenia po 6 mies.'], keyRisks: ['Trudna rekrutacja', 'Brak przestrzeni', 'Utrata know-how'], tools: ['Capacity planner', 'Service Desk (N5)'], baseTags: ['serwis', 'uruchomienia', 'capacity'],
    kpis: [{ name: 'Lead time uruchomień', unit: 'dni', baseline: null, target: 0, direction: 'DOWN', primary: true, baselineNote: 'baseline do ustalenia (N4); cel: −30–40% vs baseline' }, { name: 'OTIF uruchomień', unit: '%', baseline: null, target: 90, direction: 'UP', baselineNote: 'do ustalenia (N4)' }, { name: 'SLA serwisu (czas odpowiedzi)', unit: 'h', baseline: null, target: 24, direction: 'DOWN', baselineNote: 'do ustalenia (N4)' }],
    milestones: [{ name: 'Decyzja i model wydzielenia', months: 3 }, { name: 'Rozbudowa zespołu + apteczki', months: 6 }, { name: 'Capacity planning operacyjny', months: 12 }] },
  { key: 'N8', sourceInsight: 'I5', title: 'Profesjonalizacja przetargów (de-ryzykowanie)', axis: 'operational', area: 'Przetargi', valueDriver: 'Wzrost przychodu', wave: 1, priority: 'high', impact: 'medium', effort: 'low', confidence: 'high', horizonMonths: 6, budget: 40000, roi: 8.0, ownerEmail: 'karolina.zasada@apator.com',
    summary: 'Kryteria go/no-go „must-win", koordynator techniczny, repozytorium aktualnych dokumentów formalnych, zastępowalność — by zdjąć zależność od jednej osoby i wygrywać świadomie.',
    problem: 'Przetargi wiszą na jednej osobie, brak selekcji „must-win" (I5).',
    hypothesis: 'Jeśli wdrożymy selekcję must-win, koordynatora technicznego i repozytorium dokumentów, to liczba wygranych postępowań strategicznych wzrośnie a odrzucenia formalne spadną do 0 w 6 mies., bo zasoby skupią się na właściwych przetargach a ryzyko jednoosobowe zostanie usunięte.',
    businessValue: 'Value-driver: Wzrost przychodu. Więcej wygranych strategicznych przetargów; ciągłość procesu.',
    sizing: 'Sizing: założenie — lepsza selekcja must-win daje +1–2 wygrane duże postępowania/rok (wartość pojedynczego 1–3 mln zł) → +1–3 mln zł przychodu przy koszcie 40k. ROI bardzo wysoki (przyjęto 8,0).',
    deliverables: ['Kryteria go/no-go „must-win"', 'Koordynator techniczny', 'Repozytorium dokumentów formalnych', 'Plan zastępowalności'],
    successCriteria: ['Wzrost hit-rate must-win', '0 odrzuceń formalnych', 'Udział postępowań strategicznych ↑'],
    scopeIn: ['Proces przetargowy OSD/PSE'], scopeOut: ['Zmiana progów akceptacji w Grupie (decyzja zarządcza)'],
    killCriteria: ['Brak wdrożenia kryteriów po 3 mies.'], keyRisks: ['Brak zasobów technicznych', 'Nieaktualna dokumentacja'], tools: ['Repozytorium SharePoint', 'Checklisty przetargowe'], baseTags: ['przetargi', 'must-win', 'ryzyko'],
    kpis: [{ name: 'Hit-rate przetargów must-win', unit: '%', baseline: null, target: 40, direction: 'UP', primary: true, baselineNote: 'do ustalenia — brak monitorowania (H8)' }, { name: 'Odrzucenia formalne', unit: 'szt/rok', baseline: null, target: 0, direction: 'DOWN', baselineNote: 'do ustalenia (rejestr przetargów)' }],
    milestones: [{ name: 'Kryteria go/no-go wdrożone', months: 2 }, { name: 'Repozytorium dokumentów', months: 4 }, { name: 'Zastępowalność zapewniona', months: 6 }] },
  { key: 'N9', sourceInsight: 'I8', title: 'Bezpieczeństwo know-how i sukcesja', axis: 'compliance', area: 'R&D / podwykonawcy / HR', valueDriver: 'Ryzyko / Ciągłość', wave: 2, priority: 'high', impact: 'high', effort: 'medium', confidence: 'high', horizonMonths: 6, budget: 50000, roi: 4.0, ownerEmail: 'grzegorz.lewociuk@apator.com',
    summary: 'Umowy ramowe/NDA/non-compete z podwykonawcami i kluczowymi ludźmi, plan sukcesji R&D, baza wiedzy / transfer kompetencji.',
    problem: 'Wysokie ryzyko utraty know-how; podwykonawcy w większości bez umów, sukcesja R&D zagrożona (I8).',
    hypothesis: 'Jeśli zawrzemy umowy ramowe/NDA/non-compete i wdrożymy plan sukcesji R&D, to udział podwykonawców z umową wzrośnie do 100% a role krytyczne uzyskają plan sukcesji w 6 mies., bo ograniczymy ryzyko wycieku know-how i „hodowania konkurencji".',
    businessValue: 'Value-driver: Ryzyko/Ciągłość. Ochrona marży i łańcucha wartości; ciągłość operacyjna.',
    sizing: 'Sizing: mitygacja ryzyka — uniknięta strata; założenie ochrony ~0,5–1 mln zł marży zagrożonej rocznie (wyciek zleceń/know-how) przy koszcie 50k. ROI ~4x jako uniknięta strata.',
    deliverables: ['Umowy ramowe/NDA/non-compete', 'Plan sukcesji R&D', 'Baza wiedzy / transfer kompetencji'],
    successCriteria: ['100% podwykonawców z umową ramową', '100% ról krytycznych z planem sukcesji', 'Udokumentowane know-how'],
    scopeIn: ['Podwykonawcy', 'Kluczowi pracownicy', 'R&D'], scopeOut: ['Zmiany w polityce wynagrodzeń (→ N10)'],
    killCriteria: ['Brak umów z kluczowymi podwykonawcami po 6 mies.'], keyRisks: ['Opór podwykonawców', 'Odejścia przed zabezpieczeniem'], tools: ['Rejestr podwykonawców', 'Baza wiedzy'], baseTags: ['know-how', 'sukcesja', 'umowy'],
    kpis: [{ name: '% podwykonawców z umową ramową', unit: '%', baseline: 10, target: 100, direction: 'UP', primary: true, baselineNote: 'szac. — „większość bez umów" (H21A)' }, { name: '% ról krytycznych z planem sukcesji', unit: '%', baseline: 0, target: 100, direction: 'UP' }],
    milestones: [{ name: 'Wzory umów + lista kluczowych', months: 2 }, { name: 'Umowy podpisane', months: 4 }, { name: 'Plan sukcesji + baza wiedzy', months: 6 }] },
  { key: 'N10', sourceInsight: 'I7', title: 'System premiowy powiązany z KPI + zarządzanie zmianą', axis: 'transformational', area: 'HR / kultura', valueDriver: 'Kultura / Skalowalność', wave: 3, priority: 'medium', impact: 'medium', effort: 'medium', confidence: 'medium', horizonMonths: 12, budget: 60000, roi: 2.0, ownerEmail: BALUK,
    summary: 'Premiowy oparty na KPI procesowych/„success fee", szkolenia (obsługa klienta, menedżerskie), plan komunikacji zmiany — kultura procesowa zamiast silosowej.',
    problem: 'Premiowy „płaski", oparty na wyniku całej LB → „przerzucanie spraw" (I7).',
    hypothesis: 'Jeśli powiążemy premie z KPI procesowymi i wdrożymy program zarządzania zmianą, to udział premii powiązanej z KPI wzrośnie do ≥ 50% a adopcja procesów (ankieta) do ≥ 70% w 12 mies., bo zniknie zachęta do „przerzucania spraw".',
    businessValue: 'Value-driver: Kultura/Skalowalność. Lepsza współpraca, mniejszy opór, trwałość zmian.',
    sizing: 'Sizing: wartość miękka (kultura/retencja); ROI ~2x szacowane przez wzrost adopcji procesów i redukcję rotacji „2–3 lata→odejście" (H31).',
    deliverables: ['Model premiowy powiązany z KPI', 'Program szkoleń', 'Plan komunikacji zmiany'],
    successCriteria: ['≥ 50% premii powiązanej z KPI', 'Adopcja procesów ↑', 'Wyniki ankiet follow-up ↑'],
    scopeIn: ['System premiowy', 'Szkolenia', 'Komunikacja zmiany'], scopeOut: ['Zmiany strukturalne (decyzje zarządcze)'],
    killCriteria: ['Brak akceptacji modelu premiowego przez zarząd'], keyRisks: ['Wrażliwość tematu wynagrodzeń', 'Opór'], tools: ['Model KPI (N4)'], baseTags: ['premiowy', 'kultura', 'zmiana'],
    kpis: [{ name: '% premii powiązanej z KPI procesowymi', unit: '%', baseline: 0, target: 50, direction: 'UP', primary: true }, { name: 'Adopcja procesów (ankieta follow-up)', unit: '%', baseline: null, target: 70, direction: 'UP', baselineNote: 'baseline z ankiety 2026 — do przeliczenia' }],
    milestones: [{ name: 'Projekt modelu premiowego', months: 3 }, { name: 'Pilotaż + szkolenia', months: 6 }, { name: 'Pełne wdrożenie', months: 12 }] },
  // ── NOWE: domknięcie luk MECE ──
  { key: 'N11', sourceInsight: 'I9', title: 'Program głosu klienta (NPS + analiza reklamacji + win/loss)', axis: 'strategic', area: 'Doświadczenie klienta (CX)', valueDriver: 'Doświadczenie klienta', wave: 2, priority: 'high', impact: 'high', effort: 'medium', confidence: 'medium', horizonMonths: 6, budget: 45000, roi: 2.0, ownerEmail: BALUK,
    summary: 'Systematyczny głos klienta: badanie NPS (zewnętrzne) + proxy wewnętrzne (analiza reklamacji, win/loss z przetargów, feedback przy odbiorze) — domknięcie największej luki danych.',
    problem: 'Działamy bez głosu klienta; tezy reputacyjne (H17/H18) nieweryfikowalne, brak NPS (I9).',
    hypothesis: 'Jeśli uruchomimy cykliczne badanie NPS i strukturalny zbiór feedbacku, to uzyskamy mierzalny baseline NPS i ≥ 40% pokrycie TOP klientów w 6 mies., bo powstanie pierwszy systematyczny kanał głosu klienta — co zweryfikuje hipotezy reputacyjne.',
    businessValue: 'Value-driver: Doświadczenie klienta. Decyzje oparte na realnym głosie klienta; podstawa retencji i reputacji.',
    sizing: 'Sizing: enabler decyzji + retencja; wartość przez ograniczenie odpływu klientów OSD (utrata jednego dużego klienta = wielomilionowy przychód). ROI ~2x (konserwatywnie, jako enabler/retencja).',
    deliverables: ['Ankieta NPS + proces cykliczny', 'Analiza reklamacji', 'Win/loss z przetargów', 'Raport głosu klienta'],
    successCriteria: ['Ustanowiony baseline NPS', '≥ 40% pokrycie TOP klientów', 'Weryfikacja hipotez reputacyjnych H17/H18'],
    scopeIn: ['TOP klienci OSD/PSE', 'Proxy wewnętrzne'], scopeOut: ['Ankietowanie pracowników (osobny instrument)'],
    killCriteria: ['Brak zwrotu ankiet od TOP klientów po 3 mies.'], keyRisks: ['Niski zwrot', 'Dostęp do klientów'], tools: ['Narzędzie NPS', 'Rejestr reklamacji'], baseTags: ['NPS', 'głos-klienta', 'CX'],
    kpis: [{ name: 'NPS LB AiR ICT', unit: 'pkt', baseline: null, target: 30, direction: 'UP', primary: true, baselineNote: 'baseline do ustalenia — dziś NIE mierzony (H46); cel orientacyjny po 1. pomiarze' }, { name: 'Pokrycie TOP klientów badaniem', unit: '%', baseline: 0, target: 40, direction: 'UP' }],
    milestones: [{ name: 'Metodyka NPS + lista TOP klientów', months: 2 }, { name: '1. fala badania + proxy', months: 4 }, { name: 'Raport + baseline NPS', months: 6 }] },
  { key: 'N12', sourceInsight: 'I4', title: 'Standard obsługi zapytań: rejestr + triage S/M/L + SLA + pomiar lead-time', axis: 'operational', area: 'Ofertowanie (proces)', valueDriver: 'Wzrost przychodu (konwersja)', wave: 2, priority: 'high', impact: 'high', effort: 'medium', confidence: 'medium', horizonMonths: 6, budget: 50000, roi: 3.0, ownerEmail: 'liza.wojtowicz@apator.com',
    summary: 'Reguły procesu obsługi zapytania: jeden rejestr z numerem sprawy, triage S/M/L + fast lane, SLA między działami, pomiar lead-time „zapytanie→oferta" — i rozstrzygnięcie sporu o tempo danymi. (Pakiety produktowe → N6; system → N5.)',
    problem: 'Ofertowanie bez reguł; brak triage/SLA i rejestru; spór o tempo nierozstrzygnięty (I4, hipotezy H4/H6/H32).',
    hypothesis: 'Jeśli wdrożymy rejestr zapytań z numerem sprawy, triage S/M/L i SLA z pomiarem lead-time, to mediana lead-time dla zapytań S spadnie do ≤ 5 dni a 0% zapytań pozostanie bez śledzenia w 6 mies., bo każde zapytanie wejdzie w mierzony, priorytetyzowany przepływ — co jednocześnie rozstrzygnie spór zespół vs klient danymi.',
    businessValue: 'Value-driver: Wzrost przychodu (konwersja). Szybsza i pełniejsza obsługa zapytań; rozstrzygnięcie sporu o tempo faktami.',
    sizing: 'Sizing: założenie — brak „zgubionych" zapytań i krótszy lead-time → +2–4 pp konwersji z ~2200 zapytań/rok; wymierny przyrost przychodu (do oszacowania po 1. kwartale pomiaru). ROI ~3x.',
    deliverables: ['Rejestr zapytań z numerem sprawy', 'Triage S/M/L + fast lane', 'SLA między działami (ofertowanie↔R&D/ICT/OZE)', 'Pomiar lead-time „zapytanie→oferta"'],
    successCriteria: ['Mediana lead-time S ≤ 5 dni', '0% zapytań bez śledzenia', 'Spór o tempo rozstrzygnięty danymi'],
    scopeIn: ['Proces obsługi zapytania, triage, SLA, pomiar'], scopeOut: ['Pakiety produktowe i cennik (→ N6)', 'Narzędzie CRM/rejestr techniczny (→ N5)', 'Definicje całego drzewa KPI (→ N4)'],
    killCriteria: ['Brak rejestru i pomiaru po 3 mies.'], keyRisks: ['Omijanie procesu przez handlowców', 'Opór wobec SLA'], tools: ['Rejestr zapytań', 'ESZ'], baseTags: ['ofertowanie', 'SLA', 'triage', 'rejestr'],
    kpis: [{ name: 'Mediana lead-time „zapytanie→oferta" (S)', unit: 'dni', baseline: null, target: 5, direction: 'DOWN', primary: true, baselineNote: 'baseline do ustalenia z rejestru (rozstrzyga H4/H6/H32)' }, { name: '% zapytań objętych rejestrem/śledzeniem', unit: '%', baseline: null, target: 100, direction: 'UP', baselineNote: 'do ustalenia — dziś brak rejestru' }],
    milestones: [{ name: 'Rejestr + numer sprawy', months: 2 }, { name: 'Triage S/M/L + SLA', months: 4 }, { name: 'Pomiar lead-time + raport sporu', months: 6 }] },
];

async function main() {
  if (String(process.env.SEED_MODE || '').toLowerCase() !== 'production') throw new Error('Set SEED_MODE=production');
  if (process.env.SEED_CONFIRM !== 'YES_I_UNDERSTAND_PRODUCTION') throw new Error('Set SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION');
  const target = resolveScriptDatabaseTarget({ label: 'seed-elkomtech-upgrade', databaseUrl: process.env.DATABASE_URL, publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL, requireExplicitTarget: true });
  logSelectedDatabaseTarget('seed-elkomtech-upgrade', target);
  process.env.DATABASE_URL = target.connectionString;
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = (await getDatabaseAsync()) as unknown as Db;

  const emails = Array.from(new Set([OWNER_EMAIL, BALUK, ...INITS.map((i) => i.ownerEmail)]));
  const uMap: Record<string, string> = {};
  for (const e of emails) { const r = await db.query<{ id: string }>(`SELECT id FROM users WHERE lower(trim(email))=$1 LIMIT 1`, [e.toLowerCase()]); if (r.rows?.[0]?.id) uMap[e] = r.rows[0].id; }
  const ownerId = uMap[OWNER_EMAIL]; if (!ownerId) throw new Error('owner missing');

  const insCols = await getCols(db, 'interview_insights');
  const initCols = await getCols(db, 'initiatives');
  const kpiCols = (await tableExists(db, 'initiative_kpis')) ? await getCols(db, 'initiative_kpis') : new Set<string>();
  const msCols = (await tableExists(db, 'initiative_milestones')) ? await getCols(db, 'initiative_milestones') : new Set<string>();
  const raciCols = (await tableExists(db, 'initiative_stakeholders')) ? await getCols(db, 'initiative_stakeholders') : new Set<string>();

  // 1) wnioski — dopisz Rekomendację + opportunities (treść append, idempotentnie po markerze)
  let insN = 0;
  for (const [key, p] of Object.entries(INSIGHT_PATCH)) {
    const id = `ii_elkomtech_${key.toLowerCase()}`;
    const cur = await db.query<{ content: string }>(`SELECT content FROM interview_insights WHERE id=$1`, [id]);
    let content = cur.rows?.[0]?.content || '';
    content = content.split('\n## Rekomendacja')[0].trim(); // usuń poprzedni append
    const stake = p.stake ? `\n\n## Stawka\n${p.stake}` : '';
    content = `${content}${stake}\n\n## Rekomendacja\n${p.recommendation}`;
    const sets: string[] = ['content=$1', 'updated_at=$2'];
    const params: unknown[] = [content, nowIso()];
    if (insCols.has('opportunities_json')) { params.push(JSON.stringify([p.opportunity])); sets.push(`opportunities_json=$${params.length}`); }
    params.push(id);
    await db.run(`UPDATE interview_insights SET ${sets.join(', ')} WHERE id=$${params.length}`, params);
    insN += 1;
  }

  // 2) inicjatywy + KPI(baseline→target) + kamienie + RACI
  let initN = 0, kpiN = 0, msN = 0, raciN = 0;
  for (const ini of INITS) {
    const id = `init_elkomtech_${ini.key.toLowerCase()}`;
    const ownerBiz = uMap[ini.ownerEmail] || ownerId;
    const sponsor = uMap[BALUK];
    const tags = [...ini.baseTags, `impact:${ini.impact}`, `effort:${ini.effort}`, `confidence:${ini.confidence}`, `value-driver:${ini.valueDriver}`, `wave:${ini.wave}`];
    const ok = await upsert(db, 'initiatives', ['id'], [
      ['id', id], ['organization_id', ORG_ID], ['project_id', PROJECT_ID],
      ['name', ini.title], ['title', ini.title], ['axis', ini.axis], ['area', ini.area],
      ['summary', ini.summary], ['description', ini.summary], ['hypothesis', ini.hypothesis], ['problem_statement', ini.problem],
      ['status', 'PLANNING'], ['priority', ini.priority],
      ['business_value', ini.businessValue], ['market_context', ini.sizing],
      ['expected_roi', ini.roi], ['estimated_roi', ini.roi],
      ['estimated_budget', ini.budget], ['planned_budget_total', ini.budget], ['budget_currency', 'PLN'],
      ['cost_capex', Math.round(ini.budget * 0.4)], ['cost_opex', Math.round(ini.budget * 0.6)],
      ['planned_start_date', nowIso()], ['planned_end_date', plusMonths(ini.horizonMonths)],
      ['deliverables', JSON.stringify(ini.deliverables)], ['success_criteria', JSON.stringify(ini.successCriteria)],
      ['scope_in', JSON.stringify(ini.scopeIn)], ['scope_out', JSON.stringify(ini.scopeOut)],
      ['kill_criteria', JSON.stringify(ini.killCriteria)], ['key_risks', JSON.stringify(ini.keyRisks)],
      ['resource_tools', JSON.stringify(ini.tools)], ['tags', JSON.stringify(tags)],
      ['target_state', JSON.stringify({ description: ini.businessValue, valueDriver: ini.valueDriver, wave: ini.wave })],
      ['owner_business_id', ownerBiz], ['owner_execution_id', ownerId], ['sponsor_id', sponsor],
      ['source_type', 'interview_insight'], ['source_id', `ii_elkomtech_${ini.sourceInsight.toLowerCase()}`],
      ['ai_generated', 0], ['created_by', ownerId], ['updated_by', ownerId], ['updated_at', nowIso()], ['created_at', nowIso()],
    ], initCols);
    if (ok) initN += 1;

    if (kpiCols.size) {
      let i = 0;
      for (const k of ini.kpis) {
        const desc = `${k.direction === 'DOWN' ? 'Kierunek: spadek' : 'Kierunek: wzrost'} · Baseline: ${k.baseline === null ? (k.baselineNote || 'do ustalenia (N4)') : k.baseline + k.unit} → Cel: ${k.target}${k.unit}`;
        if (await upsert(db, 'initiative_kpis', ['id'], [
          ['id', `kpi_${id}_${i}`], ['initiative_id', id], ['organization_id', ORG_ID], ['name', k.name], ['description', desc],
          ['baseline_value', k.baseline], ['current_value', k.baseline], ['target_value', k.target], ['unit', k.unit],
          ['direction', k.direction === 'DOWN' ? 'LOWER_IS_BETTER' : 'HIGHER_IS_BETTER'], ['measurement_frequency', 'MONTHLY'], ['is_primary', k.primary ? 1 : 0], ['sort_order', i], ['updated_at', nowIso()],
        ], kpiCols)) kpiN += 1;
        i += 1;
      }
    }
    if (msCols.size) {
      let i = 0;
      for (const m of ini.milestones) {
        if (await upsert(db, 'initiative_milestones', ['id'], [
          ['id', `ms_${id}_${i}`], ['initiative_id', id], ['organization_id', ORG_ID], ['name', m.name], ['description', m.name],
          ['target_date', plusMonths(m.months)], ['status', 'PENDING'], ['order_index', i], ['created_by', ownerId],
        ], msCols)) msN += 1;
        i += 1;
      }
    }
    if (raciCols.size) {
      const raci: Array<[string, string, string]> = [[sponsor || ownerId, 'Sponsor', 'A'], [ownerBiz, 'Właściciel biznesowy', 'R'], [ownerId, 'Konsultant DBR', 'C']];
      let i = 0;
      for (const [uid, role, t] of raci) { if (uid && await upsert(db, 'initiative_stakeholders', ['id'], [['id', `raci_${id}_${i}`], ['initiative_id', id], ['user_id', uid], ['role', role], ['raci_type', t], ['created_by', ownerId]], raciCols)) raciN += 1; i += 1; }
    }
  }

  logger.info('[upgrade-100] ✅ done', { insights: insN, initiatives: initN, kpis: kpiN, milestones: msN, raci: raciN });
  // eslint-disable-next-line no-console
  console.log(`\n✅ 100%-ready: wnioski zaktualizowane=${insN}/10, inicjatywy=${initN}/12 (z N11,N12), KPI(baseline→target)=${kpiN}, kamienie=${msN}, RACI=${raciN}\n`);
}
main().catch((e) => { console.error('[upgrade-100] Failed:', e); process.exit(1); });
