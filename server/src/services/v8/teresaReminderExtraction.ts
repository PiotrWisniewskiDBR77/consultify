/**
 * teresaReminderExtraction — lekka ekstrakcja terminu przypomnienia z wiadomości
 * użytkownika dla ścieżki „zapamiętaj / przypomnij mi" (#21, Notatnik = centrum myśli).
 *
 * Zero zależności zewnętrznych, zero LLM — regex + arytmetyka dat. Zwraca ISO
 * (dueAt) gdy w treści jest czytelna wskazówka czasowa, oraz surowy `term` do
 * pokazania w karcie propozycji Teresy. Brak wskazówki → { dueAt:null }.
 *
 * REUŻYCIE: wynik ląduje w notebook_handoff_context.reminder i dalej w
 * capture_metadata.reminder notatki (bez migracji — kolumna JSON już istnieje).
 */

export interface ReminderExtractionResult {
  /** ISO-8601 termin przypomnienia, jeśli udało się wyliczyć. */
  dueAt: string | null;
  /** Surowa fraza czasowa z wiadomości (np. „jutro", „za 3 dni", „w piątek"). */
  term: string | null;
  /** Czy wiadomość w ogóle zawiera intencję „przypomnij/zapamiętaj". */
  hasReminderCue: boolean;
}

const REMINDER_CUE =
  /\b(przypomnij|przypomnienie|przypomina|zapami[eę]taj|zapami[eę]tam|nie zapomnij|remind\s*me|remind|remember|don'?t forget)\b/i;

// Dni tygodnia PL/EN → indeks (0=niedziela … 6=sobota), zgodnie z Date.getDay().
const WEEKDAYS: Array<{ idx: number; patterns: RegExp }> = [
  { idx: 1, patterns: /\b(poniedzia[łl]\w*|monday)\b/i },
  { idx: 2, patterns: /\b(wtorek|wtorku|tuesday)\b/i },
  { idx: 3, patterns: /\b([śs]rod[aęy]\w*|wednesday)\b/i },
  { idx: 4, patterns: /\b(czwartek|czwartku|thursday)\b/i },
  { idx: 5, patterns: /\b(pi[ąa]tek|pi[ąa]tku|friday)\b/i },
  { idx: 6, patterns: /\b(sobot[aęy]\w*|saturday)\b/i },
  { idx: 0, patterns: /\b(niedziel\w*|sunday)\b/i },
];

function atNineLocal(base: Date): Date {
  const d = new Date(base);
  d.setHours(9, 0, 0, 0);
  return d;
}

function nextWeekday(from: Date, targetIdx: number): Date {
  const d = new Date(from);
  const cur = d.getDay();
  let delta = (targetIdx - cur + 7) % 7;
  if (delta === 0) delta = 7; // „w piątek" gdy dziś piątek → następny piątek
  d.setDate(d.getDate() + delta);
  return atNineLocal(d);
}

/**
 * Wyciąga termin przypomnienia z treści. `now` wstrzykiwalne dla testów.
 */
export function extractReminder(message: string, now: Date = new Date()): ReminderExtractionResult {
  const text = String(message || '');
  const hasReminderCue = REMINDER_CUE.test(text);

  const empty: ReminderExtractionResult = { dueAt: null, term: null, hasReminderCue };
  if (!text.trim()) return empty;

  // 1) „dziś / today", „jutro / tomorrow", „pojutrze"
  if (/\b(pojutrze|day after tomorrow)\b/i.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return { dueAt: atNineLocal(d).toISOString(), term: 'pojutrze', hasReminderCue };
  }
  if (/\b(jutro|tomorrow)\b/i.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return { dueAt: atNineLocal(d).toISOString(), term: 'jutro', hasReminderCue };
  }
  if (/\b(dzi[śs]iaj|dzi[śs]|today|tonight|wieczorem)\b/i.test(text)) {
    return { dueAt: atNineLocal(now).toISOString(), term: 'dziś', hasReminderCue };
  }

  // 2) „za N dni/tygodni/godzin" / „in N days/weeks/hours"
  const relPl = text.match(/\bza\s+(\d{1,3})\s+(godzin\w*|dni|dzie[ńn]|tydzie[ńn]|tygodni\w*|miesi[ąa]c\w*)/i);
  const relEn = text.match(/\bin\s+(\d{1,3})\s+(hours?|days?|weeks?|months?)\b/i);
  const rel = relPl || relEn;
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2].toLowerCase();
    const d = new Date(now);
    if (/godzin|hour/.test(unit)) {
      d.setHours(d.getHours() + n);
      return { dueAt: d.toISOString(), term: rel[0], hasReminderCue };
    }
    if (/tydzie|tygodni|week/.test(unit)) d.setDate(d.getDate() + n * 7);
    else if (/miesi|month/.test(unit)) d.setMonth(d.getMonth() + n);
    else d.setDate(d.getDate() + n);
    return { dueAt: atNineLocal(d).toISOString(), term: rel[0], hasReminderCue };
  }

  // 3) „w piątek / on friday" (najbliższy dzień tygodnia)
  for (const wd of WEEKDAYS) {
    const m = text.match(wd.patterns);
    if (m) {
      return { dueAt: nextWeekday(now, wd.idx).toISOString(), term: m[0], hasReminderCue };
    }
  }

  // 4) Konkretna data YYYY-MM-DD lub DD.MM(.YYYY)
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(d.getTime())) {
      return { dueAt: atNineLocal(d).toISOString(), term: iso[0], hasReminderCue };
    }
  }
  const dmy = text.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const mon = Number(dmy[2]) - 1;
    let year = dmy[3] ? Number(dmy[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, mon, day);
    if (!Number.isNaN(d.getTime()) && day <= 31 && mon <= 11) {
      return { dueAt: atNineLocal(d).toISOString(), term: dmy[0], hasReminderCue };
    }
  }

  return empty;
}
