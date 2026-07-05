# ★★★ ARTEFAKTY — SPEC MENU per artefakt (2026-07-05)
> Co MA być w każdym menu każdego artefaktu. Baza: ARTIFACT_ANATOMY_STANDARD §5 (menu per archetyp) + §13 (instancjacja) + §11.2 (powłoka build-ready). Uziemienie realnych pól/akcji encji = przy budowie (skill consultify-artefakty).
> Lista 33 artefaktów: `_ROLLOUT_ARTEFAKTY_PLAN.md`. Decyzje Piotra 07-05: Interview=Rekord z centrum-czatem · Notatka=L.

## Legenda stref (anatomia §2 — 6 stref)
- **M1** = Menu 1 tożsamości (cienki pasek): ← back/breadcrumb · ikona-typ · tytuł inline · status lifecycle · wskaźnik zapisu (osobno) · [indeks] · **1 PRIMARY** (prawa).
- **M2** = Menu 2 listwa edycji — TYLKO archetyp B (formatowanie tekstu) / D-E (toolbar). Rekord/Canvas: brak.
- **M3** = Menu 3 akcje widoku: nawigacja wewn. (klasa L, pill/underline) + view-local + **[AI]** (prawa). Klasa S: brak M3.
- **RAIL** = lewy rail narzędzi — TYLKO archetyp A (znika gdy pusty).
- **PANEL** = prawy panel accordion `ArtifactRightPanel`, sekcje STAŁA kolejność: **Akcje · Właściwości · Powiązania · Komentarze · Historia/AI**.
- **KEBAB/PPM** = menu kontekstowe, kolejność §6.4 (Otwórz·Podgląd — Edytuj·Powiel·Zmień nazwę — Eksport·Udostępnij·Przenieś — AI — Archiwizuj·Usuń).

---

# ARCHETYP C — REKORD (12 artefaktów)
Centrum = sekcje pól. **M2 = brak · RAIL = brak.** Klasa S: nośnik treści = prawy panel (drawer), brak M3. Klasa L: M3 = zakładki sekcji.

## Wspólny szkielet (identyczny dla wszystkich Rekordów)
- **M1:** ← · ikona-typ · tytuł inline · status lifecycle · „Zapisano •" · [indeks] · **PRIMARY = przejście stanu** (per artefakt niżej).
- **M2:** — (rekord nie edytuje tekstu ciągłego).
- **M3:** klasa S → brak. Klasa L → pill-zakładki sekcji + [AI: uzupełnij] (prawa).
- **RAIL:** —
- **PANEL (accordion):** Akcje (Eksport▸/Udostępnij/Kopiuj-link) · Właściwości (owner/daty/status/prio/budżet…) · Powiązania (klikalne linki) · Komentarze · Historia/AI. Klasa S: panel = całe centrum drawera.
- **KEBAB:** Otwórz·Podgląd — Edytuj·Powiel·Zmień nazwę — Eksport▸·Udostępnij·Przenieś▸ — AI:uzupełnij — Archiwizuj·Usuń(danger).

## Per artefakt — delta (ikona · otwiera · M1 PRIMARY · M3 zakładki (L) · PANEL sekcje kluczowe)
| # | Artefakt | Ikona | Otwiera | M1 PRIMARY | M3 zakładki (klasa L) | PANEL — sekcje kluczowe |
|---|----------|-------|---------|-----------|------------------------|--------------------------|
| 17 | **Initiative** (L) | `target` | pełna | „Submit for Review" (wg statusu) | Przegląd · Zadania · Definicja · Wdrożenie · Ekonomia · Governance · Zespół | Właściwości(owner/sponsor/budżet/oś) · Powiązania(KPI/tasks/źródła) · Komentarze · Historia |
| 18 | Task (S) | `check-square` | drawer | „Oznacz done" | — (S) | Właściwości(status/prio/owner/termin) · Podzadania · Powiązania · Komentarze · Historia |
| 19 | Decision (S) | `scale` | drawer | „Zatwierdź" | — | Opcje · Wpływ · Zatwierdzenia · Powiązania · Historia |
| 20 | KPI (S) | `gauge` | drawer | „Zapisz pomiar" | — | Formuła · Cel/baza · Powiązane inicjatywy · Historia |
| 21 | Insight (S) | `gem` | drawer | „Konwertuj → inicjatywa" | — | Dowody · Kategoria · Powiązania · Historia |
| 22 | Idea / Concept (S) | `lightbulb` | drawer | „Konwertuj → inicjatywa" | — | Tagi · Źródło · Powiązania |
| 23 | RAID (S) | `shield-alert` | drawer | „Zamknij" | — | Kategoria · Prawdopod./wpływ · Mitygacja · Owner · Historia |
| 24 | Milestone (S) | `flag` | drawer | „Oznacz osiągnięty" | — | Data · Powiązane dostawy · Zależności |
| 25 | Change Request (S) | `git-pull-request` | drawer | „Zatwierdź zmianę" | — | Wpływ · Plan wdrożenia · CCB · Historia |
| 26 | Stage Gate (S) | `shield-check` | drawer | „Zatwierdź bramę" | — | Kryteria · Dostawy · Zatwierdzający |
| 27 | Action Proposal (S) | `wand-2` | drawer | „Akceptuj" / „Odrzuć" | — | Uzasadnienie AI · Wpływ · Dowody |
| 28 | **Interview Session** (L) | `messages-square` | pełna | „Zakończ / Generuj insights" | Rozmowa · Pytania · Insights · Podsumowanie | Właściwości(respondent/status/postęp) · Powiązania(inicjatywy/insights) · Historia. **Centrum = czat** (nie sekcje pól) |

**Uwaga Interview (§20 Q2):** powłoka Rekordu (M1/panel/kebab identyczne), jedyna różnica = centrum to konwersacja zamiast sekcji-pól.
