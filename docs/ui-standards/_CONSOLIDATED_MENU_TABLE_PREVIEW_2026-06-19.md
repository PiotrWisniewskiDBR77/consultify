> ⚠️ **DOKUMENT UNIEWAŻNIONY 2026-07-27** — powód: porzucony draft z TRZECIĄ, sprzeczną definicją
> „Menu 1/2/3"; nigdy nie zaakceptowany · zastąpiony przez: `docs/ui-standards/TRIADA_KANON.md`
> (listy) + `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (artefakty).

# Skonsolidowany standard: Menu 1/2/3 · Tabele · Preview
**Data:** 2026-06-19 · **Status:** DRAFT do akceptacji Piotra · **Cel:** JEDEN punkt odniesienia do przejścia ekran-po-ekranie.

> Powstał, bo pytanie „czy mamy jeden spójny opis standardu?" ma odpowiedź: **specy istnieją i są w większości spójne, ale są rozsypane po 2 katalogach, 5 plikach „kanon" z dwoma sprzecznymi deklaracjami autorytetu i duplikatami.** Nie ma jednego dokumentu, na który można wskazać. Ten plik to scala. Po akceptacji → on staje się autorytetem, reszta idzie do `_archive/`.

---

## A. NAJPIERW: 3 decyzje do podjęcia (źródło chaosu)

**DECYZJA 1 — który dokument jest najwyższym autorytetem?** (sprzeczność wprost)
- `README.md`: „AUTORYTET → CANON.md (od 2026-06-14)"
- `TABLE_AND_PREVIEW_CANON.md`: „podrzędny tylko wobec **CONSULTIFY_UI_UX_GOLDEN_STANDARD.md**"
- Kandydaci: `CANON.md` (167 lin), `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` (674), `CONSULTIFY_UI_UX_OPERATING_STANDARD.md` (708), `UI_UX_CANON_V3.md` (341).
- **Rekomendacja:** GOLDEN_STANDARD = north star (wizja), + ten plik = operacyjny SSOT komponentów. Reszta → archiwum. **Twoja decyzja.**

**DECYZJA 2 — usunąć duplikaty „ 2"** (artefakty merge): `CANON 2.md`, `TIMELINE_CALENDAR_CANON 2.md`, `MASTER_PLAN 2.md`, `artifact-shell-future-standard 2.md`, `review-capture 2.mjs`, `capture-screens 2.mjs`. **Rekomendacja: skasować po weryfikacji, że nie są podlinkowane.**

**DECYZJA 3 — dwa katalogi standardów scalić.** Specy Menu żyją w `docs/UI_UX/` (`13_MENU_2_MODULE_TOPBAR.md`, `14_MENU_3_COMMAND_ROW.md`), a tabela/preview w `docs/ui-standards/03-modules/`. **Rekomendacja: wszystko pod `docs/ui-standards/`.**

---

## B. NAZEWNICTWO (potwierdź — to jedyna realna niejasność)
- **Menu 1** = lewy rail aplikacji (pionowe ikony: Chat / My Work / Interview / …). Nawigacja modułów. NIE pasek akcji.
- **Menu 2** = topbar modułu: **lewo** = search toggle → główne taby modułu (Ideas/Notebook/Inbox… — **bez liczników w tabach**); **prawo** = klaster (od prawej): view-modes (segmented icons) → max 1 dropdown „Filters".
- **Menu 3** = command row pod Menu 2 (dynamiczny dla kontekstu): **lewo** = presety/filtr-chipy; **prawo** = akcje kontekstowe + AI. Lifecycle/governance (review/approve/generate) tu, NIE w canvasie.

*(jeśli u Ciebie „Menu 1" = taby Ideas/Notebook, a rail to „Menu 0" — popraw, dostosuję)*

---

## C. SYSTEM WYSOKOŚCI (to się rozjeżdżało — oto spójna prawda z 6 plików)
| Element | Wysokość | Reszta |
|---|---|---|
| **Menu 2 kontrolki** (taby, view-modes, filters dropdown) | **h-9** | spójny family, bez gradientów |
| **Menu 3 chipy** (filtr/status/meta, sm) | **h-6** `px-2 text-[11px] rounded-full` | aktywny=wyróżniony, nieaktywny=neutral |
| Menu 3 chipy (md) | **h-7** `px-2.5 text-xs` | |
| **Menu 3 przyciski/kontrolki** (AI, bulk, akcje) | **h-8** `rounded-full text-[11px]` border, ikona+label | identyczne ze sobą; bulk = ten sam taxonomy |
| **Preview-footer action pills** | **h-9** | `actionPillClass()` z `previewStyles.ts` |
| Domyślny przycisk | **h-9** | |

Źródła zgodne: GOLDEN_STANDARD:162 („h-9 default, h-8 for dense Menu 3"), module-hub-standard:195/794, FROZEN_LAYOUTS:106, TABLE_AND_PREVIEW_CANON:686, TABLE_AUDIT_SHEET D-13. **Brak realnej sprzeczności — był tylko brak jednej tabeli (powyżej) → stąd mylenie chip/button/pill.**

---

## D. TABELA (SSOT: TABLE_AND_PREVIEW_CANON.md — solidny, zostaje rdzeniem)
- Komponenty: `TableWithPreviewLayout` (orkiestracja) + `FilterableTable` (powłoka). NIE pisać nowego `<table>`.
- Surface/kontener §3.1; nagłówek §3.2; model kolumn §3.3; gęstość/wiersz §3.4.
- **Selection §3.5** — to jest dokładnie pole sweepu crimson→szary; tu rozstrzygamy „żywy" vs „płaski" stan zaznaczenia (patrz DECYZJA poniżej).
- Statusy/progress/due §4 (StatusChip + statusChipTone; progress info→success; due jeden model).
- Sort/filter/resize/persistencja §5; ustawienia kolumn §6.

## E. PREVIEW (SSOT: TABLE_AND_PREVIEW_CANON §7)
- Domyślnie ZAMKNIĘTY. single-click=select+preview, double/Enter=full, Esc=zamknij. Szerokość `clamp(340px,28%,480px)`, `gap-1.5`, BEZ `border-l`.
- Stopka — sztywna kolejność: AI hints (3 chipy+⋮) → divider → Relations (2 wiersze) → divider → **Actions (pill h-9)**.
- JEDNO „Open" w całym preview. Akcje przez `PreviewActionBar`+`actionPillClass()`.
- Cross-module draft: single-click NIGDY nie wyrzuca do modułu docelowego; draft zostaje w tabeli źródłowej (naprawa Initiatives 2026-06-07).

---

## F. DECYZJA KLUCZOWA — kolor selekcji/CTA (to był spór tej sesji)
Sweep crimson→szary (105 plików) spłaszczył UI. Trzeba zdecydować docelową regułę:
- **Opcja A (powrót):** selekcja = crimson tint jak było (żywa, markowa).
- **Opcja B (kanon „budżet czerwieni"):** selekcja = neutral/slate + akcent **info-blue z OBECNOŚCIĄ** (nie płaski szary), crimson rezerwowany dla Teresy/destructive, CTA navy.
- **Opcja C:** hybryda — wskażesz na ekranach co ma wrócić.
To rozstrzygamy NA EKRANACH (po przywróceniu wyglądu sprzed sweepu). Nie kodować przed Twoją decyzją.

---

## G. Co dalej (po Twoim powrocie)
1. Ty: 3 decyzje z sekcji A + nazewnictwo (B) + kolor selekcji (F).
2. Ja: ten plik → jedyny autorytet; archiwizacja reszty; usunięcie duplikatów.
3. Rewert sweepu do stanu sprzed (tag `backup/pre-revert-2026-06-19` zabezpiecza obecny stan).
4. Przejście ekran-po-ekranie przeciwko TEMU dokumentowi (gdy backend danych wróci — teraz większość tabel nie ładuje danych z Railway).
