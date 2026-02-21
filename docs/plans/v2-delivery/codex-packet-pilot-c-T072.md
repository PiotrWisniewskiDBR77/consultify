# Codex Packet — Pilot C: T072 Context-Sensitive Help Navigation

**Bundle:** bundle-pilot-c-help-context  
**Task:** T072 — Context‑Sensitive Help Navigation (module → docs mapping + deep links)  
**Owner:** Codex

---

## Scope (V2) — z V2_TASK_SPECS.md

### IN (MUST)
1. **Module → docs mapping**
   - route/moduleId → recommended category/article/playbook
   - fallback: global search / getting started
2. **Entry points**
   - Z każdego modułu szybki entrypoint "Help" (widget/panel)
   - "open help" przekazuje `moduleId`
3. **Deep links**
   - Link do konkretnego artykułu/playbooka
   - Możliwość otwarcia w side panel bez zmiany route (preferowane)
4. **Maintainability**
   - Mapowanie jako config w repo (łatwo aktualizować)
   - Testy (co najmniej sanity) na najważniejsze moduły

### OUT (post‑V2)
- Pełna personalizacja per rola i zachowania

---

## Definition of Done

- [ ] Będąc w module X, Help otwiera rekomendowaną dokumentację X
- [ ] Jeśli mapowania brak, user dostaje sensowny fallback (search/getting started)

---

## Manual QA (4–6 punktów)

1. User wchodzi w Assessment → klik Help → otwiera się sekcja docs Assessment
2. User wchodzi w Initiatives → klik Help → otwiera się sekcja docs Initiatives
3. User wchodzi w Reports → klik Help → otwiera się sekcja docs Reports
4. Deep link do artykułu otwiera side panel bez zmiany route
5. Nieznany moduł → fallback (search / getting started)

---

## Pliki / obszary do edycji

**Istniejące (leverage):**
- `src/config/viewToModuleMapping.ts` — mapowanie AppView → moduleId
- `src/contexts/HelpContext.tsx` — getHelpForView, contextualHelp
- `config/moduleHelpContent.ts` — MODULE_HELP_CONTENT
- `src/components/Help/HelpSidePanel.tsx` — panel Help
- `src/components/Help/FloatingHelpWidget.tsx` (jeśli istnieje) — entrypoint
- `server/src/services/KnowledgeBaseService.ts` — getContextualArticles (jeśli istnieje)

**Do dodania/rozszerzenia:**
- Route param lub query `?help=moduleId` / `?help=articleId` dla deep links
- Entrypoint w każdym kluczowym module przekazujący `moduleId` przy otwarciu Help
- Fallback flow gdy moduleId nieznany

---

## Testy do przejścia

```bash
npm run verify:quick
npm run test:e2e:smoke   # jeśli dotyka UI/nav
```

---

## Zakazy

- Brak stubów/placeholderów w prod
- Brak nowych UI standardów — stosować docs/ui-standards
- i18n must (EN+PL minimum)

---

## Kontekst techniczny

- HelpContext już ma `getHelpForView(view)` → `ContextualHelpState`
- viewToModuleMapping mapuje AppView → moduleId
- HelpSidePanel używa contextualHelp z contextu
- Trzeba upewnić się, że przy otwarciu Help z dowolnego miejsca przekazujemy aktualny currentView → moduleId
- Deep links: np. `/app?help=assessment` lub `/app?help=article:xyz` — otwiera side panel z właściwą treścią
