/**
 * Tool: create_decision (Teresa routing-N · naprawa-rN-routing)
 *
 * Gives Teresa a REAL tool to create a Decision OBJECT (a `decisions` row) from
 * chat — instead of asking the user for data or falling back to a document. Before
 * this tool existed the chat pipeline only exposed generate_deliverable +
 * generate_initiative, so "stwórz decyzję" had no decision tool to call.
 *
 * READ/auto tool (mirrors generate_initiative): a decision record is a low-risk,
 * reversible personal/org entity — the same one the /decision slash command and
 * the AI_TOOLS create_decision already persist. No approval gate.
 *
 * Persistence reuses the column-defensive INSERT the AI_TOOLS create_decision path
 * already uses (getTableColumns guard → only existing columns). After the row is
 * created the handler emits a `deliverable` event (kind:'decision') so the FE
 * navigates to My Work → Decisions.
 */

import { featureFlags } from '../../../config/FeatureFlags.js';
import logger from '../../../utils/Logger.js';

type CreateDecisionParams = {
  title?: string;
  description?: string;
};

type CreateDecisionContext = {
  organizationId?: string;
  userId?: string;
  language?: string;
  role?: string;
  onDeliverable?: (payload: Record<string, unknown>) => void;
};

/**
 * Map a low/medium/high probability|impact string to a 1-5 numeric score, so the
 * risk/impact matrix carries NUMBERS (BCG §2: matrix, not words) that the FE and
 * the judge can actually rank. Falsy/unknown → 3 (neutral middle) so a partial
 * model output never poisons a column with null.
 */
function levelToScore(level: unknown): number {
  const v = String(level || '')
    .trim()
    .toLowerCase();
  if (v === 'low' || v === 'niskie' || v === 'niski') return 2;
  if (v === 'high' || v === 'wysokie' || v === 'wysoki') return 5;
  if (v === 'medium' || v === 'średnie' || v === 'sredni' || v === 'średni') return 3;
  return 3;
}

/**
 * FIX (naprawa-r4Struct, sędzia BCG defekt #1) — czyści osierocone resztki
 * nagłówka markdown z POCZĄTKU wartości pola tekstowego. Parser bloków „**Nagłówek**:
 * treść" bywał tnie po „**Nagłówek**" i zostawiał wiodące `**:`, `**`, osierocony
 * `:` albo pusty `**` — wartość zaczynała się od „**: Wybór Microsoft…". Strip robimy
 * tylko z PRZODU i tylko sekwencji-śmieci, nie ruszając treści.
 */
function stripLeadingHeaderGlitch(v: string): string {
  let s = String(v || '').trim();
  // Iteracyjnie: pusty **…**, wiodące **:, **, osierocone : / - / – na starcie.
  // Pętla bo mogą wystąpić w kombinacji ("**: - Wybór…").
  let prev: string;
  do {
    prev = s;
    s = s
      .replace(/^\*\*\s*\*\*/, '') // pusty pogrubiony nagłówek "****"
      .replace(/^\*\*\s*[:.\-–—]+/, '') // "**:" / "**." / "**-"
      .replace(/^\*\*(?=\s|$)/, '') // osierocone "**"
      .replace(/^[:.\-–—]+\s*/, '') // wiodący ": " / "- " / "– "
      .trim();
  } while (s !== prev);

  // FIX (naprawa-r5Extract) — glitch NIEROZ z POCZĄTKU: na żywych decyzjach
  // (demo 2026-07-07) parser bloku „**Nagłówek** treść" zjadał OTWIERAJĄCE „**",
  // ale ZAMYKAJĄCE zostawało przyklejone do pierwszej frazy:
  //   „Strategia hybrydowa "Partner + Selective Build"** — …"
  //   „…selective direct sales**\n\nRozpocząć…"
  // Gdy liczba „**" jest NIEPARZYSTA, ocalał osierocony marker → usuń PIERWSZY
  // (to zamknięcie nagłówka, który już zdjęliśmy z przodu). Zbalansowane „**bold**"
  // (parzyste) zostaje NIETKNIĘTE.
  if ((s.match(/\*\*/g) || []).length % 2 === 1) {
    s = s.replace(/\*\*/, '');
  }

  // TRAILING glitch: osierocone „**"/„*"/wiszący „:" na KOŃCU wartości. (Cudzysłów
  // NIE jest tu ruszany — bywa legalnym domknięciem frazy, jak „Build".)
  do {
    prev = s;
    s = s
      .replace(/\s*\*\*\s*$/, '') // wiszące „**"
      .replace(/\s*\*\s*$/, '') // wiszące „*"
      .replace(/[\s:]+$/, '') // wiszący „:" / białe znaki
      .trim();
  } while (s !== prev);

  return s;
}

/**
 * FIX (naprawa-r8Hygiene, DEFEKT #2) — meta/markdown przeciekał do WARTOŚCI pól.
 * Sędzia BCG (demo 2026-07-07): `consequencesOfInaction` zaczynał się od echa nagłówka
 * karty „**Konsekwencje bezczynności + Rekomendacja**", a jako `assumption` trafiał
 * osierocony nagłówek „**Horyzont realizacji: 45 dni**". To META-etykiety generatora,
 * nie treść. Ta funkcja USUWA z PRZODU wartości:
 *   (a) zbalansowany pogrubiony nagłówek meta na starcie („**Nagłówek meta**\n\n") —
 *       gdy jego treść to znana etykieta karty/horyzontu (nie merytoryka), zdejmujemy
 *       i zachowujemy prozę PO nim;
 *   (b) wiodące „Etykieta:" / „**Etykieta:**" dla znanych meta-fraz (Rekomendacja,
 *       Konsekwencje bezczynności, Horyzont realizacji) gdy są SAMOTNYM nagłówkiem.
 * Merytoryczna treść PO etykiecie jest ZACHOWANA. `stripLeadingHeaderGlitch` domyka
 * resztki markerów.
 */
const META_LABEL =
  /(?:konsekwencje\s+bezczynno[śs]ci(?:\s*\+\s*rekomendacja)?|rekomendacja|horyzont\s+realizacji|opis\s*\/?\s*kontekst|kontekst|uzasadnienie|consequences\s+of\s+inaction(?:\s*\+\s*recommendation)?|recommendation|realization\s+horizon|context|rationale)/i;

function stripMetaLabels(v: string): string {
  let s = String(v || '').trim();
  let prev: string;
  do {
    prev = s;
    // (a) Zbalansowany pogrubiony nagłówek meta na starcie: „**<META>>[…]**" + separator.
    //     Zdejmij TYLKO gdy zawartość bolda zaczyna się od znanej meta-etykiety
    //     (chroni realny bold merytoryczny typu „**Kluczowy wniosek: X**").
    const boldHead = s.match(/^\*\*\s*([^*]+?)\s*\*\*\s*[:.\-–—]*\s*(?:\n+|\s+|$)/);
    if (
      boldHead &&
      META_LABEL.test(boldHead[1]) &&
      /^\s*(?:konsekwencje|rekomendacja|horyzont|opis|kontekst|uzasadnienie|consequences|recommendation|realization|context|rationale)/i.test(
        boldHead[1].trim()
      )
    ) {
      // „**Horyzont realizacji: 45 dni**" niesie DANE (45 dni) — nie zdejmuj gdy po
      // dwukropku w BOLDZIE jest wartość merytoryczna; wtedy tylko odbolduj (usuń **).
      const inner = boldHead[1].trim();
      const hasInlineValue =
        /:/.test(inner) && inner.split(/:/).slice(1).join(':').trim().length > 0;
      if (hasInlineValue) {
        // Odbolduj nagłówek zachowując „Etykieta: wartość" jako zwykły tekst
        // (spacja przed resztą, by nie skleić „45 dni" z następną frazą).
        const rest = s.slice(boldHead[0].length);
        s = (inner + (rest && !/^\s/.test(rest) ? ' ' : '') + rest).trim();
      } else {
        // Czysta etykieta bez wartości → zdejmij cały nagłówek, zostaw prozę po nim.
        s = s.slice(boldHead[0].length).trim();
      }
      continue;
    }
    // (b) Wiodąca „Etykieta:" / „# Etykieta" (bez bolda) będąca SAMOTNYM meta-nagłówkiem
    //     na starcie linii, po której idzie treść.
    const plainHead = s.match(/^#{0,3}\s*([^\n:]{3,40})\s*[:.\-–—]\s*(?:\n+|\s+)/);
    if (
      plainHead &&
      META_LABEL.test(plainHead[1]) &&
      plainHead[1].trim().split(/\s+/).length <= 4
    ) {
      s = s.slice(plainHead[0].length).trim();
      continue;
    }
  } while (s !== prev);
  return stripLeadingHeaderGlitch(s);
}

/**
 * Split the "Consequences of inaction + Recommendation" prose card into its two
 * answer-first parts. The card prompt (decisionService) asks for: (1) consequences
 * of inaction, (2) ONE recommendation, (3) horizon. We keep the whole prose as the
 * consequences body (durable, surfaced) and lift the recommendation sentence into
 * its OWN field so the FE/judge see an answer-first recommendation, not buried text.
 *
 * ROBUST (naprawa-r4Struct): tolerant PL/EN markers, header-glitch strip, and a
 * split of the recommendation body into an answer-first recommendation vs. the
 * rationale (the "dlaczego ta opcja" part), so downstream fields are DIFFERENT
 * (defekt #2 dedup) not the same blob copied 3×.
 */
function splitConsequencesAndRecommendation(prose: string): {
  consequences: string;
  recommendation: string;
  rationale: string;
} {
  // FIX (naprawa-r8Hygiene, DEFEKT #2): najpierw zdejmij ECHO nagłówka karty
  // „**Konsekwencje bezczynności + Rekomendacja**" ze STARTU — inaczej marker
  // „Rekomendacja" trafiał w ten nagłówek (nie w prawdziwą sekcję rekomendacji)
  // i cała proza lądowała w consequences z pustym recommendation.
  const text = stripMetaLabels(String(prose || '').trim());
  if (!text) return { consequences: '', recommendation: '', rationale: '' };
  // Tolerant marker: optional markdown bold/heading around Rekomendacja/Recommendation.
  const markerMatch = text.match(
    /(?:^|\n)\s*#{0,3}\s*(?:\*\*)?\s*(?:rekomendacja|recommendation|rekomenduj[eę]?)\b\s*(?:\*\*)?\s*[:.\s\-–—]*/i
  );
  if (markerMatch && markerMatch.index !== undefined) {
    const recStart = markerMatch.index + markerMatch[0].length;
    const recBody = stripMetaLabels(text.slice(recStart).trim());
    const consequences = text.slice(0, markerMatch.index).trim() || text;
    if (recBody) {
      const { recommendation, rationale } = splitRecommendationAndRationale(recBody);
      return { consequences: stripMetaLabels(consequences), recommendation, rationale };
    }
  }
  return { consequences: stripMetaLabels(text), recommendation: '', rationale: '' };
}

/**
 * FIX (defekt #2 — dedup) — recommendation vs rationale są RÓŻNE pola:
 *   recommendation = answer-first JEDNO zdanie „co zrobić";
 *   rationale      = UZASADNIENIE „dlaczego ta opcja" (reszta akapitu / po markerze).
 * Rozdzielamy po jawnym markerze uzasadnienia, a gdy go brak — pierwsze zdanie =
 * rekomendacja, reszta = uzasadnienie (o ile jest co rozdzielić). Nigdy nie kopiujemy
 * tej samej treści do obu.
 */
function splitRecommendationAndRationale(body: string): {
  recommendation: string;
  rationale: string;
} {
  const text = String(body || '').trim();
  if (!text) return { recommendation: '', rationale: '' };
  // Jawny marker uzasadnienia? Grupa 1 = SAM wyraz-marker (bez otoczki), grupa 2 =
  // separator tuż po nim. Dzielimy tak, by móc ZACHOWAĆ początek zdania rationale.
  const why = text.match(
    /(?:^|\n)\s*#{0,3}\s*(?:\*\*)?\s*(uzasadnienie|rationale|dlaczego|why|bo|poniewa[żz])\b(\*\*)?([:.\s\-–—]*)/i
  );
  if (why && why.index !== undefined && why.index > 0) {
    const recommendation = stripLeadingHeaderGlitch(text.slice(0, why.index).trim());
    // FIX (naprawa-r6bExtract, defekt #3): zdanie rationale ucinało się na starcie,
    // bo zdejmowaliśmy CAŁY match (wyraz-marker + to co po nim), a Claude często pisze
    // „Uzasadnienie wyboru tej opcji nad alternatywami: (1)…". Zdjęcie samego
    // „Uzasadnienie" zostawiało urwane „wyboru tej opcji…" / „tej opcji nad
    // alternatywami:…". ZASADA: zdejmij marker TYLKO gdy po nim jest CZYSTY separator
    // (`:`/`-`/`.`/nowa linia) — wtedy to prawdziwy nagłówek („Uzasadnienie: <treść>").
    // Gdy po markerze idzie DALSZA PROZA (np. „ wyboru …"), ZACHOWAJ marker jako
    // początek zdania rationale (pełne zdanie zamiast fragmentu od środka).
    const sep = why[3] || '';
    const hasCleanSeparator = /[:.\-–—]/.test(sep) || /\n/.test(sep);
    const rationaleRaw = hasCleanSeparator
      ? text.slice(why.index + why[0].length) // czysty nagłówek → zdejmij marker
      : text.slice(why.index); // proza po markerze → zachowaj wyraz-marker
    const rationale = stripLeadingHeaderGlitch(rationaleRaw.trim());
    if (recommendation && rationale) return { recommendation, rationale };
  }
  // Brak markera: pierwsze zdanie = rekomendacja; reszta = uzasadnienie.
  const sentence = text.match(/^.*?[.!?](?:\s|$)/s);
  if (sentence) {
    const recommendation = stripLeadingHeaderGlitch(sentence[0].trim());
    const rationale = stripLeadingHeaderGlitch(text.slice(sentence[0].length).trim());
    // Tylko gdy reszta NIETRYWIALNA (inaczej zostaw rationale pusty — bez duplikacji).
    if (recommendation && rationale.length > 20) return { recommendation, rationale };
    return { recommendation, rationale: '' };
  }
  return { recommendation: text, rationale: '' };
}

/**
 * FIX (naprawa-r6bExtract, defekt #2) — wyłuskuje REALNE założenia biznesowe z
 * narracji rekomendacji/uzasadnienia, zamiast wstawiać generyczny placeholder-atrapę
 * („Rekomendacja wywiedziona z kontekstu… niezweryfikowana na danych na żywo") ×5.
 *
 * Sędzia BCG (demo 2026-07-07): wszystkie 5 decyzji miały IDENTYCZNY placeholder. To
 * nie są założenia — to atrapa udająca treść. Realne założenia SĄ w tekście: Claude
 * jawnie je sygnalizuje frazami „zakładając…", „przy założeniu…", „szacunek…",
 * „assuming…” i podaje liczby („40-60%", „12-18 miesięcy", „14 dni").
 *
 * Metoda: tnij narrację na zdania i zachowaj te, które (a) niosą jawny marker
 * założenia LUB (b) zawierają skwantyfikowaną tezę (liczba %/x/czas/kwota). Każde
 * realne założenie → confidence z sygnału (szacunek/estimate → medium, inaczej high
 * gdy twarda liczba). Bez trafień → PUSTA tablica (lepiej puste niż atrapa).
 */
/**
 * FIX (naprawa-r8Hygiene, DEFEKT #3) — wyprowadza SPECYFICZNY próg falsyfikacji
 * („co by to zmieniło") z TREŚCI konkretnego założenia, zamiast stałego boilerplate
 * ×13. Sędzia BCG: identyczny string „Dane na żywo sprzeczne z tą liczbą…" we WSZYSTKICH
 * 13/13 założeniach = brak falsyfikatora. Heurystyka deterministyczna po dominującym
 * TYPIE skwantyfikowanej tezy: procent → odchylenie o próg; czas/miesiące → przekroczenie
 * terminu; kwota → koszt > budżet; grant/dofinansowanie → cut-off/odmowa. Gdy założenie
 * nie ma twardej liczby (sam marker „zakładając…") → falsyfikator z pierwszej frazy tezy,
 * nadal RÓŻNY per-assumption (nie copy-paste).
 */
function deriveFalsifier(assumption: string, language: 'pl' | 'en'): string {
  const a = assumption.toLowerCase();
  const en = language === 'en';
  // Wyciągnij pierwszą liczbę + jednostkę jako kotwicę progu.
  const pct = a.match(/(\d[\d.,\s-]*)\s*%/);
  const months = a.match(/(\d[\d.,\s-]*)\s*(mies|month|lat|rok|year)/);
  const days = a.match(/(\d[\d.,\s-]*)\s*(dni|day)/);
  const money = a.match(/(\d[\d.,\s-]*)\s*(mln|tys|k\b|pln|eur|usd|€|\$)/);
  const grant = /\b(grant|dofinansow|poir|horyzont europa|horizon|dotacj|bezzwrotn)\b/.test(a);

  const num = (m: RegExpMatchArray | null) => (m ? m[1].trim() : '');

  if (grant && (months || days)) {
    const horizon = num(months) || num(days);
    const unit = months ? (en ? 'months' : 'mies.') : en ? 'days' : 'dni';
    return en
      ? `A grant cut-off or disbursement window longer than ${horizon} ${unit}, or a rejected application.`
      : `Cut-off / okno wypłaty grantu dłuższe niż ${horizon} ${unit}, lub odrzucona aplikacja.`;
  }
  if (pct) {
    const p = num(pct);
    return en
      ? `The realized figure deviating from ${p}% by more than a few points.`
      : `Realna wartość odbiegająca od ${p}% o więcej niż kilka punktów.`;
  }
  if (months) {
    const m = num(months);
    const unit = /lat|rok|year/.test(a) ? (en ? 'years' : 'lat') : en ? 'months' : 'mies.';
    return en
      ? `The timeline slipping beyond ${m} ${unit}.`
      : `Harmonogram przekraczający ${m} ${unit}.`;
  }
  if (days) {
    const d = num(days);
    return en ? `The deadline slipping beyond ${d} days.` : `Termin przekraczający ${d} dni.`;
  }
  if (money) {
    const mv = num(money);
    return en
      ? `The actual cost exceeding the ~${mv} estimate by >20%.`
      : `Realny koszt przekraczający szacunek ~${mv} o >20%.`;
  }
  // Brak twardej liczby — falsyfikator z pierwszej rzeczownikowej frazy tezy (≤8 słów),
  // różny per-assumption (bierze KONKRETNĄ treść założenia).
  const lead = assumption
    .replace(/^\(\d+\)\s*/, '')
    .split(/[,;:.]/)[0]
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join(' ');
  return en ? `Evidence contradicting "${lead}".` : `Dowód sprzeczny z tezą „${lead}".`;
}

function extractAssumptions(
  text: string,
  language: 'pl' | 'en'
): Array<{ assumption: string; confidence: string; whatWouldChangeIt: string }> {
  const s = String(text || '').trim();
  if (!s) return [];
  // Podział na zdania (zachowuje numeryczne wyliczenia „(1)…, (2)…" jako osobne).
  const rawParts = s
    .split(/(?<=[.!?])\s+|\n+|(?=\(\d+\)\s)/)
    .map((p) => stripLeadingHeaderGlitch(p.trim()))
    .filter((p) => p.length > 12);

  const ASSUMPTION_MARKER =
    /\b(zak[łl]adaj[ąa]c|przy za[łl]o[żz]eniu|za[łl]o[żz]enie|szacun|szacuj|assum|estimat|expect|provided that|o ile)\b/i;
  const QUANT = /\d\s*(%|x\b|mln|tys|mies|month|lat|rok|year|dni|day|k\b|pln|eur|usd|€|\$)/i;
  // FIX (naprawa-r8Hygiene, DEFEKT #2/#3): NIE wpuszczaj META-nagłówka („Horyzont
  // realizacji: …", „Konsekwencje bezczynności…") ani zdania-REKOMENDACJI („rekomenduję…",
  // „wybór opcji A…", „rekomendacja:…") jako ZAŁOŻENIA. Sędzia BCG: 3/6 decyzji miało
  // przepisaną rekomendację jako założenie + osierocony „**Horyzont realizacji: 45 dni**".
  const META_OR_HORIZON =
    /^(?:\*\*\s*)?(?:horyzont\s+realizacji|realization\s+horizon|konsekwencje\s+bezczynno[śs]ci|consequences\s+of\s+inaction|opis\s*\/?\s*kontekst|context)\b/i;
  const RECOMMENDATION_SHAPE =
    /\b(rekomenduj[eę]|rekomendacja|rekomendowa|wyb[óo]r\s+opcji|wybieram|recommend|i\s+recommend|the\s+recommendation)\b/i;

  const seen = new Set<string>();
  const out: Array<{ assumption: string; confidence: string; whatWouldChangeIt: string }> = [];
  for (const rawPart of rawParts) {
    // META-nagłówek („Horyzont realizacji…", „Konsekwencje bezczynności…") testuj na
    // SUROWYM zdaniu (przed stripMetaLabels), bo strip mógłby odbolodwać go do „45 dni…"
    // i przepuścić jako „założenie". Osierocony nagłówek karty NIGDY nie jest założeniem.
    const rawTrim = stripLeadingHeaderGlitch(rawPart);
    if (META_OR_HORIZON.test(rawTrim.replace(/^\*\*\s*/, ''))) continue;
    // Zdejmij pozostałe META-etykiety także z pojedynczego zdania.
    const part = stripMetaLabels(rawPart);
    if (part.length < 12) continue;
    if (META_OR_HORIZON.test(part)) continue; // meta-nagłówek, nie założenie
    if (RECOMMENDATION_SHAPE.test(part)) continue; // rekomendacja ≠ założenie
    const hasMarker = ASSUMPTION_MARKER.test(part);
    const hasQuant = QUANT.test(part);
    if (!hasMarker && !hasQuant) continue; // ani sygnału, ani liczby → to nie założenie
    const key = part.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    // „szacunek/estimate/~" → niepewne (medium); twarda liczba bez „~" → high.
    const soft = /szacun|estimat|~|oko[łl]o|about|approx/i.test(part);
    out.push({
      assumption: part,
      confidence: soft ? 'medium' : hasMarker ? 'medium' : 'high',
      // FIX (DEFEKT #3): próg falsyfikacji WYWIEDZIONY z treści założenia (koniec
      // boilerplate 13/13). Różny per-assumption; deterministyczny.
      whatWouldChangeIt: deriveFalsifier(part, language),
    });
    if (out.length >= 5) break; // dość — nie zalewaj kartą
  }
  return out;
}

/**
 * ROBUST alternatives extraction (naprawa-r4Struct PROBLEM #2). Order of trust:
 *   1. clean parsedContent.alternatives (decisionService parsed the JSON section);
 *   2. an ```artifact:comparison``` fenced block Teresa emits in free chat
 *      ({options|alternatives|rows}), normalized to the alternatives shape;
 *   3. any loose {"alternatives":[…]} JSON embedded in the raw prose.
 * Returns null when nothing usable — never a placeholder.
 */
function extractAlternatives(parsed: any, rawContent: string): any[] | null {
  const fromParsed = parsed?.alternatives;
  if (Array.isArray(fromParsed) && fromParsed.length) return fromParsed;
  // artifact:comparison fenced block.
  const cmp = matchArtifactBlock(rawContent, 'comparison');
  if (cmp) {
    const opts = cmp.options ?? cmp.alternatives ?? cmp.rows ?? cmp.items;
    if (Array.isArray(opts) && opts.length) {
      return opts.map((o: any) => ({
        title: o?.title ?? o?.name ?? o?.option ?? o?.label,
        description: o?.description ?? o?.summary,
        pros: Array.isArray(o?.pros) ? o.pros : [],
        cons: Array.isArray(o?.cons) ? o.cons : [],
        estimatedCostTime: o?.estimatedCostTime ?? o?.cost ?? o?.effort,
      }));
    }
  }
  const loose = looseJsonField(rawContent, 'alternatives');
  if (Array.isArray(loose) && loose.length) return loose;
  return null;
}

/**
 * ROBUST risk extraction. Order: parsedContent.risks → ```artifact:matrix``` block
 * ({items|risks} with x/y) → loose {"risks":[…]} JSON. Returns null when none.
 */
function extractRisks(parsed: any, rawContent: string): any[] | null {
  const fromParsed = parsed?.risks;
  if (Array.isArray(fromParsed) && fromParsed.length) return fromParsed;
  const mtx = matchArtifactBlock(rawContent, 'matrix');
  if (mtx) {
    const items = mtx.risks ?? mtx.items ?? mtx.rows;
    if (Array.isArray(items) && items.length) {
      return items.map((it: any) => ({
        title: it?.title ?? it?.name ?? it?.risk ?? it?.label,
        probability: it?.probability ?? it?.likelihood,
        impact: it?.impact,
        category: it?.category,
        mitigation: it?.mitigation,
        contingency: it?.contingency,
      }));
    }
  }
  const loose = looseJsonField(rawContent, 'risks');
  if (Array.isArray(loose) && loose.length) return loose;
  return null;
}

/**
 * Parse a ```artifact:<kind>:Title\n{JSON}``` fenced block (persona.ts format) and
 * return the inner JSON object, or null. Tolerant of the optional :Title segment
 * and of surrounding prose.
 */
function matchArtifactBlock(text: string, kind: 'comparison' | 'matrix'): any | null {
  const s = String(text || '');
  const re = new RegExp('```artifact:' + kind + '[^\\n]*\\n([\\s\\S]*?)```', 'i');
  const m = s.match(re);
  if (!m) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}

/**
 * Find a JSON array value for `key` embedded loosely in prose: matches
 * `"key": [ … ]` (balanced-ish via the first '[' after the key to its matching
 * ']') and JSON.parses it. Best-effort; returns null on any failure.
 */
function looseJsonField(text: string, key: string): any[] | null {
  const s = String(text || '');
  const keyIdx = s.search(new RegExp('"' + key + '"\\s*:\\s*\\['));
  if (keyIdx < 0) return null;
  const start = s.indexOf('[', keyIdx);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '[') depth++;
    else if (s[i] === ']') {
      depth--;
      if (depth === 0) {
        try {
          const arr = JSON.parse(s.slice(start, i + 1));
          return Array.isArray(arr) ? arr : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * BUG B fix (Teresa obiekty-N) — now DURABLE (naprawa-r2Decision): after a decision
 * row is created, generate the STRUCTURAL BCG cards (§2) — MECE alternatives (≥2 +
 * "do nothing"), a risk/impact MATRIX, consequences-of-inaction + an answer-first
 * recommendation — via `decisionService.generateSection`, and persist them into the
 * REAL structured columns added by migration 902 (alternatives, risk_impact,
 * consequences_of_inaction, recommendation, assumptions). The read API surfaces
 * these (SELECT d.*) so the structure is finally VISIBLE and SCOREABLE — not buried
 * in `description` or an unread sink.
 *
 * Column-defensive: writes only to columns that exist (getTableColumns), so on an
 * under-migrated env the create still succeeds. ADDITIVE + FAIL-SOFT: any error is
 * logged and never affects the created row.
 */
async function fillDecisionStructuralFields(
  decisionId: string,
  orgId: string,
  language: 'pl' | 'en'
): Promise<void> {
  try {
    const [{ default: decisionService }, queryHelpers, { getTableColumns }] = await Promise.all([
      import('../../decisionService.js'),
      import('../../../utils/queryHelpers.js'),
      import('../../../utils/dbSchema.js'),
    ]);

    // Generate the three structural cards. Each is independently fail-soft so one
    // failing does not lose the others. (description card is skipped — the create
    // already set a description.)
    const [altRes, riskRes, consRes] = await Promise.allSettled([
      decisionService.generateSection(decisionId, 'alternatives', { language }),
      decisionService.generateSection(decisionId, 'risk', { language }),
      decisionService.generateSection(decisionId, 'consequencesOfInaction', { language }),
    ]);

    let alternatives: any[] | null = null;
    let riskImpact: any[] | null = null;
    let consequences = '';
    let recommendation = '';
    let rationale = '';
    const assumptions: Array<{
      assumption: string;
      confidence: string;
      whatWouldChangeIt: string;
    }> = [];

    if (altRes.status === 'fulfilled') {
      // ROBUST: parsedContent → artifact:comparison → loose JSON (PROBLEM #2).
      alternatives = extractAlternatives(
        altRes.value.parsedContent as any,
        String(altRes.value.content || '')
      );
    } else {
      logger.error(
        `[create_decision] alternatives fill failed id=${decisionId}: ${
          altRes.reason instanceof Error ? altRes.reason.message : String(altRes.reason)
        }`
      );
    }

    if (riskRes.status === 'fulfilled') {
      // ROBUST: parsedContent → artifact:matrix → loose JSON (PROBLEM #2).
      const risks = extractRisks(
        riskRes.value.parsedContent as any,
        String(riskRes.value.content || '')
      );
      if (risks && risks.length) {
        // BCG §2: risk/impact as a MATRIX with 1-5 scores, not just words.
        riskImpact = risks.map((r: any) => ({
          ...r,
          riskScore: levelToScore(r?.probability),
          impactScore: levelToScore(r?.impact),
        }));
      }
    } else {
      logger.error(
        `[create_decision] risk fill failed id=${decisionId}: ${
          riskRes.reason instanceof Error ? riskRes.reason.message : String(riskRes.reason)
        }`
      );
    }

    if (consRes.status === 'fulfilled') {
      const split = splitConsequencesAndRecommendation(String(consRes.value.content || ''));
      consequences = split.consequences;
      recommendation = split.recommendation;
      rationale = split.rationale;
    } else {
      logger.error(
        `[create_decision] consequences fill failed id=${decisionId}: ${
          consRes.reason instanceof Error ? consRes.reason.message : String(consRes.reason)
        }`
      );
    }

    // FIX (naprawa-r6bExtract, defekt #2): REALNE założenia z narracji rekomendacji +
    // uzasadnienia — NIE generyczny placeholder-atrapa ×5. Wyłuskujemy skwantyfikowane
    // tezy / jawne „zakładając…". Gdy narracja nic nie daje → zostaw PUSTO (lepiej
    // puste niż atrapa udająca treść). Sędzia BCG: 5 decyzji z tym samym boilerplate =
    // brak realnych założeń — usunięte u źródła.
    const realAssumptions = extractAssumptions(`${recommendation}\n${rationale}`, language);
    for (const a of realAssumptions) assumptions.push(a);
    // Uwaga o brakujących opcjach jest INFORMACYJNA (realny stan degradacji), nie atrapa
    // treści — zostaje, ale tylko gdy faktycznie brak ustrukturyzowanych alternatyw.
    if (!alternatives) {
      assumptions.push({
        assumption:
          language === 'en'
            ? 'Structured alternatives could not be generated automatically — options need to be filled in.'
            : 'Nie udało się automatycznie wygenerować ustrukturyzowanych opcji — do uzupełnienia.',
        confidence: 'low',
        whatWouldChangeIt:
          language === 'en'
            ? 'Providing more decision context, then re-running alternative generation.'
            : 'Podanie szerszego kontekstu decyzji i ponowne wygenerowanie opcji.',
      });
    }

    if (!alternatives && !riskImpact && !consequences && !recommendation) {
      logger.warn(`[create_decision] structural fill produced NO content id=${decisionId}`);
      return;
    }

    // Persist into the REAL structured columns (migration 902). Column-defensive:
    // only write columns that exist so an under-migrated env still succeeds.
    const cols = await getTableColumns('decisions');
    const sets: string[] = [];
    const vals: any[] = [];
    const setCol = (col: string, jsonVal: any, isJson: boolean) => {
      if (!cols.has(col)) return;
      // Only fill when currently empty, so a later human edit is never clobbered.
      sets.push(`${col} = COALESCE(${col}, ?)`);
      vals.push(isJson ? JSON.stringify(jsonVal) : jsonVal);
    };

    if (alternatives) setCol('alternatives', alternatives, true);
    if (riskImpact) setCol('risk_impact', riskImpact, true);
    if (consequences) setCol('consequences_of_inaction', consequences, false);
    if (recommendation) setCol('recommendation', recommendation, false);
    if (assumptions.length) setCol('assumptions', assumptions, true);

    // DEDUP (defekt #2): decision_rationale surfaces as BOTH `rationale` and
    // `outcome` in the API. Historically we copied `recommendation` here → all three
    // fields showed the SAME text. Persist the DISTINCT `rationale` (the "dlaczego ta
    // opcja" part) so rationale ≠ recommendation. Fallback to recommendation ONLY when
    // no separate rationale was extractable (so the column is never left empty on a
    // valid decision). Header-glitch stripped either way.
    const rationaleForColumn = stripLeadingHeaderGlitch(rationale || recommendation);
    if (rationaleForColumn && cols.has('decision_rationale')) {
      await queryHelpers.queryRun(
        `UPDATE decisions SET decision_rationale = ?
         WHERE id = ? AND organization_id = ? AND (decision_rationale IS NULL OR decision_rationale = '')`,
        [rationaleForColumn, decisionId, orgId]
      );
    }

    if (sets.length) {
      vals.push(decisionId, orgId);
      await queryHelpers.queryRun(
        `UPDATE decisions SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
        vals
      );
    }

    logger.info(
      `[create_decision] structural columns filled id=${decisionId} (` +
        [
          alternatives && `alternatives(${alternatives.length})`,
          riskImpact && `risk_impact(${riskImpact.length})`,
          consequences && 'consequences',
          recommendation && 'recommendation',
          assumptions.length && `assumptions(${assumptions.length})`,
        ]
          .filter(Boolean)
          .join(', ') +
        ')'
    );
  } catch (err) {
    logger.error(
      `[create_decision] structural fill FAILED id=${decisionId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function createDecision(
  params: CreateDecisionParams,
  context: CreateDecisionContext = {}
): Promise<Record<string, unknown>> {
  const orgId = String(context.organizationId || '').trim();
  const userId = String(context.userId || '').trim();
  const language: 'pl' | 'en' = context.language === 'en' ? 'en' : 'pl';

  // Defense in depth — mirrors AIPipeline's CHAT_CREATION_TOOLS gate.
  if (!featureFlags.ENABLE_TERESA_RECORD_CREATE) {
    return {
      ok: false,
      error: 'feature_disabled',
      message:
        language === 'en'
          ? 'Decision creation from chat is disabled in this environment — point the user to My Work → Decisions.'
          : 'Tworzenie decyzji z czatu jest wyłączone w tym środowisku — skieruj użytkownika do Moja praca → Decyzje.',
    };
  }

  if (!orgId) {
    return {
      ok: false,
      error: 'missing_context',
      message:
        language === 'en'
          ? 'I cannot create a decision without an organization context.'
          : 'Nie mogę utworzyć decyzji bez kontekstu organizacji.',
    };
  }

  const title = String(params?.title || '').trim();
  if (!title) {
    return {
      ok: false,
      error: 'missing_title',
      message:
        language === 'en'
          ? 'A decision record needs a title — what decision are we tracking?'
          : 'Decyzja potrzebuje tytułu — jaką decyzję zapisujemy?',
    };
  }

  try {
    const { v4: uuidv4 } = await import('uuid');
    const { getTableColumns } = await import('../../../utils/dbSchema.js');
    const queryHelpers = await import('../../../utils/queryHelpers.js');

    const id = uuidv4();
    const cols = await getTableColumns('decisions');
    const insertCols: string[] = ['id'];
    const insertVals: string[] = ['?'];
    const insertParams: any[] = [id];
    const add = (col: string, val: any) => {
      if (!cols.has(col)) return;
      insertCols.push(col);
      insertVals.push('?');
      insertParams.push(val);
    };
    add('organization_id', orgId);
    add('title', title.slice(0, 500));
    add('description', params?.description || null);
    add('status', 'pending');
    add('created_by', userId || null);
    add('decision_maker_id', userId || null);

    await queryHelpers.queryRun(
      `INSERT INTO decisions (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
      insertParams
    );

    // BUG B: fill structural cards (alternatives/risk/consequences+recommendation)
    // in the BACKGROUND — fire-and-forget so the chat stream returns immediately;
    // the decision row already exists and the AI-fill only enriches it. Fail-soft
    // (logs its own errors).
    void fillDecisionStructuralFields(id, orgId, language);

    try {
      context.onDeliverable?.({
        draftId: id,
        generationId: id,
        kind: 'decision',
        format: 'decision',
        title,
        decisionId: id,
        // BUG2 — scorer gets the decision's own scope, not the confirmation line.
        scorerContent: `${title}\n\n${String(params?.description || '')}`.trim(),
      });
    } catch (emitErr) {
      logger.warn(
        `[create_decision] onDeliverable emit failed id=${id}: ${
          emitErr instanceof Error ? emitErr.message : String(emitErr)
        }`
      );
    }

    logger.info(`[create_decision] created id=${id} title="${title.slice(0, 80)}"`);

    return {
      ok: true,
      kind: 'decision',
      id,
      title,
      message:
        language === 'en'
          ? `Created a decision record "${title}" in your My Work → Decisions.`
          : `Utworzyłem decyzję „${title}" w Moja praca → Decyzje.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[create_decision] error: ${message}`);
    return {
      ok: false,
      error: 'creation_failed',
      message:
        language === 'en'
          ? `I could not create the decision. ${message}`
          : `Nie udało się utworzyć decyzji. ${message}`,
    };
  }
}

// Pure parser/extractor helpers exported for unit tests (naprawa-r4Struct).
// No DB/LLM — deterministic string parsing of realistic Claude output.
export const __test__ = {
  stripLeadingHeaderGlitch,
  stripMetaLabels,
  deriveFalsifier,
  splitConsequencesAndRecommendation,
  splitRecommendationAndRationale,
  extractAlternatives,
  extractRisks,
  extractAssumptions,
  matchArtifactBlock,
  looseJsonField,
};

export default { createDecision };
