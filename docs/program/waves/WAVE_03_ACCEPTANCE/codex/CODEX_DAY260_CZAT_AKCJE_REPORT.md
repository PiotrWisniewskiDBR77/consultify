# CODEX DAY 260 — Czat: akcje bez producenta

## Streszczenie

Na bazie `df7f13056f` potwierdzono T1–T6: katalog ma 14 typów, osiem wskazanych typów nie ma literalnego producenta poza czterema powierzchniami katalogowymi, a pozostałe sześć ma co najmniej jednego rzeczywistego producenta akcji czatu. Test regresyjny pinuje liczbę 8 i przechodzi 2/2 z `--retry=0`. Dyżur nie zmienił kodu produktu, typów ani testu; dostarcza wyłącznie materiał decyzyjny i addytywny wpis do karty modułu.

## §0 — wejście i bezpieczeństwo

- Dokument: `WYDANY`; marker `df7f13056f`; gałąź bazowa `github-backup/codex/m03-admin-20260824`.
- `merge-base --is-ancestor ... && echo`: `MARKER OK`.
- Sanity: `df7f13056fa24995be07f64b0e8c877b3faeab45`; `git status --short` był pusty.
- Tip gałęzi bazowej uciekł o 9 commitów; zgodnie z DEC-2026-08-26-95 pracę rozpoczęto dokładnie z markera. Zmienione między markerem a tipem były dokumenty instrukcyjne/programowe, bez plików produktu objętych R1.
- Dysk: przed worktree 12 GiB, po utworzeniu 9.5 GiB wolnego (próg 5 GB spełniony).
- Porty 6260, 5240, 5241: brak procesu nasłuchującego; kontenera `cx-day260-pg` nie uruchamiano, bo jedyny pakiet jest czysto plikowym testem jednostkowym.
- Zero LLM, Railway, zdalnej bazy, SMTP, runtime'u i operacji zapisujących dane produktu.

## R1 — pomiar własny

### T1/T2

`grep -c "^  | '" src/types/domain/chatActions.ts` zwrócił `14`. Osobne kontrole ujemne dla `START_TOOL`, `OPEN_PREVIEW`, `ASSIGN_INTERVIEW`, `START_ARTIFACT_REVIEW`, `CHECK_TRUST_STATE`, `ANALYZE_STATEMENT`, `REVIEW_MODEL`, `CHECK_LANE_STATUS` zwróciły zero trafień poza testami i czterema powierzchniami katalogowymi.

Ograniczenie: grep literalny nie wykryje producenta składającego nazwę dynamicznie. Kontrolą dodatnią jest ten sam pomiar na sześciu znanych typach oraz lektura trafień tworzących obiekty `action` w `UnifiedChatPanel.tsx:2832-2932`.

### T3 — kontrola dodatnia i semantyczna

| Typ | Pliki trafione po wykluczeniach | Werdykt po lekturze |
|---|---:|---|
| `NAVIGATE` | 5 | rzeczywisty producent m.in. `UnifiedChatPanel.tsx:2832,2881`; pozostałe trafienia obejmują producentów i konsumentów |
| `GENERATE_REPORT` | 9 | część trafień to obce etykiety workflow, ale `UnifiedChatPanel.tsx:2896` tworzy akcję czatu |
| `GENERATE_PRESENTATION` | 1 | rzeczywisty producent `UnifiedChatPanel.tsx:2902` |
| `USE_TEMPLATE` | 1 | rzeczywisty producent `UnifiedChatPanel.tsx:2917` |
| `BROWSE_TEMPLATES` | 1 | rzeczywisty producent `UnifiedChatPanel.tsx:2908` |
| `RECORD_KPI` | 1 | rzeczywisty producent `UnifiedChatPanel.tsx:2929` |

Nie znaleziono dziewiątego typu bez producenta. Dla `GENERATE_REPORT` sam wynik grep zawiera fałszywe pozytywy semantyczne, lecz niezależnie zawiera też prawdziwego producenta.

### T4/T5/T6 i zasięg testu

- `day223.chatActionsInventory.test.ts:45` zawiera `toHaveLength(8)`.
- `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run ... --retry=0 --reporter=json`: 2/2 PASS.
- Pełne nazwy przed zmianami: `does not allow the producer-less inventory to grow beyond eight types`; `keeps governed draft creation out of the legacy chat action catalog` (obie z prefiksem suite `day223 ChatActionType producer inventory`).
- Przed zmianą karta nie miała sekcji Dzień 260. Dysk: 9.5 GiB wolnego.

Pułapki Z33: (a)–(d) nie dotyczą tego testu, ponieważ plik czyta pliki przez `readFileSync`, nie montuje Gateway, middleware, auth ani bazy; dlatego użyto jawnie `RUN_DB_TESTS=0 MOCK_DB=true`. Pułapka (e) dotyczy: nie utworzono żadnego pliku próbnego w `src`/`server/src`, a test uruchomiono na niezmienionym drzewie. `--retry=0` wyłączył ponowienia.

## R2 — warianty decyzyjne

W każdym wariancie B minimalny wspólny promień obejmuje: `chatActions.ts`, `chatActionRegistry.ts`, `chatActionHandler.ts`, `federatedActionAdapters.ts` oraz zmianę rygla `day223.chatActionsInventory.test.ts` z 8 na 7 dla pojedynczego usunięcia. Każdy typ występuje też w dokumentacji; `START_TOOL` dodatkowo w `docs/product/V3_IMPLEMENTATION_PROGRAM.md`. Brak trafień w `public/locales`.

| Typ | Powód z R1 | A: producent | B: usunięcie | C: jawna adnotacja | Rekomendacja audytora (NIE decyzja) |
|---|---|---|---|---|---|
| `START_TOOL` | brak kanonicznego narzędzia i payloadu | **duży**: decyzja o allowliście/payloadzie, trigger UI i handler; co najmniej 3–4 pliki + testy | **średni**: wspólny promień + szersza dokumentacja produktowa | **praktycznie zerowy**: komentarz `DO_DECYZJI_WLASCICIELA`; ryzyko trwałego widma | NIE decyzja: najpierw zdefiniować kontrakt narzędzi; do tego czasu C |
| `OPEN_PREVIEW` | brak relacji `workspaceContext` → typ/ID | **średni**: mapowanie entityType/entityId, trigger i handler; 3–4 pliki + testy kontekstów | **średni**: wspólny promień + dokumentacja | **praktycznie zerowy**; ryzyko utrwalenia martwego skrótu | NIE decyzja: A dopiero po kanonicznym mapowaniu, obecnie C |
| `ASSIGN_INTERVIEW` | brak decyzji template i assignees | **duży**: polityka doboru, UI potwierdzenia, producent/handler i testy uprawnień; 4+ pliki | **średni**: wspólny promień + dokumentacja | **praktycznie zerowy**; ryzyko niejawnej obietnicy funkcji | NIE decyzja: C do decyzji o uprawnieniach i assignees |
| `START_ARTIFACT_REVIEW` | brak kanonicznego artefaktu i lifecycle review | **duży**: wybór artefaktu, lifecycle, trigger/handler i testy; 4+ pliki | **średni**: wspólny promień + dokumentacja | **praktycznie zerowy**; ryzyko trwałego widma | NIE decyzja: C do wskazania lifecycle i artefaktu |
| `CHECK_TRUST_STATE` | nieustalony scope trust | **średni/duży**: kontrakt scope, źródło danych, producent/handler i testy tenantowe; 4+ pliki | **średni**: wspólny promień + dokumentacja | **praktycznie zerowy**; ryzyko niejednoznacznej obietnicy | NIE decyzja: C; A dopiero po decyzji scope i dostępu |
| `ANALYZE_STATEMENT` | nieustalone Czat vs Finance | **duży**: decyzja własności, payload statement, trigger/handler i testy; 4+ pliki | **średni**: wspólny promień + dokumentacja | **praktycznie zerowy**; ryzyko dublowania Finance | NIE decyzja: rozstrzygnąć granicę modułu; jeśli Finance-only, preferować B |
| `REVIEW_MODEL` | nieustalone Czat vs Finance | **duży**: decyzja własności i modelId, trigger/handler oraz testy; 4+ pliki | **średni**: wspólny promień + dokumentacja | **praktycznie zerowy**; ryzyko dublowania Finance | NIE decyzja: jak wyżej; przy Finance-only preferować B |
| `CHECK_LANE_STATUS` | brak kanonicznego `runId` | **średni**: źródło runId, trigger/handler, pusty stan i testy; 3–4 pliki | **średni**: wspólny promień + dokumentacja | **praktycznie zerowy**; ryzyko wiecznie martwego typu | NIE decyzja: C do czasu gwarantowanego runId |

## R3 — karta modułu

Na końcu `13_CHAT/MODULE_ACCEPTANCE.md` dopisano wyłącznie sekcję Dzień 260 z linkiem do powyższej tabeli. Istniejącej treści nie zmieniono.

## Artefakty

- `/private/tmp/cx-day260-czat-akcje-artefakty/r1-pelne-wyjscie.txt`
- `/private/tmp/cx-day260-czat-akcje-artefakty/przed.json`
- `/private/tmp/cx-day260-czat-akcje-artefakty/przed-nazwy.txt`
- `/private/tmp/cx-day260-czat-akcje-artefakty/po.json`
- `/private/tmp/cx-day260-czat-akcje-artefakty/po-nazwy.txt`
- `/private/tmp/cx-day260-czat-akcje-artefakty/nazwy.diff`

SHA-256, w kolejności powyżej: `4faeb42e4f6d1e737fa80d8d2dc3b05ccbbcc81e5a393539a7f7397d652372c7`, `f50981ea6f8bebbf82b1d774aaa28795dd776633d1890d6b1ca7b38fe71d6348`, `184bfe09cc18b4a0dfae12f2c41828d299e32d75faa9dce2bcb3e313b1b55f31`, `df3baacd3c097d66d6f15b35e0fb56475116fd54c11d8acdb4bf97a52dda1cc1`, `184bfe09cc18b4a0dfae12f2c41828d299e32d75faa9dce2bcb3e313b1b55f31`, `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

`nazwy.diff` jest pusty: nie dodano ani nie utracono żadnej pełnej nazwy testu.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykluczono producentów składających nazwę typu dynamicznie; metoda literalnego grepu tego nie potrafi. Nie znaleziono przesłanki takiego mechanizmu, ale nie jest to dowód nieistnienia.
- Koszty są rzędem wielkości na podstawie promienia plików, nie estymacją czasu ani zobowiązaniem wykonawczym.

## Korekty wobec instrukcji

- Brak obalonej tezy T1–T6.
- Dla `GENERATE_REPORT` liczba 9 plików nie oznacza 9 producentów: część trafień jest etykietami workflow/konsumentami. Teza T3 pozostaje prawdziwa dzięki rzeczywistemu producentowi w `UnifiedChatPanel.tsx:2896`.

## Deklaracja Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Nie uruchomiłem bazy, `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.
