# Was ein wiederverwendbares Fabrik-Annahme-Ledger enthalten sollte

Target persona: Digital-Twin-Steward / Industrieingenieur, der modelluebergreifende Wahrheit haelt  
Funnel stage: Adoption  
Core problem: Annahmen leben in Fussnoten und Chats, sodass jedes neue Szenario Streit darueber neu startet, was "letztes Mal vereinbart" war  
Main promise: ein kompaktes Ledger-Muster, das Digital Twin zu einem nachvollziehbaren Entscheidungssystem ueber Gates und Refreshes macht

**Direkte Antwort:** ein wiederverwendbares Fabrik-Annahme-Ledger sollte Parametername, Wert oder Band, Evidenzgrad (verifiziert, illustrativ, Hypothese), Quelle oder Owner, letztes Verifikationsdatum, Szenarien und Gate-Memos, die davon abhaengen, und einen Aenderungslog-Eintrag bei jeder Bewegung enthalten. Strukturieren Sie es so, dass Finance Baender lesen kann, Operations Bodenwahrheit schnell anfechten kann und Engineering Strukturwirkungen mappen kann. Digital Twin ist ein Szenario-Testumfeld; das Ledger haelt Szenarien im Laufe der Zeit ehrlich.

Annahmen sind Verbindlichkeiten.

Behandeln Sie sie wie kontrollierte Dokumente, nicht wie Meinungen.

## Ledger-Felder: minimale Zeile

| Feld | Zweck |
|---|---|
| Parameter | was das Modell konsumiert |
| Band oder Punkt | numerisches Band oder Einzelwert mit Unsicherheitshinweis |
| Evidenzgrad | verifiziert / illustrativ / Hypothese |
| Owner | wer diese Woche Fragen beantwortet |
| Quelle | System, Studie oder Studienname |
| Abhaengige | Szenario-IDs, Gate-Memo-Links |
| Aenderungshistorie | datierte Notiz bei Wert- oder Gradwechsel |

## Was ueber Zykluszeiten hinaus gehoert

- Personal- und Skill-Mix-Verfuegbarkeit nach Schichtmodell  
- Eingangsvorlaufverhalten und Losgroessenregeln  
- Qualitaet, Ausbeute und Rework-Treiber, die effektive Kapazitaet aendern  
- Wartungs- und Ruestregeln, die Ressourcenkalender aendern  
- Lager- und Handling-Grenzen, die Flusspfade aendern  

## Checkliste: Ledger-Gesundheit vor einem grossen Gate

- [ ] keine stillen Punkta Schaetzer, wo Baender bekannt sind  
- [ ] jede Hypothesenzeile hat Kill-Datum oder Verifikations-Owner  
- [ ] abhaengige Szenarien werden markiert, wenn sich eine Zeile aendert  
- [ ] Finance-Freigabezeilen passen zur Sprache im CAPEX-Memo  

## Was Digital Twin hier aendert

Digital Twin skaliert, wenn Annahmen skalieren.

Das Ledger ist das geteilte Gedaechtnis des Entscheidungssystems.

## Was DBR77 Digital Twin ergaenzt

DBR77 Digital Twin unterstuetzt praxisnahen Szenariovergleich und Refresh-Disziplin, die natuerlich zu Annahmen-Governance passt.

## Bottom line

Wenn Sie nicht auf eine Zeile zeigen koennen, koennen Sie ein Ranking nicht verteidigen.

Bauen Sie das Ledger einmal, nutzen Sie es ueber Projekte hinweg.
