# Prezentacja udostępniona (`presentation-shared`)

**Status:** PROPOZYCJA — do słowa właściciela. Karta #56 inwentarza, moduł `11_MATERIALS`.

## §0. Tożsamość i rozstrzygnięcie zakresu

- Nazwa PL: **Prezentacja udostępniona** — widok publiczny do oglądania decka przez link.
- Trasy: `/presentations/shared/:shareToken`, `/presentations/embed/:shareToken`
  (`AppRoutes.tsx:3001,3009`).
- Komponent: `src/components/Presentations/SharedPresentationView.tsx:1` (202 linie).
- **Rozstrzygnięcie: to NIE jest karta N w rozumieniu K1–K30.** Dowody z kodu:
  - brak `ProtectedRoute`/wymogu logowania — ładuje dane przez
    `fetch('/api/presentations/shared/:shareToken')` bez nagłówka autoryzacji (`:44`),
  - brak `MainLayout`/Menu 1-2-3 (żadnego paska nawigacji aplikacji — to STRONA, nie ekran
    wewnątrz produktu),
  - brak `ArtifactRightPanel`, brak Menu 4/5, brak jakiegokolwiek AI, brak Teresy,
  - jedyna interakcja: `ChevronLeft`/`ChevronRight` (nawigacja między slajdami) — czyste
    przeglądanie, żadnej mutacji.
  - odbiorca to osoba SPOZA organizacji (klient, partner) — kanon kart N (prawy panel,
    Menu 5, „Pracuj z AI") jest zbudowany dla użytkownika wewnętrznego z kontem i uprawnieniami;
    nie ma tu ani kontekstu uprawnień, ani sensu produktowego dla większości K.

## §1–§6. Nie dotyczy

Sekcje kanonu (treść, prawy panel, Menu 5, AI, czytelność, K1–K30) nie mają tu zastosowania z
powodu opisanego w §0 — to jest odpowiednik `presentation-shared`/publicznego trybu `embed`
znanego z innych narzędzi (np. link do dashboardu bez logowania), nie „karta otwierana z listy
przez użytkownika organizacji".

## §7. Jedyna realna uwaga

Jeśli właściciel chce, żeby link publiczny miał WŁASNY, osobny standard czytelności (i18n,
zero primary-*, brak identyfikatorów technicznych w DOM — K25/K17/K28 mają sens nawet dla
publicznej strony), to warto to nazwać osobnym, węższym kontraktem „widok publiczny" — nie
rozszerzeniem K1–K30 karty N. **Do decyzji właściciela**, nie zmierzone tu bezpośrednio (brak
zrzutu w tej partii — priorytet poszedł do kart z realną tożsamością rekordu wewnątrz produktu).

**STOP:** brak — to świadome wyłączenie z zakresu K1–K30, nie brakujący pomiar.
