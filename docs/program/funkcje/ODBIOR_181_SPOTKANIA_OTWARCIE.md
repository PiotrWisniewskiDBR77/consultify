---
doc_id: funkcje-odbior-181
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 181 — otwarcie Spotkań · NIE SCALAĆ (FIX-181 wydany)

Flip bety realny (mutacja odbioru: closed→3 FAIL, open→8/8; mirror identyczny),
4 zastane testy potraktowane wzorowo (podmiana przykładu w finance-teście zamiast
ślepego odwrócenia; GF-06 uczciwie zostawiony czerwony z przyczyną). Oceny:
flip **A** · R3 **D** · zrzuty **D** · STOP-korekta **B+**.

## Dwa blokery
1. **D-1 niespełnione end-to-end:** MEMBER nadal przekierowywany — nie przez betę,
   tylko przez bramkę pilota (`pilotAccess.ts` `PILOT_ALLOWED_ROUTE_PREFIXES` bez
   `/meetings` + `RouterSync.tsx:316-325`). Instrukcja tego nie przewidziała —
   błąd autorski nadzorcy; wykonawca poprawnie obalił i udokumentował.
2. ★ **Karta MODULE_ACCEPTANCE twierdzi „approved renders" wbrew WŁASNEMU zrzutowi**
   (spinner). **12/21 PNG to puste spinnery** — cała strona obiektu spotkania nie
   ładuje się (podejrzenie: `requireActiveMeetingMembership` — ta sama przyczyna
   co czerwony GF-06). Cytaty MTG-PF-003/004 wskazują zrzuty, które niczego nie
   pokazują. Do sprostowania w karcie, nie do zamiecenia.

## FIX-181 (wewnętrzny): (1) `/meetings` w prefiksach pilota + test end-to-end
renderu dla MEMBER; (2) sprostowanie fałszywych twierdzeń karty; (3) diagnoza
spinnera obiektu (membership?) — fix jeśli płytki, raport jeśli głęboki.

## Dla toru grafiki / rejestru
Interfejs Meetings niemal w całości po angielsku (pierwszy kontakt właściciela!);
„Could not load the operator brief" na podglądzie; surowe sluggi uczestników;
`owner-empty-...-light.png` renderuje ciemny motyw (wadliwe przechwycenie);
crimson „Log Out" w menu profilu (chrome globalny — do oceny grafiki).
