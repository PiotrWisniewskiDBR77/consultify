/**
 * "Why This Question" Educational Hints
 *
 * Paczka1 #10 — non-consultant users (Spotify-democratization goal) should understand
 * WHY a diagnostic question/level is being asked, not just what to answer.
 *
 * Granularity: dimension-level (DRD axis / SIRI building block / ADMA pillar), not
 * per-individual-question. This is pragmatic — the diagnostic *purpose* of a dimension
 * is stable across its levels/areas, while writing ~700 bespoke per-question hints would
 * be low-signal (mostly restating the level description).
 *
 * Bilingual (PL/EN) plain content — HBS-consultant quality, non-consultant reading level.
 */

export type WhyThisMattersHint = {
  en: string;
  pl: string;
};

/**
 * DRD — keyed by axis id (1-7), matches DRDAxis.id in src/services/drdStructure.ts
 */
export const DRD_AXIS_WHY_HINTS: Record<number, WhyThisMattersHint> = {
  1: {
    en: 'We ask about your core processes (sales, marketing, purchasing, logistics, production...) because these are where day-to-day value is created or lost. Digitizing a process usually pays back fast: fewer manual errors, faster cycle times, data you can actually trust for decisions.',
    pl: 'Pytamy o kluczowe procesy (sprzedaż, marketing, zakupy, logistyka, produkcja...), bo to tam na co dzień powstaje albo ucieka wartość. Cyfryzacja procesu zwykle szybko się zwraca: mniej błędów ręcznych, krótszy czas realizacji, dane, którym można naprawdę zaufać przy podejmowaniu decyzji.',
  },
  2: {
    en: 'We ask about your products/services because "digital" isn\'t only about internal tools — it\'s also about what you sell and how customers experience it. A more digital product (self-service, data-driven features, connected devices) usually means new revenue and stickier customers.',
    pl: 'Pytamy o Twoje produkty/usługi, bo "cyfrowe" to nie tylko narzędzia wewnętrzne — to też to, co sprzedajesz i jak klient tego doświadcza. Bardziej cyfrowy produkt (samoobsługa, funkcje oparte na danych, urządzenia połączone) zwykle oznacza nowy przychód i bardziej lojalnych klientów.',
  },
  3: {
    en: 'We ask about your business model because technology can change not just HOW you work but WHAT you sell and how you make money (e.g. subscriptions instead of one-off sales, platforms instead of pure products). This is often the highest-value but hardest-to-copy transformation.',
    pl: 'Pytamy o model biznesowy, bo technologia potrafi zmienić nie tylko SPOSÓB pracy, ale też CO sprzedajesz i jak zarabiasz (np. subskrypcje zamiast jednorazowej sprzedaży, platformy zamiast czystego produktu). To często transformacja o najwyższej wartości i najtrudniejsza do skopiowania przez konkurencję.',
  },
  4: {
    en: 'We ask about data management because data is only valuable if you can collect it reliably, store it safely, and actually use it to decide something. A company that "has data" but cannot report on it or act on it in real time is not yet data-driven.',
    pl: 'Pytamy o zarządzanie danymi, bo dane mają wartość tylko wtedy, gdy da się je rzetelnie zbierać, bezpiecznie przechowywać i realnie wykorzystać do podjęcia decyzji. Firma, która "ma dane", ale nie potrafi na ich podstawie raportować ani działać w czasie rzeczywistym, jeszcze nie jest data-driven.',
  },
  5: {
    en: "We ask about culture and people because the best technology fails if employees don't trust it, aren't trained on it, or actively work around it. Digital maturity is as much a people/leadership question as a systems question.",
    pl: 'Pytamy o kulturę i ludzi, bo nawet najlepsza technologia zawiedzie, jeśli pracownicy jej nie ufają, nie są przeszkoleni albo aktywnie ją omijają. Dojrzałość cyfrowa to w równym stopniu kwestia ludzi i przywództwa, co systemów.',
  },
  6: {
    en: 'We ask about cybersecurity because every new digital process, product, or data flow is also a new attack surface. A single serious incident (data breach, ransomware, downtime) can undo years of digital investment overnight.',
    pl: 'Pytamy o cyberbezpieczeństwo, bo każdy nowy cyfrowy proces, produkt czy przepływ danych to również nowa powierzchnia ataku. Jeden poważny incydent (wyciek danych, ransomware, przestój) może w jedną noc zniweczyć lata cyfrowych inwestycji.',
  },
  7: {
    en: 'We ask about AI maturity because AI only creates value on top of a foundation that already works: clean data, digitized processes, and people who trust automated recommendations. This axis tells us if you are ready to move from "using AI tools" to "AI actually changing outcomes."',
    pl: 'Pytamy o dojrzałość AI, bo sztuczna inteligencja tworzy wartość dopiero na fundamencie, który już działa: czyste dane, ucyfrowione procesy i ludzie ufający automatycznym rekomendacjom. Ta oś mówi nam, czy jesteś gotów przejść od "używania narzędzi AI" do sytuacji, w której AI realnie zmienia wyniki biznesowe.',
  },
};

/**
 * Generic fallback — used for SIRI, ADMA, Lean, or any framework/dimension
 * without a specific curated hint yet.
 */
export const GENERIC_WHY_HINT: WhyThisMattersHint = {
  en: 'This question checks whether a specific capability is truly in place and used in daily practice — not just planned or piloted once. We ask for evidence (a system, a report, a procedure) because a maturity assessment is only useful if it reflects reality, not intentions. Knowing exactly where you stand is the first step to prioritizing what to fix next.',
  pl: 'To pytanie sprawdza, czy dana zdolność jest naprawdę wdrożona i używana w codziennej praktyce — a nie tylko zaplanowana albo przetestowana raz jako pilotaż. Prosimy o dowód (system, raport, procedurę), bo ocena dojrzałości ma sens tylko wtedy, gdy odzwierciedla rzeczywistość, a nie intencje. Dokładne poznanie punktu startowego to pierwszy krok do ustalenia priorytetów dalszych działań.',
};

/**
 * SIRI — keyed by building block id (see SIRIBuildingBlock in src/services/siriStructure.ts:
 * 'PROCESS' | 'TECHNOLOGY' | 'ORGANIZATION')
 */
export const SIRI_BLOCK_WHY_HINTS: Record<string, WhyThisMattersHint> = {
  PROCESS: {
    en: "We ask about your processes (operations, supply chain, product lifecycle) because SIRI's core idea is that Industry 4.0 only works when the operating model itself is redesigned — not just when you add new machines.",
    pl: 'Pytamy o procesy (operacje, łańcuch dostaw, cykl życia produktu), bo kluczowa idea SIRI mówi, że Przemysł 4.0 działa dopiero wtedy, gdy przeprojektujesz sam model działania — a nie tylko dokupisz nowe maszyny.',
  },
  TECHNOLOGY: {
    en: 'We ask about technology (automation, connectivity, intelligence) because SIRI measures how far machines and systems can sense, communicate, and decide on their own — the technical backbone of a smart factory.',
    pl: 'Pytamy o technologię (automatyzacja, łączność, inteligencja), bo SIRI mierzy, na ile maszyny i systemy potrafią samodzielnie wyczuwać, komunikować się i podejmować decyzje — czyli techniczny szkielet inteligentnej fabryki.',
  },
  ORGANIZATION: {
    en: 'We ask about your organization (talent readiness, structure & management) because technology investments stall without people who have the right skills and a structure that supports fast decisions.',
    pl: 'Pytamy o organizację (gotowość talentów, strukturę i zarządzanie), bo inwestycje technologiczne utykają bez ludzi z odpowiednimi kompetencjami i struktury wspierającej szybkie decyzje.',
  },
};

/**
 * ADMA — keyed by pillar id (see ADMAPillarId in src/services/admaStructure.ts:
 * 'strategy' | 'smart_products' | 'smart_operations' | 'smart_supply' | 'data_driven')
 */
export const ADMA_PILLAR_WHY_HINTS: Record<string, WhyThisMattersHint> = {
  strategy: {
    en: 'We ask about strategy & organization because digital investments without a clear business rationale and organizational buy-in tend to stall after the pilot. This pillar checks whether digital initiatives are actually tied to business goals, funded on purpose, and supported by a culture that adopts new ways of working rather than resisting them.',
    pl: 'Pytamy o strategię i organizację, bo inwestycje cyfrowe bez jasnego uzasadnienia biznesowego i poparcia organizacji zwykle utykają po pilotażu. Ten filar sprawdza, czy inicjatywy cyfrowe są realnie powiązane z celami biznesowymi, celowo finansowane i wspierane przez kulturę, która przyjmuje nowe sposoby pracy, zamiast się im opierać.',
  },
  smart_products: {
    en: "We ask about smart products because digitalization isn't only internal — it's also about what you sell. Products with embedded sensors, connectivity, or data-driven features (servitization) open new revenue streams and let you learn from how customers actually use what you build.",
    pl: 'Pytamy o inteligentne produkty, bo cyfryzacja to nie tylko wnętrze firmy — to też to, co sprzedajesz. Produkty z wbudowanymi czujnikami, łącznością czy funkcjami opartymi na danych (serwicyzacja) otwierają nowe źródła przychodu i pozwalają uczyć się na tym, jak klienci faktycznie korzystają z tego, co budujesz.',
  },
  smart_operations: {
    en: 'We ask about smart operations because production technology and manufacturing IT are where digital investment usually pays back fastest: fewer defects, less downtime, and real-time visibility into what is actually happening on the shop floor instead of relying on end-of-shift reports.',
    pl: 'Pytamy o inteligentne operacje, bo technologia produkcyjna i IT produkcyjne to obszar, gdzie inwestycja cyfrowa zwykle zwraca się najszybciej: mniej braków, mniej przestojów i wgląd w czasie rzeczywistym w to, co dzieje się na hali produkcyjnej, zamiast polegania na raportach ze zmiany.',
  },
  smart_supply: {
    en: 'We ask about the smart supply chain because most companies today do not compete alone — they compete as part of a supply network. Digital integration and end-to-end visibility with suppliers and logistics partners determine whether you can react to disruption in hours, not weeks.',
    pl: 'Pytamy o inteligentny łańcuch dostaw, bo dziś firmy rzadko konkurują same — konkurują jako część sieci dostaw. Cyfrowa integracja i widoczność od początku do końca łańcucha z dostawcami i partnerami logistycznymi decydują, czy na zakłócenie zareagujesz w godziny, a nie tygodnie.',
  },
  data_driven: {
    en: 'We ask about data-driven services because collecting data is worthless if it never turns into analytics you act on or new revenue you monetize. This pillar checks the full chain — from data collection, through analytics maturity, to data-based services you can actually sell or use to decide.',
    pl: 'Pytamy o usługi oparte na danych, bo zbieranie danych nie ma wartości, jeśli nigdy nie zamienia się w analitykę, na podstawie której działasz, ani w nowy przychód, który monetyzujesz. Ten filar sprawdza cały łańcuch — od zbierania danych, przez dojrzałość analityczną, po usługi oparte na danych, które realnie możesz sprzedać albo wykorzystać do podjęcia decyzji.',
  },
};

/**
 * Universal getter: resolve the most specific hint available, falling back
 * to the generic hint when the framework/dimension has no curated content yet.
 */
export function getWhyThisMattersHint(framework: string, dimensionKey: string): WhyThisMattersHint {
  const fw = String(framework || '').toLowerCase();

  if (fw === 'drd') {
    const axisId = Number(String(dimensionKey || '').match(/^\d+/)?.[0]);
    if (Number.isFinite(axisId) && DRD_AXIS_WHY_HINTS[axisId]) {
      return DRD_AXIS_WHY_HINTS[axisId];
    }
    return GENERIC_WHY_HINT;
  }

  if (fw === 'siri') {
    const key = String(dimensionKey || '').toUpperCase();
    if (SIRI_BLOCK_WHY_HINTS[key]) return SIRI_BLOCK_WHY_HINTS[key];
    return GENERIC_WHY_HINT;
  }

  if (fw === 'adma') {
    const key = String(dimensionKey || '').toLowerCase();
    if (ADMA_PILLAR_WHY_HINTS[key]) return ADMA_PILLAR_WHY_HINTS[key];
    return GENERIC_WHY_HINT;
  }

  return GENERIC_WHY_HINT;
}

/**
 * Convenience: resolve a DRD hint directly from an axis id (used by DRDAssessmentEditor,
 * which already has the numeric axis id at hand).
 */
export function getDRDAxisWhyHint(axisId: number): WhyThisMattersHint {
  return DRD_AXIS_WHY_HINTS[axisId] || GENERIC_WHY_HINT;
}
