# Content Gap Register — `constraint-control` (Constraint Control Loop / Pętla sterowania ograniczeniami, TOC)

> Wave 3 ("Operational and Automation Tools"), `is_coming_soon=1` w live registry.
> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`.

---

## 1. Co istnieje

### 1.1 Marketing / Library copy (w repo, ale efektywnie nieosiągalna z API)

- `server/migrations/562_tools_toolsets_speed.sql:25-67` (migracja **aktywna**) — pełny 9‑polowy JSON EN+PL: `shortDescription:"A practical TOC playbook: find the constraint, protect it, and improve flow.", whenToUse, whatYouGet[3], inputs[4], steps[5]=["Identify constraint","Protect (buffers)","Exploit (standard work)","Subordinate (WIP rules)","Elevate (capacity)"], outputs[3], commonMistakes[3], example:"Bottleneck is packaging → protect with buffer, reduce changeovers, subordinate upstream release.", nextSteps[2]`. `steps[5]` to niemal dosłowna parafraza Pięciu Kroków Skupienia Goldratta (patrz §3) — ale bez cytowania źródła. [REPO_CANON]
- `server/migrations/562_tools_toolsets_speed.sql:742,769-838` — artykuł KB `kb-art-tools-constraint-control` (slug `tools-constraint-control-how-to`), status `published`, EN+PL, pełniejszy wariant sekcji: `Purpose/when to use → Inputs → Steps(5) → Outputs → Common mistakes → Next steps` (~150 słów/język).
- **Ten content jest martwy z perspektywy API** — identyczny mechanizm jak opisany w rejestrze `vsm-builder.md` §1.1:
  - `server/src/services/KnownToolsService.ts:205-228` — `ACTIVE_KNOWN_TOOL_TYPES` nie zawiera `constraint-control`.
  - `server/src/services/KnownToolsService.ts:900-902` — `getKnownTool()` zwraca `null`.
  - `server/src/services/KnownToolsService.ts:440-453` (`SQLITE_KNOWN_TOOLS_SEED`) — `isComingSoon: true` (linia 452), `whatYouGetEn: ['Constraint hypothesis', 'Buffer policy', 'Action list']`.
  - `server/src/services/KnownToolsService.ts:707-768` (`ensureToolsSeedOnce`) — przy każdym starcie procesu nadpisuje `library_content_translations` z powrotem do `{"whatYouGet":[3 punkty]}`, kasując pola z 562 (komentarz w kodzie linie 713-717 potwierdza intencję).
  - `tests/components/Discovery/DiscoveryToolsHub.inactiveTools.test.tsx` (RV‑028) — niezależna asercja braku Open/Start dla `constraint-control`.

### 1.2 Spec dokumentu produktowego

- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:580-593` (§3.17) — **cienki** wizard plan: `Goal/Inputs/Preview graphic/Micro-video/KB: TBD` + 2‑liniowy Wizard plan. Brak Define/Inputs & assumptions/Review/Finalize.

### 1.3 Runtime / silnik

- `src/config/agentManifests/discoveryToolsRegistry.ts:128` — w `PLANNED_TOOL_IDS`, `status:'planned', steps:[]`.
- `src/store/useToolStore.ts:2738` — `TOOLSET_OPERATIONAL_STEPS` (8 generycznych kroków, zob. `vsm-builder.md` §1.3) — brak kroków „zidentyfikuj constraint / chroń / wykorzystaj / podporządkuj / podnieś".
- `src/hooks/discovery/toolAi/systemPrompts.ts:195` — generyczny `OPERATIONAL_SYSTEM_PROMPT`, bez wzmianki o TOC, buforach, drum-buffer-rope.
- `src/components/DiscoveryTools/dedicatedToolTypes.ts:24` — w `DEDICATED_TOOL_TYPES` (realna powłoka renderująca, generyczna treść).
- Brak `src/config/constraintcontrol/`.

### 1.4 Knowledge base

- `knowledge/tool-kb/` — zero katalogu `constraint-control`. [EVIDENCE_MISSING]

### 1.5 Mylący dokument

- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` §3.2 — klasyfikuje jako brakujące wyłącznie `GFX, VID`; nie uwzględnia gate'u `ACTIVE_KNOWN_TOOL_TYPES` z §1.1. Nieaktualne.

---

## 2. Czego brakuje

- **Silnik/logika TOC**: brak Pięciu Kroków Skupienia jako realnej logiki narzędzia (tylko jako 5 nazw w bullet-liście marketingowej, nieużywanych przez runtime).
- **Bank pytań**: zero (brak `src/config/constraintcontrol/deepeningLadder.ts` lub odpowiednika).
- **Reguły identyfikacji ograniczenia**: brak algorytmu/heurystyki „jak rozpoznać constraint" (np. porównanie przepustowości per krok, analiza kolejek) — samo `inputs` wskazuje dane potrzebne, ale nie ma logiki ich przetwarzania.
- **Polityka buforów (Drum-Buffer-Rope)**: brak jakiejkolwiek reprezentacji reguł priorytetyzacji/release w kodzie.
- **Asset**: brak preview graphic i micro-wideo.

---

## 3. Czy istnieje wiarygodne źródło

**Tak — kanoniczny, publiczny framework.** Theory of Constraints (TOC), Eliyahu M. Goldratt, *"The Goal"* (North River Press, 1984) + Pięć Kroków Skupienia (Identify → Exploit → Subordinate → Elevate → Repeat) i metoda Drum-Buffer-Rope. Szeroko wykładany w programach Operations Management na całym świecie. [AUTHORITATIVE_EXTERNAL_SOURCE — istnieje w zasadzie; w repo jest tylko luźna, niecytowana parafraza 5 kroków w Library copy — samo źródło (książka, definicje buforów, DBR) nie jest nigdzie zacytowane ani zaimplementowane.]

Uwaga terminologiczna: `steps[5]` w Library copy używa „Protect" zamiast klasycznego „Exploit" jako drugiego kroku (Goldratt: Identify → Exploit → Subordinate → Elevate → Repeat) — to odstępstwo od kanonicznej kolejności/terminologii TOC, prawdopodobnie nieświadome uproszczenie autora treści. Jeśli authoring ma się opierać na TOC, wymaga korekty do oryginalnej sekwencji i terminologii.

---

## 4. Czego NIE WOLNO wygenerować

- Konkretnych wielkości buforów (np. „bufor = 30% czasu cyklu") bez danych/źródła.
- Fabrykowanych przykładów liczbowych rozszerzających istniejący `example` (`"Bottleneck is packaging..."`).
- Twierdzeń o formalnej certyfikacji/partnerstwie z Goldratt Institute lub TOCICO.
- Gotowych progów „ile WIP to za dużo" bez kontekstu klienta.

---

## 5. Minimalny Pack do authoringu

1. **`methodology/v1`**: poprawiona (zgodna z oryginałem Goldratta) sekwencja 5 kroków, cytowanie źródła, definicja bufora/DBR, kiedy używać / kiedy NIE (np. gdy nie ma jednego wyraźnego ograniczenia).
2. **`qbank/v1`**: pytania do identyfikacji ograniczenia (dane o przepustowości, kolejkach, przestojach) + pytania do projektowania reguł bufora.
3. **`help/v1`**: rozbudowa `562:769-838` do 4 bloków Cel/Proces/Rezultat/Przykład, z jednym zatwierdzonym przykładem.
4. Jawna adnotacja: żadnych wielkości buforów bez danych klienta.

---

## 6. Wymagany przegląd ekspercki

**TAK.** Błędna identyfikacja ograniczenia (np. mylenie „wąskiego gardła" z „najbardziej wykorzystanym zasobem") jest jednym z najczęstszych błędów praktycznych w TOC — wymaga recenzji osoby ze znajomością Operations Management/TOC. [EXPERT_REVIEW_REQUIRED]

## 7. Wymagany przegląd prawny

**Ograniczony.** Sama idea TOC/5 kroków jest powszechnie wykładana i niechroniona, ale nazwy „Theory of Constraints", metodyki DBR bywają kojarzone z certyfikacją TOCICO — jeśli authoring będzie sugerował certyfikację/partnerstwo, wymagany check. Samo cytowanie koncepcji (bez podszywania się pod certyfikację) — niskie ryzyko. [LEGAL_REVIEW_REQUIRED — warunkowo]

---

## 8. Provenance tags

`REPO_CANON` · `ENGINE_DERIVED` (brak) · `AUTHORITATIVE_EXTERNAL_SOURCE` (TOC/Goldratt) · `EDITORIAL_DRAFT` (Library+KB, niecytowane, z odstępstwem terminologicznym) · `LEGAL_REVIEW_REQUIRED` · `EXPERT_REVIEW_REQUIRED` · `EVIDENCE_MISSING` (stan bazy live niezweryfikowany zapytaniem SQL).
