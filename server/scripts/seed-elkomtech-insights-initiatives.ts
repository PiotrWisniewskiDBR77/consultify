#!/usr/bin/env tsx
/**
 * Seed: Elkomtech — 10 wniosków (interview_insights) + 10 inicjatyw (initiatives) z pełnym charterem.
 *
 * Wstawia do org 'elkomtech' / projektu 'elkomtech-polityka-procesowa':
 *  - 10 insightów I1..I10 (status 'completed' = „Gotowe"; cross-role/rozjazdy w issues_json)
 *  - 10 inicjatyw N1..N10 (status 'PENDING_APPROVAL'; link source_type='interview_insight' + source_id)
 *    + pod-tabele: initiative_kpis, initiative_milestones, initiative_stakeholders (RACI)
 *
 * Dynamiczne filtrowanie kolumn — odporne na drift (centerbeam ma węższy schemat).
 *
 * Usage:
 *   SEED_MODE=production SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION \
 *   npx tsx server/scripts/seed-elkomtech-insights-initiatives.ts
 */
import crypto from 'crypto';
import dotenv from 'dotenv';
import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
import logger from '../src/utils/Logger.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
if (process.env.ENV_FILE) dotenv.config({ path: process.env.ENV_FILE, override: true });

const ORG_ID = 'elkomtech';
const PROJECT_ID = 'elkomtech-polityka-procesowa';
const OWNER_EMAIL = 'piotr.wisniewski@dbr77.com';

type Db = {
  run: (sql: string, p?: unknown[]) => Promise<unknown>;
  query: <T>(sql: string, p?: unknown[]) => Promise<{ rows?: T[] }>;
};

function nowIso() { return new Date().toISOString(); }
function plusMonths(m: number) { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toISOString(); }

async function getCols(db: Db, t: string): Promise<Set<string>> {
  const r = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [t]);
  return new Set((r.rows || []).map((x) => String(x.column_name).trim()));
}
async function tableExists(db: Db, t: string): Promise<boolean> {
  const r = await db.query<{ e: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) e`, [t]);
  return Boolean(r.rows?.[0]?.e);
}
async function upsert(db: Db, table: string, conflict: string[], entries: Array<[string, unknown]>, cols: Set<string>): Promise<boolean> {
  const filtered = entries.filter(([c, v]) => cols.has(c) && v !== undefined);
  if (!conflict.every((c) => cols.has(c)) || !filtered.length) return false;
  const ic = filtered.map(([c]) => c);
  const params = filtered.map(([, v]) => v);
  const upd = ic.filter((c) => !conflict.includes(c)).map((c) => `${c}=EXCLUDED.${c}`);
  await db.run(
    `INSERT INTO ${table} (${ic.join(', ')}) VALUES (${ic.map((_, i) => `$${i + 1}`).join(', ')})
     ON CONFLICT (${conflict.join(', ')}) ${upd.length ? `DO UPDATE SET ${upd.join(', ')}` : 'DO NOTHING'}`, params);
  return true;
}

// ── 10 WNIOSKÓW (insighty) ─────────────────────────────────────────────────────
type Insight = {
  key: string; title: string; promptType: string; area: string;
  summary: string; content: string;
  issues: Array<{ title: string; description: string; severity: string; crossSessionPattern?: boolean; perspective_labels?: string[]; divergence_note?: string; evidence_refs?: string[] }>;
};

const INSIGHTS: Insight[] = [
  { key: 'I1', title: 'Brak właściciela procesu end-to-end (lead → oferta → produkcja → uruchomienie → serwis)', promptType: 'problems', area: 'Organizacja / cały łańcuch',
    summary: 'Sprawa klienta przechodzi przez silosy; nikt nie odpowiada za całość od zapytania do serwisu.',
    content: '## Obserwacja\nOdpowiedzialność za przebieg „lead → oferta → produkcja → uruchomienie → serwis" jest realnie rozproszona — nie ma właściciela end-to-end ani jednej tablicy statusów. Sprawy „utykają" między działami.\n\n## Wpływ\nTermin, jakość, reputacja; brak rozliczalności.\n\n## Oparcie\nHipotezy H1 i H2 (potwierdzone); ankieta pracownicza (jednoznaczność ról 2,5/10). Pewność: WYSOKA.',
    issues: [{ title: 'Rozproszona odpowiedzialność E2E', description: 'Brak single ownera dla sprawy klienta; eskalacje ad hoc, brak ścieżki 24h.', severity: 'high', crossSessionPattern: true, perspective_labels: ['Sprzedaż', 'Uruchomienia', 'Serwis', 'Planowanie'], evidence_refs: ['H1', 'H2', 'Ankieta 2026'] }] },
  { key: 'I2', title: 'Uruchomienia i serwis jako wąskie gardło monetyzacji', promptType: 'problems', area: 'Operacje',
    summary: '4 doświadczone osoby, ~6 mies. wdrożenia nowej; terminy 2–3 mies., opóźnienia do 12 — a uruchomienie = moment monetyzacji sprzedaży.',
    content: '## Obserwacja\nZespół uruchomień/serwisu jest przeciążony i trudny do skalowania (charakter pracy, długi ramp-up). Uruchomienie to moment, w którym sprzedaż zamienia się w przychód — wąskie gardło bezpośrednio ogranicza wynik.\n\n## Wpływ\nPrzychód, reputacja („u Apatora czeka się długo").\n\n## Oparcie\nWywiad z J. Karbowskim + ankieta (deficyt zasobów #1). Pewność WYSOKA jakościowo; capacity niezweryfikowane liczbowo (H43).',
    issues: [{ title: 'Capacity uruchomień vs popyt', description: 'Brak twardego benchmarku capacity; przeciążenie i kolejkowanie.', severity: 'high', crossSessionPattern: true, perspective_labels: ['Uruchomienia', 'Sprzedaż', 'Planowanie'], divergence_note: 'S. Baluk częściowo podważa skalę problemu vs zespół operacyjny i handlowcy — rozjazd ocen.', evidence_refs: ['H43', 'Wywiad Karbowski'] }] },
  { key: 'I3', title: 'Organizacja niesterowalna, bo niemierzalna', promptType: 'gaps', area: 'Dane / zarządzanie',
    summary: 'Brak KPI operacyjnych (TTO/TTR/OTIF/NPS), Excel/„kafelki" zamiast systemu, brak jednego numeru sprawy i single source of truth.',
    content: '## Obserwacja\nNie mierzy się systematycznie wskaźników operacyjnych; status spraw rozproszony w Excelach i „kafelkach", brak jednego źródła prawdy. Nie da się dowieść, gdzie „ucieka doba".\n\n## Wpływ\nBrak podstaw do decyzji i rozliczania; to rdzeń problemu z perspektywy polityki procesowej.\n\n## Oparcie\nH5, H33 (potwierdzone). Pewność WYSOKA.',
    issues: [{ title: 'Brak systemu pomiaru i SSOT', description: 'Brak definicji i pomiaru TTO/TTR/OTIF/NPS; brak numeru sprawy spinającego przepływ.', severity: 'high', crossSessionPattern: true, perspective_labels: ['Zarząd', 'Ofertowanie', 'Operacje', 'Controlling'], evidence_refs: ['H5', 'H33'] }] },
  { key: 'I4', title: 'Ofertowanie bez reguł; spór o tempo nierozstrzygnięty', promptType: 'problems', area: 'Sprzedaż / ofertowanie',
    summary: '~2100–2500 zapytań/rok, brak TTO/SLA/triage S/M/L; progi akceptacji oderwane od realiów. Zespół: „już OK", klienci: „problem od lat".',
    content: '## Obserwacja\nBrak twardych reguł obsługi zapytań (triage S/M/L, fast lane, SLA), progi akceptacji (300/500 tys.) nieadekwatne do ofert do 1 mln+. Kluczowy spór: tempo ofertowania.\n\n## Wpływ\nKonwersja, koszt obsługi, reputacja.\n\n## Oparcie\nH3 potwierdzone; H4/H6/H32 SPORNE — nikt nie sprawdził rejestru zapytań. Pewność ŚREDNIA.',
    issues: [{ title: 'Tempo ofertowania — sprzeczne oceny', description: 'Zespół ofertowy twierdzi, że problem ustąpił; klienci (wybiórczo) wskazują problem „od lat".', severity: 'medium', crossSessionPattern: true, perspective_labels: ['Ofertowanie', 'Sprzedaż', 'Klient'], divergence_note: 'Rozjazd: zespół vs klienci; brak analizy rejestru zapytań uniemożliwia rozstrzygnięcie (H4/H6/H32).', evidence_refs: ['H3', 'H4', 'H32'] }] },
  { key: 'I5', title: 'Przetargi działają, ale wiszą na jednej osobie i bez selekcji', promptType: 'risk_assessment', area: 'Przetargi',
    summary: 'Proces dobrze opisany (K. Zasada), brak kryteriów „must-win", priorytetów i koordynatora technicznego; ryzyko paraliżu po stracie jednej osoby.',
    content: '## Obserwacja\nProces przetargowy jest dojrzały, ale silnie zależny od jednej osoby; brak selekcji „must-win", repozytorium aktualnych dokumentów i koordynatora technicznego.\n\n## Wpływ\nUtracone szanse rynkowe, ryzyko ciągłości.\n\n## Oparcie\nH8, H9 (potwierdzone). Pewność WYSOKA.',
    issues: [{ title: 'Zależność od pojedynczej osoby', description: 'Ryzyko paraliżu procesu przetargowego po stracie kluczowej osoby; brak zastępowalności.', severity: 'high', crossSessionPattern: false, perspective_labels: ['Przetargi'], evidence_refs: ['H8', 'H9'] }] },
  { key: 'I6', title: 'Customizacja zamiast standaryzacji napędza koszty i opóźnienia', promptType: 'problems', area: 'Produkt / R&D / ofertowanie',
    summary: 'Brak oferty „z półki" — niemal każde zapytanie idzie długą ścieżką projektową; obciąża R&D i planowanie.',
    content: '## Obserwacja\nBrak standardowych pakietów i cennika modułowego; dokumentacja zmienia się po wygranym przetargu. Custom dominuje nad „z półki".\n\n## Wpływ\nLead time, koszt, wąskie gardło R&D.\n\n## Oparcie\nH7 potwierdzone; H24 sporne. Pewność WYSOKA.',
    issues: [{ title: 'Brak oferty „z półki"', description: 'Każde zapytanie traktowane projektowo; brak biblioteki gotowców i cennika modułowego.', severity: 'high', crossSessionPattern: true, perspective_labels: ['Ofertowanie', 'Projektowanie', 'Planowanie'], evidence_refs: ['H7', 'H24'] }] },
  { key: 'I7', title: 'System premiowy demotywuje współpracę międzyprocesową', promptType: 'problems', area: 'HR / kultura',
    summary: 'Premia „płaska", oparta na wyniku całej LB → „przerzucanie spraw", brak właścicielskiego zaangażowania.',
    content: '## Obserwacja\nBrak powiązania premii z KPI procesowymi i wynikiem indywidualnym; premiowanie wynikiem całej LB sprzyja „przerzucaniu spraw" i silosom.\n\n## Wpływ\nKultura, współpraca, opór wobec zmian.\n\n## Oparcie\nH29, H42 + ankieta. Pewność WYSOKA.',
    issues: [{ title: 'Premiowy oderwany od KPI', description: 'Brak „success fee" i powiązania premii z miernikami procesowymi.', severity: 'medium', crossSessionPattern: true, perspective_labels: ['HR', 'Sprzedaż', 'Operacje'], evidence_refs: ['H29', 'H42'] }] },
  { key: 'I8', title: 'Wysokie ryzyko utraty know-how', promptType: 'risk_assessment', area: 'R&D / podwykonawcy',
    summary: 'Sukcesja R&D zagrożona (wiek przedemerytalny), podwykonawcy w większości bez umów (NDA/non-compete), wiedza „w głowach".',
    content: '## Obserwacja\nKrytyczne kompetencje nieudokumentowane; większość podwykonawców bez umów ramowych/NDA/non-compete; ryzyko „hodowania konkurencji".\n\n## Wpływ\nCiągłość, marża, pozycja konkurencyjna.\n\n## Oparcie\nH21A, H27, H31 (potwierdzone). Pewność WYSOKA.',
    issues: [{ title: 'Sukcesja i ochrona know-how', description: 'Brak planu sukcesji R&D i bazy wiedzy; podwykonawcy bez zabezpieczeń kontraktowych.', severity: 'high', crossSessionPattern: true, perspective_labels: ['R&D', 'Uruchomienia', 'Zarząd'], divergence_note: 'H20 (najbardziej dochodowe zlecenia do firm byłych pracowników) podważona danymi marżowymi — rozjazd hipotezy z danymi.', evidence_refs: ['H21A', 'H27', 'H31'] }] },
  { key: 'I9', title: 'Działamy bez głosu klienta', promptType: 'gaps', area: 'Klient / CX',
    summary: 'Zero badania NPS/satysfakcji — a najgłośniejsze tezy o reputacji i utracie OSD opierają się właśnie na nim.',
    content: '## Obserwacja\nBrak systematycznego badania satysfakcji/NPS i strukturalnego feedbacku klienta; tezy reputacyjne (H17/H18) nieweryfikowalne.\n\n## Wpływ\nDecyzje „na ślepo"; największa pojedyncza luka analityczna.\n\n## Oparcie\nH17, H18, H46 (luka pewna, dane żadne). Pewność: meta-luka.',
    issues: [{ title: 'Brak głosu klienta / NPS', description: 'Brak danych klienckich; reputacja oceniana wyłącznie wewnętrznie i wybiórczo.', severity: 'high', crossSessionPattern: true, perspective_labels: ['Sprzedaż', 'Serwis', 'Zarząd'], evidence_refs: ['H17', 'H18', 'H46'] }] },
  { key: 'I10', title: 'Procesy nie są realnie opisane ani wdrożone', promptType: 'maturity', area: 'Cała organizacja',
    summary: 'Mapy fragmentaryczne (front-office); back-office (zakupy/magazyn/produkcja/SCADA/controlling) niezmapowany; flowcharty niepełne; brak standardu pracy.',
    content: '## Obserwacja\nIstnieją SIPOC/flowcharty dla części front-office, ale back-office jest niezmapowany, a flowcharty niekompletne. Brak standardu pracy i bramek jakości.\n\n## Wpływ\nNiepowtarzalność, zależność od osób.\n\n## Oparcie\nInwentaryzacja map procesów. Pewność WYSOKA.',
    issues: [{ title: 'Niekompletne i niewdrożone procesy', description: 'Brak jednolitego standardu opisu, repozytorium i bramek jakości; back-office bez map.', severity: 'high', crossSessionPattern: true, perspective_labels: ['Zakupy', 'Magazyn', 'Produkcja', 'SCADA', 'Controlling'], evidence_refs: ['Inwentaryzacja SIPOC/FLOWCHART'] }] },
];

// ── 10 INICJATYW (pełny charter) ───────────────────────────────────────────────
type Initiative = {
  key: string; sourceInsight: string; title: string; axis: string; area: string; priority: string;
  impact: string; effort: string; confidence: string; valueTiming: string; horizonMonths: number; budget: number;
  ownerEmail: string; summary: string; problem: string; hypothesis: string; businessValue: string;
  deliverables: string[]; successCriteria: string[]; scopeIn: string[]; scopeOut: string[]; killCriteria: string[]; keyRisks: string[]; tools: string[]; tags: string[];
  kpis: Array<{ name: string; unit: string; target: number; primary?: boolean }>;
  milestones: Array<{ name: string; months: number }>;
};

const BALUK = 'stanislaw.baluk@apator.com';
const INITIATIVES: Initiative[] = [
  { key: 'N1', sourceInsight: 'I10', title: 'Standard opisu procesu + repozytorium („proces jako produkt")', axis: 'transformational', area: 'Architektura procesów', priority: 'high', impact: 'high', effort: 'medium', confidence: 'high', valueTiming: 'short_term', horizonMonths: 6, budget: 80000, ownerEmail: OWNER_EMAIL,
    summary: 'Jednolity, obowiązkowy standard opisu każdego procesu (SIPOC + flowchart + RACI + bramki jakości) oraz centralne repozytorium; domknięcie niezmapowanych procesów back-office.',
    problem: 'Procesy są opisane fragmentarycznie i niewdrożone; brak standardu, repozytorium i bramek jakości (I10).',
    hypothesis: 'Wprowadzenie jednolitego standardu opisu i repozytorium uczyni procesy powtarzalnymi i niezależnymi od osób.',
    businessValue: 'Powtarzalność, skalowalność, fundament pod opomiarowanie i właścicielstwo procesów.',
    deliverables: ['Szablon SIPOC+flowchart+RACI', 'Repozytorium procesów', 'Mapy back-office (zakupy, magazyn, produkcja, SCADA, controlling)', 'Katalog bramek jakości'],
    successCriteria: ['100% procesów krytycznych opisanych wg standardu', '100% procesów z wyznaczonym właścicielem', 'Repozytorium dostępne dla zespołów'],
    scopeIn: ['Wszystkie makroprocesy AiR ICT', 'Front- i back-office'], scopeOut: ['Wdrożenie systemów IT (osobna inicjatywa N5)'],
    killCriteria: ['Brak adopcji standardu przez właścicieli procesów po 3 mies.'], keyRisks: ['Opór organizacji', 'Niska jakość eksportu istniejących map'], tools: ['Repozytorium procesów', 'Narzędzie do map'], tags: ['proces', 'standard', 'fundament'],
    kpis: [{ name: '% procesów opisanych wg standardu', unit: '%', target: 100, primary: true }, { name: '% procesów z właścicielem', unit: '%', target: 100 }],
    milestones: [{ name: 'Standard + szablon zatwierdzone', months: 1 }, { name: 'Procesy front-office opisane', months: 3 }, { name: 'Back-office zmapowany', months: 6 }] },
  { key: 'N2', sourceInsight: 'I1', title: 'Właściciele procesów end-to-end (Process Owners + RACI)', axis: 'transformational', area: 'Governance procesów', priority: 'critical', impact: 'high', effort: 'low', confidence: 'high', valueTiming: 'immediate', horizonMonths: 3, budget: 20000, ownerEmail: BALUK,
    summary: 'Każdy makroproces dostaje jednego właściciela end-to-end; dla TOP klientów „single owner". RACI, ścieżki eskalacji 24h, rytm przeglądów.',
    problem: 'Nikt nie odpowiada za sprawę klienta od leada do serwisu; silosy i „utykające" tematy (I1).',
    hypothesis: 'Wyznaczenie właścicieli E2E i RACI usunie luki odpowiedzialności i skróci czas reakcji.',
    businessValue: 'Rozliczalność, krótszy czas reakcji, mniej „przerzucania spraw".',
    deliverables: ['Mapa ról i właścicieli', 'Macierz RACI', 'Ścieżka eskalacji 24h', 'Kalendarz przeglądów'],
    successCriteria: ['100% spraw z przypisanym ownerem', 'Eskalacja < 24h', 'Single owner dla TOP klientów'],
    scopeIn: ['Wszystkie makroprocesy', 'TOP klienci OSD'], scopeOut: ['Zmiana struktury organizacyjnej (poza zakresem MVP)'],
    killCriteria: ['Właściciele nie pełnią roli po 60 dniach'], keyRisks: ['Konflikty kompetencyjne', 'Brak czasu właścicieli'], tools: ['Tablica statusów'], tags: ['właściciel', 'RACI', 'governance'],
    kpis: [{ name: '% spraw z przypisanym właścicielem', unit: '%', target: 100, primary: true }, { name: 'Czas eskalacji', unit: 'h', target: 24 }],
    milestones: [{ name: 'Właściciele mianowani', months: 1 }, { name: 'RACI + eskalacje wdrożone', months: 2 }, { name: 'Rytm przeglądów działa', months: 3 }] },
  { key: 'N3', sourceInsight: 'I1', title: 'PMO procesowy + governance', axis: 'transformational', area: 'PMO / governance', priority: 'high', impact: 'high', effort: 'medium', confidence: 'high', valueTiming: 'immediate', horizonMonths: 3, budget: 60000, ownerEmail: OWNER_EMAIL,
    summary: 'Trwała struktura pilnująca wdrożenia (żeby projekt „doszedł do końca"): komitet sterujący, war room, kadencja przeglądów KPI, zarządzanie backlogiem zmian.',
    problem: 'Brak struktury egzekwującej zmianę → ryzyko, że transformacja rozejdzie się w silosach (I1, I10).',
    hypothesis: 'PMO + rytm zarządczy zapewni egzekucję i utrzymanie zmian w czasie.',
    businessValue: 'Egzekucja, ciągłość, widoczność postępu dla zarządu.',
    deliverables: ['Karta PMO', 'Komitet sterujący', 'Rytm przeglądów KPI', 'Backlog zmian'],
    successCriteria: ['Realizacja kamieni milowych ≥ 90%', 'Cykl przeglądów utrzymany', 'Burn-down inicjatyw'],
    scopeIn: ['Wszystkie strumienie transformacji'], scopeOut: ['Operacyjne prowadzenie poszczególnych inicjatyw'],
    killCriteria: ['Brak kadencji przeglądów przez 2 cykle'], keyRisks: ['Niskie zaangażowanie sponsora'], tools: ['Dashboard PMO'], tags: ['PMO', 'governance', 'egzekucja'],
    kpis: [{ name: 'Realizacja kamieni milowych', unit: '%', target: 90, primary: true }, { name: 'Inicjatywy w terminie', unit: '%', target: 80 }],
    milestones: [{ name: 'PMO uruchomione', months: 1 }, { name: 'Pierwszy przegląd KPI', months: 2 }, { name: 'Pełny rytm zarządczy', months: 3 }] },
  { key: 'N4', sourceInsight: 'I3', title: 'System opomiarowania (drzewo KPI) + dashboard zarządczy', axis: 'transformational', area: 'Dane / KPI', priority: 'critical', impact: 'high', effort: 'medium', confidence: 'high', valueTiming: 'short_term', horizonMonths: 6, budget: 90000, ownerEmail: 'aleksandra.struzynska@apator.com',
    summary: 'Organizacja sterowalna danymi — serce projektu. Definicje TTO/TTR/OTIF/lead-time/NPS (źródła, właściciele wskaźników), dashboard; proxy głosu klienta wewnętrznie (reklamacje, win/loss, feedback przy odbiorze).',
    problem: 'Organizacja niemierzalna: brak KPI, SSOT i danych klienckich (I3, I9).',
    hypothesis: 'Zdefiniowanie i wdrożenie drzewa KPI umożliwi sterowanie i rozstrzygnięcie spornych hipotez (I4).',
    businessValue: 'Decyzje oparte na danych; dowód efektu transformacji; rozstrzygnięcie sporów.',
    deliverables: ['Słownik KPI (definicje, źródła, właściciele)', 'Dashboard zarządczy', 'Proxy głosu klienta', 'Raport bazowy (baseline)'],
    successCriteria: ['Wdrożone KPI: TTO/TTR/OTIF/NPS', 'Pokrycie procesów pomiarem ≥ 80%', 'Cykl raportowania miesięczny'],
    scopeIn: ['KPI operacyjno-klienckie', 'Proxy NPS wewnętrzny'], scopeOut: ['Zewnętrzne badanie NPS klientów (osobny instrument)'],
    killCriteria: ['Brak danych źródłowych do ≥ połowy KPI po 3 mies.'], keyRisks: ['Brak danych w rejestrach', 'Jakość danych'], tools: ['Dashboard BI', 'CRM/Service Desk (N5)'], tags: ['KPI', 'measurement', 'dashboard'],
    kpis: [{ name: 'Liczba wdrożonych KPI', unit: 'szt', target: 8, primary: true }, { name: 'Pokrycie procesów pomiarem', unit: '%', target: 80 }, { name: 'OTIF uruchomień (cel docelowy)', unit: '%', target: 90 }],
    milestones: [{ name: 'Słownik KPI zatwierdzony', months: 1 }, { name: 'Dashboard MVP', months: 3 }, { name: 'Pełny pomiar + baseline', months: 6 }] },
  { key: 'N5', sourceInsight: 'I3', title: 'Single source of truth (CRM + Service Desk + rejestr zapytań)', axis: 'operational', area: 'Systemy / dane', priority: 'high', impact: 'high', effort: 'high', confidence: 'medium', valueTiming: 'mid_term', horizonMonths: 9, budget: 180000, ownerEmail: OWNER_EMAIL,
    summary: 'Jedno miejsce statusu sprawy zamiast Excela/kafelków: CRM (pipeline), Service Desk (uruchomienia/serwis, ticketing), rejestr zapytań z numerem sprawy; reaktywacja ESZ.',
    problem: 'Brak SSOT; status rozproszony, brak numeru sprawy i zarządzania backlogiem (I3).',
    hypothesis: 'Wdrożenie CRM + Service Desk + rejestru da jedno źródło prawdy i zasili KPI.',
    businessValue: 'Zarządzanie przepustowością i backlogiem; dane do KPI; koniec „shadow-Exceli".',
    deliverables: ['CRM (pipeline sprzedaży)', 'Service Desk (ticketing)', 'Rejestr zapytań z numerem sprawy', 'Reaktywacja ESZ'],
    successCriteria: ['≥ 90% spraw w systemie', 'Numer sprawy spina przepływ', 'Zniknięcie „shadow-Exceli"'],
    scopeIn: ['Sprzedaż, ofertowanie, uruchomienia, serwis'], scopeOut: ['ERP / produkcja (poza MVP)'],
    killCriteria: ['Adopcja < 50% po 6 mies.'], keyRisks: ['Opór organizacyjny/polityczny (ESZ)', 'Integracje danych'], tools: ['CRM', 'Service Desk', 'ESZ'], tags: ['CRM', 'SSOT', 'systemy'],
    kpis: [{ name: '% spraw prowadzonych w systemie', unit: '%', target: 90, primary: true }, { name: 'Kompletność danych sprawy', unit: '%', target: 85 }],
    milestones: [{ name: 'Wybór i konfiguracja narzędzi', months: 3 }, { name: 'Pilotaż na jednym strumieniu', months: 6 }, { name: 'Pełne wdrożenie', months: 9 }] },
  { key: 'N6', sourceInsight: 'I6', title: 'Standaryzacja oferty i pracy („z półki" + triage + SLA)', axis: 'operational', area: 'Ofertowanie / produkt', priority: 'high', impact: 'high', effort: 'medium', confidence: 'medium', valueTiming: 'short_term', horizonMonths: 9, budget: 70000, ownerEmail: 'liza.wojtowicz@apator.com',
    summary: 'Skrócenie ścieżki dla powtarzalnych spraw: biblioteka pakietów + cennik modułowy, triage S/M/L + fast lane, SLA między działami, checklisty/protokoły FAT/SAT.',
    problem: 'Customizacja zamiast standaryzacji; brak triage i SLA (I4, I6).',
    hypothesis: 'Standardowe pakiety „z półki" i triage skrócą lead time i odciążą R&D.',
    businessValue: 'Krótszy lead time, niższy koszt obsługi, większa konwersja prostych ofert.',
    deliverables: ['Biblioteka pakietów + cennik modułowy', 'Triage S/M/L + fast lane', 'SLA między działami', 'Checklisty/protokoły FAT/SAT'],
    successCriteria: ['≥ 30% ofert „z półki"', 'Lead time S/M/L spełnia SLA', 'OTIF ofert ≥ 90%'],
    scopeIn: ['Ofertowanie, R&D (pakiety)', 'Standardy odbioru'], scopeOut: ['Pełna automatyzacja wyceny (faza 2)'],
    killCriteria: ['Brak adopcji pakietów po 4 mies.'], keyRisks: ['Trudność standaryzacji custom', 'Opór sprzedaży'], tools: ['Cennik modułowy', 'Repozytorium pakietów'], tags: ['standaryzacja', 'oferta', 'SLA'],
    kpis: [{ name: '% ofert „z półki"', unit: '%', target: 30, primary: true }, { name: 'Lead time „zapytanie→oferta" (S)', unit: 'dni', target: 5 }],
    milestones: [{ name: 'Triage S/M/L + SLA wdrożone', months: 3 }, { name: 'Pierwsza biblioteka pakietów', months: 6 }, { name: 'Cennik modułowy v1', months: 9 }] },
  { key: 'N7', sourceInsight: 'I2', title: 'Wydzielenie serwisu od produkcji + capacity planning', axis: 'operational', area: 'Operacje / serwis', priority: 'critical', impact: 'high', effort: 'high', confidence: 'high', valueTiming: 'mid_term', horizonMonths: 12, budget: 220000, ownerEmail: 'jerzy.karbowski@apator.com',
    summary: 'Odblokowanie monetyzacji i stabilizacja serwisu: wydzielona jednostka serwisu, rozbudowa uruchomień (+50–70%), ścieżka junior→senior, apteczki serwisowe, planowanie obłożenia (pipeline→capacity).',
    problem: 'Uruchomienia/serwis to wąskie gardło monetyzacji; serwis spychany przez produkcję (I2).',
    hypothesis: 'Wydzielenie serwisu i capacity planning skrócą lead time uruchomień o 30–40% i podniosą OTIF > 90%.',
    businessValue: 'Wyższy przychód (szybsza monetyzacja), lepsza reputacja, stabilny serwis.',
    deliverables: ['Wydzielona jednostka serwisu', 'Plan rozbudowy uruchomień', 'Ścieżka junior→senior', 'Apteczki serwisowe', 'Capacity planning'],
    successCriteria: ['Lead time uruchomień -30–40%', 'OTIF uruchomień > 90%', 'SLA serwisu odpowiedź < 24h'],
    scopeIn: ['Serwis gwar./pogwar.', 'Uruchomienia'], scopeOut: ['Outsourcing pełnego procesu (ryzyko know-how — N9)'],
    killCriteria: ['Brak rekrutacji i wydzielenia po 6 mies.'], keyRisks: ['Trudna rekrutacja', 'Brak przestrzeni', 'Utrata know-how'], tools: ['Capacity planner', 'Service Desk (N5)'], tags: ['serwis', 'uruchomienia', 'capacity'],
    kpis: [{ name: 'Lead time uruchomień (redukcja)', unit: '%', target: 35, primary: true }, { name: 'OTIF uruchomień', unit: '%', target: 90 }, { name: 'SLA serwisu (odpowiedź)', unit: 'h', target: 24 }],
    milestones: [{ name: 'Decyzja i model wydzielenia', months: 3 }, { name: 'Rozbudowa zespołu + apteczki', months: 6 }, { name: 'Capacity planning operacyjny', months: 12 }] },
  { key: 'N8', sourceInsight: 'I5', title: 'Profesjonalizacja przetargów (de-ryzykowanie)', axis: 'operational', area: 'Przetargi', priority: 'high', impact: 'medium', effort: 'low', confidence: 'high', valueTiming: 'short_term', horizonMonths: 6, budget: 40000, ownerEmail: 'karolina.zasada@apator.com',
    summary: 'Zdjęcie zależności od jednej osoby i świadome wygrywanie: kryteria go/no-go „must-win", koordynator techniczny, repozytorium aktualnych dokumentów formalnych, zastępowalność.',
    problem: 'Przetargi wiszą na jednej osobie, brak selekcji „must-win" (I5).',
    hypothesis: 'Selekcja must-win + repozytorium + koordynator podniosą hit-rate i usuną ryzyko ciągłości.',
    businessValue: 'Więcej wygranych strategicznych przetargów, brak odrzuceń formalnych, ciągłość.',
    deliverables: ['Kryteria go/no-go „must-win"', 'Koordynator techniczny', 'Repozytorium dokumentów formalnych', 'Plan zastępowalności'],
    successCriteria: ['Hit-rate must-win wzrost', 'Brak odrzuceń formalnych', 'Udział postępowań strategicznych ↑'],
    scopeIn: ['Proces przetargowy OSD/PSE'], scopeOut: ['Zmiana progów akceptacji w Grupie (decyzja zarządcza)'],
    killCriteria: ['Brak wdrożenia kryteriów po 3 mies.'], keyRisks: ['Brak zasobów technicznych', 'Nieaktualna dokumentacja'], tools: ['Repozytorium SharePoint', 'Checklisty przetargowe'], tags: ['przetargi', 'must-win', 'ryzyko'],
    kpis: [{ name: 'Hit-rate przetargów must-win', unit: '%', target: 40, primary: true }, { name: 'Odrzucenia formalne', unit: 'szt', target: 0 }],
    milestones: [{ name: 'Kryteria go/no-go wdrożone', months: 2 }, { name: 'Repozytorium dokumentów', months: 4 }, { name: 'Zastępowalność zapewniona', months: 6 }] },
  { key: 'N9', sourceInsight: 'I8', title: 'Bezpieczeństwo know-how i sukcesja', axis: 'compliance', area: 'R&D / podwykonawcy / HR', priority: 'high', impact: 'high', effort: 'medium', confidence: 'high', valueTiming: 'short_term', horizonMonths: 6, budget: 50000, ownerEmail: 'grzegorz.lewociuk@apator.com',
    summary: 'Ochrona łańcucha wartości: umowy ramowe/NDA/non-compete z podwykonawcami i kluczowymi ludźmi, plan sukcesji R&D, baza wiedzy / transfer kompetencji.',
    problem: 'Wysokie ryzyko utraty know-how; podwykonawcy bez umów, sukcesja R&D zagrożona (I8).',
    hypothesis: 'Zabezpieczenia kontraktowe i sukcesja ograniczą ryzyko utraty know-how i marży.',
    businessValue: 'Ciągłość, ochrona marży, ograniczenie „hodowania konkurencji".',
    deliverables: ['Umowy ramowe/NDA/non-compete', 'Plan sukcesji R&D', 'Baza wiedzy / transfer kompetencji'],
    successCriteria: ['% podwykonawców z umową ramową', '% ról krytycznych z planem sukcesji', 'Udokumentowane know-how'],
    scopeIn: ['Podwykonawcy', 'Kluczowi pracownicy', 'R&D'], scopeOut: ['Zmiany w polityce wynagrodzeń (N10)'],
    killCriteria: ['Brak umów z kluczowymi podwykonawcami po 6 mies.'], keyRisks: ['Opór podwykonawców', 'Odejścia przed zabezpieczeniem'], tools: ['Rejestr podwykonawców', 'Baza wiedzy'], tags: ['know-how', 'sukcesja', 'umowy'],
    kpis: [{ name: '% podwykonawców z umową ramową', unit: '%', target: 100, primary: true }, { name: '% ról krytycznych z planem sukcesji', unit: '%', target: 100 }],
    milestones: [{ name: 'Wzory umów + lista kluczowych', months: 2 }, { name: 'Umowy podpisane', months: 4 }, { name: 'Plan sukcesji + baza wiedzy', months: 6 }] },
  { key: 'N10', sourceInsight: 'I7', title: 'System premiowy powiązany z KPI + zarządzanie zmianą', axis: 'transformational', area: 'HR / kultura', priority: 'medium', impact: 'medium', effort: 'medium', confidence: 'medium', valueTiming: 'mid_term', horizonMonths: 12, budget: 60000, ownerEmail: BALUK,
    summary: 'Kultura procesowa zamiast silosowej: premiowy oparty na KPI procesowych/„success fee", szkolenia (obsługa klienta, menedżerskie), plan komunikacji zmiany.',
    problem: 'Premiowy „płaski" demotywuje współpracę międzyprocesową (I7).',
    hypothesis: 'Powiązanie premii z KPI i program zmiany zwiększą współpracę i adopcję procesów.',
    businessValue: 'Lepsza współpraca, mniejszy opór, trwałość zmian.',
    deliverables: ['Model premiowy powiązany z KPI', 'Program szkoleń', 'Plan komunikacji zmiany'],
    successCriteria: ['% premii powiązanej z KPI', 'Adopcja procesów ↑', 'Wyniki ankiet follow-up ↑'],
    scopeIn: ['System premiowy', 'Szkolenia', 'Komunikacja zmiany'], scopeOut: ['Zmiany strukturalne (osobne decyzje)'],
    killCriteria: ['Brak akceptacji modelu premiowego przez zarząd'], keyRisks: ['Wrażliwość tematu wynagrodzeń', 'Opór'], tools: ['Model KPI (N4)'], tags: ['premiowy', 'kultura', 'zmiana'],
    kpis: [{ name: '% premii powiązanej z KPI', unit: '%', target: 50, primary: true }, { name: 'Adopcja procesów (ankieta)', unit: '%', target: 70 }],
    milestones: [{ name: 'Projekt modelu premiowego', months: 3 }, { name: 'Pilotaż + szkolenia', months: 6 }, { name: 'Pełne wdrożenie', months: 12 }] },
];

async function main() {
  const mode = String(process.env.SEED_MODE || '').toLowerCase();
  if (mode !== 'production') throw new Error('Set SEED_MODE=production');
  if (process.env.SEED_CONFIRM !== 'YES_I_UNDERSTAND_PRODUCTION') throw new Error('Set SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION');

  const target = resolveScriptDatabaseTarget({ label: 'seed-elkomtech-ins-init', databaseUrl: process.env.DATABASE_URL, publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL, requireExplicitTarget: true });
  logSelectedDatabaseTarget('seed-elkomtech-ins-init', target);
  process.env.DATABASE_URL = target.connectionString;
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = (await getDatabaseAsync()) as unknown as Db;

  // resolve user ids
  const emails = Array.from(new Set([OWNER_EMAIL, BALUK, ...INITIATIVES.map((i) => i.ownerEmail)]));
  const uMap: Record<string, string> = {};
  for (const e of emails) {
    const r = await db.query<{ id: string }>(`SELECT id FROM users WHERE lower(trim(email))=$1 LIMIT 1`, [e.toLowerCase()]);
    if (r.rows?.[0]?.id) uMap[e] = r.rows[0].id;
  }
  const ownerId = uMap[OWNER_EMAIL];
  if (!ownerId) throw new Error(`Owner ${OWNER_EMAIL} not found`);

  const insCols = await getCols(db, 'interview_insights');
  const initCols = await getCols(db, 'initiatives');
  const hasKpi = await tableExists(db, 'initiative_kpis');
  const kpiCols = hasKpi ? await getCols(db, 'initiative_kpis') : new Set<string>();
  const hasMs = await tableExists(db, 'initiative_milestones');
  const msCols = hasMs ? await getCols(db, 'initiative_milestones') : new Set<string>();
  const hasRaci = await tableExists(db, 'initiative_stakeholders');
  const raciCols = hasRaci ? await getCols(db, 'initiative_stakeholders') : new Set<string>();

  // 1) insights
  const insIds: Record<string, string> = {};
  let insN = 0;
  for (const ins of INSIGHTS) {
    const id = `ii_elkomtech_${ins.key.toLowerCase()}`;
    insIds[ins.key] = id;
    const ok = await upsert(db, 'interview_insights', ['id'], [
      ['id', id], ['organization_id', ORG_ID], ['title', ins.title], ['prompt_type', ins.promptType],
      ['category', 'general'], ['status', 'completed'], ['content', ins.content], ['executive_summary', ins.summary],
      ['source_session_ids', '[]'], ['source_session_count', 0],
      ['issues_json', JSON.stringify(ins.issues)], ['themes_json', '[]'], ['opportunities_json', '[]'],
      ['created_by', ownerId], ['created_at', nowIso()], ['updated_at', nowIso()],
    ], insCols);
    if (ok) insN += 1;
  }

  // 2) initiatives + sub-tables
  let initN = 0, kpiN = 0, msN = 0, raciN = 0;
  for (const ini of INITIATIVES) {
    const id = `init_elkomtech_${ini.key.toLowerCase()}`;
    const ownerBiz = uMap[ini.ownerEmail] || ownerId;
    const sponsor = uMap[BALUK];
    const ok = await upsert(db, 'initiatives', ['id'], [
      ['id', id], ['organization_id', ORG_ID], ['project_id', PROJECT_ID],
      ['name', ini.title], ['title', ini.title], ['axis', ini.axis], ['area', ini.area], ['category', ini.area],
      ['summary', ini.summary], ['description', ini.summary], ['hypothesis', ini.hypothesis], ['problem_statement', ini.problem],
      // DEC-424: 'PLANNING' był poprawny przed migracją P12; initiatives_status_check_p12
      // dopuszcza dziś wyłącznie 7 kodów z server/src/constants/initiativeStatuses.ts.
      ['status', 'PENDING_APPROVAL'], ['priority', ini.priority], ['impact', ini.impact], ['effort', ini.effort],
      ['confidence_level', ini.confidence], ['value_timing', ini.valueTiming], ['business_value', ini.businessValue],
      ['estimated_budget', ini.budget], ['cost_capex', Math.round(ini.budget * 0.4)], ['cost_opex', Math.round(ini.budget * 0.6)],
      ['planned_start_date', nowIso()], ['planned_end_date', plusMonths(ini.horizonMonths)],
      ['deliverables', JSON.stringify(ini.deliverables)], ['success_criteria', JSON.stringify(ini.successCriteria)],
      ['scope_in', JSON.stringify(ini.scopeIn)], ['scope_out', JSON.stringify(ini.scopeOut)],
      ['kill_criteria', JSON.stringify(ini.killCriteria)], ['key_risks', JSON.stringify(ini.keyRisks)],
      ['resource_tools', JSON.stringify(ini.tools)], ['tags', JSON.stringify(ini.tags)],
      ['target_state', JSON.stringify({ description: ini.businessValue })],
      ['owner_business_id', ownerBiz], ['owner_execution_id', ownerId], ['sponsor_id', sponsor],
      ['source_type', 'interview_insight'], ['source_id', insIds[ini.sourceInsight]],
      ['charter_completeness', 100], ['progress', 0], ['ai_generated', 0],
      ['created_by', ownerId], ['updated_by', ownerId], ['created_at', nowIso()], ['updated_at', nowIso()],
    ], initCols);
    if (ok) initN += 1;

    if (hasKpi) {
      let i = 0;
      for (const k of ini.kpis) {
        const okk = await upsert(db, 'initiative_kpis', ['id'], [
          ['id', `kpi_${id}_${i}`], ['initiative_id', id], ['name', k.name], ['description', `${k.name} (cel: ${k.target}${k.unit})`],
          ['target_value', k.target], ['unit', k.unit], ['measurement_frequency', 'MONTHLY'],
          ['is_primary', k.primary ? 1 : 0], ['sort_order', i],
        ], kpiCols);
        if (okk) kpiN += 1;
        i += 1;
      }
    }
    if (hasMs) {
      let i = 0;
      for (const m of ini.milestones) {
        const okm = await upsert(db, 'initiative_milestones', ['id'], [
          ['id', `ms_${id}_${i}`], ['initiative_id', id], ['organization_id', ORG_ID], ['name', m.name],
          ['description', m.name], ['target_date', plusMonths(m.months)], ['status', 'PENDING'], ['order_index', i],
          ['created_by', ownerId],
        ], msCols);
        if (okm) msN += 1;
        i += 1;
      }
    }
    if (hasRaci) {
      const raci: Array<[string, string, string]> = [
        [sponsor || ownerId, 'Sponsor', 'A'],
        [ownerBiz, 'Właściciel biznesowy', 'R'],
        [ownerId, 'Konsultant DBR', 'C'],
      ];
      let i = 0;
      for (const [uid, role, t] of raci) {
        if (!uid) { i += 1; continue; }
        const okr = await upsert(db, 'initiative_stakeholders', ['id'], [
          ['id', `raci_${id}_${i}`], ['initiative_id', id], ['user_id', uid], ['role', role], ['raci_type', t], ['created_by', ownerId],
        ], raciCols);
        if (okr) raciN += 1;
        i += 1;
      }
    }
  }

  logger.info('[seed-elkomtech-ins-init] ✅ done', { insights: insN, initiatives: initN, kpis: kpiN, milestones: msN, raci: raciN });
  // eslint-disable-next-line no-console
  console.log(`\n✅ Elkomtech: wnioski=${insN}/10, inicjatywy=${initN}/10, KPI=${kpiN}, kamienie=${msN}, RACI=${raciN}\n`);
}

main().catch((e) => { console.error('[seed-elkomtech-ins-init] Failed:', e); process.exit(1); });
