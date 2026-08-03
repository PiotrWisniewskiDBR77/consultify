/**
 * cardAnalysisService — silnik „Analizuj z AI" (ETAP 3 standardu n-Type).
 *
 * Buduje prompt z CZTERECH składników wymaganych przez kontrakt właściciela
 * (2026-07-23), wywołuje LLM i normalizuje odpowiedź do `CardAnalysisResult`.
 *
 * ── PUNKT PODPIĘCIA BACKENDU: `/api/ai/generate` (ISTNIEJĄCY) ────────────────
 * NIE dokładamy endpointu. Używamy tego, co jest i działa:
 *   server/src/routes/ai.routes.ts:5828  POST /api/ai/generate
 *     body  { message: ≤32000, systemInstruction?: ≤16000, roleName? }
 *           (walidacja: server/src/validators/ai.validators.ts:566 AiGenerateRequestSchema)
 *     zwraca { text }   ← czysty tekst modelu, po `llmService.callText`
 *     błędy  { error, code } z `mapLlmCallError` (+ 502 EMPTY_LLM_RESPONSE)
 *
 * ★ DLACZEGO NIE `/api/ai/chat`: mimo że kilkanaście miejsc w `src/` woła
 *   `Api.post('/ai/chat', …)` i czyta `res.text`, ten endpoint (ai.routes.ts:5885)
 *   zwraca ORKIESTRATOR: `{ role, intent, contextSummary, prompt, policyLevel }`
 *   — pola `text` ani `content` tam NIE MA. Odziedziczenie tego wzorca dałoby
 *   panel, który zawsze pokazuje „AI nie zwróciło wyniku". `/api/ai/generate`
 *   zwraca `{ text }` wprost i jest jedynym uczciwym wyborem. (Sprawdzone grepem
 *   w realnym kodzie routera, nie w dokumentacji — CLAUDE.md złota reguła #1.)
 *
 * ── ZAKAZ NADPISANIA ─────────────────────────────────────────────────────────
 * Ten moduł nie ma dostępu do żadnego settera karty. Zwraca dane. Kropka.
 */

import { Api } from '@/services/api';

import {
  buildCardStandard,
  completenessBandsFor,
  criteriaFor,
  doctrineFor,
  severityAnchorsFor,
} from './cardAnalysisRubric';
import type {
  CardAnalysisChange,
  CardAnalysisField,
  CardAnalysisFinding,
  CardAnalysisInput,
  CardAnalysisResult,
  CardAnalysisSeverity,
} from './cardAnalysisTypes';

/** Twarde limity endpointu — przycinamy PO NASZEJ stronie, żeby nie dostać 400. */
const MAX_MESSAGE_CHARS = 30_000; // zapas wobec 32000 z AiGenerateRequestSchema
const MAX_CONTEXT_CHARS = 8_000;
const MAX_FIELD_CHARS = 4_000;

/** Maks. pozycji w jednej szufladzie wyniku — limit z kontraktu („lepiej mniej"). */
const MAX_ITEMS_PER_BUCKET = 6;

/**
 * Ucięcie z widocznym znacznikiem — model ma WIEDZIEĆ, że kontekst jest przycięty.
 * Znacznik idzie W JĘZYKU PRZEBIEGU: polski marker w promptcie angielskim był
 * jedynym polskim zdaniem w całym wsadzie i sam w sobie łamał regułę języka,
 * którą ten prompt egzekwuje.
 */
function clip(text: string, max: number, isPolish: boolean): string {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  const cut = s.length - max;
  return isPolish
    ? `${s.slice(0, max)}\n…[przycięto ${cut} znaków]`
    : `${s.slice(0, max)}\n…[truncated ${cut} characters]`;
}

/**
 * ŚCISŁE czytanie wagi. `null` = model wagi NIE PODAŁ (albo podał śmieć).
 *
 * ── DLACZEGO NIE ODRZUCAMY POZYCJI BEZ WAGI ──────────────────────────────────
 * Kuszące jest wymusić pole i wyrzucić pozycję bez niego. Odrzucona pozycja
 * znika jednak BEZ ŚLADU — panel pokaże krótszą listę braków, a użytkownik
 * przeczyta to jako „karta czystsza, niż jest". To dokładnie ta jedna awaria,
 * której ten moduł nie może mieć (uczciwość > kompletność). Dlatego:
 *   · prompt czyni `severity` polem OBOWIĄZKOWYM z kotwicami (`SEVERITY_ANCHORS`),
 *   · brak wagi NIE jest zamiatany domyślnym `medium` (dawne zachowanie —
 *     płaska lista bez priorytetu, dokładnie wada #7),
 *   · pozycja bez wagi dostaje `low` (nigdy nie zawyżamy), ląduje NA KOŃCU
 *     listy i niesie w `detail` jawny dopisek, że wagi nie było.
 * Użytkownik widzi i pozycję, i to, że AI nie umiało jej zważyć.
 */
function severityOf(raw: unknown): CardAnalysisSeverity | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === 'high' || s === 'wysoki' || s === 'wysoka' || s === 'wysokie' || s === 'critical')
    return 'high';
  if (s === 'medium' || s === 'sredni' || s === 'średni' || s === 'średnia' || s === 'średnie')
    return 'medium';
  if (s === 'low' || s === 'niski' || s === 'niska' || s === 'niskie') return 'low';
  return null;
}

/** Kolejność wagi w liście. 3 = waga nieokreślona → zawsze na końcu. */
const SEVERITY_RANK: Record<CardAnalysisSeverity, number> = { high: 0, medium: 1, low: 2 };
const RANK_UNSPECIFIED = 3;

const MISSING_SEVERITY_NOTE = {
  pl: '[waga nieokreślona przez AI — pozycja niesklasyfikowana, oceń ją ręcznie]',
  en: '[severity not returned by the AI — item unranked, judge it manually]',
} as const;

/**
 * Klucz porównawczy do deduplikacji: bez wielkości liter, bez ogonków, bez
 * interpunkcji. „Brak właściciela ryzyka." i „brak wlasciciela ryzyka" to jedna
 * pozycja, nie dwie.
 */
function normKey(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PL =
  'Jesteś recenzentem jakości artefaktów doradczych (poziom BCG/McKinsey). ' +
  'Oceniasz JEDNĄ kartę artefaktu wobec podanego standardu, kryteriów i doktryny. ' +
  'Zwracasz WYŁĄCZNIE poprawny JSON — bez markdown, bez komentarza. ' +
  'NIGDY nie wymyślasz faktów, liczb ani źródeł; gdy czegoś brakuje, nazywasz to brakiem. ' +
  'Każda liczba w proponowanej treści musi mieć marker niepewności ("szacunek:", "założenie:") ' +
  'chyba że wynika wprost z podanego kontekstu. ' +
  'Recenzujesz PRZECIW karcie, nie dla jej autora: pochwała nie jest wynikiem. ' +
  'Każde zgłoszenie ma wskazywać konkretny fragment lub konkretny brak, nigdy wrażenie. ' +
  'Zdanie, którego nie da się obalić, jest wadą, nawet gdy brzmi mądrze.';

const SYSTEM_EN =
  'You are a quality reviewer of consulting artifacts (BCG/McKinsey level). ' +
  'You assess ONE card of an artifact against the given standard, criteria and doctrine. ' +
  'You return ONLY valid JSON — no markdown, no commentary. ' +
  'You NEVER invent facts, numbers or sources; when something is missing you name it as a gap. ' +
  'Every number in proposed content must carry an uncertainty marker ("estimate:", "assumption:") ' +
  'unless it follows directly from the supplied context. ' +
  'You review AGAINST the card, not for its author: praise is not an output. ' +
  'Every item must point at a concrete fragment or a concrete absence, never at an impression. ' +
  'A sentence that cannot be disproven is a defect, however clever it sounds.';

/** Serializacja pól karty — z jawnym oznaczeniem pól PUSTYCH i tylko-do-odczytu. */
function renderFields(fields: CardAnalysisField[], isPolish: boolean): string {
  if (fields.length === 0) {
    return isPolish
      ? '(karta nie zadeklarowała żadnych pól treści)'
      : '(the card declared no content fields)';
  }
  return fields
    .map((f) => {
      const value = clip(String(f.value ?? '').trim(), MAX_FIELD_CHARS, isPolish);
      const emptyMark = value ? '' : isPolish ? '  <<< PUSTE' : '  <<< EMPTY';
      const writeMark = f.writable
        ? ''
        : isPolish
          ? '  [tylko do odczytu — nie proponuj tu zmian treści]'
          : '  [read-only — do not propose content changes here]';
      const hint = f.hint ? `\n  # ${f.hint}` : '';
      return [
        `--- ${isPolish ? 'POLE' : 'FIELD'} id="${f.id}" ${isPolish ? 'nazwa' : 'name'}="${f.label}" ${isPolish ? 'rodzaj' : 'kind'}="${f.kind ?? 'text'}"${emptyMark}${writeMark}${hint}`,
        value || '(—)',
      ].join('\n');
    })
    .join('\n');
}

/**
 * Kształt odpowiedzi. `severity` i `criterionId` są opisane jako WYMAGANE —
 * parser i tak je egzekwuje (patrz `severityOf`), a zgodność promptu z parserem
 * jest tańsza niż tłumaczenie użytkownikowi, czemu połowa pozycji jest „low".
 */
function schemaHint(isPolish: boolean): string {
  const verdict = isPolish ? 'jedno zdanie' : 'one sentence';
  const fieldRef = isPolish ? '<id z listy PÓL>' : '<id from the FIELD list>';
  const req = isPolish ? 'WYMAGANE' : 'REQUIRED';
  return [
    '{',
    `  "completeness": 0-100,   // ${isPolish ? 'wg pasm KALIBRACJI, zaokrąglone do pełnych 5' : 'per the CALIBRATION bands, rounded to a multiple of 5'}`,
    `  "verdict": "${verdict}",`,
    `  "gaps":        [{"title":"…","detail":"…","criterionId":"…"/*${req}*/,"severity":"high|medium|low"/*${req}*/}],`,
    '  "risks":       [{"title":"…","detail":"…","criterionId":"…","severity":"high|medium|low"}],',
    '  "suggestions": [{"title":"…","detail":"…","criterionId":"…","severity":"high|medium|low"}],',
    `  "changes":     [{"fieldId":"${fieldRef}","rationale":"…","proposedValue":"…",`,
    '                   "mode":"replace|append","criterionId":"…","severity":"high|medium|low"}]',
    '}',
  ].join('\n');
}

/** Buduje treść zapytania. Wyeksportowane, żeby dało się je zobaczyć w teście/dev. */
export function buildAnalysisPrompt(input: CardAnalysisInput): {
  system: string;
  message: string;
} {
  const { artifactType, cardId, artifactTitle, artifactContext, fields, isPolish } = input;

  const std = buildCardStandard(artifactType, cardId, cardId, isPolish);
  const criteria = criteriaFor(artifactType, isPolish);
  const doctrine = doctrineFor(isPolish);
  const bands = completenessBandsFor(isPolish);
  const anchors = severityAnchorsFor(isPolish);
  const writableIds = fields.filter((f) => f.writable).map((f) => f.id);

  const L = isPolish
    ? {
        head: 'ZADANIE: oceń AKTYWNĄ KARTĘ artefaktu wobec jej celu, standardu treści, kryteriów typu artefaktu i doktryny.',
        card: 'KARTA (aktywna)',
        purpose: 'CEL KARTY (kanon kart)',
        standard: 'STANDARD TREŚCI — co ta karta powinna zawierać (kanon kart)',
        noStandard:
          'Kanon NIE deklaruje opisu ani szablonu treści tej karty. NIE wymyślaj wymagań — ' +
          'oceniaj wyłącznie wobec kryteriów typu artefaktu, doktryny i wobec tego, co karta faktycznie zawiera.',
        aiRole: 'ROLA AI wobec tej karty (kanon)',
        criteria: 'KRYTERIA OCENY (typ artefaktu — kontrakt właściciela)',
        met: 'SPEŁNIONE GDY',
        fails: 'NIESPEŁNIONE GDY',
        noCriteria: 'Dla tego typu artefaktu nie zadeklarowano kryteriów.',
        doctrine: 'DOKTRYNA — obowiązuje NIEZALEŻNIE od typu artefaktu',
        rule: 'REGUŁA',
        violation: 'NARUSZENIE',
        doctrineNote:
          'Naruszenie doktryny ZGŁASZAJ JAKO GAP (pozycja w "gaps") z "criterionId" równym id reguły — ' +
          'wyjątek: sprzeczne wartości tej samej metryki idą do "risks" z "severity":"high". ' +
          'Doktryna jest nadrzędna: karta spełniająca wszystkie kryteria typu, ale łamiąca doktrynę, NIE jest gotowa.',
        calibration: 'KALIBRACJA OCENY "completeness" — pasma wiążące',
        calibrationNote:
          'Wybierz pasmo po LIŚCIE ZNALEZISK, którą właśnie zbudowałeś, nie po wrażeniu. ' +
          'Zaokrąglij do pełnych 5 — precyzja co do 1 punktu jest udawana.',
        severity: 'WAGA "severity" — pole OBOWIĄZKOWE przy KAŻDEJ pozycji',
        severityNote:
          'Pozycja bez "severity" zostanie oznaczona jako niesklasyfikowana i zeszeregowana na koniec listy. ' +
          'Nie nadawaj "high" pozycjom, które nie blokują — inflacja wagi kasuje priorytet.',
        content: 'AKTUALNA ZAWARTOŚĆ KARTY',
        context: 'KONTEKST CAŁEGO ARTEFAKTU',
        rules: 'ZASADY',
        r: [
          'Oceniaj TYLKO aktywną kartę. Kontekst artefaktu służy do wykrycia NIESPÓJNOŚCI, nie do oceny innych kart.',
          '„gaps" = czego karta nie ma, a standard, kryteria lub doktryna tego wymagają.',
          '„risks" = niespójności, sprzeczności (także z kontekstem artefaktu), zagrożenia gotowości.',
          '„suggestions" = rekomendowane ROZWINIĘCIA — nie braki, tylko wzmocnienia.',
          '„changes" = KONKRETNA treść gotowa do wstawienia. Każda zmiana MUSI mieć "fieldId" z listy PÓL.',
          'Każda pozycja MUSI wskazywać konkretny fragment karty (zacytuj go w "detail") albo konkretny brak. ' +
            'Pozycja typu „warto rozważyć rozbudowę opisu" jest bezwartościowa — nie zgłaszaj jej.',
          'ŻADNA pozycja nie powtarza się w wyniku. Ten sam brak wpisz RAZ, w najostrzejszej szufladzie ' +
            '(kolejność: gaps > risks > suggestions) — powtórzenie zjada limit i ukrywa inne wady.',
          `Pola, do których wolno proponować zmiany: ${writableIds.length ? writableIds.join(', ') : '(BRAK — nie proponuj żadnych "changes")'}.`,
          'Nie proponuj zmian do pól oznaczonych [tylko do odczytu].',
          '"mode":"append" gdy dopisujesz pozycję do listy; "replace" gdy przepisujesz całość pola.',
          `Maks. ${MAX_ITEMS_PER_BUCKET} pozycji w każdej z czterech list. Lepiej mniej i konkretnie.`,
          'Gdy karta jest pusta — powiedz to wprost w "verdict", a "completeness" ustaw wg pasma „< 50" (nie więcej niż 10).',
          'Pisz po polsku — bez kalek i wtrętów angielskich (patrz reguła doktryny doktryna-jezyk).',
        ],
        criterionNote:
          'Do KAŻDEJ pozycji dodaj "criterionId" — dokładny id z listy kryteriów powyżej albo id reguły doktryny. ' +
          'Pozycja bez "criterionId" jest opinią, nie pomiarem wobec standardu.',
        schema: 'ZWRÓĆ WYŁĄCZNIE JSON W TYM KSZTAŁCIE',
      }
    : {
        head: 'TASK: assess the ACTIVE CARD of an artifact against its purpose, content standard, the artifact-type criteria and the doctrine.',
        card: 'CARD (active)',
        purpose: 'CARD PURPOSE (card canon)',
        standard: 'CONTENT STANDARD — what this card should contain (card canon)',
        noStandard:
          'The canon does NOT declare a description or content template for this card. Do NOT invent ' +
          'requirements — assess only against the artifact-type criteria, the doctrine and what the card actually contains.',
        aiRole: 'AI ROLE for this card (canon)',
        criteria: 'ASSESSMENT CRITERIA (artifact type — owner contract)',
        met: 'MET WHEN',
        fails: 'FAILS WHEN',
        noCriteria: 'No criteria are declared for this artifact type.',
        doctrine: 'DOCTRINE — applies REGARDLESS of artifact type',
        rule: 'RULE',
        violation: 'VIOLATION',
        doctrineNote:
          'Report a doctrine violation AS A GAP (an item in "gaps") with "criterionId" equal to the rule id — ' +
          'except conflicting values of the same metric, which go to "risks" with "severity":"high". ' +
          'The doctrine overrides: a card meeting every type criterion but breaking the doctrine is NOT ready.',
        calibration: 'CALIBRATION OF "completeness" — binding bands',
        calibrationNote:
          'Pick the band from the FINDING LIST you have just built, not from an impression. ' +
          'Round to a multiple of 5 — single-point precision is pretend precision.',
        severity: '"severity" — a REQUIRED field on EVERY item',
        severityNote:
          'An item with no "severity" will be marked unranked and pushed to the end of the list. ' +
          'Do not award "high" to items that do not block — severity inflation destroys priority.',
        content: 'CURRENT CARD CONTENT',
        context: 'CONTEXT OF THE WHOLE ARTIFACT',
        rules: 'RULES',
        r: [
          'Assess ONLY the active card. The artifact context serves to detect INCONSISTENCIES, not to grade other cards.',
          '"gaps" = what the card lacks that the standard, the criteria or the doctrine require.',
          '"risks" = inconsistencies, contradictions (including with the artifact context), readiness threats.',
          '"suggestions" = recommended EXPANSIONS — not gaps, but reinforcements.',
          '"changes" = CONCRETE content ready to insert. Every change MUST carry a "fieldId" from the FIELD list.',
          'Every item MUST point at a concrete fragment of the card (quote it in "detail") or a concrete absence. ' +
            'An item like "consider expanding the description" is worthless — do not report it.',
          'NO item may repeat in the result. State the same defect ONCE, in the sharpest bucket ' +
            '(order: gaps > risks > suggestions) — repetition eats the limit and hides other defects.',
          `Fields you may propose changes for: ${writableIds.length ? writableIds.join(', ') : '(NONE — do not propose any "changes")'}.`,
          'Do not propose changes for fields marked [read-only].',
          '"mode":"append" when adding an item to a list; "replace" when rewriting the whole field.',
          `Max ${MAX_ITEMS_PER_BUCKET} items in each of the four lists. Fewer and sharper is better.`,
          'When the card is empty — say so plainly in "verdict" and set "completeness" per the "< 50" band (at most 10).',
          'Write in English — no untranslated foreign terms (see doctrine rule doktryna-jezyk).',
        ],
        criterionNote:
          'Add a "criterionId" to EVERY item — the exact id from the criteria list above or a doctrine rule id. ' +
          'An item without "criterionId" is an opinion, not a measurement against the standard.',
        schema: 'RETURN ONLY JSON IN THIS SHAPE',
      };

  const parts: string[] = [
    L.head,
    '',
    `${L.card}: "${std.label}" (id: ${cardId})`,
    `${isPolish ? 'ARTEFAKT' : 'ARTIFACT'}: ${artifactType} — "${artifactTitle}"`,
    '',
  ];

  if (std.purpose) parts.push(`=== ${L.purpose} ===`, std.purpose, '');
  if (std.standard) parts.push(`=== ${L.standard} ===`, std.standard, '');
  if (!std.standardZnany) parts.push(`=== ${L.standard} ===`, L.noStandard, '');
  parts.push(`${L.aiRole}: ${std.aiRole}`, '');

  // Kryteria: oś BEZ progu jest tylko nazwą i produkuje ogólniki. Każde kryterium
  // idzie więc z progiem spełnienia i progiem odcięcia.
  parts.push(`=== ${L.criteria} ===`);
  parts.push(
    criteria.length
      ? criteria
          .map((c) =>
            [
              `- ${c.id} — ${c.text}`,
              `    ${L.met}: ${c.definition}`,
              `    ${L.fails}: ${c.failsWhen}`,
            ].join('\n')
          )
          .join('\n')
      : L.noCriteria
  );
  parts.push('', L.criterionNote, '');

  parts.push(`=== ${L.doctrine} ===`);
  parts.push(
    doctrine
      .map((d, i) =>
        [
          `${i + 1}. ${d.name}  [criterionId: ${d.id}]`,
          `    ${L.rule}: ${d.rule}`,
          `    ${L.violation}: ${d.violation}`,
        ].join('\n')
      )
      .join('\n')
  );
  parts.push('', L.doctrineNote, '');

  parts.push(`=== ${L.content} ===`, renderFields(fields, isPolish), '');

  const ctx = clip(String(artifactContext ?? '').trim(), MAX_CONTEXT_CHARS, isPolish);
  if (ctx) parts.push(`=== ${L.context} ===`, ctx, '');

  parts.push(`=== ${L.calibration} ===`);
  parts.push(bands.map((b) => `${b.label}: ${b.meaning}`).join('\n'));
  parts.push('', L.calibrationNote, '');

  parts.push(`=== ${L.severity} ===`);
  parts.push(anchors.map((a) => `${a.level}: ${a.meaning}`).join('\n'));
  parts.push('', L.severityNote, '');

  parts.push(`=== ${L.rules} ===`, L.r.map((r, i) => `${i + 1}. ${r}`).join('\n'), '');
  parts.push(`=== ${L.schema} ===`, schemaHint(isPolish));

  return {
    system: isPolish ? SYSTEM_PL : SYSTEM_EN,
    message: clip(parts.join('\n'), MAX_MESSAGE_CHARS, isPolish),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsowanie
// ─────────────────────────────────────────────────────────────────────────────

/** Wyłuskuje pierwszy obiekt JSON z odpowiedzi (model bywa gadatliwy mimo zakazu). */
function extractJson(raw: string): unknown {
  const text = String(raw ?? '').trim();
  if (!text) throw new Error('EMPTY_RESPONSE');

  // Zdejmij płotek ```json … ``` gdy model go jednak dołożył.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;

  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('NO_JSON');
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Rejestr już przyjętych pozycji — WSPÓLNY dla `gaps`, `risks` i `suggestions`.
 *
 * Bez tego ten sam brak („ryzyko bez właściciela") potrafił wystąpić trzy razy:
 * raz jako brak, raz jako ryzyko, raz jako sugestia — i sam zjadał połowę
 * limitu sześciu pozycji, wypychając z wyniku wady, których nikt nie zobaczył.
 * Pierwszeństwo ma szuflada ostrzejsza, bo listy są przetwarzane w kolejności
 * kontraktu: gaps → risks → suggestions.
 */
type SeenKeys = Set<string>;

/** Klucze, po których poznajemy duplikat: tytuł ORAZ początek uzasadnienia. */
function findingKeys(title: string, detail: string): string[] {
  const keys: string[] = [];
  const t = normKey(title);
  const d = normKey(detail).slice(0, 120);
  if (t) keys.push(`t:${t}`);
  if (d) keys.push(`d:${d}`);
  return keys;
}

function toFindings(
  raw: unknown,
  prefix: string,
  seen: SeenKeys,
  isPolish: boolean
): CardAnalysisFinding[] {
  if (!Array.isArray(raw)) return [];

  // 1) Mapowanie BEZ obcinania — limit stosujemy dopiero po deduplikacji, żeby
  //    duplikat nie zabierał miejsca realnej wadzie.
  const ranked: Array<{ finding: CardAnalysisFinding; rank: number; order: number }> = [];

  raw.forEach((item, i) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const title = String(o.title ?? '').trim();
    const detailRaw = String(o.detail ?? '').trim();
    if (!title && !detailRaw) return;

    const keys = findingKeys(title || detailRaw, detailRaw || title);
    if (keys.some((k) => seen.has(k))) return; // duplikat — w tej lub wcześniejszej szufladzie
    keys.forEach((k) => seen.add(k));

    const severity = severityOf(o.severity);
    const detail = severity
      ? detailRaw || title
      : `${detailRaw || title} ${isPolish ? MISSING_SEVERITY_NOTE.pl : MISSING_SEVERITY_NOTE.en}`.trim();

    const finding: CardAnalysisFinding = {
      id: `${prefix}-${i}`,
      title: title || detailRaw.slice(0, 80),
      detail,
      severity: severity ?? 'low',
    };
    const criterionId = String(o.criterionId ?? '').trim();

    ranked.push({
      finding: criterionId ? { ...finding, criterionId } : finding,
      rank: severity ? SEVERITY_RANK[severity] : RANK_UNSPECIFIED,
      order: i,
    });
  });

  // 2) Porządek wagi. Panel rysuje tylko kropkę koloru i nie sortuje niczego —
  //    bez tego „high" potrafiło stać pod trzema „low", czyli lista miała wagi,
  //    ale nie miała priorytetu.
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);

  return ranked.slice(0, MAX_ITEMS_PER_BUCKET).map((r) => r.finding);
}

function toChanges(
  raw: unknown,
  fields: CardAnalysisField[],
  isPolish: boolean
): CardAnalysisChange[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map(fields.map((f) => [f.id, f]));
  // Zmiany deduplikujemy WŁASNYM kluczem (pole + treść) — ta sama propozycja do
  // tego samego pola dwa razy to jedna zmiana, ale ta sama treść do DWÓCH
  // różnych pól bywa uprawniona, więc pole wchodzi do klucza.
  const seenChanges = new Set<string>();

  const ranked: Array<{ change: CardAnalysisChange; rank: number; order: number }> = [];

  raw.forEach((item, i) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const fieldId = String(o.fieldId ?? '').trim();
    const proposedValue = String(o.proposedValue ?? '').trim();
    if (!proposedValue) return;

    const key = `${normKey(fieldId)}|${normKey(proposedValue).slice(0, 160)}`;
    if (seenChanges.has(key)) return;
    seenChanges.add(key);

    const field = byId.get(fieldId);
    const mode = String(o.mode ?? '').toLowerCase() === 'append' ? 'append' : 'replace';
    const severity = severityOf(o.severity);
    const rationaleRaw = String(o.rationale ?? '').trim();

    const change: CardAnalysisChange = {
      id: `chg-${i}`,
      fieldId,
      // Nieznane `fieldId` NIE jest naprawiane zgadywaniem pola — panel pokaże
      // pozycję jako „propozycja bez celu" i zablokuje „Zastosuj".
      fieldLabel: field?.label ?? fieldId,
      rationale: severity
        ? rationaleRaw
        : `${rationaleRaw} ${isPolish ? MISSING_SEVERITY_NOTE.pl : MISSING_SEVERITY_NOTE.en}`.trim(),
      currentValue: String(field?.value ?? ''),
      proposedValue,
      mode,
      severity: severity ?? 'low',
    };
    const criterionId = String(o.criterionId ?? '').trim();

    ranked.push({
      change: criterionId ? { ...change, criterionId } : change,
      rank: severity ? SEVERITY_RANK[severity] : RANK_UNSPECIFIED,
      order: i,
    });
  });

  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);

  return ranked.slice(0, MAX_ITEMS_PER_BUCKET).map((r) => r.change);
}

function clampCompleteness(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Wywołanie
// ─────────────────────────────────────────────────────────────────────────────

/** Kody błędów, które panel tłumaczy na komunikat dla człowieka. */
export type CardAnalysisErrorCode = 'EMPTY_RESPONSE' | 'NO_JSON' | 'BAD_JSON' | 'REQUEST_FAILED';

export class CardAnalysisError extends Error {
  readonly code: CardAnalysisErrorCode;
  /** Kod z backendu (np. AI_BUDGET_EXHAUSTED, EMPTY_LLM_RESPONSE), gdy był. */
  readonly serverCode?: string;

  constructor(code: CardAnalysisErrorCode, message: string, serverCode?: string) {
    super(message);
    this.name = 'CardAnalysisError';
    this.code = code;
    if (serverCode) this.serverCode = serverCode;
  }
}

/**
 * Analizuje aktywną kartę. Rzuca `CardAnalysisError` — panel pokazuje uczciwy
 * powód, NIE cichy „brak wyniku".
 */
export async function analyzeCard(input: CardAnalysisInput): Promise<CardAnalysisResult> {
  const { system, message } = buildAnalysisPrompt(input);

  let raw = '';
  try {
    const res = await Api.post('/ai/generate', {
      message,
      systemInstruction: system,
      roleName: 'Card Quality Reviewer',
    });
    raw = String(res?.text ?? '').trim();
  } catch (err) {
    const serverCode =
      (err as { code?: string })?.code ??
      (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
    throw new CardAnalysisError(
      'REQUEST_FAILED',
      (err as Error)?.message || 'AI request failed',
      serverCode
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(raw) as Record<string, unknown>;
  } catch (err) {
    const code = (err as Error)?.message;
    throw new CardAnalysisError(
      code === 'EMPTY_RESPONSE' ? 'EMPTY_RESPONSE' : code === 'NO_JSON' ? 'NO_JSON' : 'BAD_JSON',
      `AI response could not be parsed (${code})`
    );
  }

  const std = buildCardStandard(input.artifactType, input.cardId, input.cardId, input.isPolish);

  // Jeden rejestr na cały wynik ⇒ deduplikacja MIĘDZY szufladami. Kolejność
  // wywołań jest kolejnością pierwszeństwa z kontraktu (gaps > risks > suggestions).
  const seen: SeenKeys = new Set<string>();

  return {
    artifactType: input.artifactType,
    cardId: input.cardId,
    cardLabel: std.label,
    completeness: clampCompleteness(parsed.completeness),
    verdict: String(parsed.verdict ?? '').trim(),
    gaps: toFindings(parsed.gaps, 'gap', seen, input.isPolish),
    risks: toFindings(parsed.risks, 'risk', seen, input.isPolish),
    suggestions: toFindings(parsed.suggestions, 'sug', seen, input.isPolish),
    changes: toChanges(parsed.changes, input.fields, input.isPolish),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Scalanie treści przy „Zastosuj". Wspólne dla wszystkich sześciu kart, żeby
 * „append" znaczyło wszędzie to samo (nowa linia, bez duplikatu, bez zjadania
 * istniejącej treści).
 */
export function mergeChangeValue(change: CardAnalysisChange, currentValue: string): string {
  const current = String(currentValue ?? '');
  const proposed = String(change.proposedValue ?? '').trim();
  if (change.mode === 'replace') return proposed;
  if (!current.trim()) return proposed;
  if (current.includes(proposed)) return current;
  return `${current.replace(/\s+$/, '')}\n${proposed}`;
}
