# POMIAR R3 — crimson (`primary-*` / `variant="brand"`) w Ustawieniach i Adminie

Data pomiaru: 2026-09-01 · katalog: `/private/tmp/m03` · gałąź `codex/m03-admin-20260824`
Charakter: POMIAR (read-only). Żaden plik kodu nie został zmieniony.

## Komenda i wynik surowy

```
grep -rn --include='*.tsx' -e 'primary-[0-9]' -e 'variant="brand"' \
  src/components/settings src/components/admin src/views/admin
```

Wynik: **95 wystąpień w 17 plikach** — zgodne z pomiarem wstępnym nadzorcy (95/17).
Polecenie wykonało się z kodem wyjścia 0 i zwróciło niepustą listę (nie jest to pustka po błędzie składni).

UWAGA co do zakresu: **`src/components/settings` nie ma ANI JEDNEGO wystąpienia.** Wszystkie 95
leży w `src/components/admin` (73) i `src/views/admin` (22). Nazwa „Ustawienia" w tytule zadania
nie odpowiada realnemu rozkładowi — dług siedzi w Adminie.

## Ustalenia bazowe (dowody z kodu, nie z pamięci)

1. `tailwind.config.js:209-215` — `primary.DEFAULT = '#85182F'`, w komentarzu `// was #7C3AED`.
   To dowód, że **cała ta rodzina to podmieniony fioletowy akcent**, a nie świadomy crimson.
   Nikt tych 95 miejsc nie wybrał jako czerwieni — one po prostu były fioletowe i zmieniły znaczenie
   pod nogami. To wyjaśnia, dlaczego semantyki krytycznej praktycznie tu nie ma.
2. `src/components/ui/primitives/Button.tsx:39-58` (VISUAL_STANDARD.md §5.1) — `primary` = NEUTRALNY
   wysoki kontrast (główna akcja), `brand` (crimson) = zarezerwowany na „brand moments (Talk to Teresa)",
   focus ring **zawsze** `--c-focus` (niebieski), „never crimson (focus ≠ error)".
3. `tailwind.config.js:713` — `'token-focus': '0 0 0 3px var(--c-focus)' // blue focus ring — never crimson`.

### SPRZECZNOŚĆ W ŹRÓDŁACH — do rozstrzygnięcia przez nadzorcę

`tailwind.config.js:150` mówi: „`c-accent` (crimson/brand): **TYLKO brand/CTA/selected**".
To stoi w sprzeczności z CLAUDE.md pkt 3 („CTA/stany aktywne = neutralne") oraz z Button.tsx §5.1.
Dotyczy to ~17 wystąpień typu „stan aktywny/zaznaczony" (podkreślenia zakładek, zaznaczone karty,
checkboxy). W tabeli poniżej klasyfikuję je jako **A**, bo dwa źródła (CLAUDE.md + Button.tsx §5.1)
przeważają nad jednym komentarzem w configu — ale to jest MOJA decyzja klasyfikacyjna, nie pomiar.
Jeśli nadzorca uzna komentarz z configu za obowiązujący, te 17 wypada z zakresu naprawy.

## Tabela wystąpień

Legenda tokenów zastępczych:
- `T1` = `text-c-text-muted` (ikona ozdobna w nagłówku — bez koloru marki)
- `T2` = `focus:border-c-focus` / `focus:ring-c-focus` (fokus zawsze niebieski)
- `T3` = `border-c-text text-c-text` (stan aktywny/zaznaczony = neutralny wysoki kontrast)
- `T4` = `c-tag-N` (kolor KATEGORII/TYPU, bezkolejnościowy — nie sygnał)
- `T5` = usunąć poświatę / `shadow-lg` bez koloru (crimson glow to czysta ozdoba)
- `T6` = `text-c-success` lub neutralny (stan ZDROWY — dziś crimson stoi naprzeciw `danger`, odwrócona semantyka)
- `T7` = `variant="primary"` (neutralne CTA)
- `T8` = `text-c-text` / `text-c-link` (link tekstowy, nie akcja destrukcyjna)

| plik:linia | grupa | co to jest | token zastępczy |
|---|---|---|---|
| src/components/admin/AI/FeaturesPrivacyTab.tsx:178 | A | ikona Sparkles przy tytule „Features & Privacy", czysto ozdobna | T1 |
| src/components/admin/AI/FeaturesPrivacyTab.tsx:204 | A | crimson poświata (`shadow-primary-500/20`) pod granatowym przyciskiem Zapisz | T5 |
| src/components/admin/AI/FeaturesPrivacyTab.tsx:225 | A | podkreślenie i tekst aktywnej pod-zakładki „AI Features" | T3 |
| src/components/admin/AI/FeaturesPrivacyTab.tsx:236 | A | podkreślenie aktywnej pod-zakładki „Data Policy" | T3 |
| src/components/admin/AI/FeaturesPrivacyTab.tsx:247 | A | podkreślenie aktywnej pod-zakładki „Custom Instructions" | T3 |
| src/components/admin/AI/FeaturesPrivacyTab.tsx:258 | A | podkreślenie aktywnej pod-zakładki „Personas" | T3 |
| src/components/admin/AI/FeaturesPrivacyTab.tsx:276 | A | `iconColor` karty ustawień „AI Features" (ikona nagłówka sekcji) | T1 |
| src/components/admin/AI/FeaturesPrivacyTab.tsx:304 | A | `iconColor` pstryczka „Thinking steps" (ikona Brain przy przełączniku) | T1 |
| src/components/admin/AI/FeaturesPrivacyTab.tsx:415 | A | tło + obwódka WYBRANEJ opcji retencji danych (stan zaznaczenia) | T3 |
| src/components/admin/AI/FeaturesPrivacyTab.tsx:422 | A | ptaszek Check przy wybranej opcji retencji | T3 |
| src/components/admin/AI/FeaturesPrivacyTab.tsx:613 | A | obwódka fokusu selecta „Tone & Style" | T2 |
| src/components/admin/AI/FeaturesPrivacyTab.tsx:662 | A | obwódka fokusu pola tekstowego „Custom instructions" | T2 |
| src/components/admin/AI/FeaturesPrivacyTab.tsx:789 | A | obwódka fokusu pola „Restricted keywords" | T2 |
| src/views/admin/OrgAISettingsView.tsx:186 | C | `color` poziomu polityki PROACTIVE w skali 4-stopniowej | — (patrz nota C1) |
| src/views/admin/OrgAISettingsView.tsx:187 | C | `bgColor` gradientu kafla PROACTIVE | — (patrz nota C1) |
| src/views/admin/OrgAISettingsView.tsx:387 | A | kręcący się spinner RefreshCw na ekranie ładowania | T1 |
| src/views/admin/OrgAISettingsView.tsx:440 | A | gradientowy kafelek 48×48 z ikoną Brain w nagłówku strony, ozdobny | T1 |
| src/views/admin/OrgAISettingsView.tsx:482 | A | crimson poświata pod przyciskiem Zapisz (tło granatowe) | T5 |
| src/views/admin/OrgAISettingsView.tsx:509 | A | crimson poświata pod AKTYWNĄ zakładką (tło już neutralne `bg-c-text`) | T5 |
| src/views/admin/OrgAISettingsView.tsx:546 | A | `iconColor` karty „AI Policy Level" | T1 |
| src/views/admin/OrgAISettingsView.tsx:629 | A | tło+obwódka zaznaczonej roli AI na liście ról | T3 |
| src/views/admin/OrgAISettingsView.tsx:638 | A | kolor zaznaczenia checkboxa roli + jego ring fokusu | T3 + T2 |
| src/views/admin/OrgAISettingsView.tsx:657 | A | obwódka fokusu selecta „Default Role" | T2 |
| src/views/admin/OrgAISettingsView.tsx:769 | A | obwódka fokusu pola „Monthly budget USD" | T2 |
| src/views/admin/OrgAISettingsView.tsx:789 | A | obwódka fokusu pola „Hard limit USD" | T2 |
| src/views/admin/OrgAISettingsView.tsx:826 | A | `iconColor` karty „AI Features" | T1 |
| src/views/admin/OrgAISettingsView.tsx:854 | A | `iconColor` pstryczka „Thinking steps" | T1 |
| src/components/admin/AI/AuditComplianceTab.tsx:315 | A | podkreślenie aktywnej pod-zakładki „Settings Changes" | T3 |
| src/components/admin/AI/AuditComplianceTab.tsx:326 | A | podkreślenie aktywnej pod-zakładki „Usage Audit" | T3 |
| src/components/admin/AI/AuditComplianceTab.tsx:337 | A | podkreślenie aktywnej pod-zakładki „Security" | T3 |
| src/components/admin/AI/AuditComplianceTab.tsx:353 | A | podkreślenie aktywnej pod-zakładki „Compliance Reports" | T3 |
| src/components/admin/AI/AuditComplianceTab.tsx:364 | A | podkreślenie aktywnej pod-zakładki „Templates" | T3 |
| src/components/admin/AI/AuditComplianceTab.tsx:391 | A | obwódka fokusu pola wyszukiwania w dzienniku audytu | T2 |
| src/components/admin/AI/AuditComplianceTab.tsx:418 | A | podpowiedź tekstowa „Enable Audit All AI Requests…" — zwykła wskazówka, nie alarm | T8 |
| src/components/admin/AI/AuditComplianceTab.tsx:553 | A | link „View" w wierszu tabeli zdarzeń bezpieczeństwa (nawigacja, nie destrukcja) | T8 |
| src/components/admin/AI/AuditComplianceTab.tsx:682 | A | ikona FileText obok nazwy raportu zgodności, ozdobna | T1 |
| src/components/admin/AI/AuditComplianceTab.tsx:762 | A | obwódka karty szablonu na hover | T3 |
| src/components/admin/AI/AuditComplianceTab.tsx:772 | A | odznaka „Based on {{basedOn}}" na karcie szablonu (etykieta typu) | T4 |
| src/components/admin/AI/CustomComplianceTemplateEditor.tsx:571 | A | ikona FileText w nagłówku „Create Custom Compliance Template" | T1 |
| src/components/admin/AI/CustomComplianceTemplateEditor.tsx:621 | A | ikona FileText w nagłówku „Edit/Create Compliance Template" | T1 |
| src/components/admin/AI/CustomComplianceTemplateEditor.tsx:668 | A | obwódka fokusu pola „Name" szablonu | T2 |
| src/components/admin/AI/CustomComplianceTemplateEditor.tsx:678 | A | obwódka fokusu pola „Version" | T2 |
| src/components/admin/AI/CustomComplianceTemplateEditor.tsx:690 | A | obwódka fokusu pola „Description" | T2 |
| src/components/admin/AI/CustomComplianceTemplateEditor.tsx:702 | A | chip taga (`bg-primary-500/20 text-primary-300`) — kolor kategorii | T4 |
| src/components/admin/AI/CustomComplianceTemplateEditor.tsx:718 | A | obwódka fokusu pola „Add tag…" | T2 |
| src/components/admin/AI/CustomComplianceTemplateEditor.tsx:784 | A | podkreślenie fokusu inline-edycji nazwy sekcji | T2 |
| src/components/admin/AI/CustomComplianceTemplateEditor.tsx:792 | A | podkreślenie fokusu inline-edycji opisu sekcji | T2 |
| src/components/admin/AI/CustomComplianceTemplateEditor.tsx:906 | A | hover przycisku kreskowanego „Add Checkpoint" (akcja DODANIA, nie usunięcia) | T3 |
| src/components/admin/AI/AccessLimitsTab.tsx:230 | A | crimson poświata pod przyciskiem Zapisz | T5 |
| src/components/admin/AI/AccessLimitsTab.tsx:251 | A | podkreślenie aktywnej pod-zakładki „Usage Limits" | T3 |
| src/components/admin/AI/AccessLimitsTab.tsx:262 | A | podkreślenie aktywnej pod-zakładki „User Tiers" | T3 |
| src/components/admin/AI/AccessLimitsTab.tsx:273 | A | podkreślenie aktywnej pod-zakładki „Costs" | T3 |
| src/components/admin/AI/AccessLimitsTab.tsx:356 | A | obwódka fokusu pola „Monthly budget USD" | T2 |
| src/components/admin/AI/AccessLimitsTab.tsx:374 | A | obwódka fokusu pola „Hard limit USD" | T2 |
| src/components/admin/AI/AccessLimitsTab.tsx:724 | A | etykieta wiersza „Reasoning" w tabelce progów auto-tieru | T4 |
| src/components/admin/AI/AccessLimitsTab.tsx:841 | A | link „View Details" w wierszu tabeli użytkowników | T8 |
| src/components/admin/AI/AccessLimitsTab.tsx:959 | A | odznaka typu encji (user=niebieski, pozostałe=crimson) — kolor kategorii | T4 |
| src/components/admin/AI/PolicyGovernanceTab.tsx:70 | C | `color` poziomu polityki PROACTIVE w skali 4-stopniowej | — (patrz nota C1) |
| src/components/admin/AI/PolicyGovernanceTab.tsx:71 | C | `bgColor` gradientu kafla PROACTIVE | — (patrz nota C1) |
| src/components/admin/AI/PolicyGovernanceTab.tsx:214 | A | ikona Shield przy tytule „AI Policy & Governance", ozdobna | T1 |
| src/components/admin/AI/PolicyGovernanceTab.tsx:240 | A | crimson poświata pod przyciskiem Zapisz | T5 |
| src/components/admin/AI/PolicyGovernanceTab.tsx:265 | A | `iconColor` karty „AI Policy Level" | T1 |
| src/components/admin/AI/PolicyGovernanceTab.tsx:336 | A | tło+obwódka zaznaczonej roli AI | T3 |
| src/components/admin/AI/PolicyGovernanceTab.tsx:344 | A | kolor zaznaczenia checkboxa roli + ring fokusu | T3 + T2 |
| src/components/admin/AI/PolicyGovernanceTab.tsx:361 | A | obwódka fokusu selecta „Default Role" | T2 |
| src/components/admin/AI/PolicyGovernanceTab.tsx:436 | A | crimson kwadracik-tło pod ikoną ListChecks (kafel informacyjny) | T1 |
| src/components/admin/AI/PolicyGovernanceTab.tsx:437 | A | ikona ListChecks w kaflu „Project overrides", ozdobna | T1 |
| src/components/admin/AI/PolicyGovernanceTab.tsx:452 | A | link „View Project Overrides →" | T8 |
| src/components/admin/AI/ModelsProvidersTab.tsx:551 | A | odznaka tieru **PREMIUM** przy dostawcy (`color: 'violet'` → renderuje się crimson) | T4 |
| src/components/admin/AI/ModelsProvidersTab.tsx:672 | A | spinner ładowania w pustym wierszu tabeli modeli | T1 |
| src/components/admin/AI/ModelsProvidersTab.tsx:713 | A | odznaka tieru PREMIUM przy modelu w tabeli | T4 |
| src/components/admin/AI/ModelsProvidersTab.tsx:854 | A | tło+obwódka kafla tieru PREMIUM w podsumowaniu | T4 |
| src/components/admin/AI/ModelsProvidersTab.tsx:869 | A | kolor ikony kafla tieru PREMIUM (Crown) | T4 |
| src/components/admin/AI/ModelsProvidersTab.tsx:882 | A | kolor etykiety kafla tieru PREMIUM | T4 |
| src/views/admin/AdminLLMView.tsx:620 | A | tło kafla „error rate" w gałęzi **ZDROWEJ** (błąd→`danger`, OK→crimson) | T6 |
| src/views/admin/AdminLLMView.tsx:625 | A | ikona AlertTriangle w gałęzi ZDROWEJ tego samego kafla | T6 |
| src/views/admin/AdminLLMView.tsx:971 | A | ikona ArrowRight w nagłówku „Fallback Chains", ozdobna | T1 |
| src/views/admin/AdminLLMView.tsx:977 | A | etykieta nazwy tieru nad łańcuchem fallbacku | T4 |
| src/views/admin/ApiKeysManagementView.tsx:334 | A | tło ikony klucza dla klucza **AKTYWNEGO** (wygasły/odwołany→`danger`) | T6 |
| src/views/admin/ApiKeysManagementView.tsx:341 | A | ikona Key dla klucza AKTYWNEGO — ta sama odwrócona semantyka | T6 |
| src/views/admin/ApiKeysManagementView.tsx:493 | A | tło+obwódka zaznaczonego uprawnienia API na liście wyboru | T3 |
| src/views/admin/ApiKeysManagementView.tsx:501 | A | kolor zaznaczenia checkboxa uprawnienia + ring fokusu | T3 + T2 |
| src/components/admin/AdminSecurityPolicyPanel.tsx:89 | A | ikona KeyRound w nagłówku karty „MFA enforcement", ozdobna | T1 |
| src/components/admin/AdminSecurityPolicyPanel.tsx:129 | A | ikona Shield w nagłówku karty „SSO posture", ozdobna | T1 |
| src/components/admin/AdminSecurityPolicyPanel.tsx:222 | A | ikona Lock w nagłówku karty „Session and password", ozdobna | T1 |
| src/views/admin/HelpAnalyticsDashboard.tsx:202 | A | ikona BarChart2 przy tytule „Help Analytics", ozdobna | T1 |
| src/views/admin/HelpAnalyticsDashboard.tsx:427 | A | ikona Video w nagłówku sekcji „Video Completion", ozdobna | T1 |
| src/views/admin/HelpAnalyticsDashboard.tsx:436 | A | wielka liczba `{completion_rate}%` — DANA liczbowa na crimson | T4 (lub `c-chart-1`) |
| src/components/admin/AdminBillingFinOpsPanel.tsx:511 | A | `variant="brand"` na przycisku „Assign plan & limits" — zwykłe CTA formularza | T7 |
| src/components/admin/AdminBillingFinOpsPanel.tsx:760 | A | ikona CreditCard w nagłówku „Billing, FinOps…", ozdobna | T1 |
| src/components/admin/AdminAIControlCenterPanel.tsx:150 | A | ikona Sparkles w nagłówku „AI Governance & AI Operations", ozdobna | T1 |
| src/components/admin/AdminRiskSummaryPanel.tsx:167 | A | ikona FileText w nagłówku „Risk follow-up queue" — ikona dokumentu, nie wskaźnik stanu | T1 |
| src/components/admin/ChatV9FlagsPanel.tsx:828 | A | link „Show more" pod opisem flagi + jego ring fokusu (`ring-primary-400/50`) | T8 + T2 |
| src/components/admin/AdminIamPolicyPanel.tsx:225 | A | ikona ShieldCheck w nagłówku „Enterprise IAM Governance", ozdobna | T1 |
| src/views/admin/TokenBillingManagementView.tsx:145 | A | ikona DollarSign w KPICard „System Balance", ozdobna | T1 |

## Noty do grupy C

**C1 — skala poziomów polityki AI (4 wystąpienia: PolicyGovernanceTab.tsx:70,71 oraz
OrgAISettingsView.tsx:186,187).** Skala ma 4 stopnie i taki dobór kolorów:
ADVISORY = slate · ASSISTED = blue · PROACTIVE = **crimson** · AUTOPILOT = **emerald**.
Nie umiem rozstrzygnąć tego sam z dwóch powodów:
(a) jeśli crimson ma tu znaczyć „podwyższone ryzyko autonomii AI", to jest to sygnał, a nie ozdoba —
ale wtedy najwyższy stopień autonomii (AUTOPILOT) powinien być jeszcze mocniejszy, a jest ZIELONY,
co czyni całą skalę niespójną i sugeruje, że kolory dobrano przypadkowo (dziedzictwo fioletu);
(b) naprawa punktowa (podmiana samego crimsona) zostawi skalę dalej bez porządku.
**Rekomendacja: nadzorca decyduje o CAŁEJ palecie skali naraz** — albo sekwencja
`c-chart-1..4` (skala uporządkowana), albo `c-tag-*` (kategorie bez porządku).
Te 4 linie nie powinny iść w zwykłej naprawie A.

## PODSUMOWANIE

- **A (dekoracja, do naprawy): 91**
- **B (semantyka krytyczna, zostaje): 0**
- **C (do osądu nadzorcy): 4**

Zero B nie jest przeoczeniem — sprawdziłem kontekst każdej z 95 linii i **żadna** nie oznacza
błędu, alertu, usunięcia ani stanu destrukcyjnego. Wszystkie stany krytyczne w tych plikach
używają już rodziny `danger-*` (np. `AdminLLMView.tsx:620`, `ApiKeysManagementView.tsx:334`).
Co więcej, w tych dwóch miejscach crimson stoi po stronie stanu ZDROWEGO, naprzeciwko `danger` —
czyli semantyka jest odwrócona i te 4 linie (T6) są najgorsze wizualnie w całej puli.

### Kolejność naprawy (pliki wg liczby A malejąco)

| # | plik | A | C |
|---|---|---|---|
| 1 | src/components/admin/AI/FeaturesPrivacyTab.tsx | 13 | 0 |
| 2 | src/views/admin/OrgAISettingsView.tsx | 12 | 2 |
| 3 | src/components/admin/AI/AuditComplianceTab.tsx | 11 | 0 |
| 4 | src/components/admin/AI/CustomComplianceTemplateEditor.tsx | 10 | 0 |
| 5 | src/components/admin/AI/AccessLimitsTab.tsx | 9 | 0 |
| 6 | src/components/admin/AI/PolicyGovernanceTab.tsx | 9 | 2 |
| 7 | src/components/admin/AI/ModelsProvidersTab.tsx | 6 | 0 |
| 8 | src/views/admin/AdminLLMView.tsx | 4 | 0 |
| 9 | src/views/admin/ApiKeysManagementView.tsx | 4 | 0 |
| 10 | src/components/admin/AdminSecurityPolicyPanel.tsx | 3 | 0 |
| 11 | src/views/admin/HelpAnalyticsDashboard.tsx | 3 | 0 |
| 12 | src/components/admin/AdminBillingFinOpsPanel.tsx | 2 | 0 |
| 13 | src/components/admin/AdminAIControlCenterPanel.tsx | 1 | 0 |
| 14 | src/components/admin/AdminRiskSummaryPanel.tsx | 1 | 0 |
| 15 | src/components/admin/ChatV9FlagsPanel.tsx | 1 | 0 |
| 16 | src/components/admin/AdminIamPolicyPanel.tsx | 1 | 0 |
| 17 | src/views/admin/TokenBillingManagementView.tsx | 1 | 0 |
| | **razem** | **91** | **4** |

### Uwaga o kolejności — sugerowana zmiana wobec „wg liczby A"

Kolejność wg liczby A jest w tabeli powyżej zgodnie z poleceniem, ale realnie 91 wystąpień
rozpada się na **8 powtarzalnych wzorców**, nie na 91 osobnych decyzji:

| wzorzec | ile | plików |
|---|---|---|
| obwódka/ring fokusu pola formularza (T2) | 19 | 7 |
| stan aktywny/zaznaczony: zakładki, karty, checkboxy (T3) | 20 | 7 |
| ikona ozdobna nagłówka / `iconColor` karty / spinner (T1) | 27 | 14 |
| kolor kategorii: odznaka tieru, chip taga, etykieta (T4) | 14 | 7 |
| crimson poświata `shadow-primary-500/20` pod przyciskiem (T5) | 5 | 4 |
| odwrócona semantyka: crimson = stan zdrowy (T6) | 4 | 2 |
| `variant="brand"` na zwykłym CTA (T7) | 1 | 1 |
| link tekstowy (T8) | 6 | 5 |

Naprawa **wzorcami** (jeden przebieg = jeden wzorzec przez wszystkie 17 plików) daje jednolity
efekt i weryfikowalny zrzut per wzorzec; naprawa plik-po-pliku zostawia rozjazdy między ekranami.
To jest moja rekomendacja, nie pomiar — decyzja należy do nadzorcy.

### Czego NIE zmierzyłem (uczciwie)

1. **Nie oglądałem tych ekranów wzrokiem.** Klasyfikacja opiera się wyłącznie na czytaniu kodu
   (±6 linii kontekstu wokół każdego z 95 trafień). Nie zrobiłem ani jednego zrzutu.
2. **Nie sprawdziłem, czy te ekrany w ogóle się renderują.** Możliwe, że część z 17 plików to
   „biblioteka bez wywołania" — nie szukałem wołaczy ani tras.
3. **Nie objąłem innych zapisów crimsona**: `crimson-*`, `c-accent`, `#85182F`, `bg-primary`/
   `text-primary` bez numeru, `variant="danger"`, ani plików `.ts`/`.css`. Pomiar ograniczyłem
   dokładnie do wzorca ze zlecenia (`primary-[0-9]` + `variant="brand"` w `.tsx`). Realny dług
   crimsona w Adminie jest więc **nie mniejszy niż 95** — górnej granicy nie znam.
4. **Nie sprawdziłem, czy `c-tag-*` i `c-chart-*` są w tych plikach dostępne/importowalne** —
   propozycje T4 zakładają, że tak (są w `tailwind.config.js`), ale tego nie zweryfikowałem w użyciu.
