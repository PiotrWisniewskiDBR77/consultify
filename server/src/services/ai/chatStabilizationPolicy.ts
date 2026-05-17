export interface ProductAssistantFallback {
  instruction: string;
  citations: Array<{
    id: string;
    type: 'document';
    title: string;
    reference: string;
    excerpt: string;
    marker: string;
  }>;
}

export function buildProductAssistantFallback(
  userMessage: string,
  isPl: boolean
): ProductAssistantFallback | null {
  const q = String(userMessage || '').toLowerCase();
  const items: Array<{ id: string; title: string; excerpt: string }> = [];

  if (/\bmarketplace\b|\bmcp marketplace\b/.test(q)) {
    items.push({
      id: 'product_help_marketplace',
      title: 'Consultify navigation: MCP Marketplace',
      excerpt: isPl
        ? 'Marketplace w Consultify znajduje się w lewym menu jako "MCP Marketplace". W obecnym buildzie to widok V4/coming soon: pokazuje opis możliwości marketplace, kuratorowany ekosystem dostawców, rekomendacje dostawców i planowaną ścieżkę od inicjatywy do zakupu/wdrożenia. Jeśli użytkownik pyta gdzie go znaleźć, wskaż lewe menu i zaznacz status "Wkrótce".'
        : 'Marketplace in Consultify is available from the left navigation as "MCP Marketplace". In the current build it is a V4/coming soon view: it explains marketplace capabilities, curated supplier ecosystem, supplier recommendations, and the planned path from initiative to purchase/deployment. If the user asks where to find it, point to the left menu and mention the "Coming soon" status.',
    });
  }

  if (/feedback|zgłoś|zglos|błąd|blad|opini|sugesti/.test(q)) {
    items.push({
      id: 'product_help_feedback',
      title: 'Consultify feedback entry points',
      excerpt: isPl
        ? 'Moduł feedbacku w Consultify służy do zgłaszania błędów, pomysłów i próśb o funkcje bez wychodzenia z aplikacji. Użytkownik może użyć globalnego przycisku/rail "Feedback" albo skrótu Shift+Ctrl+B, wybrać typ zgłoszenia, opisać problem lub sugestię i wysłać. Jeżeli pyta "jak działa moduł feedbacku", odpowiedz produktowo: wejście w aplikacji, typy zgłoszeń, szybki pulse feedback i następny krok po wysłaniu.'
        : 'The Consultify feedback module lets users report bugs, ideas, and feature requests without leaving the app. The user can open the global Feedback button/rail or use Shift+Ctrl+B, choose the report type, describe the issue or suggestion, and submit it. If asked "how does feedback work", answer as product guidance: app entry point, report types, quick pulse feedback, and what happens after submission.',
    });
  }

  if (/\bdodać\b|\bdodac\b|\bnowy element\b|\badd (?:a )?new item\b|\bcreate\b/.test(q)) {
    items.push({
      id: 'product_help_add_item',
      title: 'Consultify product assistant clarification rule',
      excerpt: isPl
        ? 'Jeżeli użytkownik pyta ogólnie "jak dodać nowy element w tym obszarze" bez wskazania modułu, asystent ma zadać jedno pytanie doprecyzowujące: czy chodzi o inicjatywę, zadanie, dokument, feedback, projekt, dostawcę/marketplace czy inny obszar. Nie wolno podstawiać instrukcji z obcych produktów ani losowych stron. Jeśli ekran/kontekst modułu jest dostępny, wykorzystaj go i podaj kroki dla tego modułu.'
        : 'If the user asks generally "how do I add a new item in this area" without naming the module, the assistant should ask one clarifying question: initiative, task, document, feedback, project, supplier/marketplace, or another area. It must not use unrelated product instructions or random web pages. If screen/module context is available, use it and give steps for that module.',
    });
  }

  if (/\bconsultify\b|\bczym jest consultify\b|\bwhat is consultify\b/.test(q)) {
    items.push({
      id: 'product_help_consultify',
      title: 'Consultify product overview',
      excerpt: isPl
        ? 'Consultify to środowisko do prowadzenia transformacji i pracy doradczej: ocena dojrzałości, inicjatywy, priorytetyzacja, ROI, dokumenty, AI chat i moduły wspierające przejście od analizy do wyniku biznesowego. Odpowiedź powinna być rzeczowa i produktowa, bez przypadkowego web search.'
        : 'Consultify is a workspace for transformation and consulting work: maturity assessment, initiatives, prioritization, ROI, documents, AI chat, and modules that connect analysis with business outcomes. The answer should be factual and product-specific, without random web search.',
    });
  }

  if (items.length === 0) return null;

  const snippets = items
    .map((item, index) => `[${index + 1}] ${item.title}\n${item.excerpt}`)
    .join('\n\n');
  const citations = items.map((item, index) => ({
    id: item.id,
    type: 'document' as const,
    title: item.title,
    reference: 'Consultify product assistant knowledge',
    excerpt: item.excerpt,
    marker: String(index + 1),
  }));

  return {
    instruction:
      `\n\n## CONSULTIFY PRODUCT ASSISTANT KNOWLEDGE\n${snippets}\n\nRules:\n` +
      '- For product/how-to answers, use these product facts before any general knowledge.\n' +
      '- Cite these facts inline as [1], [2] when used.\n' +
      '- If the user asks an ambiguous "how do I add this?" question, ask one clarifying question about the module/area instead of using web search.\n' +
      '- Do not cite or summarize unrelated external products for Consultify UI questions.\n',
    citations,
  };
}

export function isExplicitResearchAsk(userMessage: string): boolean {
  return /(sprawdź w internecie|wyszukaj|znajdź w sieci|web research|search the web|look up|google|konkurenc|competitor|competition|trend|aktualn|bieżąc|current|latest|najnowsz|raport|report|badani|research|rynek|market|usa|polsk|poland|benchmark)/i.test(
    String(userMessage || '')
  );
}

export function buildNoWebSourcesText(queries: string[], isPl: boolean): string {
  const queryText = queries.length
    ? queries
        .slice(0, 3)
        .map((q) => `- ${q}`)
        .join('\n')
    : '';
  return isPl
    ? [
        'Nie znalazłem wiarygodnych, dozwolonych źródeł web dla tego researchu, więc nie będę udawał, że wynik jest oparty na aktualnych danych z internetu.',
        queryText ? `\nSprawdzone zapytania:\n${queryText}` : '',
        '\nMogę kontynuować, jeśli podasz konkretne źródła/linki albo zawęzisz temat do rynku, kraju, typu firmy lub okresu.',
      ]
        .filter(Boolean)
        .join('\n')
    : [
        "I couldn't find reliable allowed web sources for this research, so I won't present the answer as current internet-backed research.",
        queryText ? `\nChecked queries:\n${queryText}` : '',
        '\nI can continue if you provide specific sources/links or narrow the topic by market, country, company type, or timeframe.',
      ]
        .filter(Boolean)
        .join('\n');
}
