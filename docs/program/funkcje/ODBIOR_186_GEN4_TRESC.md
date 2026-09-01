---
doc_id: funkcje-odbior-186
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 186 — treść w PPT z szablonu · SCALONO (B+/A−) · GEN-4 zostaje PARTIAL

Rzadki przypadek: dowód WYTRZYMAŁ próbę obalenia. Plik PPTX przebadany rygorem
po-185: odbiór NIEZALEŻNIE odtworzył generację na świeżym kontenerze — plik
bit-w-bit ten sam rozmiar (88 945 B), znacznik w stopce KAŻDEGO slajdu i w
dc:title z sekundą uruchomienia testu odbioru. **Realna trasa HTTP→Gateway→
mapper→PG→eksport, nie fixture.** Treść z briefu (EUR 2.2m, 15 August), zero
„Key point". Mutacja (zdjęcie briefu → placeholdery wracają) czerwona→zielona.
Zero zmian mappera/eksportu (Z40); deterministyczne dopasowanie, zero AI.

## Dlaczego PARTIAL, nie wyżej — uczciwy strop
Backend przyjmuje `brief` z body, front przekazuje `templatePrompt` — ale **żadne
z 4 wejść nawigacyjnych do trasy szablonowej nie ustawia `templatePrompt`**
(zmierzone: ArtifactModuleHome:152, artifactNavigation:107,
presentationWizardRedirect:46, chatActionHandler:327). Realny użytkownik dziś
nadal dostanie placeholdery. **→ decyzja produktowa właściciela: SKĄD brief
(czat? modal w Bibliotece?)** — naturalnie łączy się z MARZENIE_GAMMA_DECKI (G-3).

## Systemowe
Z31-pin w teście 186 SKOPIOWANY z zastanego testu dnia 83 (identyczny wzorzec
cx_day83:5955) — to defekt RODZINY testów prezentacji, nie tego dyżuru.
Licznik pinów Z31 w programie: 6 → **dyżur 193: zbiorcze odpięcie** (160, 164✓,
170✓, 171✓, 83, 186). Zastane 4 FAIL mappera — bajt-identyczne z markerem, nie regresja.
